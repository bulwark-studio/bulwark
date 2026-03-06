# Bulwark — Commercial Product: Business Plan & Research Artifact

**Date:** March 5, 2026
**Status:** Research Complete → Ready for Execution

---

## EXECUTIVE SUMMARY

Bulwark is a 23,000-line, 267-endpoint, 34-view self-hosted server management platform that replaces 5-6 separate tools (Coolify + Portainer + Uptime Kuma + pgAdmin + SSH + manual security) with one AI-powered dashboard. No competitor combines terminal + AI + DB Studio + Docker + deployment + git + security + monitoring in a single product. The DevOps market grows from $16B (2025) to $51B (2031) at 21% CAGR.

**Model:** Open Core + BYOK AI (zero AI cost for us)
**Target:** Solo devs → small teams → agencies
**Pricing:** Free OSS → $15 Pro → $49 Team → Custom Enterprise

---

## 1. PRODUCT AUDIT

### What Exists (v2.1)
- **31 route modules**, 267 HTTP endpoints
- **34 sidebar views** + 5 core JS modules (~12,500 LOC frontend)
- **13 shared libs** (~2,500 LOC)
- **8 CSS files** — Dimension Dark glass theme
- **4 npm deps only:** express, socket.io, pg, node-pty
- **Socket.IO real-time:** metrics 3s, tickets/activity 10s, health 30s
- **Auth:** PBKDF2 + session tokens + optional TOTP 2FA
- **DB Studio:** 30+ PG introspection endpoints (Supabase-style)
- **Docker:** 27 native Docker API endpoints
- **AI:** Claude CLI integration (SQL gen, security audit, backup strategy, commit messages)
- **Terminal:** xterm.js + node-pty
- **Credential Vault:** AES-256-GCM encryption
- **Docker deployment ready** (Dockerfile + docker-compose)

### Feature Inventory

**Overview (3 views):** Dashboard, Metrics, Uptime
**Infrastructure (6 views):** Servers, Docker, PM2, SSL/Domains, Cloudflare
**Database — DB Studio (9 views):** Projects, SQL Editor, Tables, Schema, Migrations, Roles (AI audit), Backups (AI strategy), AI Assistant
**DevOps (8 views):** Terminal, Tickets, Git, Deploy, Cron Jobs, File Manager, Env Variables
**Workspace (2 views):** Calendar, Notes
**Security (3 views):** Security Center, FTP, Notifications
**System (4 views):** Cache, Logs, Multi-Server, Settings

### Endpoint Breakdown
| Category | Endpoints |
|----------|-----------|
| DB Studio (Supabase-style) | 30 |
| Docker Management | 27 |
| Authentication & Sessions | 14 |
| Calendar & Notes | 15 |
| Security & Compliance | 20 |
| Git Operations | 14 |
| Infrastructure & Ops | ~80 |
| System & Monitoring | ~12 |
| **TOTAL** | **267** |

---

## 2. COMPETITIVE LANDSCAPE (Deep Research)

### Direct Competitors

| Product | Model | Pricing | Stars/Users | Our Advantage |
|---------|-------|---------|-------------|---------------|
| **Coolify** | Self-hosted PaaS | Free self-host, Cloud $5+$3/server | 51K stars | No DB Studio, no AI, no security scan, no terminal, no file mgmt |
| **Portainer** | Container mgmt | CE free, BE $25K+/yr | 25M users | Containers only — no terminal, git, DB, deploy, AI |
| **CapRover** | Self-hosted PaaS | Free (OSS) | 13K stars | Development slowed. No AI, no DB Studio, no security |
| **Dokku** | CLI mini-Heroku | Free (OSS) | 29K stars | CLI-only, no GUI, no AI, no DB management |
| **Cloudron** | App management | $8-29/mo | ~5K stars | App focus only. No terminal, no AI, no DB Studio |
| **Railway** | Cloud PaaS | $5-20/mo + usage | $100M Series B | Cloud-only, not self-hosted |
| **Render** | Cloud PaaS | From $7/mo | $1.5B valuation | Cloud-only, not self-hosted |
| **Vercel** | Frontend platform | Free-$20/user/mo | $9.8B valuation | Frontend-only, cloud-only |
| **Supabase** | DB + backend | Free-$599/mo | 50K stars | DB only — no server mgmt, Docker, terminal |
| **Grafana** | Monitoring | OSS free, $25K/yr enterprise | $9B valuation | Monitoring only — no management actions |
| **Datadog** | Monitoring | $15-40/host/mo | $43.9B mktcap | Cloud-only, expensive, monitoring only |
| **Uptime Kuma** | Uptime monitoring | Free (OSS) | 83.6K stars | Single purpose — uptime only |
| **Retool** | Internal tools | $12-65/user/mo | Enterprise | Low-code app builder, not server management |
| **Windmill** | Workflow engine | Free OSS, Cloud $120/mo | YC-backed | Scripts-to-workflows, not server management |
| **Kubiya** | AI DevOps | $50/mo+ | Enterprise | Cloud-only, enterprise-priced |
| **Spacelift** | IaC orchestration | Free 2 users, $250/mo | $73.6M raised | IaC only, enterprise |

