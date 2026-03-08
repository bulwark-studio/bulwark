# Bulwark on Docker — Getting Started

Get Bulwark running in Docker and managing your databases in under 5 minutes.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10+ with Compose v2
- A browser

## 1. Clone and Start

```bash
git clone https://github.com/bulwark-studio/bulwark.git
cd bulwark
docker compose up -d
```

Two containers start:

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `bulwark` | Ubuntu 24.04 + Node 22 | 3001 | App server |
| `bulwark-db` | PostgreSQL 17 Alpine | 5432 (internal) | Bulwark's own database |

Verify:

```bash
docker compose ps
curl http://localhost:3001/api/health
```

Open **http://localhost:3001** in your browser.

## 2. First Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin` |

**Change these immediately** in Settings > My Account after login.

## 3. Connecting External Databases

Bulwark can manage any PostgreSQL database it can reach over the network. This is the core workflow for using Bulwark as your development dashboard.

### Network Setup

If your other apps run in separate Docker Compose stacks, Bulwark needs to join their networks. Add external networks to `docker-compose.yml`:

```yaml
services:
  bulwark:
    networks:
      - bulwark-net
      - myapp-net        # join your app's network

networks:
  bulwark-net:
    driver: bridge
  myapp-net:
    external: true       # network created by your app's compose stack
```

Then restart:

```bash
docker compose up -d
```

> **Tip:** Run `docker network ls` to see available networks. External networks use the format `<directory>_<network-name>` (e.g. `myapp_default`).

### Add a DB Project in the GUI

1. Click **DB Projects** in the sidebar (under Database)
2. Click **+ Add Project**
3. Fill in the form:

| Field | Example |
|-------|---------|
| **Project Name** | `My App` |
| **PostgreSQL URL** | `postgresql://user:password@container-name:5432/dbname` |
| **Description** | Optional — shows in the project picker |
| **SSL** | Check only for cloud-hosted PostgreSQL (Supabase, RDS, etc.) |

4. Click **Add Project**
5. Click **Test** to verify the connection
6. Click **Use This DB** to make it active

The host in the URL is the **Docker container name** (not `localhost`), since Bulwark connects from inside the Docker network.

### Switching Between Databases

Once you have multiple projects, a project picker appears at the top of every Database view. Click it to switch. All Database views (SQL Editor, Tables, Schema, Migrations, Roles, Backups) use whichever project is active.

## 4. Managing Multiple Apps

A typical development setup with multiple containerized apps:

```
┌─────────────────────────────────────────────────────┐
│  Bulwark (port 3001)                                │
│  ├── bulwark-net ──── bulwark-db (Bulwark's own DB) │
│  ├── app-net ──────── app-db (Your app's DB)        │
│  └── other-net ────── other-db (Another app's DB)   │
└─────────────────────────────────────────────────────┘
```

Example `docker-compose.yml` connecting to two external apps:

```yaml
services:
  bulwark:
    build: .
    container_name: bulwark
    ports:
      - "3001:3001"
    environment:
      - MONITOR_PORT=3001
      - MONITOR_USER=${MONITOR_USER:-admin}
      - MONITOR_PASS=${MONITOR_PASS:-admin}
      - DATABASE_URL=postgresql://bulwark:bulwark@postgres:5432/bulwark
      - NODE_ENV=production
      - DOCKER_HOST=unix:///var/run/docker.sock
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - bulwark-data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - bulwark-net
      - app-net
      - other-net
    restart: unless-stopped

  postgres:
    image: postgres:17-alpine
    container_name: bulwark-db
    environment:
      - POSTGRES_USER=bulwark
      - POSTGRES_PASSWORD=bulwark
      - POSTGRES_DB=bulwark
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bulwark"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - bulwark-net

networks:
  bulwark-net:
    driver: bridge
  app-net:
    external: true
  other-net:
    external: true

volumes:
  bulwark-data:
  pg-data:
```

Then in the GUI, add each database as a DB Project using the container hostname.

## 5. Database Views

Once a project is active, you get a full Supabase-style management suite:

| View | What it does |
|------|-------------|
| **SQL Editor** | Write and run SQL with CodeMirror, autocomplete, query history, saved queries. Ask Claude to generate SQL from natural language. |
| **Tables** | Browse all tables. Click a table to see columns, data (paginated), constraints, foreign keys, and indexes. |
| **Schema** | View functions, triggers, extensions, and indexes across the database. |
| **Migrations** | See applied vs pending migrations, run migrations, test in Docker sandbox, diff live schema vs file. |
| **Roles** | View database roles and permissions. AI security audit scores your role configuration. |
| **Backups** | Create pg_dump backups, restore from file, AI backup strategy with disaster recovery planning. |

