import { getDbConfig, query } from "./db";
import { getKvConfig, kvCommand } from "./kv";

/**
 * Event Bus — Phase D (Connect Redis / Event Bus).
 *
 * Kontrak event mengikuti Section 12-13 master prompt:
 * - Event IMMUTABLE: state baru = event baru, tidak pernah mengubah event lama.
 * - Durabilitas (Section 35): event kritis disimpan dulu (Postgres
 *   `system_events`, bila DATABASE_URL diisi) sebelum didistribusikan.
 * - Distribusi: PUBLISH ke channel Redis (Upstash REST) bila tersedia —
 *   dikonsumsi WebSocket server / worker (Phase E). Tanpa Redis, event
 *   tetap terekam; ring in-memory dipakai untuk sinkronisasi dev.
 * - Dedup (Section 48): event_id UNIQUE — event dengan ID sama hanya
 *   diproses sekali (ON CONFLICT DO NOTHING).
 *
 * publishEvent TIDAK PERNAH throw (Section 58 failure isolation).
 */

/** Channel conceptual per Section 12. */
export const EVENT_CHANNELS = {
  AGENT_CONNECTED: "webrent.agents",
  AGENT_DISCONNECTED: "webrent.agents",
  AGENT_STATUS_CHANGED: "webrent.agents",
  AGENT_MOVED: "webrent.agents",

  TASK_CREATED: "webrent.tasks",
  TASK_ASSIGNED: "webrent.tasks",
  TASK_ACKNOWLEDGED: "webrent.tasks",
  TASK_STARTED: "webrent.tasks",
  TASK_PROGRESS: "webrent.tasks",
  TASK_COMPLETED: "webrent.tasks",
  TASK_FAILED: "webrent.tasks",

  MEETING_CREATED: "webrent.office",
  MEETING_STARTED: "webrent.office",
  MEETING_ENDED: "webrent.office",

  INCIDENT_CREATED: "webrent.incidents",
  INCIDENT_UPDATED: "webrent.incidents",
  INCIDENT_ESCALATED: "webrent.incidents",
  INCIDENT_RESOLVED: "webrent.incidents",

  SECURITY_ALERT: "webrent.events",

  INTEGRATION_CONNECTED: "webrent.integrations",
  INTEGRATION_DISCONNECTED: "webrent.integrations",
} as const;

export type EventType = keyof typeof EVENT_CHANNELS;

export type EventActorType = "SYSTEM" | "AGENT" | "HUMAN" | "SERVICE";
export type EventEntityType =
  | "AGENT"
  | "TASK"
  | "INCIDENT"
  | "MEETING"
  | "INTEGRATION"
  | "OFFICE";

export interface EventBusActor {
  type: EventActorType;
  id: string;
}

export interface EventBusEntity {
  type: EventEntityType;
  id: string;
}

/** Kontrak event standar (Section 13). */
export interface OfficeEvent {
  id: string;
  type: string;
  version: number;
  timestamp: string;
  source: string;
  actor: EventBusActor;
  entity: EventBusEntity | null;
  data: unknown;
  correlation_id: string | null;
  causation_id: string | null;
  request_id: string | null;
}

const DEFAULT_SOURCE = "webrent-api";
const EVENT_VERSION = 1;
const RING_CAPACITY = 500;

// Ring in-memory: dedup by id (Map menjaga urutan insert). Fallback dev.
// Disimpan di globalThis agar semua route bundle Next.js dalam satu proses
// berbagi ring yang sama (module instance per-bundle tidak menjamin share).
type EventRing = Map<string, OfficeEvent>;
const ringHost = globalThis as { __webrentEventRing?: EventRing };
const ring: EventRing = (ringHost.__webrentEventRing ??= new Map());

function remember(event: OfficeEvent): void {
  if (ring.has(event.id)) return;
  ring.set(event.id, event);
  if (ring.size > RING_CAPACITY) {
    const oldest = ring.keys().next().value;
    if (oldest !== undefined) ring.delete(oldest);
  }
}

export function channelFor(type: string): string {
  return EVENT_CHANNELS[type as EventType] ?? "webrent.events";
}

export function newEventId(): string {
  return `evt_${crypto.randomUUID()}`;
}

export interface PublishInput {
  type: string;
  entity?: EventBusEntity | null;
  data?: unknown;
  actor?: EventBusActor;
  /** Dipakai ulang bila caller sudah punya id (dedup Section 48). */
  eventId?: string;
  requestId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  source?: string;
}

export interface PublishResult {
  event: OfficeEvent;
  /** Tersimpan durabel (Postgres) — termasuk bila sebelumnya sudah ada. */
  persisted: boolean;
  /** Terkirim ke channel Redis. */
  distributed: boolean;
  /** Event dengan id sama sudah pernah ada (proses sekali saja). */
  duplicate: boolean;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    if (Array.isArray(value)) {
      for (const item of value) deepFreeze(item);
    } else {
      for (const key of Object.getOwnPropertyNames(value)) {
        deepFreeze((value as Record<string, unknown>)[key]);
      }
    }
  }
  return value;
}

