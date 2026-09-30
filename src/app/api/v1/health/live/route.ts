import { jsonOk } from "@/lib/apiResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health/live — liveness probe.
 * Selalu 200: proses hidup berarti live (tidak mengecek dependensi).
 */
export async function GET(req: Request) {
  return jsonOk({ status: "live" }, { req });
}