### Feature Gap Matrix

| Feature | Us | Coolify | Portainer | Supabase | Grafana | Datadog | Uptime Kuma |
|---------|-----|---------|-----------|----------|---------|---------|-------------|
| Web Terminal | **YES** | No | No | No | No | No | No |
| Git Management | **YES** | Webhooks | No | No | No | No | No |
| Deployment | **YES** | YES | Containers | No | No | No | No |
| Docker Management | **YES** | YES | YES | No | No | Agent | No |
| DB Studio | **YES** | No | No | YES | No | No | No |
| Security Scanning | **YES** | No | No | No | No | Yes ($) | No |
| SSL Management | **YES** | YES | No | N/A | No | No | No |
| Cron Jobs | **YES** | No | No | No | No | No | No |
| File Management | **YES** | No | No | Storage | No | No | No |
| Env Variables | **YES** | YES | Partial | Yes | No | No | No |
| Real-time Metrics | **YES** | Basic | Basic | No | YES | YES | Uptime only |
| Uptime Monitoring | **YES** | No | No | No | Plugin | YES | YES |
| AI Commit Messages | **YES** | No | No | No | No | No | No |
| AI SQL Generation | **YES** | No | No | AI Studio | No | No | No |
| AI Code Review | **YES** | No | No | No | No | No | No |
| AI Security Audit | **YES** | No | No | No | No | No | No |
| AI Backup Strategy | **YES** | No | No | No | No | No | No |
| Self-Hosted | **YES** | YES | YES | Partial | YES | No | YES |
| Calendar/Notes | **YES** | No | No | No | No | No | No |
| Credential Vault | **YES** | No | No | No | No | No | No |

### AI DevOps Landscape (2026)

| Product | AI Features | Price | Our Diff |
|---------|-------------|-------|----------|
| Harness AI | ML CI/CD, auto-rollback | $150/mo+ | We're self-hosted, broader scope |
| Kubiya | Agentic AI DevOps | $50/mo+ | We're self-hosted, BYOK model |
| PagerDuty AI | AI incident response | $41/user/mo | We cover more than just incidents |
| Datadog AI | Anomaly detection | Bundled ($15+/host) | We're self-hosted, 10x cheaper |
| Netdata | ML anomaly detection | Free OSS, $4.17/node | Monitoring only, no management |

**Key insight:** No existing product combines self-hosted server management with deeply integrated AI assistance at an indie/SMB price point. Kubiya is closest but cloud-only and enterprise-priced.

---

## 3. MARKET SIZE & OPPORTUNITY

### TAM/SAM/SOM
- **TAM (DevOps Market):** $16.13B (2025) → $51.43B (2031) at 21.33% CAGR
- **SAM (Self-hosted DevOps tools for solo→mid-market):** $2-4B segment
- **SOM (Obtainable in years 1-3):** $10-50M with strong community traction
- **Micro-SaaS segment:** $15.7B (2024) → $59.6B (2030) at ~30% CAGR

### Key Market Trends
- 62% of enterprises use DevOps tools
- 64% of teams use AI tools in development
- Self-hosting surging (privacy, cost control, data sovereignty)
- AI-native tools are fastest-growing category
- Open source as go-to-market dominates developer tools

---

## 4. TARGET AUDIENCE

### Primary Segments (Year 1)

