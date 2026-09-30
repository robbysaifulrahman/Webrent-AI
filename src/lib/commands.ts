"use client";

import { DEPARTMENTS } from "@/data/departments";
import { NPC_MAP } from "@/data/npcs";
import { AGENT_REGISTRY } from "@/data/agents";
import { snapshotOf, useOfficeStore } from "@/hooks/useOfficeStore";
import { useNpcStore } from "@/hooks/useNpcStore";
import type {
  CommandResult,
  DepartmentId,
  NpcDefinition,
  Priority,
  RiskLevel,
  Role,
  Task,
  TaskStatus,
} from "@/types";
import { buildObsidianExport } from "@/lib/obsidian";

export const COMMAND_LIST = [
  "/office",
  "/briefing",
  "/status",
  "/tasks",
  "/tasks today",
  "/tasks create <judul>",
  "/tasks assign <id> <departemen>",
  "/tasks review <id> <status>",
  "/agents",
  "/agents status",
  "/incident <deskripsi>",
  "/incidents",
  "/security",
  "/security status",
  "/infrastructure",
  "/product",
  "/sales",
  "/marketing",
  "/finance",
  "/support",
  "/kpi",
  "/report daily|weekly|monthly",
  "/roadmap",
  "/approve <DEC-id>",
  "/decisions",
  "/audit [n]",
  "/search <kata>",
  "/export [daily|weekly|monthly]",
  "/help",
] as const;

const MUTATING_COMMANDS = new Set([
  "/tasks",
  "/incident",
  "/approve",
]);

export function commandName(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed.startsWith("/")) return null;
  return `/${trimmed.slice(1).split(/\s+/)[0].toLowerCase()}`;
}

export function isMutatingCommand(query: string): boolean {
  const name = commandName(query);
  return name !== null && MUTATING_COMMANDS.has(name);
}

/**
 * Menentukan apakah role berhak menjalankan perintah.
 * - founder: semua perintah.
 * - guest: hanya perintah baca.
 * - role departemen: perintah baca + mutasi yang relevan dengan departemennya.
 */
export function canRunCommand(
  query: string,
  role: Role,
): { allowed: boolean; reason?: string } {
  const name = commandName(query);
  if (!name) return { allowed: true };
  if (role === "founder") return { allowed: true };
  if (!MUTATING_COMMANDS.has(name)) return { allowed: true };

  if (role === "guest") {
    return {
      allowed: false,
      reason: "Hanya Founder atau departemen terkait yang boleh mengubah state.",
    };
  }

  if (name === "/tasks") {
    const args = query.trim().slice(1).split(/\s+/).slice(1);
    const sub = (args[0] ?? "").toLowerCase();
    if (sub === "create") {
      const title = args.slice(1).join(" ");
      const dept = deptForQuery(title);
      if (!dept) {
        return {
          allowed: false,
          reason: `Judul tidak menyebut departemenmu (${DEPARTMENTS[role]}). Sertakan kata kunci departemen.`,
        };
      }
      if (dept !== role) {
        return {
          allowed: false,
          reason: `Task itu milik ${DEPARTMENTS[dept]}, bukan ${DEPARTMENTS[role]}.`,
        };
      }
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Hanya Founder yang boleh assign/review task.",
    };
  }

  if (name === "/incident") {
    return role === "security" || role === "operations"
      ? { allowed: true }
      : { allowed: false, reason: "Hanya Security/Operations yang boleh membuat insiden." };
  }

  if (name === "/approve") {
    return {
      allowed: false,
      reason: "Persetujuan keputusan hanya untuk Founder.",
    };
  }

  return { allowed: true };
}

const DEPT_COMMANDS: Partial<Record<string, DepartmentId>> = {
  "/infrastructure": "devops",
  "/product": "product",
  "/sales": "sales",
  "/marketing": "marketing",
  "/finance": "finance",
  "/support": "support",
  "/kpi": "analytics",
};

const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "PLANNING",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "APPROVAL_REQUIRED",
  "APPROVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

