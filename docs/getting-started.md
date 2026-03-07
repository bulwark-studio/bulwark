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

Manage Cloudflare DNS records, tunnels, and zone settings from a single GUI.

### What You See

- **AI Cloudflare Advisor** — AI analyzes your DNS configuration, security settings, and optimization opportunities
- **Zone List** — all domains in your Cloudflare account with status (active/pending)
- **DNS Records** — full list of A, AAAA, CNAME, TXT, MX records with proxy status (orange cloud = proxied)
- **Tunnels** — Cloudflare Tunnel connections with status, created date, and endpoints
- **Action buttons:** Add Record, Edit, Delete, Toggle Proxy

### Setting Up Cloudflare

1. Go to **Terminal > Vault** and add a credential:
   - Type: **API Token**
   - Name: "Cloudflare"
   - Paste your Cloudflare API token
2. To create a token: log into [dash.cloudflare.com](https://dash.cloudflare.com) > My Profile > API Tokens > Create Token
3. Use the "Edit zone DNS" template (or create custom with Zone:DNS:Edit + Zone:Zone:Read permissions)
4. Go to **Cloudflare** in the sidebar — it auto-detects your zones and DNS records

### Cloudflare FAQ

**Q: How do I connect Cloudflare?**
A: Add your Cloudflare API token in the Credential Vault (Terminal > Vault > + Add > API Token). Then open the Cloudflare view — it auto-detects all zones and DNS records associated with your token.

**Q: Can I manage Cloudflare Tunnels?**
A: Yes. View, create, and delete tunnels directly from the Cloudflare view. Requires a Cloudflare API token with tunnel permissions (Account:Cloudflare Tunnel:Edit).

**Q: Can I add or edit DNS records?**
A: Yes. Click **+ Add Record** to create new A, CNAME, TXT, or MX records. Click Edit on any existing record to modify it. Changes apply immediately to Cloudflare.

**Q: What's the orange cloud icon?**
A: It means the record is proxied through Cloudflare (traffic goes through their CDN/WAF). A grey cloud means DNS-only (traffic goes directly to your server). Toggle proxy status by clicking the cloud icon.

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

View, create, edit, and delete cron jobs with a visual scheduling UI and expression builder.

### What You See

- **AI Cron Advisor** — AI-generated analysis of your cron schedule, workload distribution, and optimization suggestions
- **Cron Job List** — all configured jobs with name, schedule expression, human-readable timing, command, status (active/paused), last run time, and next run time
- **Action buttons per job:** Edit, Toggle (enable/disable), Run Now, Delete
- **+ New Cron Job** button opens the schedule builder

### Creating a Cron Job

1. Click **+ New Cron Job**
2. Fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Friendly label | "Nightly DB Backup" |
| **Schedule** | Cron expression or use the visual builder | `0 3 * * *` |
| **Command** | Shell command to execute | `pg_dump mydb > /backups/nightly.sql` |
| **Description** | Optional notes | "Backs up production DB" |

3. The **visual builder** lets you pick: every minute, hourly, daily, weekly, monthly, or custom — without knowing cron syntax
4. **Preview** shows the human-readable interpretation: "Every day at 3:00 AM"
5. Click **Save**

### Cron Jobs FAQ

**Q: Does it manage the system crontab?**
A: Yes. Bulwark reads and writes the system crontab directly. Requires the appropriate permissions on the server (root or the user's own crontab).

**Q: Can I test a cron schedule before saving?**
A: Yes. The scheduling UI shows a human-readable preview of when the job will run next (e.g. "Every day at 3:00 AM"). Click **Run Now** on any saved job to execute it immediately without waiting for the schedule.

**Q: What happens if a cron job fails?**
A: Failed jobs are logged with their exit code and stderr output. Check the Logs view or the cron job's last run status for details.

**Q: Can I pause a job without deleting it?**
A: Yes. Click the toggle button to disable a job. It stays in the list but won't execute. Toggle it back on to resume.

## 25. File Manager

Browse, edit, upload, and download files on the server with a dual-pane explorer and built-in code editor.

### What You See

- **AI File Advisor** — AI analyzes your project structure and suggests cleanup, organization improvements
- **Breadcrumb navigation** — click any segment to jump to that directory
- **File/folder tree** — icons for file types, size, modified date, permissions
- **Action buttons:** New File, New Folder, Upload, Download, Rename, Delete
- **Built-in editor** — click any text file to edit inline with syntax highlighting
- **Preview** — image files show a thumbnail preview

### File Manager FAQ

**Q: What directory does it start in?**
A: The file manager starts in the `REPO_DIR` directory (your project root). Navigate using the breadcrumb path or click folders in the tree.

**Q: Can I edit files directly?**
A: Yes. Click any text file (.js, .json, .md, .env, .yml, etc.) to open it in the inline code editor. Make changes and click **Save** to write directly to the server.

**Q: Can I upload files?**
A: Yes. Click **Upload** or drag-and-drop files into the file manager. Supports any file type.

**Q: Can I download files?**
A: Yes. Click the download button next to any file, or right-click and choose Download. For folders, the contents are downloaded as a zip archive.

**Q: Is there a file size limit?**
A: There's no hard limit, but very large files (100MB+) may be slow to open in the editor. The upload limit is configured by your server's max request size.

## 26. Env Variables

View, create, edit, and delete environment variables with a searchable GUI and export support.

### What You See

- **AI Env Advisor** — AI analyzes your environment configuration for security risks and best practices
- **Variable list** — name, value (masked for secrets), source (app/system), created date
- **Search bar** — filter variables by name
- **Action buttons per variable:** Edit, Copy Value, Delete
- **+ Add Variable** button — set new key=value pairs
- **Import / Export** — bulk import from .env file format or export all variables

### Env Variables FAQ

**Q: Are env variables persisted?**
A: Yes. Variables managed through Bulwark are stored in `data/envvars.json` and persist across server restarts. System environment variables (from the OS) are shown as read-only.

**Q: Can I add sensitive values?**
A: Yes, but consider using the **Credential Vault** (Terminal > Vault tab) for sensitive data like API keys and passwords — it uses AES-256-GCM encryption. Env variables are stored in plaintext JSON.

**Q: Can I import from a .env file?**
A: Yes. Click **Import** and paste your `.env` file contents or select a file. Each `KEY=VALUE` line becomes a variable.

**Q: What's the difference between app and system variables?**
A: **App variables** are created in Bulwark and stored in `data/envvars.json` — you can edit and delete them. **System variables** come from the OS environment (`process.env`) — they're read-only in the UI.

**Q: Do changes take effect immediately?**
A: App variables are saved immediately. However, if your application reads env vars at startup, you may need to restart it for changes to take effect.

---

## Workspace

---

## 27. Calendar

Full calendar with month/week/agenda views, AI schedule briefing, event planning, and drag-and-drop scheduling.

### What You See

- **AI Schedule Briefing** — AI summary of upcoming events, priorities, and scheduling conflicts. Click **Analyze** to generate.
- **View modes:** Month, Week, Agenda, AI Planner
- **Stats cards:** Today's events, This Week, Total, High Priority (orange)
- **Monthly calendar** — current day highlighted in cyan, click any day to add events
- **Events** stored in `data/calendar.json`

### Creating an Event

1. Click any day in the month view, or click **+ New Event**
2. Fill in the form:

| Field | Description |
|-------|-------------|
| **Title** | Event name |
| **Date / Time** | Start and optional end time |
| **Priority** | Low, Normal, High (high = orange badge) |
| **Description** | Optional notes or details |
| **Category** | Maintenance, Meeting, Deploy, Reminder, Other |

3. Click **Save** — the event appears on the calendar and the Dashboard widget

### Calendar FAQ

**Q: Does it sync with Google Calendar?**
A: Not currently. Events are stored locally in `data/calendar.json`. External calendar sync (Google, Outlook) is on the roadmap.

**Q: What views are available?**
A: **Month** (full grid), **Week** (7-day timeline with hourly slots), **Agenda** (chronological list), and **AI Planner** (AI-powered scheduling recommendations based on your workload and priorities).

**Q: Can I set reminders?**
A: Events appear on the Dashboard calendar widget. Push notification reminders for upcoming events are planned.

**Q: How does the AI Planner work?**
A: Click the **AI Planner** tab. Claude analyzes your upcoming events, workload patterns, and priorities, then suggests optimal scheduling, identifies conflicts, and recommends time blocks for deep work. Requires Claude CLI.

**Q: Do events respect my timezone?**
A: Yes. Events use the timezone configured in **Settings > Timezone**. If you haven't set one, it defaults to your browser's local timezone.

## 28. Notes

Quick notes with pin support, markdown rendering, and color labels — jot down commands, links, or reminders.

### What You See

- **Note cards** — each note shows title, content preview, timestamp, and optional color label
- **Pinned notes** — pinned items stay at the top, marked with a pin icon
- **+ New Note** button — opens the note editor
- **Search** — filter notes by keyword

### Creating a Note

1. Click **+ New Note**
2. Enter a title and body text (supports markdown)
3. Optional: choose a color label for visual organization
4. Click **Save**

### Notes FAQ

**Q: Where are notes stored?**
A: In `data/notes.json`. Notes persist across sessions and server restarts. They're also visible in the Dashboard notes widget.

**Q: Can I pin important notes?**
A: Yes. Click the pin icon on any note to keep it at the top of the list. Pinned notes also appear first in the Dashboard widget.

**Q: Does it support markdown?**
A: Yes. You can use markdown formatting in note bodies — headers, bold, italic, code blocks, links, and lists all render correctly.

**Q: Can I use notes for runbooks or checklists?**
A: Yes. Use markdown checklists (`- [ ] item`) to create to-do lists or operational runbooks that live right next to your infrastructure.

---

## Security

---

## 29. Security Center

Comprehensive security scanning with a 100-point security score, AI-powered posture analysis, and six security tabs.

### What You See

- **Bulwark Security Advisor** — AI analyzes your security posture. Click **Analyze Security Posture** for a detailed report with specific recommendations.
- **Security Score** — letter grade (A-F) out of 100 points, shown as a large donut chart
- **Six tabs:**

| Tab | What it shows |
|-----|---------------|
| **Posture** | 9-category security checklist with pass/fail indicators |
| **Secret Scan** | Detects hardcoded API keys, tokens, and passwords in your codebase |
| **Dependencies** | npm audit results — vulnerable packages with severity levels |
| **Events** | Security-related events timeline (login attempts, config changes) |
| **Firewall** | Active firewall rules (iptables/ufw) with port status |
| **SSH Keys** | Authorized SSH keys on the server with fingerprints |

- **Posture checks:** .env in .gitignore, .gitignore present, hardcoded secrets, dependency lock file, Node.js version, HTTPS/TLS, auth security (2FA), open ports, npm audit
- **Re-scan** button to refresh all checks instantly

### Understanding the Security Score

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 90-100 | Excellent — all or nearly all checks passing |
| **B** | 80-89 | Good — minor issues to address |
| **C** | 70-79 | Fair — several checks need attention |
| **D** | 60-69 | Poor — significant gaps in security |
| **F** | 0-59 | Critical — immediate action required |

### Security Center FAQ

**Q: What does the security scan check?**
A: Nine categories: .env exposure, .gitignore presence, hardcoded secrets, dependency lock file, Node.js version currency, HTTPS/TLS status, auth security (2FA enabled), open ports, and npm audit vulnerabilities. Each check contributes to the 100-point score.

**Q: What is the Security Score?**
A: A composite score from 0-100 with a letter grade. All checks passing gives 100/100 (grade A). Each failed check deducts points based on severity — a missing .gitignore is less critical than hardcoded secrets.

**Q: How often should I scan?**
A: Run a scan after any infrastructure change (new service, port change, user added, dependency update). Weekly scans are recommended for production servers.

**Q: The firewall tab shows "Unable to detect firewall".**
A: Firewall detection requires `iptables` or `ufw` to be installed and the Bulwark process to have read permissions. On Docker, the firewall rules are from the host — this is expected. On local dev (Windows/macOS), native firewalls use different tools.

**Q: How do I fix a failing security check?**
A: Click any failing check for details. The AI Security Advisor also provides specific remediation steps. Common fixes: add `.env` to `.gitignore`, enable 2FA in Settings, run `npm audit fix`, update Node.js to the latest LTS version.

## 30. FTP

Manage FTP server, user accounts, active sessions, and AI-powered setup assistance.

### What You See

- **AI FTP Advisor** — AI analyzes your FTP configuration and suggests security improvements
- **Server Status** — shows whether an FTP server (vsftpd, ProFTPD, pure-ftpd) is detected and running
- **FTP Users** — list of FTP accounts with username, home directory, and status
- **Active Sessions** — currently connected FTP clients with IP, username, and transfer status
- **+ Add User** button — create new FTP accounts
- **AI Setup Guide** — step-by-step instructions for installing and configuring an FTP server if none is detected

### FTP FAQ

**Q: Does Bulwark include an FTP server?**
A: No. This view manages an existing FTP server running on your system. Bulwark auto-detects vsftpd, ProFTPD, and pure-ftpd. If none is found, the **AI Setup Guide** provides installation instructions for your OS.

**Q: How do I install an FTP server?**
A: Click **AI Setup Guide** for step-by-step instructions. The short version for Ubuntu:
```bash
sudo apt install -y vsftpd
sudo systemctl enable vsftpd
sudo systemctl start vsftpd
```
Then refresh the FTP view in Bulwark — it will detect vsftpd automatically.

**Q: Can I create FTP users?**
A: Yes. Click **+ Add User** to create a new FTP account with a username, password, and home directory. Bulwark creates the system user and configures the FTP server accordingly.

**Q: Is FTP secure?**
A: Plain FTP transmits credentials in cleartext. For production, enable FTPS (FTP over TLS) in your FTP server config, or prefer SFTP (SSH-based) which uses the SSH keys stored in the Credential Vault. The AI FTP Advisor will flag security issues.

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

View and manage the AI intelligence cache — content-addressed storage with anomaly detection and freshness tracking.

### What You See

- **Cache Stats** — total entries, hit rate, total size, oldest entry age
- **Health Ring** — visual indicator of cache health (cyan = healthy, orange = stale/oversized)
- **Cache Tiers** — breakdown of cached content by category (briefings, SQL, security audits, etc.)
- **Entry List** — each cached item shows key, category, size, creation time, last accessed, hit count, and freshness badge
- **Freshness badges:** Fresh (< 5 min), Warm (< 30 min), Aging (< 2 hr), Stale (> 2 hr)
- **Action buttons:** Delete individual entries, Clear All, Force Refresh

### Cache FAQ

**Q: What does the cache store?**
A: AI responses from every AI-powered feature — Dashboard briefings, Metrics analysis, SQL generation, security audits, backup strategy reports, and any other Claude-generated content. Each entry is content-addressed (keyed by the request hash) so identical requests return cached results instantly.

**Q: Can I clear the cache?**
A: Yes. Click **Clear All** to reset the entire cache. You can also delete individual entries by clicking the trash icon. Clearing the cache means AI features will call Claude CLI again on next request.

**Q: Why would I clear the cache?**
A: If your system state has changed significantly (new deployment, major config change, etc.) and you want fresh AI analysis. The cache auto-expires stale entries, but manual clearing forces immediate refresh.

**Q: Does the cache persist across server restarts?**
A: Yes. Cache data is stored on disk and restored when Bulwark starts. Navigating between views also preserves cache state.

**Q: What is anomaly detection?**
A: The cache monitors response patterns. If an AI response is significantly different from previous responses for the same request (e.g., a health score drops 30 points), it flags the entry as anomalous so you can investigate.

## 33. Logs

System logs, audit trail, and activity history — a complete record of who did what and when.

### What You See

- **AI Log Analyst** — AI analyzes recent activity patterns and flags anomalies
- **Log Table** — chronological list of all system events with columns:

| Column | Description |
|--------|-------------|
| **Timestamp** | When the action occurred (respects your timezone setting) |
| **User** | Who performed the action |
| **Action** | What was done (login, query, deploy, settings change, etc.) |
| **Resource** | Which endpoint or feature was accessed |
| **Method** | HTTP method (GET, POST, PUT, DELETE) |
| **IP** | Client IP address |
| **Status** | Result code (200 OK, 401 Unauthorized, 500 Error, etc.) |

- **Filters** — filter by action type, user, or date range
- **Export** — download logs as JSON or CSV

### Logs FAQ

**Q: What gets logged?**
A: Every API call to Bulwark is logged with timestamp, authenticated user, action name, resource path, HTTP method, client IP, and result status code. This creates a complete audit trail for security and compliance.

**Q: Can I export logs?**
A: Yes. Click **Export JSON** or **Export CSV** to download the full audit log. Useful for compliance reporting or importing into external SIEM tools.

**Q: Where are logs stored?**
A: In `data/audit-log.json`. The log file grows over time — consider periodic exports and archival for long-running production servers.

**Q: Can I see who logged in and when?**
A: Yes. Filter the logs by the "login" action to see all authentication events with timestamps and IP addresses. Failed login attempts are also logged.

**Q: Do logs show database queries?**
A: Yes. All SQL queries executed through the SQL Editor are logged with the query text, execution time, and result. Queries are also saved in `data/query-history.json`.

## 34. Multi-Server

Aggregated view across all connected servers — compare health, metrics, and status side by side on a single screen.

### What You See

- **Server Cards** — one card per connected server showing hostname, IP, status (up/down), CPU, memory, disk, uptime
- **Comparison Grid** — side-by-side metrics for all servers: CPU %, memory %, disk %, response time, last check
- **Health Indicators** — cyan = healthy, orange = warning/down
- **Quick Actions** — click any server card to navigate to its detailed view

### Multi-Server FAQ

**Q: How do I add servers to this view?**
A: Servers added in **Infrastructure > Servers** automatically appear here. The view aggregates health data from all connected servers. Your local machine always appears as "Local Dev".

**Q: What if a server is unreachable?**
A: It shows as "unreachable" with an orange indicator and its metrics display "N/A". Other servers continue to report normally. The Uptime view tracks historical availability.

**Q: Can I compare metrics across servers?**
A: Yes. The comparison grid shows CPU, memory, and disk for all servers in a single table. This makes it easy to spot which server is under load or running low on resources.

**Q: How often does it refresh?**
A: Server health checks run every 30 seconds via WebSocket. You can also click **Refresh** to force an immediate check.

## 35. Settings

Account management, 2FA, AI provider, timezone, email/SMTP, audit log, and user management — all in one place.

### What You See

Settings is organized into expandable sections:

| Section | What it contains |
|---------|-----------------|
| **My Account** | Change username and password |
| **Two-Factor Auth** | Enable/disable TOTP 2FA with QR code |
| **AI Provider** | Choose Claude CLI, Codex CLI, or None |
| **Timezone** | Set your local timezone for all date/time displays |
| **Email (SMTP)** | Configure outgoing email for notifications |
| **Audit Log** | Full activity log with export (JSON/CSV) |
| **User Management** | Add/edit/delete users, assign roles (admin only) |

### Setting Up Your Timezone

Cloud-hosted Bulwark instances may be in a different timezone than you. Set your local timezone so all dates and times display correctly:

1. Go to **Settings > Timezone**
2. Select your timezone from the dropdown (e.g. "America/New_York", "Europe/London", "Asia/Tokyo")
3. Or click **Auto-detect** to use your browser's timezone
4. Quick presets are available for common US/EU/Asia timezones
5. The **live preview** shows the current time in your selected zone
6. Click **Save Settings**

All views (Dashboard, Calendar, Logs, Notifications, etc.) will now display times in your timezone.

### Setting Up Email (SMTP)

Configure SMTP so Bulwark can send email notifications, alerts, and ad-hoc messages:

1. Go to **Settings > Email (SMTP)**
2. Choose a preset (**Gmail**, **Outlook**, or **Custom**) or fill in manually:

| Field | Gmail Example | Outlook Example |
|-------|---------------|-----------------|
| **SMTP Host** | `smtp.gmail.com` | `smtp.office365.com` |
| **Port** | `587` | `587` |
| **Username** | `you@gmail.com` | `you@outlook.com` |
| **Password** | Gmail App Password | Your password |
| **From Address** | `you@gmail.com` | `you@outlook.com` |

3. Click **Send Test Email** to verify — you'll receive a test message at your SMTP username
4. Click **Save Settings**

Once saved, the SMTP status indicator turns cyan and Bulwark can send email alerts via **Notifications > Add Channel > Email**.

#### Gmail App Password (Step by Step)

Gmail requires an App Password instead of your regular password:

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security > 2-Step Verification — enable it if not already on
3. Security > App passwords (or search "App passwords" in account settings)
4. Create a new app password — name it "Bulwark" or anything you like
5. Google gives you a 16-character password (like `abcd efgh ijkl mnop`)
6. Paste this into the SMTP Password field in Bulwark Settings (spaces don't matter)

### Settings FAQ

**Q: How do I change my password?**
A: Go to Settings > My Account and click **Change Password**. Enter your current password, then your new password twice.

**Q: How do I enable 2FA?**
A: Go to Settings > Two-Factor Authentication and click **Enable 2FA**. Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.). Enter the 6-digit code to confirm. After this, every login requires a 2FA code.

**Q: How do I switch AI providers?**
A: Go to Settings > AI Provider. Choose between:
- **Claude CLI** — requires Anthropic subscription, best for most features
- **Codex CLI** — requires OpenAI API key, alternative provider
- **None** — disables all AI features (everything else still works)

**Q: Can I add more users?**
A: Yes (admin only). Go to Settings > User Management > **+ Add User**. Each user gets a role:
- **Admin** — full access to everything including Settings and User Management
- **Editor** — can modify data (create tickets, run queries, deploy) but can't manage users or settings
- **Viewer** — read-only access to all views

**Q: How do I set up email notifications?**
A: Two steps: (1) Configure SMTP in Settings > Email (see above), (2) Add email channels in Notifications > + Add Channel > Email. See the [Notifications section](#31-notifications) for details.

**Q: The SMTP test email didn't arrive.**
A: Check: (1) SMTP host and port are correct, (2) Username/password are right (use App Password for Gmail), (3) "From" address matches your SMTP account, (4) Check your spam/junk folder. The test result shows the exact SMTP error if the connection fails.

**Q: Where is the audit log?**
A: Settings > Audit Log. It shows every action taken in Bulwark with timestamps, user, IP, and result. Click **Export JSON** or **Export CSV** to download.

---

## 36. MCP Server

Connect AI agents (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, or any MCP-compatible client) to Bulwark via the Model Context Protocol. Once connected, your AI assistant can check server health, manage Docker containers, query databases, handle tickets, and more — all through natural conversation.

### What You See

- **Connection Info** — Endpoint URL (e.g. `https://your-server.com/mcp`), transport type, live status indicator
- **Stats** — Tool count (18), Resource count (2), Prompt count (4)
- **Test Panel** — four buttons to test the MCP endpoint directly from the browser:
  - **List Tools** — returns all 18 available tools with descriptions and parameter schemas
  - **List Resources** — returns the 2 data resources (server overview, uptime checks)
  - **List Prompts** — returns the 4 pre-built prompt templates
  - **Call get_system_metrics** — executes a real tool call and shows CPU, memory, disk data
- **Connect Instructions** — copy-paste configs for Claude Desktop, Claude Code CLI, and curl
- **Tools Reference** — all 18 tools in a grid with read/write/destructive safety badges

### How MCP Works

MCP (Model Context Protocol) is an open standard (created by Anthropic) that lets AI assistants securely call external tools. Think of it as an API specifically designed for AI agents.

When you connect Claude Desktop to Bulwark's MCP server:
1. Claude sees all 18 tools and their descriptions
2. When you ask "What's my server CPU usage?", Claude calls `get_system_metrics` automatically
3. Bulwark executes the tool, returns JSON data to Claude
4. Claude formats it into a human-readable answer

This means you can manage your entire infrastructure through natural conversation with Claude.

### Connecting Claude Desktop (Step by Step)

1. Open the **MCP Server** view in Bulwark's sidebar
2. Click **Copy Config** in the Claude Desktop section
3. Find your session token:
   - In Bulwark, open browser DevTools (`F12` or `Ctrl+Shift+I`)
   - Go to **Application** tab > **Cookies** > your Bulwark URL
   - Find the cookie named `monitor_session` and copy its value
4. Open your Claude Desktop config file:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
5. Paste the copied config and replace `YOUR_SESSION_TOKEN` with your actual token
6. The final config should look like:
```json
{
  "mcpServers": {
    "bulwark": {
      "type": "streamable-http",
      "url": "https://your-server.com/mcp",
      "headers": {
        "Cookie": "monitor_session=abc123def456..."
      }
    }
  }
}
```
7. Restart Claude Desktop
8. You should see "bulwark" listed in Claude's MCP connections

### Connecting Claude Code (CLI)

1. In the MCP Server view, click **Copy Command** in the Claude Code section
2. Open your terminal and paste the command:
```bash
claude mcp add --transport http bulwark https://your-server.com/mcp
```
3. Claude Code now has access to all 18 Bulwark tools in your coding sessions

### Connecting Cursor / VS Code / Windsurf

1. Open your editor's MCP settings (usually in Settings > MCP Servers or a config file)
2. Add a new MCP server with:
   - **Name:** `bulwark`
   - **Transport:** `streamable-http`
   - **URL:** Your Bulwark MCP endpoint (shown in the connection info panel)
   - **Headers:** `Cookie: monitor_session=YOUR_TOKEN`
3. Save and restart the editor

### Testing with curl

Test the MCP endpoint directly from your terminal:

```bash
# List all available tools
curl -X POST https://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -b "monitor_session=YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call a tool (get system metrics)
curl -X POST https://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -b "monitor_session=YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_system_metrics","arguments":{}}}'

# List resources
curl -X POST https://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -b "monitor_session=YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"resources/list"}'
```

### Available Tools (18)

| Tool | What it does | Safety |
|------|-------------|--------|
| `get_system_metrics` | CPU, memory, disk usage, uptime, load averages | Read |
| `get_process_list` | Running processes sorted by CPU or memory | Read |
| `get_uptime_status` | All monitored endpoints with uptime percentages | Read |
| `add_uptime_endpoint` | Add a new URL to uptime monitoring | Write |
| `list_docker_containers` | All Docker containers with state, image, ports | Read |
| `get_container_logs` | Tail logs from a specific container | Read |
| `manage_container` | Start, stop, or restart a Docker container | Destructive |
| `list_database_tables` | All database tables with row counts and sizes | Read |
| `query_database` | Execute a SQL query (SELECT only by default) | Write |
| `list_tickets` | Support tickets with status, priority, assignee | Read |
| `create_ticket` | Create a new support ticket | Write |
| `get_deploy_history` | Recent deployments with status and timestamps | Read |
| `get_deploy_preflight` | Pre-deploy checks (uncommitted changes, branch status) | Read |
| `get_git_log` | Recent git commits with author, date, message | Read |
| `get_git_diff` | Current working tree changes (staged + unstaged) | Read |
| `get_security_score` | Security posture score with check details | Read |
| `send_notification` | Send an alert via configured notification channels | Write |
| `get_recent_alerts` | Recent notification history | Read |

**Safety annotations** tell the AI agent how to handle each tool:
- **Read** — safe to call anytime, no side effects
- **Write** — creates or modifies data, AI should confirm with you first
- **Destructive** — can stop services or lose data, AI must ask permission

### Available Resources (2)

| Resource | URI | What it provides |
|----------|-----|-----------------|
| Server Overview | `server://overview` | Full system snapshot: hostname, OS, CPU, memory, disk, uptime, Node.js version |
| Uptime Checks | `uptime://checks` | All monitored endpoints with 24h and 7-day uptime percentages |

Resources are data feeds the AI can read proactively without you asking for a specific tool call.

### Available Prompts (4)

| Prompt | What it does |
|--------|-------------|
| `diagnose_server` | Generates a comprehensive system health diagnosis — checks CPU, memory, disk, processes, uptime, and Docker. Returns prioritized findings. |
| `incident_report` | Creates a formal incident report for a given issue — timeline, impact, root cause analysis, remediation steps. |
| `security_audit` | Runs a full security assessment — firewall, open ports, SSH keys, secrets exposure, dependency vulnerabilities, compliance score. |
| `daily_briefing` | Generates a morning briefing — overnight events, current health, upcoming calendar, ticket status, deployment activity. |

### Example Conversations

Once connected, you can have conversations like:

> **You:** How's my server doing?
> **Claude:** *[calls get_system_metrics]* Your server is healthy. CPU is at 12%, memory at 45% (3.6GB of 8GB), disk at 62%. Uptime is 14 days. Load averages are low at 0.3/0.5/0.4.

> **You:** Are any of my monitored endpoints down?
> **Claude:** *[calls get_uptime_status]* All 3 endpoints are up. api.example.com has 99.97% uptime over 7 days with 45ms average latency. Your blog endpoint had a brief 2-minute outage yesterday.

> **You:** What containers are running?
> **Claude:** *[calls list_docker_containers]* You have 4 containers: bulwark (running, 3 days), postgres (running, 3 days), redis (running, 3 days), and nginx (stopped). Want me to start nginx?

> **You:** Create a ticket for the login page bug
> **Claude:** *[calls create_ticket]* Created ticket #47: "Login page bug" with priority normal. I've added it to the Pending column on the Kanban board.

### MCP FAQ

**Q: What is MCP?**
A: Model Context Protocol — an open standard (by Anthropic) that lets AI agents securely connect to external tools and data sources. Instead of copy-pasting data between your browser and Claude, MCP lets Claude directly access your Bulwark instance to read metrics, manage containers, and take actions.

**Q: Do I need MCP to use Bulwark?**
A: No. MCP is optional. Everything in Bulwark works through the web GUI and the built-in terminal. MCP adds the ability to manage your infrastructure through natural conversation with AI agents.

**Q: Is it secure?**
A: Yes. Every MCP request requires a valid Bulwark session cookie — the same authentication used by the web GUI. Unauthenticated requests are rejected. The AI agent can only do what your logged-in user account can do (same RBAC roles apply). In SaaS mode, each customer's MCP server is isolated in their own container.

**Q: My session token expired. How do I get a new one?**
A: Log into Bulwark in your browser, then copy the new `monitor_session` cookie value from DevTools (Application > Cookies). Update your MCP client config with the new token. Session tokens expire based on your server's session configuration.

**Q: Can multiple AI clients connect simultaneously?**
A: Yes. The MCP server is stateless — each request is independent. Multiple Claude Desktop instances, Cursor, and Claude Code can all connect with the same (or different) session tokens.

**Q: Can the AI accidentally break things?**
A: Tools have safety annotations. Read-only tools (metrics, logs, lists) are marked safe. Write tools (create ticket, add endpoint) and destructive tools (manage container) are annotated so the AI asks for your confirmation before executing. You always have the final say.

**Q: Does MCP use my AI subscription credits?**
A: The MCP server itself is free — it's built into Bulwark. However, the AI agent (Claude Desktop, Claude Code, Cursor) uses your own subscription to process the conversation. Tool calls return raw data; the AI formats and interprets it using your subscription.

**Q: What's the difference between the MCP server and the built-in AI features?**
A: Built-in AI (Dashboard briefing, SQL generation, security audit) uses Claude CLI installed on the Bulwark server. MCP lets your LOCAL AI client (Claude Desktop on your laptop) connect to Bulwark REMOTELY. They're complementary — built-in AI is self-contained, MCP extends your local AI with infrastructure access.

**Q: Can I use this with non-Anthropic AI clients?**
A: Yes. Any client that supports the MCP Streamable HTTP transport can connect — this includes Cursor, VS Code extensions, Windsurf, and any custom client built with the MCP SDK. The protocol is open and vendor-neutral.

---

## Reference

---

## 37. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Backtick` | Toggle terminal drawer from any view |
| `Ctrl + Shift + Backtick` | Cycle terminal size (half / full / mini) |
| `Ctrl + V` | Paste into terminal |
| `Ctrl + C` | Copy selected text (or send SIGINT if nothing selected) |
| `Ctrl + Shift + C` | Always copy (never sends SIGINT) |

The terminal drawer is available on every page — you don't need to navigate to the Terminal view to use it.

## 38. FAQ

### General

**Q: What does Bulwark cost?**
A: The self-hosted Community edition is free and open source (AGPL-3.0). AI features use your own subscriptions (Anthropic for Claude, OpenAI for Codex) — Bulwark itself has zero AI cost. Hosted plans are available at $29/$79/$199 per month.

**Q: What are the system requirements?**
A: **Minimum:** Node.js 18+, 512MB RAM. **Recommended:** Node.js 22+, 2GB+ RAM, PostgreSQL 14+, Docker. Runs on Linux, macOS, and Windows. The Docker install is the easiest — it includes everything pre-configured.

**Q: Does it work without a database?**
A: Yes. All features work except the 8 Database views (SQL Editor, Tables, Schema, Migrations, Roles, Backups, Projects, AI Assistant) and Tickets (which use PostgreSQL). System metrics, terminal, Docker, Git, deploy, uptime, security, notifications, calendar, and MCP all function without any database.

**Q: Does it work without Docker?**
A: Yes. Docker is only needed for: (1) the Docker management view, (2) migration test-runs. Everything else works with a plain `npm start`.

**Q: Can I run Bulwark behind a reverse proxy?**
A: Yes. Bulwark works behind Nginx, Caddy, Cloudflare Tunnels, or any reverse proxy. Set `trust proxy` is already enabled. For WebSocket support, ensure your proxy passes the `Upgrade` header. Example Nginx config:
```nginx
location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

**Q: How do I update Bulwark?**
A: Pull the latest code and restart:
```bash
# Docker
docker compose pull && docker compose up -d

# Manual
git pull && npm install && pm2 restart bulwark
```
Your data in `data/` is preserved across updates.

**Q: Where is my data stored?**
A: All data lives in the `data/` directory: `settings.json`, `calendar.json`, `notes.json`, `credentials.json` (encrypted), `audit-log.json`, `query-history.json`, `envvars.json`, and uptime history. Back up this directory to preserve your configuration.

### AI

**Q: Do I need an Anthropic subscription?**
A: Only for AI-powered features (Dashboard briefing, SQL generation, security audit, backup strategy, Git intelligence, deploy intelligence, AI Compose, and all "Analyze" buttons). Everything else works perfectly without any AI subscription.

**Q: Which AI features require Claude CLI?**
A: Any feature with an "Analyze", "Ask Claude", or "AI" button. This includes: Dashboard AI Briefing, Metrics Analysis, Uptime Analysis, Docker Fleet Intelligence, SQL generation, Role Security Audit, Backup Strategy, Git Intelligence, Deploy Intelligence, Ticket AI Triage, and Calendar AI Planner.

**Q: Can I use Claude and Codex at the same time?**
A: They're independent CLI tools — you can install both. Bulwark uses whichever is selected in Settings > AI Provider. You can switch between them at any time.

**Q: Is my API key stored securely?**
A: API keys passed via environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) stay in server memory only and are never written to disk by Bulwark. Keys stored in the Credential Vault are encrypted with AES-256-GCM.

### Connectivity

**Q: What does the status bar "Connected" / "Disconnected" mean?**
A: It shows the WebSocket connection status between your browser and the Bulwark server. "Connected" (cyan dot) means real-time updates are flowing. "Disconnected" (orange dot) means the WebSocket dropped — data still loads via HTTP but won't auto-update. Refresh the page to reconnect.

**Q: Can I access Bulwark from my phone?**
A: Yes. Bulwark is responsive — the sidebar collapses into a hamburger menu on mobile. All views work on tablets and phones, though the terminal and SQL editor are best on desktop.

**Q: Can multiple users be logged in at the same time?**
A: Yes. Each user gets their own session. Real-time updates (tickets, metrics) sync across all connected browsers via WebSocket.

### Troubleshooting

**Q: The page is blank or shows "Loading..."**
A: Check the browser console (`F12`) for errors. Common causes: (1) server isn't running (`npm start`), (2) wrong port (default 3001), (3) ad blocker blocking WebSocket connections.

**Q: I forgot my password.**
A: Delete `data/users.json` and restart Bulwark. It will recreate the default admin/admin account. Then change the password immediately.

**Q: How do I check if Bulwark is running?**
A: Open `http://localhost:3001/api/system` in your browser or run `curl http://localhost:3001/api/system`. If you get a JSON response, the server is running.

*Bulwark v2.1 — Server Management Platform*
