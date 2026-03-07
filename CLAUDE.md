# Bulwark v2.1 — Developer Guide

## Overview
Enterprise server management platform. Express.js + Socket.IO on port 3001.
Vanilla JS frontend — no React, no build step, no bundler.
33 route modules | 16 libs | 35 views | 280+ endpoints | 6 npm deps.
Repo: https://github.com/bulwark-studio/bulwark | License: AGPL-3.0
Git author: Bulwark Studio <hello@bulwark.studio>

## SaaS Deployment Strategy
- **Phase 1:** Stripe (Link + Apple/Google Pay) + Fly.io per-customer containers ($3.72/customer/mo)
- **Phase 2:** Google Cloud Marketplace listing (SaaS, 2% rev share, Google bills customer)
- **Phase 3:** Multi-tenant mode + Coolify/Hetzner for max margin
- **LLC:** Exists. **Stripe:** Exists. Enable Link + Apple Pay + Google Pay (remove `payment_method_types`).
- **Pricing:** Starter $29/mo, Pro $79/mo, Enterprise $199/mo
- **"Deploy to Cloud Run" button:** Free tier funnel — user self-hosts, upsell to hosted
- See `memory/bulwark-saas-strategy.md` for full research

## MCP Server (Built-In, Sandboxed)
- **NOT a desktop tool.** SaaS customers run Bulwark in a cloud container — no local CLI access.
- MCP server is **embedded inside Bulwark** at `POST /mcp` (Streamable HTTP transport).
- Customers connect from Claude Desktop/Code/Cursor/VS Code on their local machine → Bulwark's remote `/mcp` endpoint.
- Each customer's MCP server is isolated in their own container sandbox — tenant-scoped, auth-gated.
- SDK: `@modelcontextprotocol/sdk` + Zod schemas
- Tools expose: system metrics, Docker, DB, uptime, tickets, deploy, security, notifications
- Tool annotations: `readOnlyHint` for safe reads, `destructiveHint` for dangerous actions
- Resources: server overview, uptime checks
- Prompts: diagnose_server, incident_report, security_audit, daily_briefing
- GUI test endpoint: `POST /api/mcp/test` uses InMemoryTransport (bypasses HTTP handshake)
- GUI playground: `/` command bar with fuzzy search, schema-driven param forms, prompt action cards, request log

## Remote Monitoring Agent
- SaaS Bulwark can't monitor localhost (it's a cloud container)
- Customer installs `bulwark-agent` on their server(s): `npx bulwark-agent --key KEY --url URL`
- Agent collects CPU/mem/disk/processes/Docker, POSTs to `/api/agent/report` every 10s
- Dashboard shows THEIR server data, not the container's
- Same model as Datadog/New Relic/Grafana (agent → cloud dashboard)

## Quick Start
```bash
cd dev-monitor && npm install && npm start
# Access: http://localhost:3001
# Default: admin / admin (change immediately)
```

## Bare Metal Install (Ubuntu/Debian)
```bash
# Node.js 22 + PostgreSQL 17 + AI CLIs + Docker
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
sudo npm install -g @anthropic-ai/claude-code @openai/codex pm2
# Optional: PostgreSQL 17, Docker — see docs/getting-started.md
```

## Architecture

### Server (orchestrator)
```
server.js                    → Express + Socket.IO setup, auth middleware, intervals, .env loader
routes/                      → 33 route modules
lib/                         → 13 shared modules
adapter/                     → Proxy to ServerKit (port 4001) for Docker/DB/Security/SSL/Cron/FTP
data/                        → Runtime JSON stores (uptime, notifications, envvars, agents,
                               query-history, saved-queries, settings, audit-log)
```

