import { describe, expect, it } from "vitest";
import { getClientIp, isSameOrigin } from "@/lib/security";

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

function post(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { method: "POST", headers });
}

describe("getClientIp", () => {
  it("mengambil IP pertama dari x-forwarded-for", () => {
    expect(
      getClientIp(req("http://localhost/", { "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("1.2.3.4");
  });

  it("memakai x-real-ip bila x-forwarded-for tidak ada", () => {
    expect(getClientIp(req("http://localhost/", { "x-real-ip": "9.9.9.9" }))).toBe(
      "9.9.9.9",
    );
  });

  it("mengembalikan null bila tidak ada header IP", () => {
    expect(getClientIp(req("http://localhost/"))).toBeNull();
  });
});

describe("isSameOrigin (CSRF)", () => {
  it("mengizinkan origin yang sama", () => {
    expect(
      isSameOrigin(post("http://localhost:3000/api/state", { origin: "http://localhost:3000", host: "localhost:3000" })),
    ).toBe(true);
  });

  it("menolak origin berbeda", () => {
    expect(
      isSameOrigin(post("http://localhost:3000/api/state", { origin: "https://evil.example", host: "localhost:3000" })),
    ).toBe(false);
  });

  it("mengizinkan request tanpa Origin (klien non-browser)", () => {
    expect(isSameOrigin(post("http://localhost:3000/api/state"))).toBe(true);
  });

  it("memakai Referer bila Origin tidak ada", () => {
    expect(
      isSameOrigin(post("http://localhost:3000/api/state", { referer: "https://evil.example/x", host: "localhost:3000" })),
    ).toBe(false);
  });
});
