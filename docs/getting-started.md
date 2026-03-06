# Bulwark — Getting Started Guide

Your entire server, one dashboard. This guide walks you through setting up Bulwark from a fresh install to a fully connected infrastructure management platform.

### Getting Started

- [1. Installation](#1-installation)
- [2. First Login](#2-first-login)
- [3. Setting Up AI (Claude & Codex)](#3-setting-up-ai-claude--codex)

### Overview

- [4. Dashboard](#4-dashboard)
- [5. Metrics](#5-metrics)
- [6. Uptime](#6-uptime)

### Infrastructure

- [7. Servers](#7-servers)
- [8. Docker](#8-docker)
- [9. PM2](#9-pm2)
- [10. SSL / Domains](#10-ssl--domains)
- [11. Cloudflare](#11-cloudflare)

### Database

- [12. Projects](#12-projects)
- [13. SQL Editor](#13-sql-editor)
- [14. Tables](#14-tables)
- [15. Schema](#15-schema)
- [16. Migrations](#16-migrations)
- [17. Roles](#17-roles)
- [18. Backups](#18-backups)
- [19. AI Assistant](#19-ai-assistant)

### DevOps

- [20. Terminal](#20-terminal)
- [21. Tickets](#21-tickets)
- [22. Git](#22-git)
- [23. Deploy](#23-deploy)
- [24. Cron Jobs](#24-cron-jobs)
- [25. File Manager](#25-file-manager)
- [26. Env Variables](#26-env-variables)

### Workspace

- [27. Calendar](#27-calendar)
- [28. Notes](#28-notes)

### Security

- [29. Security Center](#29-security-center)
- [30. FTP](#30-ftp)
- [31. Notifications](#31-notifications)

### System

- [32. Cache](#32-cache)
- [33. Logs](#33-logs)
- [34. Multi-Server](#34-multi-server)
- [35. Settings](#35-settings)

### Reference

- [36. Keyboard Shortcuts](#36-keyboard-shortcuts)
- [37. FAQ](#37-faq)

## 1. Installation

### Docker (Recommended)

```bash
git clone https://github.com/yourorg/bulwark.git
cd bulwark
docker compose up -d
```

This starts two containers:
- **bulwark** — Ubuntu 24.04, Node.js 22, with Claude CLI and Codex CLI pre-installed
- **bulwark-db** — PostgreSQL 17

Open **http://localhost:3001** in your browser.

### Manual Install

```bash
cd dev-monitor
npm install
npm start
```

Requires: Node.js 18+, PostgreSQL (optional — works without it).

## 2. First Login

Default credentials:

| Field    | Value   |
|----------|---------|
| Username | `admin` |
| Password | `admin` |

**Change your password immediately** after first login via Settings.

## 3. Setting Up AI (Claude & Codex)

Bulwark uses a **BYOK (Bring Your Own Key)** model. You use your own AI subscriptions — Bulwark has zero AI cost.

### Step 1: Open the Terminal

Click **Terminal** in the sidebar, then click **Open Terminal (Ctrl+`)** or press `Ctrl + Backtick` from any page.

![Terminal — Command Center](../media/screenshots/claude_terminal_setup_1.png)

The floating terminal drawer opens at the bottom with three tabs: **Shell**, **Bulwark AI**, and **Vault**.

### Step 2: Authenticate Claude CLI

In the terminal, run:

```bash
claude --dangerously-skip-permissions
```

Claude Code will launch and walk you through authentication. You'll need an active **Anthropic subscription** (Claude Pro or Claude Max).

![Claude Code loaded in terminal](../media/screenshots/claude_terminal_loaded_2.png)

Once authenticated, you'll see:
- Your Claude Code version (e.g. v2.1.70)
- Your model (e.g. Opus 4.6)
- Your organization and account

Claude is now available for:
- SQL generation from natural language (Database > SQL Editor)
- AI security audits (Database > Roles)
- Backup strategy analysis (Database > Backups)
- Commit message generation (Git view)
- Daily briefing summaries

### Step 3: Authenticate Codex CLI (Optional)

If you have an OpenAI API key:

```bash
export OPENAI_API_KEY=sk-your-key-here
codex --version
```

### Passing API Keys via Docker

```bash
ANTHROPIC_API_KEY=sk-ant-xxx OPENAI_API_KEY=sk-xxx docker compose up -d
```

Or add them to a `.env` file in the `dev-monitor/` directory.

## 4. Dashboard

The Dashboard is your command center — a single-screen overview of your entire infrastructure.

![Dashboard — AI Briefing, Health Score, Command Hub, Live Metrics](../media/screenshots/Dashboard_open_ai_banner_3.png)

### AI Briefing

The banner at the top provides an AI-generated summary of your system health. It analyzes CPU, memory, database, servers, tickets, and processes, then gives you a plain-English status report. Click **Refresh** to regenerate.

> *"All systems are looking healthy this morning with a 98/100 health score — both monitored servers are up, CPU and memory usage are minimal, and the database cache is hitting 100%."*

Requires Claude CLI to be authenticated (see [Setting Up AI](#3-setting-up-ai-claude--codex)).

### Health Score

The donut chart shows a composite health score (0-100) broken down by:

| Component | What it measures |
|-----------|-----------------|
| **System** | CPU and memory utilization |
| **Database** | Connection health, cache hit ratio |
| **Servers** | Reachability of monitored servers |
| **PM2** | Process manager status |
| **Tickets** | Open support ticket count |

### Command Hub

One-click actions for common tasks:

| Button | Action |
|--------|--------|
| **Run Diagnostics** | Full system health check |
| **Deploy Check** | Verify deployment status |
| **Ask Claude** | Open AI assistant |
| **Refresh All** | Reload all dashboard data |

### Live Metrics

Real-time gauges for CPU, Memory, and Disk usage with animated ring charts. Updates every 3 seconds via WebSocket.

![Dashboard — Infrastructure Map, Database, Timeline, Tickets, Calendar, Notes](../media/screenshots/Dashboard_open_ai_banner-bottom_4.png)

### Infrastructure Map

A visual topology of your infrastructure. Shows connected servers, databases, and services with latency indicators. Nodes are interactive — click to navigate to the corresponding management view.

### Database Panel

At-a-glance database stats:

| Metric | Description |
|--------|-------------|
| **Tables** | Total table count |
| **Size** | Database size on disk |
| **Conns** | Active connections |
| **Queries** | Queries executed in session |
| **Version** | PostgreSQL version |

### Additional Panels

- **Activity Timeline** — Recent system events, deploys, and user actions
- **Tickets** — Open / In Progress / Resolved ticket counts
- **Calendar** — Upcoming events and scheduled maintenance
- **Notes** — Quick notes with pin support

### Dashboard FAQ

**Q: The AI Briefing says "Click Analyze for AI-powered insights."**
A: Claude CLI isn't authenticated yet. Open the terminal and run `claude --dangerously-skip-permissions` to set up your Anthropic account.

**Q: Health score shows N/A for some components.**
A: Components show N/A when not configured. Add a database connection for Database health, add servers for Server health, install PM2 for PM2 health.

**Q: The Infrastructure Map is empty.**
A: Add servers under Infrastructure > Servers. The map auto-populates as you connect infrastructure.

**Q: Live metrics show 0% for everything.**
A: Metrics need a few seconds to populate after page load. If they stay at 0%, check that the WebSocket connection is active (look for the green "Connected" dot in the status bar).

**Q: How often does the dashboard refresh?**
A: Live Metrics update every 3 seconds via WebSocket. Other panels refresh on page load. Click **Refresh** in the top bar to manually reload all data.

## 5. Metrics

The Metrics view gives you deep real-time telemetry for your server — CPU, memory, disk, and per-core performance.

![Metrics — AI Analysis, Hero Stats, CPU Chart, Core Heatmap](../media/screenshots/Metrics_top_5.png)

### AI Performance Analysis

The banner at the top provides an AI-generated summary of your system performance, similar to the Dashboard briefing but focused on hardware utilization. Click **Analyze** to generate a fresh report.

### Hero Stats

Four key metrics displayed as large stat cards:

| Stat | What it shows |
|------|---------------|
| **CPU** | Current CPU utilization percentage |
| **Memory** | Current memory usage percentage |
| **Cores** | Total CPU cores available |
| **Uptime** | Server uptime in hours |

### Real-Time Telemetry — CPU

A live-updating line chart showing CPU usage over time. Select a time range (1m, 5m, 15m, 1h, 6h) to zoom in or out. Data updates every 3 seconds via WebSocket.

### Per-Core Heatmap

A color-coded heatmap showing activity across all CPU cores. Each cell represents one core — darker means idle, brighter means active. Useful for spotting unbalanced workloads or runaway processes pinned to a single core.

![Metrics — CPU Aggregate, Memory Chart, System Info, Per-Core Sparklines](../media/screenshots/Metrics_bottom_6.png)

### CPU Aggregate Chart

A secondary CPU chart showing aggregate utilization with a longer time window. Helps identify trends over minutes rather than seconds.

### Memory Usage Chart

Live memory usage chart with the same time range selector as CPU. Shows used vs total memory with percentage labels.

### System Info Panel

Detailed system information at a glance:

| Field | Example |
|-------|---------|
| **Hostname** | Your server's hostname |
| **Platform** | linux, darwin, win32 |
| **Architecture** | x64, arm64 |
| **CPU Model** | AMD Ryzen 7 7700X, Intel Xeon, etc. |
| **Cores** | Total logical cores |
| **Node.js** | Runtime version |
| **Uptime** | Hours since last boot |
| **Load Average** | 1/5/15 minute load averages |

### Per-Core Activity

Individual sparkline charts for each CPU core, showing recent activity patterns. Each core gets its own mini chart so you can visually compare core utilization across the system.

### Metrics FAQ

**Q: Charts show 0% for everything.**
A: Metrics need a few seconds to populate after page load. If they stay flat, check the WebSocket connection (green dot in the status bar). On fresh installs, give it 10-15 seconds to accumulate data points.

**Q: Can I change the chart time range?**
A: Yes. Use the time range buttons (1m, 5m, 15m, 1h, 6h) above each chart to adjust the window.

**Q: Memory shows a different number than `free -m`.**
A: Bulwark reports memory as used by applications (excluding OS buffers/cache), which matches what most monitoring tools display. The `free` command shows raw OS-level figures including cache.

**Q: The per-core heatmap is all dark.**
A: Your CPU is mostly idle — that's normal for a lightly loaded server. Run a build or benchmark and you'll see cores light up.

## 6. Uptime

Monitor the availability and response time of your servers and endpoints from a single view.

![Uptime — AI Analysis, Status, Server Cards, Response Time Chart](../media/screenshots/upTime_top_7.png)

### AI Uptime Analysis

The banner provides an AI-generated summary of your uptime status — latency trends, resource usage, and recommendations. Click **Analyze** to generate a fresh report.

### Status Banner

Shows overall system status ("All Systems Operational") with the last check timestamp and current response time.

### Connected Servers

Each monitored server gets a card showing:

| Field | Description |
|-------|-------------|
| **Status** | Up (cyan) or Down (orange) |
| **Uptime** | Percentage uptime over monitoring period |
| **Latency** | Current response time in ms |
| **Host** | IP address or hostname |
| **Port** | Monitored port number |

Click **+ Uptime Page** on any server card to create a public status page for that server.

### Response Time Chart

A live chart showing response time history across all monitored servers. Orange and cyan lines differentiate servers. Use the time range selector to view trends over different periods.

### Monitored Endpoints

Add HTTP/HTTPS health check endpoints to monitor APIs, websites, or services.

![Uptime — Add Monitored Endpoint Modal](../media/screenshots/upTime_EndPoints_8.png)

Click **+** next to "Monitored Endpoints" to add a new endpoint:

| Field | Description |
|-------|-------------|
| **Name** | Friendly name (e.g. "My API") |
| **URL** | Full URL to check (e.g. `https://api.example.com/health`) |
| **Check Interval** | Seconds between checks (default: 60) |
| **Expected Status Code** | HTTP status code that means healthy (default: 200) |

Bulwark will ping the endpoint at the configured interval and alert you if it returns an unexpected status code or times out.

### Uptime FAQ

**Q: How do I add a server to uptime monitoring?**
A: Go to Infrastructure > Servers first and add the server. It will automatically appear in the Uptime view.

**Q: Can I monitor external URLs (not my servers)?**
A: Yes. Use the Monitored Endpoints section to add any HTTP/HTTPS URL. No server setup required — just the URL and expected status code.

**Q: How often are checks performed?**
A: Server health checks run every 30 seconds. Endpoint checks use the interval you configure (default 60 seconds).

**Q: Can I create a public status page?**
A: Yes. Click **+ Uptime Page** on any server card to generate a shareable status page URL.

---

## Infrastructure

---

## 7. Servers

Your local machine is monitored automatically as "Local Dev". Add remote servers to monitor your full infrastructure.

### Adding a Remote Server

1. Set the `VPS_HOST` environment variable to your server's URL, or
2. Add servers via the database `cloud_endpoints` table

### SSH Credentials

Store SSH keys securely in the **Credential Vault** (Terminal > Vault tab):

1. Open Terminal (`Ctrl + Backtick`)
2. Click the **Vault** tab
3. Click **+ Add**
4. Select type **SSH Key**, enter host, username, and paste your private key
5. All credentials are encrypted with **AES-256-GCM**

Once stored, click the play button next to any credential to SSH directly from the terminal.

### Servers FAQ

**Q: How do I monitor a remote server?**
A: Set `VPS_HOST=https://your-server.com` in your `.env` file, or add it to the `cloud_endpoints` database table. The server needs a `/api/health` endpoint for health checks.

**Q: Does it support AWS / GCP / Azure?**
A: Yes. Add any server accessible via HTTP health checks or SSH. Cloud-specific features (Cloudflare DNS, Docker management) work when the respective services are configured.

**Q: Why does "Local Dev" always show?**
A: Local Dev represents the machine Bulwark is running on. It always appears and reports real-time system metrics via the Node.js `os` module.

## 8. Docker

Manage Docker containers, images, volumes, and networks directly from the dashboard.

### Docker FAQ

**Q: Docker shows "Connection failed".**
A: Bulwark connects to the Docker Engine API via the Unix socket (`/var/run/docker.sock`). Make sure Docker is installed and the Bulwark user has permission to access the socket.

**Q: Can I manage Docker on a remote server?**
A: Currently Docker management is local only. For remote servers, use the Terminal to SSH in and run Docker commands.

## 9. PM2

Monitor and manage PM2 process manager instances.

### PM2 FAQ

**Q: PM2 shows "No processes found".**
A: PM2 must be installed and running on the server. Install with `npm install -g pm2`, then start your app with `pm2 start app.js`.

**Q: Can I restart processes from Bulwark?**
A: Yes. Click the restart button next to any process, or use the Terminal to run `pm2 restart <name>`.

## 10. SSL / Domains

Manage SSL/TLS certificates and domain configurations.

### SSL FAQ

**Q: How do I add an SSL certificate?**
A: Go to SSL / Domains and click **+ Add**. You can paste your certificate and key, or configure automatic renewal via Let's Encrypt.

**Q: Does it support Let's Encrypt?**
A: Yes, via the adapter service. Configure your domain and Bulwark will handle certificate issuance and renewal.

## 11. Cloudflare

Manage Cloudflare DNS records, tunnels, and zone settings.

### Cloudflare FAQ

**Q: How do I connect Cloudflare?**
A: Add your Cloudflare API token in the Credential Vault. Go to Cloudflare in the sidebar — it will auto-detect your zones and DNS records.

**Q: Can I manage Cloudflare Tunnels?**
A: Yes. View, create, and delete tunnels directly from the Cloudflare view. Requires a Cloudflare API token with tunnel permissions.

---

## Database

---

## 12. Projects

Manage multiple database connections. The Docker setup includes PostgreSQL 17 — it's already connected out of the box.

### Adding an External Database

1. Go to **Database > Projects** in the sidebar
2. Click **+ Add Project**
3. Enter your connection string:
   ```
   postgresql://user:password@host:5432/dbname
   ```
4. Click **Test Connection**, then **Save**

Switch between connections using the database picker in the top bar of any Database view.

### Projects FAQ

**Q: Can I connect to multiple databases?**
A: Yes. Add as many projects as you need. Switch between them with the database picker.

**Q: Does it support MySQL or SQLite?**
A: Currently PostgreSQL only. MySQL and SQLite support is planned.

## 13. SQL Editor

Write and run SQL queries with AI-powered autocompletion, syntax highlighting, and query history.

### SQL Editor FAQ

**Q: How do I use AI to generate SQL?**
A: Click **Ask Claude** in the SQL Editor toolbar. Describe what you want in plain English and Claude will generate the SQL. Requires Claude CLI to be authenticated.

**Q: Can I run destructive queries (DROP, ALTER)?**
A: DDL statements are blocked by default. To run them, the query must include the `?allow_ddl=true` parameter. This is a safety measure.

**Q: Where is query history stored?**
A: In `data/query-history.json`. The last 100 queries are kept. You can also save named queries for quick access.

## 14. Tables

Browse your database schema — columns, data, constraints, foreign keys, and indexes in a two-panel layout.

### Tables FAQ

**Q: Can I edit data directly?**
A: The Tables view is read-only for safety. Use the SQL Editor to run INSERT/UPDATE/DELETE statements.

**Q: Why do some tables show 0 rows?**
A: Row counts are estimates from PostgreSQL statistics. Run `ANALYZE` on your database to update the estimates, or click into the table to see actual row data.

## 15. Schema

Explore database functions, triggers, extensions, and indexes.

### Schema FAQ

**Q: Can I create functions or triggers from here?**
A: The Schema view is read-only for browsing. Use the SQL Editor to create or modify database objects.

**Q: What extensions are available?**
A: Shows all installed PostgreSQL extensions (e.g. pg_stat_statements, uuid-ossp, pgcrypto). Install new ones via SQL: `CREATE EXTENSION extension_name;`

## 16. Migrations

Track applied vs pending database migrations. Supports Docker test-runs and schema diffs.

### Migrations FAQ

**Q: Where do migration files go?**
A: Place `.sql` files in your project's migration directory. Bulwark scans the filesystem and compares against applied migrations in the database.

**Q: Can I test a migration before applying?**
A: Yes. Click **Test Run** to spin up a temporary PostgreSQL container, apply the migration, validate, and destroy — without touching your live database.

## 17. Roles

View PostgreSQL roles, table-level permissions, and run AI security audits.

### Roles FAQ

**Q: What does the AI security audit do?**
A: Claude analyzes all database roles, their permissions, and privilege levels, then returns a security score with specific findings and recommendations. Requires Claude CLI.

**Q: Can I create roles from here?**
A: Use the AI role generator — describe what the role needs access to in plain English and Claude generates the least-privilege SQL. Run it in the SQL Editor.

## 18. Backups

Create and restore PostgreSQL backups with AI-powered backup strategy analysis.

### Backups FAQ

**Q: pg_dump says "version mismatch".**
A: Your pg_dump client version must match or exceed your PostgreSQL server version. The Docker image includes pg_dump 17. For manual installs, install `postgresql-client-17`.

**Q: What if pg_dump isn't installed?**
A: Bulwark falls back to SQL-based export, dumping schema and data via PostgreSQL queries. Less feature-complete than pg_dump but works everywhere.

**Q: What does AI backup strategy do?**
A: Claude analyzes your backup history, database size, and configuration, then provides a health score, disaster recovery plan, and specific recommendations.

## 19. AI Assistant

A conversational AI assistant for database operations — ask questions about your schema, generate queries, and get optimization advice.

### AI Assistant FAQ

**Q: What can I ask the AI Assistant?**
A: Anything about your database — "show me the largest tables", "generate an index for slow queries", "explain this schema". It has context about your connected database.

**Q: Which AI provider does it use?**
A: Whatever is configured in Settings > AI Provider. Default is Claude CLI. Also supports Codex CLI or none.

---

## DevOps

---

## 20. Terminal

A floating terminal drawer that persists across all pages.

### Three Tabs

| Tab | Purpose |
|-----|---------|
| **Shell** | Full PTY terminal (bash). Run any command. |
| **Bulwark AI** | Natural language DevOps assistant. Ask "restart Docker containers" and it generates the command. |
| **Vault** | Encrypted credential storage. SSH keys, API tokens, connection strings. |

### Quick Commands

The toolbar above the terminal has one-click buttons: `clear`, `ls`, `git st`, `docker`, `pm2`.

### Copy & Paste

| Action | Shortcut |
|--------|----------|
| Paste  | `Ctrl+V` |
| Copy (selected text) | `Ctrl+C` (copies if text selected, sends SIGINT if not) |
| Copy (always) | `Ctrl+Shift+C` |

### Terminal FAQ

**Q: Copy/paste isn't working in the terminal.**
A: Use `Ctrl+V` to paste and `Ctrl+C` to copy selected text. If `Ctrl+C` sends SIGINT instead of copying, select text first — it copies when text is highlighted, sends SIGINT when nothing is selected.

**Q: Claude CLI says "cannot be used with root/sudo privileges".**
A: The Docker image runs as the `bulwark` user (not root) to support this. If you're running manually, don't use `sudo` with Claude CLI.

**Q: The terminal says "Session ended".**
A: The PTY session timed out or crashed. Click the Shell tab or press `Ctrl + Backtick` to reconnect.

## 21. Tickets

Support ticket system with Kanban board, status tracking, and approval workflows.

### Tickets FAQ

**Q: Where are tickets stored?**
A: In the PostgreSQL `support_tickets` table. Tickets work when a database is connected.

**Q: Can I use tickets without a database?**
A: No. The ticket system requires PostgreSQL. Without it, the view shows "No database connected".

## 22. Git

Git operations — view branches, diffs, commit history, and generate AI commit messages.

### Git FAQ

**Q: What repository does it use?**
A: Bulwark uses the `REPO_DIR` environment variable (defaults to `/admin`). Set it to your project's git repository path.

**Q: How does AI commit message generation work?**
A: Click **Generate** when committing. Claude analyzes your staged changes and writes a descriptive commit message. Requires Claude CLI.

## 23. Deploy

Deployment pipeline with rollback support and deploy checks.

### Deploy FAQ

**Q: How do I set up a deploy target?**
A: Click **+ Add Target** and enter the server name, host, deploy command, and branch. Bulwark will SSH to the server and run your deploy script.

**Q: Can I rollback a deployment?**
A: Yes. Each deploy is logged with a timestamp. Click **Rollback** to revert to the previous deployment state.

## 24. Cron Jobs

View, create, edit, and delete cron jobs with a scheduling UI.

### Cron Jobs FAQ

**Q: Does it manage system crontab?**
A: Yes. Bulwark reads and writes the system crontab. Requires appropriate permissions on the server.

**Q: Can I test a cron schedule?**
A: The scheduling UI shows a human-readable description of when the job will run next (e.g. "Every day at 3:00 AM").

## 25. File Manager

Browse, edit, upload, and download files on the server.

### File Manager FAQ

**Q: What directory does it start in?**
A: The file manager starts in the `REPO_DIR` directory. Navigate using the breadcrumb path or sidebar tree.

**Q: Can I edit files directly?**
A: Yes. Click any text file to open it in an inline editor. Save changes directly to the server.

## 26. Env Variables

View and manage environment variables.

### Env Variables FAQ

**Q: Are env variables persisted?**
A: Variables managed through Bulwark are stored in `data/envvars.json`. System environment variables are read-only.

**Q: Can I add sensitive values?**
A: Yes, but consider using the Credential Vault instead for sensitive data like API keys and passwords — it encrypts with AES-256-GCM.

---

## Workspace

---

## 27. Calendar

Schedule events, maintenance windows, and track upcoming tasks.

### Calendar FAQ

**Q: Does it sync with Google Calendar?**
A: Not currently. Events are stored locally in `data/calendar.json`. External calendar sync is planned.

**Q: Can I set reminders?**
A: Events appear on the Dashboard's calendar widget. Push notifications for reminders are planned.

## 28. Notes

Quick notes with pin support — jot down commands, links, or reminders.

### Notes FAQ

**Q: Where are notes stored?**
A: In `data/notes.json`. Notes persist across sessions and server restarts.

**Q: Can I pin important notes?**
A: Yes. Click the pin icon on any note to keep it at the top of the list.

---

## Security

---

## 29. Security Center

Security scanning, vulnerability reports, and system hardening recommendations.

### Security Center FAQ

**Q: What does the security scan check?**
A: Open ports, running services, file permissions, SSH configuration, firewall rules, and common vulnerabilities. Results include a severity rating and fix recommendations.

**Q: How often should I scan?**
A: Run a scan after any infrastructure change (new service, port change, user added). Weekly scans are recommended for production servers.

## 30. FTP

Manage FTP server, user accounts, and active sessions.

### FTP FAQ

**Q: Does Bulwark include an FTP server?**
A: No. This view manages an existing FTP server (vsftpd, ProFTPD, etc.) running on your system. It requires the adapter service.

**Q: Can I create FTP users?**
A: Yes. Click **+ Add User** to create a new FTP account with a home directory and permissions.

## 31. Notifications

Notification center for system alerts, events, and activity.

### Notifications FAQ

**Q: What triggers notifications?**
A: Server health changes, deploy events, security alerts, ticket updates, and cron job failures.

**Q: Can I get notifications outside Bulwark?**
A: Currently notifications are in-app only (bell icon in the top bar). Email and webhook notifications are planned.

---

## System

---

## 32. Cache

View and manage the AI intelligence cache — content-addressed storage with anomaly detection.

### Cache FAQ

**Q: What does the cache store?**
A: AI responses (briefings, analysis, SQL generation) are cached to avoid redundant API calls. Each entry has a freshness badge showing age.

**Q: Can I clear the cache?**
A: Yes. Click **Clear All** to reset the cache. Individual entries can also be deleted.

## 33. Logs

System logs, audit trail, and activity history.

### Logs FAQ

**Q: What gets logged?**
A: Every API call is logged with timestamp, user, action, resource, method, IP, and result. View in Settings > Audit Log for the full trail.

**Q: Can I export logs?**
A: Yes. Go to Settings > Audit Log and click **Export JSON** or **Export CSV**.

## 34. Multi-Server

Aggregated view across all connected servers — compare health, metrics, and status side by side.

### Multi-Server FAQ

**Q: How do I add servers to this view?**
A: Servers added in Infrastructure > Servers automatically appear here. The view aggregates health data from all connected servers.

**Q: What if a server is unreachable?**
A: It shows as "unreachable" with an orange indicator. Other servers continue to report normally.

## 35. Settings

Account management, 2FA, AI provider configuration, audit log, and user management.

### Settings FAQ

**Q: How do I change my password?**
A: Go to Settings > My Account and click **Change Password**.

**Q: How do I enable 2FA?**
A: Go to Settings > Two-Factor Authentication and click **Enable 2FA**. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.).

**Q: How do I switch AI providers?**
A: Go to Settings > AI Provider. Choose between Claude CLI, Codex CLI, or None.

**Q: Can I add more users?**
A: Yes. Admins can add users in Settings > User Management. Each user gets a role (admin, editor, viewer) that controls what they can access.

---

## Reference

---

## 36. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Backtick` | Toggle terminal drawer |
| `Ctrl + Shift + Backtick` | Cycle terminal size (half / full / mini) |

## 37. FAQ

### General

**Q: What does Bulwark cost?**
A: The Community edition is free and open source. AI features use your own subscriptions (Anthropic, OpenAI) — Bulwark has zero AI cost.

**Q: What are the system requirements?**
A: Node.js 18+ (22+ for Codex CLI). PostgreSQL optional. Docker recommended. Runs on Linux, macOS, and Windows.

**Q: Does it work without a database?**
A: Yes. All features work except Database views. System metrics, terminal, Docker, Git, deploy, and monitoring all function without PostgreSQL.

### AI

**Q: Do I need an Anthropic subscription?**
A: Only for AI features (SQL generation, security audit, backup analysis). Everything else works without it.

**Q: Can I use Claude and Codex at the same time?**
A: Yes. Claude CLI and Codex CLI are independent tools. Set both API keys and use whichever you prefer.

**Q: Is my API key stored securely?**
A: API keys passed via environment variables stay in memory only. Keys stored in the Credential Vault are encrypted with AES-256-GCM.

*Bulwark v2.1 — Server Management Platform*
