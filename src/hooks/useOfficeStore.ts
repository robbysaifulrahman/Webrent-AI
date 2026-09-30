"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MAX_AUDIT,
  OFFICE_STORAGE_KEY as STORAGE_KEY,
  YEAR,
  pad,
  seedSnapshot,
  type OfficeSnapshot,
} from "@/lib/officeData";
import type {
  AuditEntry,
  Decision,
  Incident,
  DepartmentId,
  Priority,
  RiskLevel,
  Role,
  Task,
  TaskStatus,
} from "@/types";

export type SyncStatus = "idle" | "syncing" | "saved" | "error";

export interface CreateTaskInput {
  title: string;
  department?: DepartmentId | "unassigned";
  priority?: Priority;
  risk?: RiskLevel;
  owner?: string;
  dependencies?: string[];
  approvalRequired?: boolean;
  deliverables?: string[];
}

export interface CreateIncidentInput {
  title: string;
  severity?: RiskLevel;
  asset?: string;
}

export interface CreateDecisionInput {
  title: string;
  requestedBy: string;
  risk?: RiskLevel;
}

export interface AuditInput {
  actor: string;
  action: string;
  target?: string;
  detail?: string;
}

let auditSeq = 0;

function makeAudit(input: AuditInput): AuditEntry {
  auditSeq += 1;
  return {
    id: `AUD-${Date.now()}-${auditSeq}`,
    at: Date.now(),
    actor: input.actor,
    action: input.action,
    target: input.target,
    detail: input.detail,
  };
}

interface OfficeStore {
  tasks: Task[];
  incidents: Incident[];
  decisions: Decision[];
  audit: AuditEntry[];
  taskSeq: number;
  incidentSeq: number;
  decisionSeq: number;
  version: number;
  hydrated: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  authEnabled: boolean;
  authenticated: boolean;
  role: Role;

