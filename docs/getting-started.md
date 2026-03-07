# Bulwark — Getting Started Guide

Your entire server, one dashboard.

## 1. Installation

### Docker (Recommended)

```bash
git clone https://github.com/bulwark-studio/bulwark.git
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

### Secure Your Account

After first login, go to **Settings** (bottom of the sidebar) and do these immediately:

1. **Change your password** — Settings > My Account > Change Password. Pick something strong (8+ characters).
2. **Change your username** — Settings > My Account. Replace "admin" with your name or email.
3. **Enable 2FA** — Settings > Two-Factor Authentication > Enable 2FA. Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.). You'll need the 6-digit code on every login after this.
4. **Add additional users** (optional) — Settings > User Management > + Add User. Assign roles: **admin** (full access), **editor** (can modify but not delete), **viewer** (read-only).

> **Warning:** Do NOT skip changing the default password. Anyone who can reach port 3001 can log in with `admin/admin`.

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

Full Docker fleet management — containers, images, volumes, networks, system cleanup, and AI analysis. Supports **multiple connections** to local and remote Docker engines.

![Docker — Infrastructure Connections, Fleet Stats, Container Cards](../media/screenshots/Docker_9.png)

### Infrastructure Connections Panel

The connections panel is always visible at the top of the Docker view. It lists every Docker engine you've connected, with live status:

| Status | Meaning |
|--------|---------|
| ● Cyan "Active" | This connection is selected and Docker is reachable |
| ● Orange "Unreachable" | This connection is selected but Docker isn't responding |
| ○ Grey "Inactive" | Saved but not currently selected |

Each connection has an **Activate** button (switch to it) and a **Remove** button (delete it). You can have as many connections as you want — only one is active at a time.

### Adding a Connection

1. Click **+ Add Connection** in the connections panel
2. Choose **Local Docker** (Unix socket) or **Remote Docker** (TCP)
3. Give it a name (e.g. "AWS Production", "GCP Dev VM", "Local Docker")
4. Enter the socket path or host/port
5. Click **Test Connection** — verify you see "✓ Connected — Docker X.X"
6. Click **Save & Connect**

The new connection becomes active immediately and the fleet dashboard loads its containers.

### Connecting Local Docker (Docker Desktop / Docker Engine)

**Default socket path:** `/var/run/docker.sock` (Linux/macOS) or `//./pipe/docker_engine` (Windows)

If running Bulwark in Docker, the socket must be mounted in `docker-compose.yml`:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
group_add:
  - "0"  # Docker socket access
```

Then add a Local Docker connection with the default socket path.

### Connecting Remote Docker (AWS, GCP, any server)

Remote Docker engines must have TCP enabled on the target server:

```bash
# On the remote server:
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/override.conf <<'EOF'
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2375
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

Then add a Remote Docker connection with the server's IP and port `2375`.

> **Security:** Port 2375 is unencrypted. For production, use TLS on port 2376 and restrict access with firewall rules. Only expose Docker TCP on trusted networks.

### Switching Between Connections

Click **Activate** on any saved connection. The fleet dashboard reloads with that engine's containers, images, and stats. Previous connections stay saved — switch back anytime.

### Fleet Dashboard

Once connected, you see:

| Tab | What it shows |
|-----|---------------|
| **Containers** | All containers with state, image, ports, CPU/memory stats |
| **Deploy** | Create and start new containers from images |
| **Images** | Pulled images with size, tags, pull/remove actions |
| **Networks & Volumes** | Docker networks and persistent volumes |
| **System** | Disk usage, system info, prune operations |
| **AI Assistant** | Ask questions about your Docker fleet in natural language |

### AI Fleet Intelligence

Click **Analyze** for an AI-powered summary of your container fleet — resource efficiency, security observations, and optimization recommendations. Requires Claude CLI.

### Docker FAQ

**Q: Docker shows "No Connections" or "Docker Unreachable".**
A: Click **+ Add Connection** and follow the setup steps above. For local Docker, make sure the daemon is running (`docker ps` in a terminal). For remote, ensure TCP is enabled and the firewall allows the port.

**Q: I added a local connection but it says "Unreachable".**
A: If Bulwark runs in Docker, the socket must be mounted as a volume. Add `/var/run/docker.sock:/var/run/docker.sock` to your `docker-compose.yml` volumes and `group_add: ["0"]` for socket permissions. Rebuild with `docker compose up -d --build`.

