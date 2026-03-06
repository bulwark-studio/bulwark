# First Tweet Drafts for @BulwarkStudio

## Option 1 (launch announcement)
Bulwark is live.

Open-source server dashboard that replaces Portainer + pgAdmin + Uptime Kuma — in one glass-dark UI.

Terminal, Docker, DB Studio, Git, Deploy, Security, Monitoring.
4 npm deps. No React. No build step. BYOK AI.

Free forever. Self-host in 60 seconds.

https://bulwark.studio
https://github.com/bulwark-studio/bulwark

## Option 2 (technical flex)
We built a server management platform with 270+ API endpoints, 34 views, and only 4 npm dependencies.

No React. No webpack. No build step. Vanilla JS + Express + Socket.IO.

AI features? Bring your own Claude/Codex subscription. Zero AI cost for us.

AGPL-3.0. Self-host free forever.

https://bulwark.studio

## Option 3 (problem/solution)
Managing servers shouldn't require 6 different tools.

Bulwark = Terminal + Docker + Database + Git + Deploy + Security + Monitoring

One dashboard. Self-hosted. Open source.

curl -fsSL https://bulwark.studio/install.sh | bash

## Thread follow-up tweets

### Tweet 2: Screenshots
Here's what 34 views look like in Dimension Dark theme.

Glass morphism + cyan/orange signal system. Every card is backdrop-filter: blur(20px).

[attach 4 screenshots: Dashboard, SQL Editor, Docker, Terminal]

### Tweet 3: Architecture
The entire frontend is vanilla JS with a ViewRegistry pattern.

Each view self-registers on window.Views. No bundler, no transpiler, no virtual DOM.

31 route modules. 13 shared libraries. Ships as-is.

### Tweet 4: AI
AI features use BYOK — Bring Your Own Key.

Install Claude CLI or Codex on your server. Bulwark shells out to them.

- SQL generation from natural language
- DB security audits with scoring
- Backup strategy analysis
- Commit message generation
- Ticket triage

Your subscription. Your data. Zero AI cost for us.

### Tweet 5: CTA
Star the repo if this looks useful:
https://github.com/bulwark-studio/bulwark

Follow @BulwarkStudio for updates.

Pro/Team/Enterprise tiers coming soon with RBAC, SSO, and audit logs.
