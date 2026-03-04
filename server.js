#!/usr/bin/env node
// =============================================================================
// Chester Dev Monitor v2.0 — Enterprise Server Management Platform
// Express.js + Socket.IO | Port 3001
//
// Usage:
//   cd dev-monitor && npm install && npm start
//   pm2 start server.js --name "dev-monitor"
//
// Access: http://localhost:3001 or https://monitor.autopilotaitech.com
// =============================================================================

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

// ── Express + Socket.IO setup ────────────────────────────────────────────────
const PORT = process.env.MONITOR_PORT || 3001;
const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: false } });

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  requireAuth, requireAdmin,
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

// ── Route modules (auth routes BEFORE requireAuth middleware) ─────────────────
require("./routes/auth")(app, ctx);

// Protected routes (requireAuth applied globally after auth routes)
app.use(requireAuth);
app.use(express.static(path.join(__dirname, "public")));

require("./routes/system")(app, ctx);
require("./routes/tickets")(app, ctx);
require("./routes/claude")(app, ctx);
require("./routes/servers")(app, ctx);
require("./routes/docker")(app, ctx);
require("./routes/databases")(app, ctx);
require("./routes/security")(app, ctx);
require("./routes/ssl")(app, ctx);
require("./routes/envvars")(app, ctx);
require("./routes/files")(app, ctx);
require("./routes/cron")(app, ctx);
require("./routes/ftp")(app, ctx);
require("./routes/notifications")(app, ctx);
require("./routes/multi-server")(app, ctx);
require("./routes/uptime")(app, ctx);

// ── Socket.IO auth + handlers ────────────────────────────────────────────────
let pty = null;
try { pty = require("node-pty"); } catch { console.warn("[WARN] node-pty not available — terminal disabled"); }

const ptyMap = new Map();

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

  socket.on("terminal_input", (data) => {
    if (!isSocketAdmin(socket)) return;
    const term = ptyMap.get(socket.id);
    if (term) term.write(data);
  });

  socket.on("terminal_resize", ({ cols, rows }) => {
    if (!isSocketAdmin(socket)) return;
    const term = ptyMap.get(socket.id);
    if (term) { try { term.resize(cols, rows); } catch {} }
  });

  socket.on("terminal_start", (opts) => {
    if (!isSocketAdmin(socket)) { socket.emit("terminal_output", "\r\n[ERROR] terminal access requires admin role.\r\n"); return; }
    if (!pty) { socket.emit("terminal_output", "\r\n[ERROR] node-pty not available.\r\n"); return; }
    const existing = ptyMap.get(socket.id);
    if (existing) { try { existing.kill(); } catch {} }
    const cols = (opts && opts.cols > 0) ? opts.cols : 120;
    const rows = (opts && opts.rows > 0) ? opts.rows : 30;
    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    const term = pty.spawn(shell, [], {
      name: "xterm-256color", cols, rows,
      cwd: REPO_DIR, env: { ...process.env, TERM: "xterm-256color" },
    });
    term.onData((data) => socket.emit("terminal_output", data));
    term.onExit(() => { ptyMap.delete(socket.id); socket.emit("terminal_output", "\r\n[Session ended]\r\n"); });
    ptyMap.set(socket.id, term);
  });

  socket.on("claude_run", ({ prompt }) => {
    if (!isSocketAdmin(socket)) { socket.emit("claude_output", "\r\n[ERROR] Claude CLI requires admin role.\r\n"); return; }
    if (prompt && ctx.runClaude) ctx.runClaude(prompt);
  });

  socket.on("disconnect", () => {
    const term = ptyMap.get(socket.id);
    if (term) { try { term.kill(); } catch {} }
    ptyMap.delete(socket.id);
  });
});

async function sendInitialState(socket) {
  const [sys, tickets, activity, procs] = await Promise.all([
    getSystemInfo(),
    ctx.getTicketSummary ? ctx.getTicketSummary() : { summary: [], tickets: [] },
    ctx.getRecentActivity ? ctx.getRecentActivity() : [],
    ctx.getProcessList ? ctx.getProcessList() : [],
  ]);
  socket.emit("init", { system: sys, tickets, activity, processes: procs });
}

// ── Real-time broadcasts ─────────────────────────────────────────────────────
setInterval(() => {
  if (io.engine.clientsCount === 0) return;
  const metrics = collectMetrics();
  io.emit("metrics", { system: getSystemInfo(), extended: metrics, ts: Date.now() });
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

// ── Cleanup & Uptime ─────────────────────────────────────────────────────────
setInterval(cleanupSessions, 5 * 60 * 1000);
uptimeStore.start();

// ── Start ────────────────────────────────────────────────────────────────────
const users = ensureDefaultAdmin();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Chester Dev Monitor v2.0 running on http://0.0.0.0:${PORT}`);
  console.log(`  Dev DB: ${pool ? "connected" : "NOT connected (set DATABASE_URL)"}`);
  console.log(`  VPS DB: ${vpsPool ? "connected" : "NOT connected (set VPS_DATABASE_URL)"}`);
  console.log(`  Users: ${users.length} (stored in users.json)`);
  console.log(`  Repo: ${REPO_DIR}`);
  console.log(`  PTY: ${pty ? "available" : "disabled"}`);
  console.log(`  Routes: 16 modules loaded`);
  console.log(`  Views: 22 sidebar panels\n`);
});
