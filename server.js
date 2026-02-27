#!/usr/bin/env node
// =============================================================================
// Chester Dev Monitor — Standalone server control panel for dev ticket pipeline
// Runs on port 3001, completely separate from admin app
//
// Usage:
//   cd dev-monitor && npm install && npm start
//   pm2 start server.js --name "dev-monitor"
//
// Access: http://localhost:3001 or https://monitor.autopilotaitech.com
// =============================================================================

const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { Server: SocketServer } = require("socket.io");
const { Pool } = require("pg");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.MONITOR_PORT || 3001;
const DB_URL = process.env.DATABASE_URL || "";
const REPO_DIR = process.env.REPO_DIR || path.resolve(__dirname, "../admin");
const VPS_HOST = process.env.VPS_HOST || "https://admin.autopilotaitech.com";
const VPS_DB_URL = process.env.VPS_DATABASE_URL || "";
const USERS_FILE = path.join(__dirname, "users.json");

// ── User Store (JSON file) ──────────────────────────────────────────────────
// Users stored in users.json: [{ id, username, passwordHash, salt, totp_secret, totp_enabled, role, created }]

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {}
  return [];
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

// Bootstrap: create default admin if no users exist
function ensureDefaultAdmin() {
  let users = loadUsers();
  if (users.length === 0) {
    const defaultPass = process.env.MONITOR_PASS || "chester2026";
    const { hash, salt } = hashPassword(defaultPass);
    users.push({
      id: crypto.randomUUID(),
      username: process.env.MONITOR_USER || "admin",
      passwordHash: hash,
      salt,
      totp_secret: null,
      totp_enabled: false,
      role: "admin",
      created: new Date().toISOString(),
    });
    saveUsers(users);
    console.log(`[AUTH] Created default admin user (password: ${defaultPass})`);
  }
  return users;
}

// ── TOTP (RFC 6238) ─────────────────────────────────────────────────────────
// Implements TOTP without external dependencies using Node crypto

function generateTOTPSecret() {
  // Generate 20 random bytes, encode as base32
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let result = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, "0");
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
}

function base32Decode(encoded) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of encoded.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret, timeStep = 30, digits = 6) {
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(time, 4);

  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}

function verifyTOTP(secret, token, window = 1) {
  // Check current time step and +/- window steps
  const timeStep = 30;
  const now = Math.floor(Date.now() / 1000 / timeStep);
  for (let i = -window; i <= window; i++) {
    const time = now + i;
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(time, 4);
    const key = base32Decode(secret);
    const hmac = crypto.createHmac("sha1", key).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
    if (code.toString().padStart(6, "0") === token) return true;
  }
  return false;
}

function getTOTPUri(secret, username, issuer = "ChesterDevMonitor") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ── Session Store ────────────────────────────────────────────────────────────
const sessions = new Map(); // token -> { user, userId, role, created, expires }
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const pendingTOTP = new Map(); // token -> { userId, username, created }

function createSession(userId, username, role) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { user: username, userId, role, created: Date.now(), expires: Date.now() + SESSION_MAX_AGE });
  return token;
}

function createPendingTOTP(userId, username) {
  const token = crypto.randomBytes(32).toString("hex");
  pendingTOTP.set(token, { userId, username, created: Date.now() });
  return token;
}

function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((c) => {
    const [key, ...val] = c.trim().split("=");
    if (key) cookies[key] = val.join("=");
  });
  return cookies;
}

// ── Database ─────────────────────────────────────────────────────────────────
let pool = null;
if (DB_URL) {
  pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
}

// VPS production DB — read-only access for ticket syncing
let vpsPool = null;
if (VPS_DB_URL) {
  vpsPool = new Pool({ connectionString: VPS_DB_URL, ssl: { rejectUnauthorized: false } });
}

async function dbQuery(sql, params = []) {
  if (!pool) return [];
  try {
    const res = await pool.query(sql, params);
    return res.rows;
  } catch (e) {
    console.error("[DB]", e.message);
    return [];
  }
}

async function vpsQuery(sql, params = []) {
  if (!vpsPool) return [];
  try {
    const res = await vpsPool.query(sql, params);
    return res.rows;
  } catch (e) {
    console.error("[VPS-DB]", e.message);
    return [];
  }
}

// ── Express App ──────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Authentication ───────────────────────────────────────────────────────────

