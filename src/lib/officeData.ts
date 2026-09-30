import type { AuditEntry, Decision, Incident, Task } from "@/types";

export const OFFICE_STORAGE_KEY = "webrent-office-v1";
export const SERVER_STATE_KEY = "webrent-office-state-v1";
export const YEAR = new Date().getFullYear();

export interface OfficeSnapshot {
  tasks: Task[];
  incidents: Incident[];
  decisions: Decision[];
  audit: AuditEntry[];
  taskSeq: number;
  incidentSeq: number;
  decisionSeq: number;
  /** Versi state untuk optimistic concurrency control. */
  version: number;
}

export const MAX_AUDIT = 200;

export function pad(n: number, width = 4): string {
  return String(n).padStart(width, "0");
}

export function seedSnapshot(): OfficeSnapshot {
  const now = Date.now();
  return {
    tasks: [
      {
        id: `WR-${YEAR}-0001`,
        title: "Siapkan monitoring uptime kantor",
        status: "TODO",
        priority: "P1",
        department: "devops",
        owner: "devops-agent",
        dependencies: [],
        approvalRequired: false,
        risk: "LOW",
        deliverables: ["dashboard", "alerting"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `WR-${YEAR}-0002`,
        title: "Draf paket website restoran",
        status: "PLANNING",
        priority: "P1",
        department: "product",
        owner: "product-agent",
        dependencies: [],
        approvalRequired: false,
        risk: "LOW",
        deliverables: ["package_definition", "feature_list"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `WR-${YEAR}-0003`,
        title: "Tinjau ulang struktur harga paket baru",
        status: "APPROVAL_REQUIRED",
        priority: "P0",
        department: "finance",
        owner: "finance-agent",
        dependencies: [`WR-${YEAR}-0002`],
        approvalRequired: true,
        risk: "HIGH",
        deliverables: ["pricing_analysis"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    incidents: [],
    decisions: [
      {
        id: `WR-DEC-${pad(1)}`,
        title: "Perubahan harga paket restoran",
        status: "PENDING",
        requestedBy: "finance-agent",
        risk: "HIGH",
        createdAt: now,
      },
    ],
    audit: [
      {
        id: `AUD-seed-1`,
        at: now,
        actor: "system",
        action: "office.init",
        target: "webrent-office",
        detail: "State awal dimuat dari seed",
      },
    ],
    taskSeq: 4,
    incidentSeq: 1,
    decisionSeq: 2,
    version: 1,
  };
}
