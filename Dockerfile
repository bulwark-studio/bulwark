# ══════════════════════════════════════════════════════════════════
# Bulwark — Ubuntu 24.04 + Node.js 20
# Single-stage build (Express.js, no build step)
# ══════════════════════════════════════════════════════════════════

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js 20 + native build tools for node-pty
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ca-certificates \
    python3 make g++ && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install (node-pty compiles native addon here)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application files
COPY server.js ./
COPY write-config.js ./
COPY routes/ ./routes/
COPY lib/ ./lib/
COPY data/ ./data/
COPY public/ ./public/

ENV NODE_ENV=production
ENV MONITOR_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -sf http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
