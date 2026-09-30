import { describe, expect, it, afterEach, vi } from "vitest";

/**
 * Mengubah env dan meng-import ulang auth.ts (modul di-cache per test
 * karena Vitest memakai module isolation).
 */
async function makeAuth(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  return import("@/lib/auth");
}

afterEach(() => {
  delete process.env.FOUNDER_PASSCODE;
  delete process.env.FOUNDER_SECRET;
  vi.resetModules();
});

function mockReq(cookie: string): Request {
  return new Request("http://localhost/", {
    headers: { cookie },
  });
}

describe("auth (single secret)", () => {
  it("makeCookieValue + verifyAuth round-trip berhasil", async () => {
    const auth = await makeAuth({
      FOUNDER_PASSCODE: "pw",
      FOUNDER_SECRET: "secret-a",
    });
    const value = auth.makeCookieValue("founder");
    const req = mockReq(`${auth.FOUNDER_COOKIE}=${value}`);
    expect(auth.verifyAuth(req)).toBe("founder");
  });

  it("cookie dengan secret salah ditolak", async () => {
    const auth = await makeAuth({
      FOUNDER_PASSCODE: "pw",
      FOUNDER_SECRET: "secret-a",
    });
    const req = mockReq(`${auth.FOUNDER_COOKIE}=founder.invalidsig`);
    expect(auth.verifyAuth(req)).toBe("guest");
  });

  it("resolvePasscode mengembalikan role yang tepat", async () => {
    const auth = await makeAuth({
      FOUNDER_PASSCODE: "fp",
      FOUNDER_SECRET: "s",
      SECURITY_PASSCODE: "sp",
    });
    expect(auth.resolvePasscode("fp")).toBe("founder");
    expect(auth.resolvePasscode("sp")).toBe("security");
    expect(auth.resolvePasscode("wrong")).toBeNull();
  });
});

describe("auth (rotasi multi-secret)", () => {
  it("cookie dibuat dengan secret lama masih valid setelah rotasi", async () => {
    // Buat cookie dengan secret-old.
    const oldAuth = await makeAuth({
      FOUNDER_PASSCODE: "pw",
      FOUNDER_SECRET: "secret-old",
    });
    const cookieValue = oldAuth.makeCookieValue("founder");

    // Rotasi: tambah secret baru di depan, lama tetap ada.
    vi.resetModules();
    process.env.FOUNDER_SECRET = "secret-new,secret-old";
    const newAuth = await import("@/lib/auth");
    const req = mockReq(`${newAuth.FOUNDER_COOKIE}=${cookieValue}`);
    expect(newAuth.verifyAuth(req)).toBe("founder");
  });

  it("cookie dibuat dengan secret lama TIDAK valid setelah secret lama dihapus", async () => {
    const oldAuth = await makeAuth({
      FOUNDER_PASSCODE: "pw",
      FOUNDER_SECRET: "secret-old",
    });
    const cookieValue = oldAuth.makeCookieValue("founder");

    // Hapus secret lama.
    vi.resetModules();
    process.env.FOUNDER_SECRET = "secret-new";
    const newAuth = await import("@/lib/auth");
    const req = mockReq(`${newAuth.FOUNDER_COOKIE}=${cookieValue}`);
    expect(newAuth.verifyAuth(req)).toBe("guest");
  });

  it("cookie baru dibuat dengan secret terdepan", async () => {
    const auth = await makeAuth({
      FOUNDER_PASSCODE: "pw",
      FOUNDER_SECRET: "secret-new,secret-old",
    });
    const value = auth.makeCookieValue("security");
    // Harus bisa diverifikasi dengan secret-new (posisi 0).
    const req = mockReq(`${auth.FOUNDER_COOKIE}=${value}`);
    expect(auth.verifyAuth(req)).toBe("security");
  });
});

describe("auth (auth nonaktif)", () => {
  it("verifyAuth mengembalikan founder bila tidak ada passcode", async () => {
    // Hapus semua passcode sebelum import
    delete process.env.FOUNDER_PASSCODE;
    delete process.env.SECURITY_PASSCODE;
    vi.resetModules();
    process.env.FOUNDER_SECRET = "s";
    const auth = await import("@/lib/auth");
    const req = mockReq("");
    expect(auth.isAuthEnabled()).toBe(false);
    expect(auth.verifyAuth(req)).toBe("founder");
  });
});
