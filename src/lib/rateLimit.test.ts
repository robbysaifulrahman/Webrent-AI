import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rateLimit";

describe("rateLimit (fallback memori)", () => {
  it("mengizinkan sampai batas lalu menolak dengan retryAfter", async () => {
    const key = `t-${Math.random()}`;
    const opts = { key, limit: 3, windowSeconds: 60 };

    const first = await rateLimit(opts);
    const second = await rateLimit(opts);
    const third = await rateLimit(opts);
    const fourth = await rateLimit(opts);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfter).toBeGreaterThan(0);
  });

  it("memisahkan batas berdasarkan key", async () => {
    const opts = { limit: 1, windowSeconds: 60 };
    const a = await rateLimit({ ...opts, key: `a-${Math.random()}` });
    const b = await rateLimit({ ...opts, key: `b-${Math.random()}` });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});
