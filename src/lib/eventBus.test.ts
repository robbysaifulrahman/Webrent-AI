import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedSnapshot } from "./officeData";

// Mock pg (durabilitas Postgres) — pola sama dengan postgresStore.test.ts.
const poolQuery = vi.hoisted(() => vi.fn());
vi.mock("pg", () => ({
  Pool: class {
    query = poolQuery;
    on = vi.fn();
    end = vi.fn(async () => undefined);
  },
}));

import {
  channelFor,
  clearEventBus,
  getEventBusStatus,
  newEventId,
  publishEvent,
  recentEvents,
} from "./eventBus";
import { EVENT_CHANNELS } from "./eventBus";

const ENV_KEYS = [
  "DATABASE_URL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;
const saved = new Map<string, string | undefined>();

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!saved.has(key)) saved.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  poolQuery.mockReset();
  clearEventBus();
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(async () => {
  for (const [k, v] of saved) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  saved.clear();
});

describe("event contract (Section 13)", () => {
  it("event id unik berawalan evt_", () => {
    const a = newEventId();
    const b = newEventId();
    expect(a).toMatch(/^evt_[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });

  it("pemetaan channel sesuai Section 12", () => {
    expect(channelFor("AGENT_MOVED")).toBe("webrent.agents");
    expect(channelFor("TASK_CREATED")).toBe("webrent.tasks");
    expect(channelFor("INCIDENT_CREATED")).toBe("webrent.incidents");
    expect(channelFor("INTEGRATION_CONNECTED")).toBe("webrent.integrations");
    expect(channelFor("SECURITY_ALERT")).toBe("webrent.events");
    expect(channelFor("MEETING_STARTED")).toBe("webrent.office");
    expect(channelFor("TIPE_BARU_MASA_DEPAN")).toBe("webrent.events");
  });

  it("event immutable: freeze + clone, mutasi setelah publish tak berefek", async () => {
    const data = { n: 1, tags: ["a"] };
    const { event } = await publishEvent({ type: "TASK_CREATED", data });

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.data)).toBe(true);

    // Caller mengubah objek aslinya setelah publish → event yang tersimpan tetap.
    data.n = 99;
    data.tags.push("b");
    const stored = (await recentEvents())[0];
    expect(stored.data).toEqual({ n: 1, tags: ["a"] });
    expect(stored.data).not.toBe(data);
  });
});

describe("publish (fallback in-memory, tanpa DB/Redis)", () => {
  it("persisted=false (memory), event terbaca via recentEvents", async () => {
    const result = await publishEvent({
      type: "INCIDENT_CREATED",
      entity: { type: "INCIDENT", id: "inc_001" },
      data: { severity: "HIGH" },
      requestId: "req_test-1",
    });

    expect(result.persisted).toBe(false);
    expect(result.distributed).toBe(false);
    expect(result.duplicate).toBe(false);
    expect(result.event.id).toMatch(/^evt_/);
    expect(result.event.request_id).toBe("req_test-1");
    // correlation_id default = request_id (Section 32).
    expect(result.event.correlation_id).toBe("req_test-1");

    const events = await recentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("INCIDENT_CREATED");
    expect(events[0].entity).toEqual({ type: "INCIDENT", id: "inc_001" });
  });

  it("event id sama diproses sekali (dedup Section 48)", async () => {
    const eventId = newEventId();
    const first = await publishEvent({ type: "TASK_CREATED", eventId, data: { n: 1 } });
    const second = await publishEvent({ type: "TASK_CREATED", eventId, data: { n: 2 } });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    const events = await recentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ n: 1 });
  });

  it("filter type + limit + urutan lama→baru", async () => {
    for (let i = 0; i < 5; i++) {
      await publishEvent({ type: "TASK_PROGRESS", data: { i } });
    }
    await publishEvent({ type: "SECURITY_ALERT", data: { s: 1 } });
    await publishEvent({ type: "TASK_PROGRESS", data: { i: 5 } });

    const all = await recentEvents({ type: "TASK_PROGRESS" });
    expect(all).toHaveLength(6);
    expect(all[0].data).toEqual({ i: 0 });
    expect(all[all.length - 1].data).toEqual({ i: 5 });

    const limited = await recentEvents({ limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited[0].data).toEqual({ s: 1 });
  });

  it("ring dibatasi kapasitas (500), event terlama dibuang", async () => {
    for (let i = 0; i < 505; i++) {
      await publishEvent({ type: "TASK_PROGRESS", data: { i } });
    }
    const events = await recentEvents({ limit: 200 });
    expect(events).toHaveLength(200);
    // 5 event terlama terbuang: ring mulai dari i=5... tapi limit 200
    // hanya menampilkan 200 terakhir → mulai dari i=305.
    expect(events[0].data).toEqual({ i: 305 });
    expect(events[events.length - 1].data).toEqual({ i: 504 });
  });

  it("event bus status: memory / none", () => {
    expect(getEventBusStatus()).toEqual({
      durable: "memory",
      distribution: "none",
    });
  });
});