**Segment 1: Solo Developers on VPS**
- **Size:** Millions globally (DigitalOcean alone has 4M+ customers)
- **Problem:** "I SSH into my VPS and run 15 different commands to check if everything's okay. I have Coolify for deploy, Uptime Kuma for monitoring, pgAdmin for DB, and I still manually check security."
- **Solution:** One dashboard replaces all of it + AI assistant
- **Willingness to pay:** $0-15/mo (price-sensitive, love free/OSS)
- **Marketing:** r/selfhosted, r/devops, Hacker News, Dev.to

**Segment 2: Small Dev Teams (2-10)**
- **Size:** Hundreds of thousands of dev shops globally
- **Problem:** "We share SSH access with no audit trail. Everyone has root. We can't see who deployed what or when."
- **Solution:** RBAC + audit logging + shared dashboard
- **Willingness to pay:** $29-99/mo
- **Marketing:** Twitter/X dev community, Product Hunt, tech blogs

**Segment 3: Agencies & Consultants**
- **Size:** ~100K digital agencies globally
- **Problem:** "We manage 20 client servers. Each one has different tools. We need one dashboard for all of them."
- **Solution:** Multi-server management + client segregation
- **Willingness to pay:** $99-299/mo
- **Marketing:** Agency communities, white-label partnerships

### B2B Sales Motion (Year 2+)
- Mid-market (10-100): Need SSO, compliance → $200-2000/mo
- Enterprise (100+): Need SOC2, HIPAA → Custom pricing, sales team

---

## 5. PRICING MODEL

### Open Core + BYOK AI

| Tier | Price | Features | Target |
|------|-------|----------|--------|
| **Community** | Free (OSS) | All core views, single user, BYOK Claude+Codex CLI | Solo devs, adoption |
| **Pro** | $15/seat/mo | Multi-user, RBAC, AI usage tracking, 5 servers, priority support | Freelancers, small teams |
| **Team** | $49/seat/mo | SSO (SAML/OIDC), audit logs, unlimited servers, API access, Slack integration | Growing teams |
| **Enterprise** | Custom | SOC2, Firecracker isolation, white-label, SLA, on-prem support | Agencies, enterprise |

### Why BYOK AI
- **Zero AI cost for us** — users bring their own Claude/Codex subscriptions
- **No margin pressure** — AI usage doesn't eat into revenue
- **Users already have subscriptions** — Claude Pro/Max, OpenAI API keys
- **Simplicity** — no token accounting, no billing complexity
- **Trust** — users' data goes directly to their own AI provider

### Competitive Pricing Position
| Us | vs Competitor | Savings |
|----|---------------|---------|
| Free (Community) | Coolify Cloud ($5/mo) | 100% cheaper + more features |
| $15/seat/mo (Pro) | Portainer BE ($25K/yr) | 99% cheaper |
| $49/seat/mo (Team) | Datadog ($15/host/mo × 10 hosts) | 67% cheaper |
| $49/seat/mo (Team) | Grafana Enterprise ($25K/yr) | 97% cheaper |
| Custom (Enterprise) | Kubiya ($50/mo) | More features, self-hosted |

---

## 6. AI INTEGRATION ARCHITECTURE

### Multi-Provider CLI Passthrough

```
Settings > AI Provider
  ├── Claude CLI (claude --print) — Anthropic subscription
  ├── Claude Code (claude) — Claude Max subscription (full coding agent)
  ├── Codex CLI (codex) — OpenAI's open-source coding agent
  └── None — AI features disabled, graceful degradation
```

### How It Works
1. User installs their preferred AI CLI tool on the server
2. User authenticates with their own API key/subscription
3. Our app shells out to the CLI — zero cost, zero API key management
4. AI features: SQL generation, commit messages, code review, security audit, backup strategy, terminal AI assistant

### Claude Code Integration
- Users with Claude Max can run `claude` (Claude Code) in our terminal
- Full capabilities: file editing, multi-step tasks, code generation
- Our UI provides the glass terminal — Claude Code provides the brain
- This is a unique selling point: "Claude Code with a dashboard"

### Codex CLI Integration (NEW)
- OpenAI's open-source coding agent
- Same passthrough pattern as Claude
- Users choose based on preference/subscription
- Both work for: SQL gen, commit messages, code review, terminal AI

