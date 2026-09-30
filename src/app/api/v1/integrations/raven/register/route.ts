import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getRavenConfig, verifyRavenRequest } from "@/lib/raven";
import { registerIntegration } from "@/lib/integrations";
import { publishEvent } from "@/lib/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/integrations/raven/register — registrasi service Raven
 * (Section 8). Body: { service, version, environment, hostname,
 * capabilities }. HMAC + anti-replay (Section 28).
 */
export async function POST(req: Request) {
  const config = getRavenConfig();
  const rawBody = await req.text();

  const auth = verifyRavenRequest(rawBody, req.headers, config);
  if (!auth.ok) {
    const status = auth.code === "RAVEN_DISABLED" ? 503 : 401;
    return jsonError(auth.code, "Registrasi Raven ditolak.", status, { req });
  }

  let body: {
    service?: string;
    version?: string;
    environment?: string;
    hostname?: string;
    capabilities?: string[];
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("INVALID_JSON", "Body bukan JSON valid.", 400, { req });
  }

  const entry = registerIntegration({
    id: "raven",
    version: body.version ?? undefined,
    capabilities: body.capabilities ?? [],
  });

  await publishEvent({
    type: "INTEGRATION_CONNECTED",
    entity: { type: "INTEGRATION", id: "raven" },
    data: { version: body.version, environment: body.environment, hostname: body.hostname },
    actor: { type: "SERVICE", id: config?.serviceId ?? "raven" },
    requestId: req.headers.get("x-request-id"),
  });

  return jsonOk(
    {
      registered: true,
      integration: entry
        ? { id: entry.id, status: entry.status, version: entry.version }
        : null,
    },
    { req },
  );
}