**Q: Can I manage Docker on AWS / GCP / remote servers?**
A: Yes. Add a Remote Docker connection with the server's IP and port. The remote Docker daemon must have TCP enabled (see "Connecting Remote Docker" above). You can save multiple remote connections and switch between them.

**Q: How do I disconnect or remove a connection?**
A: Click **Remove** next to any connection in the panel. A confirmation dialog appears. Removing the active connection auto-activates the next one, or shows the empty state if none remain.

**Q: Can I have multiple connections saved?**
A: Yes. Save as many as you need (local, AWS, GCP, staging, production). Only one is active at a time. Click **Activate** to switch.

**Q: What's the difference between Activate and Remove?**
A: **Activate** switches which Docker engine Bulwark talks to (non-destructive, instant). **Remove** deletes the saved connection permanently (you can re-add it later).

**Q: How do I set up SSH keys for a new cloud VM (GCP/AWS)?**
A: Generate a key pair locally, then add the public key to the VM:

1. Generate: `ssh-keygen -t ed25519 -f ~/.ssh/my-server -C "user@hostname"`
2. Add the public key to the VM:
   - **GCP:** SSH into the VM via the browser console (GCP Console → VM → SSH button), then run:
     ```bash
     mkdir -p ~/.ssh && echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
     ```
   - **AWS:** Add the key when creating the instance, or use EC2 Instance Connect
3. Test: `ssh -i ~/.ssh/my-server user@VM_IP "hostname"`

**Q: How do I open the Docker TCP port on GCP?**
A: Two steps — enable Docker TCP on the VM, then open the GCP firewall:

1. SSH into the VM and enable TCP:
   ```bash
   sudo mkdir -p /etc/systemd/system/docker.service.d
   sudo tee /etc/systemd/system/docker.service.d/override.conf <<'EOF'
   [Service]
   ExecStart=
   ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2375
   EOF
   sudo systemctl daemon-reload && sudo systemctl restart docker
   ```
2. GCP Console → VPC Network → Firewall → Create Firewall Rule:
   - Name: `allow-docker-tcp`
   - Direction: Ingress, Action: Allow
   - Targets: All instances
   - Source IPv4 ranges: `0.0.0.0/0` (or your IP for security)
   - TCP port: `2375`
3. Verify from your local machine: `curl http://VM_IP:2375/_ping` → should return `OK`
4. Then add the connection in Bulwark via the GUI.

## 9. PM2

Monitor and manage PM2 process manager instances.

### PM2 FAQ

**Q: PM2 shows "No processes found".**
A: PM2 must be installed and running on the server. Install with `npm install -g pm2`, then start your app with `pm2 start app.js`.

**Q: Can I restart processes from Bulwark?**
A: Yes. Click the restart button next to any process, or use the Terminal to run `pm2 restart <name>`.

## 10. SSL / Domains

Manage SSL/TLS certificates, Nginx virtual hosts, and domain configurations.

### Requirements

