const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "uptime.json");
const CHECK_INTERVAL = 60000; // 60 seconds

let config = { endpoints: [], checks: {} };
let checkTimer = null;

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) config = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {}
  if (!config.endpoints) config.endpoints = [];
  if (!config.checks) config.checks = {};
}

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (e) { console.error("[UPTIME] save:", e.message); }
}

function addEndpoint(ep) {
  const id = ep.id || require("crypto").randomUUID();
  config.endpoints.push({ id, name: ep.name, url: ep.url, interval: ep.interval || 60, expectedStatus: ep.expectedStatus || 200, created: new Date().toISOString() });
  config.checks[id] = [];
  save();
  return id;
}

function removeEndpoint(id) {
  config.endpoints = config.endpoints.filter(e => e.id !== id);
  delete config.checks[id];
  save();
}

function getEndpoints() { return config.endpoints; }

function getChecks(id, days = 30) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return (config.checks[id] || []).filter(c => c.ts >= since);
}

function getUptimePercent(id, hours = 24) {
  const since = Date.now() - hours * 60 * 60 * 1000;
  const checks = (config.checks[id] || []).filter(c => c.ts >= since);
  if (checks.length === 0) return null;
  const up = checks.filter(c => c.ok).length;
  return Math.round((up / checks.length) * 10000) / 100;
}

// Track last known state per endpoint for transition alerts
const lastState = {};

async function checkAll() {
  for (const ep of config.endpoints) {
    const entry = { ts: Date.now(), ok: false, latency: -1 };
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(ep.url, { signal: controller.signal });
      clearTimeout(timeout);
      entry.latency = Date.now() - start;
      entry.status = res.status;
      entry.ok = res.status === (ep.expectedStatus || 200);
    } catch (e) {
      entry.error = e.message;
    }
    if (!config.checks[ep.id]) config.checks[ep.id] = [];
    config.checks[ep.id].push(entry);
    // Keep 30 days (1 check/min = 43200 entries max)
    if (config.checks[ep.id].length > 43200) config.checks[ep.id] = config.checks[ep.id].slice(-43200);

    // Notify on state transitions (up→down or down→up)
    const wasOk = lastState[ep.id];
    if (wasOk !== undefined && wasOk !== entry.ok) {
      try {
        const { pushNotification } = require('../routes/notification-center');
        if (!entry.ok) {
          pushNotification('uptime', ep.name + ' is DOWN', 'Endpoint ' + ep.url + ' returned ' + (entry.status || 'error') + (entry.error ? ': ' + entry.error : '') + '. Latency: ' + entry.latency + 'ms', 'critical');
        } else {
          pushNotification('uptime', ep.name + ' is back UP', 'Endpoint ' + ep.url + ' recovered. Status: ' + entry.status + ', Latency: ' + entry.latency + 'ms', 'info');
        }
      } catch (e) { console.error('[UPTIME] notify error:', e.message); }
    }
    lastState[ep.id] = entry.ok;
  }
  save();
}

function start() {
  load();
  checkAll();
  checkTimer = setInterval(checkAll, CHECK_INTERVAL);
}

function stop() {
  if (checkTimer) clearInterval(checkTimer);
}

module.exports = { start, stop, load, addEndpoint, removeEndpoint, getEndpoints, getChecks, getUptimePercent, checkAll };
