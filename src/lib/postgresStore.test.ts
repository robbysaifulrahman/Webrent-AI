import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedSnapshot } from "./officeData";

// Mock modul pg — Pool dipakai via singleton di db.ts.
const poolQuery = vi.hoisted(() => vi.fn());
vi.mock("pg", () => ({
  Pool: class {
    query = poolQuery;
    on = vi.fn();
    end = vi.fn(async () => undefined);
  },
}));

import { closePool, getDbConfig, pingDb } from "./db";
import { getStorageDriver, loadSnapshot, saveSnapshot, compareAndSave } from "./serverStore";

const ENV_KEYS = [
  "DATABASE_URL",
  "STORAGE_DRIVER",
  "PGSSL",
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
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(async () => {
  await closePool();
  for (const [k, v] of saved) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  saved.clear();
});

describe("getDbConfig (Phase C)", () => {
  it("null bila DATABASE_URL kosong", () => {
    expect(getDbConfig()).toBeNull();
  });

  it("trim + ssl aktif untuk host remote", () => {
    setEnv("DATABASE_URL", "  postgres://u:p@db.example.test:5432/webrent  ");
    expect(getDbConfig()).toEqual({
      connectionString: "postgres://u:p@db.example.test:5432/webrent",
      ssl: true,
    });
  });

  it("ssl nonaktif untuk localhost / PGSSL=disable", () => {
    setEnv("DATABASE_URL", "postgres://u:p@localhost:5432/webrent");
    expect(getDbConfig()?.ssl).toBe(false);

    setEnv("DATABASE_URL", "postgres://u:p@db.example.test:5432/webrent");
    setEnv("PGSSL", "disable");
    expect(getDbConfig()?.ssl).toBe(false);
  });
});

describe("getStorageDriver precedence", () => {
  it("default → file", () => {
    expect(getStorageDriver()).toBe("file");
  });

  it("DATABASE_URL saja → postgres", () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    expect(getStorageDriver()).toBe("postgres");
  });

  it("KV menang bila keduanya terisi", () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    setEnv("KV_REST_API_URL", "https://kv.example.test");
    setEnv("KV_REST_API_TOKEN", "tok");
    expect(getStorageDriver()).toBe("kv");
  });

  it("STORAGE_DRIVER memaksa pilihan; fallback bila config hilang", () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    setEnv("KV_REST_API_URL", "https://kv.example.test");
    setEnv("KV_REST_API_TOKEN", "tok");
    setEnv("STORAGE_DRIVER", "postgres");
    expect(getStorageDriver()).toBe("postgres");

    setEnv("STORAGE_DRIVER", "file");
    expect(getStorageDriver()).toBe("file");

    // Override tidak valid tanpa config → jatuh ke precedence normal.
    delete process.env.DATABASE_URL;
    setEnv("STORAGE_DRIVER", "postgres");
    expect(getStorageDriver()).toBe("kv");
  });
});

describe("postgres snapshot driver (mock pg)", () => {
  it("pingDb: NOT_CONFIGURED / UP / DOWN", async () => {
    expect(await pingDb()).toEqual({ up: false, latencyMs: null, error: "NOT_CONFIGURED" });

    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    poolQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 });
    const up = await pingDb();
    expect(up.up).toBe(true);
    expect(up.latencyMs).toBeTypeOf("number");

    poolQuery.mockRejectedValueOnce(new Error("connection refused"));
    const down = await pingDb();
    expect(down.up).toBe(false);
    expect(down.error).toContain("connection refused");
  });

  it("saveSnapshot: INSERT ... ON CONFLICT ke office_state", async () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    poolQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const snapshot = seedSnapshot();
    expect(await saveSnapshot(snapshot)).toBe(true);

    const [sql, params] = poolQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO office_state");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
    expect(params[0]).toBe(snapshot.version);
    expect(JSON.parse(params[1] as string).tasks).toEqual(snapshot.tasks);
  });

  it("saveSnapshot: DB error → false tanpa crash (failure isolation)", async () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    poolQuery.mockRejectedValue(new Error("down"));
    expect(await saveSnapshot(seedSnapshot())).toBe(false);
  });

  it("loadSnapshot: baca payload JSONB + fallback seed bila kosong/error", async () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    // seedSnapshot() memakai Date.now() — bekukan agar deterministik.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    try {
      const snapshot = seedSnapshot();

      poolQuery.mockResolvedValueOnce({
        rows: [{ payload: JSON.stringify(snapshot) }],
        rowCount: 1,
      });
      expect(await loadSnapshot()).toEqual(snapshot);

      poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      expect(await loadSnapshot()).toEqual(seedSnapshot());

      poolQuery.mockRejectedValueOnce(new Error("down"));
      expect(await loadSnapshot()).toEqual(seedSnapshot());
    } finally {
      vi.useRealTimers();
    }
  });

  it("compareAndSave: rowCount 1 → true, rowCount 0 → false (CAS)", async () => {
    setEnv("DATABASE_URL", "postgres://u:p@db.example.test/webrent");
    const snapshot = seedSnapshot();

    poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    expect(await compareAndSave(7, snapshot)).toBe(true);
    const [sql, params] = poolQuery.mock.calls[0];
    expect(sql).toContain("WHERE office_state.version = $1");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
    expect(params[0]).toBe(7);
    expect(params[1]).toBe(8);

    poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await compareAndSave(7, snapshot)).toBe(false);

    poolQuery.mockRejectedValueOnce(new Error("down"));
    expect(await compareAndSave(7, snapshot)).toBe(false);
  });
});
