import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { POST as ravenEvents } from "./raven/events/route";
import { POST as telegramWebhook } from "./telegram/webhook/route";
import { GET as integrationsRegistry } from "./route";
import { getTelegramConfig } from "@/lib/telegram";
import { clearEventBus, recentEvents } from "@/lib/eventBus";
import { resetIntegrations } from "@/lib/integrations";
import { loadSnapshot } from "@/lib/serverStore";
import { createIncidentServer } from "@/lib/officeOps";
import { YEAR } from "@/lib/officeData";

const ENV_KEYS = [
  "RAVEN_SERVICE_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_ADMIN_CHAT_IDS",
  "TELEGRAM_ALLOWED_CHAT_IDS",
  "DATABASE_URL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;
const saved = new Map<string, string | undefined>();

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!saved.has(key)) saved.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function sign(secret: string, body: string): { headers: Headers } {
  const ts = String(Date.now());
  return {
    headers: new Headers({
      "content-type": "application/json",
      "x-webhook-timestamp": ts,
      "x-webhook-signature": createHmac("sha256", secret)
        .update(`${ts}.${body}`)
        .digest("hex"),
      "idempotency-key": `raven-test-${Date.now()}-${Math.random()}`,
    }),
  };
}

beforeEach(() => {
  clearEventBus();
  resetIntegrations();
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const [k, v] of saved) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  saved.clear();
  vi.unstubAllGlobals();
});

describe("POST /api/v1/integrations/raven/events (pipeline Section 9)", () => {
  it("disabled → 503 jujur", async () => {
    const res = await ravenEvents(new Request("http://x", { method: "POST", body: "{}" }), {} as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("RAVEN_DISABLED");
  });

  it("HIGH severity → SECURITY_ALERT + INCIDENT_CREATED + snapshot berubah", async () => {
    setEnv("RAVEN_SERVICE_SECRET", "secret-test-123");
    const body = JSON.stringify({
      event: "SECURITY_ALERT",
      severity: "HIGH",
      source: "raven",
      target: { type: "SERVER", id: "webrent-vps-01" },
      details: { category: "ANOMALOUS_ACTIVITY", description: "Suspicious activity" },
    });
    const { headers } = sign("secret-test-123", body);

    const res = await ravenEvents(
      new Request("http://x/api/v1/integrations/raven/events", { method: "POST", body, headers }),
      {} as never,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.received).toBe(true);
    expect(data.persisted).toBe(false); // tanpa DATABASE_URL → ring memori
    expect(data.incident).toMatchObject({
      severity: "HIGH",
      asset: "webrent-vps-01",
      status: "OPEN",
    });

    // Event SECURITY_ALERT + INCIDENT_CREATED masuk bus.
    const events = await recentEvents({ limit: 200 });
    const types = events.map((e) => e.type);
    expect(types).toContain("SECURITY_ALERT");
    expect(types).toContain("INCIDENT_CREATED");

    // Insiden benar-benar tersimpan di snapshot server (source of truth).
    const snapshot = await loadSnapshot();
    expect(
      snapshot.incidents.some((i) => i.id === data.incident.id && i.source === "RAVEN"),
    ).toBe(true);
  });

  it("severity tidak valid → 422", async () => {
    setEnv("RAVEN_SERVICE_SECRET", "secret-test-123");
    const body = JSON.stringify({ event: "SECURITY_ALERT", severity: "EKSTREM" });
    const { headers } = sign("secret-test-123", body);
    const res = await ravenEvents(
      new Request("http://x", { method: "POST", body, headers }),
      {} as never,
    );
    expect(res.status).toBe(422);
  });
});

describe("POST /api/v1/integrations/telegram/webhook (Section 18-20)", () => {
  it("tanpa env → 503 TELEGRAM_DISABLED", async () => {
    expect(getTelegramConfig()).toBeNull();
    const res = await telegramWebhook(new Request("http://x", { method: "POST", body: "{}" }), {} as never);
    expect(res.status).toBe(503);
  });

  it("secret salah → 403", async () => {
    setEnv("TELEGRAM_BOT_TOKEN", "tok");
    setEnv("TELEGRAM_WEBHOOK_SECRET", "webhook-secret-xyz");
    const res = await telegramWebhook(
      new Request("http://x", {
        method: "POST",
        body: "{}",
        headers: { "x-telegram-bot-api-secret-token": "salah" },
      }),
      {} as never,
    );
    expect(res.status).toBe(403);
  });

  it("/status diproses + balasan dikirim via Bot API (fetch stub)", async () => {
    setEnv("TELEGRAM_BOT_TOKEN", "tok");
    setEnv("TELEGRAM_WEBHOOK_SECRET", "webhook-secret-xyz");
    const sent: Array<{ chat_id: number; text: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        sent.push(JSON.parse(String(init?.body)) as { chat_id: number; text: string });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    const update = { message: { chat: { id: 42 }, text: "/status" } };
    const res = await telegramWebhook(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify(update),
        headers: { "x-telegram-bot-api-secret-token": "webhook-secret-xyz" },
      }),
      {} as never,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.processed).toBe(true);
    expect(data.reply_sent).toBe(true);
    expect(sent[0].chat_id).toBe(42);
    expect(sent[0].text).toContain("WEBRENT AI OFFICE");
  });

  it("perintah mutasi dari non-admin ditolak", async () => {
    setEnv("TELEGRAM_BOT_TOKEN", "tok");
    setEnv("TELEGRAM_WEBHOOK_SECRET", "webhook-secret-xyz");
    setEnv("TELEGRAM_ADMIN_CHAT_IDS", "999");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    const update = { message: { chat: { id: 42 }, text: "/task create Audit" } };
    const res = await telegramWebhook(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify(update),
        headers: { "x-telegram-bot-api-secret-token": "webhook-secret-xyz" },
      }),
      {} as never,
    );
    expect(res.status).toBe(200);
    // Balasan ditolak — task tidak dibuat.
    const snapshot = await loadSnapshot();
    expect(snapshot.tasks.some((t) => t.source === "TELEGRAM")).toBe(false);
  });
});

