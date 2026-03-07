const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const CONFIG_FILE = path.join(__dirname, "..", "data", "notifications.json");
const SETTINGS_FILE = path.join(__dirname, "..", "data", "settings.json");

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

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {}
  return {};
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

/**
 * Send email via SMTP using Node.js net/tls — zero dependencies
 * Supports STARTTLS (port 587) and implicit TLS (port 465)
 * @param {object} smtpConfig - { host, port, user, pass, from }
 * @param {object} emailData - { to, cc, subject, body }
 */
async function sendEmail(smtpConfig, emailData) {
  const { host, port, user, pass, from } = smtpConfig;
  const { to, cc, subject, body } = emailData;
  if (!host || !user || !pass || !to) throw new Error("SMTP not configured or no recipient");

  const tls = require("tls");
  const net = require("net");

  // Build email content
  const toList = Array.isArray(to) ? to.join(", ") : to;
  const ccList = cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : "";
  const allRecipients = [].concat(Array.isArray(to) ? to : [to]);
  if (cc) allRecipients.push(...(Array.isArray(cc) ? cc : [cc]));

  const boundary = "----BulwarkMail" + Date.now();
  const date = new Date().toUTCString();
  const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@bulwark>`;
  const emailContent = [
    `From: ${from || user}`,
    `To: ${toList}`,
    ccList ? `Cc: ${ccList}` : null,
    `Subject: ${subject || "Bulwark Alert"}`,
    `Date: ${date}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `X-Mailer: Bulwark`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body.replace(/<[^>]+>/g, ""),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    `<div style="font-family:system-ui,-apple-system,sans-serif;color:#e4e4e7;background:#0a0b10;padding:24px;border-radius:8px;max-width:600px">` +
      `<div style="border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:12px;margin-bottom:16px">` +
        `<strong style="color:#22d3ee;font-size:14px">Bulwark Alert</strong>` +
      `</div>` +
      `<div style="font-size:13px;line-height:1.7">${body}</div>` +
      `<div style="margin-top:20px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:#52525a">` +
        `Sent by Bulwark &middot; ${date}` +
      `</div>` +
    `</div>`,
    ``,
    `--${boundary}--`,
    ``,
  ].filter(l => l !== null).join("\r\n");

  return new Promise((resolve, reject) => {
    let socket;
    let response = "";
    const smtpPort = parseInt(port) || 587;
    const useImplicitTLS = smtpPort === 465;
    const authStr = Buffer.from(`\0${user}\0${pass}`).toString("base64");
    let step = 0;

    function onData(data) {
      response += data.toString();
      const lines = response.split("\r\n");
      const lastLine = lines.filter(l => l.length > 0).pop() || "";
      const code = parseInt(lastLine.substring(0, 3));
      if (!code || lastLine[3] === "-") return; // multiline response, wait
      response = "";

      try {
        switch (step) {
          case 0: // greeting
            if (code !== 220) throw new Error("SMTP greeting failed: " + lastLine);
            socket.write("EHLO bulwark\r\n");
            step = 1;
            break;
          case 1: // EHLO response
            if (code !== 250) throw new Error("EHLO failed: " + lastLine);
            if (!useImplicitTLS) {
              socket.write("STARTTLS\r\n");
              step = 2;
            } else {
              socket.write("AUTH PLAIN " + authStr + "\r\n");
              step = 3;
            }
            break;
          case 2: // STARTTLS response
            if (code !== 220) throw new Error("STARTTLS failed: " + lastLine);
            const secureSocket = tls.connect({ socket: socket, host: host, servername: host }, () => {
              socket = secureSocket;
              socket.on("data", onData);
              socket.write("EHLO bulwark\r\n");
              step = 20; // upgraded EHLO
            });
            secureSocket.on("error", (e) => reject(new Error("TLS error: " + e.message)));
            break;
          case 20: // EHLO after STARTTLS
            if (code !== 250) throw new Error("EHLO (TLS) failed: " + lastLine);
            socket.write("AUTH PLAIN " + authStr + "\r\n");
            step = 3;
            break;
          case 3: // AUTH response
            if (code !== 235) throw new Error("Auth failed: " + lastLine);
            socket.write("MAIL FROM:<" + (from || user) + ">\r\n");
            step = 4;
            break;
          case 4: // MAIL FROM
            if (code !== 250) throw new Error("MAIL FROM failed: " + lastLine);
            step = 5;
            sendRecipient(0);
            break;
          case 5: // RCPT TO responses
            if (code !== 250 && code !== 251) throw new Error("RCPT TO failed: " + lastLine);
            rcptIdx++;
            if (rcptIdx < allRecipients.length) { sendRecipient(rcptIdx); }
            else { socket.write("DATA\r\n"); step = 6; }
            break;
          case 6: // DATA response
            if (code !== 354) throw new Error("DATA failed: " + lastLine);
            socket.write(emailContent + "\r\n.\r\n");
            step = 7;
            break;
          case 7: // Message accepted
            if (code !== 250) throw new Error("Send failed: " + lastLine);
            socket.write("QUIT\r\n");
            resolve({ success: true, message: "Email sent to " + toList });
            break;
        }
      } catch (e) {
        try { socket.write("QUIT\r\n"); } catch {}
        reject(e);
      }
    }

    let rcptIdx = 0;
    function sendRecipient(i) {
      socket.write("RCPT TO:<" + allRecipients[i].trim() + ">\r\n");
    }

    if (useImplicitTLS) {
      socket = tls.connect({ host, port: smtpPort, servername: host }, () => {});
    } else {
      socket = net.createConnection({ host, port: smtpPort });
    }
    socket.setEncoding("utf8");
    socket.on("data", onData);
    socket.on("error", (e) => reject(new Error("SMTP connection error: " + e.message)));
    socket.on("timeout", () => { socket.destroy(); reject(new Error("SMTP timeout")); });
    socket.setTimeout(15000);
  });
}