function buildEvent(input: PublishInput): OfficeEvent {
  let data: unknown;
  try {
    // Clone agar mutasi objek caller setelah publish tidak memengaruhi event.
    data = structuredClone(input.data ?? {});
  } catch {
    data = JSON.parse(JSON.stringify(input.data ?? {})) as unknown;
  }
  return deepFreeze({
    id: input.eventId ?? newEventId(),
    type: input.type,
    version: EVENT_VERSION,
    timestamp: new Date().toISOString(),
    source: input.source?.trim() || DEFAULT_SOURCE,
    actor: input.actor ?? { type: "SYSTEM", id: "api-gateway" },
    entity: input.entity ?? null,
    data,
    correlation_id: input.correlationId ?? input.requestId ?? null,
    causation_id: input.causationId ?? null,
    request_id: input.requestId ?? null,
  });
}

async function persistToPostgres(event: OfficeEvent): Promise<{ ok: boolean; duplicate: boolean }> {
  const result = await query(
    `INSERT INTO system_events
       (event_id, type, version, source, actor_type, actor_id,
        entity_type, entity_id, data, correlation_id, causation_id, request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.id,
      event.type,
      event.version,
      event.source,
      event.actor.type,
      event.actor.id,
      event.entity?.type ?? null,
      event.entity?.id ?? null,
      JSON.stringify(event.data ?? {}),
      event.correlation_id,
      event.causation_id,
      event.request_id,
    ],
  );
  return { ok: true, duplicate: (result.rowCount ?? 0) === 0 };
}

async function publishToRedis(event: OfficeEvent): Promise<boolean> {
  const kv = getKvConfig();
  if (!kv) return false;
  try {
    await kvCommand(kv, [
      "PUBLISH",
      channelFor(event.type),
      JSON.stringify(event),
    ]);
    return true;
  } catch (err) {
    console.warn("[eventBus] PUBLISH Redis gagal:", err);
    return false;
  }
}

/** Publikasikan event: durabel dulu, lalu distribusi. Tidak pernah throw. */
export async function publishEvent(input: PublishInput): Promise<PublishResult> {
  const event = buildEvent(input);

  // Dedup in-memory selalu (proses sekali — Section 48).
  const duplicateInMemory = ring.has(event.id);
  remember(event);

  let persisted = duplicateInMemory;
  let duplicate = duplicateInMemory;

  if (getDbConfig()) {
    try {
      const res = await persistToPostgres(event);
      persisted = res.ok;
      duplicate = duplicate || res.duplicate;
    } catch (err) {
      console.warn("[eventBus] persist event gagal:", err);
      persisted = duplicateInMemory;
    }
  }

  const distributed = await publishToRedis(event);

  return { event, persisted, distributed, duplicate };
}

export interface RecentEventsFilter {
  /** Ambil event dengan id urutan > sinceId (resync Section 56). */
  sinceId?: number;
  type?: string;
  limit?: number;
}

/** Event terbaru (urut lama→baru) untuk sinkronisasi klien. */
export async function recentEvents(
  filter: RecentEventsFilter = {},
): Promise<OfficeEvent[]> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);

  if (getDbConfig()) {
    try {
      const result = await query<{
        event_id: string;
        type: string;
        version: number;
        source: string;
        actor_type: string;
        actor_id: string;
        entity_type: string | null;
        entity_id: string | null;
        data: unknown;
        correlation_id: string | null;
        causation_id: string | null;
        request_id: string | null;
        created_at: string | Date;
      }>(
        `SELECT event_id, type, version, source, actor_type, actor_id,
                entity_type, entity_id, data, correlation_id, causation_id,
                request_id, created_at
         FROM system_events
         WHERE ($1::bigint IS NULL OR id > $1::bigint)
           AND ($2::text IS NULL OR type = $2::text)
         ORDER BY id ASC
         LIMIT $3`,
        [filter.sinceId ?? null, filter.type ?? null, limit],
      );
      return result.rows.map((row) => ({
        id: row.event_id,
        type: row.type,
        version: row.version,
        timestamp: new Date(row.created_at).toISOString(),
        source: row.source,
        actor: { type: row.actor_type as EventActorType, id: row.actor_id },
        entity:
          row.entity_type && row.entity_id
            ? { type: row.entity_type as EventEntityType, id: row.entity_id }
            : null,
        data: row.data,
        correlation_id: row.correlation_id,
        causation_id: row.causation_id,
        request_id: row.request_id,
      }));
    } catch (err) {
      console.warn("[eventBus] baca event dari Postgres gagal:", err);
    }
  }

  const events = [...ring.values()];
  const filtered = filter.type
    ? events.filter((e) => e.type === filter.type)
    : events;
  if (filter.sinceId === undefined) return filtered.slice(-limit);
  // Ring in-memory tidak menyimpan sequence DB; sinceId diabaikan pada
  // fallback — klien sinkron ulang dari daftar terakhir.
  return filtered.slice(-limit);
}

export interface EventBusStatus {
  /** Lapisan durabilitas aktif. */
  durable: "postgres" | "memory";
  /** Lapisan distribusi aktif. */
  distribution: "redis" | "none";
}

export function getEventBusStatus(): EventBusStatus {
  return {
    durable: getDbConfig() ? "postgres" : "memory",
    distribution: getKvConfig() ? "redis" : "none",
  };
}

/** Kosongkan ring (untuk test). */
export function clearEventBus(): void {
  ring.clear();
}
