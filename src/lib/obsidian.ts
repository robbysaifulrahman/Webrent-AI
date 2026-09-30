import { DEPARTMENTS } from "@/data/departments";
import {
  MAX_AUDIT,
  type OfficeSnapshot,
} from "@/lib/officeData";
import type { AuditEntry, Decision, Incident, Task } from "@/types";

function frontmatter(fields: Record<string, string | string[]>): string {
  const lines = Object.entries(fields).map(([key, value]) =>
    Array.isArray(value) ? `${key}: [${value.join(", ")}]` : `${key}: ${value}`,
  );
  return ["---", ...lines, "---", ""].join("\n");
}

function slug(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, "-");
}

function ymd(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function taskNote(task: Task): string {
  const deptLabel =
    task.department === "unassigned"
      ? "Unassigned"
      : DEPARTMENTS[task.department];
  const deps = task.dependencies.length
    ? task.dependencies.map((d) => `[[${d}]]`).join(", ")
    : "—";
  return [
    frontmatter({
      type: "task",
      id: task.id,
      title: task.title,
      department: task.department,
      status: task.status,
      priority: task.priority,
      owner: task.owner,
      risk: task.risk,
      created: ymd(task.createdAt),
      updated: ymd(task.updatedAt),
      tags: ["task", task.department],
    }),
    `# ${task.id} — ${task.title}`,
    "",
    `- **Departemen:** [[${deptLabel}]]`,
    `- **Status:** ${task.status} · **Prioritas:** ${task.priority} · **Risiko:** ${task.risk}`,
    `- **Owner:** ${task.owner}`,
    `- **Approval Diperlukan:** ${task.approvalRequired ? "Ya" : "Tidak"}`,
    `- **Dependencies:** ${deps}`,
    "",
    "## Deliverables",
    task.deliverables.length
      ? task.deliverables.map((d) => `- ${d}`).join("\n")
      : "- (belum ada)",
    "",
    "[[WebRent Office]] · [[Tasks]]",
    "",
  ].join("\n");
}

function incidentNote(incident: Incident): string {
  return [
    frontmatter({
      type: "incident",
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      asset: incident.asset,
      status: incident.status,
      detected: ymd(incident.detectedAt),
      tags: ["incident", "security", incident.severity.toLowerCase()],
    }),
    `# ${incident.id} — ${incident.title}`,
    "",
    `- **Severity:** ${incident.severity}`,
    `- **Aset:** ${incident.asset}`,
    `- **Status:** ${incident.status}`,
    "",
    "## Actions",
    incident.actions.map((a) => `- ${a}`).join("\n") || "- (belum ada)",
    "",
    "[[Incident Response]] · [[Security]]",
    "",
  ].join("\n");
}

function decisionNote(decision: Decision): string {
  return [
    frontmatter({
      type: "decision",
      id: decision.id,
      title: decision.title,
      status: decision.status,
      risk: decision.risk,
      requested_by: decision.requestedBy,
      created: ymd(decision.createdAt),
      tags: ["decision", decision.risk.toLowerCase()],
    }),
    `# ${decision.id} — ${decision.title}`,
    "",
    `- **Status:** ${decision.status}`,
    `- **Risiko:** ${decision.risk}`,
    `- **Diajukan oleh:** ${decision.requestedBy}`,
    "",
    "[[Decisions]] · [[WebRent Office]]",
    "",
  ].join("\n");
}

function auditNote(entries: AuditEntry[]): string {
  return [
    frontmatter({
      type: "audit",
      title: "Audit Log WebRent Office",
      updated: ymd(Date.now()),
      tags: ["audit", "report"],
    }),
    "# Audit Log",
    "",
    "| Waktu | Aktor | Aksi | Target | Detail |",
    "|---|---|---|---|---|",
    ...entries
      .slice(0, MAX_AUDIT)
      .map((a) => {
        const time = new Date(a.at).toISOString().replace("T", " ").slice(0, 19);
        return `| ${time} | ${a.actor} | ${a.action} | ${a.target ?? "—"} | ${a.detail ?? "—"} |`;
      }),
    "",
    "[[WebRent Office]]",
    "",
  ].join("\n");
}

function indexNote(
  snapshot: OfficeSnapshot,
  period: string,
  generatedAt: number,
): string {
  const tasks = snapshot.tasks.map((t) => `[[${slug(t.id)}|${t.id}]]`).join(", ");
  const incidents = snapshot.incidents
    .map((i) => `[[${slug(i.id)}|${i.id}]]`)
    .join(", ");
  const decisions = snapshot.decisions
    .map((d) => `[[${slug(d.id)}|${d.id}]]`)
    .join(", ");

  return [
    frontmatter({
      type: "index",
      title: `WebRent Office Export (${period})`,
      generated: ymd(generatedAt),
      tags: ["webrent", "export", period],
    }),
    "# WebRent Office — Knowledge Base",
    "",
    `> Dibuat otomatis dari kantor virtual. Periode: **${period}**.`,
    "",
    "## Department",
    ...Object.values(DEPARTMENTS).map((label) => `- [[${label}]]`),
    "",
    "## Tasks",
    tasks || "- (belum ada)",
    "",
    "## Incidents",
    incidents || "- (belum ada)",
    "",
    "## Decisions",
    decisions || "- (belum ada)",
    "",
    "## Reports",
    "- [[Audit Log]]",
    "- [[Incident Response]]",
    "- [[WebRent Office]]",
    "",
  ].join("\n");
}

export interface ObsidianExport {
  filename: string;
  markdown: string;
  counts: { tasks: number; incidents: number; decisions: number };
}

/**
 * Menyusun vault Obsidian (satu file Markdown gabungan) dari snapshot state.
 * Format: YAML frontmatter + wiki link [[...]].
 */
export function buildObsidianExport(
  snapshot: OfficeSnapshot,
  period = "daily",
  generatedAt = Date.now(),
): ObsidianExport {
  const sections: string[] = [
    "# Export WebRent Office (vault)",
    "",
    "> Salin-tempel file ini ke vault Obsidian, atau simpan sebagai `.md`.",
    "> Setiap catatan dipisahkan oleh `---RULE---` (pemisah antar-note).",
    "",
    "---RULE---",
    "",
    indexNote(snapshot, period, generatedAt),
  ];

  for (const task of snapshot.tasks) {
    sections.push("---RULE---", "", taskNote(task));
  }
  for (const incident of snapshot.incidents) {
    sections.push("---RULE---", "", incidentNote(incident));
  }
  for (const decision of snapshot.decisions) {
    sections.push("---RULE---", "", decisionNote(decision));
  }
  sections.push("---RULE---", "", auditNote(snapshot.audit ?? []));

  const date = ymd(generatedAt);
  return {
    filename: `webrent-office-${period}-${date}.md`,
    markdown: sections.join("\n"),
    counts: {
      tasks: snapshot.tasks.length,
      incidents: snapshot.incidents.length,
      decisions: snapshot.decisions.length,
    },
  };
}
