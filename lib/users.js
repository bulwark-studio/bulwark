const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "..", "users.json");

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

function ensureDefaultAdmin() {
  let users = loadUsers();
  if (users.length === 0) {
    const defaultUser = process.env.MONITOR_USER;
    const defaultPass = process.env.MONITOR_PASS;
    if (!defaultUser || !defaultPass) {
      console.error("[AUTH] MONITOR_USER and MONITOR_PASS must be set before first run.");
      process.exit(1);
    }
    const { hash, salt } = hashPassword(defaultPass);
    users.push({
      id: crypto.randomUUID(),
      username: defaultUser,
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

module.exports = { loadUsers, saveUsers, hashPassword, verifyPassword, ensureDefaultAdmin, USERS_FILE };
