import {
  cookieAttributes,
  isAuthEnabled,
  makeCookieValue,
  resolvePasscode,
  verifyAuth,
  FOUNDER_COOKIE,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isSameOrigin } from "@/lib/security";
import type { AuthStatus, Role } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_LIMIT = Number(process.env.AUTH_RATE_LIMIT ?? 8);
const LOGIN_WINDOW = Number(process.env.AUTH_RATE_WINDOW ?? 300);

export async function GET(req: Request) {
  const authEnabled = isAuthEnabled();
  const role: Role = verifyAuth(req);
  const status: AuthStatus = {
    authEnabled,
    authenticated: role !== "guest" || !authEnabled,
    role: authEnabled ? role : "founder",
  };
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return new Response("Origin tidak valid.", { status: 403 });
  }

  const ip = getClientIp(req) ?? "unknown";
  const limit = await rateLimit({
    key: `login:${ip}`,
    limit: LOGIN_LIMIT,
    windowSeconds: LOGIN_WINDOW,
  });
  if (!limit.allowed) {
    return new Response("Terlalu banyak percobaan login. Coba lagi nanti.", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter) },
    });
  }

  let body: { passcode?: string };
  try {
    body = (await req.json()) as { passcode?: string };
  } catch {
    return new Response("Body bukan JSON valid.", { status: 400 });
  }

  if (!isAuthEnabled()) {
    return Response.json({
      ok: true,
      authEnabled: false,
      role: "founder" as const,
      note: "Auth belum aktif (tidak ada passcode terkonfigurasi).",
    });
  }

  // Sisa percobaan dikirim agar UI bisa menampilkannya (transparan, anti bingung).
  const limitHeaders = {
    "X-RateLimit-Limit": String(limit.limit),
    "X-RateLimit-Remaining": String(limit.remaining),
  };

  const role = resolvePasscode(body.passcode ?? "");
  if (!role) {
    return new Response("Passcode salah.", { status: 401, headers: limitHeaders });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append(
    "Set-Cookie",
    `${FOUNDER_COOKIE}=${makeCookieValue(role)}; ${cookieAttributes(req)}`,
  );
  return Response.json({ ok: true, authEnabled: true, role }, { headers });
}

export async function DELETE() {
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append(
    "Set-Cookie",
    `${FOUNDER_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`,
  );
  return Response.json({ ok: true, authenticated: false }, { headers });
}