describe("GET /api/v1/integrations (registry Section 24)", () => {
  it("berisi raven + telegram dengan status jujur", async () => {
    const res = await integrationsRegistry(new Request("http://x"), {} as never);
    const data = (await res.json()).data;
    expect(data.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "raven", status: "DISCONNECTED" }),
        expect.objectContaining({ id: "telegram", status: "DISABLED" }),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Command engine Telegram — perluasan Section 19/21 (briefing, task assign/
// cancel, incident ack/resolve, approve/reject).
//
// State ditulis ke tmpdir (VERCEL=1) supaya test tidak mengotori
// .data/office-state.json proyek.
// ---------------------------------------------------------------------------
const TMP_STATE = path.join(os.tmpdir(), "webrent-office", "office-state.json");

function stubReplyCapture(): Array<{ chat_id: number; text: string }> {
  const sent: Array<{ chat_id: number; text: string }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)) as { chat_id: number; text: string });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }),
  );
  return sent;
}

async function sendTelegram(text: string, chatId = 999) {
  const update = { message: { chat: { id: chatId }, text } };
  return telegramWebhook(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify(update),
      headers: { "x-telegram-bot-api-secret-token": "webhook-secret-xyz" },
    }),
    {} as never,
  );
}

describe("Telegram command engine — baca (Section 19)", () => {
  beforeEach(() => {
    setEnv("TELEGRAM_BOT_TOKEN", "tok");
    setEnv("TELEGRAM_WEBHOOK_SECRET", "webhook-secret-xyz");
    process.env.VERCEL = "1";
  });

  afterEach(async () => {
    delete process.env.VERCEL;
    await rm(TMP_STATE, { force: true });
  });

  it("/briefing → ringkasan harian dari snapshot server", async () => {
    const sent = stubReplyCapture();
    const res = await sendTelegram("/briefing");
    expect(res.status).toBe(200);
    expect(sent[0].text).toContain("WEBRENT DAILY BRIEFING");
    expect(sent[0].text).toContain("EXECUTIVE SUMMARY");
    expect(sent[0].text).toContain("PENDING APPROVALS");
  });

  it("/task <id> → detail task", async () => {
    const sent = stubReplyCapture();
    await sendTelegram(`/task WR-${YEAR}-0001`);
    expect(sent[0].text).toContain(`WR-${YEAR}-0001`);
    expect(sent[0].text).toContain("Status: TODO");
  });

  it("/task <id> tak dikenal → pesan jujur", async () => {
    const sent = stubReplyCapture();
    await sendTelegram("/task WR-1999-9999");
    expect(sent[0].text).toContain("tidak ditemukan");
  });

  it("/agent <id> → profil agent + task departemen", async () => {
    const sent = stubReplyCapture();
    await sendTelegram("/agent security");
    expect(sent[0].text).toContain("Sari Melati");
    expect(sent[0].text).toContain("Departemen: security");
  });

  it("/integrations → status raven/telegram/storage", async () => {
    const sent = stubReplyCapture();
    await sendTelegram("/integrations");
    expect(sent[0].text).toContain("INTEGRATIONS");
    expect(sent[0].text).toContain("raven: DISCONNECTED");
    expect(sent[0].text).toContain("storage: file");
  });

  it("/meetings → DATA_NOT_AVAILABLE (jujur)", async () => {
    const sent = stubReplyCapture();
    await sendTelegram("/meetings");
    expect(sent[0].text).toContain("DATA_NOT_AVAILABLE");
  });
});

