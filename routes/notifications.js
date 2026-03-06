const crypto = require("crypto");
const { loadConfig, saveConfig, sendNotification } = require("../lib/notification-sender");

module.exports = function (app, ctx) {
  ctx.sendNotification = sendNotification;

  app.get("/api/notifications/channels", ctx.requireAdmin, (req, res) => {
    const cfg = loadConfig();
    res.json({ channels: (cfg.channels || []).map(c => ({ ...c, webhookUrl: c.webhookUrl ? "••••" + c.webhookUrl.slice(-8) : undefined, botToken: c.botToken ? "••••" + c.botToken.slice(-8) : undefined })) });
  });

  app.post("/api/notifications/channels", ctx.requireAdmin, (req, res) => {
    const { type, name, webhookUrl, botToken, chatId, events } = req.body;
    if (!type || !name) return res.status(400).json({ error: "type and name required" });
    const cfg = loadConfig();
    if (!cfg.channels) cfg.channels = [];
    cfg.channels.push({ id: crypto.randomUUID(), type, name, webhookUrl, botToken, chatId, events: events || [], enabled: true, created: new Date().toISOString() });
    saveConfig(cfg);
    res.json({ success: true });
  });

  app.put("/api/notifications/channels/:id", ctx.requireAdmin, (req, res) => {
    const cfg = loadConfig();
    const ch = (cfg.channels || []).find(c => c.id === req.params.id);
    if (!ch) return res.status(404).json({ error: "Channel not found" });
    Object.assign(ch, req.body, { id: ch.id });
    saveConfig(cfg);
    res.json({ success: true });
  });

  app.delete("/api/notifications/channels/:id", ctx.requireAdmin, (req, res) => {
    const cfg = loadConfig();
    cfg.channels = (cfg.channels || []).filter(c => c.id !== req.params.id);
    saveConfig(cfg);
    res.json({ success: true });
  });

  app.post("/api/notifications/test/:id", ctx.requireAdmin, async (req, res) => {
    const cfg = loadConfig();
    const ch = (cfg.channels || []).find(c => c.id === req.params.id);
    if (!ch) return res.status(404).json({ error: "Channel not found" });
    try {
      const { sendDiscord, sendSlack, sendTelegram } = require("../lib/notification-sender");
      const payload = { title: "Test Notification", message: "This is a test from Bulwark.", severity: "info" };
      if (ch.type === "discord") await sendDiscord(ch.webhookUrl, payload);
      else if (ch.type === "slack") await sendSlack(ch.webhookUrl, payload);
      else if (ch.type === "telegram") await sendTelegram(ch.botToken, ch.chatId, payload);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};
