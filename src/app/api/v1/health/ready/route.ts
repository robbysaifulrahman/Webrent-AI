import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getStorageDriver, loadSnapshot } from "@/lib/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health/ready — readiness probe.
 * Siap melayani bila snapshot state kantor bisa dimuat dari storage aktif.
 */
export async function GET(req: Request) {
  try {
    const snapshot = await loadSnapshot();
    return jsonOk(
      { status: "ready", storage: { driver: getStorageDriver() }, version: snapshot.version },
      { req },
    );
  } catch {
    return jsonError("NOT_READY", "Snapshot state tidak dapat dimuat.", 503, {
      req,
    });
  }
}
