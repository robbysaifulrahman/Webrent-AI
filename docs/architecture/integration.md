# WebRent AI Office — Integration Hub, Phase A-H (DOCS ONLY)

Status: Phase A-H SUDAH dieksekusi & terverifikasi (lint/test/build OK,
health 200).
- A: prompt global Section #34 (`src/data/integration.ts`).
- B: API state layer (envelope, request_id, idempotency, health).
- C: driver PostgreSQL (`db/migrations/`, `scripts/migrate.mjs`,
  `src/lib/db.ts`), aktif bila `DATABASE_URL` diisi.
- D: event bus (`src/lib/eventBus.ts`) — durabel Postgres + PUBLISH Redis,
  fallback ring memori; `GET /api/v1/events`.
- E: realtime SSE `GET /api/v1/events/stream` + klien
  `src/lib/realtime.ts` (state machine Section 15) + indikator TopBar;
  native WS aktif otomatis via `NEXT_PUBLIC_WS_URL`.
- F: Raven (`src/lib/raven.ts` + route register/heartbeat/events/status/
  tasks) — HMAC + anti-replay, incident pipeline (Section 9/10),
  registry heartbeat TTL (Section 55).
- G: Telegram (`src/lib/telegram.ts` + webhook) — command engine
  (baca = chat terdaftar, mutasi = admin), notifikasi admin utk insiden.
- H: mode LIVE/DEMO jujur (`src/lib/mode.ts`) — LIVE hanya bila backend
  bersama (KV/Postgres) aktif; tampil di /office/state, /system/status,
  registry, dan badge TopBar.
Semua service tanpa env → DISABLED/DISCONNECTED (tidak pernah fake).
Phase I (matikan simulasi di LIVE) belum — bersama eksekusi produksi.
Master Prompt penuh (67 section) milik user tersimpan verbatim di
`docs/integration-master-prompt.md` + `src/data/integration.ts`
(sebagai Section #34 global — tidak diduplikasi di sini).

## Keputusan terkunci
- Tetap Vercel (DEMO + staging). VPS 2C/2GB Ubuntu 24.04 standby, belum migrasi.
- Scope: Phase A+B saja. Denah 34×28 (docs/office/layout-34x28.md) dikerjakan dulu.
- LLM runtime: `webrent/glm-5.3-flash` via `http://43.173.13.193:20128/v1`
  (terverifikasi: ada di `/v1/models`, `chat/completions` OK).
  Slot `LLM_MODEL_STRONG=webrent/glm-5.3` disiapkan, belum dipakai.
- Server = source of truth. 3D = visual client. Tidak ada fake state (LIVE jujur,
  selama ini badge DEMO).

## Phase A — Prompt global (tanpa risiko)
- Baru `src/data/integration.ts`: `WEBRENT_INTEGRATION_MASTER_PROMPT`
  (verbatim) + `INTEGRATION_PROMPT_VERSION`.
- Ubah `src/data/orchestrator.ts`: import + append `# 34.` di
  `buildNpcSystemPrompt()`. `api/chat/route.ts` otomatis global 13 agent.
- Server-side only, tidak bocor ke klien.

## Phase B — API state layer (stateless, Vercel-safe)
- Baru `src/lib/apiResponse.ts` (envelope success/data/meta.request_id),
  `src/lib/requestId.ts`, `src/lib/idempotency.ts` (header `Idempotency-Key` via KV).
- Baru (stub, tanpa WS/DB/Worker):
  - `GET /api/v1/health`, `GET /api/v1/health/live`, `GET /api/v1/health/ready`
  - `GET /api/v1/system/status`
  - `GET /api/v1/office/state` (baca snapshot existing)
  - `GET /api/v1/integrations` → `raven: DISCONNECTED`, `telegram: DISABLED`
- `docs/openapi.yaml`: stub 4 route di atas. Full spec (agents/tasks/incidents/
  websocket/telegram/raven) menyusul fase berikutnya, bukan sekarang.
- Raven: belum ada `RAVEN_API_URL/SECRET` → stub + `POST /api/v1/dev/events/*`
  hanya dev/staging. Telegram: route webhook dibuat disabled sampai
  `TELEGRAM_BOT_TOKEN/WEBHOOK_SECRET` diisi di `.env` (tidak di-commit).

## Yang TIDAK dikerjakan di A+B
- WebSocket native, Postgres, Redis pub/sub, worker, reverse proxy, Docker.
- Perubahan visual 3D/minimap selain overlay status yang sudah ada.
- Kredensial apa pun di repo (env only).

## Verifikasi saat eksekusi
`npm run lint`, `npm run test` (38 test harus pass), `npm run build`,
cek `GET /api/v1/health` + prompt Section #34 ter-load 1 NPC sample.
