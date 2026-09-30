import { describe, expect, it } from "vitest";
import { buildCspValue, generateNonce } from "@/lib/csp";

describe("generateNonce", () => {
  it("menghasilkan string base64url non-kosong", () => {
    const n = generateNonce();
    expect(n).toBeTruthy();
    expect(/^[A-Za-z0-9_-]+$/.test(n)).toBe(true);
  });

  it("setiap pemanggilan menghasilkan nilai berbeda", () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });

  it("panjang minimal 20 karakter", () => {
    expect(generateNonce().length).toBeGreaterThanOrEqual(20);
  });
});

describe("buildCspValue", () => {
  it("menyertakan nonce pada script-src", () => {
    const nonce = generateNonce();
    const csp = buildCspValue(nonce, false);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("menyertakan unsafe-eval hanya di dev mode", () => {
    const nonce = generateNonce();
    expect(buildCspValue(nonce, true)).toContain("'unsafe-eval'");
    expect(buildCspValue(nonce, false)).not.toContain("'unsafe-eval'");
  });

  it("melarang frame-ancestors dan object-src", () => {
    const csp = buildCspValue(generateNonce(), false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("mengandung upgrade-insecure-requests", () => {
    const csp = buildCspValue(generateNonce(), false);
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("format directive: key val1 val2; key val1", () => {
    const csp = buildCspValue("abc", false);
    for (const part of csp.split(";").map((s) => s.trim())) {
      expect(part.length).toBeGreaterThan(0);
    }
  });
});
