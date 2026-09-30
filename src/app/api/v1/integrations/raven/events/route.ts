import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getRavenConfig, verifyRavenRequest } from "@/lib/raven";
import { recordHeartbeat } from "@/lib/integrations";
import { publishEvent } from "@/lib/eventBus";
import { createIncidentServer } from "@/lib/officeOps";
import { notifyAdmins } from "@/lib/telegram";
import { getIdempotencyKey, claimIdempotent, getIdempotent, overwriteIdempotent } from "@/lib/idempotency";
import { getRequestId } from "@/lib/requestId";
import type { RiskLevel } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SEVERITY: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

interface RavenEventBody {
  event?: string;
  severity?: string;
  source?: string;
  timestamp?: string;
  target?: { type?: string; id?: string };
  details?: { category?: string; description?: string; title?: string };
}

/**
 * POST /api/v1/integrations/raven/events — ingest event keamanan Raven
 * (Section 9). Pipeline: autentikasi → idempotency → store event →
 * buat insiden bila severity mencukupi → PUBLISH → notifikasi Telegram.
 */
export async function POST(req: Request) {
  const config = getRavenConfig();
  const rawBody = await req.text();
  const requestId = getRequestId(req);

  const auth = verifyRavenRequest(rawBody, req.headers, config);
  if (!auth.ok) {
    const status = auth.code === "RAVEN_DISABLED" ? 503 : 401;
    return jsonError(auth.code, "Event Raven ditolak.", status, { req });
  }

  let body: RavenEventBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("INVALID_JSON", "Body bukan JSON valid.", 400, { req });
  }

  const severity = (
    body.severity?.toUpperCase() ?? "MEDIUM"
  ) as RiskLevel;
  if (!VALID_SEVERITY.includes(severity)) {
    return jsonError(
      "INVALID_SEVERITY",
      `Severity harus salah satu dari: ${VALID_SEVERITY.join(", ")}.`,
      422,
      { req },
    );
  }

  // Idempotency (Section 29): event sama tidak dieksekusi dua kali.
  const idemKey = getIdempotencyKey(req);
  if (idemKey) {
    const existing = await getIdempotent(idemKey);
    if (existing) {
      return jsonOk(
        { received: true, replay: true, result: JSON.parse(existing) as unknown },
        { requestId },
      );
    }
    const claimed = await claimIdempotent(
      idemKey,
      JSON.stringify({ replayPlaceholder: true, at: Date.now() }),
    );
    if (!claimed) {
      return jsonError(
        "IDEMPOTENT_CONFLICT",
        "Idempotency-Key sedang diproses request lain.",
        409,
        { req },
      );
    }
  }

  const eventType = body.event?.toUpperCase() || "SECURITY_ALERT";
  const title = body.details?.title?.trim() || body.details?.description?.trim() || `Raven: ${body.details?.category ?? eventType}`;

  // 1. Event keamanan masuk event bus (durabel bila DB aktif).
  const eventResult = await publishEvent({
    type: eventType === "SECURITY_ALERT" ? "SECURITY_ALERT" : eventType,
    data: body,
    actor: { type: "SERVICE", id: config?.serviceId ?? "raven" },
    entity: body.target?.id
      ? { type: "OFFICE", id: body.target.id }
      : null,
    requestId,
  });

  recordHeartbeat("raven");

  // 2. Incident pipeline (Section 10) bila severity mencukupi.
  let incident = null;
  if (eventType === "SECURITY_ALERT" && (severity === "HIGH" || severity === "CRITICAL")) {
    incident = await createIncidentServer({
      title,
      severity,
      asset: body.target?.id ?? "webrent.my.id",
      source: "RAVEN",
      actor: config?.serviceId ?? "raven",
      requestId,
    });

    if (incident) {
      await publishEvent({
        type: "INCIDENT_CREATED",
        entity: { type: "INCIDENT", id: incident.id },
        data: {
          incident_id: incident.id,
          severity: incident.severity,
          asset: incident.asset,
          triggered_by: "raven",
          request_id: requestId,
        },
        actor: { type: "SERVICE", id: config?.serviceId ?? "raven" },
        requestId,
        causationId: eventResult.event.id,
      });

      // 3. Notifikasi Telegram bila severity threshold terpenuhi (Section 22).
      const notified = await notifyAdmins(
        [
          "🚨 SECURITY INCIDENT",
          "",
          `Severity: ${incident.severity}`,
          "Source: Raven",
          `Asset: ${incident.asset}`,
          `Incident: ${incident.id}`,
          `Status: ${incident.status}`,
          "",
          "Timestamp:",
          new Date(incident.detectedAt).toISOString(),
        ].join("\n"),
      );

      if (idemKey) {
        await overwriteIdempotent(
          idemKey,
          JSON.stringify({
            event_id: eventResult.event.id,
            incident_id: incident.id,
            notified,
          }),
        );
      }

      return jsonOk(
        {
          received: true,
          event_id: eventResult.event.id,
          persisted: eventResult.persisted,
          incident: {
            id: incident.id,
            severity: incident.severity,
            asset: incident.asset,
            status: incident.status,
          },
          notified_telegram: notified,
        },
        { req },
      );
    }
  }

  if (idemKey) {
    await overwriteIdempotent(
      idemKey,
      JSON.stringify({ event_id: eventResult.event.id, incident_id: null }),
    );
  }

  return jsonOk(
    {
      received: true,
      event_id: eventResult.event.id,
      persisted: eventResult.persisted,
      incident: null,
    },
    { req },
  );
}
