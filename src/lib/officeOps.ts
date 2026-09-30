import {
  MAX_AUDIT,
  pad,
  type OfficeSnapshot,
} from "@/lib/officeData";
import { compareAndSave, loadSnapshot } from "@/lib/serverStore";
import type {
  Decision,
  DecisionStatus,
  DepartmentId,
  Incident,
  IncidentStatus,
  Priority,
  RiskLevel,
  Task,
  TaskStatus,
  EntitySource,
} from "@/types";

/**
 * Operasi state server-side (Phase F/G) — server = source of truth
 * (Section 2). Mutasi dilakukan dengan CAS loop (optimistic locking,
 * Section 48) di atas snapshot store yang sama dengan /api/state.
 * Semua mutasi menghasilkan audit entry (Section 31).
 */

const YEAR = new Date().getFullYear();

function auditId(): string {
  return `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withAudit(
  snapshot: OfficeSnapshot,
  actor: string,
  action: string,
  target: string,
  detail?: string,
): OfficeSnapshot {
  return {
    ...snapshot,
    audit: [
      {
        id: auditId(),
        at: Date.now(),
        actor,
        action,
        target,
        detail,
      },
      ...snapshot.audit,
    ].slice(0, MAX_AUDIT),
  };
}

export interface CreateTaskServerInput {
  title: string;
  department?: DepartmentId | "unassigned";
  priority?: Priority;
  risk?: RiskLevel;
  source: EntitySource;
  actor: string;
  requestId?: string;
}

/** Buat task dari sisi server (Telegram/Raven/API). Null bila kalah CAS terus. */
export async function createTaskServer(
  input: CreateTaskServerInput,
): Promise<Task | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snapshot = await loadSnapshot();
    const seq = snapshot.taskSeq;
    const department = input.department ?? "unassigned";
    const risk = input.risk ?? "LOW";
    const task: Task = {
      id: `WR-${YEAR}-${pad(seq, 4)}`,
      title: input.title,
      status: "TODO",
      priority: input.priority ?? (risk === "HIGH" || risk === "CRITICAL" ? "P0" : risk === "MEDIUM" ? "P1" : "P2"),
      department,
      owner: department === "unassigned" ? "orchestrator" : `${department}-agent`,
      dependencies: [],
      approvalRequired: risk === "HIGH" || risk === "CRITICAL",
      risk,
      deliverables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: input.source,
    };

    const next = withAudit(
      { ...snapshot, tasks: [task, ...snapshot.tasks], taskSeq: seq + 1 },
      input.actor,
      "task.create",
      task.id,
      input.title,
    );

    if (await compareAndSave(snapshot.version, next)) return task;
  }
  return null;
}

export interface CreateIncidentServerInput {
  title: string;
  severity: RiskLevel;
  asset?: string;
  source: EntitySource;
  actor: string;
  requestId?: string;
}

/** Buat insiden dari sisi server (Raven pipeline Section 9/10). */
export async function createIncidentServer(
  input: CreateIncidentServerInput,
): Promise<Incident | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snapshot = await loadSnapshot();
    const seq = snapshot.incidentSeq;
    const incident: Incident = {
      id: `WR-INC-${pad(seq)}`,
      title: input.title,
      severity: input.severity,
      asset: input.asset ?? "webrent.my.id",
      status: "OPEN",
      detectedAt: Date.now(),
      actions: ["Incident dibuat otomatis dari event integrasi."],
      source: input.source,
    };

    const next = withAudit(
      {
        ...snapshot,
        incidents: [incident, ...snapshot.incidents],
        incidentSeq: seq + 1,
      },
      input.actor,
      "incident.create",
      incident.id,
      input.title,
    );

    if (await compareAndSave(snapshot.version, next)) return incident;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mutasi ter-scope dari integrasi (Telegram admin, Section 19/21) — semua
// memakai pola CAS loop yang sama dan menghasilkan audit entry.
// ---------------------------------------------------------------------------

export type ServerOpResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "NOT_FOUND" | "CONFLICT" };

export interface AssignTaskServerInput {
  id: string;
  department: DepartmentId;
  source: EntitySource;
  actor: string;
  requestId?: string;
}

/** Assign task ke departemen (owner = `<dept>-agent`, mirror /tasks assign). */
export async function assignTaskServer(
  input: AssignTaskServerInput,
): Promise<ServerOpResult<Task>> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snapshot = await loadSnapshot();
    const task = snapshot.tasks.find((t) => t.id === input.id);
    if (!task) return { ok: false, reason: "NOT_FOUND" };
    const owner = `${input.department}-agent`;
    const updated: Task = {
      ...task,
      department: input.department,
      owner,
      updatedAt: Date.now(),
    };
    const next = withAudit(
      {
        ...snapshot,
        tasks: snapshot.tasks.map((t) => (t.id === input.id ? updated : t)),
      },
      input.actor,
      "task.assign",
      input.id,
      `${input.department} → ${owner}`,
    );
    if (await compareAndSave(snapshot.version, next)) {
      return { ok: true, value: updated };
    }
  }
  return { ok: false, reason: "CONFLICT" };
}

export interface UpdateTaskStatusServerInput {
  id: string;
  status: TaskStatus;
  source: EntitySource;
  actor: string;
  detail?: string;
  requestId?: string;
}

/** Ubah status task dari sisi server (cancel, review, dll.). */
export async function updateTaskStatusServer(
  input: UpdateTaskStatusServerInput,
): Promise<ServerOpResult<Task>> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snapshot = await loadSnapshot();
    const task = snapshot.tasks.find((t) => t.id === input.id);
    if (!task) return { ok: false, reason: "NOT_FOUND" };
    const updated: Task = {
      ...task,
      status: input.status,
      updatedAt: Date.now(),
    };
    const next = withAudit(
      {
        ...snapshot,
        tasks: snapshot.tasks.map((t) => (t.id === input.id ? updated : t)),
      },
      input.actor,
      "task.status",
      input.id,
      input.detail ?? `${task.status} → ${input.status}`,
    );
    if (await compareAndSave(snapshot.version, next)) {
      return { ok: true, value: updated };
    }
  }
  return { ok: false, reason: "CONFLICT" };
}

export interface SetDecisionStatusServerInput {
  id: string;
  status: DecisionStatus;
  source: EntitySource;
  actor: string;
  requestId?: string;
}

export interface DecisionApprovalOutcome {
  decision: Decision;
  /** Task milik pengaju yang ikut di-APPROVED (cascade Approval Engine). */
  cascadedTasks: Task[];
}

/**
 * Setujui/tolak keputusan. APPROVED memicu cascade: semua task
 * APPROVAL_REQUIRED milik `decision.requestedBy` → APPROVED
 * (mirror Approval Engine lokal di /approve).
 */
export async function setDecisionStatusServer(
  input: SetDecisionStatusServerInput,
): Promise<ServerOpResult<DecisionApprovalOutcome>> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snapshot = await loadSnapshot();
    const decision = snapshot.decisions.find((d) => d.id === input.id);
    if (!decision) return { ok: false, reason: "NOT_FOUND" };
    const updatedDecision: Decision = { ...decision, status: input.status };

    let cascadedTasks: Task[] = [];
    let tasks = snapshot.tasks;
    if (input.status === "APPROVED") {
      cascadedTasks = snapshot.tasks
        .filter(
          (t) =>
            t.owner === decision.requestedBy &&
            t.status === "APPROVAL_REQUIRED",
        )
        .map((t) => ({ ...t, status: "APPROVED" as const, updatedAt: Date.now() }));
      if (cascadedTasks.length) {
        const cascadeById = new Map(cascadedTasks.map((t) => [t.id, t]));
        tasks = snapshot.tasks.map((t) => cascadeById.get(t.id) ?? t);
      }
    }

    const next = withAudit(
      {
        ...snapshot,
        decisions: snapshot.decisions.map((d) =>
          d.id === input.id ? updatedDecision : d,
        ),
        tasks,
      },
      input.actor,
      input.status === "APPROVED" ? "decision.approve" : "decision.reject",
      input.id,
      cascadedTasks.length
        ? `${decision.title} (+${cascadedTasks.length} task di-approve)`
        : decision.title,
    );
    if (await compareAndSave(snapshot.version, next)) {
      return {
        ok: true,
        value: { decision: updatedDecision, cascadedTasks },
      };
    }
  }
  return { ok: false, reason: "CONFLICT" };
}

export interface UpdateIncidentStatusServerInput {
  id: string;
  status: Extract<IncidentStatus, "CONTAINED" | "RESOLVED">;
  source: EntitySource;
  actor: string;
  requestId?: string;
}

/** Kontain (acknowledge) / selesaikan insiden dari sisi server. */
export async function updateIncidentStatusServer(
  input: UpdateIncidentStatusServerInput,
): Promise<ServerOpResult<Incident>> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snapshot = await loadSnapshot();
    const incident = snapshot.incidents.find((i) => i.id === input.id);
    if (!incident) return { ok: false, reason: "NOT_FOUND" };
    const updated: Incident = {
      ...incident,
      status: input.status,
      actions: [
        ...incident.actions,
        `Status → ${input.status} oleh ${input.actor}.`,
      ],
    };
    const next = withAudit(
      {
        ...snapshot,
        incidents: snapshot.incidents.map((i) =>
          i.id === input.id ? updated : i,
        ),
      },
      input.actor,
      input.status === "RESOLVED" ? "incident.resolve" : "incident.contain",
      input.id,
      incident.title,
    );
    if (await compareAndSave(snapshot.version, next)) {
      return { ok: true, value: updated };
    }
  }
  return { ok: false, reason: "CONFLICT" };
}
