# Bulwark — Getting Started Guide

Your entire server, one dashboard. This guide walks you through setting up Bulwark from a fresh install to a fully connected infrastructure management platform.

---

## Table of Contents

1. [Installation](#1-installation)
2. [First Login](#2-first-login)
3. [Setting Up AI (Claude & Codex)](#3-setting-up-ai-claude--codex)
4. [Dashboard](#4-dashboard)
5. [Metrics](#5-metrics)
6. [Uptime](#6-uptime)
7. [Connecting Your Database](#7-connecting-your-database)
8. [Adding Servers](#8-adding-servers)
9. [Terminal & Command Center](#9-terminal--command-center)
10. [Keyboard Shortcuts](#10-keyboard-shortcuts)
11. [FAQ](#11-faq)

---

## 1. Installation

### Docker (Recommended)

```bash
git clone https://github.com/autopilotaitech/autopilotaitech.github.io.git
cd autopilotaitech.github.io/dev-monitor
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

---

## 2. First Login

Default credentials:

| Field    | Value   |
|----------|---------|
| Username | `admin` |
| Password | `admin` |

**Change your password immediately** after first login via Settings.

---

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

---

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

---

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

---

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

## 7. Connecting Your Database

### Local PostgreSQL (Docker Compose)

The Docker setup includes PostgreSQL 17 — it's already connected. Navigate to **Database > Tables** to see your schema.

### External Database (AWS RDS, Google Cloud SQL, Supabase, etc.)

1. Go to **Database > Projects** in the sidebar
2. Click **+ Add Project**
3. Enter your connection string:
   ```
   postgresql://user:password@host:5432/dbname
   ```
4. Click **Test Connection**, then **Save**

Bulwark supports multiple database connections. Switch between them using the database picker in the top bar of any Database view.

### What You Get

- **SQL Editor** — Write and run queries with AI-powered autocompletion
- **Table Browser** — Browse schema, data, constraints, indexes
- **Schema Explorer** — Functions, triggers, extensions
- **Migration Manager** — Track applied/pending migrations
- **Roles & Permissions** — AI security audit with scoring
- **Backups** — pg_dump with AI strategy analysis

---

## 8. Adding Servers

### Local Server

Your local machine is monitored automatically. View CPU, memory, disk, and processes under **Overview > Metrics**.

### Remote Servers (AWS, GCP, etc.)

1. Go to **Infrastructure > Servers**
2. Click **+ Add Server**
3. Enter:
   - **Name**: e.g. "AWS Production"
   - **Host**: IP or hostname
   - **Port**: SSH port (default 22)
4. Save

### SSH Credentials

Store SSH keys securely in the **Credential Vault** (Terminal > Vault tab):

1. Open Terminal (`Ctrl + Backtick`)
2. Click the **Vault** tab
3. Click **+ Add**
4. Select type **SSH Key**, enter host, username, and paste your private key
5. All credentials are encrypted with **AES-256-GCM**

Once stored, click the play button next to any credential to SSH directly from the terminal.

---

## 9. Terminal & Command Center

The terminal is a floating drawer that persists across all pages.

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

---

## 10. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Backtick` | Toggle terminal drawer |
| `Ctrl + Shift + Backtick` | Cycle terminal size (half / full / mini) |

---

## 11. FAQ

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

### Terminal

**Q: Copy/paste isn't working in the terminal.**
A: Use `Ctrl+V` to paste and `Ctrl+C` to copy selected text. If `Ctrl+C` sends SIGINT instead of copying, select text first — it copies when text is highlighted, sends SIGINT when nothing is selected.

**Q: Claude CLI says "cannot be used with root/sudo privileges".**
A: The Docker image runs as the `bulwark` user (not root) to support this. If you're running manually, don't use `sudo` with Claude CLI.

**Q: The terminal says "Session ended".**
A: The PTY session timed out or crashed. Click the Shell tab or press `Ctrl + Backtick` to reconnect.

### Database

**Q: pg_dump backup says "version mismatch".**
A: Your pg_dump client version must match or exceed your PostgreSQL server version. The Docker image includes pg_dump 17. For manual installs, install `postgresql-client-17`.

**Q: Can I connect to multiple databases?**
A: Yes. Use Database > Projects to add multiple connection strings. Switch between them with the database picker.

### Infrastructure

**Q: How do I monitor a remote server?**
A: Add it under Infrastructure > Servers. For full monitoring, the remote server needs the Bulwark agent installed, or you can use SSH-based monitoring via stored credentials.

**Q: Does it support AWS / GCP / Azure?**
A: Yes. Add any server accessible via SSH. Cloud-specific features (Cloudflare DNS, Docker management) work when the respective services are configured.

---

*Bulwark v2.1 — Server Management Platform*
*Copyright 2026 AutopilotAI Tech LLC*
