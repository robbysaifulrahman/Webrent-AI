#!/usr/bin/env node
/**
 * Runner migrasi PostgreSQL — Phase C.
 *
 * Pakai: node scripts/migrate.mjs
 * Butuh env DATABASE_URL (postgres://...).
 * Idempoten: file .sql dijalankan sekali, tercatat di schema_migrations.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "db/migrations");

function getConnectionString() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL tidak diisi. Contoh:");
    console.error("  DATABASE_URL=postgres://user:pass@host:5432/webrent node scripts/migrate.mjs");
    process.exit(1);
  }
  return url;
}

function sslOption(connectionString) {
  // Neon/Supabase/VPS publik butuh TLS; localhost tidak.
  const host = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return "";
    }
  })();
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  return local || process.env.PGSSL === "disable"
    ? undefined
    : { rejectUnauthorized: false };
}

async function main() {
  const pool = new pg.Pool({
    connectionString: getConnectionString(),
    max: 1,
    ssl: sslOption(process.env.DATABASE_URL?.trim() ?? ""),
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await pool.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("Tidak ada file migrasi di", MIGRATIONS_DIR);
      return;
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`= ${file} (sudah diterapkan)`);
        continue;
      }
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        ran += 1;
        console.log(`+ ${file} diterapkan`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`${file}: ${err.message}`);
      } finally {
        client.release();
      }
    }
    console.log(`Selesai. Migrasi baru dijalankan: ${ran}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migrasi gagal:", err.message);
  process.exit(1);
});
