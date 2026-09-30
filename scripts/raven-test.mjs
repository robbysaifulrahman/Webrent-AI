#!/usr/bin/env node
/**
 * Simulasi klien Raven — menguji pipeline Phase F end-to-end.
 *
 * Mensimulasikan service Raven eksternal yang sah:
 * 1. POST /api/v1/integrations/raven/register   (registrasi service)
 * 2. POST /api/v1/integrations/raven/heartbeat  (liveness)
 * 3. POST /api/v1/integrations/raven/events     (SECURITY_ALERT HIGH  → insiden + notif Telegram)
 * 4. POST /api/v1/integrations/raven/events     (SECURITY_ALERT MEDIUM → event saja, tanpa insiden)
 * 5. POST /api/v1/integrations/raven/events     (signature salah → harus 401)
 *
 * Autentikasi (src/lib/raven.ts): HMAC-SHA256 atas `${timestamp}.${rawBody}`
 * dengan RAVEN_SERVICE_SECRET, window ±5 menit.
 *
 * Pemakaian:
 *   node scripts/raven-test.mjs [BASE_URL]
 *   BASE_URL default = WEBHOOK_BASE_URL env (https://webrent-office.vercel.app)
 */

import { createHmac } from "node:crypto";
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
    /* abaikan */
  }
}
loadEnvFile(resolve(process.cwd(), ".env.local"));

const base = (
  process.argv[2] ??
  process.env.WEBHOOK_BASE_URL ??
  ""
).trim().replace(/\/+$/, "");
const secret = process.env.RAVEN_SERVICE_SECRET?.trim() ?? "";
const serviceId = process.env.RAVEN_SERVICE_ID?.trim() || "raven-security";

if (!base || !secret) {
  console.error(
    "GAGAL: WEBHOOK_BASE_URL dan RAVEN_SERVICE_SECRET harus diisi (.env.local).",
  );
  process.exit(1);
}

const sign = (timestamp, rawBody) =>
  createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

async function ravenPost(path, payload, { badSignature = false } = {}) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const headers = {
    "Content-Type": "application/json",
    "X-Service-Id": serviceId,
    "X-Webhook-Timestamp": timestamp,
    "X-Webhook-Signature": badSignature
      ? "0".repeat(64)
      : sign(timestamp, rawBody),
    "Idempotency-Key": `raven-sim-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
  };
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: rawBody,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function report(label, result, expect) {
  const ok = expect(result);
  console.log(
    `${ok ? "OK " : "GAGAL"} ${label} → HTTP ${result.status} ${JSON.stringify(
      result.body.data ?? result.body.error ?? result.body,
    )}`,
  );
  return ok;
}

console.log(`Simulasi Raven → ${base}`);

let allOk = true;

// 1. Register
const reg = await ravenPost("/api/v1/integrations/raven/register", {
  service: serviceId,
  version: "1.0.0-sim",
  environment: "simulation",
  hostname: "laptop-lokal",
  capabilities: ["monitoring", "anomaly-detection"],
});
allOk =
  report(
    "register",
    reg,
    (r) => r.status === 200 && r.body.data?.registered === true,
  ) && allOk;

// 2. Heartbeat
const hb = await ravenPost("/api/v1/integrations/raven/heartbeat", {
  status: "healthy",
  version: "1.0.0-sim",
  uptime: 3600,
});
allOk =
  report(
    "heartbeat",
    hb,
    (r) => r.status === 200 && r.body.data?.status === "CONNECTED",
  ) && allOk;

// 3. Alert HIGH → insiden + notifikasi Telegram
const high = await ravenPost("/api/v1/integrations/raven/events", {
  event: "SECURITY_ALERT",
  severity: "HIGH",
  source: "raven-sim",
  target: { type: "SERVER", id: "webrent-vps-01" },
  details: {
    category: "ANOMALOUS_ACTIVITY",
    title: "Simulasi: percobaan akses tidak sah",
    description: "Event simulasi dari scripts/raven-test.mjs",
  },
});
allOk =
  report("event HIGH", high, (r) => {
    const d = r.body.data;
    return (
      r.status === 200 &&
      d?.incident?.id &&
      d?.notified_telegram >= 0
    );
  }) && allOk;
if (high.body.data?.incident) {
  console.log(
    `   → Insiden ${high.body.data.incident.id} dibuat; notifikasi Telegram terkirim ke ${high.body.data.notified_telegram} admin.`,
  );
}

// 4. Alert MEDIUM → event dicatat, tanpa insiden
const med = await ravenPost("/api/v1/integrations/raven/events", {
  event: "SECURITY_ALERT",
  severity: "MEDIUM",
  source: "raven-sim",
  target: { type: "SERVER", id: "webrent-vps-01" },
  details: {
    category: "RATE_ANOMALY",
    title: "Simulasi: anomali ringan",
  },
});
allOk =
  report("event MEDIUM", med, (r) => r.status === 200 && !r.body.data?.incident) &&
  allOk;

// 5. Signature salah → 401
const bad = await ravenPost(
  "/api/v1/integrations/raven/events",
  { event: "SECURITY_ALERT", severity: "LOW" },
  { badSignature: true },
);
allOk = report("signature salah", bad, (r) => r.status === 401) && allOk;

console.log(
  allOk
    ? "\nSEMUA LOLOS — pipeline Raven berfungsi. Cek Telegram utk notifikasi insiden."
    : "\nADA YANG GAGAL — periksa output di atas.",
);
process.exit(allOk ? 0 : 1);