function header(title: string): string {
  return `## WebRent Office · ${title}`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function taskLine(t: Task): string {
  const dept = t.department === "unassigned" ? "?" : t.department;
  return `- ${t.id} [${t.status}] (${t.priority}/${t.risk}) ${t.title} — ${dept}`;
}

function deptSection(dept: DepartmentId, tasks: Task[]): string {
  const mine = tasks.filter((t) => t.department === dept);
  if (mine.length === 0) return `DATA_NOT_AVAILABLE (tidak ada task aktif)`;
  return mine.map(taskLine).join("\n");
}

function deptForQuery(q: string): DepartmentId | undefined {
  const known: Array<[RegExp, DepartmentId]> = [
    [/security|keamanan|insiden|malware|breach/i, "security"],
    [/devops|infra|deploy|uptime|server/i, "devops"],
    [/engineering|engineer|kode|arsitektur/i, "engineering"],
    [/product|produk|fitur|roadmap/i, "product"],
    [/marketing|kampanye|konten|promosi/i, "marketing"],
    [/sales|penjualan|lead|proposal/i, "sales"],
    [/finance|keuangan|harga|pricing|biaya/i, "finance"],
    [/support|pelanggan|tiket|onboarding/i, "support"],
    [/data|analitik|kpi|metrik/i, "analytics"],
    [/desain|ux|ui/i, "ux"],
    [/dokumen|dokumentasi|sop/i, "documentation"],
  ];
  const hit = known.find(([re]) => re.test(q));
  return hit?.[1];
}

function classifyRisk(text: string): RiskLevel {
  if (/breach|kebocoran|ransomware|malware|attacker|serang|kritis/i.test(text)) {
    return "CRITICAL";
  }
  if (/harga|pricing|deploy|hapus|delete|transaksi|kontrak|produksi/i.test(text)) {
    return "HIGH";
  }
  if (/publish|rilis|customer|pelanggan|konfigurasi/i.test(text)) {
    return "MEDIUM";
  }
  return "LOW";
}

const INCIDENT_TRIGGERS =
  /(attacker|malware|suspicious login|login mencurigakan|abnormal traffic|server compromise|kompromi|vulnerability|kerentanan|data breach|kebocoran data|suspicious process|unauthorized access|akses tidak sah|peretasan|hacked)/i;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function cmdHelp(): CommandResult {
  const lines = COMMAND_LIST.map((c) => `- \`${c}\``).join("\n");
  return {
    output: `${header("Bantuan")}\n\nPerintah yang tersedia:\n${lines}\n\n` +
      `Bahasa alami juga dikenali, mis. "kasih saya briefing pagi" ≡ /briefing.`,
  };
}

function cmdOffice(): CommandResult {
  return {
    output: [
      header("Status Kantor"),
      "",
      "```text",
      "WEBRENT AI VIRTUAL OFFICE",
      "STATUS: ONLINE",
      "",
      "ORCHESTRATOR: ONLINE",
      "AGENT MANAGER: ONLINE",
      "TASK ENGINE: READY",
      "APPROVAL ENGINE: READY",
      "KNOWLEDGE BASE: READY",
      "REPORTING ENGINE: READY",
      "INCIDENT ENGINE: READY",
      "```",
      "",
      `${AGENT_REGISTRY.length} agent terdaftar · 1 kamar 3D aktif.`,
    ].join("\n"),
  };
}

function cmdTasks(args: string[]): CommandResult {
  const sub = (args[0] ?? "").toLowerCase();
  const store = useOfficeStore.getState();

  if (sub === "create") {
    const title = args.slice(1).join(" ").trim();
    if (!title) {
      return { output: `Format: \`/tasks create <judul>\`` };
    }
    const risk = classifyRisk(title);
    const dept = deptForQuery(title) ?? "unassigned";
    const task = store.createTask({
      title,
      department: dept,
      risk,
      priority: inferPriority(risk),
      approvalRequired: risk === "HIGH" || risk === "CRITICAL",
      owner: dept === "unassigned" ? "orchestrator" : `${dept}-agent`,
    });
    return {
      output: [
        header("Task Dibuat"),
        "",
        "```yaml",
        `task_id: ${task.id}`,
        `title: "${task.title}"`,
        `status: ${task.status}`,
        `priority: ${task.priority}`,
        `department: ${task.department}`,
        `risk: ${task.risk}`,
        `approval_required: ${task.approvalRequired}`,
        "```",
      ].join("\n"),
    };
  }

  if (sub === "assign") {
    const id = (args[1] ?? "").toUpperCase();
    const dept = (args[2] ?? "").toLowerCase() as DepartmentId;
    if (!id || !(dept in DEPARTMENTS)) {
      return {
        output: `Format: \`/tasks assign <task-id> <departemen>\`\nDepartemen: ${Object.keys(
          DEPARTMENTS,
        ).join(", ")}`,
      };
    }
    store.assignTask(id, dept, `${dept}-agent`);
    return { output: `${header("Task Ditugaskan")}\n\n${id} → ${DEPARTMENTS[dept]} (${dept}-agent)` };
  }

  if (sub === "review") {
    const id = (args[1] ?? "").toUpperCase();
    const status = (args[2] ?? "").toUpperCase() as TaskStatus;
    if (!TASK_STATUSES.includes(status)) {
      return {
        output: `Format: \`/tasks review <task-id> <status>\`\nStatus: ${TASK_STATUSES.join(
          ", ",
        )}`,
      };
    }
    store.updateTaskStatus(id, status);
    return { output: `${header("Task Diperbarui")}\n\n${id} → ${status}` };
  }

  const today = sub === "today";
  const tasks = today
    ? store.tasks.filter((t) =>
        ["TODO", "PLANNING", "IN_PROGRESS", "REVIEW", "APPROVAL_REQUIRED", "BLOCKED"].includes(
          t.status,
        ),
      )
    : store.tasks;

  const body = tasks.length
    ? tasks.map(taskLine).join("\n")
    : "DATA_NOT_AVAILABLE (belum ada task)";

  return {
    output: `${header(today ? "Task Hari Ini" : "Semua Task")}\n\n${body}\n\nTotal: ${tasks.length}`,
  };
}

function cmdAgents(args: string[]): CommandResult {
  const showStatus = (args[0] ?? "").toLowerCase() === "status";
  const lines = AGENT_REGISTRY.map((a) => {
    const suffix = showStatus ? ` — ${a.status.toUpperCase()}` : "";
    return `- ${a.department}: ${a.name}${suffix}`;
  });
  return {
    output: `${header("Agent Registry")}\n\n${lines.join("\n")}\n\nTotal: ${AGENT_REGISTRY.length} agent`,
  };
}

function cmdIncident(args: string[]): CommandResult {
  const store = useOfficeStore.getState();
  const sub = (args[0] ?? "").toLowerCase();

  if (!sub || sub === "list") {
    if (store.incidents.length === 0) {
      return { output: `${header("Daftar Insiden")}\n\nDATA_NOT_AVAILABLE (tidak ada insiden aktif).` };
    }
    return {
      output: `${header("Daftar Insiden")}\n\n${store.incidents
        .map((i) => `- ${i.id} [${i.status}] (${i.severity}) ${i.title}`)
        .join("\n")}`,
    };
  }

  const title = args.join(" ").trim();
  const risk = classifyRisk(title);
  const incident = store.createIncident({
    title,
    severity: risk === "LOW" ? "MEDIUM" : risk,
    asset: "webrent.my.id",
  });

  const securityNpc = NPC_MAP["security"];
  if (securityNpc) useNpcStore.getState().setActiveNpc(securityNpc.id);

  return {
    output: [
      "🚨 WEBRENT SECURITY ALERT",
      "",
      `Incident ID: ${incident.id}`,
      `Severity: ${incident.severity}`,
      `Detected: ${fmtDate(incident.detectedAt)}`,
      `Affected Asset: ${incident.asset}`,
      "",
      "What Happened:",
      `${incident.title}`,
      "",
      "Observed Indicators:",
      "DATA_NOT_AVAILABLE",
      "",
      "Actions Taken:",
      incident.actions.map((a) => `- ${a}`).join("\n"),
      "",
      "Current Status:",
      incident.status,
      "",
      "Recommended Action:",
      "- Containment dalam authorized scope + eskalasi ke Security Agent",
      "",
      "Human Approval Required:",
      incident.severity === "HIGH" || incident.severity === "CRITICAL" ? "YES" : "NO",
    ].join("\n"),
  };
}

function cmdSecurity(args: string[]): CommandResult {
  const store = useOfficeStore.getState();
  const open = store.incidents.filter((i) => i.status !== "RESOLVED");
  const status = (args[0] ?? "").toLowerCase();

  if (status === "status" || open.length === 0) {
    return {
      output: [
        header("Security Status"),
        "",
        `Overall: ${open.length ? "INCIDENT" : "DATA_NOT_AVAILABLE"}`,
        `Open Incidents: ${open.length}`,
        "Firewall/IDS: DATA_NOT_AVAILABLE",
        "Last Scan: DATA_NOT_AVAILABLE",
        "",
        "Recommended Action:",
        open.length
          ? "- Tangani insiden terbuka berikut: " + open.map((i) => i.id).join(", ")
          : "- Hubungkan sumber data keamanan untuk pemantauan nyata.",
      ].join("\n"),
    };
  }

  return cmdIncident(["list"]);
}

function cmdReport(args: string[]): CommandResult {
  const period = (args[0] ?? "daily").toLowerCase();
  const store = useOfficeStore.getState();
  const done = store.tasks.filter((t) => t.status === "COMPLETED").length;
  const active = store.tasks.filter((t) => t.status !== "COMPLETED").length;

  return {
    output: [
      header(`Laporan ${period.toUpperCase()}`),
      "",
      `FACT:`,
      `- Total task tercatat: ${store.tasks.length}`,
      `- Selesai: ${done} · Aktif: ${active}`,
      `- Insiden terbuka: ${store.incidents.filter((i) => i.status !== "RESOLVED").length}`,
      "",
      "OBSERVATION:",
      "- Sebagian besar data operasional belum terhubung (DATA_NOT_AVAILABLE).",
      "",
      "RECOMMENDATION:",
      "- Fokus menuntaskan task APPROVAL_REQUIRED lebih dulu.",
    ].join("\n"),
  };
}

function cmdRoadmap(): CommandResult {
  return {
    output: [
      header("Product Roadmap"),
      "",
      "```text",
      "Q1  Dasar platform & paket restoran",
      "Q2  Otomasi onboarding + billing",
      "Q3  Multi-tenant & analytics pelanggan",
      "Q4  Ekspansi paket & integrasi mitra",
      "```",
      "",
      "Catatan: estimasi bersifat FORECAST, bukan data terverifikasi.",
    ].join("\n"),
  };
}

function cmdStatus(): CommandResult {
  const store = useOfficeStore.getState();
  const openIncidents = store.incidents.filter((i) => i.status !== "RESOLVED");
  const blocked = store.tasks.filter((t) => t.status === "BLOCKED");
  const approvals = store.tasks.filter((t) => t.approvalRequired && t.status !== "COMPLETED");
  const overall = openIncidents.length ? "INCIDENT" : blocked.length ? "DEGRADED" : "HEALTHY";

  return {
    output: [
      "WEBRENT EXECUTIVE STATUS",
      "",
      `Overall: ${overall}`,
      "",
      `Operations: ${store.tasks.length} task (${blocked.length} blocked)`,
      `Product: ${deptSection("product", store.tasks).replace(/\n/g, "; ")}`,
      "Engineering: DATA_NOT_AVAILABLE",
      "Infrastructure: DATA_NOT_AVAILABLE",
      `Security: ${openIncidents.length ? `${openIncidents.length} insiden terbuka` : "tidak ada insiden aktif"}`,
      "Sales: DATA_NOT_AVAILABLE",
      "Marketing: DATA_NOT_AVAILABLE",
      "Finance: DATA_NOT_AVAILABLE",
      "Customer Support: DATA_NOT_AVAILABLE",
      "",
      "Critical Issues:",
      openIncidents.length
        ? openIncidents.map((i) => `- ${i.id} ${i.title}`).join("\n")
        : "- Tidak ada",
      "",
      "Pending Decisions:",
      store.decisions.filter((d) => d.status === "PENDING").length
        ? store.decisions
            .filter((d) => d.status === "PENDING")
            .map((d) => `- ${d.id} ${d.title} (${d.risk})`)
            .join("\n")
        : "- Tidak ada",
      "",
      "Recommended Next Actions:",
      approvals.length
        ? `- Setujui / tolak ${approvals.length} task berisiko tinggi`
        : "- Lanjutkan task aktif berikutnya",
    ].join("\n"),
  };
}

function cmdBriefing(): CommandResult {
  const store = useOfficeStore.getState();
  const openIncidents = store.incidents.filter((i) => i.status !== "RESOLVED");
  const priorities = store.tasks
    .filter((t) => ["P0", "P1"].includes(t.priority) && t.status !== "COMPLETED")
    .slice(0, 5);

  const box = [
    "╔══════════════════════════════════╗",
    "       WEBRENT DAILY BRIEFING",
    "╚══════════════════════════════════╝",
  ].join("\n");

  const depts: DepartmentId[] = [
    "product",
    "engineering",
    "devops",
    "security",
    "sales",
    "marketing",
    "support",
    "finance",
  ];

  return {
    output: [
      box,
      "",
      `DATE: ${fmtDate(Date.now())}`,
      "",
      "EXECUTIVE SUMMARY",
      openIncidents.length
        ? `- ${openIncidents.length} insiden aktif, perlu perhatian.`
        : "- Tidak ada insiden; operasional berjalan normal.",
      "",
      "SYSTEM HEALTH",
      "DATA_NOT_AVAILABLE",
      "",
      "ACTIVE INCIDENTS",
      openIncidents.length ? openIncidents.map((i) => `- ${i.id} ${i.title}`).join("\n") : "- Tidak ada",
      "",
      ...depts.flatMap((d) => [
        DEPARTMENTS[d].toUpperCase(),
        deptSection(d, store.tasks),
        "",
      ]),
      "PENDING APPROVALS",
      store.decisions.filter((d) => d.status === "PENDING").length
        ? store.decisions
            .filter((d) => d.status === "PENDING")
            .map((d) => `- ${d.id} ${d.title}`)
            .join("\n")
        : "- Tidak ada",
      "",
      "BLOCKERS",
      store.tasks.filter((t) => t.status === "BLOCKED").length
        ? store.tasks
            .filter((t) => t.status === "BLOCKED")
            .map((t) => `- ${t.id} ${t.title}`)
            .join("\n")
        : "- Tidak ada",
      "",
      "DECISIONS REQUIRED",
      store.decisions.filter((d) => d.status === "PENDING").length
        ? "- Tinjau keputusan PENDING di atas (/decisions)"
        : "- Tidak ada",
      "",
      "TODAY'S PRIORITIES",
      priorities.length
        ? priorities.map((t, i) => `${i + 1}. ${t.id} ${t.title} (${t.priority})`).join("\n")
        : "DATA_NOT_AVAILABLE",
    ].join("\n"),
  };
}

function cmdApprove(args: string[]): CommandResult {
  const id = (args[0] ?? "").toUpperCase();
  const store = useOfficeStore.getState();
  const decision = store.decisions.find((d) => d.id === id);
  if (!decision) {
    return { output: `Decision \`${id}\` tidak ditemukan. Lihat \`/decisions\`.` };
  }
  store.setDecisionStatus(id, "APPROVED");
  store.tasks
    .filter((t) => t.owner === decision.requestedBy && t.status === "APPROVAL_REQUIRED")
    .forEach((t) => store.updateTaskStatus(t.id, "APPROVED"));
  return {
    output: [
      header("Keputusan Disetujui"),
      "",
      `${decision.id} — ${decision.title}`,
      `Status: APPROVED`,
      "",
      "Catatan: persetujuan ini dicatat oleh Approval Engine lokal.",
    ].join("\n"),
  };
}

function cmdDecisions(): CommandResult {
  const store = useOfficeStore.getState();
  if (store.decisions.length === 0) {
    return { output: `${header("Pending Decisions")}\n\nDATA_NOT_AVAILABLE` };
  }
  return {
    output: [
      header("Pending Decisions"),
      "",
      store.decisions
        .map((d) => `- ${d.id} [${d.status}] (${d.risk}) ${d.title} — ${d.requestedBy}`)
        .join("\n"),
    ].join("\n"),
  };
}

function cmdAudit(args: string[]): CommandResult {
  const store = useOfficeStore.getState();
  const limit = Math.min(Math.max(Number(args[0]) || 20, 1), 200);
  if (store.audit.length === 0) {
    return { output: `${header("Audit Log")}\n\nDATA_NOT_AVAILABLE (belum ada aktivitas).` };
  }
  const rows = store.audit.slice(0, limit).map((a) => {
    const time = new Date(a.at).toISOString().replace("T", " ").slice(0, 19);
    const target = a.target ? ` ${a.target}` : "";
    const detail = a.detail ? ` — ${a.detail}` : "";
    return `- ${time} [${a.actor}] ${a.action}${target}${detail}`;
  });
  return {
    output: `${header(`Audit Log (${store.audit.length} entri)`)}\n\n${rows.join("\n")}`,
  };
}

export function getObsidianExport(period = "daily") {
  return buildObsidianExport(snapshotOf(useOfficeStore.getState()), period);
}

function cmdExport(args: string[]): CommandResult {
  const period = (args[0] ?? "daily").toLowerCase();
  const result = getObsidianExport(period);
  return {
    output: [
      header("Export Knowledge Base"),
      "",
      `Periode: ${period}`,
      `File: \`${result.filename}\``,
      `Catatan: ${result.counts.tasks} task · ${result.counts.incidents} insiden · ${result.counts.decisions} keputusan + audit log`,
      "",
      "File Markdown (frontmatter YAML + wiki link) diunduh otomatis.",
      "Salin ke vault Obsidian untuk dokumentasi.",
    ].join("\n"),
  };
}

function cmdSearch(args: string[]): CommandResult {
  const term = args.join(" ").trim().toLowerCase();
  if (!term) return { output: "Format: `/search <kata>`" };
  const store = useOfficeStore.getState();
  const taskHits = store.tasks.filter((t) => t.title.toLowerCase().includes(term));
  const incidentHits = store.incidents.filter((i) => i.title.toLowerCase().includes(term));
  const decisionHits = store.decisions.filter((d) => d.title.toLowerCase().includes(term));

  return {
    output: [
      header(`Pencarian: "${term}"`),
      "",
      "Tasks:",
      taskHits.length ? taskHits.map(taskLine).join("\n") : "- tidak ada",
      "Incidents:",
      incidentHits.length
        ? incidentHits.map((i) => `- ${i.id} ${i.title}`).join("\n")
        : "- tidak ada",
      "Decisions:",
      decisionHits.length
        ? decisionHits.map((d) => `- ${d.id} ${d.title}`).join("\n")
        : "- tidak ada",
    ].join("\n"),
  };
}

function cmdDepartment(dept: DepartmentId): CommandResult {
  const store = useOfficeStore.getState();
  const owner = AGENT_REGISTRY.find((a) => a.department === dept);
  return {
    output: [
      header(DEPARTMENTS[dept]),
      "",
      `Owner: ${owner?.name ?? "AGENT_UNAVAILABLE"}`,
      "",
      "Task terkait:",
      deptSection(dept, store.tasks),
      "",
      "Catatan: bagian tanpa data operasional ditandai DATA_NOT_AVAILABLE.",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Parser & dispatcher
// ---------------------------------------------------------------------------

const HELP_INTENT = /^(help|bantuan|perintah apa( saja)?|command apa( saja)?)\??$/i;
const BRIEFING_INTENT = /^(briefing|ringkasan pagi|laporan pagi|kasih.*briefing.*)$/i;
const STATUS_INTENT =
  /bagaimana kondisi webrent|kondisi webrent|status webrent|status keseluruhan|status umum|executive status/i;

export function isCommand(query: string, npc: NpcDefinition): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q.startsWith("/")) return true;
  if (BRIEFING_INTENT.test(q)) return true;
  if (STATUS_INTENT.test(q)) return true;
  if (HELP_INTENT.test(q)) return true;
  return INCIDENT_TRIGGERS.test(q) && npc.department === "security";
}

export function runCommand(query: string): CommandResult {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed.startsWith("/")) {
    if (BRIEFING_INTENT.test(lower)) return cmdBriefing();
    if (STATUS_INTENT.test(lower)) return cmdStatus();
    if (HELP_INTENT.test(lower)) return cmdHelp();
    if (INCIDENT_TRIGGERS.test(lower)) return cmdIncident([trimmed]);
    return { output: `DATA_NOT_AVAILABLE` };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const name = `/${parts[0].toLowerCase()}`;
  const args = parts.slice(1);

  switch (name) {
    case "/help":
      return cmdHelp();
    case "/office":
      return cmdOffice();
    case "/briefing":
      return cmdBriefing();
    case "/status":
      return cmdStatus();
    case "/tasks":
      return cmdTasks(args);
    case "/agents":
      return cmdAgents(args);
    case "/incident":
      return cmdIncident(args);
    case "/incidents":
      return cmdIncident(["list"]);
    case "/security":
      return cmdSecurity(args);
    case "/report":
      return cmdReport(args);
    case "/roadmap":
      return cmdRoadmap();
    case "/approve":
      return cmdApprove(args);
    case "/decisions":
      return cmdDecisions();
    case "/audit":
      return cmdAudit(args);
    case "/export":
      return cmdExport(args);
    case "/search":
      return cmdSearch(args);
    default:
      if (name in DEPT_COMMANDS) {
        return cmdDepartment(DEPT_COMMANDS[name] as DepartmentId);
      }
      return {
        output: `${header("Perintah Tidak Dikenal")}\n\n\`${name}\` belum dikenal. Ketik \`/help\`.`,
      };
  }
}

export function commandOwner(query: string): NpcDefinition | undefined {
  const trimmed = query.trim();
  if (!trimmed.startsWith("/")) return undefined;
  const name = `/${trimmed.slice(1).split(/\s+/)[0].toLowerCase()}`;
  if (["/briefing", "/status", "/office", "/report"].includes(name)) {
    return NPC_MAP["ceo"] ?? NPC_MAP["coo"];
  }
  if (["/incident", "/incidents", "/security"].includes(name)) {
    return NPC_MAP["security"];
  }
  if (
    [
      "/tasks",
      "/agents",
      "/approve",
      "/decisions",
      "/audit",
      "/export",
      "/search",
      "/help",
    ].includes(name)
  ) {
    return NPC_MAP["coo"];
  }
  if (name in DEPT_COMMANDS) {
    const dept = DEPT_COMMANDS[name] as DepartmentId;
    return Object.values(NPC_MAP).find((n) => n.department === dept);
  }
  return undefined;
}

export function inferPriority(risk: RiskLevel): Priority {
  return risk === "HIGH" || risk === "CRITICAL" ? "P0" : risk === "MEDIUM" ? "P1" : "P2";
}
