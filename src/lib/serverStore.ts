import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  MAX_AUDIT,
  seedSnapshot,
  SERVER_STATE_KEY,
  type OfficeSnapshot,
} from "@/lib/officeData";
import { getKvConfig, kvCommand } from "@/lib/kv";
import { getDbConfig, query } from "@/lib/db";

const SERVER_VERSION_KEY = `${SERVER_STATE_KEY}:version`;

/**
 * CAS atomik di Redis: tulis state hanya jika versi saat ini cocok.
 * KEYS[1]=state, KEYS[2]=version, ARGV[1]=expected, ARGV[2]=payload, ARGV[3]=newVersion
 * Mengembalikan 1 bila berhasil, 0 bila versi tidak cocok.
 */
const CAS_LUA = `local cur = redis.call('GET', KEYS[2])
if (cur == false) then cur = '1' end
if (cur == ARGV[1]) then
  redis.call('SET', KEYS[1], ARGV[2])
  redis.call('SET', KEYS[2], ARGV[3])
  return 1
end
return 0`;

// Serialisasi in-process untuk driver file (mencegah race antar-request
// pada proses yang sama). Bukan lock lintas-proses.
let fileLock: Promise<unknown> = Promise.resolve();

function withFileLock<T>(task: () => Promise<T>): Promise<T> {
  const run = fileLock.then(task, task);
  fileLock = run.catch(() => undefined);
  return run;
}

/**
 * Adapter persistensi state kantor.
 *
 * Urutan driver (bisa dipaksa via env STORAGE_DRIVER=kv|postgres|file):
 * - "kv"       → env Upstash/Vercel KV (KV_REST_API_URL + KV_REST_API_TOKEN,
 *                atau UPSTASH_REDIS_REST_*) via REST.
 * - "postgres" → env DATABASE_URL (Phase C), snapshot JSONB + CAS versi.
 * - "file"     → fallback file JSON lokal (untuk pengembangan).
 *
 * Semua fungsi selalu mengembalikan snapshot; kesalahan I/O tidak fatal.
 */

export type StorageDriver = "kv" | "postgres" | "file";

export function getStorageDriver(): StorageDriver {
  const override = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (override === "kv" && getKvConfig()) return "kv";
  if (override === "postgres" && getDbConfig()) return "postgres";
  if (override === "file") return "file";

  if (getKvConfig()) return "kv";
  if (getDbConfig()) return "postgres";
  return "file";
}

function isPostgresDriver(): boolean {
  return getStorageDriver() === "postgres";
}

function filePath(): string {
  const dir = process.env.VERCEL
    ? path.join(os.tmpdir(), "webrent-office")
    : path.join(process.cwd(), ".data");
  return path.join(dir, "office-state.json");
}

async function readFile(): Promise<OfficeSnapshot | null> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as { data?: OfficeSnapshot } | OfficeSnapshot;
    if (parsed && typeof parsed === "object" && "tasks" in parsed) {
      return parsed as OfficeSnapshot;
    }
    if (parsed && typeof parsed === "object" && "data" in parsed && parsed.data) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeFile(snapshot: OfficeSnapshot): Promise<void> {
  const target = filePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(
    target,
    JSON.stringify({ data: snapshot, updatedAt: Date.now() }, null, 2),
    "utf8",
  );
}

export function sanitizeSnapshot(input: unknown): OfficeSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<OfficeSnapshot>;
  if (!Array.isArray(candidate.tasks)) return null;
  if (!Array.isArray(candidate.incidents)) return null;
  if (!Array.isArray(candidate.decisions)) return null;

  const audit = Array.isArray(candidate.audit)
    ? candidate.audit.slice(0, MAX_AUDIT)
    : [];

  return {
    tasks: candidate.tasks,
    incidents: candidate.incidents,
    decisions: candidate.decisions,
    audit,
    taskSeq: Number(candidate.taskSeq) || 1,
    incidentSeq: Number(candidate.incidentSeq) || 1,
    decisionSeq: Number(candidate.decisionSeq) || 1,
    version: Number(candidate.version) || 1,
  };
}

