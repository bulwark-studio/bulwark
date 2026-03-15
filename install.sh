#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
#  Bulwark v3.0 Installer — AI-powered server management platform
#  Usage: curl -fsSL https://bulwark.studio/install.sh | bash
# ============================================================================

CYAN='\033[0;36m'
ORANGE='\033[0;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}"
cat << 'BANNER'
 ____        _                      _
| __ ) _   _| |_      ____ _ _ __| | __
|  _ \| | | | \ \ /\ / / _` | '__| |/ /
| |_) | |_| | |\ V  V / (_| | |  |   <
|____/ \__,_|_| \_/\_/ \__,_|_|  |_|\_\

AI-powered server management. Your entire server, one dashboard.
BANNER
echo -e "${NC}"

INSTALL_DIR="/opt/bulwark"
REPO_URL="https://github.com/bulwark-studio/bulwark.git"
SERVICE_NAME="bulwark"
PORT=3001

# --- Detect OS ---
OS="$(uname -s)"
ARCH="$(uname -m)"
echo -e "${BOLD}System:${NC} ${OS} ${ARCH}"

if [[ "$OS" != "Linux" && "$OS" != "Darwin" ]]; then
  echo -e "${ORANGE}Warning: Bulwark is designed for Linux/macOS. Windows users should use Docker.${NC}"
  exit 1
fi

# --- Check Node.js ---
echo ""
echo -e "${BOLD}Checking prerequisites...${NC}"

install_node() {
  if [[ "$OS" == "Linux" ]]; then
    echo "  Installing Node.js 20 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
  elif [[ "$OS" == "Darwin" ]]; then
    if command -v brew &>/dev/null; then
      echo "  Installing Node.js 20 via Homebrew..."
      brew install node@20
    else
      echo "  Installing Node.js 20 via nvm..."
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
      nvm install 20
      nvm use 20
    fi
  fi
}

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VER" -ge 18 ]]; then
    echo -e "  ${CYAN}✓${NC} Node.js $(node -v)"
  else
    echo -e "  ${ORANGE}✗${NC} Node.js $(node -v) — need 18+"
    install_node
  fi
else
  echo -e "  ${ORANGE}✗${NC} Node.js not found"
  install_node
fi

# --- Check PostgreSQL (optional) ---
if command -v psql &>/dev/null; then
  echo -e "  ${CYAN}✓${NC} PostgreSQL $(psql --version | grep -oE '[0-9]+\.[0-9]+')"
else
  echo -e "  ${ORANGE}—${NC} PostgreSQL not found (optional — app works without it)"
fi

# --- Check Git ---
if ! command -v git &>/dev/null; then
  echo -e "  ${ORANGE}✗${NC} Git not found. Installing..."
  if [[ "$OS" == "Linux" ]]; then
    sudo apt-get update -qq && sudo apt-get install -y -qq git
  elif [[ "$OS" == "Darwin" ]]; then
    xcode-select --install 2>/dev/null || true
  fi
fi
echo -e "  ${CYAN}✓${NC} Git $(git --version | cut -d' ' -f3)"

# --- Check/Install Ollama (default AI provider) ---
echo ""
echo -e "${BOLD}Setting up AI provider...${NC}"

if command -v ollama &>/dev/null; then
  echo -e "  ${CYAN}✓${NC} Ollama $(ollama --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo 'installed')"
else
  echo -e "  ${ORANGE}—${NC} Ollama not found. Installing (default local AI provider)..."
  if [[ "$OS" == "Linux" ]]; then
    curl -fsSL https://ollama.com/install.sh | sh
  elif [[ "$OS" == "Darwin" ]]; then
    if command -v brew &>/dev/null; then
      brew install ollama
    else
      echo -e "  ${ORANGE}Install Ollama manually: https://ollama.com/download${NC}"
    fi
  fi
fi

# Pull default model if Ollama is available
if command -v ollama &>/dev/null; then
  OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3:8b}"
  if ! ollama list 2>/dev/null | grep -q "${OLLAMA_MODEL}"; then
    echo -e "  Pulling default model: ${BOLD}${OLLAMA_MODEL}${NC} (this may take a few minutes)..."
    ollama pull "${OLLAMA_MODEL}" || echo -e "  ${ORANGE}Model pull failed — you can run 'ollama pull ${OLLAMA_MODEL}' later${NC}"
  else
    echo -e "  ${CYAN}✓${NC} Model ${OLLAMA_MODEL} ready"
  fi
fi

# --- Clone / Update ---
echo ""
if [[ -d "$INSTALL_DIR" ]]; then
  echo -e "${BOLD}Updating existing installation...${NC}"
  cd "$INSTALL_DIR"
  git pull --rebase --autostash origin main
else
  echo -e "${BOLD}Installing Bulwark to ${INSTALL_DIR}...${NC}"
  sudo mkdir -p "$INSTALL_DIR"
  sudo chown "$(whoami)" "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR" || {
    echo -e "  ${ORANGE}Failed to clone repository. Check your network connection.${NC}"
    exit 1
  }
  cd "$INSTALL_DIR"
fi

# --- Install dependencies ---
echo ""
echo -e "${BOLD}Installing dependencies...${NC}"
npm install --production
echo -e "  ${CYAN}✓${NC} Dependencies installed"

# --- Ensure data directory ---
mkdir -p data/backups
echo -e "  ${CYAN}✓${NC} Data directories ready"

# --- Generate config ---
ADMIN_PASS=$(openssl rand -hex 16 | head -c16)

if [[ ! -f ".env" ]]; then
  echo -e "${BOLD}Creating configuration...${NC}"

  # Detect Ollama URL
  OLLAMA_URL="http://localhost:11434"
  if curl -sf "${OLLAMA_URL}/api/tags" &>/dev/null; then
    echo -e "  ${CYAN}✓${NC} Ollama detected at ${OLLAMA_URL}"
  fi

  cat > .env << EOF
MONITOR_PORT=${PORT}
MONITOR_USER=admin
MONITOR_PASS=${ADMIN_PASS}
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
ENCRYPTION_KEY=$(openssl rand -hex 32)

# ── AI Providers ────────────────────────────────────────────────
# Ollama (default local LLM — install from ollama.com)
OLLAMA_BASE_URL=${OLLAMA_URL}
OLLAMA_MODEL=${OLLAMA_MODEL:-qwen3:8b}

# Anthropic Claude API (optional — for premium analysis tasks)
# ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (optional — for Codex CLI fallback)
# OPENAI_API_KEY=sk-...
EOF
  echo -e "  ${CYAN}✓${NC} .env created"
else
  echo -e "  ${CYAN}—${NC} .env already exists, keeping current config"
  ADMIN_PASS="(existing)"
fi

# --- Run tests ---
echo ""
echo -e "${BOLD}Running tests...${NC}"
if npm test 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} All tests passed"
else
  echo -e "  ${ORANGE}—${NC} Some tests failed (non-critical, check logs)"
fi

# --- Create systemd service (Linux only) ---
if [[ "$OS" == "Linux" ]] && command -v systemctl &>/dev/null; then
  echo ""
  echo -e "${BOLD}Creating systemd service...${NC}"

  NODE_PATH=$(which node)

  sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=Bulwark v3.0 — AI-Powered Server Management Platform
After=network.target postgresql.service ollama.service
Wants=postgresql.service ollama.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_PATH} ${INSTALL_DIR}/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable ${SERVICE_NAME}
  sudo systemctl start ${SERVICE_NAME}
  echo -e "  ${CYAN}✓${NC} Service created and started"
fi

# --- Done ---
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Bulwark v3.0 installed successfully!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}      http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):${PORT}"
echo -e "  ${BOLD}User:${NC}     admin"
echo -e "  ${BOLD}Password:${NC} ${ADMIN_PASS}"
echo -e "  ${BOLD}AI:${NC}       Ollama (local) — ${OLLAMA_MODEL:-qwen3:8b}"
echo ""
if [[ "$OS" == "Linux" ]] && command -v systemctl &>/dev/null; then
  echo -e "  ${BOLD}Manage:${NC}   sudo systemctl {start|stop|restart|status} ${SERVICE_NAME}"
  echo -e "  ${BOLD}Logs:${NC}     sudo journalctl -u ${SERVICE_NAME} -f"
else
  echo -e "  ${BOLD}Start:${NC}    cd ${INSTALL_DIR} && node server.js"
fi
echo -e "  ${BOLD}Config:${NC}   ${INSTALL_DIR}/.env"
echo ""
echo -e "  ${ORANGE}Change your password immediately after first login!${NC}"
echo ""
