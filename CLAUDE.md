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
routes/                      → 16 route modules (auth, tickets, system, claude, servers,
                               docker, databases, security, ssl, envvars, files, cron,
                               ftp, notifications, multi-server, uptime)
lib/                         → 9 shared modules (db, exec, adapter-client, users, totp,
                               sessions, metrics-collector, uptime-store, notification-sender)
adapter/                     → Proxy to ServerKit (port 4001) for Docker/DB/Security/SSL/Cron/FTP
data/                        → Runtime JSON stores (uptime, notifications, envvars, agents)
```

### Frontend (ViewRegistry pattern)
```
public/
  index.html                 → Shell (~250 lines): head, sidebar, 22 view containers
  css/
    theme.css                → Dimension Dark + CSS variables
    layout.css               → Sidebar, topbar, content grid, status bar
    components.css           → Cards, badges, buttons, tables, forms, animations
    kanban.css               → Ticket board styles
    terminal.css             → xterm.js + claude terminal
    modal.css                → Glass modal system
  js/
    app.js                   → State, Socket.IO, view registry, nav, cache, animations
    charts.js                → Chart.js wrappers
    modal.js                 → Modal.open/close/confirm/loading
    toast.js                 → Toast notification system
    views/                   → 22 self-registering view modules
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

## Theme: Dimension Dark

### CSS Variables (defined in theme.css)
- `--canvas: #0a0b10` — deepest background
- `--surface-solid: #0e0e12` — sidebar, topbar
- `--surface: rgba(14,14,18,0.65)` — glass cards
- `--text-primary`, `--text-secondary`, `--text-tertiary`
- `--border: rgba(255,255,255,0.06)`
- `--cyan: #22d3ee` — success, healthy, active, positive
- `--orange: #ff6b2b` — error, down, warning, destructive

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

## 22 Sidebar Views
Overview: Dashboard, Metrics, Uptime
Infrastructure: Servers, Docker, Databases, PM2, SSL/Domains
Operations: Terminal, Claude, Tickets, Git, Deploy, Cron Jobs, File Manager, Env Variables
Security: Security Center, FTP, Notifications
System: Logs, Multi-Server, Settings
