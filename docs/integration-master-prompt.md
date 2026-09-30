============================================================
WEBRENT AI OFFICE
INTEGRATION API MASTER PROMPT
============================================================

IMPORTANT:

THIS IS A CONTINUATION OF THE PREVIOUS WEBRENT AI OFFICE
ARCHITECTURE.

DO NOT DELETE, RESET, REPLACE, OR SIMPLIFY THE EXISTING SYSTEM.

DO NOT REBUILD THE 3D OFFICE FROM ZERO.

DO NOT REMOVE EXISTING:
- office layout
- rooms
- minimap
- organization map
- agents
- CEO character
- agent movement
- pathfinding
- task engine
- realtime state
- activity feed
- meeting system
- incident system
- status system
- office clock
- LIVE/DEMO mode
- existing UI
- existing backend architecture

EXTEND THE EXISTING SYSTEM.

The objective of this phase is to create a REAL INTEGRATION
ARCHITECTURE so WebRent AI Office can communicate with:

1. WebRent VPS
2. Raven Security VPS
3. Telegram Bot
4. Database
5. Redis / Event Bus
6. WebSocket clients
7. Future AI agents and external services

The WebRent AI Office must become an integration-aware,
server-authoritative, event-driven virtual company system.

============================================================
1. PRIMARY ARCHITECTURE
============================================================

Implement the following logical architecture:

                    ┌─────────────────────────┐
                    │       CEO / HUMAN       │
                    │       WEB BROWSER       │
                    └────────────┬────────────┘
                                 │
                                 │ HTTPS / WSS
                                 ▼
                    ┌─────────────────────────┐
                    │   WEBRENT AI OFFICE UI  │
                    │  3D OFFICE / DASHBOARD  │
                    └────────────┬────────────┘
                                 │
                                 │ REST / WebSocket
                                 ▼
              ┌────────────────────────────────────┐
              │       WEBRENT API GATEWAY          │
              │                                    │
              │ Authentication                     │
              │ Authorization                      │
              │ API Routing                        │
              │ Event Processing                   │
              │ Rate Limiting                      │
              │ Audit Logging                      │
              │ Idempotency                        │
              │ Integration Registry               │
              └───────┬──────────┬──────────┬──────┘
                      │          │          │
                      │          │          │
             ┌────────▼───┐ ┌────▼────┐ ┌──▼──────────┐
             │ WebRent    │ │ Raven   │ │ Telegram    │
             │ Backend    │ │ VPS     │ │ Bot         │
             └────────────┘ └─────────┘ └─────────────┘
                      │          │          │
                      └──────────┼──────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     EVENT BUS / REDIS   │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┼────────────────┐
                 │               │                │
                 ▼               ▼                ▼
          ┌────────────┐ ┌─────────────┐ ┌──────────────┐
          │ PostgreSQL │ │ Task Engine │ │ Agent Engine │
          └────────────┘ └─────────────┘ └──────────────┘

The API Gateway is the primary integration boundary.

DO NOT allow arbitrary direct communication between services.

Preferred architecture:

Raven VPS
      ↓
WebRent API Gateway
      ↓
Event Bus
      ↓
Database / Task Engine / Agent Engine
      ↓
WebSocket
      ↓
3D Virtual Office

Telegram:

Telegram
   ↓
Telegram Webhook
   ↓
WebRent API Gateway
   ↓
Command Processor
   ↓
Task / Agent / Incident / Approval
   ↓
Event Bus
   ↓
3D Office + Telegram response

============================================================
2. CORE PRINCIPLE
============================================================

The server is the SOURCE OF TRUTH.

The 3D office is a VISUALIZATION CLIENT.

The 3D office must NEVER become the authoritative source
for:

- agent status
- task status
- incident status
- security state
- task ownership
- permissions
- approvals
- timestamps
- integration state

The 3D frontend only renders server state.

Example:

SERVER:

agent.raven.status = "ALERT"

Frontend:

Raven character changes animation
Raven moves to SOC
Raven workstation changes state
Activity feed updates
Minimap updates
Notification appears

But the frontend does not independently decide:

"Raven is ALERT."

The server decides this.

============================================================
3. ENVIRONMENT ARCHITECTURE
============================================================

Support at minimum:

DEVELOPMENT
STAGING
PRODUCTION

Example:

Development:

localhost

Staging:

api-staging.webrent.id
office-staging.webrent.id

Production:

api.webrent.id
office.webrent.id

Raven:

raven VPS
Raven Agent API

Telegram:

Telegram Bot API
Telegram Webhook

Never hardcode:

- API keys
- bot tokens
- JWT secrets
- database passwords
- Redis passwords
- Raven credentials
- webhook secrets
- private keys

Everything must come from environment variables or
a secure secrets mechanism.

============================================================
4. API VERSIONING
============================================================

