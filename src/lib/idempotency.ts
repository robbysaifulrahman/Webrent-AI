import { getKvConfig, kvCommand } from "./kv";

/**
 * Idempotency-Key (header `Idempotency-Key`): menyimpan hasil operasi
 * POST agar retry yang sama tidak mengeksekusi ulang.
 *
 * Implementasi Phase B (tanpa worker/DB baru):
 * - Bila KV (Upstash/Vercel) terkonfigurasi → `SET NX PX` di Redis,
 *   idempotent lintas instance serverless.
 * - Selain itu → fallback in-memory per-instance (cukup untuk dev).
 */

const PREFIX = "idem:";
const DEFAULT_TTL_SECONDS = 60 * 60; // 1 jam

// Fallback in-memory: key → { payload, expiresAt }.
const memory = new Map<string, { payload: string; expiresAt: number }>();

function memoryGet(key: string): string | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.payload;
}

function memorySet(key: string, payload: string, ttlSeconds: number): void {
  memory.set(key, { payload, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** Ambil payload tersimpan untuk key ini; null bila belum ada (belum pernah dipakai). */
export async function getIdempotent(key: string): Promise<string | null> {
  const k = PREFIX + key;
  const kv = getKvConfig();
  if (kv) {
    try {
      return await kvCommand<string>(kv, ["GET", k]);
    } catch {
      // KV tidak sehat → jatuh ke memori, jangan gagalkan request.
    }
  }
  return memoryGet(key);
}

/**
 * Klaim key: simpan payload hanya bila key BELUM ada (SET NX).
 * Mengembalikan false bila key sudah pernah dipakai → pemanggil harus
 * mengembalikan hasil lama, bukan mengeksekusi ulang.
 */
export async function claimIdempotent(
  key: string,
  payload: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const k = PREFIX + key;
  const kv = getKvConfig();
  if (kv) {
    try {
      const result = await kvCommand<unknown>(kv, [
        "SET", k, payload, "NX", "PX", ttlSeconds * 1000,
      ]);
      return result === "OK" || result === 1;
    } catch {
      // KV tidak sehat → lanjut ke memori.
    }
  }
  if (memoryGet(key) !== null) return false;
  memorySet(key, payload, ttlSeconds);
  return true;
}

/** Baca header Idempotency-Key dari request (opsional). */
export function getIdempotencyKey(req: Request): string | null {
  const raw = req.headers.get("idempotency-key")?.trim();
  if (!raw) return null;
  // Normalisasi: batasi charset/panjang agar aman jadi komponen key Redis.
  const normalized = raw.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 128);
  return normalized.length >= 8 ? normalized : null;
}

/**
 * Timpa payload key yang sudah diklaim (mis. menyimpan hasil akhir operasi
 * setelah klaim awal). Kegagalan KV ditelan — fallback memori tetap jalan.
 */
export async function overwriteIdempotent(
  key: string,
  payload: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const k = PREFIX + key;
  const kv = getKvConfig();
  if (kv) {
    try {
      await kvCommand(kv, ["SET", k, payload, "PX", ttlSeconds * 1000]);
    } catch {
      // KV tidak sehat → cukup memori di bawah.
    }
  }
  memorySet(key, payload, ttlSeconds);
}
