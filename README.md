```
 ____        _                      _
| __ ) _   _| |_      ____ _ _ __| | __
|  _ \| | | | \ \ /\ / / _` | '__| |/ /
| |_) | |_| | |\ V  V / (_| | |  |   <
|____/ \__,_|_| \_/\_/ \__,_|_|  |_|\_\
```

# Bulwark

**Your entire server, one dashboard.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/Node-18%2B-green.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](Dockerfile)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-cyan.svg)](CONTRIBUTING.md)

Bulwark is an AI-powered, self-hosted server management platform that replaces your collection of DevOps tools with a single glass-themed dashboard. Terminal, database studio, Docker management, Git workflows, security scanning, and real-time monitoring — all in one place.

**No vendor lock-in. No cloud dependency. Your server, your data, your AI subscription.**

---

## Features

- **Terminal** — Full xterm.js terminal with node-pty, right in your browser
- **AI-Powered DB Studio** — Supabase-style database management with Claude/Codex SQL generation, security audits, and backup strategy analysis
- **Docker Management** — 27 native Docker Engine API endpoints, container lifecycle, logs, stats
- **Git + Deploy Pipeline** — Commit, push, branch management, deployment with rollback
- **Security Scanning** — Vulnerability scanning, SSL certificate management, credential vault (AES-256-GCM)
- **Real-time Monitoring** — CPU, memory, disk, process list via Socket.IO (3s refresh)
- **Uptime Monitoring** — HTTP/TCP health checks with history and alerting
- **RBAC + Audit Logging** — Admin/editor/viewer roles, every API call logged
- **Cloudflare Integration** — DNS and tunnel management
- **Calendar + Briefings** — AI-powered scheduling and daily summaries
- **Multi-Server** — Manage multiple servers from one dashboard
- **Cron, Files, Env Vars** — Full server management without SSH

---

## Quick Start

### npm

```bash
git clone https://github.com/autopilotaitech/bulwark.git
cd bulwark
npm install
MONITOR_USER=admin MONITOR_PASS=changeme npm start
# Open http://localhost:3001
```

### Docker

```bash
docker build -t bulwark .
docker run -d -p 3001:3001 \
  -e MONITOR_USER=admin \
  -e MONITOR_PASS=changeme \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  bulwark
```

### One-Line Install (Linux)

```bash
curl -fsSL https://bulwark.studio/install.sh | bash
```

---

## Architecture

```mermaid
graph TB
    Browser["Browser (Vanilla JS)"] -->|HTTP + WebSocket| Server["Express + Socket.IO :3001"]
    Server --> Routes["31 Route Modules"]
    Server --> Libs["13 Shared Libraries"]
    Routes --> PG["PostgreSQL 17"]
    Routes --> Docker["Docker Engine API"]
    Routes --> System["System (CPU/Mem/Disk)"]
    Routes --> AI["AI CLI (Claude/Codex)"]
    Libs --> Auth["PBKDF2 + TOTP 2FA"]
    Libs --> RBAC["RBAC + Audit"]
    Libs --> Vault["AES-256-GCM Vault"]
    Libs --> Cache["Neural Cache"]
```

**Stack:** Express.js + Socket.IO | Vanilla JS frontend (no build step) | PostgreSQL 17 | xterm.js + node-pty | Chart.js | CodeMirror 5

**31 route modules** | **13 libraries** | **34 views** | **267+ API endpoints** | **4 npm dependencies**

---

## AI Integration (BYOK)

Bulwark uses a **Bring Your Own Key** model. You install the AI CLI tools on your server and authenticate with your own subscriptions. Zero AI cost for Bulwark.

| Provider | Command | Requirement |
|----------|---------|-------------|
| Claude CLI | `claude --print` | Anthropic subscription |
| Codex CLI | `codex` | OpenAI API key |
| None | — | AI features disabled |

Configure in **Settings > AI Provider**. Bulwark auto-detects installed CLIs.

### AI-Powered Features
- SQL generation from natural language
- Database role security auditing with scoring
- Backup strategy analysis with disaster recovery planning
- Commit message generation
- Daily briefing summaries

---

## Screenshots

> Screenshots coming soon. Star the repo to get notified!

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MONITOR_PORT` | `3001` | Server port |
| `MONITOR_USER` | — | Default admin username (required on first run) |
| `MONITOR_PASS` | — | Default admin password (required on first run) |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `VPS_DATABASE_URL` | — | Secondary DB connection (optional) |
| `REPO_DIR` | cwd | Repository root for Git/Deploy operations |

Create a `.env` file in the project root or set environment variables directly.

---

## Theme: Dimension Dark

Bulwark features a glass-morphism dark theme with cyan/orange signal system:
- **Cyan (#22d3ee)** — success, healthy, active, positive
- **Orange (#ff6b2b)** — error, warning, destructive, down
- Glass cards with `backdrop-filter: blur()` and border highlights
- JetBrains Mono typography throughout

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.

---

## License

[AGPL-3.0](LICENSE) — Free to use, modify, and self-host. If you offer Bulwark as a hosted service, you must open-source your modifications.

---

## Built With

[Express.js](https://expressjs.com) | [Socket.IO](https://socket.io) | [PostgreSQL](https://postgresql.org) | [xterm.js](https://xtermjs.org) | [Chart.js](https://chartjs.org) | [CodeMirror](https://codemirror.net)

---

**Built by Bulwark** | [bulwark.studio](https://bulwark.studio)