Use versioned APIs.

Base:

/api/v1

Examples:

GET    /api/v1/agents
GET    /api/v1/agents/:id
POST   /api/v1/agents/:id/tasks

GET    /api/v1/tasks
POST   /api/v1/tasks
GET    /api/v1/tasks/:id

GET    /api/v1/incidents
POST   /api/v1/incidents

GET    /api/v1/office/state

GET    /api/v1/office/agents

GET    /api/v1/integrations

GET    /api/v1/health

GET    /api/v1/system/status

Use semantic API versioning.

Do not introduce breaking changes into /api/v1
without explicit migration strategy.

============================================================
5. OPENAPI 3.1
============================================================

Create a complete OpenAPI 3.1 specification.

File:

/docs/openapi.yaml

The specification must document:

- authentication
- agents
- tasks
- incidents
- meetings
- office state
- events
- integrations
- Telegram webhook
- Raven Agent API
- health checks
- system status

Every endpoint must document:

- method
- path
- parameters
- request body
- response
- error responses
- authentication requirements
- required scopes

Generate API documentation from OpenAPI.

============================================================
6. API RESPONSE STANDARD
============================================================

Use a consistent response structure.

Success:

{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "req_xxx",
    "timestamp": "ISO-8601"
  }
}

Error:

{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found",
    "details": {}
  },
  "meta": {
    "request_id": "req_xxx",
    "timestamp": "ISO-8601"
  }
}

Every request should receive a request_id.

Propagate request_id across services.

============================================================
7. AGENT API
============================================================

Create:

/api/v1/agents

Support:

GET /api/v1/agents

GET /api/v1/agents/:id

POST /api/v1/agents

PATCH /api/v1/agents/:id

DELETE /api/v1/agents/:id

POST /api/v1/agents/:id/connect

POST /api/v1/agents/:id/disconnect

POST /api/v1/agents/:id/tasks

GET /api/v1/agents/:id/tasks

GET /api/v1/agents/:id/events

Agent object:

{
  "id": "agent_raven",
  "name": "Raven",
  "role": "Security Engineer",
  "department": "Security",
  "type": "AI_AGENT",
  "status": "ONLINE",
  "availability": "AVAILABLE",
  "current_task_id": null,
  "room_id": "room_soc",
  "position": {
    "x": 12.4,
    "y": 0,
    "z": -4.8
  },
  "supervisor_id": null,
  "capabilities": [
    "security_monitoring",
    "incident_response",
    "threat_analysis"
  ],
  "last_seen": "ISO-8601"
}

Agent status must be state-machine controlled.

Example:

OFFLINE
CONNECTING
ONLINE
IDLE
WORKING
MEETING
MOVING
ALERT
PAUSED
ERROR
DISCONNECTED

============================================================
8. RAVEN VPS INTEGRATION
============================================================

Raven is an external security service.

Raven must NOT directly manipulate the WebRent database.

Raven communicates through the WebRent Integration API.

Create an authenticated Raven service channel.

Example:

POST /api/v1/integrations/raven/register

POST /api/v1/integrations/raven/heartbeat

POST /api/v1/integrations/raven/events

POST /api/v1/integrations/raven/tasks

GET  /api/v1/integrations/raven/status

GET  /api/v1/integrations/raven/tasks/:id

Raven registration payload:

{
  "service": "raven",
  "version": "2.x",
  "environment": "production",
  "hostname": "...",
  "capabilities": [
    "security_monitoring",
    "threat_detection",
    "incident_response"
  ]
}

Raven heartbeat:

{
  "service": "raven",
  "status": "ONLINE",
  "timestamp": "ISO-8601",
  "uptime": 123456,
  "version": "2.x"
}

If heartbeat stops:

Raven status becomes:

DISCONNECTED

The office visualization must reflect this.

============================================================
9. RAVEN SECURITY EVENT
============================================================

Raven may send:

SECURITY_ALERT

Example:

{
  "event": "SECURITY_ALERT",
  "severity": "HIGH",
  "source": "raven",
  "timestamp": "ISO-8601",
  "target": {
    "type": "SERVER",
    "id": "webrent-vps-01"
  },
  "details": {
    "category": "ANOMALOUS_ACTIVITY",
    "description": "Suspicious network activity detected"
  }
}

WebRent must:

1. Validate the event
2. Authenticate Raven
3. Generate request_id
4. Check idempotency
5. Store event
6. Create incident if required
7. Update Raven state
8. Update affected agent states
9. Publish event
10. Broadcast through WebSocket
11. Notify Telegram if severity threshold is met
12. Display incident in 3D office

============================================================
10. SECURITY INCIDENT PIPELINE
============================================================

Example:

Raven detects anomaly

        ↓

SECURITY_ALERT

        ↓

WebRent API Gateway

        ↓

Validation

        ↓

