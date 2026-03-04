const crypto = require("crypto");

const sessions = new Map();
const pendingTOTP = new Map();
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

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
  if (Date.now() > session.expires) { sessions.delete(token); return null; }
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

function setSessionCookie(res, req, token) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `monitor_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE / 1000}${secure}`);
}

function isSocketAdmin(socket) {
  return socket?.data?.session?.role === "admin";
}

// Cleanup expired sessions and pending TOTP tokens
function cleanupSessions() {
  const now = Date.now();
  for (const [t, s] of sessions) { if (now > s.expires) sessions.delete(t); }
  for (const [t, p] of pendingTOTP) { if (now - p.created > 300000) pendingTOTP.delete(t); }
}

module.exports = {
  sessions, pendingTOTP, SESSION_MAX_AGE,
  createSession, createPendingTOTP, validateSession,
  parseCookies, setSessionCookie, isSocketAdmin, cleanupSessions,
};
