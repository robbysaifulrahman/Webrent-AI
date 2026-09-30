---
type: reference
title: Integration API — Phase A–H
updated: 2026-09-30
tags: [webrent, integration, api, arsitektur]
---

# Integration API — Phase A–H

> Sumber kebenaran: `docs/architecture/integration.md` +
> `docs/integration-master-prompt.md` (67 section, tersimpan verbatim).
> Prinsip: **server = source of truth**, kantor 3D hanya visualisasi,
> tanpa fake state (LIVE/DEMO jujur).

## Status fase

| Fase | Isi | Status |
|---|---|---|
| A | Prompt global Section #34 (`src/data/integration.ts`) | ✅ |
| B | API state layer (envelope, request_id, idempotency, health) | ✅ |
| C | Driver PostgreSQL (`db/migrations/`, `scripts/migrate.mjs`) | ✅ standby |
| D | Event bus (Postgres durable + PUBLISH Redis, fallback memori) | ✅ standby |
| E | Realtime SSE `/api/v1/events/stream` + klien + indikator | ✅ |
| F | Raven (HMAC, heartbeat, incident pipeline) | ✅ standby |
| G | Telegram (webhook, command engine, notifikasi admin) | ✅ standby |
| H | Mode LIVE/DEMO jujur (`src/lib/mode.ts`) | ✅ |
| I | Matikan simulasi saat LIVE | ⏳ produksi |

"Standby" = kode siap, aktif otomatis bila env diisi
(`DATABASE_URL`, `RAVEN_SERVICE_SECRET`, `TELEGRAM_BOT_TOKEN`, dst.).

## Endpoint utama

- `GET /api/v1/health` · `/health/live` · `/health/ready` — health check
- `GET /api/v1/system/status` — status sistem + database + event bus + mode
- `GET /api/v1/office/state` — snapshot kantor (Section 16, `server_time`)
- `GET /api/v1/integrations` — registry integrasi (Section 24)
- `GET /api/v1/events` — event bus (resync klien, `?since=&type=&limit=`)
- `GET /api/v1/events/stream` — realtime SSE (Section 14/15)
- `POST /api/v1/integrations/raven/register|heartbeat|events|tasks`
- `POST /api/v1/integrations/telegram/webhook` — command engine (Section 19)
- `POST /api/v1/dev/events/*` — event sink dev/staging (404 di produksi)

## Event bus (Section 12–13)

- 22 tipe event → 7 channel: `webrent.{events,agents,tasks,incidents,office,integrations,notifications}`
- Event immutable (freeze + clone), dedup `event_id`, durabilitas dulu baru distribusi
- Kontrak: `{ id, type, version, timestamp, source, actor, entity, data, correlation_id, causation_id, request_id }`

## Keamanan

- Raven: HMAC-SHA256 `timestamp.body` + window ±5 menit (anti-replay)
- Telegram: secret header timing-safe; mutasi = admin chat saja
- Kredensial hanya via env — tidak pernah masuk repo

[[WebRent Office]] · [[Office Layout]]