Incident Engine

        ↓

INCIDENT_CREATED

        ↓

Event Bus

        ↓
 ┌──────┼───────────────┐
 │      │               │
 ▼      ▼               ▼
3D     Telegram       Database
Office Notification   Audit Log

Then:

Raven moves to SOC.

Incident Response agent becomes:

ALERT / WORKING

DevOps may receive:

TASK_CREATED

CEO sees:

"Security Incident Detected"

with:

- severity
- affected asset
- timestamp
- incident ID
- current status
- assigned agent
- recommended action
- evidence availability

Do not expose sensitive secrets or raw credentials
in the frontend.

============================================================
11. TASK API
============================================================

Create:

GET    /api/v1/tasks
POST   /api/v1/tasks
GET    /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id
POST   /api/v1/tasks/:id/assign
POST   /api/v1/tasks/:id/start
POST   /api/v1/tasks/:id/progress
POST   /api/v1/tasks/:id/complete
POST   /api/v1/tasks/:id/fail
POST   /api/v1/tasks/:id/cancel

Task structure:

{
  "id": "task_xxx",
  "title": "...",
  "description": "...",
  "priority": "P1",
  "status": "ASSIGNED",
  "created_by": "ceo",
  "assigned_to": "agent_raven",
  "department": "security",
  "source": "TELEGRAM",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}

Task lifecycle:

CREATED
QUEUED
ASSIGNED
ACKNOWLEDGED
STARTED
IN_PROGRESS
BLOCKED
COMPLETED
FAILED
CANCELLED

Every transition produces an event.

============================================================
12. REALTIME EVENT BUS
============================================================

Use Redis or equivalent event bus.

Recommended conceptual channels:

webrent.events
webrent.agents
webrent.tasks
webrent.incidents
webrent.office
webrent.integrations
webrent.notifications

Events must be immutable.

Do not modify an old event.

Create a new event for a new state.

============================================================
13. EVENT CONTRACT
============================================================

Standard event:

{
  "id": "evt_xxx",
  "type": "AGENT_STATUS_CHANGED",
  "version": 1,
  "timestamp": "ISO-8601",
  "source": "webrent-api",
  "actor": {
    "type": "SYSTEM",
    "id": "api-gateway"
  },
  "entity": {
    "type": "AGENT",
    "id": "agent_raven"
  },
  "data": {},
  "correlation_id": "corr_xxx",
  "request_id": "req_xxx"
}

Support event versioning.

Examples:

AGENT_CONNECTED
AGENT_DISCONNECTED
AGENT_STATUS_CHANGED
AGENT_MOVED

TASK_CREATED
TASK_ASSIGNED
TASK_ACKNOWLEDGED
TASK_STARTED
TASK_PROGRESS
TASK_COMPLETED
TASK_FAILED

MEETING_CREATED
MEETING_STARTED
MEETING_ENDED

INCIDENT_CREATED
INCIDENT_UPDATED
INCIDENT_ESCALATED
INCIDENT_RESOLVED

SECURITY_ALERT

INTEGRATION_CONNECTED
INTEGRATION_DISCONNECTED

============================================================
14. WEBSOCKET
============================================================

Create a realtime WebSocket endpoint:

wss://api.webrent.id/ws/office

The 3D office connects to this endpoint.

WebSocket responsibilities:

- agent movement
- agent status
- task state
- incident state
- meeting state
- office clock
- activity feed
- integration status
- security alerts

Example event:

{
  "type": "AGENT_MOVED",
  "data": {
    "agent_id": "agent_raven",
    "room_id": "room_soc",
    "position": {
      "x": 10,
      "y": 0,
      "z": -4
    }
  }
}

Frontend receives event.

Frontend updates:

Raven's physical location.

The frontend must NOT create fake state.

============================================================
15. WEBSOCKET RECONNECTION
============================================================

Implement:

CONNECTED
RECONNECTING
DISCONNECTED
SYNCING
READY

When connection is lost:

Display:

REALTIME OFFLINE

When connection returns:

1. reconnect
2. authenticate
3. request current state
4. synchronize missing events
5. update local state
6. return to LIVE

Never leave stale state silently.

============================================================
16. OFFICE STATE API
============================================================

Create:

GET /api/v1/office/state

Response:

{
  "office": {
    "status": "LIVE",
    "server_time": "ISO-8601",
    "timezone": "Asia/Jakarta"
  },
  "agents": [],
  "tasks": [],
  "incidents": [],
  "meetings": [],
  "integrations": []
}

The initial 3D scene must load from server state.

Then WebSocket maintains realtime updates.

============================================================
17. REALTIME OFFICE CLOCK
============================================================

The office clock must be server-authoritative.

Do NOT rely exclusively on:

new Date()

from the browser.

Server provides:

server_time

and optionally:

server_epoch

