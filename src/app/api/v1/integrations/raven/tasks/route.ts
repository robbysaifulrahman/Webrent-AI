import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getRavenConfig, verifyRavenRequest } from "@/lib/raven";
import { createTaskServer } from "@/lib/officeOps";
import { publishEvent } from "@/lib/eventBus";
import type { Priority, RiskLevel } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/integrations/raven/tasks — Raven membuat task tindak lanjut
 * (Section 8). Contoh: DevOps menerima TASK_CREATED dari insiden.
 */
export async function POST(req: Request) {
  const config = getRavenConfig();
  const rawBody = await req.text();

  const auth = verifyRavenRequest(rawBody, req.headers, config);
  if (!auth.ok) {
    const status = auth.code === "RAVEN_DISABLED" ? 503 : 401;
    return jsonError(auth.code, "Task Raven ditolak.", status, { req });
  }

  let body: { title?: string; severity?: string; priority?: string; department?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("INVALID_JSON", "Body bukan JSON valid.", 400, { req });
  }

  const title = body.title?.trim() ?? "";
  if (!title) {
    return jsonError("INVALID_TITLE", "Field `title` wajib diisi.", 422, { req });
  }

  const risk = (
    ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(body.severity ?? "")
      ? body.severity
      : "MEDIUM"
  ) as RiskLevel;
  const priority = (
    ["P0", "P1", "P2", "P3"].includes(body.priority ?? "") ? body.priority : undefined
  ) as Priority | undefined;

  const task = await createTaskServer({
    title,
    risk,
    priority,
    source: "RAVEN",
    actor: config?.serviceId ?? "raven",
  });

  if (!task) {
    return jsonError("CONFLICT", "Task gagal dibuat (state conflict).", 409, { req });
  }

  await publishEvent({
    type: "TASK_CREATED",
    entity: { type: "TASK", id: task.id },
    data: { title: task.title, priority: task.priority, source: "RAVEN" },
    actor: { type: "SERVICE", id: config?.serviceId ?? "raven" },
  });

  return jsonOk(
    {
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        risk: task.risk,
        source: task.source,
      },
    },
    { req, status: 201 },
  );
}