// Rate limiting for login
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return true;
  if (Date.now() - entry.firstAttempt > LOGIN_WINDOW) {
    loginAttempts.delete(ip);
    return true;
  }
  return entry.count < MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAttempt: Date.now() });
  } else {
    entry.count++;
  }
}

function setSessionCookie(res, req, token) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `monitor_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE / 1000}${secure}`);
}

// Login page
app.get("/login", (req, res) => {
  const msg = req.query.error ? "Invalid credentials" :
              req.query.locked ? "Too many attempts. Try again in 15 minutes." :
              req.query.totp_fail ? "Invalid 2FA code" : "";
  res.send(getLoginHTML(msg));
});

// Login handler
app.post("/login", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  if (!checkRateLimit(ip)) return res.redirect("/login?locked=1");

  const { username, password } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.username === username);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    recordFailedLogin(ip);
    console.log(`[AUTH] Failed login: ${username} from ${ip}`);
    return res.redirect("/login?error=1");
  }

  loginAttempts.delete(ip);

  // If 2FA enabled, redirect to TOTP verification
  if (user.totp_enabled && user.totp_secret) {
    const pendingToken = createPendingTOTP(user.id, user.username);
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `monitor_2fa_pending=${pendingToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=300${secure}`);
    return res.redirect("/verify-2fa");
  }

  // No 2FA — create session directly
  const token = createSession(user.id, user.username, user.role);
  setSessionCookie(res, req, token);
  console.log(`[AUTH] Login: ${username} from ${ip}`);
  res.redirect("/");
});

// 2FA verification page
app.get("/verify-2fa", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const pending = pendingTOTP.get(cookies.monitor_2fa_pending);
  if (!pending) return res.redirect("/login");
  const msg = req.query.error ? "Invalid 2FA code. Try again." : "";
  res.send(get2FAHTML(msg));
});

// 2FA verification handler
app.post("/verify-2fa", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const pendingToken = cookies.monitor_2fa_pending;
  const pending = pendingTOTP.get(pendingToken);
  if (!pending) return res.redirect("/login");

  const { code } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.id === pending.userId);

  if (!user || !verifyTOTP(user.totp_secret, code)) {
    const ip = req.ip || req.socket.remoteAddress;
    recordFailedLogin(ip);
    return res.redirect("/verify-2fa?error=1");
  }

  // 2FA passed — create full session
  pendingTOTP.delete(pendingToken);
  const token = createSession(user.id, user.username, user.role);
  setSessionCookie(res, req, token);
  // Clear pending cookie
  res.appendHeader("Set-Cookie", "monitor_2fa_pending=; Path=/; HttpOnly; Max-Age=0");
  console.log(`[AUTH] 2FA verified: ${user.username}`);
  res.redirect("/");
});

// Logout
app.get("/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.monitor_session) sessions.delete(cookies.monitor_session);
  res.setHeader("Set-Cookie", "monitor_session=; Path=/; HttpOnly; Max-Age=0");
  res.redirect("/login");
});

// Health endpoint — always public
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), db: !!pool, ts: Date.now() });
});

// Auth middleware
function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const session = validateSession(cookies.monitor_session);
  if (session) { req.user = session; return next(); }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const s = validateSession(authHeader.slice(7));
    if (s) { req.user = s; return next(); }
  }

  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Unauthorized" });
  res.redirect("/login");
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin required" });
  }
  next();
}

app.use(requireAuth);
app.use(express.static(path.join(__dirname, "public")));

// ── User Management API (admin only) ────────────────────────────────────────

// List users
app.get("/api/users", requireAdmin, (req, res) => {
  const users = loadUsers().map((u) => ({
    id: u.id, username: u.username, role: u.role,
    totp_enabled: u.totp_enabled, created: u.created,
  }));
  res.json({ users });
});

// Create user
app.post("/api/users", requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const users = loadUsers();
  if (users.find((u) => u.username === username)) {
    return res.status(409).json({ error: "Username already exists" });
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hash,
    salt,
    totp_secret: null,
    totp_enabled: false,
    role: role || "user",
    created: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsers(users);
  console.log(`[AUTH] User created: ${username} by ${req.user.user}`);
  res.json({ success: true, user: { id: newUser.id, username, role: newUser.role } });
});

