# Bulwark — Commercial Business Plan (Revised March 2026)

**Date:** March 6, 2026
**Status:** Research Complete, Repo Live at github.com/bulwark-studio/bulwark
**License Decision:** AGPL-3.0 (validated — see Section 5)

---

## EXECUTIVE SUMMARY

Bulwark is a 36,000-line, 270-endpoint, 34-view self-hosted server management platform that replaces 5-6 separate tools (Coolify + Portainer + Uptime Kuma + pgAdmin + SSH + manual security) with one AI-powered dashboard. No competitor combines terminal + AI + DB Studio + Docker + deployment + git + security + monitoring in a single product.

**Model:** Open Core + BYOK AI (zero AI cost for us)
**License:** AGPL-3.0 (same as Grafana — $9B valuation, $400M+ ARR)
**Target:** Solo devs → small teams → agencies → enterprise
**Pricing:** Free OSS → $19 Pro → $49 Team → Custom Enterprise
**Repo:** https://github.com/bulwark-studio/bulwark

---

## 1. PRODUCT AUDIT (v2.1 — March 2026)

### What Exists
- **31 route modules**, 270+ HTTP endpoints
- **34 sidebar views** + 6 core JS modules (~15,000 LOC frontend)
- **16 shared libs** (~3,000 LOC)
- **8 CSS files** — Dimension Dark glass-morphism theme
- **4 npm deps only:** express, socket.io, pg, node-pty
- **Socket.IO real-time:** metrics 3s, tickets/activity 10s, health 30s
- **Auth:** PBKDF2 + session tokens + optional TOTP 2FA + RBAC (admin/editor/viewer)
- **Audit logging:** every API call logged with user, action, timestamp, IP, result
- **DB Studio:** 30+ PG introspection endpoints (Supabase-style)
- **Docker:** 27 native Docker Engine API endpoints (no Docker CLI dependency)
- **AI:** BYOK Claude CLI + Codex CLI (SQL gen, security audit, backup strategy, commit messages, ticket triage, PR descriptions, branch cleanup, conflict analysis)
- **Git Projects:** Dynamic multi-repo management with private repo auth (SSH keys + HTTPS tokens)
- **Terminal:** xterm.js + node-pty (full PTY, not exec)
- **Credential Vault:** AES-256-GCM encryption
- **Uptime Monitoring:** HTTP/TCP checks with history
- **Docker + Docker Compose deployment ready**

### Feature Inventory (34 Views)

| Group | Views | Count |
|-------|-------|-------|
| Overview | Dashboard, Metrics, Uptime | 3 |
| Infrastructure | Servers, Docker, PM2, SSL/Domains, Cloudflare | 5 |
| Database (DB Studio) | Projects, SQL Editor, Tables, Schema, Migrations, Roles, Backups, AI Assistant | 8 |
| DevOps | Terminal, Claude AI, Tickets, Git, Deploy, Cron Jobs, File Manager, Env Variables | 8 |
| Workspace | Calendar, Notes, Briefing | 3 |
| Security | Security Center, Credentials, FTP, Notifications | 4 |
| System | Cache, Logs, Multi-Server, Settings, Docs | 5 |

### Endpoint Breakdown
| Category | Endpoints |
|----------|-----------|
| DB Studio (Supabase-style) | 30 |
| Docker Management | 27 |
| Authentication & Sessions | 14 |
| Git Operations (+ AI) | 18 |
| Calendar & Notes | 15 |
| Security & Compliance | 20 |
| Tickets (+ AI triage) | 10 |
| Infrastructure & Ops | ~80 |
| System & Monitoring | ~12 |
| AI Endpoints | ~15 |
| **TOTAL** | **270+** |

---

## 2. COMPETITIVE LANDSCAPE (Deep Research — March 2026)

### Direct Competitors (Updated with Live Data)