SSL/Domains requires the **adapter service** (port 4001) running on a Linux server with:
- **Nginx** installed and running
- **Certbot** (Let's Encrypt client) installed
- Ports **80** and **443** open to the internet
- A **real domain** with DNS pointing to the server

> **Note:** This feature does NOT work on local Docker Desktop or Windows. It requires a cloud Ubuntu server (AWS, GCP, etc.) with Nginx. If you see "degraded" or empty state, the adapter service isn't running.

### Setting Up SSL on Ubuntu (Cloud Server)

#### 1. Install Nginx + Certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
```

#### 2. Point Your Domain
Add an A record in your DNS provider (Cloudflare, Route53, etc.):
```
A   yourdomain.com      → YOUR_SERVER_IP
A   *.yourdomain.com    → YOUR_SERVER_IP   (wildcard, optional)
```

#### 3. Start the Adapter Service
The adapter service runs alongside Bulwark and manages Nginx/Certbot:
```bash
cd dev-monitor/adapter
npm install
PORT=4001 npm start
```

Or with Docker, add the adapter to your `docker-compose.yml`.

#### 4. Issue a Certificate
Once the adapter is running:
1. Go to **SSL / Domains** in Bulwark
2. Click **+ Issue Certificate**
3. Enter your domain (e.g. `app.yourdomain.com`)
4. Bulwark calls Certbot, which validates via HTTP-01 challenge on port 80
5. Certificate auto-installs in Nginx

#### 5. Manage Virtual Hosts
Create Nginx vhosts directly from the UI:
- Add a domain with upstream (e.g. proxy to `localhost:3000`)
- Enable SSL with one click (uses the issued certificate)
- Edit or delete vhosts as needed

### SSL FAQ

**Q: SSL / Domains shows "degraded" or is empty.**
A: The adapter service (port 4001) isn't running. This feature requires a Linux server with Nginx and Certbot. It won't work on local Docker Desktop or Windows — deploy to a cloud server first.

**Q: How do I add an SSL certificate?**
A: Go to SSL / Domains and click **+ Issue Certificate**. Enter your domain — Bulwark uses Let's Encrypt via Certbot to issue and auto-install the certificate in Nginx.

**Q: Does it support Let's Encrypt?**
A: Yes. Certbot handles issuance and auto-renewal. Certificates renew automatically before expiry.

**Q: Can I use my own certificate (not Let's Encrypt)?**
A: Yes. Paste your certificate and private key manually via the adapter, or place them in the standard Nginx SSL directory and configure the vhost.

**Q: Do I need port 80 open?**
A: Yes, for the Let's Encrypt HTTP-01 challenge. Port 80 must be reachable from the internet during certificate issuance. You can close it after if you redirect all traffic to 443.

**Q: Can I set this up on GCP / AWS?**
A: Yes. Any Ubuntu server with a public IP, ports 80/443 open, and DNS pointing to it. Install Nginx + Certbot, start the adapter service, then manage everything from the Bulwark GUI.

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

![DB Projects — Active Connection, Stats, Connection String](../media/screenshots/database_project_1.png)

### What You See

The Projects view shows your active database connection with real-time stats:

| Stat | Description |
|------|-------------|
| **Status** | Green dot = connected, orange = disconnected |
| **Database** | Name (e.g. `my_project_db`) |
| **Size** | Database size on disk (e.g. 19 MB) |
| **Connections** | Active connection count |
| **Version** | PostgreSQL version (e.g. 17.8) |

The connection string is displayed (password masked) along with SSL status and creation date.

### Adding an External Database

1. Go to **Database > Projects** in the sidebar
2. Click **+ Add Project**
3. Enter your connection string:
   ```
   postgresql://user:password@host:5432/dbname
   ```
4. Click **Test Connection**, then **Save**

Switch between connections using the database picker in the top bar of any Database view. All Database views (SQL Editor, Tables, Schema, Migrations, Roles, Backups, AI Assistant) share the same active project.

### Projects FAQ

**Q: Can I connect to multiple databases?**
A: Yes. Add as many projects as you need. Switch between them with the database picker dropdown at the top of every Database view.

**Q: Does it support MySQL or SQLite?**
A: Currently PostgreSQL only. MySQL and SQLite support is planned.

**Q: The project shows "disconnected" or orange status.**
A: Check that the database server is running and the connection string is correct. Click **Manage Projects** in the top bar to edit or test the connection.

## 13. SQL Editor

Write and run SQL queries with AI-powered autocompletion, syntax highlighting, and query history.

![SQL Editor — CodeMirror, Query History, Run/Ask Claude/Save/Export](../media/screenshots/sql_Editor.png)

### What You See

The SQL Editor features:

- **CodeMirror editor** with SQL syntax highlighting (material-darker theme) and autocomplete
- **Toolbar buttons:** Run, Ask Claude (AI SQL generation), Save (named queries), Export CSV
- **Query History sidebar** — recent queries with timestamps, click to reload
- **Results panel** — query results displayed as a sortable table below the editor

### SQL Editor FAQ

**Q: How do I use AI to generate SQL?**
A: Click **Ask Claude** in the SQL Editor toolbar. Describe what you want in plain English (e.g. "show table sizes sorted by largest") and Claude will generate the SQL. Requires Claude CLI to be authenticated.

**Q: Can I run destructive queries (DROP, ALTER)?**
A: DDL statements are blocked by default. To run them, the query must include the `?allow_ddl=true` parameter. This is a safety measure.

**Q: Where is query history stored?**
A: In `data/query-history.json`. The last 100 queries are kept. You can also save named queries with the **Save** button for quick access.

**Q: Can I export query results?**
A: Yes. Click **Export CSV** after running a query to download the results as a CSV file.

## 14. Tables

Browse your database schema — columns, data, constraints, foreign keys, and indexes in a two-panel layout.

![Tables — Two-Panel Layout, Table List, Columns/Data/Constraints/FK/Indexes Tabs](../media/screenshots/tables_3.png)

### What You See

The Tables view uses a two-panel layout:

- **Left panel** — Table list with row count estimates and search filter
- **Right panel** — Detail tabs for the selected table:

| Tab | Shows |
|-----|-------|
| **Columns** | Column name, type, nullable, default value |
| **Data** | Paginated row browser with sorting |
| **Constraints** | Primary keys, unique constraints, check constraints |
| **Foreign Keys** | FK relationships to other tables |
| **Indexes** | Index definitions with size and type |

Click any table in the left panel to load its details on the right.

### Tables FAQ

**Q: Can I edit data directly?**
A: The Tables view is read-only for safety. Use the SQL Editor to run INSERT/UPDATE/DELETE statements.

**Q: Why do some tables show 0 rows?**
A: Row counts are estimates from PostgreSQL statistics. Run `ANALYZE` on your database to update the estimates, or click into the table to see actual row data.

**Q: How do I search for a specific table?**
A: Use the search box at the top of the left panel. It filters the table list as you type.

## 15. Schema

Explore database functions, triggers, extensions, and indexes.

![Schema — Functions Tab with Name, Arguments, Return Type, Language](../media/screenshots/schema_4.png)

### What You See

The Schema Browser organizes database objects into four tabs:

| Tab | Count Example | Shows |
|-----|--------------|-------|
| **Functions** | 140 | Function name, arguments, return type, language (sql/plpgsql) |
| **Triggers** | 54 | Trigger name, event, table, timing (BEFORE/AFTER) |
| **Extensions** | 4-5 | Extension name, version, schema |
| **Indexes** | 592 | Index name, table, definition, size |

Each tab shows a count badge so you can see the total objects at a glance.

### Schema FAQ

**Q: Can I create functions or triggers from here?**
A: The Schema view is read-only for browsing. Use the SQL Editor to create or modify database objects.

**Q: What extensions are available?**
A: Shows all installed PostgreSQL extensions (e.g. pg_stat_statements, uuid-ossp, pgcrypto). Install new ones via SQL: `CREATE EXTENSION extension_name;`

**Q: Why do I see so many functions?**
A: PostgreSQL includes many built-in functions. The list shows all functions in your database, including system functions and those created by extensions.

## 16. Migrations

Track applied vs pending database migrations. Supports Docker test-runs and schema diffs.

![Migrations — Migration Manager, Pending Files, View/Apply/Test Buttons](../media/screenshots/migration_5.png)

### What You See

The Migration Manager shows:

- **Summary bar** — Total migrations, applied count, pending count, pool (dev/vps)
- **Migration list** — Each `.sql` file with status badge (Applied/Pending)
- **Action buttons per migration:**

| Button | Action |
|--------|--------|
| **View** | Preview the SQL contents of the migration file |
| **Apply** | Execute the migration against the live database |
| **Test** | Docker test-run: spin up temp PG, apply, validate, destroy |

- **Schema Diff** button — Compare live database schema against `schema.sql`
- **Docker Test** button — Bulk test all pending migrations in a disposable container

### Migrations FAQ

**Q: Where do migration files go?**
A: Place `.sql` files in your project's migration directory. Bulwark scans the filesystem and compares against applied migrations in the database.

**Q: Can I test a migration before applying?**
A: Yes. Click **Test** next to any migration to spin up a temporary PostgreSQL container, apply the migration, validate, and destroy — without touching your live database. Requires Docker.

**Q: What does Schema Diff do?**
A: Compares your live database schema against `schema.sql` and shows the differences — useful for catching drift between code and production.

## 17. Roles

View PostgreSQL roles, table-level permissions, and run AI security audits.

![Roles — Role List, Permission Heatmap, AI Security Audit, Table Permissions](../media/screenshots/roles_6.png)

### What You See

The Roles view has a two-panel layout:

- **Left panel** — Role list showing all PostgreSQL roles with badges (SUPER, LOGIN)
- **Right panel** — Selected role details: superuser status, login ability, create DB, create role, connection limit, expiry

**Three tabs:**

| Tab | Shows |
|-----|-------|
| **Overview** | Role properties + table-level permissions (SELECT, INSERT, UPDATE, DELETE) |
| **Permission Heatmap** | Visual grid of all roles vs all tables — cyan = granted, dash = denied |
| **Security Findings** | AI-generated security audit results |

**Summary bar** shows: Total Roles, Superusers, Login Roles, Active Connections.

**Top-right buttons:** AI Security Audit, Create Role.

### Roles FAQ

**Q: What does the AI security audit do?**
A: Click **AI Security Audit**. Claude analyzes all database roles, their permissions, and privilege levels, then returns a security score with specific findings and recommendations. Requires Claude CLI.

**Q: Can I create roles from here?**
A: Click **Create Role** or use the **AI Analyze** button on any role. You can also describe what the role needs in plain English and Claude generates the least-privilege SQL.

**Q: What do the role badges mean?**
A: **SUPER** = superuser (full access), **LOGIN** = can log in to the database. Roles without LOGIN are group roles used for permission inheritance.

## 18. Backups

Create and restore PostgreSQL backups with AI-powered backup strategy analysis.

![Backups — Backup List, Create/Download/Restore/Delete, AI Strategy](../media/screenshots/backups_7.png)

### What You See

The Backup Intelligence Center shows:

- **Summary bar** — Backup count, total size, last backup age, oldest backup age
- **Create Backup** button — Runs `pg_dump` and saves to `data/backups/`

**Three tabs:**

| Tab | Shows |
|-----|-------|
| **Backups** | List of backup files with status, filename, size, created date, age |
| **AI Strategy** | AI-generated backup strategy with health score and recommendations |
| **Disaster Recovery** | AI-generated DR plan with RPO/RTO targets |

Each backup has action buttons: **Download**, **Restore**, **Delete**.

Age indicators use color coding: cyan = recent (healthy), orange = old (needs attention).

### Backups FAQ

**Q: How do I create a backup?**
A: Click **Create Backup** in the top right. Bulwark runs `pg_dump` and saves the SQL file to `data/backups/` with a timestamp filename.

**Q: pg_dump says "version mismatch".**
A: Your pg_dump client version must match or exceed your PostgreSQL server version. The Docker image includes pg_dump 17. For manual installs, install `postgresql-client-17`.

**Q: What if pg_dump isn't installed?**
A: Bulwark falls back to SQL-based export, dumping schema and data via PostgreSQL queries. Less feature-complete than pg_dump but works everywhere.

**Q: What does AI Strategy do?**
A: Click **AI Strategy**. Claude analyzes your backup history, database size, and configuration, then provides a health score, disaster recovery plan, and specific recommendations.

**Q: How do I restore a backup?**
A: Click **Restore** next to any backup in the list. A confirmation dialog appears — this will overwrite the current database contents.

## 19. AI Assistant

A conversational AI assistant for database operations — ask questions about your schema, generate queries, and get optimization advice.

![AI Assistant — Chat Interface, Quick Prompts, Action Buttons](../media/screenshots/ai_assit_8.png)

### What You See

The AI Database Assistant has:

- **Connection banner** — Shows active project, database name, table count, index count, size
- **Three tabs:** AI Chat, Health, Deploy Check
- **Chat interface** — Conversational AI with full context of your database schema, indexes, constraints, and health metrics
- **Quick prompt cards** — Pre-built prompts to get started:
  - "What tables have the most rows?"
  - "Find tables missing timestamps"
  - "Generate backup script"
  - "Map FK relationships"
- **Action buttons** at the bottom: Diagnose, Optimize, Deploy Script, Migration, Table Report
- **Text input** — Type any question about your database

### AI Assistant FAQ

**Q: What can I ask the AI Assistant?**
A: Anything about your database — "show me the largest tables", "generate an index for slow queries", "explain this schema", "find tables without primary keys". It has full context about your connected database including all tables, columns, indexes, and constraints.

**Q: Which AI provider does it use?**
A: Whatever is configured in Settings > AI Provider. Default is Claude CLI. Also supports Codex CLI or none.

**Q: What do the action buttons do?**
A: They send pre-built prompts: **Diagnose** checks for issues, **Optimize** suggests performance improvements, **Deploy Script** generates deployment SQL, **Migration** creates migration files, **Table Report** summarizes your schema.

---

## DevOps

---

## 20. Terminal

Full-screen terminal with three tabs: Shell, Bulwark AI, and Credential Vault.

![Terminal — Bulwark AI Tab, Quick Actions, Natural Language Input](../media/screenshots/terminal_1.png)

### Three Tabs

| Tab | Purpose |
|-----|---------|
| **Shell** | Full PTY terminal (bash/PowerShell). Run any command. |
| **Bulwark AI** | Natural language DevOps assistant with quick action buttons. |
| **Vault** | AES-256-GCM encrypted credential storage. |

### Bulwark AI Tab

The AI tab provides a natural language interface to your server. Type commands in plain English and Bulwark generates and executes them.

**Quick action buttons** for common tasks:

| Button | What it does |
|--------|-------------|
| **SSH into production** | Connects to your production server |
| **Check disk space** | Runs disk usage analysis |
| **Restart Docker containers** | Restarts your Docker fleet |
| **Show PM2 logs** | Displays PM2 process logs |
| **Deploy latest changes** | Runs your deploy pipeline |
| **Analyze server health** | Full system health check |

Type anything in the **"Ask Bulwark anything..."** input at the bottom. Requires Claude CLI to be authenticated.

### Credential Vault

![Vault — Add Credential Modal, SSH Key, AES-256-GCM Encryption](../media/screenshots/fault_1.png)

Click the **Vault** tab to manage encrypted credentials. Click **+ Add** to store a new credential:

| Field | Description |
|-------|-------------|
| **Name** | Friendly name (e.g. "My Server") |
| **Type** | SSH Key, API Token, Database, or Generic |
| **Host** | Server IP or hostname |
| **Port** | Connection port (default: 22 for SSH) |
| **Username** | Login username |
| **Private Key** | Paste your private key (SSH type) |
| **Tags** | Comma-separated labels (e.g. "production, aws") |

All credentials are **encrypted with AES-256-GCM** and never leave the server unencrypted. Click the play button next to any saved SSH credential to connect directly from the terminal.

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

**Q: How secure is the Vault?**
A: Credentials are encrypted with AES-256-GCM using a server-side key. They are stored in `data/credentials.json` and never transmitted in plaintext. The encryption key is derived from `ENCRYPTION_KEY` in your `.env` file (auto-generated on first run if not set).

**Q: Can I SSH directly from the Vault?**
A: Yes. Save an SSH Key credential with the host, port, username, and private key. Click the play button next to it to open an SSH session in the Shell tab.

## 21. Tickets

Support ticket system with 7-column Kanban board, drag-and-drop workflow, AI triage, and approval workflows.

![Tickets — Kanban Board, AI Triage, New Ticket, Approve/Reject](../media/screenshots/tickets_sidebar.png)

### What You See

The Tickets view is a **7-column Kanban board** showing tickets across the full development lifecycle:

| Column | Purpose |
|--------|---------|
| **Pending** | New tickets, not yet investigated |
| **Analyzing** | Being investigated or triaged |
| **Fixing** | Active development in progress |
| **Testing** | Fix is being tested/validated |
| **Awaiting Approval** | Ready for review — shows Approve/Reject buttons |
| **Approved** | Approved — auto-pushes the fix branch to git |
| **Deployed** | Live in production |

**Status bar** at the top shows ticket counts per column with color-coded badges.

Each ticket card shows:
- **Subject** and **description** (truncated)
- **Priority badge** (critical/high/normal/low) with color coding
- **Type badge** (bug/feature/task)
- **Branch name** in cyan (if assigned)
- **Action buttons:** AI (analyze), View (detail modal), Del (delete)

### Creating Tickets

Click **+ New Ticket** in the top right to open the create modal:

| Field | Options |
|-------|---------|
| **Subject** | Brief summary of the issue |
| **Description** | Detailed description |
| **Type** | Bug, Feature, Task, Improvement |
| **Priority** | Low, Normal, High, Critical |
| **Environment** | Dev, Staging, Production |

### AI Features

**AI Triage** (top right) — Claude bulk-analyzes all pending tickets and returns:
- Recommended priority and status for each ticket
- Category label (frontend, backend, infrastructure, security, performance)
- One-sentence analysis and suggested fix
- Results appear as a table above the Kanban board

**AI Analyze** (per ticket) — Click the **AI** button on any card, or click **AI Analyze** inside the detail modal. Claude provides:
- Root cause analysis (2-3 sentences)
- Recommended priority and next status
- 3-5 actionable fix steps
- Effort estimate (trivial/small/medium/large)
- Risk level (low/medium/high)
- Related system areas

### Workflow

- **Drag and drop** cards between columns to change status
- **Approve** button (Awaiting Approval column) — approves the ticket and auto-pushes the fix branch
- **Reject** button — sends ticket back to Fixing with a reason note
- Real-time updates via WebSocket — changes by other users appear instantly

### Tickets FAQ

**Q: Where are tickets stored?**
A: In the PostgreSQL `support_tickets` table. Tickets work when a database is connected.

**Q: Can I use tickets without a database?**
A: No. The ticket system requires PostgreSQL. Without it, the view shows empty.

**Q: How does AI Triage work?**
A: Click **AI Triage** — Claude analyzes all pending/analyzing tickets at once, recommends priority, status, and a fix suggestion for each. Requires Claude CLI to be authenticated.

**Q: What happens when I approve a ticket?**
A: The ticket moves to "Approved" and Bulwark auto-pushes the ticket's `fix_branch` to git origin. An activity log entry is created.

**Q: Can I assign tickets to team members?**
A: The `assigned_to` field exists in the database but is not yet exposed in the UI. You can set it via the SQL Editor.

## 22. Git

Full Git operations with AI intelligence. Manage branches, view commits, stage changes, stash, and generate AI-powered commit messages.

### What You See

- **Git Intelligence** — AI analyzes your repo (branch strategy, commit patterns, workflow recommendations)
- **Repository selector** — switch between configured repos via dropdown
- **Branch info** — current branch, status (changed files count), remote URL
- **Tabs:** Commits, Branches, Changes, AI Commit, AI PR, Stash, Stats, Heatmap
- **Changes tab** — unstaged/staged changes with full diff view (additions green, deletions red)
- **Pull / Push / Refresh** buttons for quick git operations

### Git FAQ

**Q: What repository does it use?**
A: Bulwark uses the `REPO_DIR` environment variable. Click **+ Add Repo** to manage multiple repositories. Switch between them via the dropdown.

**Q: How does AI commit message generation work?**
A: The **AI Commit** tab analyzes your staged changes and writes a descriptive commit message. Requires Claude CLI.

**Q: Can I manage branches?**
A: Yes. The **Branches** tab shows all local and remote branches. Create, switch, merge, or delete branches.

**Q: What does Git Intelligence show?**
A: AI analyzes your entire repo — commit patterns, branch strategy, workflow health, and recommendations. Click **Analyze** to run.

## 23. Deploy

Deployment pipeline with AI intelligence, build profiles, environment management, and rollback support.

### What You See

- **Deploy Intelligence** — AI assesses your uncommitted changes and deployment readiness
- **Tabs:** Pipeline, Environments, History, Build Profiles
- **Build Profiles** — pre-configured templates: Next.js SaaS, Docker Deploy, Static Site, Node.js API. Click **Use as Template** to apply.
- **Pipeline** — run deployments with real-time output
- **History** — full deploy log with rollback capability

### Deploy FAQ

**Q: How do I set up a deploy target?**
A: Go to the **Environments** tab and add a target with host, branch, and deploy commands. Or use a **Build Profile** template for common setups (Next.js, Docker, Static, Node.js API).

**Q: Can I rollback a deployment?**
A: Yes. The **History** tab logs every deploy with timestamp. Click **Rollback** to revert.

**Q: What does Deploy Intelligence do?**
A: AI analyzes your uncommitted changes, modified files, and repo state, then gives a go/no-go assessment with recommendations before deploying.

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

Full calendar with month/week/agenda views, AI schedule briefing, and event planning.

### What You See

- **AI Schedule Briefing** — AI summary of upcoming events and priorities
- **View modes:** Month, Week, Agenda, AI Planner
- **Stats cards:** Today's events, This Week, Total, High Priority (orange)
- **Monthly calendar** — current day highlighted in cyan, click any day to add events
- **Events** stored in `data/calendar.json`

### Calendar FAQ

**Q: Does it sync with Google Calendar?**
A: Not currently. Events are stored locally. External calendar sync is on the roadmap.

**Q: What views are available?**
A: Month (grid), Week (7-day timeline), Agenda (list), and AI Planner (AI-powered scheduling recommendations).

**Q: Can I set reminders?**
A: Events appear on the Dashboard. Push notification reminders are planned.

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

Comprehensive security scanning with a 100-point security score, AI-powered posture analysis, and multi-tab security views.

### What You See

- **Bulwark Security Advisor** — AI analyzes your security posture. Click **Analyze Security Posture** for a full report.
- **Security Score** — letter grade (A-F) out of 100 points
- **Tabs:** Posture, Secret Scan, Dependencies, Events, Firewall, SSH Keys
- **Posture checks:** .env in .gitignore, .gitignore present, hardcoded secrets detection, dependency lock file, Node.js version, HTTPS/TLS, auth security (2FA), open ports, npm audit
- **Re-scan** button to refresh all checks

### Security Center FAQ

**Q: What does the security scan check?**
A: Nine categories: .env exposure, .gitignore presence, hardcoded secrets, dependency lock, Node.js version, HTTPS/TLS, auth security (2FA status), open ports, and npm audit. Each check contributes to the 100-point score.

**Q: What is the Security Score?**
A: A composite score from 0-100 with a letter grade (A = 90+, B = 80+, etc.). All checks passing gives 100/100 (grade A).

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

Notification channels for email, Discord, Slack, and Telegram alerts. Get notified when endpoints go down, deploys fail, or security issues arise.

### What You See
- **SMTP Status Banner** — shows whether email is configured (links to Settings)
- **Channel Cards** — each channel shows type, recipient, event filters, enable/disable toggle
- **Add Channel** button — create Email, Discord, Slack, or Telegram channels
- **Send Email** button — compose and send an ad-hoc email alert with AI assistance
- **Event Filters** — choose which events trigger each channel (uptime, deploy, security, system, cron, git)

### Notifications FAQ

**Q: What triggers notifications?**
A: Automatic triggers fire on: uptime endpoint state changes (down/up), deploy success/failure, and security scan alerts. Each channel can filter which event types it receives.

**Q: How do I set up email alerts?**
A: First configure SMTP in **Settings > Email (SMTP)** — use Gmail (App Password), Outlook, or any SMTP server. Then add an Email channel here with the recipient address. Click **Test** to verify delivery.

**Q: Can I CC other people on alerts?**
A: Yes. When adding an email channel, enter a CC address. All alerts sent to that channel will CC the additional recipient.

**Q: What is AI Compose?**
A: Click **Send Email > AI Compose** to have AI write a professional alert email body from your subject line and notes. Useful for escalation emails.

**Q: Can I get alerts on Discord/Slack/Telegram?**
A: Yes. Add a channel with the webhook URL (Discord/Slack) or bot token + chat ID (Telegram). Click **AI Setup Guide** for step-by-step instructions.

**Q: How do I set up Gmail SMTP?**
A: Enable 2-Step Verification on your Google account, then go to myaccount.google.com/apppasswords and create an App Password. Use `smtp.gmail.com` port `587` with your Gmail address and the 16-character app password.

**Q: Can I also do this from the terminal?**
A: Yes. Use curl to test your SMTP or send alerts directly:
```bash
# Test SMTP connection
curl -X POST http://localhost:3001/api/notifications/test-smtp \
  -H "Content-Type: application/json" \
  -b "monitor_session=TOKEN" \
  -d '{"host":"smtp.gmail.com","port":587,"user":"you@gmail.com","pass":"app-password","to":"test@example.com"}'

# Add an email channel
curl -X POST http://localhost:3001/api/notifications/channels \
  -H "Content-Type: application/json" \
  -b "monitor_session=TOKEN" \
  -d '{"type":"email","name":"My Alerts","email":"you@example.com","cc":"team@example.com","events":["uptime","deploy"]}'

# Send ad-hoc email
curl -X POST http://localhost:3001/api/notifications/send-email \
  -H "Content-Type: application/json" \
  -b "monitor_session=TOKEN" \
  -d '{"to":"you@example.com","subject":"Server Alert","body":"<p>Server is down</p>"}'

# Push a bell notification (auto-dispatches to all channels)
curl -X POST http://localhost:3001/api/notification-center \
  -H "Content-Type: application/json" \
  -b "monitor_session=TOKEN" \
  -d '{"category":"system","title":"Test Alert","message":"Testing the system","severity":"warning"}'
```

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