The frontend calculates display time based on server synchronization.

Timezone:

Asia/Jakarta

The office should display:

- current time
- date
- realtime status

Example:

14:32:08 WIB

LIVE

============================================================
18. TELEGRAM INTEGRATION
============================================================

Create:

POST /api/v1/webhooks/telegram

Telegram communicates with WebRent through this webhook.

Do not expose Telegram bot token to frontend.

Use a secret webhook validation mechanism.

Validate:

- webhook secret
- request authenticity
- command permissions
- user/chat authorization
- rate limits
- command parameters

============================================================
19. TELEGRAM COMMAND ENGINE
============================================================

Implement a command parser.

Minimum commands:

/start
/help

/office
/status
/briefing

/agents
/agent <id>

/tasks
/task <id>

/incidents
/incident <id>

/meetings

/integrations
/integration <name>

/raven
/raven status

/health

For CEO/admin users:

/task create
/task assign
/task cancel

/incident acknowledge
/incident resolve

/approve <id>
/reject <id>

Commands must pass through authorization.

Do not assume every Telegram user is CEO.

============================================================
20. TELEGRAM → OFFICE FLOW
============================================================

Example:

CEO:

/status

Telegram
   ↓
Webhook
   ↓
API Gateway
   ↓
Authorization
   ↓
Office State Service
   ↓
Response

Example response:

WEBRENT AI OFFICE

Office: LIVE
Agents: 13 ONLINE
Tasks: 7 ACTIVE
Incidents: 1 HIGH
Raven: ONLINE
Realtime: CONNECTED

============================================================
21. TELEGRAM → TASK FLOW
============================================================

CEO:

/task create Audit WebRent VPS P1

Flow:

Telegram
↓
Webhook
↓
Command Parser
↓
Authorization
↓
Task Engine
↓
Task Created
↓
Event Bus
↓
Agent Assignment
↓
Agent State Update
↓
WebSocket
↓
3D Office

The corresponding agent must visibly react.

For example:

Agent receives task.

Agent status:

IDLE → MOVING → WORKING

Agent walks toward appropriate workstation.

Activity feed:

"Raven received task TASK-001"

============================================================
22. RAVEN → TELEGRAM FLOW
============================================================

Example:

Raven detects HIGH severity security event.

Flow:

Raven VPS
↓
Raven Integration API
↓
API Gateway
↓
Validation
↓
Incident Engine
↓
INCIDENT_CREATED
↓
Event Bus
↓
3D Office
↓
Telegram

Telegram notification:

🚨 SECURITY INCIDENT

Severity: HIGH
Source: Raven
Asset: WebRent VPS
Incident: INC-001
Status: OPEN

Assigned Agent:
Raven

Timestamp:
14:32 WIB

Open Office:
[optional Telegram button]

============================================================
23. RAVEN → 3D OFFICE FLOW
============================================================

When Raven reports:

SECURITY_ALERT

The virtual office should visually react.

Possible sequence:

1. Raven status becomes ALERT
2. Raven workstation changes state
3. Raven moves toward SOC
4. SOC room becomes active
5. Incident indicator appears
6. Activity feed updates
7. CEO receives notification
8. Telegram notification is generated
9. Incident panel becomes available

The animation is driven by backend events.

============================================================
24. INTEGRATION REGISTRY
============================================================

Create integration registry.

Example:

GET /api/v1/integrations

Response:

[
  {
    "id": "raven",
    "name": "Raven Security",
    "type": "SECURITY_AGENT",
    "status": "CONNECTED",
    "last_heartbeat": "ISO-8601",
    "version": "2.x"
  },
  {
    "id": "telegram",
    "name": "Telegram Bot",
    "type": "NOTIFICATION",
    "status": "CONNECTED"
  }
]

Possible statuses:

CONNECTED
CONNECTING
DEGRADED
DISCONNECTED
ERROR
DISABLED

============================================================
25. HEALTH CHECK SYSTEM
============================================================

Implement:

GET /api/v1/health

GET /api/v1/health/live

GET /api/v1/health/ready

GET /api/v1/system/status

Health checks:

- API
- PostgreSQL
- Redis
- WebSocket
- Task Engine
- Agent Engine
- Raven
- Telegram
- Event Bus

Example:

{
  "status": "DEGRADED",
  "services": {
    "api": "UP",
    "database": "UP",
    "redis": "UP",
    "websocket": "UP",
    "raven": "UP",
    "telegram": "DOWN"
  }
}

Do not report overall status as HEALTHY if critical
dependencies are unavailable.

============================================================
26. AUTHENTICATION
============================================================

Implement service-to-service authentication.

Supported concepts:

- JWT
- service API keys
- HMAC signatures
- short-lived access tokens
- optional mTLS

Each integration must have an identity.

Examples:

service:
webrent-office

service:
raven-security

