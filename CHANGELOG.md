# Changelog

All notable changes to Bulwark will be documented in this file.

## [2.1.0] — 2026-03-06

### Initial Public Release

**34 views, 270+ endpoints, 4 npm dependencies.**

#### Core
- Express.js + Socket.IO server on port 3001
- Vanilla JS frontend with ViewRegistry pattern (no build step)
- PBKDF2 authentication + optional TOTP 2FA
- RBAC (admin/editor/viewer) on all API routes
- AES-256-GCM credential vault
- Structured audit logging

#### Database Studio (Supabase-style)
- SQL Editor with CodeMirror 5, autocomplete, query history, saved queries
- AI SQL generation from natural language (Claude/Codex)
- Table browser with two-panel explorer (columns, data, constraints, FK, indexes)
- Schema explorer (functions, triggers, extensions, indexes)
- Migration management with Docker test-run and schema diff
- Role security audit with AI scoring and permission heatmap
- Backup management with AI strategy analysis and DR planning
- pg_dump/pg_restore integration

#### Docker Management
- 27 native Docker Engine API endpoints
- Container lifecycle (create, start, stop, restart, remove)
- Log streaming and real-time stats
- Image and volume management
- Connection wizard with AI diagnostics

#### Terminal
- Full xterm.js + node-pty browser terminal
- Claude AI terminal integration

#### Monitoring
- Real-time CPU/memory/disk metrics (3s Socket.IO refresh)
- Process list with filtering
- Uptime monitoring with HTTP/TCP health checks
- Multi-server aggregation

#### Operations
- Git operations (commit, push, branch, diff, log)
- One-click deploy pipeline with rollback
- Cron job management
- File manager with editor
- Environment variable management

#### Security
- Security scanning and reports
- SSL/TLS certificate management
- Cloudflare DNS and tunnel management

#### AI (BYOK)
- Claude CLI and Codex CLI support
- SQL generation, role audits, backup strategy, commit messages
- Daily briefing summaries
- Zero AI cost — bring your own subscription

#### Theme: Dimension Dark
- Glass morphism with backdrop-filter blur
- Cyan (#22d3ee) / orange (#ff6b2b) signal system
- JetBrains Mono typography
