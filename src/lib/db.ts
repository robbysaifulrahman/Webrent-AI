import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

/**
 * Driver PostgreSQL — Phase C (Connect PostgreSQL).
 *
 * Pola yang sama dengan kv.ts: bila DATABASE_URL tidak diisi, modul ini
 * "tidak ada" (null) dan pemanggil jatuh ke driver lain (KV / file).
 * Tidak ada kredensial di repo — semuanya dari env.
 */

export interface DbConfig {
  connectionString: string;
  ssl: boolean;
}

/** Konfigurasi DB dari env. Null bila DATABASE_URL kosong. */
export function getDbConfig(): DbConfig | null {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;

  let host = "";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    // connection string tidak valid — biarkan Pool yang mengeluh saat dipakai.
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  const ssl = !local && process.env.PGSSL !== "disable";
  return { connectionString, ssl };
}

// Pool singleton per proses. max kecil agar aman di serverless
// (banyak instance × koneksi) — Section 47/48 master prompt.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config = getDbConfig();
    if (!config) {
      throw new Error("DATABASE_URL tidak diisi — driver Postgres tidak aktif.");
    }
    pool = new Pool({
      connectionString: config.connectionString,
      max: Number(process.env.PG_POOL_MAX?.trim()) || 3,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });
    // Cegah unhandled error event (koneksi idle putus dsb.).
    pool.on("error", (err) => {
      console.warn("[db] pool error:", err.message);
    });
  }
  return pool;
}

/** Tutup pool (untuk test / shutdown). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => undefined);
    pool = null;
  }
}

/** Jalankan satu query. Error dibiarkan naik — pemanggil yang memutuskan fallback. */
export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[],
  client?: PoolClient,
): Promise<QueryResult<T>> {
  if (client) return client.query<T>(text, params as unknown[]);
  return getPool().query<T>(text, params as unknown[]);
}

export interface DbPing {
  up: boolean;
  latencyMs: number | null;
  error: string | null;
}

/** Cek kesehatan DB (health/system-status). Tidak pernah throw. */
export async function pingDb(): Promise<DbPing> {
  const config = getDbConfig();
  if (!config) return { up: false, latencyMs: null, error: "NOT_CONFIGURED" };

  const startedAt = Date.now();
  try {
    await query("SELECT 1");
    return { up: true, latencyMs: Date.now() - startedAt, error: null };
  } catch (err) {
    return {
      up: false,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