service:
telegram-bot

service:
worker-task-engine

Never use one universal secret for every service.

============================================================
27. AUTHORIZATION
============================================================

Implement RBAC + scopes.

Roles:

CEO
ADMIN
OPERATOR
SECURITY
DEVOPS
AGENT
VIEWER
SYSTEM

Example scopes:

office:read
office:write

agents:read
agents:write

tasks:read
tasks:create
tasks:assign
tasks:cancel

incidents:read
incidents:create
incidents:resolve

raven:read
raven:write

telegram:send

system:read

Do not give Raven unrestricted access to the entire
WebRent system.

Use least privilege.

============================================================
28. REQUEST SECURITY
============================================================

Every service request should support:

request_id
timestamp
authentication
authorization
rate limiting
idempotency

For sensitive service-to-service communication:

Use HMAC signatures or equivalent.

Include protection against:

- replay attacks
- duplicated events
- forged events
- expired requests
- unauthorized service calls

Reject expired timestamps.

============================================================
29. IDEMPOTENCY
============================================================

Implement idempotency for operations such as:

- task creation
- incident creation
- payment-related operations
- Telegram command actions
- Raven security events

Example header:

Idempotency-Key: xxx

If the same operation arrives twice:

Do not create duplicate task/incident.

============================================================
30. DATABASE
============================================================

Extend PostgreSQL schema.

Recommended tables:

users

roles

permissions

services

service_credentials

agents

agent_capabilities

agent_sessions

agent_positions

tasks

task_assignments

task_events

incidents

incident_events

meetings

meeting_participants

office_rooms

office_positions

office_events

integrations

integration_events

system_events

audit_logs

telegram_users

telegram_chats

websocket_sessions

notifications

Create proper indexes.

Use foreign keys where appropriate.

Store timestamps in UTC.

Display in Asia/Jakarta.

============================================================
31. AUDIT LOG
============================================================

Every sensitive operation must be auditable.

Examples:

CEO created task
Raven generated alert
Agent assigned task
Incident escalated
Telegram command executed
Admin changed permission
Integration connected
Integration disconnected

Audit log:

{
  "id": "audit_xxx",
  "actor": "agent_raven",
  "action": "INCIDENT_CREATED",
  "resource_type": "INCIDENT",
  "resource_id": "inc_001",
  "timestamp": "ISO-8601",
  "request_id": "req_xxx",
  "metadata": {}
}

Audit logs should be append-only.

============================================================
32. EVENT CORRELATION
============================================================

Implement:

request_id

correlation_id

causation_id

Example:

Telegram command:

/incident acknowledge INC-001

creates:

request_id:
req_001

correlation_id:
corr_001

event:

INCIDENT_ACKNOWLEDGED

causation_id:

telegram_command_event_id

This allows tracing:

Telegram
→ API
→ Incident
→ Event Bus
→ Raven
→ WebSocket
→ Office

============================================================
33. OBSERVABILITY
============================================================

Implement structured logs.

Every log should contain:

timestamp
level
service
request_id
correlation_id
event_type
message

Example:

{
  "timestamp": "...",
  "level": "INFO",
  "service": "api-gateway",
  "request_id": "req_001",
  "event_type": "TASK_CREATED",
  "message": "Task created"
}

Support:

INFO
WARN
ERROR
DEBUG

Never log:

- passwords
- API keys
- Telegram bot tokens
- JWT secrets
- private keys
- sensitive credentials

============================================================
34. RATE LIMITING
============================================================

Implement rate limits.

Separate limits for:

- public API
- authenticated users
- Telegram
- Raven
- internal services
- WebSocket connection

Do not allow Telegram webhook or Raven event endpoint
to be abused to generate unlimited events.

============================================================
35. EVENT DELIVERY GUARANTEES
============================================================

Define delivery behavior.

For critical events:

Use durable event persistence.

Critical examples:

SECURITY_ALERT
INCIDENT_CREATED
INCIDENT_ESCALATED
TASK_CREATED
TASK_FAILED

The system must not silently lose these events.

If WebSocket is temporarily unavailable:

Store event.

When client reconnects:

Synchronize current state and missing events.

============================================================
36. FRONTEND SECURITY
============================================================

Never expose:

Raven credentials
database credentials
Telegram bot token
service secrets
JWT signing secrets

to the browser.

Frontend only receives data that the current user
is authorized to see.

============================================================
37. REALTIME UI INDICATORS
============================================================

Add a visible integration status layer.

Example:

TOP BAR:

● LIVE
API: ONLINE
WS: CONNECTED
RAVEN: ONLINE
TELEGRAM: ONLINE
REDIS: ONLINE

If disconnected:

RAVEN: OFFLINE

Do not hide integration failures.

The CEO should immediately understand whether the office
is connected to the real backend.

============================================================
38. OFFICE EVENT FEED
============================================================