| Product | License | Pricing | Stars/Users | Revenue/Valuation | Our Advantage |
|---------|---------|---------|-------------|-------------------|---------------|
| **Coolify** | Apache 2.0 | Free self-host, Cloud $5+$3/server | 52K+ stars, 52K+ instances | Bootstrapped, donations + cloud | No DB Studio, no AI, no security scan, no terminal, no file mgmt, no git |
| **Portainer** | Zlib (CE), Proprietary (BE) | CE free (3 nodes), Starter $99/mo (5 nodes), Scale $199/mo | 31K stars, 25M+ pulls | ~$10-20M ARR est. | Containers only — no terminal, git, DB, deploy, AI, cron |
| **Dokploy** | Apache 2.0 | Free (OSS only) | 26K+ stars, 6M+ downloads | Pre-revenue, community | PaaS only, no DB Studio, no AI, no terminal, no security |
| **CapRover** | Apache 2.0 | Free (OSS) | 13K stars | Pre-revenue | Development slowed. No AI, no DB Studio, no security |
| **Dokku** | MIT | Free (OSS) | 29K stars | Pre-revenue | CLI-only, no GUI, no AI, no DB management |
| **Cloudron** | Proprietary | $15/mo (2 apps) - $39/mo (unlimited) | ~5K stars | Bootstrapped | App management only. No terminal, no AI, no DB Studio |

### Adjacent Competitors (Monitoring / DB / Cloud)

| Product | License | Pricing | Valuation/Revenue | Our Diff |
|---------|---------|---------|-------------------|----------|
| **Grafana** | AGPL-3.0 | OSS free, Enterprise custom | **$9B valuation, $400M+ ARR**, 7K+ customers | Monitoring/viz only — no management, no terminal, no deploy |
| **Supabase** | Apache 2.0 | Free - $599/mo | **$5B valuation, $70M ARR** (250% YoY), 81K stars | DB-only — no server mgmt, Docker, terminal, security |
| **Datadog** | Proprietary | $15-40/host/mo | **$43.9B mktcap, $3.5B revenue** | Cloud-only, expensive, monitoring-only |
| **Uptime Kuma** | MIT | Free (OSS) | 50K+ stars | Single purpose — uptime only |
| **Railway** | Proprietary | $5-20/mo + usage | $100M Series B | Cloud-only, not self-hosted |
| **Render** | Proprietary | From $7/mo | $1.5B valuation | Cloud-only, not self-hosted |
| **Vercel** | Proprietary | Free-$20/user/mo | $9.8B valuation | Frontend-only, cloud-only |

### Feature Gap Matrix (Updated March 2026)

| Feature | Bulwark | Coolify | Portainer | Dokploy | Supabase | Grafana | Uptime Kuma |
|---------|---------|---------|-----------|---------|----------|---------|-------------|
| Web Terminal (PTY) | **YES** | No | No | No | No | No | No |
| AI SQL Generation | **YES** | No | No | No | AI Studio | No | No |
| AI Ticket Triage | **YES** | No | No | No | No | No | No |
| AI PR Description | **YES** | No | No | No | No | No | No |
| AI Security Audit | **YES** | No | No | No | No | No | No |
| AI Backup Strategy | **YES** | No | No | No | No | No | No |
| DB Studio (30+ endpoints) | **YES** | No | No | No | YES | No | No |
| Docker Management | **YES** | YES | YES | YES | No | No | No |
| Git Management + Projects | **YES** | Webhooks | No | No | No | No | No |
| Deployment Pipeline | **YES** | YES | Containers | YES | No | No | No |
| Security Scanning | **YES** | No | No | No | No | Yes ($) | No |
| SSL Management | **YES** | YES | No | Traefik | N/A | No | No |
| Cron Jobs | **YES** | No | No | No | Edge Funcs | No | No |
| File Management | **YES** | No | No | No | Storage | No | No |
| Env Variables | **YES** | YES | Partial | YES | Yes | No | No |
| Real-time Metrics | **YES** | Basic | Basic | Basic | No | **YES** | Uptime only |
| Uptime Monitoring | **YES** | No | No | No | No | Plugin | **YES** |
| Credential Vault | **YES** | No | No | No | Vault | No | No |
| RBAC + Audit Log | **YES** | No | YES (BE) | No | YES | YES (Ent) | No |
| Calendar/Notes | **YES** | No | No | No | No | No | No |
| Multi-Server | **YES** | YES | YES | No | N/A | YES | No |
| Self-Hosted | **YES** | YES | YES | YES | Partial | YES | YES |
| BYOK AI (zero cost) | **YES** | No | No | No | No | No | No |

