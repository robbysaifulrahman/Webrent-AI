import { jsonError, jsonOk } from "@/lib/apiResponse";
import { loadSnapshot } from "@/lib/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/integrations/raven/tasks/:id — baca task hasil tindak lanjut
 * Raven dari snapshot server (read-only, Section 8).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const snapshot = await loadSnapshot();
  const task = snapshot.tasks.find((t) => t.id === id.toUpperCase());

  if (!task) {
    return jsonError("TASK_NOT_FOUND", `Task ${id} tidak ditemukan.`, 404, { req });
  }
  return jsonOk({ task }, { req });
}