The activity feed must consume backend events.

Example:

14:31 Raven connected
14:31 Task assigned to DevOps
14:32 Raven detected security anomaly
14:32 Incident INC-001 created
14:32 CEO notified
14:33 Raven moved to SOC
14:33 Incident investigation started

Do not generate fake feed entries.

Every entry must originate from an event.

============================================================
39. OFFICE ACTIONS
============================================================

When CEO interacts with the 3D office:

Examples:

Click Raven
→ GET agent details

Approach Raven
→ proximity information

Click task
→ GET task details

Click incident
→ GET incident details

Click room
→ GET room state

Click integration
→ GET integration status

Every interaction should use API state where required.

============================================================
40. APPROVAL SYSTEM
============================================================

Some actions require CEO approval.

Example:

Agent proposes:

"Restart WebRent VPS"

Status:

WAITING_FOR_APPROVAL

Telegram:

/approve TASK-123

or UI:

[Approve]
[Reject]

After approval:

APPROVED

Then task execution can continue.

Do not allow agents to bypass approval gates.

============================================================
41. COMMAND SAFETY
============================================================

High-risk commands must not be executed simply because
they arrived through Telegram.

Require:

authentication
authorization
scope
approval
audit log

Potentially destructive operations should require
explicit confirmation.

Example:

/restart server-01

Response:

⚠️ CONFIRMATION REQUIRED

Target:
server-01

Action:
restart

Use:

/confirm <request_id>

============================================================
42. API DOCUMENTATION
============================================================

Create:

/docs/api/

Include:

README.md
architecture.md
authentication.md
websocket.md
events.md
telegram.md
raven.md
deployment.md
security.md
troubleshooting.md

Also generate:

OpenAPI documentation.

============================================================
43. ENVIRONMENT CONFIGURATION
============================================================

Create:

.env.example

Example conceptual variables:

APP_ENV=
APP_URL=
API_URL=
WS_URL=

DATABASE_URL=
REDIS_URL=

JWT_SECRET=
SERVICE_SECRET=

RAVEN_API_URL=
RAVEN_SERVICE_ID=
RAVEN_SERVICE_SECRET=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

WEBHOOK_BASE_URL=

Never put actual secrets into repository.

============================================================
44. DOCKER / DEPLOYMENT
============================================================

Prepare deployment architecture for:

WebRent VPS

Components:

web frontend
API
worker
WebSocket
Redis
PostgreSQL
reverse proxy

Raven remains on separate VPS.

Architecture:

Internet
   ↓
Reverse Proxy
   ↓
WebRent API
   ├── REST
   ├── WebSocket
   ├── Telegram Webhook
   └── Raven Integration

Internal:

API
 ↓
Redis
 ↓
Workers
 ↓
PostgreSQL

Raven:

Raven VPS
 ↓
HTTPS
 ↓
WebRent Integration API

============================================================
45. REVERSE PROXY
============================================================

Prepare configuration for:

api.webrent.id

office.webrent.id

WebSocket support is mandatory.

Example conceptual routes:

/api/*
→ WebRent API

/ws/*
→ WebSocket server

Telegram webhook:
 /api/v1/webhooks/telegram

Use HTTPS.

WebSocket production endpoint:

wss://api.webrent.id/ws/office

============================================================
46. CORS
============================================================

Configure strict CORS.

Allow only trusted WebRent frontend origins.

Do not use:

Access-Control-Allow-Origin: *

in production unless explicitly justified.

============================================================
47. CACHING
============================================================

Use Redis for:

- sessions
- short-lived state
- rate limiting
- event distribution
- locks
- temporary presence state

PostgreSQL remains persistent source of truth.

Do not treat Redis as the permanent database.

============================================================
48. CONCURRENCY
============================================================

Prevent race conditions.

Examples:

Two commands attempt to assign the same task.

Only one assignment should succeed.

Two Raven events with same ID arrive.

Only one should be processed.

Two users attempt incident resolution.

Use:

transactions
optimistic locking
idempotency
distributed locks where appropriate

============================================================
49. AGENT PRESENCE
============================================================

Agents should have presence information.

Example:

{
  "agent_id": "agent_raven",
  "presence": "ONLINE",
  "last_seen": "...",
  "session_id": "...",
  "current_room": "room_soc",
  "current_task": "task_001"
}

Presence updates should propagate to 3D office.

============================================================
50. REALTIME AGENT MOVEMENT
============================================================

Agent movement must be synchronized.

Backend:

AGENT_MOVED

Frontend:

receive event

validate event

update target position

animate movement

Do not continuously send every animation frame
to the server.

Use server-authoritative logical position/state
while frontend handles smooth interpolation.

============================================================
51. DEMO MODE VS LIVE MODE
============================================================

Preserve existing DEMO mode.

DEMO:

Simulated agents
Simulated tasks
Simulated events

LIVE:

Real API
Real database
Real Raven
Real Telegram
Real WebSocket

UI must clearly display:

DEMO

or

LIVE

Never mix fake and real events without explicit labeling.

============================================================
52. INTEGRATION TEST MODE
============================================================

Create test endpoints or internal tools for development.

Example:

POST /api/v1/dev/events/security-alert

POST /api/v1/dev/events/task-created

POST /api/v1/dev/events/agent-moved

These must only work in:

development
staging

Never expose them in production.

============================================================
53. TEST SCENARIO
============================================================

Create an end-to-end test:

SCENARIO:

Raven detects suspicious activity.

STEP 1:

Raven sends SECURITY_ALERT.

STEP 2:

API validates Raven.

STEP 3:

Event stored.

STEP 4:

Incident created.

STEP 5:

Raven agent status becomes ALERT.

STEP 6:

Raven moves to SOC.

STEP 7:

SOC room becomes active.

STEP 8:

CEO receives WebSocket notification.

STEP 9:

Telegram notification sent.

STEP 10:

Incident appears in dashboard.

STEP 11:

CEO acknowledges incident.

STEP 12:

Raven continues investigation.

STEP 13:

Incident becomes RESOLVED.

STEP 14:

3D office returns to normal state.

STEP 15:

Telegram receives resolution notification.

Every step must be traceable using:

request_id
correlation_id
event_id

============================================================
54. SECOND TEST SCENARIO
============================================================

CEO creates task from Telegram.

CEO:

/task create "Audit WebRent API" P1

Flow:

Telegram
↓
Webhook
↓
Authorization
↓
Task Engine
↓
Task Created
↓
Agent Assignment
↓
WebSocket
↓
3D Agent Movement
↓
Agent Working
↓
Progress Events
↓
Task Completed
↓
Telegram Completion

The 3D office must visually represent this lifecycle.

============================================================
55. THIRD TEST SCENARIO
============================================================

Raven becomes disconnected.

Expected:

Heartbeat expires.

Integration state:

RAVEN = DISCONNECTED

3D UI:

Raven status:
OFFLINE

Integration panel:

Raven:
DISCONNECTED

Activity:

"Raven security service disconnected."

Telegram:

⚠️ Raven disconnected.

When Raven reconnects:

RAVEN = ONLINE

Telegram:

✅ Raven reconnected.

3D office:

Raven returns to ONLINE.

============================================================
56. FOURTH TEST SCENARIO
============================================================

WebSocket disconnects.

Expected:

3D office:

REALTIME OFFLINE

Then reconnect.

Expected:

RECONNECTING

Then:

SYNCING

Then:

LIVE

Fetch:

GET /api/v1/office/state

Then apply missing events.

No duplicated agents.

No duplicated tasks.

No inconsistent state.

============================================================
57. API ERROR HANDLING
============================================================

Standard HTTP statuses:

200
201
202
204

400
401
403
404
409
422
429

500
502
503
504

Use meaningful internal error codes.

Examples:

RAVEN_UNAUTHORIZED
RAVEN_OFFLINE
AGENT_NOT_FOUND
TASK_NOT_FOUND
TASK_ALREADY_ASSIGNED
INCIDENT_NOT_FOUND
INSUFFICIENT_SCOPE
APPROVAL_REQUIRED
INTEGRATION_UNAVAILABLE

============================================================
58. FAILURE ISOLATION
============================================================

If Telegram fails:

WebRent office must continue functioning.

If Raven fails:

WebRent office must continue functioning.

If WebSocket fails:

REST API must continue functioning.

If Redis fails:

Critical operations should fail safely or use
fallback mechanisms where designed.

Do not allow one integration failure to crash
the entire office.

============================================================
59. SECURITY BOUNDARY
============================================================

Raven is a security service.

WebRent is the application/control plane.

Telegram is a remote interface.

3D Office is a visualization interface.

Do not blur these responsibilities.

Architecture:

Raven
=
Security Detection / Response

WebRent
=
Orchestration / State / Business Logic

Telegram
=
Remote Command / Notification

3D Office
=
Visualization / Human Interaction

============================================================
60. FUTURE EXTENSIBILITY
============================================================

Design the Integration API so additional services can
be connected later.

Potential future agents:

Zero
DevOps Agent
Finance Agent
Sales Agent
Support Agent
Marketing Agent
Data Agent
AI Content Agent
Compliance Agent

They should connect using the same:

Agent Contract
Service Identity
Event Contract
Task Contract
WebSocket
REST API
Authentication
Authorization

Do not create a completely different API for each agent.

============================================================
61. SERVICE REGISTRY
============================================================

Create service registry.

Example:

services:

web-rent-api
web-rent-office
task-engine
agent-engine
raven-security
telegram-bot
notification-service
worker

Each service has:

service_id
name
version
status
last_heartbeat
capabilities

============================================================
62. MIGRATION STRATEGY
============================================================

Do not break existing demo functionality.

Implement:

PHASE A:

Existing office continues working.

PHASE B:

Introduce API state layer.

PHASE C:

Connect PostgreSQL.

PHASE D:

Connect Redis.

PHASE E:

Enable WebSocket.

PHASE F:

Connect Raven.

PHASE G:

Connect Telegram.

PHASE H:

Enable LIVE mode.

PHASE I:

Disable simulated events in LIVE mode.

============================================================
63. ACCEPTANCE CRITERIA
============================================================

The implementation is NOT complete until:

[ ] REST API exists
[ ] OpenAPI exists
[ ] WebSocket exists
[ ] PostgreSQL integration exists
[ ] Redis/event bus exists
[ ] Agent API exists
[ ] Task API exists
[ ] Incident API exists
[ ] Office State API exists
[ ] Integration registry exists
[ ] Health checks exist
[ ] Authentication exists
[ ] Authorization exists
[ ] Audit logs exist
[ ] Request IDs exist
[ ] Correlation IDs exist
[ ] Idempotency exists
[ ] Rate limiting exists
[ ] Raven integration exists
[ ] Telegram webhook exists
[ ] Telegram command engine exists
[ ] Realtime event propagation exists
[ ] Reconnection exists
[ ] State resynchronization exists
[ ] LIVE/DEMO separation exists
[ ] Security boundaries exist
[ ] Environment configuration exists
[ ] Deployment documentation exists
[ ] Integration tests exist

============================================================
64. FINAL SYSTEM FLOW
============================================================

The final architecture should behave like:

                HUMAN CEO
                    │
        ┌───────────┴───────────┐
        │                       │
     3D OFFICE              TELEGRAM
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
             WEBRENT API
                    │
        ┌───────────┼─────────────┐
        │           │             │
        ▼           ▼             ▼
      AGENTS      TASKS        INCIDENTS
        │           │             │
        └───────────┼─────────────┘
                    │
                    ▼
               EVENT BUS
                    │
          ┌─────────┼──────────┐
          │         │          │
          ▼         ▼          ▼
       Raven      Workers   Notifications
          │
          ▼
    SECURITY EVENTS
          │
          ▼
      WEBRENT API
          │
          ├──────────► Database
          │
          ├──────────► Redis
          │
          ├──────────► Telegram
          │
          └──────────► WebSocket
                           │
                           ▼
                     3D OFFICE
                           │
                           ▼
                    HUMAN CEO

============================================================
65. MOST IMPORTANT RULE
============================================================

THE 3D OFFICE MUST NOT BE A MOCKUP.

The office visualization must represent actual backend
state whenever LIVE mode is enabled.

If Raven is offline:

The office shows Raven offline.

If Raven reports an incident:

The office shows the incident.

If a task is assigned:

The corresponding agent receives it.

If an agent moves:

The 3D office reflects the movement.

If Telegram creates a task:

The task appears in the office.

If CEO approves an action:

The backend records the approval and the agent proceeds.

If WebSocket disconnects:

The UI reports the connection state.

If the API is unavailable:

The UI reports the backend failure.

Never fake successful integration.

============================================================
66. IMPLEMENTATION INSTRUCTION
============================================================

Before writing code:

1. Inspect the existing project.
2. Identify frontend architecture.
3. Identify backend architecture.
4. Identify database architecture.
5. Identify current agent model.
6. Identify current task model.
7. Identify current office state model.
8. Identify existing realtime implementation.
9. Identify existing authentication.
10. Identify existing environment configuration.

Then create an implementation plan.

Do not duplicate existing modules.

Reuse existing services wherever possible.

Then implement incrementally.

After implementation:

1. Run type checking.
2. Run lint.
3. Run unit tests.
4. Run integration tests.
5. Run API tests.
6. Test WebSocket.
7. Test Telegram webhook in development/staging.
8. Test Raven integration.
9. Test reconnect.
10. Test state synchronization.
11. Test failure isolation.

Fix errors before declaring the phase complete.

============================================================
67. FINAL DELIVERABLE
============================================================

Produce:

/docs/architecture/integration.md

/docs/openapi.yaml

/docs/api/telegram.md

/docs/api/raven.md

/docs/api/websocket.md

/docs/security/integration-security.md

/docs/deployment/integration-deployment.md

/.env.example

Database migrations

API routes

WebSocket implementation

Event definitions

Event handlers

Raven integration adapter

Telegram integration adapter

Integration registry

Health monitoring

Audit logging

Tests

And update the existing 3D office so all realtime
integration states are visible.

============================================================
END OF WEBRENT AI OFFICE
INTEGRATION API MASTER PROMPT
============================================================
