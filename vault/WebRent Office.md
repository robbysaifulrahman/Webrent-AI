---
type: index
title: WebRent Office — Knowledge Base
generated: 2026-09-30
tags: [webrent, export, snapshot]
---

# WebRent Office — Knowledge Base

> Snapshot vault yang digenerate dari kantor virtual 3D (13 agent online).
> Status operasional: **ONLINE**. Data operasional nyata: `DATA_NOT_AVAILABLE`.
> Integrasi API: **Phase A–H tereksekusi** — lihat [[Integration API]].
> Denah kantor 34×28 + riwayat perbaikan: [[Office Layout]].

## Integration (Phase A–H)

- API Gateway: `/api/v1/*` — envelope `{ success, data|error, meta.request_id }`
- Realtime: `GET /api/v1/events/stream` (SSE) — indikator live di Top Bar
- Event bus: durabel Postgres + PUBLISH Redis, fallback ring memori
- Raven Security: channel HMAC `POST /api/v1/integrations/raven/*`
- Telegram Bot: webhook + command engine (`/status`, `/tasks`, `/raven`, …)
- Mode kantor: **DEMO** (LIVE aktif bila `OFFICE_MODE=LIVE` + backend bersama)

## Agents (13 online)

- [[Agents/CEO Agent|CEO Agent]] — Executive
- [[Agents/COO Agent|COO Agent]] — Operations
- [[Agents/Product Manager Agent|Product Manager Agent]] — Product
- [[Agents/CTO Engineering Agent|CTO Engineering Agent]] — Engineering
- [[Agents/DevOps Agent|DevOps Agent]] — DevOps
- [[Agents/Security Agent|Security Agent]] — Security
- [[Agents/Sales Agent|Sales Agent]] — Sales
- [[Agents/Marketing Agent|Marketing Agent]] — Marketing
- [[Agents/Customer Support Agent|Customer Support Agent]] — Customer Support
- [[Agents/Finance Agent|Finance Agent]] — Finance
- [[Agents/Data Analyst Agent|Data Analyst Agent]] — Data & Analytics
- [[Agents/UI UX Agent|UI UX Agent]] — UI / UX
- [[Agents/Documentation Agent|Documentation Agent]] — Documentation

## Tasks

- [[Tasks/WR-2026-0001|WR-2026-0001]] — Siapkan monitoring uptime kantor (TODO)
- [[Tasks/WR-2026-0002|WR-2026-0002]] — Draf paket website restoran (PLANNING)
- [[Tasks/WR-2026-0003|WR-2026-0003]] — Tinjau ulang struktur harga paket baru (APPROVAL_REQUIRED)

## Incidents

- (belum ada insiden aktif)

## Decisions

- [[Decisions/WR-DEC-0001|WR-DEC-0001]] — Perubahan harga paket restoran (PENDING)

## Reports & Reference

- [[Audit Log]]
- [[Incident Response]]
- [[Product Roadmap]]
- [[Engineering]]
- [[Customer Support]]
- [[Integration API]]
- [[Office Layout]]