### Sandboxing for Multi-Tenant
- Each user's AI CLI runs in their isolated container/namespace
- API keys stored encrypted in credential vault (AES-256-GCM)
- Per-user rate limiting and usage tracking
- Token metering through log parsing
- Usage dashboard shows consumption per user

---

## 7. SECURITY & SANDBOXING

### Current Security (Already Implemented)
- [x] PBKDF2 password hashing (100k iterations, SHA-512)
- [x] Session tokens (32-byte crypto.randomBytes, 24h TTL)
- [x] Optional TOTP 2FA (RFC 6238)
- [x] HttpOnly cookies, SameSite=Strict
- [x] Login rate limiting (5 attempts/15min)
- [x] SQL injection prevention (parameterized queries)
- [x] XSS prevention (escapeHtml on all user content)
- [x] Credential vault (AES-256-GCM + HMAC)
- [x] DDL safety layer (DROP/ALTER blocked without explicit flag)
- [x] Query audit logging

### Terminal Isolation Strategy

**Phase 1 — Container Isolation (MVP):**
- Container-per-user with Linux namespaces (PID, network, mount)
- seccomp profiles to restrict dangerous syscalls
- cgroups resource limits (CPU, memory, disk I/O)
- node-pty runs as unprivileged user (never root)
- Read-only filesystem except designated workspace dirs
- Automatic session timeout and cleanup
- Network namespace isolation (users can't see each other's traffic)

**Phase 2 — Firecracker MicroVMs (Enterprise):**
- 125ms boot time (imperceptible to users)
- <5 MiB memory overhead per VM
- 150 VMs/sec/host throughput
- Jailer wraps each VM with cgroups + namespaces + seccomp
- Used by AWS Lambda/Fargate — battle-tested at massive scale
- Maximum isolation without traditional VM cost

### Security Roadmap (Pre-Commercial)
- [ ] RBAC — admin, editor, viewer roles with middleware
- [ ] Audit logging — every API call logged (user, action, timestamp, IP, result)
- [ ] SSO (SAML 2.0 / OIDC) — enterprise deal-blocker if missing (kills 75-80% of deals)
- [ ] Per-user rate limiting (not just login)
- [ ] API key authentication (Bearer tokens for programmatic access)
- [ ] Content Security Policy headers
- [ ] CORS configuration
- [ ] Session invalidation on password change
- [ ] Forced password rotation policies

### Compliance Path
| Certification | Timeline | Cost | Unlocks |
|--------------|----------|------|---------|
| SOC 2 Type 1 | 3-6 months | $20-50K (Vanta/Sprinto) | Enterprise sales |
| SOC 2 Type 2 | 6-12 months after Type 1 | Included with automation | Enterprise trust |
| ISO 27001 | 9-18 months | $30-80K | European enterprise |
| GDPR compliance | Ongoing | Process-driven | EU customers |

---

## 8. SCALING ARCHITECTURE

### Phase 1: Single Node (Current)
- Express.js + Socket.IO on one process
- PgBouncer for DB connection pooling (already in stack)
- JSON file storage for runtime data
- **Capacity:** ~100 concurrent users

### Phase 2: Horizontal Scale
```
Load Balancer (sticky sessions — IP hash or cookie affinity)
    ├── Node 1 (Express + Socket.IO worker)
    ├── Node 2 (Express + Socket.IO worker)
    └── Node N
    │
Redis (Pub/Sub adapter for cross-node Socket.IO)
S3 (backups, file storage)
PgBouncer → PostgreSQL
```
- **Redis adapter** for Socket.IO cross-node events
- **Sticky sessions** required for Socket.IO handshake
- **Redis-backed sessions** (replace in-memory)
- **S3-compatible storage** for backups/files (replace local disk)
- **Node.js cluster module** (1 worker per CPU core)
- **Capacity:** ~1,000-10,000 concurrent users

### Phase 3: Enterprise Scale
- Kubernetes deployment with auto-scaling
- Firecracker microVMs for terminal isolation
- RabbitMQ as Socket.IO broker (40% less CPU than Redis at scale)
- Dedicated PG read replicas for DB Studio queries
- CDN for static assets
- **Capacity:** ~10,000+ concurrent users

---

## 9. BRANDING & NAMING

### Name Candidates

