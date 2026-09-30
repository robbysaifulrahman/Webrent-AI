import { MAX_AUDIT, type OfficeSnapshot } from "@/lib/officeData";
import type { DepartmentId, Role } from "@/types";

export interface ScopedResult {
  snapshot: OfficeSnapshot;
  applied: string[];
  rejected: string[];
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Menggabungkan snapshot masuk dengan state server, dibatasi oleh role.
 *
 * - founder: penggantian penuh diizinkan.
 * - departemen: hanya boleh mengubah task miliknya, insiden (security/ops),
 *   dan menambah entri audit miliknya. Keputusan & task departemen lain
 *   dipertahankan dari state server.
 * - guest: tidak diizinkan (ditangani di route).
 */
export function applyScopedUpdate(
  current: OfficeSnapshot,
  incoming: OfficeSnapshot,
  role: Role,
): ScopedResult {
  if (role === "founder") {
    return {
      snapshot: { ...incoming, version: current.version + 1 },
      applied: ["full-snapshot"],
      rejected: [],
    };
  }

  const applied: string[] = [];
  const rejected: string[] = [];
  const dept = role === "guest" ? null : (role as DepartmentId);

  // ---------- Tasks ----------
  let tasks = current.tasks;
  if (dept) {
    const kept = current.tasks.filter((t) => t.department !== dept);
    const owned = incoming.tasks.filter((t) => {
      if (t.department !== dept) return false;
      const existing = current.tasks.find((c) => c.id === t.id);
      if (existing && existing.department !== dept) {
        rejected.push(`task.steal:${t.id}`);
        return false;
      }
      return true;
    });

    for (const t of incoming.tasks) {
      const existing = current.tasks.find((c) => c.id === t.id);
      if (existing && existing.department !== dept && !same(existing, t)) {
        rejected.push(`task.forbidden:${t.id}`);
      }
    }

    tasks = [...kept, ...owned];
    applied.push(`tasks:${owned.length}`);
  } else if (!same(current.tasks, incoming.tasks)) {
    rejected.push("tasks:guest");
  }

  // ---------- Incidents ----------
  let incidents = current.incidents;
  if (dept === "security" || dept === "operations") {
    incidents = incoming.incidents;
    applied.push(`incidents:${incoming.incidents.length}`);
  } else if (!same(current.incidents, incoming.incidents)) {
    rejected.push("incidents:forbidden");
  }

  // ---------- Decisions (founder only) ----------
  if (!same(current.decisions, incoming.decisions)) {
    rejected.push("decisions:founder-only");
  }

  // ---------- Audit (append milik sendiri) ----------
  const serverIds = new Set(current.audit.map((a) => a.id));
  const extra = incoming.audit.filter(
    (a) => !serverIds.has(a.id) && (!dept || a.actor === dept),
  );
  const audit = [...extra, ...current.audit].slice(0, MAX_AUDIT);
  if (extra.length) applied.push(`audit:+${extra.length}`);

  return {
    snapshot: {
      tasks,
      incidents,
      decisions: current.decisions,
      audit,
      taskSeq: Math.max(current.taskSeq, incoming.taskSeq),
      incidentSeq: Math.max(current.incidentSeq, incoming.incidentSeq),
      decisionSeq: Math.max(current.decisionSeq, incoming.decisionSeq),
      version: current.version + 1,
    },
    applied,
    rejected,
  };
}
