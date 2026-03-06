const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "..", "data", "notifications.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {}
  return { channels: [], eventMap: {} };
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
  } catch (e) { console.error("[NOTIFY] save:", e.message); }
}

async function sendDiscord(webhookUrl, payload) {
  const embed = {
    title: payload.title,
    description: payload.message,
    color: payload.severity === "critical" ? 0xff6b2b : payload.severity === "warning" ? 0xeab308 : 0x22d3ee,
    timestamp: new Date().toISOString(),
    footer: { text: `Bulwark` },
  };
  if (payload.fields) embed.fields = payload.fields.map(f => ({ name: f.name, value: f.value, inline: true }));
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
}

async function sendSlack(webhookUrl, payload) {
  const color = payload.severity === "critical" ? "#ff6b2b" : payload.severity === "warning" ? "#eab308" : "#22d3ee";
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attachments: [{ color, title: payload.title, text: payload.message, footer: "Bulwark", ts: Math.floor(Date.now() / 1000) }],
    }),
  });
}

async function sendTelegram(botToken, chatId, payload) {
  const text = `<b>${payload.title}</b>\n${payload.message}`;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function sendNotification(eventType, payload) {
  const cfg = loadConfig();
  for (const channel of cfg.channels) {
    if (!channel.enabled) continue;
    if (channel.events && !channel.events.includes(eventType)) continue;
    try {
      if (channel.type === "discord") await sendDiscord(channel.webhookUrl, payload);
      else if (channel.type === "slack") await sendSlack(channel.webhookUrl, payload);
      else if (channel.type === "telegram") await sendTelegram(channel.botToken, channel.chatId, payload);
    } catch (e) { console.error(`[NOTIFY] ${channel.type} error:`, e.message); }
  }
}

module.exports = { loadConfig, saveConfig, sendNotification };
