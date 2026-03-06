# Bulwark — Technical To-Do List

## Priority: CRITICAL (Pre-Open-Source Launch)

### 1. Branding & Identity
- [x] Pick product name: **Bulwark**
- [x] Domain: **bulwark.studio** (register on Cloudflare ~$10/yr)
- [ ] Design logo (geometric, minimal, works at 16x16)
- [x] Create ASCII art banner for terminal install (in install.sh + README.md)
- [x] Create landing page (landing/index.html — deploy to bulwark.studio via GitHub Pages)

### 1b. GitHub Open Source Setup (BLOCKED — waiting on email for GitHub org)
**Status:** Waiting on email verification to set up GitHub correctly.

**When unblocked, do this:**

#### Create GitHub Repo
- [x] Create public repo: `bulwark-studio/bulwark` — https://github.com/bulwark-studio
- [ ] Description: "Your entire server, one dashboard. AI-powered, self-hosted ops platform."
- [ ] Topics: devops, server-management, self-hosted, ai, docker, terminal, database, monitoring
- [ ] Website: bulwark.studio
- [ ] Enable Discussions + Issues, disable Wiki

#### Extract from Monorepo
```bash
# Copy dev-monitor to fresh dir
cp -r dev-monitor /tmp/bulwark
cd /tmp/bulwark
rm -rf node_modules .env

# Fresh git history (clean slate, no monorepo commits)
git init
git add .
git commit -m "Initial commit: Bulwark v2.1 — AI-powered server management platform"
git remote add origin git@github.com:bulwark-studio/bulwark.git
git branch -M main
git push -u origin main
```

#### Open Source Files to Create
- [x] `LICENSE` — AGPL-3.0
- [x] `README.md` — Feature overview, architecture diagram, install instructions
- [x] `CONTRIBUTING.md` — Dev setup, code style, PR process
- [x] `CODE_OF_CONDUCT.md` — Contributor Covenant
- [x] `.github/ISSUE_TEMPLATE/bug_report.md`
- [x] `.github/ISSUE_TEMPLATE/feature_request.md`
- [x] `.github/PULL_REQUEST_TEMPLATE.md`
- [x] `.github/FUNDING.yml`
- [x] `install.sh` — One-line curl install for Linux/macOS

#### Rebrand Code
- [x] Rename all "Chester" / "Dev Monitor" → "Bulwark" in code
- [x] Login page: "BULWARK" logo
- [x] Sidebar: "BULWARK"
- [x] Update `package.json` name/description

#### GitHub Repo Settings
- [ ] Branch protection on `main` (require PR review)
- [x] Set up GitHub Actions CI (lint + start test)
- [ ] Add social preview image (1280x640)

### 2. Codebase Cleanup
- [x] Remove all Chester/AutopilotAI references from code (rebranded to Bulwark)
- [x] Make product name configurable (APP_NAME env var + /api/branding endpoint)
- [ ] Remove hardcoded paths (REPO_DIR defaults, etc.)
- [x] Ensure all settings work via env vars
- [x] Clean up unused/legacy code (commented out docker.js, databases.js, cron.js)

### 3. RBAC System
- [x] Create `lib/rbac.js` — role definitions (admin, editor, viewer)
- [x] Add `role` field to users.json schema (already existed)
- [x] Create `requireRole(role)` middleware
- [x] Admin: full access to everything
- [x] Editor: can execute commands, modify configs, deploy
- [x] Viewer: read-only access to all views, no terminal, no destructive ops
- [x] Update all routes with appropriate role checks
- [x] Settings view: user management panel with editor role option

### 4. Audit Logging
- [x] Create `lib/audit.js` — structured audit log
- [x] Log schema: `{timestamp, user, role, action, resource, ip, result, details}`
- [x] Store in `data/audit-log.json` (rotating, max 10K entries)
- [x] Middleware: auto-log every API call
- [x] Audit Log in Settings view (stats + recent entries)
- [x] Filterable by user, action, date range (API supports it)
- [x] Export as CSV/JSON (GET /api/audit/export)

### 5. AI Provider Settings
- [x] Add AI provider selector to Settings view
- [x] Options: Claude CLI, Codex CLI, None
- [x] Store selection in `data/settings.json`
- [x] Update AI-calling routes to check provider (claude.js)
- [x] Detect installed CLIs (GET /api/settings/ai/detect)
- [x] Show install status in Settings view

### 6. Codex CLI Integration
- [x] Add Codex as alternative AI backend in `routes/claude.js`
- [x] `getAICommand()` wrapper routes to configured provider
- [x] Update `routes/db-studio.js` AI endpoints to use wrapper
- [x] Update `routes/calendar.js` AI endpoints to use wrapper
- [ ] Test Codex CLI passthrough for SQL generation
- [ ] Test Codex CLI passthrough for commit message generation

