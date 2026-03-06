# Contributing to Bulwark

Thanks for your interest in contributing! Bulwark is an open-source, AI-powered server management platform and we welcome contributions of all kinds.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/bulwark-studio/bulwark.git
cd bulwark

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your DATABASE_URL, MONITOR_USER, MONITOR_PASS

# Start the server
npm start
# Open http://localhost:3001
```

### Prerequisites
- Node.js 18+
- PostgreSQL 17 (optional — app works without it in degraded mode)
- Docker (optional — for Docker management features)

### Hot Reload (Development)

Bulwark has no build step, so development is fast:

```bash
# Install nodemon for auto-restart on backend changes
npx nodemon server.js

# Frontend changes are instant — just refresh the browser
# No transpilation, no bundling, no waiting
```

### Project Structure

```
server.js          → Express + Socket.IO setup, auth, intervals
routes/            → 31 route modules (each exports function(app, ctx))
lib/               → 16 shared libraries (db, auth, AI, RBAC, etc.)
public/
  index.html       → App shell with 34 view containers
  css/             → theme.css, layout.css, components.css
  js/
    app.js         → State, Socket.IO, view registry, nav
    views/         → 34 self-registering view modules
data/              → Runtime JSON stores (no DB required)
landing/           → Marketing site (bulwark.studio)
```

## Code Style

Bulwark uses **vanilla JavaScript** with no build step, no bundler, no framework.

### Backend (Node.js)
- Express.js route modules in `routes/`
- Shared libraries in `lib/`
- Each route module exports `function(app, ctx)` and receives the shared context
- Use `ctx.requireAuth`, `ctx.requireRole('editor')`, `ctx.requireAdmin` for auth
- 4 npm dependencies only — avoid adding new ones unless absolutely necessary

### Frontend (Vanilla JS)
- ViewRegistry pattern: each view self-registers on `window.Views`
- No React, no Vue, no Angular — plain DOM manipulation
- Use `Modal.open()` / `Modal.confirm()` for modals
- Use `Toast.success()` / `Toast.error()` for notifications
- Use `escapeHtml()` / `esc()` for all user-generated content (XSS prevention)
- Glass theme: use CSS variables (`--cyan`, `--orange`, `--surface`, etc.)

### Signal System
- Cyan (#22d3ee) = positive / success / healthy
- Orange (#ff6b2b) = negative / error / warning
- **Never** use green for success or red for error

## Making Changes

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/my-feature`
3. **Make your changes** — keep commits focused and atomic
4. **Test** — start the server, verify your changes work in the browser
5. **Submit a PR** against `main`

### PR Guidelines
- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Add screenshots for UI changes
- Update CLAUDE.md if you add routes, libs, or views

## Reporting Issues

- Use the [bug report template](https://github.com/bulwark-studio/bulwark/issues/new?template=bug_report.yml) for bugs
- Use the [feature request template](https://github.com/bulwark-studio/bulwark/issues/new?template=feature_request.yml) for ideas
- Check existing issues before creating a new one

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful and constructive.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