// Delete user
app.delete("/api/users/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  let users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.id === req.user.userId) return res.status(400).json({ error: "Cannot delete yourself" });

  users = users.filter((u) => u.id !== id);
  saveUsers(users);
  // Kill their sessions
  for (const [token, session] of sessions) {
    if (session.userId === id) sessions.delete(token);
  }
  console.log(`[AUTH] User deleted: ${user.username} by ${req.user.user}`);
  res.json({ success: true });
});

// Change password
app.post("/api/users/:id/password", (req, res) => {
  const { id } = req.params;
  // Users can change their own password, admins can change anyone's
  if (id !== req.user.userId && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { hash, salt } = hashPassword(password);
  user.passwordHash = hash;
  user.salt = salt;
  saveUsers(users);
  console.log(`[AUTH] Password changed for: ${user.username}`);
  res.json({ success: true });
});

// Setup 2FA — generate secret + return QR URI
app.post("/api/users/:id/2fa/setup", (req, res) => {
  const { id } = req.params;
  if (id !== req.user.userId && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const secret = generateTOTPSecret();
  user.totp_secret = secret;
  user.totp_enabled = false; // Not enabled until verified
  saveUsers(users);

  const uri = getTOTPUri(secret, user.username);
  res.json({ secret, uri });
});

// Verify & enable 2FA
app.post("/api/users/:id/2fa/verify", (req, res) => {
  const { id } = req.params;
  if (id !== req.user.userId && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { code } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user || !user.totp_secret) return res.status(400).json({ error: "Run setup first" });

  if (!verifyTOTP(user.totp_secret, code)) {
    return res.status(400).json({ error: "Invalid code. Try again." });
  }

  user.totp_enabled = true;
  saveUsers(users);
  console.log(`[AUTH] 2FA enabled for: ${user.username}`);
  res.json({ success: true, message: "2FA enabled" });
});

// Disable 2FA
app.post("/api/users/:id/2fa/disable", (req, res) => {
  const { id } = req.params;
  if (id !== req.user.userId && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.totp_secret = null;
  user.totp_enabled = false;
  saveUsers(users);
  console.log(`[AUTH] 2FA disabled for: ${user.username}`);
  res.json({ success: true });
});

// Get current user info
app.get("/api/me", (req, res) => {
  const users = loadUsers();
  const user = users.find((u) => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, username: user.username, role: user.role, totp_enabled: user.totp_enabled });
});

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketServer(server, { cors: { origin: false } });

io.use((socket, next) => {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  if (validateSession(cookies.monitor_session)) return next();
  if (socket.handshake.auth?.token && validateSession(socket.handshake.auth.token)) return next();
  next(new Error("Unauthorized"));
});

// Track active Claude processes
let activeClaudeProc = null;
const ptyMap = new Map();

let pty = null;
try {
  pty = require("node-pty");
} catch {
  console.warn("[WARN] node-pty not available — terminal disabled");
}

io.on("connection", (socket) => {
  console.log(`[IO] Client connected: ${socket.id}`);
  sendInitialState(socket);

  socket.on("terminal_input", (data) => {
    const term = ptyMap.get(socket.id);
    if (term) term.write(data);
  });

  socket.on("terminal_resize", ({ cols, rows }) => {
    const term = ptyMap.get(socket.id);
    if (term) { try { term.resize(cols, rows); } catch {} }
  });

  socket.on("terminal_start", () => {
    if (!pty) {
      socket.emit("terminal_output", "\r\n[ERROR] node-pty not available.\r\n");
      return;
    }
    const existing = ptyMap.get(socket.id);
    if (existing) { try { existing.kill(); } catch {} }

    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    const term = pty.spawn(shell, [], {
      name: "xterm-256color", cols: 120, rows: 30,
      cwd: REPO_DIR, env: { ...process.env, TERM: "xterm-256color" },
    });
    term.onData((data) => socket.emit("terminal_output", data));
    term.onExit(() => { ptyMap.delete(socket.id); socket.emit("terminal_output", "\r\n[Session ended]\r\n"); });
    ptyMap.set(socket.id, term);
  });

  socket.on("claude_run", ({ prompt }) => { if (prompt) runClaude(prompt); });

  socket.on("disconnect", () => {
    const term = ptyMap.get(socket.id);
    if (term) { try { term.kill(); } catch {} }
    ptyMap.delete(socket.id);
  });
});

async function sendInitialState(socket) {
  const [sys, tickets, activity, procs] = await Promise.all([
    getSystemInfo(), getTicketSummary(), getRecentActivity(), getProcessList(),
  ]);
  socket.emit("init", { system: sys, tickets, activity, processes: procs });
}

// ── System Info ──────────────────────────────────────────────────────────────
function getSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  return {
    hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
    cpuCount: cpus.length, cpuModel: cpus[0]?.model || "unknown",
    cpuPct: Math.round(100 - (totalIdle / totalTick) * 100),
    totalMemMB: Math.round(totalMem / 1024 / 1024),
    freeMemMB: Math.round(freeMem / 1024 / 1024),
    usedMemMB: Math.round((totalMem - freeMem) / 1024 / 1024),
    usedMemPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
    uptimeHours: Math.round(os.uptime() / 3600),
    uptimeSecs: Math.round(os.uptime()),
    loadAvg: os.loadavg().map((l) => l.toFixed(2)),
    nodeVersion: process.version,
  };
}

// ── Ticket Pipeline ──────────────────────────────────────────────────────────
// Fetches from BOTH local dev DB AND VPS production DB

async function getTicketSummary() {
  // Local dev DB tickets
  const localTickets = await dbQuery(`
    SELECT id, subject, issue_type, issue_description, priority, fix_status,
           fix_branch, fix_notes, source, created_at, updated_at, target_env, status
    FROM support_tickets WHERE target_env = 'dev' OR fix_status IS NOT NULL
    ORDER BY updated_at DESC LIMIT 50`);

  // VPS production DB tickets (direct DB query — no auth needed)
  const vpsTickets = await vpsQuery(`
    SELECT id, subject, issue_type, issue_description, priority, fix_status,
           fix_branch, fix_notes, source, created_at, updated_at, target_env, status
    FROM support_tickets
    ORDER BY created_at DESC LIMIT 50`);

  // Mark VPS tickets with source
  for (const t of vpsTickets) t._source = "vps";

  // Merge: local tickets + VPS tickets (dedupe by id, local takes priority)
  const localIds = new Set(localTickets.map(t => t.id));
  const merged = [...localTickets];
  for (const vt of vpsTickets) {
    if (!localIds.has(vt.id)) merged.push(vt);
  }

  // Sort by fix_status priority, then by date
  const statusOrder = { pending: 1, analyzing: 2, fixing: 3, testing: 4, awaiting_approval: 5, approved: 6, deployed: 7 };
  merged.sort((a, b) => {
    const sa = statusOrder[a.fix_status] || 8;
    const sb = statusOrder[b.fix_status] || 8;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  // Build summary from merged
  const counts = {};
  for (const t of merged) {
    const s = t.fix_status || t.status || "open";
    counts[s] = (counts[s] || 0) + 1;
  }
  const summary = Object.entries(counts).map(([fix_status, count]) => ({ fix_status, count }));

  return { summary, tickets: merged.slice(0, 50) };
}

async function getRecentActivity() {
  return await dbQuery(`SELECT id, activity_type, description, created_at, metadata FROM chester_activity ORDER BY created_at DESC LIMIT 30`);
}

async function getProcessList() {
  try {
    const result = await execCommand("pm2 jlist");
    const procs = JSON.parse(result.stdout || "[]");
    return procs.map((p) => ({
      name: p.name, pm_id: p.pm_id, status: p.pm2_env?.status,
      cpu: p.monit?.cpu, memory: Math.round((p.monit?.memory || 0) / 1024 / 1024),
      uptime: p.pm2_env?.pm_uptime, restarts: p.pm2_env?.restart_time, pid: p.pid,
    }));
  } catch { return []; }
}

// ── Server Health ────────────────────────────────────────────────────────────
async function getServerHealth() {
  const servers = [{ name: "AWS Dev Server", host: "localhost", provider: "aws", status: "healthy", latency: 0, system: getSystemInfo() }];

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${VPS_HOST}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    servers.push({ name: "VPS Production", host: VPS_HOST, provider: "vps", status: res.ok ? "healthy" : "unhealthy", latency: Date.now() - start, commit: data.commit, db: data.db });
  } catch (e) {
    servers.push({ name: "VPS Production", host: VPS_HOST, provider: "vps", status: "unreachable", latency: -1, error: e.message });
  }

  const endpoints = await dbQuery(`SELECT id, name, host, provider, metadata FROM cloud_endpoints WHERE status = 'active' AND provider NOT IN ('vps', 'aws')`);
  for (const ep of endpoints) {
    try {
      const url = ep.host.startsWith("http") ? ep.host : `https://${ep.host}`;
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${url}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      servers.push({ name: ep.name, host: ep.host, provider: ep.provider, status: res.ok ? "healthy" : "unhealthy", latency: Date.now() - start });
    } catch (e) {
      servers.push({ name: ep.name, host: ep.host, provider: ep.provider, status: "unreachable", latency: -1, error: e.message });
    }
  }
  return servers;
}

// ── Claude CLI ───────────────────────────────────────────────────────────────
function runClaude(prompt) {
  if (activeClaudeProc) { io.emit("claude_output", "\r\n[ERROR] Claude already running.\r\n"); return; }
  io.emit("claude_output", `\r\n[STARTING] claude --print "${prompt.substring(0, 80)}..."\r\n\r\n`);
  const child = spawn("claude", ["--print", prompt], { cwd: REPO_DIR, env: { ...process.env }, shell: true });
  activeClaudeProc = child;
  let output = "";
  child.stdout.on("data", (d) => { const t = d.toString(); output += t; io.emit("claude_output", t); });
  child.stderr.on("data", (d) => { const t = d.toString(); output += t; io.emit("claude_output", t); });
  child.on("close", (code) => {
    activeClaudeProc = null;
    io.emit("claude_done", { code, output, prompt });
    dbQuery(`INSERT INTO chester_activity (activity_type, description, metadata) VALUES ($1, $2, $3)`,
      ["claude_cli", `Claude CLI: ${prompt.substring(0, 100)}`, JSON.stringify({ code, prompt, output_length: output.length })]).catch(() => {});
  });
  child.on("error", (err) => { activeClaudeProc = null; io.emit("claude_output", `\r\n[ERROR] ${err.message}\r\n`); io.emit("claude_done", { code: 1, output: err.message, prompt }); });
}

// ── API Routes ───────────────────────────────────────────────────────────────

app.get("/api/system", (req, res) => res.json(getSystemInfo()));
app.get("/api/tickets", async (req, res) => res.json(await getTicketSummary()));
app.get("/api/activity", async (req, res) => res.json({ activity: await getRecentActivity() }));
app.get("/api/processes", async (req, res) => res.json({ processes: await getProcessList() }));

app.get("/api/git", async (req, res) => {
  try {
    const [branch, log, status, remotes] = await Promise.all([
      execCommand("git branch --show-current", { cwd: REPO_DIR }),
      execCommand("git log --oneline -20", { cwd: REPO_DIR }),
      execCommand("git status --short", { cwd: REPO_DIR }),
      execCommand("git remote -v", { cwd: REPO_DIR }),
    ]);
    res.json({ branch: branch.stdout.trim(), commits: log.stdout.trim().split("\n").filter(Boolean), status: status.stdout.trim(), remotes: remotes.stdout.trim() });
  } catch (e) { res.json({ error: e.message }); }
});

app.get("/api/servers", async (req, res) => res.json({ servers: await getServerHealth() }));

app.get("/api/logs/:service", async (req, res) => {
  const { service } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(service)) return res.status(400).json({ error: "Invalid service name" });
  const safeLines = Math.min(Math.max(parseInt(req.query.lines, 10) || 100, 1), 500);
  try {
    const result = await execCommand(`pm2 logs ${service} --nostream --lines ${safeLines} 2>&1 || echo 'no logs'`, { timeout: 10000 });
    res.json({ lines: result.stdout.split("\n") });
  } catch { res.json({ lines: ["No logs available for " + service] }); }
});

app.post("/api/exec", async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "command required" });
  const allowed = ["pm2", "git", "docker", "node", "npm", "curl", "ls", "cat", "head", "tail", "grep", "df", "free", "uptime", "whoami", "pwd", "claude", "top", "ps", "which", "echo", "date"];
  const cmd = command.trim().split(/\s+/)[0];
  if (!allowed.includes(cmd)) return res.status(403).json({ error: `Command '${cmd}' not allowed` });
  try {
    const result = await execCommand(command, { cwd: REPO_DIR, timeout: 30000 });
    res.json({ stdout: result.stdout, stderr: result.stderr, code: result.code });
  } catch (e) { res.json({ stdout: "", stderr: e.message, code: 1 }); }
});

