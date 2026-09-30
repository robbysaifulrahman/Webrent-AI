import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getStorageDriver, loadSnapshot } from "@/lib/serverStore";
import { getOfficeMode } from "@/lib/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/office/state — snapshot state kantor (read-only).
 * Membaca sumber yang sama dengan /api/state (server = source of truth).
 * Bentuk Section 16: office.mode + server_time (jam kantor bersumber server).
 */
export async function GET(req: Request) {
  try {
    const snapshot = await loadSnapshot();
    const mode = getOfficeMode();
    return jsonOk(
      {
        office: {
          status: mode.mode,
          server_time: new Date().toISOString(),
          server_epoch: Date.now(),
          timezone: "Asia/Jakarta",
          mode_reason: mode.reason,
        },
        snapshot,
        storage: { driver: getStorageDriver() },
      },
      { req },
    );
  } catch {
    return jsonError("STATE_UNAVAILABLE", "Snapshot state tidak dapat dimuat.", 503, {
      req,
    });
  }
}
