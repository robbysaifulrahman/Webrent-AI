import { jsonOk } from "@/lib/apiResponse";
import { getStorageDriver } from "@/lib/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health — health check gabungan (stateless, tanpa auth).
 * Bukan liveness/readiness granular; itu di health/live & health/ready.
 */
export async function GET(req: Request) {
  return jsonOk(
    {
      status: "ok",
      service: "webrent-ai-office",
      storage: { driver: getStorageDriver() },
    },
    { req },
  );
}
