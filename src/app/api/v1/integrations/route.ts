import { jsonOk } from "@/lib/apiResponse";
import { listIntegrations } from "@/lib/integrations";
import { getOfficeMode } from "@/lib/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/integrations — integration registry (Section 24).
 * Status Raven mengikuti heartbeat (kadaluarsa → DISCONNECTED);
 * Telegram DISABLED sampai env bot diisi.
 */
export async function GET(req: Request) {
  return jsonOk(
    {
      mode: getOfficeMode().mode,
      integrations: listIntegrations(),
    },
    { req },
  );
}