/**
 * Send email using channel config (reads SMTP from settings.json)
 */
async function sendEmailChannel(channel, payload) {
  const settings = loadSettings();
  const smtp = settings.smtp;
  if (!smtp || !smtp.host) throw new Error("SMTP not configured. Go to Settings > Email (SMTP).");

  const severity = payload.severity || "info";
  const severityLabel = severity === "critical" ? "CRITICAL" : severity === "warning" ? "WARNING" : "INFO";
  const severityColor = severity === "critical" ? "#ff6b2b" : severity === "warning" ? "#eab308" : "#22d3ee";

  const subject = `[Bulwark ${severityLabel}] ${payload.title}`;
  const body = `<h3 style="color:${severityColor};margin:0 0 8px">${severityLabel}: ${escHtml(payload.title)}</h3>` +
    `<p style="margin:0 0 16px">${escHtml(payload.message)}</p>` +
    (payload.fields ? payload.fields.map(f => `<div><strong>${escHtml(f.name)}:</strong> ${escHtml(f.value)}</div>`).join("") : "");

  await sendEmail(smtp, {
    to: channel.email,
    cc: channel.cc || "",
    subject,
    body,
  });
}

function escHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendNotification(eventType, payload) {
  const cfg = loadConfig();
  for (const channel of cfg.channels) {
    if (!channel.enabled) continue;
    if (channel.events && channel.events.length && !channel.events.includes(eventType)) continue;
    try {
      if (channel.type === "discord") await sendDiscord(channel.webhookUrl, payload);
      else if (channel.type === "slack") await sendSlack(channel.webhookUrl, payload);
      else if (channel.type === "telegram") await sendTelegram(channel.botToken, channel.chatId, payload);
      else if (channel.type === "email") await sendEmailChannel(channel, payload);
    } catch (e) { console.error(`[NOTIFY] ${channel.type} error:`, e.message); }
  }
}

module.exports = { loadConfig, saveConfig, sendNotification, sendEmail, sendEmailChannel, sendDiscord, sendSlack, sendTelegram };
