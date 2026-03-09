#!/usr/bin/env node
// =============================================================================
// Bulwark v2.1 — Enterprise Server Management Platform
// Express.js + Socket.IO | Port 3001
//
// Usage:
//   cd dev-monitor && npm install && npm start
//   pm2 start server.js --name "dev-monitor"
//
// Access: http://localhost:3001
// =============================================================================

// Load .env file if present (no dotenv dependency needed)
const fs_env = require("fs");
const envPath = require("path").join(__dirname, ".env");
if (fs_env.existsSync(envPath)) {
  fs_env.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const express = require("express");
const http = require("http");
const os = require("os");
const path = require("path");
const { Server: SocketServer } = require("socket.io");

// ── Lib modules ──────────────────────────────────────────────────────────────
const { pool, vpsPool, dbQuery, vpsQuery } = require("./lib/db");
const { ensureDefaultAdmin } = require("./lib/users");
const { sessions, validateSession, parseCookies, isSocketAdmin, cleanupSessions } = require("./lib/sessions");
const { execCommand, REPO_DIR } = require("./lib/exec");
const { callAdapter } = require("./lib/adapter-client");
const { getSystemInfo, collectMetrics, getDiskUsage } = require("./lib/metrics-collector");
const uptimeStore = require("./lib/uptime-store");
const neuralCache = require("./lib/neural-cache");
const { requireRole, requireAction } = require("./lib/rbac");
const audit = require("./lib/audit");

// ── Express + Socket.IO setup ────────────────────────────────────────────────
const PORT = process.env.MONITOR_PORT || 3001;
const APP_NAME = process.env.APP_NAME || "Bulwark";
const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: false } });

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Security Headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.socket.io https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; " +
    "connect-src 'self' ws: wss:;"
  );
  next();
});

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const session = validateSession(cookies.monitor_session);
  if (session) { req.user = session; return next(); }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const s = validateSession(authHeader.slice(7));
    if (s) { req.user = s; return next(); }
  }
  if (req.path.startsWith("/api/") || req.path.startsWith("/adapter/")) return res.status(401).json({ error: "Unauthorized" });
  res.redirect("/login");
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin required" });
  next();
}

// ── Shared context for route modules ─────────────────────────────────────────
const ctx = {
  pool, vpsPool, dbQuery, vpsQuery, io,
  execCommand, REPO_DIR, callAdapter,
  requireAuth, requireAdmin, requireRole, requireAction,
  // These get populated by route modules:
  getTicketSummary: null,
  getRecentActivity: null,
  getProcessList: null,
  getSystemInfo,
  getServerHealth: null,
  runClaude: null,
  activeClaudeProc: null,
  sendNotification: null,
};

function getSafeSettings(settings) {
  const safe = { ...settings };
  if (safe.smtp) {
    safe.smtp = { ...safe.smtp };
    if (safe.smtp.pass) safe.smtp.pass = "••••";
  }
  return safe;
}

// ── Public assets (no auth required — favicon, logo, fonts) ──────────────────
app.use("/favicon.svg", express.static(path.join(__dirname, "public", "favicon.svg")));
app.use("/logo.svg", express.static(path.join(__dirname, "public", "logo.svg")));
app.get("/api/branding", (req, res) => { res.json({ name: APP_NAME, version: "2.1.0" }); });

// ── Route modules (auth routes BEFORE requireAuth middleware) ─────────────────
require("./routes/auth")(app, ctx);

// Protected routes (requireAuth applied globally after auth routes)
app.use(requireAuth);
app.use(audit.auditMiddleware);

// Cache middleware — auto-cache GET API responses, auto-invalidate on writes
// Excludes: auth, streaming, real-time, and cache endpoints themselves
const apiCacheMiddleware = neuralCache.cacheMiddleware();
app.use('/api', (req, res, next) => {
  const skip = req.path.startsWith('/auth') || req.path.startsWith('/cache') ||
    req.path.startsWith('/mcp') || req.path.startsWith('/system') ||
    req.path.startsWith('/audit');
  if (skip) return next();
  apiCacheMiddleware(req, res, next);
});
app.use('/api', neuralCache.invalidationMiddleware);
app.use(express.static(path.join(__dirname, "public")));
app.use("/media", express.static(path.join(__dirname, "media")));

// ── Docs API (serve markdown) ─────────────────────────────────────────────────
app.get("/api/docs/getting-started", (req, res) => {
  const docsPath = path.join(__dirname, "docs", "getting-started.md");
  try {
    const content = fs_env.readFileSync(docsPath, "utf8");
    res.json({ content });
  } catch {
    res.json({ content: "# Documentation\n\nNo documentation found." });
  }
});