**Key insight (validated):** No existing product combines self-hosted server management with deeply integrated AI assistance at an indie/SMB price point. Coolify is closest in spirit but focused on PaaS deployment, not full server management. Dokploy is rising fast (26K stars) but also PaaS-only.

### AI DevOps Landscape (2026)

| Product | AI Features | Price | Our Diff |
|---------|-------------|-------|----------|
| Harness AI | ML CI/CD, auto-rollback | $150/mo+ | We're self-hosted, broader scope |
| Kubiya | Agentic AI DevOps | $50/mo+ | We're self-hosted, BYOK model |
| PagerDuty AI | AI incident response | $41/user/mo | We cover more than incidents |
| Datadog AI | Anomaly detection | Bundled ($15+/host) | We're self-hosted, 10x cheaper |
| Netdata | ML anomaly detection | Free OSS, $4.17/node | Monitoring only, no management |

---

## 3. MARKET SIZE & OPPORTUNITY (Updated)

### TAM/SAM/SOM
- **TAM (DevOps Market):** $16.13B (2025) → $19.57B (2026) → $51.43B (2031) at 21.33% CAGR
- **DevOps Tools Market:** $3.61B (2025) → $6.9B (2033) at 8.43% CAGR
- **SAM (Self-hosted DevOps tools for solo → mid-market):** $2-4B segment
- **SOM (Obtainable in years 1-3):** $10-50M with strong community traction
- **Hybrid cloud segment:** Growing at 24.1% CAGR — largest incremental opportunity

### Key Market Trends (2026)
- 62% of enterprises use DevOps tools (Spacelift)
- 64% of teams use AI in development (Spacelift)
- Self-hosting surging: Coolify at 52K+ public instances, Heroku entering "sustaining mode"
- AI-native tools are fastest-growing dev tool category
- AI startups attracted $89.4B in VC funding in 2025 (34% of all global VC)
- Open source as GTM dominates developer tools
- Dokploy went from 0 to 26K stars in ~18 months — proves market hunger

### Comparable Exits & Valuations
| Company | Model | Valuation | ARR | Multiple |
|---------|-------|-----------|-----|----------|
| Grafana | AGPL open core | $9B | $400M+ | ~22x |
| Supabase | Apache 2.0 open core | $5B | $70M | ~71x |
| Datadog | Proprietary SaaS | $43.9B | $3.5B | ~12x |
| Vercel | Proprietary SaaS | $9.8B | ~$100M | ~98x |
| HashiCorp | BSL (was MPL) | Acquired by IBM $7.2B | ~$600M | ~12x |

---

## 4. TARGET AUDIENCE

### Primary Segments (Year 1)

**Segment 1: Solo Developers on VPS**
- **Size:** Millions globally (DigitalOcean 4M+ customers, Hetzner 500K+, Coolify 52K instances)
- **Problem:** "I SSH into my VPS and run 15 different commands. I have Coolify for deploy, Uptime Kuma for monitoring, pgAdmin for DB, and I still manually check security."
- **Solution:** One dashboard replaces all of it + AI assistant
- **Willingness to pay:** $0-19/mo (price-sensitive, love free/OSS)
- **Channels:** r/selfhosted (500K+), r/devops (250K+), Hacker News, Dev.to

**Segment 2: Small Dev Teams (2-10)**
- **Size:** Hundreds of thousands of dev shops globally
- **Problem:** "We share SSH access with no audit trail. Everyone has root. We can't see who deployed what."
- **Solution:** RBAC + audit logging + shared dashboard + git project management
- **Willingness to pay:** $29-99/mo
- **Channels:** Twitter/X dev community, Product Hunt, tech blogs, Discord