  setHydrated: (value: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setVersion: (version: number) => void;
  markSynced: () => void;
  setAuth: (status: {
    authEnabled: boolean;
    authenticated: boolean;
    role: Role;
  }) => void;
  isReadOnly: () => boolean;
  actor: () => "founder" | DepartmentId;
  applySnapshot: (snapshot: OfficeSnapshot, source: "server" | "local") => void;
  syncMeta: {
    baseline: OfficeSnapshot | null;
    pending: OfficeSnapshot | null;
  };
  setBaseline: (snapshot: OfficeSnapshot | null) => void;
  setPending: (snapshot: OfficeSnapshot | null) => void;
  createTask: (input: CreateTaskInput) => Task;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  assignTask: (id: string, department: DepartmentId, owner: string) => void;
  createIncident: (input: CreateIncidentInput) => Incident;
  updateIncidentStatus: (id: string, status: Incident["status"]) => void;
  addIncidentAction: (id: string, action: string) => void;
  createDecision: (input: CreateDecisionInput) => Decision;
  setDecisionStatus: (id: string, status: Decision["status"]) => void;
  clearAll: () => void;
  addAudit: (input: AuditInput) => void;
}

const SEED = seedSnapshot();

export const useOfficeStore = create<OfficeStore>()(
  persist(
    (set, get) => ({
      tasks: SEED.tasks,
      incidents: SEED.incidents,
      decisions: SEED.decisions,
      audit: SEED.audit,
      taskSeq: SEED.taskSeq,
      incidentSeq: SEED.incidentSeq,
      decisionSeq: SEED.decisionSeq,
      version: SEED.version,
      hydrated: false,
      syncStatus: "idle",
      lastSyncedAt: null,
      authEnabled: false,
      authenticated: true,
      role: "founder",
      syncMeta: { baseline: null, pending: null },

      setHydrated: (value) => set({ hydrated: value }),

      setBaseline: (snapshot) =>
        set((s) => ({
          syncMeta:
            snapshot === null
              ? { ...s.syncMeta, baseline: null }
              : { baseline: snapshot, pending: s.syncMeta.pending },
        })),

      setPending: (snapshot) =>
        set((s) => ({ syncMeta: { ...s.syncMeta, pending: snapshot } })),

      setSyncStatus: (status) => set({ syncStatus: status }),

      setVersion: (version) => set({ version }),

      markSynced: () => set({ syncStatus: "saved", lastSyncedAt: Date.now() }),

      setAuth: ({ authEnabled, authenticated, role }) =>
        set({ authEnabled, authenticated, role }),

      isReadOnly: () => {
        const s = get();
        return s.authEnabled && !s.authenticated;
      },

      actor: () => {
        const s = get();
        if (s.role === "founder" || s.role === "guest") return "founder";
        return s.role;
      },

      applySnapshot: (snapshot, source) =>
        set((state) => ({
          tasks: snapshot.tasks,
          incidents: snapshot.incidents,
          decisions: snapshot.decisions,
          audit: snapshot.audit ?? [],
          taskSeq: snapshot.taskSeq,
          incidentSeq: snapshot.incidentSeq,
          decisionSeq: snapshot.decisionSeq,
          version: snapshot.version ?? state.version,
          syncStatus: source === "server" ? "saved" : state.syncStatus,
          lastSyncedAt: source === "server" ? Date.now() : state.lastSyncedAt,
          syncMeta:
            source === "server"
              ? { baseline: snapshot, pending: null }
              : state.syncMeta,
        })),

      addAudit: (input) =>
        set((state) => ({
          audit: [makeAudit(input), ...state.audit].slice(0, MAX_AUDIT),
        })),

      createTask: (input) => {
        const seq = get().taskSeq;
        const now = Date.now();
        const task: Task = {
          id: `WR-${YEAR}-${pad(seq)}`,
          title: input.title,
          status: "TODO",
          priority: input.priority ?? "P2",
          department: input.department ?? "unassigned",
          owner: input.owner ?? "orchestrator",
          dependencies: input.dependencies ?? [],
          approvalRequired: input.approvalRequired ?? false,
          risk: input.risk ?? "LOW",
          deliverables: input.deliverables ?? [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ tasks: [...s.tasks, task], taskSeq: seq + 1 }));
        get().addAudit({
          actor: get().actor(),
          action: "task.create",
          target: task.id,
          detail: task.title,
        });
        return task;
      },

      updateTaskStatus: (id, status) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, status, updatedAt: Date.now() } : t,
          ),
        }));
        get().addAudit({
          actor: get().actor(),
          action: "task.status",
          target: id,
          detail: status,
        });
      },

      assignTask: (id, department, owner) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, department, owner, updatedAt: Date.now() }
              : t,
          ),
        }));
        get().addAudit({
          actor: get().actor(),
          action: "task.assign",
          target: id,
          detail: `${department} → ${owner}`,
        });
      },

      createIncident: (input) => {
        const seq = get().incidentSeq;
        const incident: Incident = {
          id: `WR-INC-${pad(seq)}`,
          title: input.title,
          severity: input.severity ?? "HIGH",
          asset: input.asset ?? "unknown",
          status: "OPEN",
          detectedAt: Date.now(),
          actions: ["Triage awal dijalankan oleh Security Agent"],
        };
        set((s) => ({ incidents: [...s.incidents, incident], incidentSeq: seq + 1 }));
        get().addAudit({
          actor: get().actor(),
          action: "incident.create",
          target: incident.id,
          detail: `${incident.severity} · ${incident.title}`,
        });
        return incident;
      },

      updateIncidentStatus: (id, status) => {
        set((s) => ({
          incidents: s.incidents.map((i) =>
            i.id === id ? { ...i, status } : i,
          ),
        }));
        get().addAudit({
          actor: get().actor(),
          action: "incident.status",
          target: id,
          detail: status,
        });
      },

      addIncidentAction: (id, action) => {
        set((s) => ({
          incidents: s.incidents.map((i) =>
            i.id === id ? { ...i, actions: [...i.actions, action] } : i,
          ),
        }));
        get().addAudit({
          actor: get().actor(),
          action: "incident.action",
          target: id,
          detail: action,
        });
      },

      createDecision: (input) => {
        const seq = get().decisionSeq;
        const decision: Decision = {
          id: `WR-DEC-${pad(seq)}`,
          title: input.title,
          status: "PENDING",
          requestedBy: input.requestedBy,
          risk: input.risk ?? "MEDIUM",
          createdAt: Date.now(),
        };
        set((s) => ({
          decisions: [...s.decisions, decision],
          decisionSeq: seq + 1,
        }));
        get().addAudit({
          actor: get().actor(),
          action: "decision.create",
          target: decision.id,
          detail: decision.title,
        });
        return decision;
      },

      setDecisionStatus: (id, status) => {
        set((s) => ({
          decisions: s.decisions.map((d) =>
            d.id === id ? { ...d, status } : d,
          ),
        }));
        get().addAudit({
          actor: get().actor(),
          action: `decision.${status.toLowerCase()}`,
          target: id,
        });
      },

      clearAll: () =>
        set((state) => ({
          tasks: [],
          incidents: [],
          decisions: [],
          audit: [makeAudit({ actor: get().actor(), action: "state.clear" }), ...state.audit],
          taskSeq: 1,
          incidentSeq: 1,
          decisionSeq: 1,
        })),
    }),
    {
      name: STORAGE_KEY,
      skipHydration: true,
      partialize: (s) => ({
        tasks: s.tasks,
        incidents: s.incidents,
        decisions: s.decisions,
        audit: s.audit,
        taskSeq: s.taskSeq,
        incidentSeq: s.incidentSeq,
        decisionSeq: s.decisionSeq,
        version: s.version,
      }),
    },
  ),
);

export function snapshotOf(s: OfficeStore): OfficeSnapshot {
  return {
    tasks: s.tasks,
    incidents: s.incidents,
    decisions: s.decisions,
    audit: s.audit,
    taskSeq: s.taskSeq,
    incidentSeq: s.incidentSeq,
    decisionSeq: s.decisionSeq,
    version: s.version,
  };
}
