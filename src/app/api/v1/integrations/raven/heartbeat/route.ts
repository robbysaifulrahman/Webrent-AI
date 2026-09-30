import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getRavenConfig, verifyRavenRequest } from "@/lib/raven";
import { recordHeartbeat } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/integrations/raven/heartbeat — Raven heartbeat (Section 8).
 * Heartbeat berhenti → status efektif DISCONNECTED (Section 55).
 */
export async function POST(req: Request) {
  const config = getRavenConfig();
  const rawBody = await req.text();

  const auth = verifyRavenRequest(rawBody, req.headers, config);
  if (!auth.ok) {
    const status = auth.code === "RAVEN_DISABLED" ? 503 : 401;
    return jsonError(auth.code, "Heartbeat Raven ditolak.", status, { req });
  }

  let body: { status?: string; version?: string; uptime?: number };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("INVALID_JSON", "Body bukan JSON valid.", 400, { req });
  }

  recordHeartbeat("raven", body.version);

  return jsonOk(
    { received: true, status: "CONNECTED", at: new Date().toISOString() },
    { req },
  );
}