**Segment 3: Agencies & Consultants**
- **Size:** ~100K digital agencies globally
- **Problem:** "We manage 20 client servers with different tools each. Need one dashboard for all."
- **Solution:** Multi-server management + credential vault + client segregation
- **Willingness to pay:** $99-299/mo
- **Channels:** Agency communities, white-label partnerships

### B2B Sales Motion (Year 2+)
- Mid-market (10-100): Need SSO, compliance → $200-2000/mo
- Enterprise (100+): Need SOC2, HIPAA → Custom pricing, sales team

---

## 5. LICENSING DECISION: AGPL-3.0

### Why AGPL-3.0 (Not Apache 2.0)

We evaluated both models deeply. AGPL-3.0 is the right choice for Bulwark:

| Factor | Apache 2.0 | AGPL-3.0 | Winner for Us |
|--------|-----------|----------|---------------|
| Adoption speed | Faster (no legal friction) | Slower (enterprise legal reviews) | Apache |
| Protection from cloud resale | None (AWS can resell) | Strong (must open-source modifications) | **AGPL** |
| Contributor motivation | Weak (contributions can go proprietary) | Strong (changes stay open) | **AGPL** |
| Enterprise acceptance | High | Medium (but improving) | Apache |
| Revenue protection | Low | High | **AGPL** |
| Proven at scale? | Supabase ($5B), Coolify, Dokploy | Grafana ($9B, $400M ARR), MongoDB, Lago ($22M raised) | **Both** |

### The Evidence

**Grafana proves AGPL works at massive scale:**
- Switched from Apache 2.0 → AGPL-3.0 in April 2021
- Since then: $400M+ ARR, $9B valuation, 7,000+ customers (Anthropic, NVIDIA, Salesforce, Microsoft)
- Customers include Anthropic, NVIDIA, Salesforce, Microsoft — AGPL did not block enterprise adoption
- CEO Raj Dutt: AGPL balances "value creation" and "revenue creation"

**Lago (YC S21) chose AGPL from day one:**
- Open-source billing platform, $22M raised, 9K+ stars
- Customers: PayPal, Synthesia, Mistral.ai
- Self-hosted = free, Cloud = paid SaaS
- AGPL ensures no one can re-host without contributing back

**ZITADEL moved from Apache TO AGPL:**
- Auth platform, explicitly chose to strengthen protection
- Found Apache left them vulnerable to cloud strip-mining

**The HashiCorp cautionary tale:**
- Was MPL 2.0 (permissive), switched to BSL (proprietary) in Aug 2023
- Community revolted — OpenTofu fork created within weeks, 32K stars on manifesto
- Lesson: Start with strong protection (AGPL). Going more restrictive later destroys trust.

**Open Core Ventures (Sid Sijbrandij, GitLab founder) says:**
- "AGPL is a non-starter for most companies" — as USERS. This is actually a FEATURE for us.
- It means competitors can't embed our code without open-sourcing their stack
- Individual developers and self-hosters are completely unaffected

### Our AGPL Strategy

```
AGPL-3.0 (Community — Free Forever)
├── All 270+ endpoints
├── All 34 views
├── All 16 libs
├── Full AI integration (BYOK)
├── Single user, unlimited features
├── Self-host on your own server
│
Pro/Team/Enterprise (Proprietary add-ons)
├── Multi-user + RBAC enforcement
├── SSO (SAML/OIDC)
├── Advanced audit log analytics
├── Priority support
├── Multi-server aggregation
├── White-label theming
└── Terminal sandboxing (Firecracker)
```

**Key principle (from Open Core Ventures):** Segment by BUYER, not by feature.
- Individual contributor features → AGPL (free)
- Management/team features → Proprietary (paid)
- Never move AGPL features to paid — this erodes trust permanently

---

## 6. PRICING MODEL

### Open Core + BYOK AI

| Tier | Price | Target | Key Features |
|------|-------|--------|-------------|
| **Community** | Free (AGPL) | Solo devs, adoption | All views, all AI, single user, self-hosted |
| **Pro** | $19/user/mo | Freelancers, power users | Multi-user (up to 5), RBAC, email support, 5 servers |
| **Team** | $49/user/mo | Growing teams | SSO (SAML/OIDC), audit analytics, unlimited servers, API keys, Slack/Discord hooks, priority support |
| **Enterprise** | Custom | Agencies, enterprise | SOC2, Firecracker isolation, white-label, SLA, dedicated support engineer, on-prem assistance |

