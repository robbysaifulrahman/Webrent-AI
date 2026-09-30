#!/usr/bin/env node
/**
 * Setup Telegram Bot (one-time / saat base URL berubah).
 *
 * 1. setWebhook  — daftarkan endpoint webhook + secret_token
 * 2. setMyCommands — daftarkan menu command agar tampil di UI Telegram
 *
 * Env yang dibaca (.env.local otomatis dimuat bila ada):
 * - TELEGRAM_BOT_TOKEN      (wajib)
 * - TELEGRAM_WEBHOOK_SECRET (wajib) — nilai SAMA dengan yang di server
 * - WEBHOOK_BASE_URL        (wajib) — URL publik app, mis. https://webrent.my.id
 *
 * Pemakaian: npm run telegram:setup
 *
 * Catatan: daftar command di bawah disinkronkan dengan TELEGRAM_COMMANDS
 * di src/lib/telegram.ts.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- Muat .env.local sederhana (KEY=VALUE, tanpa dependensi) ---
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
    /* file tidak ada — abaikan */
  }
}
loadEnvFile(resolve(process.cwd(), ".env.local"));

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
const baseUrl = (process.env.WEBHOOK_BASE_URL ?? "").trim().replace(/\/+$/, "");
const webhookUrl = `${baseUrl}/api/v1/integrations/telegram/webhook`;

const missing = [
  !botToken && "TELEGRAM_BOT_TOKEN",
  !webhookSecret && "TELEGRAM_WEBHOOK_SECRET",
  !baseUrl && "WEBHOOK_BASE_URL",
].filter(Boolean);

if (missing.length) {
  console.error(`GAGAL: env belum lengkap: ${missing.join(", ")}`);
  console.error("Isi di .env.local (lokal) atau Vercel env (produksi), lalu ulangi.");
  process.exit(1);
}

if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(localhost|127\.)/.test(baseUrl)) {
  console.error(`GAGAL: WEBHOOK_BASE_URL harus https:// (URL publik), dapat: ${baseUrl}`);
  process.exit(1);
}

// Sinkron dengan TELEGRAM_COMMANDS di src/lib/telegram.ts
const COMMANDS = [
  { command: "start", description: "Mulai bot & bantuan" },
  { command: "status", description: "Ringkasan kantor" },
  { command: "briefing", description: "Briefing harian" },
  { command: "health", description: "Health check sistem" },
  { command: "agents", description: "Daftar agent" },
  { command: "agent", description: "Detail agent: /agent <id>" },
  { command: "tasks", description: "Task aktif" },
  { command: "task", description: "Detail/mutasi task: /task <id|create|assign|cancel>" },
  { command: "incidents", description: "Insiden aktif" },
  { command: "incident", description: "Detail insiden: /incident <id|acknowledge|resolve>" },
  { command: "integrations", description: "Status integrasi & storage" },
  { command: "meetings", description: "Daftar meeting" },
  { command: "raven", description: "Status Raven: /raven status" },
  { command: "help", description: "Bantuan" },
];

async function callBotApi(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.ok !== false, body };
}

const webhook = await callBotApi("setWebhook", {
  url: webhookUrl,
  secret_token: webhookSecret,
  allowed_updates: ["message"],
});

if (!webhook.ok) {
  console.error("GAGAL setWebhook:", JSON.stringify(webhook.body, null, 2));
  process.exit(1);
}
console.log(`OK setWebhook → ${webhookUrl}`);
console.log("   ", JSON.stringify(webhook.body.result ?? {}));

const commands = await callBotApi("setMyCommands", { commands: COMMANDS });
if (!commands.ok) {
  console.error("GAGAL setMyCommands:", JSON.stringify(commands.body, null, 2));
  process.exit(1);
}
console.log(`OK setMyCommands (${COMMANDS.length} command terdaftar).`);
console.log("Selesai. Coba kirim /start ke bot Anda di Telegram.");
