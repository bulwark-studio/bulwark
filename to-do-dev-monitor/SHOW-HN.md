# Show HN Draft

## Title (80 char max)
Show HN: Bulwark – Open-source server dashboard replacing Portainer + pgAdmin + Uptime Kuma

## URL
https://github.com/bulwark-studio/bulwark

## Text

I built Bulwark because I was tired of switching between 6 different tools to manage my servers. Portainer for Docker, pgAdmin for databases, Uptime Kuma for monitoring, separate terminals, deploy scripts, security scanners — all disconnected.

Bulwark is a single self-hosted dashboard that handles all of it:

- Full browser terminal (xterm.js + node-pty)
- Supabase-style DB Studio with SQL editor, table browser, schema explorer, migrations
- Docker container management via native Engine API (27 endpoints)
- Git operations + one-click deploy pipeline with rollback
- Real-time CPU/memory/disk metrics via Socket.IO
- Uptime monitoring with configurable health checks
- Security scanning + AES-256-GCM credential vault
- Kanban ticket board with AI triage
- Cron, file manager, env variables, SSL/TLS, Cloudflare DNS

The AI features use BYOK (Bring Your Own Key) — you install Claude CLI or Codex on your server with your own subscription. Zero AI cost baked into the product. AI generates SQL from natural language, audits DB security, analyzes backup strategies, writes commit messages.

Stack: Express.js + Socket.IO backend, vanilla JS frontend (no React, no build step), 4 npm dependencies total. PostgreSQL optional — works without it.

Theme is "Dimension Dark" — glass morphism with cyan/orange signal system. Every view built with backdrop-filter blur effects.

AGPL-3.0 licensed. Free forever for self-hosted single-user. Pro/Team/Enterprise tiers coming for team features (RBAC, SSO, audit logs).

One-line install: `curl -fsSL https://bulwark.studio/install.sh | bash`

Would love feedback on the architecture decisions (vanilla JS over React, 4 deps, BYOK AI model).