| Name | Domains to Check | Vibe | Pros | Cons |
|------|-----------------|------|------|------|
| **Bastion** | bastion.dev, bastion.sh | Fortress, secure command | Strong security connotation, memorable, military | May sound too security-focused |
| **Deck** | deck.dev, getdeck.io | Command deck, bridge | Clean, short, evocative, nautical | Common word, SEO harder |
| **Forge** | forge.dev, useforge.io | Building, crafting | Strong, action-oriented | SourceForge association |
| **Pylon** | pylon.dev, pylon.sh | Infrastructure pillar | Unique, technical, strong | Less immediately evocative |
| **Citadel** | citadel.dev, citadel.sh | Fortress, control center | Premium, powerful | May imply complexity |
| **Rig** | rig.dev, getrig.io | Equipment, setup | Short, punchy, active | Oil rig association |
| **Helm** | helm.dev | Command, steering | Perfect meaning | K8s Helm exists |

### Naming Pattern Analysis (What Works in Dev Tools 2026)
- **Single abstract word:** Vercel, Railway, Render, Fly, Coder, Linear, Cursor, Warp, Zed
- **Compound:** Gitpod, DevPod, Daytona, Northflank
- **Symbolic:** Arc, Warp, Zed — conveys speed/modernity
- **Best domains:** .dev (Google registry, dev-focused), .sh (shell/scripting vibe), .io (established)

### Brand Identity
- **Already done:** Dark mode-first (Dimension Dark), monospace typography (JetBrains Mono), cyan/orange signal system
- **Need:** Logo (geometric, minimal), ASCII art banner for terminal install, landing page, documentation site
- **Trend alignment:** Dark mode + monospace + gradient accents = 2026 dev tool aesthetic

### Positioning Statements
- **One-liner:** "Your entire server, one dashboard."
- **Tagline:** "The AI-powered, self-hosted ops dashboard."
- **VS statement:** "Replaces Coolify + Portainer + Uptime Kuma + pgAdmin in one tool."
- **Value prop:** "Stop SSH-ing into your server. Start managing it."

---

## 10. GO-TO-MARKET STRATEGY

### Phase 1: Open Source Launch (Month 1-3)

**Pre-Launch Checklist:**
- [ ] Pick name & secure domain
- [ ] Create logo (geometric, minimal, works at 16x16 favicon)
- [ ] Clean codebase of Chester/AutopilotAI references
- [ ] Write killer README with GIF demos of each major feature
- [ ] Architecture diagram (Mermaid or SVG)
- [ ] One-line install: `curl -fsSL https://[name].dev/install.sh | bash`
- [ ] Docker Compose for instant setup
- [ ] AGPL-3.0 license (protects against cloud resale)
- [ ] CONTRIBUTING.md + Code of Conduct
- [ ] GitHub Actions CI (lint, basic tests)

**Launch Day:**
- [ ] "Show HN" on Hacker News (Tuesday-Thursday, 8-10am ET)
- [ ] Reddit: r/selfhosted (430K members), r/devops (220K), r/homelab (1.8M)
- [ ] Dev.to article: "I built a self-hosted ops dashboard that replaces 5 tools"
- [ ] 3-minute YouTube demo (terminal → DB Studio → AI → deploy)
- [ ] Twitter/X thread (build-in-public style)
- [ ] Product Hunt launch (separate from HN, 1-2 weeks later)

**Target:** 1,000 GitHub stars in 90 days

### Phase 2: Community Building (Month 3-6)
- [ ] Discord server (channels: general, help, feature-requests, showcase)
- [ ] Contributor guide + "good first issue" labels
- [ ] Weekly changelog / release notes
- [ ] Respond to every GitHub issue <24h
- [ ] Technical blog series:
  - "How we built a Supabase-style DB Studio in vanilla JS"
  - "Zero-dependency web terminal with node-pty"
  - "AI-powered server management with Claude CLI"
  - "Dimension Dark: designing a glass UI for developers"
- [ ] Feature voting board (GitHub Discussions or Canny)
- [ ] Monthly community call / livestream