// ── Audit log API ─────────────────────────────────────────────────────────────
app.get("/api/audit", requireAdmin, (req, res) => {
  const { user, action, from, to, limit, offset } = req.query;
  res.json(audit.getLog({ user, action, from, to, limit: parseInt(limit) || 100, offset: parseInt(offset) || 0 }));
});
app.get("/api/audit/stats", requireAdmin, (req, res) => {
  res.json(audit.getStats());
});
app.get("/api/audit/export", requireAdmin, (req, res) => {
  const format = req.query.format || 'json';
  const data = audit.getLog({ limit: 10000 });
  if (format === 'csv') {
    const header = 'timestamp,user,role,action,resource,method,ip,result\n';
    const rows = data.entries.map(e => `${e.timestamp},${e.user},${e.role},"${e.action}",${e.resource},${e.method},${e.ip},${e.result}`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
    return res.send(header + rows);
  }
  res.setHeader('Content-Disposition', 'attachment; filename=audit-log.json');
  res.json(data.entries);
});

// ── AI Provider Settings API ─────────────────────────────────────────────────
const settingsFile = path.join(__dirname, "data", "settings.json");
function loadSettings() {
  try { if (fs_env.existsSync(settingsFile)) return JSON.parse(fs_env.readFileSync(settingsFile, "utf8")); } catch {}
  return { aiProvider: "claude-cli" };
}
function saveSettings(s) {
  const dir = path.dirname(settingsFile);
  if (!fs_env.existsSync(dir)) fs_env.mkdirSync(dir, { recursive: true });
  fs_env.writeFileSync(settingsFile, JSON.stringify(s, null, 2), "utf8");
}

app.get("/api/settings", (req, res) => { res.json(getSafeSettings(loadSettings())); });
app.put("/api/settings", requireAdmin, (req, res) => {
  const current = loadSettings();
  const updated = { ...current, ...req.body };
  // Whitelist allowed keys
  const allowed = {
    aiProvider: updated.aiProvider || "claude-cli",
    timezone: updated.timezone || current.timezone || "",
  };
  // Preserve SMTP config if present
  if (updated.smtp) {
    allowed.smtp = {
      host: updated.smtp.host || "",
      port: parseInt(updated.smtp.port) || 587,
      user: updated.smtp.user || "",
      pass: updated.smtp.pass || (current.smtp ? current.smtp.pass : "") || "",
      from: updated.smtp.from || "",
    };
  } else if (current.smtp) {
    allowed.smtp = current.smtp;
  }
  // Preserve email alert rules
  if (updated.emailRules) {
    allowed.emailRules = updated.emailRules;
  } else if (current.emailRules) {
    allowed.emailRules = current.emailRules;
  }
  saveSettings(allowed);
  res.json(getSafeSettings(allowed));
});
app.get("/api/settings/ai/detect", requireAdmin, async (req, res) => {
  const results = {};
  const { execCommand } = ctx;
  for (const [name, cmd] of [["claude-cli", "claude --version"], ["codex-cli", "codex --version"]]) {
    try {
      const out = await execCommand(cmd);
      const version = (out.stdout || out.stderr || "").trim();
      results[name] = { installed: out.code === 0, version };
    } catch {
      results[name] = { installed: false };
    }
  }
  res.json(results);
});

require("./routes/system")(app, ctx);
require("./routes/tickets")(app, ctx);
require("./routes/claude")(app, ctx);
require("./routes/servers")(app, ctx);
// require("./routes/docker")(app, ctx);       // LEGACY adapter proxy — superseded by docker-direct.js
// require("./routes/databases")(app, ctx);    // LEGACY adapter proxy — superseded by db-studio.js
require("./routes/db-studio")(app, ctx);
require("./routes/db-projects")(app, ctx);
require("./routes/db-assistant")(app, ctx);
require("./routes/briefing")(app, ctx);
require("./routes/security")(app, ctx);
require("./routes/ssl")(app, ctx);
require("./routes/envvars")(app, ctx);        // LEGACY but has unique CRUD endpoints not in envvars-enhanced.js
require("./routes/files")(app, ctx);          // LEGACY but has unique CRUD endpoints not in files-enhanced.js
// require("./routes/cron")(app, ctx);         // LEGACY adapter proxy — superseded by cron-enhanced.js
require("./routes/ftp")(app, ctx);
require("./routes/notifications")(app, ctx);
require("./routes/multi-server")(app, ctx);
require("./routes/uptime")(app, ctx);
require("./routes/cloudflare")(app, ctx);
require("./routes/docker-direct")(app, ctx);
require("./routes/credentials")(app, ctx);
require("./routes/git-projects")(app, ctx);
require("./routes/git-enhanced")(app, ctx);
require("./routes/deploy")(app, ctx);
require("./routes/cron-enhanced")(app, ctx);
require("./routes/files-enhanced")(app, ctx);
require("./routes/envvars-enhanced")(app, ctx);
require("./routes/security-enhanced")(app, ctx);
require("./routes/notification-center")(app, ctx);
require("./routes/calendar")(app, ctx);
require("./routes/mcp")(app, ctx);
require("./routes/github-hub")(app, ctx);

// Neural Cache — register API routes
neuralCache.registerRoutes(app, ctx);

// ── Socket.IO auth + handlers — Persistent Terminal Sessions ─────────────────
//
// PTY sessions keyed by username (not socket.id) so they survive page reloads
// & socket reconnections. Grace period keeps PTY alive on disconnect; reconnect
// replays buffered output.

let pty = null;
try { pty = require("node-pty"); } catch { console.warn("[WARN] node-pty not available — terminal disabled"); }

const TERM_BUFFER_SIZE = 50000;      // chars to keep for replay
const TERM_GRACE_PERIOD = 5 * 60000; // 5 min before orphan kill

// Map<username, { term, sockets: Set<socket>, buffer: string, graceTimer }>
const termSessions = new Map();

function getTermSession(username) {
  return termSessions.get(username) || null;
}

function appendTermBuffer(sess, data) {
  sess.buffer += data;
  if (sess.buffer.length > TERM_BUFFER_SIZE) {
    sess.buffer = sess.buffer.slice(-TERM_BUFFER_SIZE);
  }
}

function emitToTermSession(sess, event, data) {
  for (const s of sess.sockets) {
    s.emit(event, data);
  }
}

function createTermSession(username, socket, cols, rows) {
  try {
    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    const fs = require("fs");
    const termCwd = fs.existsSync(REPO_DIR) ? REPO_DIR : process.cwd();
    const term = pty.spawn(shell, [], {
      name: "xterm-256color", cols: cols || 120, rows: rows || 30,
      cwd: termCwd, env: { ...process.env, TERM: "xterm-256color" },
    });

    const sess = {
      term,
      sockets: new Set([socket]),
      buffer: "",
      graceTimer: null,
    };

    term.onData((data) => {
      appendTermBuffer(sess, data);
      emitToTermSession(sess, "terminal_output", data);
    });

    term.onExit(() => {
      emitToTermSession(sess, "terminal_output", "\r\n\x1b[33m[Session ended]\x1b[0m\r\n");
      emitToTermSession(sess, "terminal_exited", {});
      if (sess.graceTimer) clearTimeout(sess.graceTimer);
      termSessions.delete(username);
    });

    termSessions.set(username, sess);
    return sess;
  } catch (e) {
    socket.emit("terminal_output", "\r\n[ERROR] Terminal not available: " + e.message + "\r\n");
    return null;
  }
}

function detachTermSocket(username, socket) {
  const sess = termSessions.get(username);
  if (!sess) return;
  sess.sockets.delete(socket);
  if (sess.sockets.size === 0) {
    sess.graceTimer = setTimeout(() => {
      try { sess.term.kill(); } catch {}
      termSessions.delete(username);
    }, TERM_GRACE_PERIOD);
  }
}

function attachTermSocket(username, socket) {
  const sess = termSessions.get(username);
  if (!sess) return false;
  if (sess.graceTimer) {
    clearTimeout(sess.graceTimer);
    sess.graceTimer = null;
  }
  sess.sockets.add(socket);
  return true;
}

io.use((socket, next) => {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const token = socket.handshake.auth?.token;
  const session = token ? validateSession(token) : validateSession(cookies.monitor_session);
  if (session) { socket.data.session = session; return next(); }
  next(new Error("Unauthorized"));
});

io.on("connection", (socket) => {
  console.log(`[IO] Client connected: ${socket.id}`);
  sendInitialState(socket);

  const getUsername = () => socket.data.session?.username || socket.data.session?.user || "unknown";

  socket.on("terminal_input", (data) => {
    if (!isSocketAdmin(socket)) return;
    const sess = getTermSession(getUsername());
    if (sess) sess.term.write(data);
  });

  socket.on("terminal_resize", ({ cols, rows }) => {
    if (!isSocketAdmin(socket)) return;
    const sess = getTermSession(getUsername());
    if (sess && cols && rows) { try { sess.term.resize(cols, rows); } catch {} }
  });

  // terminal_start: create new PTY or reattach to existing
  socket.on("terminal_start", (opts) => {
    if (!isSocketAdmin(socket)) { socket.emit("terminal_output", "\r\n[ERROR] terminal access requires admin role.\r\n"); return; }
    if (!pty) { socket.emit("terminal_output", "\r\n[ERROR] node-pty not available.\r\n"); return; }

    const username = getUsername();
    const cols = (opts && opts.cols > 0) ? opts.cols : 120;
    const rows = (opts && opts.rows > 0) ? opts.rows : 30;

    const existing = getTermSession(username);
    if (existing) {
      // Reattach to surviving session
      attachTermSocket(username, socket);
      if (existing.buffer) socket.emit("terminal_replay", existing.buffer);
      socket.emit("terminal_reattach_ok", { reattached: true });
      try { existing.term.resize(cols, rows); } catch {}
      return;
    }

    createTermSession(username, socket, cols, rows);
  });

  // Explicit reattach attempt (on socket reconnect)
  socket.on("terminal_reattach", (data) => {
    if (!isSocketAdmin(socket)) return;
    const username = getUsername();
    const existing = getTermSession(username);
    if (existing) {
      attachTermSocket(username, socket);
      if (existing.buffer) socket.emit("terminal_replay", existing.buffer);
      socket.emit("terminal_reattach_ok", { reattached: true });
      const cols = (data && data.cols) || 120;
      const rows = (data && data.rows) || 30;
      try { existing.term.resize(cols, rows); } catch {}
    } else {
      socket.emit("terminal_reattach_fail", {});
    }
  });

  socket.on("claude_run", ({ prompt }) => {
    const role = socket?.data?.session?.role;
    if (role !== "admin" && role !== "editor") { socket.emit("claude_output", "\r\n[ERROR] AI requires editor role or higher.\r\n"); return; }
    if (prompt && ctx.runClaude) ctx.runClaude(prompt);
  });

  socket.on("disconnect", () => {
    // Don't kill PTY — detach and start grace period
    detachTermSocket(getUsername(), socket);
  });
});

async function sendInitialState(socket) {
  const [sys, tickets, activity, procs] = await Promise.all([
    getSystemInfo(),
    ctx.getTicketSummary ? ctx.getTicketSummary() : { summary: [], tickets: [] },
    ctx.getRecentActivity ? ctx.getRecentActivity() : [],
    ctx.getProcessList ? ctx.getProcessList() : [],
  ]);
  sys.connectedClients = io.engine.clientsCount || 0;
  socket.emit("init", { system: sys, tickets, activity, processes: procs });
}

// ── Real-time broadcasts ─────────────────────────────────────────────────────
setInterval(() => {
  if (io.engine.clientsCount === 0) return;
  const metrics = collectMetrics();
  const sys = getSystemInfo();
  sys.connectedClients = io.engine.clientsCount || 0;
  io.emit("metrics", { system: sys, extended: metrics, ts: Date.now() });
}, 3000);

setInterval(async () => {
  if (io.engine.clientsCount === 0) return;
  const [tickets, activity, processes] = await Promise.all([
    ctx.getTicketSummary ? ctx.getTicketSummary() : { summary: [], tickets: [] },
    ctx.getRecentActivity ? ctx.getRecentActivity() : [],
    ctx.getProcessList ? ctx.getProcessList() : [],
  ]);
  io.emit("tickets", tickets);
  io.emit("activity", { activity });
  io.emit("process_list", { processes });
}, 10000);

setInterval(async () => {
  if (io.engine.clientsCount === 0) return;
  if (ctx.getServerHealth) io.emit("server_health", { servers: await ctx.getServerHealth() });
}, 30000);

// Broadcast cache stats every 10s
setInterval(() => {
  if (io.engine.clientsCount === 0) return;
  try { io.emit("cache_stats", { cache_stats: neuralCache.getStats() }); } catch {}
}, 10000);

// ── Cleanup & Uptime ─────────────────────────────────────────────────────────
setInterval(cleanupSessions, 5 * 60 * 1000);
uptimeStore.start();

// ── Start ────────────────────────────────────────────────────────────────────
const users = ensureDefaultAdmin();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Bulwark v2.1 running on http://0.0.0.0:${PORT}`);
  console.log(`  Dev DB: ${pool ? "connected" : "NOT connected (set DATABASE_URL)"}`);
  console.log(`  VPS DB: ${vpsPool ? "connected" : "NOT connected (set VPS_DATABASE_URL)"}`);
  console.log(`  Users: ${users.length} | AI: ${loadSettings().aiProvider}`);
  console.log(`  Repo: ${REPO_DIR} | PTY: ${pty ? "available" : "disabled"}`);
  console.log(`  Routes: 29 modules | Views: 35 | Libs: 16\n`);
});
