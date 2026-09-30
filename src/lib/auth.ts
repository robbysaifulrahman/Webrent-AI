import { createHmac, timingSafeEqual } from "node:crypto";
import type { DepartmentId, Role } from "@/types";

export const FOUNDER_COOKIE = "wr_founder";

export const DEPT_ROLES: DepartmentId[] = [
  "executive",
  "operations",
  "product",
  "engineering",
  "devops",
  "security",
  "sales",
  "marketing",
  "support",
  "finance",
  "analytics",
  "ux",
  "documentation",
];

const ALL_ROLES: Role[] = ["founder", ...DEPT_ROLES];

/**
 * Mendukung rotasi secret: FOUNDER_SECRET dapat berisi beberapa secret
 * dipisahkan koma — "new-secret,old-secret".
 * Secret pertama digunakan untuk membuat cookie baru (current).
 * Semua secret dicoba saat verifikasi (backward compatible).
 */
function secrets(): string[] {
  const raw =
    process.env.FOUNDER_SECRET?.trim() ||
    process.env.APP_SECRET?.trim() ||
    "webrent-dev-secret";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function currentSecret(): string {
  return secrets()[0];
}

/** Passcode untuk sebuah role dari environment. */
function rolePasscode(role: Role): string {
  if (role === "founder") return process.env.FOUNDER_PASSCODE?.trim() || "";
  if (role === "guest") return "";
  const key = `${role.toUpperCase()}_PASSCODE`;
  return process.env[key]?.trim() || "";
}

export function configuredRoles(): Role[] {
  return ALL_ROLES.filter((role) => rolePasscode(role).length > 0);
}

/** Auth aktif bila minimal satu passcode (founder/departemen) diisi. */
export function isAuthEnabled(): boolean {
  return configuredRoles().length > 0;
}

function signWithSecret(role: Role, s: string): string {
  return createHmac("sha256", s).update(role).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Membuat nilai cookie menggunakan secret terbaru (posisi 0). */
export function makeCookieValue(role: Role): string {
  return `${role}.${signWithSecret(role, currentSecret())}`;
}

function parseCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === FOUNDER_COOKIE) return rest.join("=");
  }
  return null;
}

function isRole(value: string): value is Role {
  return value === "founder" || (DEPT_ROLES as string[]).includes(value);
}

/**
 * Memverifikasi signature cookie terhadap semua secret yang terkonfigurasi.
 * Secret lama tetap diterima sampai dihapus — rotasi tanpa logout paksa.
 */
function verifySignature(role: Role, sig: string): boolean {
  for (const s of secrets()) {
    if (safeEqual(sig, signWithSecret(role, s))) return true;
  }
  return false;
}

/** Mengembalikan role dari cookie, atau "guest" bila tidak valid. */
export function verifyAuth(req: Request): Role {
  if (!isAuthEnabled()) return "founder";
  const value = parseCookieHeader(req.headers.get("cookie"));
  if (!value) return "guest";
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return "guest";
  const role = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  if (!isRole(role) || !sig) return "guest";
  return verifySignature(role, sig) ? role : "guest";
}

/** Memeriksa passcode terhadap semua role yang terkonfigurasi. */
export function resolvePasscode(input: string): Role | null {
  if (!isAuthEnabled()) return "founder";
  const candidate = input.trim();
  if (!candidate) return null;
  for (const role of configuredRoles()) {
    if (safeEqual(candidate, rolePasscode(role))) return role;
  }
  return null;
}

export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function cookieAttributes(req: Request): string {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  return `HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${secure}`;
}