### Phase 3: Monetization (Month 6-12)
- [ ] Launch Pro tier ($15/seat/mo)
- [ ] Stripe billing integration
- [ ] License key system for self-hosted Pro
- [ ] Optional managed cloud hosting (for users who don't want to self-host)
- [ ] Usage analytics (opt-in telemetry)
- [ ] Customer testimonials / case studies

### Phase 4: Enterprise (Month 12-24)
- [ ] SOC 2 Type 1 certification ($20-50K with Vanta/Sprinto)
- [ ] SSO (SAML/OIDC) implementation
- [ ] Enterprise sales team (1-2 people)
- [ ] Case studies from paying customers
- [ ] Dedicated support tier
- [ ] SOC 2 Type 2 observation period
- [ ] Conference presence (DevOpsDays, KubeCon)

### Key Metrics to Track
| Metric | Target (Year 1) |
|--------|-----------------|
| GitHub stars | 5,000+ |
| Weekly active installations | 1,000+ |
| Free → paid conversion | 3-5% |
| Monthly recurring revenue | $10K+ |
| Time-to-value (install → first use) | <5 minutes |
| Net revenue retention | >110% |
| Community size (Discord) | 500+ |

### Critical GTM Insight
"Only 27% of PLG companies sustain YoY expansion." Winners run **hybrid PLG + sales**: self-serve adoption first, then enterprise sales layered on top. Pure PLG without adding sales motion leads to stagnation.

---

## 11. RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Coolify momentum** (51K stars) | HIGH | Differentiate on AI + DB Studio + breadth. They can't easily add AI-native features. |
| **"Jack of all trades"** perception | MEDIUM | Emphasize that each feature is production-grade. Show depth not just breadth. |
| **Single developer** | HIGH | Open source enables contributors. Hire #2 early from community. |
| **Enterprise readiness** (no SOC2/SSO) | MEDIUM | Phase it: community first, enterprise later. Don't chase enterprise too early. |
| **AI cost if we ever bundle** | LOW | BYOK model means zero AI cost. Only risk if we switch to bundled model. |
| **Security vulnerability** (terminal access) | HIGH | Container isolation from day 1. Firecracker for enterprise. Security audit before launch. |

---

## 12. REVENUE PROJECTIONS (Conservative)

### Year 1
- **Month 1-3:** $0 (open source launch, community building)
- **Month 4-6:** $0-2K/mo (early Pro adopters)
- **Month 6-12:** $2-10K/mo (Pro + Team tiers)
- **Year 1 total:** ~$50-80K ARR

### Year 2
- **Month 12-18:** $10-30K/mo (enterprise deals starting)
- **Month 18-24:** $30-80K/mo (enterprise + growth)
- **Year 2 total:** ~$300-700K ARR

### Year 3
- $80-200K/mo (enterprise + agency segment)
- Year 3 total: ~$1-2.5M ARR

*Based on: 5,000 free users → 3% conversion → 150 paid users × $30 avg = $4,500/mo base, growing with enterprise deals*

---

## SOURCES

### Competitor Data
- Portainer: portainer.io/pricing, 25M+ users
- Coolify: coolify.io, 51.4K GitHub stars, bootstrapped
- Supabase: supabase.com/pricing, 50K+ stars
- Grafana: $9B valuation (Feb 2026), $400M+ ARR
- Datadog: $43.9B market cap, ~$3.5B revenue
- Uptime Kuma: 83.6K GitHub stars
- Railway: $100M Series B (2025-2026)
- Render: $100M at $1.5B valuation (Feb 2026)
- Vercel: $863M total funding, $9.8B valuation
- Kubiya: kubiya.ai/pricing, $50/mo+

### Market Research
- DevOps Market: $16.13B→$51.43B (Mordor Intelligence)
- Micro-SaaS: $15.7B→$59.6B (Global Growth Insights)
- 62% enterprises use DevOps tools (Spacelift)
- 64% teams use AI in development (Spacelift)

### Security Research
- GitHub Codespaces: Full VM isolation per user
- Firecracker: 125ms boot, <5MiB, 150 VMs/sec/host
- SOC 2 Type 1: 3-6 months, $20-50K (Sprinto, Vanta)
- SSO kills 75-80% of enterprise deals if missing

### GTM Research
- PLG sustainability: only 27% maintain YoY growth (ProductLed)
- Hybrid PLG+sales wins (GreyRadius 2026)
- Show HN optimal: Tue-Thu, 8-10am ET
- r/selfhosted: 430K members, prime target
