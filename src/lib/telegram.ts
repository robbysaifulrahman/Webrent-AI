import { loadSnapshot } from "@/lib/serverStore";
import { effectiveStatus, getIntegration, listIntegrations } from "@/lib/integrations";
import { getStorageDriver } from "@/lib/serverStore";
import { pingDb } from "@/lib/db";
import { getEventBusStatus } from "@/lib/eventBus";
import { getOfficeMode } from "@/lib/mode";
import {
  assignTaskServer,
  createTaskServer,
  setDecisionStatusServer,
  updateIncidentStatusServer,
  updateTaskStatusServer,
} from "@/lib/officeOps";
import { publishEvent } from "@/lib/eventBus";
import { DEPARTMENTS } from "@/data/departments";
import { NPCS } from "@/data/npcs";
import type { DepartmentId, Incident, Task } from "@/types";
import { timingSafeEqual } from "node:crypto";

/**
 * Telegram Integration Adapter — Phase G (Section 18-22).
 *
 * - Webhook: POST /api/v1/integrations/telegram/webhook dengan secret
 *   header `X-Telegram-Bot-Api-Secret-Token` (timing-safe compare).
 * - Command engine (Section 19): perintah baca terbuka untuk chat
 *   terdaftar; perintah mutasi hanya untuk admin chat.
 * - Tanpa env → DISABLED (jujur). Bot token tak pernah ke frontend.
 */

export interface TelegramConfig {
  botToken: string;
  webhookSecret: string;
  adminChatIds: number[];
  allowedChatIds: number[];
}

export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (!botToken || !webhookSecret) return null;

  const parseIds = (raw?: string) =>
    (raw ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n !== 0);

  return {
    botToken,
    webhookSecret,
    adminChatIds: parseIds(process.env.TELEGRAM_ADMIN_CHAT_IDS),
    allowedChatIds: parseIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS),
  };
}