## 6. Docker Management

Bulwark can manage Docker containers directly through the dashboard if the Docker socket is mounted (default in the compose file).

The **Docker** view in the sidebar shows all containers, images, volumes, and networks. You can start, stop, restart, view logs, and inspect any container.

## 7. Setting Up AI (Optional)

Bulwark uses **BYOK (Bring Your Own Key)** — your own AI subscriptions, zero cost to Bulwark.

### Option A: Pass API Keys via Environment

```bash
ANTHROPIC_API_KEY=sk-ant-xxx docker compose up -d
```

Or add to a `.env` file next to `docker-compose.yml`:

```env
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
```

### Option B: Authenticate Claude CLI in the Terminal

1. Open **Terminal** in the sidebar
2. Run `claude --dangerously-skip-permissions`
3. Follow the authentication flow

Once configured, AI features light up across the platform: SQL generation, security audits, backup strategy analysis, commit messages, daily briefings.

Configure the active provider in **Settings > AI Provider**.

## 8. Database Migration Workflow

For teams deploying apps with PostgreSQL, Bulwark provides a migration workflow:

### Exporting a Schema

From the **SQL Editor**, run:

```sql
-- View all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- View a table's structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'your_table' ORDER BY ordinal_position;
```

Or use `pg_dump` from the Bulwark terminal:

```bash
pg_dump -h container-name -U dbuser -d dbname --schema-only > schema.sql
```

### Running Migrations

If your app uses migration files, navigate to **Migrations** view:

1. Applied migrations are shown with timestamps
2. Pending migrations (files on disk not yet applied) are highlighted
3. Click **Run** to apply a pending migration
4. Use **Test** to spin up a temporary PostgreSQL, apply the migration, validate, and destroy — without touching your real database

### Fresh Deployment Script

For clean deployments, create an `init.sql` that Docker runs on first boot:

```
your-app/
  docker/
    postgres/
      init.sql       # Extensions, schemas, base tables
      seed.sql       # Default data
  docker-compose.yml
```

```yaml
services:
  db:
    image: postgres:17-alpine
    volumes:
      - ./docker/postgres:/docker-entrypoint-initdb.d
      - db-data:/var/lib/postgresql/data
```

Files in `/docker-entrypoint-initdb.d/` run alphabetically on first volume creation. Name them `01-init.sql`, `02-schema.sql`, `03-seed.sql` to control order.

## 9. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONITOR_PORT` | `3001` | Server port |
| `MONITOR_USER` | — | Default admin username (first run) |
| `MONITOR_PASS` | — | Default admin password (first run) |
| `DATABASE_URL` | — | Bulwark's own PostgreSQL connection |
| `VPS_DATABASE_URL` | — | Secondary DB connection (optional) |
| `ANTHROPIC_API_KEY` | — | Claude API key (optional) |
| `OPENAI_API_KEY` | — | OpenAI API key (optional) |
| `DOCKER_HOST` | — | Docker socket path |
| `NODE_ENV` | `production` | Node environment |

## 10. Troubleshooting

**Container starts but health check fails:**
```bash
docker compose logs bulwark --tail 30
```
Usually means PostgreSQL isn't ready yet. The `depends_on` with `service_healthy` should handle this, but increase `start-period` in the healthcheck if needed.

**Can't connect to external database from DB Projects:**
- Verify Bulwark is on the same Docker network: `docker inspect bulwark --format '{{json .NetworkSettings.Networks}}' | jq`
- Test from inside the container: `docker exec bulwark bash -c "pg_isready -h container-name -U dbuser"`
- The host must be the container name, not `localhost`

**Database shows "Not connected" after adding project:**
- Click **Test** on the project card to see the exact error
- Common issues: wrong password, wrong container name, network not connected, SSL required but not checked

**Permission denied on Docker socket:**
- Set `DOCKER_GID` to match your host's Docker group: `stat -c '%g' /var/run/docker.sock`
- Or run: `DOCKER_GID=$(stat -c '%g' /var/run/docker.sock) docker compose up -d`

**AI features show "not available":**
- Check Settings > AI Provider — make sure a provider is selected
- For Claude CLI: open Terminal and verify `claude --version` works
- For API keys: verify they're set in environment or `.env`

## Quick Reference

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f bulwark

# Shell into the container
docker exec -it bulwark bash

# Reset everything (destroys data)
docker compose down -v && docker compose up -d
```

---

**Built by [Bulwark Studio](https://bulwark.studio)** | [GitHub](https://github.com/bulwark-studio/bulwark) | [Full Documentation](getting-started.md)
