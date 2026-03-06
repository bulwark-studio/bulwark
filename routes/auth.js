const crypto = require("crypto");
const { loadUsers, saveUsers, hashPassword, verifyPassword } = require("../lib/users");
const { generateTOTPSecret, verifyTOTP, getTOTPUri } = require("../lib/totp");
const { sessions, pendingTOTP, SESSION_MAX_AGE, createSession, createPendingTOTP, validateSession, parseCookies, setSessionCookie } = require("../lib/sessions");

// Rate limiting
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return true;
  if (Date.now() - entry.firstAttempt > LOGIN_WINDOW) { loginAttempts.delete(ip); return true; }
  return entry.count < MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) loginAttempts.set(ip, { count: 1, firstAttempt: Date.now() });
  else entry.count++;
}

function getLoginHTML(errorMsg = "") {
  const error = errorMsg ? `<div class="error">${errorMsg}</div>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Bulwark — Login</title><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'JetBrains Mono','SF Mono','Cascadia Code',monospace;background:#0a0b10;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:rgba(14,14,18,0.82);border:1px solid rgba(255,255,255,0.08);border-top:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:40px;width:400px;max-width:90vw;box-shadow:0 0 0 1px rgba(255,255,255,0.05),0 8px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.06);backdrop-filter:blur(20px)}
h1{font-size:18px;color:#22d3ee;text-align:center;margin-bottom:4px;letter-spacing:2px}
.subtitle{text-align:center;color:#64748b;font-size:11px;margin-bottom:28px;letter-spacing:0.5px}
.ver{text-align:center;color:#334155;font-size:10px;margin-top:20px}
label{display:block;font-size:10px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600}
input{width:100%;padding:10px 12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#e2e8f0;font-family:inherit;font-size:13px;margin-bottom:16px;transition:border-color 0.15s}
input:focus{outline:none;border-color:rgba(34,211,238,0.4);box-shadow:0 0 0 3px rgba(34,211,238,0.08)}
button{width:100%;padding:10px;background:#22d3ee;color:#000;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.5px;transition:background 0.15s}
button:hover{background:#06b6d4}
.error{background:rgba(255,107,43,0.12);color:#ff6b2b;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:16px;text-align:center;border:1px solid rgba(255,107,43,0.2)}
.lock-icon{text-align:center;margin-bottom:16px;font-size:28px;opacity:.25}
</style></head><body><div class="login-box">
<div class="lock-icon">&#128274;</div><h1>BULWARK</h1><div class="subtitle">Monitor Control Panel</div>${error}
<form method="POST" action="/login">
<label for="username">Username</label><input type="text" id="username" name="username" required autocomplete="username" autofocus>
<label for="password">Password</label><input type="password" id="password" name="password" required autocomplete="current-password">
<button type="submit">Sign In</button></form><div class="ver">v2.1</div></div></body></html>`;
}

function get2FAHTML(errorMsg = "") {
  const error = errorMsg ? `<div class="error">${errorMsg}</div>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Bulwark — 2FA</title><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'JetBrains Mono','SF Mono','Cascadia Code',monospace;background:#0a0b10;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:rgba(14,14,18,0.82);border:1px solid rgba(255,255,255,0.08);border-top:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:40px;width:400px;max-width:90vw;box-shadow:0 0 0 1px rgba(255,255,255,0.05),0 8px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.06);backdrop-filter:blur(20px)}
h1{font-size:18px;color:#22d3ee;text-align:center;margin-bottom:4px;letter-spacing:2px}
.subtitle{text-align:center;color:#64748b;font-size:11px;margin-bottom:28px}
label{display:block;font-size:10px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600}
input{width:100%;padding:10px 12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#e2e8f0;font-family:inherit;font-size:24px;margin-bottom:16px;text-align:center;letter-spacing:8px}
input:focus{outline:none;border-color:rgba(34,211,238,0.4);box-shadow:0 0 0 3px rgba(34,211,238,0.08)}
button{width:100%;padding:10px;background:#22d3ee;color:#000;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}
button:hover{background:#06b6d4}
.error{background:rgba(255,107,43,0.12);color:#ff6b2b;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:16px;text-align:center;border:1px solid rgba(255,107,43,0.2)}
.lock-icon{text-align:center;margin-bottom:16px;font-size:28px;opacity:.25}
a{color:#22d3ee;font-size:12px;text-align:center;display:block;margin-top:16px}
</style></head><body><div class="login-box">
<div class="lock-icon">&#128272;</div><h1>2FA VERIFICATION</h1><div class="subtitle">Enter the 6-digit code from your authenticator app</div>${error}
<form method="POST" action="/verify-2fa">
<label for="code">Authentication Code</label><input type="text" id="code" name="code" required maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" autofocus>
<button type="submit">Verify</button></form>
<a href="/login">Back to login</a></div></body></html>`;
}