### Why $19 (Not $15)
- $15 feels "cheap" — signals lack of confidence
- $19 matches the psychological tier below $20 while adding 27% more revenue per seat
- Portainer Starter is $99/mo for 5 nodes — we're 80% cheaper with 10x more features
- Coolify Cloud is $5/mo but that's PaaS-only, not full server management

### Competitive Pricing Position (Updated)
| Bulwark | vs Competitor | Savings |
|---------|---------------|---------|
| Free (Community) | Coolify Cloud ($5/mo) | 100% cheaper + terminal, DB Studio, AI, security |
| Free (Community) | Cloudron ($15/mo) | 100% cheaper + AI, DB Studio, terminal |
| $19/user/mo (Pro) | Portainer Starter ($99/mo for 5 nodes) | 81% cheaper per team |
| $49/user/mo (Team) | Portainer Scale ($199/mo for 5 nodes) | 75% cheaper + more features |
| $49/user/mo (Team) | Datadog ($15/host/mo x 10 hosts = $150/mo) | 67% cheaper + management |
| Custom (Enterprise) | Grafana Enterprise ($25K+/yr) | Comparable, broader scope |

### Why BYOK AI
- **Zero AI cost for us** — users bring their own Claude/Codex subscriptions
- **No margin pressure** — AI usage doesn't eat into revenue
- **Users already have subscriptions** — Claude Pro/Max ($20-100/mo), OpenAI API keys
- **Trust** — users' data goes directly to their own AI provider, never through us
- **Simplicity** — no token metering, no billing complexity, no rate limit drama
- **Unique positioning** — "The only server dashboard where YOUR AI works for YOU"

---

## 7. AI INTEGRATION ARCHITECTURE

### Multi-Provider CLI Passthrough

```
Settings > AI Provider
  ├── Claude CLI (claude --print) — Anthropic subscription
  ├── Claude Code (claude) — Claude Max subscription (full coding agent)
  ├── Codex CLI (codex) — OpenAI's open-source coding agent
  └── None — AI features disabled, graceful degradation
```

### AI-Powered Features (Implemented)
| Feature | Route | What It Does |
|---------|-------|-------------|
| SQL Generation | POST /api/db/claude/generate | Natural language → SQL via Claude/Codex |
| Role Security Audit | GET /api/db/roles/ai/audit | Analyzes all PG roles, returns score/findings |
| Least-Privilege Role Gen | POST /api/db/roles/ai/generate | Generates minimal-access role SQL from description |
| Backup Strategy | GET /api/db/backups/ai/strategy | DR plan, health score, recommendations |
| Ticket Triage | POST /api/tickets/ai/triage | Bulk analyze pending tickets, assign priority/category |
| Ticket Analysis | POST /api/tickets/:id/ai/analyze | Deep root cause, steps, effort, risk for single ticket |
| PR Description | POST /api/git/ai-pr-description | Generates PR title, summary, test plan from branch diff |
| Branch Cleanup | GET /api/git/ai-branch-cleanup | Identifies stale/merged/active, cleanup recommendations |
| Conflict Analysis | POST /api/git/ai-conflict-help | Per-file merge conflict suggestions, risk assessment |
| Commit Messages | POST /api/git/ai-commit | AI-generated commit messages from staged changes |
| Daily Briefing | GET /api/briefing/ai | AI summary of system health, tickets, deploys |

### Claude Code Integration
- Users with Claude Max run `claude` (Claude Code) directly in Bulwark's terminal
- Full capabilities: file editing, multi-step tasks, code generation
- Our UI provides the glass terminal — Claude Code provides the brain
- Unique selling point: "Claude Code with a dashboard"

---

## 8. SECURITY & COMPLIANCE

