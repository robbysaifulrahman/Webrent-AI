import { describe, it, expect, vi, afterEach } from "vitest";
import { jsonError, jsonOk } from "./apiResponse";
import { getRequestId, newRequestId } from "./requestId";
import {
  claimIdempotent,
  getIdempotencyKey,
  getIdempotent,
} from "./idempotency";

describe("requestId", () => {
  it("membuat req_id unik berawalan req_", () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a).toMatch(/^req_[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });

  it("pakai x-request-id client bila valid, tolak bila tidak", () => {
    const valid = new Request("http://x", {
      headers: { "x-request-id": "trace-123_abcd" },
    });
    expect(getRequestId(valid)).toBe("trace-123_abcd");

    const invalid = new Request("http://x", {
      headers: { "x-request-id": "ada spasi &;naughty" },
    });
    expect(getRequestId(invalid)).toMatch(/^req_/);

    const empty = new Request("http://x");
    expect(getRequestId(empty)).toMatch(/^req_/);
  });
});

describe("apiResponse envelope", () => {
  it("jsonOk: success/data/meta.request_id + header X-Request-Id + no-store", async () => {
    const res = jsonOk({ hello: 1 }, { requestId: "req_test-1234" });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBe("req_test-1234");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      data: { hello: 1 },
      meta: { request_id: "req_test-1234" },
    });
    expect(typeof body.meta.timestamp).toBe("string");
  });

  it("jsonError: success false + error code/message + status", async () => {
    const req = new Request("http://x", {
      headers: { "x-request-id": "trace-err-01" },
    });
    const res = jsonError("NOT_READY", "rupanya rusak", 503, { req });
    expect(res.status).toBe(503);
    expect(res.headers.get("X-Request-Id")).toBe("trace-err-01");
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: "NOT_READY", message: "rupanya rusak" },
    });
  });

  it("jsonOk: request_id diambil dari header req client bila tidak diberi requestId eksplisit", async () => {
    const req = new Request("http://x", {
      headers: { "x-request-id": "trace-from-client-1" },
    });
    const res = jsonOk(null, { req });
    expect(res.headers.get("X-Request-Id")).toBe("trace-from-client-1");
    const body = await res.json();
    expect(body.meta.request_id).toBe("trace-from-client-1");
    expect(body.data).toBeNull();
  });

  it("jsonOk: status custom + header tambahan menyatu, no-store tetap ada", () => {
    const res = jsonOk({ n: 1 }, {
      status: 201,
      headers: { "X-Custom": "abc" },
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("X-Custom")).toBe("abc");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Request-Id")).toMatch(/^req_/);
  });
});

describe("idempotency (fallback in-memory, tanpa KV)", () => {
  it("header parser: normalisasi & tolak yang terlalu pendek", () => {
    const req = (v?: string) =>
      new Request("http://x", v ? { headers: { "idempotency-key": v } } : {});
    expect(getIdempotencyKey(req("abc-12345xyz"))).toBe("abc-12345xyz");
    expect(getIdempotencyKey(req("  abc 12345xyz  "))).toBe("abc12345xyz");
    expect(getIdempotencyKey(req("pendek"))).toBeNull();
    expect(getIdempotencyKey(req())).toBeNull();
  });

  it("klaim pertama berhasil, retry dengan key sama ditolak, payload terbaca", async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(await getIdempotent(key)).toBeNull();
    expect(await claimIdempotent(key, '{"n":1}')).toBe(true);
    expect(await claimIdempotent(key, '{"n":2}')).toBe(false);
    expect(await getIdempotent(key)).toBe('{"n":1}');
  });

  it("payload kadaluarsa dianggap belum dipakai", async () => {
    const key = `test-ttl-${Date.now()}-${Math.random()}`;
    expect(await claimIdempotent(key, "x", -1)).toBe(true);
    expect(await getIdempotent(key)).toBeNull();
    // claim ulang setelah kadaluarsa berhasil lagi
    expect(await claimIdempotent(key, "y", 60)).toBe(true);
  });
});

describe("idempotency (KV terkonfigurasi)", () => {
  const ENV_KEYS = ["KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;
  const savedEnv = new Map<string, string | undefined>();

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of ENV_KEYS) {
      if (savedEnv.has(k)) process.env[k] = savedEnv.get(k);
      else delete process.env[k];
    }
    savedEnv.clear();
  });

  function enableKv() {
    for (const k of ENV_KEYS) {
      savedEnv.set(k, process.env[k]);
      process.env[k] = k === "KV_REST_API_URL"
        ? "https://kv.example.test/"
        : "token-test";
    }
  }

  interface KvCall {
    command: string[];
  }

  function stubKvFetch(handler: (command: string[]) => unknown | Promise<unknown>) {
    const calls: KvCall[] = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as string[];
      calls.push({ command });
      const result = await handler(command);
      return new Response(JSON.stringify({ result }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return { calls, fetchMock };
  }

  it("claim → SET NX PX ke KV; get → GET ke KV (prefix idem:)", async () => {
    enableKv();
    const store = new Map<string, unknown>();
    const { calls } = stubKvFetch((command) => {
      const [op, key, ...rest] = command;
      if (op === "SET") {
        if (store.has(key)) return null;
        store.set(key, rest[0]);
        return "OK";
      }
      return store.get(key) ?? null;
    });

    const key = `kv-${Date.now()}-${Math.random()}`;
    expect(await claimIdempotent(key, "p1", 60)).toBe(true);
    expect(await claimIdempotent(key, "p2", 60)).toBe(false);
    expect(await getIdempotent(key)).toBe("p1");

    const setCmd = calls[0].command;
    expect(setCmd[0]).toBe("SET");
    expect(setCmd[1]).toBe(`idem:${key}`);
    expect(setCmd[2]).toBe("p1");
    expect(setCmd.slice(3)).toEqual(["NX", "PX", 60000]);
    expect(calls[calls.length - 1].command).toEqual(["GET", `idem:${key}`]);
  });

  it("KV bermasalah (fetch gagal) → fallback in-memory tetap idempotent", async () => {
    enableKv();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("kv down");
    }));

    const key = `kv-fail-${Date.now()}-${Math.random()}`;
    expect(await claimIdempotent(key, "m1", 60)).toBe(true);
    expect(await claimIdempotent(key, "m2", 60)).toBe(false);
    expect(await getIdempotent(key)).toBe("m1");
  });
});