### .env Loader (built-in, no dotenv dependency)
Custom 6-line parser in server.js reads `dev-monitor/.env` at startup. Sets `process.env[key]` only for keys not already set. Supports `KEY=VALUE` format, ignores comments (#) and blank lines.

### Route Modules (33)
```
auth.js              → Login, logout, session, 2FA setup/verify
system.js            → CPU, memory, disk, processes, server info (dynamic git cwd)
tickets.js           → Support ticket CRUD + Kanban + AI triage + AI analyze
claude.js            → Claude CLI integration, AI terminal, prompt execution
servers.js           → Multi-server management, health checks
docker.js            → Docker adapter proxy (legacy)
docker-direct.js     → Native Docker Engine API (27 endpoints)
databases.js         → Database adapter proxy (legacy)
db-studio.js         → Supabase-style DB management (30+ endpoints, AI-enhanced)
db-projects.js       → Database project management
db-assistant.js      → AI database assistant
security.js          → Security adapter proxy
security-enhanced.js → Enhanced security scanning + reports
ssl.js               → SSL/TLS certificate management
envvars.js           → Environment variable management (legacy)
envvars-enhanced.js  → Enhanced env var management
files.js             → File manager (legacy)
files-enhanced.js    → Enhanced file manager with editor
cron.js              → Cron job management (legacy)
cron-enhanced.js     → Enhanced cron with scheduling UI
ftp.js               → FTP server management
notifications.js     → Notification system
notification-center.js → Enhanced notification center
multi-server.js      → Multi-server aggregation
uptime.js            → Uptime monitoring + checks
git-projects.js      → Dynamic multi-repo management, private repo auth (SSH/HTTPS)
git-enhanced.js      → Git operations, diff, log, branches, AI PR/cleanup/conflicts
deploy.js            → Deployment pipeline, rollback
calendar.js          → Calendar + scheduling with AI
briefing.js          → Daily briefings + AI summaries
cloudflare.js        → Cloudflare DNS/tunnel management
credentials.js       → AES-256-GCM credential vault
mcp.js               → MCP server (Streamable HTTP, 18 tools, 2 resources, 4 prompts) + GUI test endpoint
```

### Lib Modules (16)
```
db.js                → PostgreSQL pools (pool + vpsPool), dbQuery helper
exec.js              → Shell command execution wrapper
ai.js                → AI provider wrapper (askAI, askAIJSON, getAICommand)
rbac.js              → RBAC roles (admin/editor/viewer), requireRole middleware
audit.js             → Structured audit logging, auto-log middleware
adapter-client.js    → HTTP client for adapter service (port 4001)
users.js             → PBKDF2 password hashing, user CRUD (users.json)
totp.js              → TOTP 2FA generation + verification
sessions.js          → Session token management (sessions.json)
metrics-collector.js → System metrics collection (CPU, mem, disk)
uptime-store.js      → Uptime data persistence (JSON)
notification-sender.js → Push notifications via Socket.IO
neural-cache.js      → Intelligent caching layer
cloudflare.js        → Cloudflare API client
docker-engine.js     → Native Docker Engine API client
credential-vault.js  → AES-256-GCM encrypted credential storage
```

### Frontend Extra Modules
```
ai-cache.js          → Reactive AI intelligence layer (content-addressed cache, anomaly detection, freshness badges)
notification-bell.js → Toolbar notification dropdown (poll unread, mark read, dismiss)
```

### Frontend (ViewRegistry pattern)
```
public/
  index.html                 → Shell: head, sidebar, 34 view containers
  css/
    theme.css                → Dimension Dark + CSS variables (glass treatment)
    layout.css               → Glass sidebar, topbar, content grid, status bar
    components.css           → Glass cards, badges, buttons, tables, forms, animations
    kanban.css               → Ticket board styles
    terminal.css             → xterm.js + claude terminal
    modal.css                → Glass modal system
    db-studio.css            → DB Studio views (CodeMirror, two-panel, results tables)
  js/
    app.js                   → State, Socket.IO, view registry, nav, cache, animations
    charts.js                → Chart.js wrappers
    modal.js                 → Modal.open/close/confirm/loading
    toast.js                 → Toast notification system
    views/                   → 35 self-registering view modules
```

### ViewRegistry Pattern
Each view JS file self-registers on `window.Views`:
```javascript
Views.myview = {
  init: function() { /* render HTML template into #view-myview */ },
  show: function() { /* fetch data, called on nav click */ },
  hide: function() { /* cleanup */ },
  update: function(data) { /* handle socket.io updates */ }
};
```

### Modal API
```javascript
// Open a custom modal
Modal.open({ title: 'My Modal', body: '<p>HTML content</p>', footer: '<button>OK</button>', size: 'lg' });

// Confirmation dialog (returns Promise<boolean>)
const confirmed = await Modal.confirm({
  title: 'Delete Item',
  message: 'Are you sure?',
  confirmText: 'Delete',
  dangerous: true  // orange confirm button
});

// Loading state
Modal.loading('Processing...');
Modal.close();
```

### Shared Context (ctx)
Route modules receive `ctx` with: `pool`, `vpsPool`, `dbQuery`, `vpsQuery`, `io`, `execCommand`, `REPO_DIR`, `callAdapter`, `requireAuth`, `requireAdmin`, `requireRole`, `requireAction`, `getSystemInfo`, plus callbacks populated by routes (`getTicketSummary`, `getRecentActivity`, `getProcessList`, `getServerHealth`, `runClaude`, `sendNotification`, `getActiveGitProject`, `getGitCwd`, `getGitEnv`).

## Theme: Dimension Dark (Glass Treatment)

### CSS Variables (defined in theme.css)
- `--canvas: #0a0b10` — deepest background
- `--surface-solid: #0e0e12` — sidebar, topbar base
- `--surface: rgba(14,14,18,0.65)` — glass cards
- `--text-primary: #e4e4e7`, `--text-secondary: #8b8b92`, `--text-tertiary: #52525a` (zinc scale)
- `--border: rgba(255,255,255,0.08)`, `--border-glass: rgba(255,255,255,0.10)`, `--border-top: rgba(255,255,255,0.14)`
- `--cyan: #22d3ee` — success, healthy, active, positive
- `--orange: #ff6b2b` — error, down, warning, destructive

### Glass Treatment
- Sidebar: `rgba(10,10,14,0.70)` + `backdrop-filter: blur(40px) saturate(180%)`
- Topbar: `rgba(14,14,18,0.80)` + `backdrop-filter: blur(20px) saturate(180%)`
- Cards: `backdrop-filter: blur(20px) saturate(180%)` + border-top highlight + inset shadow
- Modals: `rgba(14,14,18,0.85)` + `blur(24px) saturate(180%)`
- CodeMirror CDN (v5.65.16) for SQL Editor with material-darker theme

### Signal System (MANDATORY)
- **Cyan (#22d3ee)** = positive/success/healthy/active/up
- **Orange (#ff6b2b)** = negative/error/warning/destructive/down
- **NEVER use green for success or red for error**

### Fonts
- JetBrains Mono (monospace, primary for code + status bar)
- System font stack for body text

## Socket.IO Events

### Server → Client
| Event | Shape | Interval |
|-------|-------|----------|
| `init` | `{ system, tickets, activity, processes }` | on connect |
| `metrics` | `{ system: {cpuPct, usedMemPct, usedMemMB, totalMemMB, ...}, extended, ts }` | 3s |
| `tickets` | `{ summary: [], tickets: [] }` | 10s |
| `activity` | `{ activity: [] }` | 10s |
| `process_list` | `{ processes: [] }` | 10s |
| `server_health` | `{ servers: [] }` | 30s |
| `claude_output` | string | on claude run |
| `claude_done` | object | on claude finish |
| `terminal_output` | string | on terminal activity |

### Client → Server
| Event | Shape |
|-------|-------|
| `terminal_start` | `{ cols, rows }` |
| `terminal_input` | string |
| `terminal_resize` | `{ cols, rows }` |
| `claude_run` | `{ prompt }` |
| `refresh` | (empty) |

## Database
- PostgreSQL 17 via `lib/db.js`
- `pool` = dev DB (DATABASE_URL), `vpsPool` = VPS DB (VPS_DATABASE_URL)
- Tables: `support_tickets`, `chester_activity`, `cloud_endpoints`
- Works without DB (graceful degradation)

## DB Studio (Supabase-Style Database Management)

### Route: `routes/db-studio.js` (30+ endpoints, direct PG introspection)
All endpoints use `ctx.dbQuery`/`ctx.pool` — NO adapter dependency. Pool selector: `?pool=vps` for VPS DB.

```
GET  /api/db/info                → DB version, size, uptime, connections
GET  /api/db/tables              → All tables: name, schema, row estimate, size
GET  /api/db/tables/:name        → Columns, constraints, indexes, foreign keys
GET  /api/db/tables/:name/rows   → Paginated rows (?limit=50&offset=0&sort=&order=)
POST /api/db/query               → Execute SQL (DDL blocked without ?allow_ddl=true)
GET  /api/db/functions           → pg_proc: name, args, return type, language
GET  /api/db/triggers            → pg_trigger + event_object_table
GET  /api/db/extensions          → pg_extension: name, version, schema
GET  /api/db/indexes             → pg_indexes: table, name, definition, size
GET  /api/db/roles               → pg_roles: name, superuser, login, connections
GET  /api/db/roles/:name/perms   → Table-level permissions for role
GET  /api/db/roles/ai/audit      → AI security audit (Claude analyzes all roles, returns score/findings)
POST /api/db/roles/ai/generate   → AI generates least-privilege role SQL from description
GET  /api/db/migrations          → Applied vs filesystem migrations
GET  /api/db/migrations/pending  → Unapplied migration files
POST /api/db/migrations/run      → Execute migration SQL file
POST /api/db/migrations/test     → Docker test-run (spin up PG, apply, validate, destroy)
POST /api/db/migrations/diff     → Compare live DB vs schema.sql
POST /api/db/backup              → pg_dump to data/backups/
GET  /api/db/backups             → List backup files
GET  /api/db/backups/ai/strategy → AI backup strategy (health score, DR plan, recommendations)
DELETE /api/db/backups/:name     → Delete backup file
POST /api/db/backup/restore      → pg_restore from file
GET  /api/db/query/history       → Last 100 queries from data/query-history.json
POST /api/db/query/save          → Save named query to data/saved-queries.json
GET  /api/db/query/saved         → List saved queries
POST /api/db/claude/generate     → Claude CLI generates SQL from natural language
```

### askClaudeJSON Helper (in db-studio.js)
```javascript
// Executes `claude --print`, parses JSON response with fallback regex extraction
async function askClaudeJSON(prompt) → Promise<object>
```

### SQL Safety Layer
- SELECT/WITH/EXPLAIN: always allowed
- INSERT/UPDATE/DELETE: allowed, logged with warning
- DROP/TRUNCATE/ALTER: blocked without `?allow_ddl=true`
- All queries logged to `data/query-history.json`

### 6 Frontend Views (sidebar "Database" group)
| View | File | Description |
|------|------|-------------|
| SQL Editor | `views/sql-editor.js` | CodeMirror 5 + autocomplete + history + saved queries + Ask Claude |
| Tables | `views/tables.js` | Two-panel: table list + Columns/Data/Constraints/FK/Indexes tabs |
| Schema | `views/schema.js` | Functions, Triggers, Extensions, Indexes tabs |
| Migrations | `views/migrations.js` | Applied/pending status, Docker test-run, schema diff |
| Roles | `views/roles.js` | AI security audit, permission heatmap, AI role generator |
| Backups | `views/db-backups.js` | AI backup strategy, DR plan, age-based health indicators |

## AI Integration (BYOK + CLI Passthrough)

### Architecture
Users bring their own AI subscriptions. The app shells out to locally-installed CLI tools — zero AI cost for the product.

### Supported Providers (Settings > AI Provider)
- **Claude CLI** (`claude --print`) — requires Anthropic subscription
- **Claude Code** (`claude`) — requires Claude Max subscription
- **Codex CLI** (`codex`) — OpenAI's open-source coding agent, requires OpenAI API key
- **None** — AI features disabled, graceful degradation

### AI-Powered Features
- SQL generation from natural language (DB Studio)
- Role security audit with scoring/grading (Roles view)
- Least-privilege role generation (Roles view)
- Backup strategy analysis with DR planning (Backups view)
- Commit message generation (Git view)
- AI PR description generator (Git view)
- AI branch cleanup recommendations (Git view)
- AI merge conflict analysis (Git view)
- AI ticket triage — bulk (Tickets view)
- AI ticket analysis — per-ticket root cause, effort, risk (Tickets view)
- Daily briefing summaries (Briefing view)

## Adapter Pattern
Routes for Docker, Databases, Security, SSL, Cron, FTP proxy through `lib/adapter-client.js` → adapter service (port 4001). When adapter unavailable, returns `{ degraded: true, message: "..." }`.

## Key Conventions
- No npm deps beyond express, socket.io, pg, node-pty, multer
- All management actions use glass modals (Modal.open/confirm)
- Toast notifications for user feedback (Toast.success/error/info/warning)
- Client-side cache with TTL (`window.Cache`, `window.cachedFetch`)
- Animated number transitions (`window.animateValue`)
- `escapeHtml()` for all user-generated content in views
- Sidebar nav groups collapsible, state persisted in localStorage
- Status bar at bottom shows connection, server info, last update time

## Auth
- PBKDF2 password hashing (lib/users.js)
- Session tokens in cookies (`monitor_session`) or Bearer header
- Optional TOTP 2FA (lib/totp.js)
- Default admin created on first run (users.json)

## Testing
```bash
# Start server
npm start

# Test endpoints (requires auth cookie)
curl -b "monitor_session=TOKEN" http://localhost:3001/api/system
curl -b "monitor_session=TOKEN" http://localhost:3001/api/tickets
curl -b "monitor_session=TOKEN" http://localhost:3001/api/db/tables
```

## 35 Sidebar Views
Overview: Dashboard, Metrics, Uptime
Infrastructure: Servers, Docker, PM2, SSL/Domains, Cloudflare
Database: SQL Editor, Tables, Schema, Migrations, Roles, Backups, DB Projects, DB Assistant
DevOps: Terminal, Tickets, Git, Deploy, Cron Jobs, File Manager, Env Variables
Workspace: Calendar, Notes
Security: Security Center, FTP, Notifications
System: MCP Server, Cache, Logs, Multi-Server, Settings, Docs/FAQ

### Sidebar Features
- **Auto-collapse:** Slides to 52px icon rail when cursor leaves, expands on hover (300ms ease-in-out, 400ms leave delay)
- **Favorites:** Star icon on each nav item to pin it to a "Favorites" group at top
- **Section reorder:** Up/down arrows on group headers to rearrange sections
- **Collapsible groups:** Click group header to collapse/expand items
- **All persisted:** `monitor_sidebarCollapsed`, `monitor_favorites`, `monitor_navOrder`, `monitor_navGroups` in localStorage
- **Collapsed tooltips:** CSS `::after` tooltips on icons show view name on hover