### Current Security (Implemented)
- [x] PBKDF2 password hashing (100k iterations, SHA-512)
- [x] Session tokens (32-byte crypto.randomBytes, 24h TTL)
- [x] Optional TOTP 2FA (RFC 6238)
- [x] HttpOnly cookies, SameSite=Strict
- [x] Login rate limiting (5 attempts/15min)
- [x] RBAC: admin, editor, viewer roles with middleware
- [x] Audit logging: every API call logged (user, action, timestamp, IP, result)
- [x] SQL injection prevention (parameterized queries)
- [x] XSS prevention (escapeHtml on all user content)
- [x] CSP, X-Frame-Options, X-Content-Type-Options headers
- [x] Credential vault (AES-256-GCM + HMAC)
- [x] DDL safety layer (DROP/ALTER blocked without explicit flag)
- [x] Query audit logging to JSON

### Terminal Isolation Roadmap

**Phase 1 — Container Isolation (Pro tier):**
- Container-per-user with Linux namespaces (PID, network, mount)
- seccomp profiles for syscall restriction
- cgroups resource limits (CPU, memory, disk I/O)
- node-pty runs as unprivileged user
- Automatic session timeout and cleanup

**Phase 2 — Firecracker MicroVMs (Enterprise tier):**
- 125ms boot time, <5 MiB memory overhead per VM
- 150 VMs/sec/host throughput
- Used by AWS Lambda/Fargate — battle-tested at massive scale
- Maximum isolation without traditional VM cost

### Compliance Roadmap
| Certification | Timeline | Cost | Unlocks |
|--------------|----------|------|---------|
| SOC 2 Type 1 | Month 12-18 | $20-50K (Vanta/Sprinto) | Enterprise sales |
| SOC 2 Type 2 | Month 18-24 | Included with automation | Enterprise trust |
| ISO 27001 | Month 24-30 | $30-80K | European enterprise |

---

## 9. SCALING ARCHITECTURE

### Phase 1: Single Node (Current — v2.1)
- Express.js + Socket.IO on one process
- JSON file storage for runtime data
- PostgreSQL for persistent data
- **Capacity:** ~100 concurrent users

### Phase 2: Horizontal Scale (v3.0)
```
Load Balancer (sticky sessions)
    ├── Node 1 (Express + Socket.IO)
    ├── Node 2
    └── Node N
    │
Redis (Pub/Sub for Socket.IO + sessions)
S3 (backups, file storage)
PgBouncer → PostgreSQL
```
- **Capacity:** ~1,000-10,000 concurrent users

### Phase 3: Enterprise Scale (v4.0)
- Kubernetes deployment with auto-scaling
- Firecracker microVMs for terminal isolation
- Dedicated PG read replicas for DB Studio
- CDN for static assets
- **Capacity:** ~10,000+ concurrent users

---

## 10. BRANDING (Decided)

- **Name:** Bulwark
- **Domain:** bulwark.studio (Cloudflare)
- **Repo:** github.com/bulwark-studio/bulwark
- **Tagline:** "Your entire server, one dashboard."
- **Alt tagline:** "The open-source server command center that replaces Portainer + pgAdmin + Uptime Kuma + your deployment scripts — with 4 npm dependencies."
- **Theme:** Dimension Dark (glass-morphism, cyan/orange signal system)
- **Font:** JetBrains Mono
- **Logo:** Geometric, minimal, works at 16x16 (NEEDED)

### Positioning
- **VS Coolify:** "Coolify deploys your apps. Bulwark manages your entire server."
- **VS Portainer:** "Portainer manages containers. Bulwark manages everything — with AI."
- **VS Grafana:** "Grafana shows you what's wrong. Bulwark fixes it."
- **VS self-hosted stack:** "Stop running 5 tools. Run one."

---

## 11. GO-TO-MARKET STRATEGY

### Phase 1: Open Source Launch (Month 1-3) — CURRENT

**Done:**
- [x] Name & domain secured (bulwark.studio)
- [x] Codebase rebranded (Bulwark throughout)
- [x] GitHub repo live (github.com/bulwark-studio/bulwark)
- [x] README with architecture diagram, install instructions, feature overview
- [x] AGPL-3.0 license
- [x] CONTRIBUTING.md + Code of Conduct
- [x] GitHub Actions CI
- [x] Docker + docker-compose
- [x] One-line install script
- [x] .github templates (issues, PRs, funding)
- [x] Topics, description, discussions enabled
- [x] 161 files, clean history, no personal data

