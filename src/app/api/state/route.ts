import {
  compareAndSave,
  getStorageDriver,
  loadSnapshot,
  sanitizeSnapshot,
} from "@/lib/serverStore";
import { isAuthEnabled, verifyAuth } from "@/lib/auth";
import { applyScopedUpdate } from "@/lib/authz";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_LIMIT = Number(process.env.STATE_RATE_LIMIT ?? 60);
const WRITE_WINDOW = Number(process.env.STATE_RATE_WINDOW ?? 60);

export async function GET() {
  const snapshot = await loadSnapshot();
  return Response.json(
    { ...snapshot, driver: getStorageDriver(), authEnabled: isAuthEnabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  if (!isSameOrigin(req)) {
    return new Response("Origin tidak valid (kemungkinan CSRF).", {
      status: 403,
    });
  }

  const role = verifyAuth(req);
  if (role === "guest") {
    return new Response("Tidak diizinkan: autentikasi diperlukan.", {
      status: 401,
    });
  }

  const ip = getClientIp(req) ?? "unknown";
  const limit = await rateLimit({
    key: `state:${role}:${ip}`,
    limit: WRITE_LIMIT,
    windowSeconds: WRITE_WINDOW,
  });
  if (!limit.allowed) {
    return new Response("Terlalu banyak perubahan. Coba lagi nanti.", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Body bukan JSON valid.", { status: 400 });
  }

  const incoming = sanitizeSnapshot(body);
  if (!incoming) {
    return new Response("Payload state tidak valid.", { status: 400 });
  }

  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await loadSnapshot();

    if (incoming.version !== current.version) {
      return Response.json(
        {
          ok: false,
          conflict: true,
          driver: getStorageDriver(),
          role,
          serverVersion: current.version,
          clientVersion: incoming.version,
          snapshot: current,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { snapshot, applied, rejected } = applyScopedUpdate(current, incoming, role);

    // Compare-and-set atomik: menulis hanya jika versi belum berubah.
    const ok = await compareAndSave(current.version, snapshot);
    if (!ok) {
      // Balapan terdeteksi; ulangi dengan state terbaru.
      continue;
    }

    return Response.json(
      {
        ok: true,
        driver: getStorageDriver(),
        role,
        applied,
        rejected,
        snapshot: { ...snapshot, version: current.version + 1 },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const latest = await loadSnapshot();
  return Response.json(
    {
      ok: false,
      conflict: true,
      driver: getStorageDriver(),
      role,
      serverVersion: latest.version,
      clientVersion: incoming.version,
      snapshot: latest,
    },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}
