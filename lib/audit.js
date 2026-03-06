/**
 * Audit Logger — Structured audit log for all API calls
 * Stores in data/audit-log.json (rotating, max 10K entries)
 */

const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, '..', 'data', 'audit-log.json');
const MAX_ENTRIES = 10000;

let auditLog = [];

function load() {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      auditLog = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
      if (!Array.isArray(auditLog)) auditLog = [];
    }
  } catch {
    auditLog = [];
  }
}

function save() {
  try {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(auditLog, null, 2), 'utf8');
  } catch (err) {
    console.error('[AUDIT] Failed to save:', err.message);
  }
}

function log(entry) {
  const record = {
    timestamp: new Date().toISOString(),
    user: entry.user || 'anonymous',
    role: entry.role || 'unknown',
    action: entry.action || 'unknown',
    resource: entry.resource || '',
    method: entry.method || '',
    ip: entry.ip || '',
    result: entry.result || 'success',
    details: entry.details || null,
  };
  auditLog.unshift(record);
  if (auditLog.length > MAX_ENTRIES) {
    auditLog = auditLog.slice(0, MAX_ENTRIES);
  }
  save();
  return record;
}

/**
 * Express middleware: auto-log every API call
 * Place after requireAuth so req.user is available
 */
function auditMiddleware(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  // Skip noisy read endpoints
  const skip = ['/api/health', '/api/system', '/api/me'];
  if (skip.includes(req.path) && req.method === 'GET') return next();

  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    res.end = originalEnd;
    res.end(...args);

    log({
      user: req.user?.user || 'anonymous',
      role: req.user?.role || 'unknown',
      action: req.method + ' ' + req.path,
      resource: req.path,
      method: req.method,
      ip: req.ip || req.socket?.remoteAddress || '',
      result: res.statusCode < 400 ? 'success' : 'error',
      details: res.statusCode >= 400 ? { statusCode: res.statusCode } : null,
    });
  };

  next();
}

function getLog(options = {}) {
  let entries = auditLog;
  if (options.user) entries = entries.filter(e => e.user === options.user);
  if (options.action) entries = entries.filter(e => e.action.includes(options.action));
  if (options.from) entries = entries.filter(e => e.timestamp >= options.from);
  if (options.to) entries = entries.filter(e => e.timestamp <= options.to);
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  return { total: entries.length, entries: entries.slice(offset, offset + limit) };
}

function getStats() {
  const now = new Date();
  const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const recent = auditLog.filter(e => e.timestamp >= last24h);
  const users = {};
  const actions = {};
  recent.forEach(e => {
    users[e.user] = (users[e.user] || 0) + 1;
    const verb = e.method || e.action.split(' ')[0];
    actions[verb] = (actions[verb] || 0) + 1;
  });
  return {
    total: auditLog.length,
    last24h: recent.length,
    errors: recent.filter(e => e.result === 'error').length,
    topUsers: Object.entries(users).sort((a, b) => b[1] - a[1]).slice(0, 5),
    actionBreakdown: actions,
  };
}

// Load on startup
load();

module.exports = {
  log,
  auditMiddleware,
  getLog,
  getStats,
};
