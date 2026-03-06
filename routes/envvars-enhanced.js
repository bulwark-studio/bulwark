/**
 * EnvVars Enhanced Routes — AI secret detection, .env export, comparison, categories
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { askAI } = require('../lib/ai');

const DATA_FILE = path.join(__dirname, '..', 'data', 'envvars.json');

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.MONITOR_PASS || 'dev-monitor-default-key';
  return crypto.createHash('sha256').update(raw).digest();
}
function decrypt(data) {
  const [ivHex, tagHex, enc] = data.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}
function loadStore() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
  return { apps: {} };
}

// Categorize env var by key name
function categorize(key) {
  const k = key.toUpperCase();
  if (/DATABASE|DB_|PG_|POSTGRES|MYSQL|REDIS|MONGO/.test(k)) return 'database';
  if (/API_KEY|SECRET_KEY|TOKEN|AUTH|BEARER|OAUTH/.test(k)) return 'api_key';
  if (/AWS|GCP|AZURE|S3_|CLOUD/.test(k)) return 'cloud';
  if (/SMTP|EMAIL|MAIL|SENDGRID|POSTMARK/.test(k)) return 'email';
  if (/STRIPE|PAYMENT|BILLING/.test(k)) return 'payment';
  if (/PORT|HOST|URL|DOMAIN|ORIGIN/.test(k)) return 'connection';
  if (/NODE_ENV|DEBUG|LOG|VERBOSE/.test(k)) return 'config';
  if (/FEATURE_|FLAG_|ENABLE_|DISABLE_/.test(k)) return 'feature_flag';
  if (/ENCRYPT|SALT|HASH|PBKDF/.test(k)) return 'security';
  return 'general';
}

// Detect potential leaked secrets in values
function detectSecretRisk(key, value) {
  if (!value) return null;
  const k = key.toUpperCase();
  // Check if value looks like a real secret (not a placeholder)
  if (/^(xxx|placeholder|changeme|your_|TODO|FIXME)/i.test(value)) return 'placeholder';
  if (value.length < 8 && /KEY|SECRET|TOKEN|PASS/.test(k)) return 'weak';
  if (/^sk-[a-zA-Z0-9]{20,}/.test(value)) return 'openai_key';
  if (/^ghp_[a-zA-Z0-9]{36}/.test(value)) return 'github_pat';
  if (/^AKIA[A-Z0-9]{16}/.test(value)) return 'aws_access_key';
  if (/^xoxb-/.test(value)) return 'slack_token';
  if (/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(value)) return 'private_key';
  return null;
}

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole, execCommand, REPO_DIR } = ctx;

  // Export as .env format
  app.get('/api/envvars/:app/export', requireAdmin, (req, res) => {
    const store = loadStore();
    const appData = store.apps[req.params.app];
    if (!appData) return res.status(404).json({ error: 'App not found' });
    const lines = Object.entries(appData.vars || {}).map(([key, entry]) => {
      const val = decrypt(entry.value);
      return `${key}=${val.includes(' ') || val.includes('"') ? '"' + val.replace(/"/g, '\\"') + '"' : val}`;
    });
    const content = '# Exported from Bulwark\n# App: ' + req.params.app + '\n# Date: ' + new Date().toISOString() + '\n\n' + lines.join('\n') + '\n';
    res.json({ content, count: lines.length });
  });

  // Compare two apps
  app.get('/api/envvars/compare/:app1/:app2', requireAdmin, (req, res) => {
    const store = loadStore();
    const a1 = store.apps[req.params.app1]?.vars || {};
    const a2 = store.apps[req.params.app2]?.vars || {};
    const allKeys = [...new Set([...Object.keys(a1), ...Object.keys(a2)])].sort();

    const diff = allKeys.map(key => {
      const in1 = key in a1;
      const in2 = key in a2;
      let status = 'same';
      if (in1 && !in2) status = 'only_first';
      else if (!in1 && in2) status = 'only_second';
      else {
        try {
          const v1 = decrypt(a1[key].value);
          const v2 = decrypt(a2[key].value);
          if (v1 !== v2) status = 'different';
        } catch { status = 'error'; }
      }
      return { key, status, category: categorize(key) };
    });

    res.json({
      app1: req.params.app1, app2: req.params.app2,
      total: allKeys.length,
      same: diff.filter(d => d.status === 'same').length,
      different: diff.filter(d => d.status === 'different').length,
      onlyFirst: diff.filter(d => d.status === 'only_first').length,
      onlySecond: diff.filter(d => d.status === 'only_second').length,
      diff,
    });
  });

  // Categorized view with risk detection
  app.get('/api/envvars/:app/categorized', requireAdmin, (req, res) => {
    const store = loadStore();
    const appData = store.apps[req.params.app];
    if (!appData) return res.json({ categories: {}, risks: [] });

    const categories = {};
    const risks = [];

    for (const [key, entry] of Object.entries(appData.vars || {})) {
      const cat = categorize(key);
      if (!categories[cat]) categories[cat] = [];
      const item = { key, category: cat, updated: entry.updated, description: entry.description || '' };
      categories[cat].push(item);

      // Risk detection on revealed value
      try {
        const val = decrypt(entry.value);
        const risk = detectSecretRisk(key, val);
        if (risk) risks.push({ key, risk, category: cat });
      } catch {}
    }

    res.json({ categories, risks, totalVars: Object.keys(appData.vars || {}).length });
  });

  // Scan codebase for potential env vars needed
  app.get('/api/envvars/scan-codebase', requireAdmin, async (req, res) => {
    try {
      const r = await execCommand(
        'git grep -ohE "process\\.env\\.[A-Z_][A-Z0-9_]*" -- "*.js" "*.ts" "*.mjs" | sort -u',
        { cwd: REPO_DIR, timeout: 10000 }
      );
      const found = r.stdout.trim().split('\n').filter(Boolean).map(m => m.replace('process.env.', ''));

      // Check which are set in any app
      const store = loadStore();
      const allSetKeys = new Set();
      for (const appData of Object.values(store.apps)) {
        for (const key of Object.keys(appData.vars || {})) allSetKeys.add(key);
      }

      // Also check actual process.env
      for (const key of Object.keys(process.env)) allSetKeys.add(key);

      const missing = found.filter(k => !allSetKeys.has(k));
      const defined = found.filter(k => allSetKeys.has(k));

      res.json({ found, missing, defined, total: found.length });
    } catch (e) { res.json({ found: [], missing: [], defined: [], error: e.message }); }
  });

  // AI: Analyze env var security
  app.get('/api/envvars/:app/ai-analysis', requireAdmin, async (req, res) => {
    try {
      const store = loadStore();
      const appData = store.apps[req.params.app];
      if (!appData) return res.json({ analysis: 'No variables found for this app.' });

      const keys = Object.keys(appData.vars || {});
      const cats = {};
      keys.forEach(k => { const c = categorize(k); cats[c] = (cats[c] || 0) + 1; });

      const prompt = `Analyze these environment variables for security and best practices. Be concise (4-5 sentences). Check: naming conventions, missing critical vars, security concerns, organization. No markdown.\n\nApp: ${req.params.app}\nTotal: ${keys.length} variables\nKeys: ${keys.join(', ')}\nCategories: ${JSON.stringify(cats)}`;

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ analysis: cached.response, cached: true });

      const analysis = await askAI(prompt, { timeout: 20000 }) || 'Analysis unavailable.';
      neuralCache.semanticSet(prompt, analysis);
      res.json({ analysis, cached: false });
    } catch (e) { res.json({ analysis: 'Analysis unavailable: ' + e.message }); }
  });
};
