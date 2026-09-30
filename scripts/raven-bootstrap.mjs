#!/usr/bin/env node
/**
 * Cetak blok env siap-tempel untuk SISI RAVEN — shared secret harus sama
 * dengan yang dipakai WebRent (RAVEN_SERVICE_SECRET di .env.local / Vercel).
 *
 * Model: shared secret simetris (src/lib/raven.ts).
 * - Raven menandatangani request: HMAC-SHA256(secret, `${timestamp}.${body}`)
 *   → header X-Webhook-Timestamp + X-Webhook-Signature (+ X-Service-Id).
 * - WebRent verifikasi dengan secret yang sama, window ±5 menit.
 * - TIDAK ada endpoint penerima secret — distribusi hanya via kanal aman.
 *
 * Pemakaian:
 *   npm run raven:bootstrap          → cetak blok env (nilai penuh)
 *   npm run raven:bootstrap -- --mask → sembunyikan nilai secret
 *
 * ⚠  Jalankan di mespi Anda sendiri; jangan tempel output mentah di chat.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* abaikan */
  }
}
loadEnvFile(resolve(process.cwd(), ".env.local"));

const mask = process.argv.includes("--mask");
const secret = process.env.RAVEN_SERVICE_SECRET?.trim() ?? "";
const serviceId = process.env.RAVEN_SERVICE_ID?.trim() || "raven-security";
const baseUrl =
  process.env.WEBHOOK_BASE_URL?.trim() || "https://webrent-office.vercel.app";

if (!secret) {
  console.error("RAVEN_SERVICE_SECRET tidak ditemukan di .env.local.");
  process.exit(1);
}

const show = mask ? `${secret.slice(0, 6)}…${secret.slice(-4)} (disamarkan)` : secret;

console.log(
  [
    "Blok env untuk deployment RAVEN (tempel di .env / EnvironmentFile Raven):",
    "",
    `RAVEN_SERVICE_ID=${serviceId}`,
    `RAVEN_SERVICE_SECRET=${show}`,
    "",
    "# Target WebRent Integration API:",
    `WEBRENT_API_URL=${baseUrl}`,
    "",
    "Endpoint yang dikenai HMAC oleh WebRent:",
    `  POST ${baseUrl}/api/v1/integrations/raven/register   (sekali saat startup)`,
    `  POST ${baseUrl}/api/v1/integrations/raven/heartbeat  (berkala < 90 detik)`,
    `  POST ${baseUrl}/api/v1/integrations/raven/events     (event keamanan)`,
    "",
    "Cara menandatangani (contoh Node.js):",
    '  const ts = String(Date.now());',
    "  const sig = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');",
    "  // header: X-Service-Id, X-Webhook-Timestamp: ts, X-Webhook-Signature: sig",
    "",
    mask
      ? "Nilai penuh ada di .env.local proyek ini — salin dari sana, JANGAN via chat."
      : "⚠ Nilai secret ditampilkan penuh — gunakan hanya di kanal tepercaya (SSH, vault).",
  ].join("\n"),
);