### 7. Documentation
- [x] Create comprehensive README.md with:
  - [x] Feature overview
  - [x] Architecture diagram (Mermaid)
  - [x] Quick start (npm + Docker)
  - [x] Manual install instructions
  - [x] Configuration reference (env vars)
  - [x] AI provider setup guide (BYOK section)
  - [x] Contributing guide link
  - [ ] Screenshots/GIFs (need to capture)
- [x] Create CONTRIBUTING.md
- [x] Create CODE_OF_CONDUCT.md
- [x] Add LICENSE file (AGPL-3.0)

### 8. Install Script
- [x] Create `install.sh` — one-line curl install for Linux/macOS
- [x] Auto-detect OS and architecture
- [x] Install Node.js if not present (via nvm)
- [x] Clone repo, npm install, generate default config
- [x] Create systemd service file
- [x] Print access URL and default credentials

### 9. Docker Improvements
- [x] Verify Dockerfile copies all dirs (DONE — routes/, lib/, data/)
- [x] Add docker-compose.yml with PG included
- [x] Health check endpoint improvements
- [x] Volume mounts for persistent data
- [x] Environment variable documentation

### 10. Update CLAUDE.md
- [x] Version: v2.0 → v2.1
- [x] Route count: 17 → 31 modules, 267 endpoints
- [x] Lib count: 9 → 13 modules
- [x] View count: 28 → 34 views
- [x] Add new routes, libs, views to inventory
- [x] Document Modal API correctly
- [x] Document .env file loader
- [x] Document AI provider architecture (BYOK section)

---

## Priority: HIGH (Pre-Monetization, Month 3-6)

### 11. Multi-Server Management
- [ ] Improve multi-server aggregation view
- [ ] Agent installer for remote servers
- [ ] Encrypted communication between dashboard and agents
- [ ] Per-server health dashboard
- [ ] Aggregate metrics across all servers

### 12. SSO Integration
- [ ] SAML 2.0 support (enterprise requirement)
- [ ] OIDC support (Google, GitHub, Okta, Auth0)
- [ ] SSO-provisioned user creation
- [ ] Just-in-time user provisioning

### 13. API Key Authentication
- [ ] Bearer token auth for programmatic access
- [ ] API key management in Settings
- [ ] Rate limiting per API key
- [ ] Scoped permissions per key

### 14. Webhook Notifications
- [ ] Slack webhook integration
- [ ] Discord webhook integration
- [ ] Email notifications (SMTP)
- [ ] Custom webhook URLs
- [ ] Configurable triggers (deploy, alert, backup, etc.)

### 15. License Key System
- [ ] Generate license keys for Pro/Team tiers
- [ ] License validation middleware
- [ ] Feature gating based on license tier
- [ ] Grace period for expired licenses
- [ ] License management API

### 16. Billing Integration
- [ ] Stripe subscription management
- [ ] Usage-based metering (servers, users)
- [ ] Invoice generation
- [ ] Self-service upgrade/downgrade

---

## Priority: MEDIUM (Enterprise, Month 12+)

### 17. Terminal Sandboxing
- [ ] Container-per-user isolation (Phase 1)
- [ ] Linux namespace isolation (PID, network, mount)
- [ ] seccomp profiles for syscall restriction
- [ ] cgroups resource limits
- [ ] Firecracker microVM integration (Phase 2)

### 18. SOC 2 Preparation
- [ ] Formalized SDLC documentation
- [ ] Environment segregation (dev/staging/prod)
- [ ] Incident response plan
- [ ] Change management logging
- [ ] Penetration testing (annual)
- [ ] Vanta/Sprinto automation setup

### 19. Horizontal Scaling
- [ ] Redis adapter for Socket.IO
- [ ] Redis-backed session store
- [ ] S3-compatible file storage
- [ ] Node.js cluster mode
- [ ] Load balancer configuration guide
- [ ] Kubernetes deployment manifests

### 20. Plugin/Extension System
- [ ] Plugin API for custom views
- [ ] Hook system for custom actions
- [ ] Plugin marketplace (community plugins)
- [ ] Theme customization API

---

## Priority: LOW (Nice-to-Have)

### 21. Mobile Responsive
- [ ] Responsive sidebar (collapse to hamburger)
- [ ] Touch-friendly controls
- [ ] Mobile-optimized terminal

### 22. Dark/Light Theme Toggle
- [ ] Light theme CSS variables
- [ ] Theme toggle in topbar
- [ ] Persist preference in localStorage

### 23. Internationalization
- [ ] Extract all strings to i18n files
- [ ] Support for multiple languages
- [ ] Community translations

### 24. Telemetry (Opt-In)
- [ ] Anonymous usage stats
- [ ] Feature usage tracking
- [ ] Installation count
- [ ] Privacy-first: opt-in only, no PII
