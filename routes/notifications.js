const crypto = require("crypto");
const { loadConfig, saveConfig, sendNotification, sendEmail, sendEmailChannel, sendDiscord, sendSlack, sendTelegram } = require("../lib/notification-sender");
const { askAI } = require("../lib/ai");

module.exports = function (app, ctx) {
  ctx.sendNotification = sendNotification;

  app.get("/api/notifications/channels", ctx.requireAdmin, (req, res) => {
    const cfg = loadConfig();
    res.json({ channels: (cfg.channels || []).map(c => ({
      ...c,
      webhookUrl: c.webhookUrl ? "••••" + c.webhookUrl.slice(-8) : undefined,
      botToken: c.botToken ? "••••" + c.botToken.slice(-8) : undefined
    })) });
  });

  app.post("/api/notifications/channels", ctx.requireAdmin, (req, res) => {
    const { type, name, webhookUrl, botToken, chatId, email, cc, events } = req.body;
    if (!type || !name) return res.status(400).json({ error: "type and name required" });
    if (type === "email" && !email) return res.status(400).json({ error: "email address required" });
    const cfg = loadConfig();
    if (!cfg.channels) cfg.channels = [];
    cfg.channels.push({
      id: crypto.randomUUID(), type, name,
      webhookUrl: webhookUrl || undefined,
      botToken: botToken || undefined,
      chatId: chatId || undefined,
      email: email || undefined,
      cc: cc || undefined,
      events: events || [],
      enabled: true,
      created: new Date().toISOString()
    });
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

  // Test any channel (Discord, Slack, Telegram, Email)
  app.post("/api/notifications/test/:id", ctx.requireAdmin, async (req, res) => {
    const cfg = loadConfig();
    const ch = (cfg.channels || []).find(c => c.id === req.params.id);
    if (!ch) return res.status(404).json({ error: "Channel not found" });
    try {
      const payload = { title: "Test Notification", message: "This is a test alert from Bulwark. If you see this, your notification channel is working correctly.", severity: "info" };
      if (ch.type === "discord") await sendDiscord(ch.webhookUrl, payload);
      else if (ch.type === "slack") await sendSlack(ch.webhookUrl, payload);
      else if (ch.type === "telegram") await sendTelegram(ch.botToken, ch.chatId, payload);
      else if (ch.type === "email") await sendEmailChannel(ch, payload);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Test SMTP connection directly (for Settings > SMTP config)
  app.post("/api/notifications/test-smtp", ctx.requireAdmin, async (req, res) => {
    const { host, port, user, pass, from, to } = req.body;
    if (!host || !user || !pass || !to) return res.status(400).json({ error: "host, user, pass, and to address required" });
    try {
      await sendEmail(
        { host, port: parseInt(port) || 587, user, pass, from: from || user },
        { to, subject: "Bulwark SMTP Test", body: "<h3 style='color:#22d3ee;margin:0 0 8px'>SMTP Configuration Test</h3><p>Your SMTP settings are working correctly. You can now receive email alerts from Bulwark.</p><p style='color:#52525a;margin-top:12px'>Server: " + host + ":" + (port || 587) + "</p>" }
      );
      res.json({ success: true, message: "Test email sent to " + to });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // AI: Compose a professional alert email from notification data
  app.post("/api/notifications/ai-compose", ctx.requireAdmin, async (req, res) => {
    try {
      const { category, title, message, severity } = req.body;
      const prompt = `You are a professional DevOps email composer. Write a brief, clear alert email body (plain text, no markdown) for a server monitoring notification.

Category: ${category || "system"}
Severity: ${severity || "info"}
Title: ${title || "Alert"}
Details: ${message || "No details"}

Write 3-5 sentences that:
1. State what happened clearly
2. Explain the impact
3. Suggest next steps
4. Keep it professional but human-readable

Just output the email body text, nothing else.`;

      const result = await askAI(prompt, { timeout: 15000 });
      res.json({ body: result.trim() || "Alert: " + (title || "System notification") });
    } catch (e) { res.json({ body: "Alert: " + (req.body.title || "System notification") + "\n\n" + (req.body.message || "") }); }
  });

  // Send ad-hoc email (for "Email This" button on individual notifications)
  app.post("/api/notifications/send-email", ctx.requireAdmin, async (req, res) => {
    const { to, cc, subject, body } = req.body;
    if (!to) return res.status(400).json({ error: "Recipient email required" });

    const fs = require("fs");
    const path = require("path");
    const settingsFile = path.join(__dirname, "..", "data", "settings.json");
    let smtp;
    try {
      const settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      smtp = settings.smtp;
    } catch {}
    if (!smtp || !smtp.host) return res.status(400).json({ error: "SMTP not configured. Go to Settings > Email (SMTP)." });

    try {
      await sendEmail(smtp, { to, cc: cc || "", subject: subject || "Bulwark Alert", body: body || "" });
      res.json({ success: true, message: "Email sent to " + to });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};
