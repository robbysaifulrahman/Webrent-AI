-- ============================================================
-- WebRent AI Office — Phase C: Connect PostgreSQL
-- Migrasi 0001: skema inti (Master Prompt Section 30, subset Phase C).
--
-- Prinsip:
-- - Semua timestamp disimpan UTC (timestamptz), ditampilkan Asia/Jakarta.
-- - Idempotent (IF NOT EXISTS) — aman dijalankan berulang.
-- - Append-only: audit_logs, system_events, *_events tidak pernah di-UPDATE.
-- - Tabel meeting/telegram/websocket/positions menyusul di fase E/F/G
--   sesuai migration strategy (Section 62).
--
-- Jalankan: node scripts/migrate.mjs  (butuh DATABASE_URL)
-- ============================================================

-- ------------------------------------------------------------
-- State snapshot kantor (driver "postgres" di serverStore).
-- Single-row; CAS via version (Section 48 concurrency).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS office_state (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version    BIGINT NOT NULL DEFAULT 1,
  payload    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Agents (Section 7/49; registry + presence minimal Phase C)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
  id              TEXT PRIMARY KEY,              -- agent_raven
  name            TEXT NOT NULL,
  role            TEXT NOT NULL,
  department      TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'AI_AGENT',
  status          TEXT NOT NULL DEFAULT 'OFFLINE',
  availability    TEXT NOT NULL DEFAULT 'AVAILABLE',
  current_task_id TEXT,
  room_id         TEXT,
  position        JSONB,
  supervisor_id   TEXT,
  capabilities    JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_seen       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_department ON agents (department);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);

-- ------------------------------------------------------------
-- Tasks (Section 11)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,                 -- task_xxx
  title        TEXT NOT NULL,
  description  TEXT,
  priority     TEXT NOT NULL DEFAULT 'P2',       -- P0 | P1 | P2
  status       TEXT NOT NULL DEFAULT 'CREATED',  -- lifecycle Section 11
  created_by   TEXT,
  assigned_to  TEXT,                             -- agents.id bila agent
  department   TEXT,
  source       TEXT NOT NULL DEFAULT 'OFFICE',   -- OFFICE | TELEGRAM | RAVEN | API
  approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks (department);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);

-- ------------------------------------------------------------
-- Incidents (Section 9/10)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
  id          TEXT PRIMARY KEY,                  -- inc_xxx
  title       TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'MEDIUM',    -- LOW | MEDIUM | HIGH | CRITICAL
  status      TEXT NOT NULL DEFAULT 'OPEN',
  source      TEXT NOT NULL DEFAULT 'OFFICE',
  asset       TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents (severity);

-- ------------------------------------------------------------
-- Decisions (approval system, Section 40)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decisions (
  id           TEXT PRIMARY KEY,                 -- dec_xxx
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
  risk         TEXT NOT NULL DEFAULT 'LOW',
  requested_by TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions (status);

-- ------------------------------------------------------------
-- Integrations (registry + heartbeat, Section 8/24)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integrations (
  id             TEXT PRIMARY KEY,               -- raven | telegram
  name           TEXT NOT NULL,
  type           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'DISCONNECTED',
  last_heartbeat TIMESTAMPTZ,
  version        TEXT,
  capabilities   JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ------------------------------------------------------------
-- Event log & audit (append-only; Section 13/31/35)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_events (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id       TEXT NOT NULL UNIQUE,           -- evt_xxx
  type           TEXT NOT NULL,                  -- TASK_CREATED, SECURITY_ALERT, ...
  version        INTEGER NOT NULL DEFAULT 1,
  source         TEXT NOT NULL DEFAULT 'webrent-api',
  actor_type     TEXT NOT NULL DEFAULT 'SYSTEM',
  actor_id       TEXT NOT NULL DEFAULT 'api-gateway',
  entity_type    TEXT,
  entity_id      TEXT,
  data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT,
  causation_id   TEXT,
  request_id     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events (type);
CREATE INDEX IF NOT EXISTS idx_system_events_entity ON system_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_events_correlation ON system_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events (created_at);

CREATE TABLE IF NOT EXISTS task_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor      TEXT,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events (task_id);

CREATE TABLE IF NOT EXISTS incident_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  actor       TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON incident_events (incident_id);

CREATE TABLE IF NOT EXISTS integration_events (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,                  -- INTEGRATION_CONNECTED / DISCONNECTED
  data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_events_integration ON integration_events (integration_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_id      TEXT NOT NULL UNIQUE,            -- audit_xxx
  actor         TEXT NOT NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  request_id    TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
