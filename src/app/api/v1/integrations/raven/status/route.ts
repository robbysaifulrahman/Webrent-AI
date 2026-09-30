import { jsonError, jsonOk } from "@/lib/apiResponse";
import { effectiveStatus, getIntegration } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/integrations/raven/status — status Raven (Section 8/24).
 * Heartbeat kadaluarsa → DISCONNECTED (Section 55).
 */
export async function GET(req: Request) {
  const entry = getIntegration("raven");
  if (!entry) {
    return jsonError("INTEGRATION_UNAVAILABLE", "Registry Raven tidak ada.", 404, { req });
  }
  return jsonOk(
    {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      status: effectiveStatus("raven"),
      last_heartbeat:
        entry.lastHeartbeat === null
          ? null
          : new Date(entry.lastHeartbeat).toISOString(),
      version: entry.version,
      capabilities: entry.capabilities,
    },
    { req },
  );
}
