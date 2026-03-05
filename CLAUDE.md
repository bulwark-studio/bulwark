# Chester Dev Monitor v2.0 — Developer Guide

## Overview
Enterprise server management platform. Express.js + Socket.IO on port 3001.
Vanilla JS frontend — no React, no build step, no bundler.

## Quick Start
```bash
cd dev-monitor && npm install && npm start
# Access: http://localhost:3001
# Default: admin / admin (change immediately)
```

## Architecture

### Server (200-line orchestrator)
```
server.js                    → Express + Socket.IO setup, auth middleware, intervals
routes/                      → 17 route modules (auth, tickets, system, claude, servers,
                               docker, databases, db-studio, security, ssl, envvars, files,
                               cron, ftp, notifications, multi-server, uptime)
lib/                         → 9 shared modules (db, exec, adapter-client, users, totp,
                               sessions, metrics-collector, uptime-store, notification-sender)
adapter/                     → Proxy to ServerKit (port 4001) for Docker/DB/Security/SSL/Cron/FTP
data/                        → Runtime JSON stores (uptime, notifications, envvars, agents,
                               query-history, saved-queries)
```

### Frontend (ViewRegistry pattern)
```
public/
  index.html                 → Shell (~300 lines): head, sidebar, 28 view containers
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
    views/                   → 28 self-registering view modules (22 original + 6 DB Studio)
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

### Shared Context (ctx)
Route modules receive `ctx` with: `pool`, `vpsPool`, `dbQuery`, `vpsQuery`, `io`, `execCommand`, `REPO_DIR`, `callAdapter`, `requireAuth`, `requireAdmin`, `getSystemInfo`, plus callbacks populated by routes (`getTicketSummary`, `getRecentActivity`, `getProcessList`, `getServerHealth`, `runClaude`, `sendNotification`).

## Theme: Dimension Dark (Glass Treatment — matches admin)

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

### Route: `routes/db-studio.js` (25+ endpoints, direct PG introspection)
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
GET  /api/db/migrations          → Applied vs filesystem migrations
GET  /api/db/migrations/pending  → Unapplied migration files
POST /api/db/migrations/run      → Execute migration SQL file
POST /api/db/migrations/test     → Docker test-run (spin up PG, apply, validate, destroy)
POST /api/db/migrations/diff     → Compare live DB vs schema.sql
POST /api/db/backup              → pg_dump to data/backups/
GET  /api/db/backups             → List backup files
POST /api/db/backup/restore      → pg_restore from file
GET  /api/db/query/history       → Last 100 queries from data/query-history.json
POST /api/db/query/save          → Save named query to data/saved-queries.json
GET  /api/db/query/saved         → List saved queries
POST /api/db/claude/generate     → Claude CLI generates SQL from natural language
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
| Roles | `views/roles.js` | PG roles + table permissions |
| Backups | `views/db-backups.js` | pg_dump/pg_restore, backup list |

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
curl -b "monitor_session=TOKEN" http://localhost:3001/api/activity
```

## 28 Sidebar Views
Overview: Dashboard, Metrics, Uptime
Infrastructure: Servers, Docker, PM2, SSL/Domains
Database: SQL Editor, Tables, Schema, Migrations, Roles, Backups
Operations: Terminal, Claude, Tickets, Git, Deploy, Cron Jobs, File Manager, Env Variables
Security: Security Center, FTP, Notifications
System: Logs, Multi-Server, Settings