export function verifyTelegramWebhook(
  headers: Headers,
  config: TelegramConfig | null,
): boolean {
  if (!config) return false;
  const provided = headers.get("x-telegram-bot-api-secret-token")?.trim() ?? "";
  const a = Buffer.from(config.webhookSecret, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Daftar command untuk menu BotFather (`setMyCommands`) — dipakai
 * scripts/telegram-setup.mjs. Sinkron dengan HELP_TEXT di bawah.
 */
export interface TelegramBotCommand {
  command: string;
  description: string;
}

export const TELEGRAM_COMMANDS: TelegramBotCommand[] = [
  { command: "start", description: "Mulai bot & bantuan" },
  { command: "status", description: "Ringkasan kantor" },
  { command: "briefing", description: "Briefing harian" },
  { command: "health", description: "Health check sistem" },
  { command: "agents", description: "Daftar agent" },
  { command: "agent", description: "Detail agent: /agent <id>" },
  { command: "tasks", description: "Task aktif" },
  { command: "task", description: "Detail/mutasi task: /task <id|create|assign|cancel>" },
  { command: "incidents", description: "Insiden aktif" },
  { command: "incident", description: "Detail insiden: /incident <id|acknowledge|resolve>" },
  { command: "integrations", description: "Status integrasi & storage" },
  { command: "meetings", description: "Daftar meeting" },
  { command: "raven", description: "Status Raven: /raven status" },
  { command: "help", description: "Bantuan" },
];

/** Kirim pesan Telegram (Bot API). Tidak pernah throw — Section 58. */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<{ ok: boolean; error: string | null }> {
  const config = getTelegramConfig();
  if (!config) return { ok: false, error: "TELEGRAM_DISABLED" };
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        cache: "no-store",
      },
    );
    return { ok: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/** Notifikasi admin (Section 22) — dipakai pipeline insiden Raven. */
export async function notifyAdmins(
  text: string,
): Promise<number> {
  const config = getTelegramConfig();
  if (!config) return 0;
  let sent = 0;
  for (const chatId of config.adminChatIds) {
    const res = await sendTelegramMessage(chatId, text);
    if (res.ok) sent += 1;
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Command engine (Section 19-20) — sumber data = snapshot server.
// ---------------------------------------------------------------------------

export interface TelegramUpdate {
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { username?: string };
  };
}

function fmtList(value: string[], fallback: string): string {
  return value.length ? value.join("\n") : fallback;
}

async function buildStatusReply(): Promise<string> {
  const snapshot = await loadSnapshot();
  const openIncidents = snapshot.incidents.filter((i) => i.status !== "RESOLVED");
  const activeTasks = snapshot.tasks.filter((t) => t.status !== "COMPLETED");
  return [
    "WEBRENT AI OFFICE",
    "",
    `Office: ${getOfficeMode().mode}`,
    `Agents: ${NPCS.length} terdaftar`,
    `Tasks: ${activeTasks.length} ACTIVE (${snapshot.tasks.length} total)`,
    `Incidents: ${openIncidents.length} OPEN`,
    `Raven: ${effectiveStatus("raven")}`,
    `Realtime: ${getEventBusStatus().durable}/${getEventBusStatus().distribution}`,
  ].join("\n");
}

async function buildHealthReply(): Promise<string> {
  const db = await pingDb();
  return [
    "HEALTH CHECK",
    "",
    `API: UP`,
    `Storage: ${getStorageDriver()}`,
    `Database: ${db.up ? "UP" : (db.error === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "DOWN")}`,
    `Event bus: ${getEventBusStatus().durable}/${getEventBusStatus().distribution}`,
    `Mode: ${getOfficeMode().mode}`,
  ].join("\n");
}

const HELP_TEXT = [
  "Perintah WebRent AI Office:",
  "",
  "/status — ringkasan kantor",
  "/briefing — briefing harian",
  "/health — health check",
  "/agents — daftar agent",
  "/agent <id> — detail agent",
  "/tasks — daftar task aktif",
  "/task <id> — detail task",
  "/incidents — daftar insiden",
  "/incident <id> — detail insiden",
  "/integrations — status integrasi",
  "/meetings — daftar meeting",
  "/raven status — status Raven",
  "",
  "Admin:",
  "/task create <judul> — buat task",
  "/task assign <id> <dept> — assign task",
  "/task cancel <id> — batalkan task",
  "/incident acknowledge <id> — kontain insiden",
  "/incident resolve <id> — selesaikan insiden",
  "/approve <id> — setujui keputusan",
  "/reject <id> — tolak keputusan",
].join("\n");

const DEPARTMENT_IDS = Object.keys(DEPARTMENTS) as DepartmentId[];

function fmtTask(t: Task): string {
  return [
    `${t.id} — ${t.title}`,
    `Status: ${t.status} | Prioritas: ${t.priority}`,
    `Departemen: ${t.department} | Owner: ${t.owner}`,
    `Risiko: ${t.risk}${t.approvalRequired ? " (perlu approval)" : ""}`,
    `Sumber: ${t.source ?? "OFFICE"}`,
  ].join("\n");
}

function fmtIncident(i: Incident): string {
  return [
    `${i.id} — ${i.title}`,
    `Status: ${i.status} | Severity: ${i.severity}`,
    `Aset: ${i.asset}`,
    `Sumber: ${i.source ?? "OFFICE"}`,
    "",
    "Actions:",
    ...i.actions.map((a) => `- ${a}`),
  ].join("\n");
}

async function buildBriefingReply(): Promise<string> {
  const snapshot = await loadSnapshot();
  const openIncidents = snapshot.incidents.filter((i) => i.status !== "RESOLVED");
  const activeTasks = snapshot.tasks.filter((t) => t.status !== "COMPLETED");
  const priorities = snapshot.tasks
    .filter((t) => ["P0", "P1"].includes(t.priority) && t.status !== "COMPLETED")
    .slice(0, 5);
  const blockers = snapshot.tasks.filter((t) => t.status === "BLOCKED");
  const pendingDecisions = snapshot.decisions.filter((d) => d.status === "PENDING");
  return [
    "WEBRENT DAILY BRIEFING",
    "",
    `DATE: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "EXECUTIVE SUMMARY",
    openIncidents.length
      ? `- ${openIncidents.length} insiden aktif, perlu perhatian.`
      : "- Tidak ada insiden; operasional berjalan normal.",
    `- ${activeTasks.length} task aktif`,
    "",
    "TODAY'S PRIORITIES",
    priorities.length
      ? priorities.map((t, i) => `${i + 1}. ${t.id} ${t.title} (${t.priority})`).join("\n")
      : "- Tidak ada",
    "",
    "ACTIVE INCIDENTS",
    openIncidents.length
      ? openIncidents.map((i) => `- ${i.id} [${i.severity}] ${i.title}`).join("\n")
      : "- Tidak ada",
    "",
    "BLOCKERS",
    blockers.length
      ? blockers.map((t) => `- ${t.id} ${t.title}`).join("\n")
      : "- Tidak ada",
    "",
    "PENDING APPROVALS",
    pendingDecisions.length
      ? pendingDecisions.map((d) => `- ${d.id} ${d.title} (${d.risk})`).join("\n")
      : "- Tidak ada",
  ].join("\n");
}

/**
 * Proses satu update Telegram. Mengembalikan teks balasan (bila perlu
 * dibalas). Otorisasi: mutasi = admin saja (Section 19/41).
 */
export async function handleTelegramUpdate(
  update: TelegramUpdate,
): Promise<{ handled: boolean; chatId: number | null; reply: string | null }> {
  const config = getTelegramConfig();
  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id ?? null;

  if (!config || !text.startsWith("/") || chatId === null) {
    return { handled: false, chatId, reply: null };
  }

  const isAdmin = config.adminChatIds.includes(chatId);
  const isAllowed =
    isAdmin ||
    config.allowedChatIds.length === 0 ||
    config.allowedChatIds.includes(chatId);
  if (!isAllowed) {
    return { handled: true, chatId, reply: "Chat ini tidak terdaftar." };
  }

  const [rawCmd, ...args] = text.slice(1).split(/\s+/);
  const cmd = rawCmd.toLowerCase();
  const sub = (args[0] ?? "").toLowerCase();
  const snapshot = await loadSnapshot();

  switch (cmd) {
    case "start":
      return {
        handled: true,
        chatId,
        reply: `WebRent AI Office bot aktif.\n\n${HELP_TEXT}`,
      };
    case "help":
      return { handled: true, chatId, reply: HELP_TEXT };
    case "office":
    case "status":
      return { handled: true, chatId, reply: await buildStatusReply() };
    case "health":
      return { handled: true, chatId, reply: await buildHealthReply() };
    case "agents":
      return {
        handled: true,
        chatId,
        reply: fmtList(
          NPCS.map((n) => `• ${n.name} — ${n.role}`),
          "DATA_NOT_AVAILABLE",
        ),
      };
    case "tasks": {
      const active = snapshot.tasks
        .filter((t) => t.status !== "COMPLETED")
        .slice(0, 10)
        .map((t) => `• ${t.id} [${t.status}] ${t.title}`);
      return {
        handled: true,
        chatId,
        reply: fmtList(active, "DATA_NOT_AVAILABLE (belum ada task aktif)"),
      };
    }
    case "incidents": {
      const open = snapshot.incidents
        .filter((i) => i.status !== "RESOLVED")
        .map((i) => `• ${i.id} [${i.severity}] ${i.title}`);
      return {
        handled: true,
        chatId,
        reply: fmtList(open, "Tidak ada insiden aktif."),
      };
    }
    case "raven":
      return {
        handled: true,
        chatId,
        reply: `Raven: ${effectiveStatus("raven")}${
          getIntegration("raven")?.version ? ` (v${getIntegration("raven")?.version})` : ""
        }`,
      };
    case "briefing":
      return { handled: true, chatId, reply: await buildBriefingReply() };
    case "agent": {
      const q = (args[0] ?? "").toLowerCase();
      const npc = NPCS.find((n) => n.id === q || n.department === q);
      if (!npc) {
        return {
          handled: true,
          chatId,
          reply: `Agent "${q || "?"}" tidak ditemukan. Lihat /agents.`,
        };
      }
      const deptTasks = snapshot.tasks
        .filter(
          (t) => t.department === npc.department && t.status !== "COMPLETED",
        )
        .slice(0, 5)
        .map((t) => `• ${t.id} [${t.status}] ${t.title}`);
      return {
        handled: true,
        chatId,
        reply: [
          `${npc.name} — ${npc.role}`,
          `Departemen: ${npc.department}`,
          "",
          "Task aktif departemen ini:",
          deptTasks.length ? deptTasks.join("\n") : "- Tidak ada",
        ].join("\n"),
      };
    }
    case "integrations": {
      const db = await pingDb();
      return {
        handled: true,
        chatId,
        reply: [
          "INTEGRATIONS",
          "",
          ...listIntegrations().map((i) => `• ${i.id}: ${i.status}`),
          `• storage: ${getStorageDriver()}`,
          `• database: ${db.up ? "UP" : (db.error === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "DOWN")}`,
        ].join("\n"),
      };
    }
    case "meetings":
      return {
        handled: true,
        chatId,
        reply: "DATA_NOT_AVAILABLE (data meeting belum tersedia di snapshot kantor).",
      };
    case "task": {
      // /task <id> → detail (id bukan subcommand).
      if (sub && !["create", "assign", "cancel"].includes(sub)) {
        const t = snapshot.tasks.find((x) => x.id.toLowerCase() === sub);
        return {
          handled: true,
          chatId,
          reply: t ? fmtTask(t) : `Task ${sub} tidak ditemukan. Lihat /tasks.`,
        };
      }
      if (sub === "create") {
        if (!isAdmin) {
          return {
            handled: true,
            chatId,
            reply: "Hanya admin yang boleh membuat task.",
          };
        }
        let title = args.slice(1).join(" ").trim();
        let priority: "P0" | "P1" | "P2" | undefined;
        const flag = title.split(/\s+/)[0]?.toUpperCase();
        if (["P0", "P1", "P2"].includes(flag)) {
          priority = flag as "P0" | "P1" | "P2";
          title = title.slice(flag.length).trim();
        }
        if (!title) {
          return { handled: true, chatId, reply: "Format: /task create <judul>" };
        }
        const task = await createTaskServer({
          title,
          priority,
          source: "TELEGRAM",
          actor: `telegram:${chatId}`,
        });
        if (!task) {
          return { handled: true, chatId, reply: "Gagal membuat task (conflict)." };
        }
        await publishEvent({
          type: "TASK_CREATED",
          entity: { type: "TASK", id: task.id },
          data: { title: task.title, priority: task.priority, source: "TELEGRAM" },
        });
        return {
          handled: true,
          chatId,
          reply: `Task dibuat: ${task.id} — ${task.title} [${task.priority}]`,
        };
      }
      if (sub === "assign") {
        if (!isAdmin) {
          return {
            handled: true,
            chatId,
            reply: "Hanya admin yang boleh assign task.",
          };
        }
        const id = (args[1] ?? "").toUpperCase();
        const dept = (args[2] ?? "").toLowerCase();
        if (!id || !DEPARTMENT_IDS.includes(dept as DepartmentId)) {
          return {
            handled: true,
            chatId,
            reply: `Format: /task assign <id> <departemen>\nDepartemen: ${DEPARTMENT_IDS.join(", ")}`,
          };
        }
        const result = await assignTaskServer({
          id,
          department: dept as DepartmentId,
          source: "TELEGRAM",
          actor: `telegram:${chatId}`,
        });
        if (!result.ok) {
          return {
            handled: true,
            chatId,
            reply:
              result.reason === "NOT_FOUND"
                ? `Task ${id} tidak ditemukan. Lihat /tasks.`
                : "Gagal assign task (conflict).",
          };
        }
        await publishEvent({
          type: "TASK_ASSIGNED",
          entity: { type: "TASK", id: result.value.id },
          data: {
            department: result.value.department,
            owner: result.value.owner,
            source: "TELEGRAM",
          },
        });
        return {
          handled: true,
          chatId,
          reply: `Task di-assign: ${result.value.id} → ${dept} (${result.value.owner})`,
        };
      }
      if (sub === "cancel") {
        if (!isAdmin) {
          return {
            handled: true,
            chatId,
            reply: "Hanya admin yang boleh membatalkan task.",
          };
        }
        const id = (args[1] ?? "").toUpperCase();
        if (!id) {
          return { handled: true, chatId, reply: "Format: /task cancel <id>" };
        }
        const result = await updateTaskStatusServer({
          id,
          status: "CANCELLED",
          source: "TELEGRAM",
          actor: `telegram:${chatId}`,
        });
        if (!result.ok) {
          return {
            handled: true,
            chatId,
            reply:
              result.reason === "NOT_FOUND"
                ? `Task ${id} tidak ditemukan. Lihat /tasks.`
                : "Gagal membatalkan task (conflict).",
          };
        }
        // TASK_CANCELLED belum ada di kontrak EVENT_CHANNELS — dipublikasikan
        // dengan tipe deskriptif; channelFor jatuh ke channel webrent.events.
        await publishEvent({
          type: "TASK_CANCELLED",
          entity: { type: "TASK", id: result.value.id },
          data: { title: result.value.title, source: "TELEGRAM" },
        });
        return {
          handled: true,
          chatId,
          reply: `Task dibatalkan: ${result.value.id} — ${result.value.title}`,
        };
      }
      return {
        handled: true,
        chatId,
        reply: "Format: /task <id> | /task create <judul> | /task assign <id> <dept> | /task cancel <id>",
      };
    }
    case "incident": {
      // /incident <id> → detail (id bukan subcommand).
      if (sub && !["acknowledge", "resolve"].includes(sub)) {
        const inc = snapshot.incidents.find((x) => x.id.toLowerCase() === sub);
        return {
          handled: true,
          chatId,
          reply: inc
            ? fmtIncident(inc)
            : `Insiden ${sub} tidak ditemukan. Lihat /incidents.`,
        };
      }
      if (!isAdmin) {
        return {
          handled: true,
          chatId,
          reply: "Hanya admin yang boleh mengubah status insiden.",
        };
      }
      const incId = (args[1] ?? "").toUpperCase();
      if (!incId) {
        return {
          handled: true,
          chatId,
          reply: `Format: /incident ${sub === "resolve" ? "resolve" : "acknowledge"} <id>`,
        };
      }
      const nextStatus = sub === "resolve" ? "RESOLVED" : "CONTAINED";
      const result = await updateIncidentStatusServer({
        id: incId,
        status: nextStatus,
        source: "TELEGRAM",
        actor: `telegram:${chatId}`,
      });
      if (!result.ok) {
        return {
          handled: true,
          chatId,
          reply:
            result.reason === "NOT_FOUND"
              ? `Insiden ${incId} tidak ditemukan. Lihat /incidents.`
              : "Gagal mengubah status insiden (conflict).",
        };
      }
      await publishEvent({
        type: nextStatus === "RESOLVED" ? "INCIDENT_RESOLVED" : "INCIDENT_UPDATED",
        entity: { type: "INCIDENT", id: result.value.id },
        data: { status: nextStatus, source: "TELEGRAM" },
      });
      return {
        handled: true,
        chatId,
        reply: `Insiden ${result.value.id} → ${nextStatus}: ${result.value.title}`,
      };
    }
    case "approve":
    case "reject": {
      if (!isAdmin) {
        return {
          handled: true,
          chatId,
          reply: "Hanya admin yang boleh memutuskan approval.",
        };
      }
      const decId = (args[0] ?? "").toUpperCase();
      if (!decId) {
        return { handled: true, chatId, reply: `Format: /${cmd} <decision-id>` };
      }
      const status = cmd === "approve" ? "APPROVED" : "REJECTED";
      const result = await setDecisionStatusServer({
        id: decId,
        status,
        source: "TELEGRAM",
        actor: `telegram:${chatId}`,
      });
      if (!result.ok) {
        return {
          handled: true,
          chatId,
          reply:
            result.reason === "NOT_FOUND"
              ? `Keputusan ${decId} tidak ditemukan.`
              : "Gagal menyimpan keputusan (conflict).",
        };
      }
      // DECISION_APPROVED/REJECTED belum ada di kontrak EVENT_CHANNELS —
      // channelFor jatuh ke channel webrent.events.
      await publishEvent({
        type: cmd === "approve" ? "DECISION_APPROVED" : "DECISION_REJECTED",
        entity: { type: "OFFICE", id: result.value.decision.id },
        data: {
          title: result.value.decision.title,
          cascaded: result.value.cascadedTasks.length,
          source: "TELEGRAM",
        },
      });
      const cascadeNote = result.value.cascadedTasks.length
        ? `\nCascade: ${result.value.cascadedTasks.length} task milik pengaju → APPROVED`
        : "";
      return {
        handled: true,
        chatId,
        reply: `Keputusan ${status}: ${result.value.decision.id} — ${result.value.decision.title}${cascadeNote}`,
      };
    }
    default:
      return {
        handled: true,
        chatId,
        reply: `Perintah /${cmd} belum dikenal. Ketik /help.`,
      };
  }
}