describe("Telegram command engine — mutasi admin (Section 19/21)", () => {
  beforeEach(() => {
    setEnv("TELEGRAM_BOT_TOKEN", "tok");
    setEnv("TELEGRAM_WEBHOOK_SECRET", "webhook-secret-xyz");
    setEnv("TELEGRAM_ADMIN_CHAT_IDS", "999");
    process.env.VERCEL = "1";
  });

  afterEach(async () => {
    delete process.env.VERCEL;
    await rm(TMP_STATE, { force: true });
  });

  it("/task assign → department + owner berubah + event TASK_ASSIGNED", async () => {
    const sent = stubReplyCapture();
    const res = await sendTelegram(`/task assign WR-${YEAR}-0001 engineering`);
    expect(res.status).toBe(200);
    const snapshot = await loadSnapshot();
    const task = snapshot.tasks.find((t) => t.id === `WR-${YEAR}-0001`);
    expect(task?.department).toBe("engineering");
    expect(task?.owner).toBe("engineering-agent");
    const events = await recentEvents({ limit: 200 });
    expect(events.map((e) => e.type)).toContain("TASK_ASSIGNED");
    expect(sent[0].text).toContain("di-assign");
  });

  it("/task assign dari non-admin → ditolak, task tak berubah", async () => {
    stubReplyCapture();
    await sendTelegram(`/task assign WR-${YEAR}-0001 engineering`, 42);
    const snapshot = await loadSnapshot();
    const task = snapshot.tasks.find((t) => t.id === `WR-${YEAR}-0001`);
    expect(task?.department).toBe("devops");
  });

  it("/task assign dengan departemen tidak valid → format", async () => {
    const sent = stubReplyCapture();
    await sendTelegram(`/task assign WR-${YEAR}-0001 hackerman`);
    expect(sent[0].text).toContain("Format: /task assign");
  });

  it("/task cancel → status CANCELLED", async () => {
    const sent = stubReplyCapture();
    await sendTelegram(`/task cancel WR-${YEAR}-0002`);
    const snapshot = await loadSnapshot();
    const task = snapshot.tasks.find((t) => t.id === `WR-${YEAR}-0002`);
    expect(task?.status).toBe("CANCELLED");
    expect(sent[0].text).toContain("dibatalkan");
  });

  it("/approve → decision APPROVED + cascade task pengaju", async () => {
    const sent = stubReplyCapture();
    await sendTelegram("/approve WR-DEC-0001");
    const snapshot = await loadSnapshot();
    expect(snapshot.decisions[0].status).toBe("APPROVED");
    // Cascade: task APPROVAL_REQUIRED milik finance-agent ikut APPROVED.
    const cascaded = snapshot.tasks.find((t) => t.id === `WR-${YEAR}-0003`);
    expect(cascaded?.status).toBe("APPROVED");
    expect(sent[0].text).toContain("APPROVED");
    expect(sent[0].text).toContain("Cascade");
  });

  it("/reject → decision REJECTED tanpa cascade", async () => {
    const sent = stubReplyCapture();
    await sendTelegram("/reject WR-DEC-0001");
    const snapshot = await loadSnapshot();
    expect(snapshot.decisions[0].status).toBe("REJECTED");
    const task = snapshot.tasks.find((t) => t.id === `WR-${YEAR}-0003`);
    expect(task?.status).toBe("APPROVAL_REQUIRED");
    expect(sent[0].text).toContain("REJECTED");
  });

  it("/incident acknowledge → CONTAINED, /incident resolve → RESOLVED", async () => {
    const incident = await createIncidentServer({
      title: "DDoS di edge",
      severity: "HIGH",
      source: "OFFICE",
      actor: "test",
    });
    expect(incident).not.toBeNull();

    const sentAck = stubReplyCapture();
    await sendTelegram(`/incident acknowledge ${incident!.id}`);
    expect(sentAck[0].text).toContain("CONTAINED");

    const sentResolve = stubReplyCapture();
    await sendTelegram(`/incident resolve ${incident!.id}`);
    expect(sentResolve[0].text).toContain("RESOLVED");

    const snapshot = await loadSnapshot();
    const stored = snapshot.incidents.find((i) => i.id === incident!.id);
    expect(stored?.status).toBe("RESOLVED");
  });

  it("/incident acknowledge dari non-admin → ditolak", async () => {
    const incident = await createIncidentServer({
      title: "Port scan",
      severity: "MEDIUM",
      source: "OFFICE",
      actor: "test",
    });
    stubReplyCapture();
    await sendTelegram(`/incident acknowledge ${incident!.id}`, 42);
    const snapshot = await loadSnapshot();
    const stored = snapshot.incidents.find((i) => i.id === incident!.id);
    expect(stored?.status).toBe("OPEN");
  });
});
