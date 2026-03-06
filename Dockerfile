# ══════════════════════════════════════════════════════════════════
# Bulwark v2.1 — Ubuntu 24.04 + Node.js 22 + AI CLIs
# Self-contained server management platform
# ══════════════════════════════════════════════════════════════════

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# ── System packages ──────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ca-certificates git openssh-client bash sudo \
    python3 make g++ \
    # Terminal tools (used by views)
    procps htop net-tools iproute2 \
    # pg_dump/psql for DB backups (version must match or exceed server)
    lsb-release \
    # Cron for cron-enhanced view
    cron \
    && rm -rf /var/lib/apt/lists/*

# ── PostgreSQL 17 client (pg_dump/psql must match server version) ─
RUN sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' && \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg && \
    apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 && \
    rm -rf /var/lib/apt/lists/*

# ── Node.js 22 (required for Codex CLI) ─────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# ── AI CLIs (BYOK — users bring their own API keys) ─────────────
RUN npm install -g @anthropic-ai/claude-code @openai/codex 2>/dev/null || true

# ── Non-root user (Claude CLI refuses --dangerously-skip-permissions as root) ─
RUN useradd -m -s /bin/bash -G sudo bulwark && \
    echo 'bulwark ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# ── App setup ────────────────────────────────────────────────────
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY server.js ./
COPY write-config.js ./
COPY routes/ ./routes/
COPY lib/ ./lib/
COPY data/ ./data/
COPY docs/ ./docs/
COPY public/ ./public/
COPY media/ ./media/

# Ensure data dirs exist with write permissions
RUN mkdir -p /app/data/backups && chown -R bulwark:bulwark /app

ENV NODE_ENV=production
ENV MONITOR_PORT=3001

EXPOSE 3001

USER bulwark

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -sf http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
