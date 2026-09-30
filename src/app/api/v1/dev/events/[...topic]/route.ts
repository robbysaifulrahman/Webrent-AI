import { jsonError, jsonOk } from "@/lib/apiResponse";
import {
  claimIdempotent,
  getIdempotencyKey,
  getIdempotent,
  overwriteIdempotent,
} from "@/lib/idempotency";
import { getRequestId } from "@/lib/requestId";
import { publishEvent } from "@/lib/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev/staging saja: Vercel production menutup endpoint ini (404). */
function devEventsEnabled(): boolean {
  if (process.env.DEV_EVENTS_ENABLED === "1") return true;
  if (process.env.DEV_EVENTS_ENABLED === "0") return false;
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  return env !== "production";
}

/**
 * POST /api/v1/dev/events/* — event sink dev/staging (Section 52).
 * Topik dipetakan ke tipe event kanonik (security-alert → SECURITY_ALERT),
 * lalu dipublikasikan ke event bus (durabel Postgres + PUBLISH Redis).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ topic: string[] }> },
) {
  if (!devEventsEnabled()) {
    return jsonError("NOT_FOUND", "Endpoint tidak tersedia.", 404, { req });
  }

  const requestId = getRequestId(req);

  const { topic } = await ctx.params;
  const eventType = topic.join("/").toUpperCase().replace(/[^A-Z0-9]+/g, "_");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("INVALID_JSON", "Body bukan JSON valid.", 400, { req });
  }

  const idemKey = getIdempotencyKey(req);
  const payload = JSON.stringify({ type: eventType, body });

  if (idemKey) {
    const existing = await getIdempotent(idemKey);
    if (existing) {
      // Dua bentuk payload: hasil overwrite { event, ... } (PublishResult)
      // atau klaim awal { type, body } (echo) bila proses belum selesai.
      const prior = JSON.parse(existing) as Record<string, unknown>;
      const replayedEvent =
        prior && typeof prior === "object" && "event" in prior
          ? prior.event
          : prior;
      return jsonOk(
        { received: true, replay: true, event: replayedEvent },
        { requestId },
      );
    }
    const claimed = await claimIdempotent(idemKey, payload);
    if (!claimed) {
      return jsonError(
        "IDEMPOTENT_CONFLICT",
        "Idempotency-Key sedang diproses request lain.",
        409,
        { req },
      );
    }
  }

  const result = await publishEvent({
    type: eventType,
    data: body,
    requestId,
    source: "dev-events",
  });

  // Simpan hasil publish agar replay (retry dengan key sama) mengembalikan
  // event bus lengkap, bukan sekadar echo body.
  if (idemKey) {
    await overwriteIdempotent(idemKey, JSON.stringify(result));
  }

  return jsonOk(
    {
      received: true,
      event: result.event,
      persisted: result.persisted,
      distributed: result.distributed,
      duplicate: result.duplicate,
    },
    { requestId },
  );
}
