import { jsonOk } from "@/lib/apiResponse";
import { recentEvents } from "@/lib/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events — daftar event terbaru (urut lama→baru).
 * Sumber sinkronisasi ulang klien (Section 35/56): setelah reconnect,
 * klien mengambil event yang terlewat via ?since=<id urutan terakhir>.
 *
 * Query: ?since=<id> &type=<TIPE_EVENT> &limit=<1..200, default 50>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since");
  const sinceId = sinceRaw !== null && /^\d+$/.test(sinceRaw) ? Number(sinceRaw) : undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw !== null && /^\d+$/.test(limitRaw) ? Number(limitRaw) : undefined;

  const events = await recentEvents({
    sinceId,
    type: type || undefined,
    limit,
  });

  return jsonOk({ events, count: events.length }, { req });
}
