/**
 * Notification Center Routes — Toolbar bell notifications, history, read state
 * Stored in data/notification-center.json
 * Automatically dispatches to webhook/email channels via sendNotification
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sendNotification } = require('../lib/notification-sender');

const DATA = path.join(__dirname, '..', 'data');
const NOTIFS_PATH = path.join(DATA, 'notification-center.json');

function readNotifs() {
  try { return JSON.parse(fs.readFileSync(NOTIFS_PATH, 'utf8')); }
  catch { return []; }
}
function writeNotifs(data) {
  fs.mkdirSync(path.dirname(NOTIFS_PATH), { recursive: true });
  fs.writeFileSync(NOTIFS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Public function to push notifications from other routes
// Also dispatches to all configured channels (email, Discord, Slack, Telegram)
function pushNotification(category, title, message, severity) {
  const notifs = readNotifs();
  notifs.push({
    id: crypto.randomUUID(),
    category: category || 'system', // security, deploy, cron, system, git, uptime
    title,
    message: message || '',
    severity: severity || 'info', // info, warning, critical
    read: false,
    timestamp: new Date().toISOString(),
  });
  if (notifs.length > 200) notifs.splice(0, notifs.length - 200);
  writeNotifs(notifs);

  // Fire to all configured channels (email, Discord, Slack, Telegram)
  sendNotification(category, { title, message: message || '', severity: severity || 'info' })
    .catch(e => console.error('[NOTIFY] dispatch error:', e.message));
}

module.exports = function (app, ctx) {
  const { requireRole } = ctx;
  // Expose pushNotification on ctx for other routes
  ctx.pushNotification = pushNotification;

  // Get all notifications (with unread count)
  app.get('/api/notification-center', ctx.requireAuth, (req, res) => {
    const notifs = readNotifs();
    const unread = notifs.filter(n => !n.read).length;
    res.json({
      notifications: notifs.slice(-50).reverse(),
      unread,
      total: notifs.length,
    });
  });

  // Mark one as read
  app.post('/api/notification-center/:id/read', ctx.requireAuth, (req, res) => {
    const notifs = readNotifs();
    const n = notifs.find(x => x.id === req.params.id);
    if (n) { n.read = true; writeNotifs(notifs); }
    res.json({ success: true });
  });

  // Mark all as read
  app.post('/api/notification-center/read-all', ctx.requireAuth, (req, res) => {
    const notifs = readNotifs();
    notifs.forEach(n => { n.read = true; });
    writeNotifs(notifs);
    res.json({ success: true });
  });

  // Delete one
  app.delete('/api/notification-center/:id', requireRole('editor'), (req, res) => {
    let notifs = readNotifs();
    notifs = notifs.filter(n => n.id !== req.params.id);
    writeNotifs(notifs);
    res.json({ success: true });
  });

  // Clear all
  app.delete('/api/notification-center/all', requireRole('admin'), (req, res) => {
    writeNotifs([]);
    res.json({ success: true });
  });

  // Push (manual or from other services)
  app.post('/api/notification-center', ctx.requireAdmin, (req, res) => {
    const { category, title, message, severity } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    pushNotification(category, title, message, severity);
    res.json({ success: true });
  });
};

module.exports.pushNotification = pushNotification;