**Remaining:**
- [ ] Logo design (geometric, minimal, works at 16x16)
- [ ] Social preview image (1280x640)
- [ ] Screenshots/GIFs for README (capture all 34 views)
- [ ] 3-minute YouTube demo (terminal → DB Studio → AI → deploy)
- [ ] Landing page at bulwark.studio (already have landing/index.html)

**Launch Day:**
- [ ] "Show HN" on Hacker News (Tuesday-Thursday, 8-10am ET)
- [ ] Reddit: r/selfhosted (500K+), r/devops (250K+), r/homelab (2M+)
- [ ] Dev.to article: "I built a self-hosted ops dashboard that replaces 5 tools — with 4 npm deps"
- [ ] Twitter/X thread (build-in-public style)
- [ ] Product Hunt launch (1-2 weeks after HN)

**Target:** 1,000 GitHub stars in 90 days

### Phase 2: Community Building (Month 3-6)
- [ ] Discord server (general, help, feature-requests, showcase)
- [ ] Contributor guide + "good first issue" labels
- [ ] Weekly changelog / release notes
- [ ] Respond to every GitHub issue <24h
- [ ] Technical blog series:
  - "How we built a Supabase-style DB Studio in vanilla JS"
  - "Zero-dependency web terminal with node-pty"
  - "AI-powered server management with BYOK Claude CLI"
  - "Dimension Dark: designing a glass-morphism UI for developers"
  - "Why we chose AGPL-3.0 (and how Grafana proved it works)"
- [ ] Feature voting (GitHub Discussions)
- [ ] Monthly community call

### Phase 3: Monetization (Month 6-12)
- [ ] Launch Pro tier ($19/user/mo)
- [ ] Stripe billing integration
- [ ] License key system for self-hosted Pro
- [ ] Optional managed cloud hosting
- [ ] Usage analytics (opt-in telemetry)
- [ ] Customer testimonials / case studies

### Phase 4: Enterprise (Month 12-24)
- [ ] SOC 2 Type 1 ($20-50K with Vanta)
- [ ] SSO (SAML/OIDC) — kills 75-80% of enterprise deals if missing
- [ ] Enterprise sales (1-2 people from community)
- [ ] Conference presence (DevOpsDays, KubeCon)
- [ ] SOC 2 Type 2 observation period

### Key Metrics
| Metric | Year 1 Target |
|--------|---------------|
| GitHub stars | 5,000+ |
| Weekly active installs | 1,000+ |
| Free → paid conversion | 3-5% |
| MRR | $10K+ |
| Time-to-value | <5 minutes |
| NRR (net revenue retention) | >110% |
| Discord community | 500+ |

---

## 12. RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Coolify momentum** (52K stars, v5 coming) | HIGH | Differentiate on AI + DB Studio + breadth. They're PaaS, we're full server management. |
| **Dokploy rising fast** (26K stars in 18mo) | MEDIUM | Same differentiation — they're PaaS-only. We have terminal, DB Studio, AI, security. |
| **"Jack of all trades"** perception | MEDIUM | Demo depth, not breadth. Show DB Studio is production-grade. Show AI is real, not gimmick. |
| **Single developer** | HIGH | Open source enables contributors. Hire #2 from community early. Revenue from Pro enables hiring. |
| **AGPL scares enterprises** | MEDIUM | Grafana proves otherwise ($9B, MSFT/NVIDIA customers). Offer proprietary enterprise license. |
| **Enterprise readiness** (no SOC2/SSO) | MEDIUM | Phase it: community first, enterprise month 12+. Don't chase enterprise prematurely. |
| **Security vulnerability** (terminal access) | HIGH | Container isolation for Pro. Firecracker for Enterprise. Security audit before v3. |
| **AI provider dependency** | LOW | BYOK means zero dependency. If Claude disappears, Codex works. If both die, features degrade gracefully. |

