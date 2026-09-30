export type Vec2 = [number, number];

export type NpcState = "idle" | "wander" | "chatting";

export type DepartmentId =
  | "executive"
  | "operations"
  | "product"
  | "engineering"
  | "devops"
  | "security"
  | "sales"
  | "marketing"
  | "support"
  | "finance"
  | "analytics"
  | "ux"
  | "documentation";

export interface AgentRegistryEntry {
  department: DepartmentId;
  name: string;
  status: "active" | "unavailable";
}

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  department: DepartmentId;
  /** Kode singkat untuk legenda minimap, mis. "CEO". */
  code: string;
  color: string;
  accent: string;
  greeting: string;
  systemPrompt: string;
  /** Area yang disukai NPC saat berkeliaran (koordinat x, z). */
  waypoints: Vec2[];
}

export interface NpcRuntime {
  state: NpcState;
  position: Vec2;
  facing: number;
}

export type ChatMessageKind = "chat" | "command";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: ChatMessageKind;
}

export interface ChatRequestBody {
  npcId: string;
  messages: Pick<ChatMessage, "role" | "content">[];
}

export type TaskStatus =
  | "TODO"
  | "PLANNING"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "REVIEW"
  | "APPROVAL_REQUIRED"
  | "APPROVED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Priority = "P0" | "P1" | "P2" | "P3";

/** Asal usul entitas (Section 11 master prompt). */
export type EntitySource = "OFFICE" | "TELEGRAM" | "RAVEN" | "API";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  department: DepartmentId | "unassigned";
  owner: string;
  dependencies: string[];
  approvalRequired: boolean;
  risk: RiskLevel;
  deliverables: string[];
  createdAt: number;
  updatedAt: number;
  /** Diisi bila task dibuat lewat integrasi (opsional, entitas lama tak punya). */
  source?: EntitySource;
}

export type IncidentStatus = "OPEN" | "CONTAINED" | "RESOLVED";

export interface Incident {
  id: string;
  title: string;
  severity: RiskLevel;
  asset: string;
  status: IncidentStatus;
  detectedAt: number;
  actions: string[];
  /** Diisi bila insiden dibuat lewat integrasi (opsional). */
  source?: EntitySource;
}

export type DecisionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Decision {
  id: string;
  title: string;
  status: DecisionStatus;
  requestedBy: string;
  risk: RiskLevel;
  createdAt: number;
}

export interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
}

export interface CommandResult {
  output: string;
}

export type Role = "founder" | "guest" | DepartmentId;

export interface AuthStatus {
  authEnabled: boolean;
  authenticated: boolean;
  role: Role;
}