export async function loadSnapshot(): Promise<OfficeSnapshot> {
  const kv = getKvConfig();
  if (kv) {
    try {
      const raw = await kvCommand<string>(kv, ["GET", SERVER_STATE_KEY]);
      if (raw) {
        const parsed = sanitizeSnapshot(JSON.parse(raw));
        if (parsed) return parsed;
      }
    } catch (err) {
      console.warn("[serverStore] KV load gagal:", err);
    }
    return seedSnapshot();
  }

  if (isPostgresDriver()) {
    try {
      const result = await query<{ payload: unknown }>(
        "SELECT payload FROM office_state WHERE id = 1",
      );
      const raw = result.rows[0]?.payload;
      if (raw) {
        const parsed = sanitizeSnapshot(
          typeof raw === "string" ? JSON.parse(raw) : raw,
        );
        if (parsed) return parsed;
      }
    } catch (err) {
      console.warn("[serverStore] Postgres load gagal:", err);
    }
    return seedSnapshot();
  }

  const fromFile = await readFile();
  return fromFile ?? seedSnapshot();
}

export async function saveSnapshot(input: unknown): Promise<boolean> {
  const snapshot = sanitizeSnapshot(input);
  if (!snapshot) return false;

  const kv = getKvConfig();
  if (kv) {
    try {
      await kvCommand(kv, [
        "SET",
        SERVER_STATE_KEY,
        JSON.stringify(snapshot),
      ]);
      await kvCommand(kv, ["SET", SERVER_VERSION_KEY, String(snapshot.version)]);
      return true;
    } catch (err) {
      console.warn("[serverStore] KV save gagal:", err);
      return false;
    }
  }

  if (isPostgresDriver()) {
    try {
      await query(
        `INSERT INTO office_state (id, version, payload)
         VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE
         SET version = EXCLUDED.version, payload = EXCLUDED.payload, updated_at = now()`,
        [snapshot.version, JSON.stringify(snapshot)],
      );
      return true;
    } catch (err) {
      console.warn("[serverStore] Postgres save gagal:", err);
      return false;
    }
  }

  try {
    await withFileLock(() => writeFile(snapshot));
    return true;
  } catch (err) {
    console.warn("[serverStore] File save gagal:", err);
    return false;
  }
}

/**
 * Menyimpan snapshot hanya bila `expectedVersion` masih cocok dengan versi
 * server saat ini (compare-and-set atomik).
 *
 * - KV: Lua EVAL memeriksa versi dan menulis dalam satu operasi atomik.
 * - file: dibungkus lock in-process (serialisasi request pada proses ini).
 *
 * Mengembalikan false bila versi sudah berubah (panggilan harus mengulang).
 */
export async function compareAndSave(
  expectedVersion: number,
  snapshot: OfficeSnapshot,
): Promise<boolean> {
  const newVersion = expectedVersion + 1;
  const payload = JSON.stringify({ ...snapshot, version: newVersion });

  const kv = getKvConfig();
  if (kv) {
    try {
      const result = await kvCommand<number>(kv, [
        "EVAL",
        CAS_LUA,
        "2",
        SERVER_STATE_KEY,
        SERVER_VERSION_KEY,
        String(expectedVersion),
        payload,
        String(newVersion),
      ]);
      return Number(result) === 1;
    } catch (err) {
      console.warn("[serverStore] KV compare-and-save gagal:", err);
      return false;
    }
  }

  if (isPostgresDriver()) {
    try {
      // CAS atomik satu statement:
      // - row belum ada & expected = 1 → INSERT (bootstrap, setara Lua KV).
      // - row ada & version cocok → UPDATE.
      // - version tidak cocok → 0 row terdampak → pemanggil mengulang.
      const result = await query(
        `WITH target AS (
           SELECT COALESCE((SELECT version FROM office_state WHERE id = 1), 1) AS cur
         )
         INSERT INTO office_state (id, version, payload)
         SELECT 1, $2, $3 FROM target WHERE cur = $1
         ON CONFLICT (id) DO UPDATE
         SET version = EXCLUDED.version, payload = EXCLUDED.payload, updated_at = now()
         WHERE office_state.version = $1`,
        [expectedVersion, newVersion, payload],
      );
      return (result.rowCount ?? 0) === 1;
    } catch (err) {
      console.warn("[serverStore] Postgres compare-and-save gagal:", err);
      return false;
    }
  }

  return withFileLock(async () => {
    const current = (await readFile()) ?? seedSnapshot();
    if (current.version !== expectedVersion) return false;
    await writeFile({ ...snapshot, version: newVersion });
    return true;
  });
}