describe("publish (Postgres durabel + Redis distribusi, mock)", () => {
  it("INSERT INTO system_events dengan ON CONFLICT DO NOTHING", async () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    poolQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await publishEvent({
      type: "SECURITY_ALERT",
      entity: { type: "OFFICE", id: "webrent-vps-01" },
      data: { severity: "HIGH" },
      requestId: "req_test-2",
    });

    expect(result.persisted).toBe(true);
    const [sql, params] = poolQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO system_events");
    expect(sql).toContain("ON CONFLICT (event_id) DO NOTHING");
    expect(params[0]).toBe(result.event.id);
    expect(params[1]).toBe("SECURITY_ALERT");
    expect(JSON.parse(params[8] as string)).toEqual({ severity: "HIGH" });
    expect(params[11]).toBe("req_test-2");
  });

  it("konflik event_id tercatat sebagai duplicate", async () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    poolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await publishEvent({ type: "TASK_CREATED" });
    expect(result.persisted).toBe(true);
    expect(result.duplicate).toBe(true);
  });

  it("DB down → publish tetap sukses, persisted=false (failure isolation)", async () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    poolQuery.mockRejectedValue(new Error("db down"));

    const result = await publishEvent({ type: "TASK_CREATED", data: { n: 1 } });
    expect(result.event.id).toMatch(/^evt_/);
    expect(result.persisted).toBe(false);
    // Event tetap terbaca dari ring fallback.
    expect((await recentEvents()).length).toBe(1);
  });

  it("KV terisi → PUBLISH ke channel yang tepat", async () => {
    setEnv("KV_REST_API_URL", "https://kv.example.test");
    setEnv("KV_REST_API_TOKEN", "tok");
    const calls: Array<{ cmd: string[] }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        calls.push({ cmd: JSON.parse(String(init?.body)) as string[] });
        return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      }),
    );

    const result = await publishEvent({ type: "AGENT_MOVED", data: {} });

    expect(result.distributed).toBe(true);
    expect(calls[0].cmd[0]).toBe("PUBLISH");
    expect(calls[0].cmd[1]).toBe(EVENT_CHANNELS.AGENT_MOVED);
    const published = JSON.parse(calls[0].cmd[2] as string);
    expect(published.id).toBe(result.event.id);
    vi.unstubAllGlobals();
  });

  it("recentEvents dari Postgres memetakan baris ke OfficeEvent", async () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    poolQuery.mockResolvedValue({
      rows: [
        {
          event_id: "evt_aaaa",
          type: "TASK_CREATED",
          version: 1,
          source: "webrent-api",
          actor_type: "SYSTEM",
          actor_id: "api-gateway",
          entity_type: "TASK",
          entity_id: "task_x",
          data: { n: 1 },
          correlation_id: "corr_1",
          causation_id: null,
          request_id: "req_1",
          created_at: "2026-09-29T12:00:00Z",
        },
      ],
      rowCount: 1,
    });

    const events = await recentEvents({ sinceId: 10, type: "TASK_CREATED" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "evt_aaaa",
      type: "TASK_CREATED",
      request_id: "req_1",
      entity: { type: "TASK", id: "task_x" },
    });
    const [sql] = poolQuery.mock.calls[0];
    expect(sql).toContain("ORDER BY id ASC");
  });

  it("seed snapshot aman dipakai sebagai payload event", () => {
    const seed = seedSnapshot();
    expect(seed.tasks.length).toBeGreaterThan(0);
  });
});