app.post("/api/claude/start", (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });
  if (activeClaudeProc) return res.status(409).json({ error: "Claude already running" });
  runClaude(prompt);
  res.json({ started: true });
});

app.post("/api/claude/stop", (req, res) => {
  if (activeClaudeProc) { activeClaudeProc.kill("SIGTERM"); activeClaudeProc = null; io.emit("claude_output", "\r\n[STOPPED]\r\n"); res.json({ stopped: true }); }
  else res.json({ stopped: false });
});

app.post("/api/tickets/:id/approve", async (req, res) => {
  const { id } = req.params;
  try {
    await dbQuery(`UPDATE support_tickets SET fix_status = 'approved', approved_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    const rows = await dbQuery(`SELECT fix_branch FROM support_tickets WHERE id = $1`, [id]);
    if (rows[0]?.fix_branch) {
      await execCommand(`git -C ${REPO_DIR} push origin ${rows[0].fix_branch}`, { timeout: 30000 });
      io.emit("claude_output", `\r\n[DEPLOY] Pushed ${rows[0].fix_branch}\r\n`);
    }
    await dbQuery(`INSERT INTO chester_activity (activity_type, description, metadata) VALUES ('ticket_approved', $1, $2)`, [`Ticket ${id.substring(0, 8)} approved`, JSON.stringify({ ticket_id: id })]);
    io.emit("tickets", await getTicketSummary());
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tickets/:id/reject", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await dbQuery(`UPDATE support_tickets SET fix_status = 'fixing', fix_notes = COALESCE(fix_notes, '') || E'\n[REJECTED] ' || $2, updated_at = NOW() WHERE id = $1`, [id, reason || "Rejected"]);
    await dbQuery(`INSERT INTO chester_activity (activity_type, description, metadata) VALUES ('ticket_rejected', $1, $2)`, [`Ticket ${id.substring(0, 8)} rejected`, JSON.stringify({ ticket_id: id, reason })]);
    io.emit("tickets", await getTicketSummary());
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/git/pull", async (req, res) => {
  try { const r = await execCommand("git pull origin main", { cwd: REPO_DIR, timeout: 30000 }); res.json({ stdout: r.stdout, stderr: r.stderr }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/git/push", async (req, res) => {
  try {
    const b = await execCommand("git branch --show-current", { cwd: REPO_DIR });
    const r = await execCommand(`git push origin ${b.stdout.trim()}`, { cwd: REPO_DIR, timeout: 30000 });
    res.json({ stdout: r.stdout, stderr: r.stderr, branch: b.stdout.trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/pm2/:action/:name", async (req, res) => {
  const { action, name } = req.params;
  if (!["restart", "stop", "delete"].includes(action)) return res.status(400).json({ error: "Invalid action" });
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return res.status(400).json({ error: "Invalid process name" });
  try { const r = await execCommand(`pm2 ${action} ${name}`, { timeout: 15000 }); res.json({ stdout: r.stdout, stderr: r.stderr }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function execCommand(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const shell = os.platform() === "win32" ? "cmd" : "bash";
    const shellFlag = os.platform() === "win32" ? "/c" : "-c";
    const child = spawn(shell, [shellFlag, cmd], { cwd: opts.cwd || REPO_DIR, timeout: opts.timeout || 15000, env: { ...process.env } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    child.on("error", reject);
  });
}

// ── Real-time broadcasts ────────────────────────────────────────────────────
setInterval(() => { if (io.engine.clientsCount === 0) return; io.emit("metrics", { system: getSystemInfo(), ts: Date.now() }); }, 3000);
setInterval(async () => {
  if (io.engine.clientsCount === 0) return;
  const [tickets, activity, processes] = await Promise.all([getTicketSummary(), getRecentActivity(), getProcessList()]);
  io.emit("tickets", tickets); io.emit("activity", { activity }); io.emit("process_list", { processes });
}, 10000);
setInterval(async () => { if (io.engine.clientsCount === 0) return; io.emit("server_health", { servers: await getServerHealth() }); }, 30000);

// ── Login Page HTML ──────────────────────────────────────────────────────────
function getLoginHTML(errorMsg = "") {
  const error = errorMsg ? `<div class="error">${errorMsg}</div>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Chester Dev Monitor — Login</title><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'SF Mono','Cascadia Code',monospace;background:#0f1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:#1a1d27;border:1px solid #2a2d37;border-radius:12px;padding:40px;width:380px;max-width:90vw}
h1{font-size:18px;color:#22d3ee;text-align:center;margin-bottom:4px;letter-spacing:1px}
.subtitle{text-align:center;color:#64748b;font-size:12px;margin-bottom:28px}
label{display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
input{width:100%;padding:10px 12px;background:#0f1117;border:1px solid #2a2d37;border-radius:6px;color:#e2e8f0;font-family:inherit;font-size:14px;margin-bottom:16px}
input:focus{outline:none;border-color:#22d3ee}
button{width:100%;padding:10px;background:#22d3ee;color:#000;border:none;border-radius:6px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer}
button:hover{background:#06b6d4}
.error{background:rgba(239,68,68,.15);color:#ef4444;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:16px;text-align:center}
.lock-icon{text-align:center;margin-bottom:16px;font-size:32px;opacity:.3}
</style></head><body><div class="login-box">
<div class="lock-icon">&#128274;</div><h1>CHESTER DEV</h1><div class="subtitle">Monitor Control Panel</div>${error}
<form method="POST" action="/login">
<label for="username">Username</label><input type="text" id="username" name="username" required autocomplete="username" autofocus>
<label for="password">Password</label><input type="password" id="password" name="password" required autocomplete="current-password">
<button type="submit">Sign In</button></form></div></body></html>`;
}

function get2FAHTML(errorMsg = "") {
  const error = errorMsg ? `<div class="error">${errorMsg}</div>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Chester Dev Monitor — 2FA</title><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'SF Mono','Cascadia Code',monospace;background:#0f1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:#1a1d27;border:1px solid #2a2d37;border-radius:12px;padding:40px;width:380px;max-width:90vw}
h1{font-size:18px;color:#22d3ee;text-align:center;margin-bottom:4px;letter-spacing:1px}
.subtitle{text-align:center;color:#64748b;font-size:12px;margin-bottom:28px}
label{display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
input{width:100%;padding:10px 12px;background:#0f1117;border:1px solid #2a2d37;border-radius:6px;color:#e2e8f0;font-family:inherit;font-size:24px;margin-bottom:16px;text-align:center;letter-spacing:8px}
input:focus{outline:none;border-color:#22d3ee}
button{width:100%;padding:10px;background:#22d3ee;color:#000;border:none;border-radius:6px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer}
button:hover{background:#06b6d4}
.error{background:rgba(239,68,68,.15);color:#ef4444;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:16px;text-align:center}
.lock-icon{text-align:center;margin-bottom:16px;font-size:32px;opacity:.3}
a{color:#22d3ee;font-size:12px;text-align:center;display:block;margin-top:16px}
</style></head><body><div class="login-box">
<div class="lock-icon">&#128272;</div><h1>2FA VERIFICATION</h1><div class="subtitle">Enter the 6-digit code from your authenticator app</div>${error}
<form method="POST" action="/verify-2fa">
<label for="code">Authentication Code</label><input type="text" id="code" name="code" required maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" autofocus>
<button type="submit">Verify</button></form>
<a href="/login">Back to login</a></div></body></html>`;
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) { if (now > s.expires) sessions.delete(t); }
  for (const [t, p] of pendingTOTP) { if (now - p.created > 300000) pendingTOTP.delete(t); }
}, 5 * 60 * 1000);

// ── Start ────────────────────────────────────────────────────────────────────
const users = ensureDefaultAdmin();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Chester Dev Monitor running on http://0.0.0.0:${PORT}`);
  console.log(`  Dev DB: ${DB_URL ? "connected" : "NOT connected (set DATABASE_URL)"}`);
  console.log(`  VPS DB: ${VPS_DB_URL ? "connected" : "NOT connected (set VPS_DATABASE_URL)"}`);
  console.log(`  Users: ${users.length} (stored in ${USERS_FILE})`);
  console.log(`  Repo: ${REPO_DIR}`);
  console.log(`  VPS: ${VPS_HOST}`);
  console.log(`  PTY: ${pty ? "available" : "disabled"}\n`);
});
