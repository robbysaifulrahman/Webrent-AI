import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetIntegrations, effectiveStatus, getIntegration, recordHeartbeat } from "./integrations";
import { getRavenConfig, signRavenPayload, verifyRavenRequest } from "./raven";
import { createIncidentServer, createTaskServer } from "./officeOps";
import { loadSnapshot } from "./serverStore";
import { getOfficeMode } from "./mode";
import { clearEventBus } from "./eventBus";

const ENV_KEYS = [
  "RAVEN_SERVICE_ID",
  "RAVEN_SERVICE_SECRET",
  "RAVEN_API_URL",
  "DATABASE_URL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "OFFICE_MODE",
] as const;
const saved = new Map<string, string | undefined>();

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!saved.has(key)) saved.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
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

describe("integration registry (Section 24)", () => {
  it("default: raven DISCONNECTED, telegram DISABLED", () => {
    expect(effectiveStatus("raven")).toBe("DISCONNECTED");
    expect(getIntegration("telegram")?.status).toBe("DISABLED");
  });

  it("heartbeat → CONNECTED, kadaluarsa → DISCONNECTED (Section 55)", () => {
    recordHeartbeat("raven", "2.x");
    expect(effectiveStatus("raven")).toBe("CONNECTED");
    expect(getIntegration("raven")?.version).toBe("2.x");

    // Majukan waktu melebihi TTL 90 detik.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 91_000);
    try {
      expect(effectiveStatus("raven")).toBe("DISCONNECTED");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("raven auth (HMAC + anti-replay, Section 28)", () => {
  it("config null → RAVEN_DISABLED", () => {
    expect(getRavenConfig()).toBeNull();
    expect(
      verifyRavenRequest("{}", new Headers(), null),
    ).toMatchObject({ ok: false, code: "RAVEN_DISABLED" });
  });

  it("signature valid → OK; beda secret → UNAUTHORIZED; telat → STALE", () => {
    setEnv("RAVEN_SERVICE_SECRET", "secret-test-123");
    const config = getRavenConfig();
    const body = JSON.stringify({ event: "SECURITY_ALERT", severity: "HIGH" });
    const ts = String(Date.now());
    const sig = signRavenPayload(body, ts, "secret-test-123");

    const headers = new Headers({
      "x-webhook-timestamp": ts,
      "x-webhook-signature": sig,
    });
    expect(verifyRavenRequest(body, headers, config)).toMatchObject({ ok: true, code: "OK" });

    const wrong = new Headers({
      "x-webhook-timestamp": ts,
      "x-webhook-signature": "0".repeat(sig.length),
    });
    expect(verifyRavenRequest(body, wrong, config)).toMatchObject({ ok: false, code: "RAVEN_UNAUTHORIZED" });

    const stale = new Headers({
      "x-webhook-timestamp": String(Date.now() - 10 * 60_000),
      "x-webhook-signature": sig,
    });
    expect(verifyRavenRequest(body, stale, config)).toMatchObject({ ok: false, code: "RAVEN_STALE" });
  });
});

describe("officeOps (server-authoritative mutations, Section 2/48)", () => {
  it("createIncidentServer → masuk snapshot + audit, id unik berurut", async () => {
    const a = await createIncidentServer({
      title: "Raven: anomali trafik",
      severity: "HIGH",
      asset: "webrent-vps-01",
      source: "RAVEN",
      actor: "raven-security",
    });
    expect(a).not.toBeNull();
    expect(a!.id).toMatch(/^WR-INC-\d{4}$/);
    expect(a!.source).toBe("RAVEN");
    expect(a!.status).toBe("OPEN");

    const b = await createIncidentServer({
      title: "Insiden kedua",
      severity: "CRITICAL",
      source: "RAVEN",
      actor: "raven-security",
    });
    expect(b!.id).not.toBe(a!.id);

    const snapshot = await loadSnapshot();
    expect(snapshot.incidents.some((i) => i.id === a!.id)).toBe(true);
    expect(snapshot.audit.some((e) => e.target === a!.id && e.action === "incident.create")).toBe(true);
  });

  it("createTaskServer → status TODO, approvalRequired utk risiko tinggi", async () => {
    const task = await createTaskServer({
      title: "Isolasi server terinfeksi",
      risk: "CRITICAL",
      source: "RAVEN",
      actor: "raven-security",
    });
    expect(task).not.toBeNull();
    expect(task!.status).toBe("TODO");
    expect(task!.priority).toBe("P0");
    expect(task!.approvalRequired).toBe(true);
    expect(task!.owner).toBe("orchestrator");
  });
});

describe("office mode (Phase H, Section 51/65)", () => {
  it("default DEMO; LIVE tanpa backend bersama → DEMO (jujur)", () => {
    expect(getOfficeMode().mode).toBe("DEMO");

    setEnv("OFFICE_MODE", "LIVE");
    const info = getOfficeMode();
    expect(info.mode).toBe("DEMO");
    expect(info.requested).toBe("LIVE");
    expect(info.reason).toContain("DEMO");
  });

  it("LIVE + backend bersama (DB) → LIVE", () => {
    setEnv("OFFICE_MODE", "LIVE");
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    expect(getOfficeMode()).toMatchObject({ mode: "LIVE", sharedBackend: true });
  });
});
