/**
 * Integration Registry — Section 24 master prompt.
 *
 * Status integrasi + heartbeat terakhir. State in-proses (globalThis agar
 * dibagi antar route bundle); di serverless multi-instance tiap instance
 * melihat heartbeat-nya sendiri — lapisan durabel (Postgres `integrations`,
 * Phase C) menyusul saat env aktif; pelaporan tetap jujur.
 *
 * Status: CONNECTED | CONNECTING | DEGRADED | DISCONNECTED | ERROR | DISABLED
 */

export type IntegrationStatus =
  | "CONNECTED"
  | "CONNECTING"
  | "DEGRADED"
  | "DISCONNECTED"
  | "ERROR"
  | "DISABLED";

export interface IntegrationEntry {
  id: string;
  name: string;
  type: string;
  status: IntegrationStatus;
  lastHeartbeat: number | null;
  version: string | null;
  capabilities: string[];
  /** TTL heartbeat (ms) — 0 = tanpa expiry. */
  heartbeatTtlMs: number;
}

const DEFAULT_TTL_MS = 90_000;

function defaults(): Map<string, IntegrationEntry> {
  return new Map<string, IntegrationEntry>([
    [
      "raven",
      {
        id: "raven",
        name: "Raven Security",
        type: "SECURITY_AGENT",
        status: "DISCONNECTED",
        lastHeartbeat: null,
        version: null,
        capabilities: [],
        heartbeatTtlMs: DEFAULT_TTL_MS,
      },
    ],
    [
      "telegram",
      {
        id: "telegram",
        name: "Telegram Bot",
        type: "NOTIFICATION",
        status: "DISABLED",
        lastHeartbeat: null,
        version: null,
        capabilities: [],
        heartbeatTtlMs: 0,
      },
    ],
  ]);
}

type RegistryHost = { __webrentIntegrations?: Map<string, IntegrationEntry> };
const registry: Map<string, IntegrationEntry> =
  ((globalThis as RegistryHost).__webrentIntegrations ??= defaults());

export function getIntegration(id: string): IntegrationEntry | null {
  return registry.get(id) ?? null;
}

/** Status efektif: heartbeat kadaluarsa → DISCONNECTED (Section 8/55). */
export function effectiveStatus(id: string): IntegrationStatus {
  const entry = registry.get(id);
  if (!entry) return "DISCONNECTED";
  if (
    entry.status === "CONNECTED" &&
    entry.heartbeatTtlMs > 0 &&
    entry.lastHeartbeat !== null &&
    Date.now() - entry.lastHeartbeat > entry.heartbeatTtlMs
  ) {
    return "DISCONNECTED";
  }
  return entry.status;
}

export function setIntegrationStatus(
  id: string,
  status: IntegrationStatus,
): void {
  const entry = registry.get(id);
  if (entry) entry.status = status;
}

export function registerIntegration(payload: {
  id: string;
  version?: string;
  capabilities?: string[];
}): IntegrationEntry | null {
  const entry = registry.get(payload.id);
  if (!entry) return null;
  entry.version = payload.version ?? entry.version;
  entry.capabilities = payload.capabilities ?? entry.capabilities;
  entry.status = "CONNECTED";
  entry.lastHeartbeat = Date.now();
  return entry;
}

/** Catat heartbeat: status CONNECTED + lastHeartbeat sekarang. */
export function recordHeartbeat(id: string, version?: string): boolean {
  const entry = registry.get(id);
  if (!entry) return false;
  entry.status = "CONNECTED";
  entry.lastHeartbeat = Date.now();
  if (version) entry.version = version;
  return true;
}

/** Daftar registry dalam bentuk respons API (Section 24). */
export function listIntegrations(): Array<{
  id: string;
  name: string;
  type: string;
  status: IntegrationStatus;
  last_heartbeat: string | null;
  version: string | null;
  capabilities: string[];
}> {
  return [...registry.values()].map((entry) => {
    const status =
      entry.id === "raven" ? effectiveStatus("raven") : entry.status;
    return {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      status,
      last_heartbeat:
        entry.lastHeartbeat === null
          ? null
          : new Date(entry.lastHeartbeat).toISOString(),
      version: entry.version,
      capabilities: entry.capabilities,
    };
  });
}

/** Reset ke default (untuk test). */
export function resetIntegrations(): void {
  for (const [id, entry] of defaults()) registry.set(id, entry);
}