---

## 13. REVENUE PROJECTIONS (Conservative)

### Year 1
| Period | MRR | Notes |
|--------|-----|-------|
| Month 1-3 | $0 | Open source launch, community building |
| Month 4-6 | $0-2K | Early Pro adopters, power users |
| Month 7-9 | $2-5K | Pro growth, first Team users |
| Month 10-12 | $5-12K | Team tier traction, word of mouth |
| **Year 1 Total** | **~$50-100K ARR** | |

### Year 2
| Period | MRR | Notes |
|--------|-----|-------|
| Month 13-18 | $12-30K | First enterprise deals, SSO |
| Month 19-24 | $30-80K | Enterprise + agency segment |
| **Year 2 Total** | **~$300-700K ARR** | |

### Year 3
- $80-200K/mo (enterprise + agency + growing community)
- **Year 3 Total: ~$1-2.5M ARR**

*Model: 5,000 free users → 3-5% convert → 150-250 paid × $35 avg seat = $5-9K/mo base + enterprise deals*

---

## 14. FUNDING STRATEGY

### Bootstrap Phase (Month 1-12)
- Self-funded development
- Revenue from Pro tier (month 6+)
- GitHub Sponsors / Open Collective for community support
- Target: $50-100K ARR before seeking funding

### Seed Round (Month 12-18, if needed)
- Target: $500K-2M
- Sources: OSS Capital, Open Core Ventures, Y Combinator
- Use of funds: Hire #2-3 engineers from community, SOC2, marketing
- Valuation basis: community size, growth rate, ARR

### Series A (Month 24-36, if trajectory supports)
- Target: $5-15M
- Valuation: $30-100M (based on 20-50x ARR multiple for dev tools)
- Use: Enterprise sales team, compliance, Firecracker isolation, managed cloud

---

## SOURCES (Verified March 2026)

### Competitor Data (Live)
- Coolify: coolify.io, Apache 2.0, 52K+ stars, 52K+ instances, Cloud $5+$3/server
- Portainer: portainer.io, Starter $99/mo (5 nodes), Scale $199/mo, 31K stars
- Dokploy: dokploy.com, Apache 2.0, 26K+ stars, 6M+ downloads
- Supabase: $5B valuation (Oct 2025), $70M ARR (250% YoY), 81K stars, $500M total raised
- Grafana: $9B valuation (Feb 2026), $400M+ ARR (60% growth), AGPL-3.0, 7K+ customers
- Datadog: $43.9B market cap, ~$3.5B revenue
- Uptime Kuma: 50K+ stars
- Cloudron: $15-39/mo, proprietary

### Market Data
- DevOps Market: $16.13B (2025) → $51.43B (2031) at 21.33% CAGR (Mordor Intelligence)
- DevOps Tools: $3.61B (2025) → $6.9B (2033) at 8.43% CAGR (Global Growth Insights)
- Hybrid cloud: 24.1% CAGR, largest incremental opportunity
- AI startups: $89.4B VC funding in 2025, 34% of all global VC
- 62% enterprises use DevOps tools (Spacelift)
- 64% teams use AI in development (Spacelift)

### License Research
- Grafana AGPL switch (Apr 2021): grafana.com/blog/2021/04/20/grafana-loki-tempo-relicensing-to-agplv3
- Lago AGPL choice: getlago.com/blog/open-source-licensing-and-why-lago-chose-agplv3
- HashiCorp BSL backlash (Aug 2023): OpenTofu fork, 32K stars on manifesto
- Open Core Ventures pricing: opencoreventures.com/blog/a-standard-pricing-model-for-open-core
- AGPL enterprise adoption: Grafana customers include Anthropic, NVIDIA, Salesforce, Microsoft

### Funding/Valuation Sources
- Supabase Series E: TechCrunch (Oct 2025), $100M at $5B
- Grafana Labs: Yahoo Finance (Sep 2025), $400M ARR, SiliconANGLE (Feb 2026), $9B valuation
- Lago: TechCrunch (Mar 2024), $22M raised
- HashiCorp: Acquired by IBM for $7.2B
