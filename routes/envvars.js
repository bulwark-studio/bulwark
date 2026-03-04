const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "envvars.json");

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.MONITOR_PASS || "dev-monitor-default-key";
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + tag + ":" + enc;
}

function decrypt(data) {
  const [ivHex, tagHex, enc] = data.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let dec = decipher.update(enc, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

function loadStore() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch {}
  return { apps: {} };
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

module.exports = function (app, ctx) {
  app.get("/api/envvars", ctx.requireAdmin, (req, res) => {
    const store = loadStore();
    const apps = Object.keys(store.apps).map(name => ({
      name, count: Object.keys(store.apps[name].vars || {}).length,
    }));
    res.json({ apps });
  });

  app.get("/api/envvars/:app", ctx.requireAdmin, (req, res) => {
    const store = loadStore();
    const appData = store.apps[req.params.app];
    if (!appData) return res.json({ vars: [] });
    const vars = Object.entries(appData.vars || {}).map(([key, entry]) => ({
      key, value: req.query.reveal === "true" ? decrypt(entry.value) : "••••••••",
      updated: entry.updated, description: entry.description,
    }));
    res.json({ vars });
  });

  app.post("/api/envvars/:app", ctx.requireAdmin, (req, res) => {
    const { key, value, description } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: "key and value required" });
    const store = loadStore();
    if (!store.apps[req.params.app]) store.apps[req.params.app] = { vars: {}, history: [] };
    store.apps[req.params.app].vars[key] = { value: encrypt(value), description: description || "", updated: new Date().toISOString() };
    store.apps[req.params.app].history.push({ action: "set", key, by: req.user.user, ts: new Date().toISOString() });
    if (store.apps[req.params.app].history.length > 50) store.apps[req.params.app].history = store.apps[req.params.app].history.slice(-50);
    saveStore(store);
    res.json({ success: true });
  });

  app.delete("/api/envvars/:app/:key", ctx.requireAdmin, (req, res) => {
    const store = loadStore();
    const appData = store.apps[req.params.app];
    if (!appData || !appData.vars[req.params.key]) return res.status(404).json({ error: "Not found" });
    delete appData.vars[req.params.key];
    appData.history.push({ action: "delete", key: req.params.key, by: req.user.user, ts: new Date().toISOString() });
    saveStore(store);
    res.json({ success: true });
  });

  app.post("/api/envvars/:app/bulk", ctx.requireAdmin, (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });
    const store = loadStore();
    if (!store.apps[req.params.app]) store.apps[req.params.app] = { vars: {}, history: [] };
    let count = 0;
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.substring(0, eq).trim();
      const value = trimmed.substring(eq + 1).trim().replace(/^["']|["']$/g, "");
      store.apps[req.params.app].vars[key] = { value: encrypt(value), updated: new Date().toISOString() };
      count++;
    }
    store.apps[req.params.app].history.push({ action: "bulk_import", count, by: req.user.user, ts: new Date().toISOString() });
    saveStore(store);
    res.json({ success: true, imported: count });
  });

  app.get("/api/envvars/:app/history", ctx.requireAdmin, (req, res) => {
    const store = loadStore();
    const appData = store.apps[req.params.app];
    res.json({ history: appData?.history || [] });
  });
};
