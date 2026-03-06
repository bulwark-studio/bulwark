# Bulwark — Getting Started Guide

Your entire server, one dashboard. This guide walks you through setting up Bulwark from a fresh install to a fully connected infrastructure management platform.

---

## Table of Contents

1. [Installation](#1-installation)
2. [First Login](#2-first-login)
3. [Setting Up AI (Claude & Codex)](#3-setting-up-ai-claude--codex)
4. [Connecting Your Database](#4-connecting-your-database)
5. [Adding Servers](#5-adding-servers)
6. [Terminal & Command Center](#6-terminal--command-center)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [FAQ](#8-faq)

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

## 4. Connecting Your Database

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

## 5. Adding Servers

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

## 6. Terminal & Command Center

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

## 7. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Backtick` | Toggle terminal drawer |
| `Ctrl + Shift + Backtick` | Cycle terminal size (half / full / mini) |

---

## 8. FAQ

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