module.exports = function (app, ctx) {
  app.get("/login", (req, res) => {
    const msg = req.query.error ? "Invalid credentials" :
                req.query.locked ? "Too many attempts. Try again in 15 minutes." :
                req.query.totp_fail ? "Invalid 2FA code" : "";
    res.send(getLoginHTML(msg));
  });

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
    if (user.totp_enabled && user.totp_secret) {
      const pendingToken = createPendingTOTP(user.id, user.username);
      const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
      res.setHeader("Set-Cookie", `monitor_2fa_pending=${pendingToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=300${secure}`);
      return res.redirect("/verify-2fa");
    }
    const token = createSession(user.id, user.username, user.role);
    setSessionCookie(res, req, token);
    console.log(`[AUTH] Login: ${username} from ${ip}`);
    res.redirect("/");
  });

  app.get("/verify-2fa", (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const pending = pendingTOTP.get(cookies.monitor_2fa_pending);
    if (!pending) return res.redirect("/login");
    const msg = req.query.error ? "Invalid 2FA code. Try again." : "";
    res.send(get2FAHTML(msg));
  });

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
    pendingTOTP.delete(pendingToken);
    const token = createSession(user.id, user.username, user.role);
    setSessionCookie(res, req, token);
    res.appendHeader("Set-Cookie", "monitor_2fa_pending=; Path=/; HttpOnly; Max-Age=0");
    console.log(`[AUTH] 2FA verified: ${user.username}`);
    res.redirect("/");
  });

  app.get("/logout", (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.monitor_session) sessions.delete(cookies.monitor_session);
    res.setHeader("Set-Cookie", "monitor_session=; Path=/; HttpOnly; Max-Age=0");
    res.redirect("/login");
  });

  app.get("/api/health", async (req, res) => {
    const health = {
      status: "ok",
      name: process.env.APP_NAME || "Bulwark",
      version: "2.1.0",
      uptime: process.uptime(),
      db: !!ctx.pool,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      ts: Date.now(),
    };
    // Check DB latency
    if (ctx.pool) {
      try {
        const start = Date.now();
        await ctx.pool.query("SELECT 1");
        health.dbLatencyMs = Date.now() - start;
      } catch {
        health.db = false;
        health.dbLatencyMs = -1;
      }
    }
    health.status = health.db !== false ? "ok" : "degraded";
    res.json(health);
  });

  // User management routes (need requireAuth since auth module loads before global middleware)
  app.get("/api/users", ctx.requireAuth, ctx.requireAdmin, (req, res) => {
    const users = loadUsers().map((u) => ({ id: u.id, username: u.username, role: u.role, totp_enabled: u.totp_enabled, created: u.created }));
    res.json({ users });
  });

  app.post("/api/users", ctx.requireAuth, ctx.requireAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "username and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const users = loadUsers();
    if (users.find((u) => u.username === username)) return res.status(409).json({ error: "Username already exists" });
    const { hash, salt } = hashPassword(password);
    const newUser = { id: crypto.randomUUID(), username, passwordHash: hash, salt, totp_secret: null, totp_enabled: false, role: role || "user", created: new Date().toISOString() };
    users.push(newUser);
    saveUsers(users);
    console.log(`[AUTH] User created: ${username} by ${req.user.user}`);
    res.json({ success: true, user: { id: newUser.id, username, role: newUser.role } });
  });

  app.delete("/api/users/:id", ctx.requireAuth, ctx.requireAdmin, (req, res) => {
    const { id } = req.params;
    let users = loadUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.id === req.user.userId) return res.status(400).json({ error: "Cannot delete yourself" });
    users = users.filter((u) => u.id !== id);
    saveUsers(users);
    for (const [token, session] of sessions) { if (session.userId === id) sessions.delete(token); }
    console.log(`[AUTH] User deleted: ${user.username} by ${req.user.user}`);
    res.json({ success: true });
  });

  app.patch("/api/users/:id/role", ctx.requireAuth, ctx.requireAdmin, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!role || !["admin", "editor", "viewer"].includes(role)) return res.status(400).json({ error: "Invalid role. Must be admin, editor, or viewer." });
    if (id === req.user.userId) return res.status(400).json({ error: "Cannot change your own role" });
    const users = loadUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.role = role;
    saveUsers(users);
    // Update active sessions for this user
    for (const [, session] of sessions) { if (session.userId === id) session.role = role; }
    console.log(`[AUTH] Role changed: ${user.username} → ${role} by ${req.user.user}`);
    res.json({ success: true, role });
  });

  app.post("/api/users/:id/password", ctx.requireAuth, (req, res) => {
    const { id } = req.params;
    if (id !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
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

  app.post("/api/users/:id/2fa/setup", ctx.requireAuth, (req, res) => {
    const { id } = req.params;
    if (id !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const users = loadUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const secret = generateTOTPSecret();
    user.totp_secret = secret;
    user.totp_enabled = false;
    saveUsers(users);
    const uri = getTOTPUri(secret, user.username);
    res.json({ secret, uri });
  });

  app.post("/api/users/:id/2fa/verify", ctx.requireAuth, (req, res) => {
    const { id } = req.params;
    if (id !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { code } = req.body;
    const users = loadUsers();
    const user = users.find((u) => u.id === id);
    if (!user || !user.totp_secret) return res.status(400).json({ error: "Run setup first" });
    if (!verifyTOTP(user.totp_secret, code)) return res.status(400).json({ error: "Invalid code. Try again." });
    user.totp_enabled = true;
    saveUsers(users);
    console.log(`[AUTH] 2FA enabled for: ${user.username}`);
    res.json({ success: true, message: "2FA enabled" });
  });

  app.post("/api/users/:id/2fa/disable", ctx.requireAuth, (req, res) => {
    const { id } = req.params;
    if (id !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const users = loadUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.totp_secret = null;
    user.totp_enabled = false;
    saveUsers(users);
    console.log(`[AUTH] 2FA disabled for: ${user.username}`);
    res.json({ success: true });
  });

  app.get("/api/me", ctx.requireAuth, (req, res) => {
    const users = loadUsers();
    const user = users.find((u) => u.id === req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, username: user.username, role: user.role, totp_enabled: user.totp_enabled });
  });
};
