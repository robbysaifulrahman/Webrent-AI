import { jsonOk } from "@/lib/apiResponse";
import { getLlmConfig } from "@/lib/llm";
import { getStorageDriver } from "@/lib/serverStore";
import { getDbConfig, pingDb } from "@/lib/db";
import { getEventBusStatus } from "@/lib/eventBus";
import { getOfficeMode } from "@/lib/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/system/status — ringkasan status sistem (stateless).
 * Hanya mengekspos fakta non-sensitif (tanpa API key / secret).
 */
export async function GET(req: Request) {
  const llm = getLlmConfig();

  // Phase C: laporkan status database secara jujur (Section 25 —
  // jangan "operational" bila dependensi kritikal sedang tumbang).
  const dbConfigured = getDbConfig() !== null;
  const db = dbConfigured ? await pingDb() : null;
  const database = db ? (db.up ? "UP" : "DOWN") : "NOT_CONFIGURED";
  const mode = getOfficeMode();

  return jsonOk(
    {
      status: database === "DOWN" ? "degraded" : "operational",
      service: "webrent-ai-office",
      mode: mode.mode,
      mode_reason: mode.reason,
      office: { layout: "34x28" },
      llm: {
        model: llm.model,
        // Jujur: DEMO (mock) bila LLM_API_KEY belum diisi.
        configured: !llm.isMock,
      },
      storage: { driver: getStorageDriver() },
      database: {
        status: database,
        latency_ms: db?.latencyMs ?? null,
      },
      eventBus: getEventBusStatus(),
      integrations: {
        raven: "DISCONNECTED",
        telegram: "DISABLED",
      },
    },
    { req },
  );
}
