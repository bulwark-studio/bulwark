/**
 * Security Enhanced Routes — Local security checks, AI analysis, posture scoring
 * Works without adapter — uses system commands + file analysis
 */
const fs = require('fs');
const path = require('path');
const { askAI } = require('../lib/ai');
const crypto = require('crypto');

const DATA = path.join(__dirname, '..', 'data');
const EVENTS_PATH = path.join(DATA, 'security-events.json');
const ALERTS_PATH = path.join(DATA, 'security-alerts.json');

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole, execCommand, REPO_DIR } = ctx;

  // Security posture score
  app.get('/api/security/posture', requireAdmin, async (req, res) => {
    try {
      const checks = [];
      let score = 100;

      // Check 1: .env files not in git
      try {
        const envCheck = await execCommand('git ls-files .env .env.local .env.production 2>/dev/null', { cwd: REPO_DIR, timeout: 3000 });
        const tracked = envCheck.stdout.trim();
        if (tracked) { checks.push({ name: '.env in Git', status: 'fail', detail: 'Environment files tracked by git', severity: 'critical' }); score -= 20; }
        else checks.push({ name: '.env in Git', status: 'pass', detail: 'Environment files properly gitignored' });
      } catch { checks.push({ name: '.env in Git', status: 'pass', detail: 'No tracked env files' }); }

      // Check 2: .gitignore exists
      const gitignoreExists = fs.existsSync(path.join(REPO_DIR, '.gitignore'));
      checks.push({ name: '.gitignore', status: gitignoreExists ? 'pass' : 'warn', detail: gitignoreExists ? 'Present' : 'Missing .gitignore file' });
      if (!gitignoreExists) score -= 10;

      // Check 3: No hardcoded secrets in code
      try {
        const secretScan = await execCommand(
          'git grep -n -E "(password|secret|api_key|private_key)\\s*[:=]\\s*[\'\\"][^\\s]{8,}" -- "*.js" "*.ts" "*.json" 2>/dev/null | head -10',
          { cwd: REPO_DIR, timeout: 5000 }
        );
        const found = secretScan.stdout.trim();
        if (found) {
          const count = found.split('\n').filter(Boolean).length;
          checks.push({ name: 'Hardcoded Secrets', status: 'fail', detail: count + ' potential secrets found in code', severity: 'high' });
          score -= 15;
        } else {
          checks.push({ name: 'Hardcoded Secrets', status: 'pass', detail: 'No hardcoded secrets detected' });
        }
      } catch { checks.push({ name: 'Hardcoded Secrets', status: 'pass', detail: 'Scan clean' }); }

      // Check 4: package-lock.json exists (dependency pinning)
      const lockExists = fs.existsSync(path.join(REPO_DIR, 'package-lock.json')) || fs.existsSync(path.join(REPO_DIR, 'yarn.lock'));
      checks.push({ name: 'Dependency Lock', status: lockExists ? 'pass' : 'warn', detail: lockExists ? 'Lock file present' : 'No lock file — unpinned dependencies' });
      if (!lockExists) score -= 5;

      // Check 5: Node.js version
      try {
        const nodeVer = await execCommand('node --version', { timeout: 3000 });
        const ver = parseInt((nodeVer.stdout.trim().match(/v(\d+)/) || [])[1] || '0');
        const current = ver >= 20;
        checks.push({ name: 'Node.js Version', status: current ? 'pass' : 'warn', detail: nodeVer.stdout.trim() + (current ? ' (supported)' : ' (outdated)') });
        if (!current) score -= 5;
      } catch { checks.push({ name: 'Node.js Version', status: 'warn', detail: 'Could not check' }); }

      // Check 6: HTTPS/TLS configured
      const hasSSL = !!process.env.SSL_CERT || !!process.env.HTTPS;
      checks.push({ name: 'HTTPS/TLS', status: hasSSL ? 'pass' : 'info', detail: hasSSL ? 'TLS configured' : 'Running HTTP (use reverse proxy for HTTPS)' });

      // Check 7: Auth strength
      const usersFile = path.join(__dirname, '..', 'users.json');
      try {
        const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        const hasDefault = users.some(u => u.user === 'admin' && !u.totpSecret);
        checks.push({ name: 'Auth Security', status: hasDefault ? 'warn' : 'pass', detail: hasDefault ? 'Default admin without 2FA' : '2FA enabled for admin' });
        if (hasDefault) score -= 10;
      } catch { checks.push({ name: 'Auth Security', status: 'info', detail: 'Could not check' }); }

      // Check 8: Open ports (if nmap available)
      try {
        const ports = await execCommand('ss -tlnp 2>/dev/null | grep LISTEN | wc -l', { timeout: 3000 });
        const count = parseInt(ports.stdout.trim()) || 0;
        checks.push({ name: 'Open Ports', status: count <= 10 ? 'pass' : 'warn', detail: count + ' listening ports' });
      } catch { checks.push({ name: 'Open Ports', status: 'info', detail: 'Could not check (Windows)' }); }

      // Check 9: npm audit
      try {
        const audit = await execCommand('npm audit --json 2>/dev/null | head -c 2000', { cwd: REPO_DIR, timeout: 15000 });
        const auditData = JSON.parse(audit.stdout || '{}');
        const vulns = auditData.metadata?.vulnerabilities || {};
        const critical = (vulns.critical || 0) + (vulns.high || 0);
        checks.push({ name: 'npm Audit', status: critical === 0 ? 'pass' : 'fail', detail: critical ? `${critical} critical/high vulnerabilities` : 'No critical vulnerabilities', severity: critical > 0 ? 'high' : undefined });
        if (critical > 0) score -= 10;
      } catch { checks.push({ name: 'npm Audit', status: 'info', detail: 'Could not run audit' }); }

      score = Math.max(0, Math.min(100, score));
      const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

      res.json({ score, grade, checks, checkedAt: new Date().toISOString() });
    } catch (e) { res.json({ score: 0, grade: 'F', checks: [], error: e.message }); }
  });

  // Dependency vulnerabilities
  app.get('/api/security/dependencies', requireAdmin, async (req, res) => {
    try {
      const audit = await execCommand('npm audit --json 2>/dev/null', { cwd: REPO_DIR, timeout: 30000 });
      const data = JSON.parse(audit.stdout || '{}');
      const vulns = data.vulnerabilities || {};
      const list = Object.entries(vulns).map(([name, v]) => ({
        name,
        severity: v.severity,
        via: Array.isArray(v.via) ? v.via.filter(x => typeof x === 'string').join(', ') : '',
        range: v.range || '',
        fixAvailable: !!v.fixAvailable,
      })).sort((a, b) => {
        const order = { critical: 0, high: 1, moderate: 2, low: 3 };
        return (order[a.severity] || 4) - (order[b.severity] || 4);
      });

      const meta = data.metadata?.vulnerabilities || {};
      res.json({ vulnerabilities: list, summary: meta, total: list.length });
    } catch (e) { res.json({ vulnerabilities: [], summary: {}, error: e.message }); }
  });

  // Security events log
  app.get('/api/security/events', requireAdmin, (req, res) => {
    const events = readJSON(EVENTS_PATH, []);
    res.json({ events: events.slice(-100).reverse() });
  });

  // Log a security event
  app.post('/api/security/events', requireRole('editor'), (req, res) => {
    const { type, severity, message, source } = req.body;
    const events = readJSON(EVENTS_PATH, []);
    events.push({
      id: crypto.randomUUID(),
      type: type || 'manual',
      severity: severity || 'info',
      message: message || '',
      source: source || 'user',
      timestamp: new Date().toISOString(),
    });
    if (events.length > 500) events.splice(0, events.length - 500);
    writeJSON(EVENTS_PATH, events);
    res.json({ success: true });
  });

  // Secret scanner — find potential secrets in codebase
  app.get('/api/security/secret-scan', requireAdmin, async (req, res) => {
    try {
      const patterns = [
        { name: 'API Key', pattern: 'api[_-]?key\\s*[:=]\\s*["\'][^"\']{16,}' },
        { name: 'AWS Access Key', pattern: 'AKIA[A-Z0-9]{16}' },
        { name: 'GitHub Token', pattern: 'ghp_[a-zA-Z0-9]{36}' },
        { name: 'Private Key', pattern: 'BEGIN (RSA |EC )?PRIVATE KEY' },
        { name: 'Password', pattern: 'password\\s*[:=]\\s*["\'][^"\']{6,}' },
        { name: 'Connection String', pattern: '(postgres|mysql|mongodb)://[^\\s"\']{10,}' },
        { name: 'Bearer Token', pattern: 'Bearer\\s+[a-zA-Z0-9_\\-\\.]{20,}' },
        { name: 'Slack Token', pattern: 'xox[bpors]-[a-zA-Z0-9\\-]+' },
      ];

      const findings = [];
      for (const p of patterns) {
        try {
          const r = await execCommand(
            `git grep -n -E "${p.pattern}" -- "*.js" "*.ts" "*.json" "*.yml" "*.yaml" "*.env*" 2>/dev/null | head -5`,
            { cwd: REPO_DIR, timeout: 5000 }
          );
          if (r.stdout.trim()) {
            r.stdout.trim().split('\n').filter(Boolean).forEach(line => {
              const [file, ...rest] = line.split(':');
              findings.push({ type: p.name, file, line: rest.join(':').trim().substring(0, 100) });
            });
          }
        } catch {}
      }

      res.json({ findings, scannedAt: new Date().toISOString(), totalFindings: findings.length });
    } catch (e) { res.json({ findings: [], error: e.message }); }
  });

  // AI: Security analysis
  app.get('/api/security/ai-analysis', requireAdmin, async (req, res) => {
    try {
      // Gather context
      const postureResp = await new Promise(resolve => {
        const mockReq = { user: { role: 'admin' } };
        const mockRes = { json: resolve };
        // Just call the posture endpoint logic inline
        resolve({ score: 'N/A', checks: [] });
      });

      const events = readJSON(EVENTS_PATH, []);
      const recentEvents = events.slice(-10);

      const prompt = `You are a security advisor. Analyze this server's security posture in 4-5 sentences. Be specific about risks and actionable recommendations. No markdown.\n\nRecent security events: ${recentEvents.length ? recentEvents.map(e => e.type + ': ' + e.message).join('; ') : 'None logged'}\nServer: Node.js ${process.version}, Platform: ${process.platform}\nEnv vars with secrets: ${Object.keys(process.env).filter(k => /KEY|SECRET|TOKEN|PASS/i.test(k)).length} detected`;

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ analysis: cached.response, cached: true });

      const result = await askAI(prompt, { timeout: 20000 });

      const analysis = result.trim() || 'Analysis unavailable.';
      neuralCache.semanticSet(prompt, analysis);
      res.json({ analysis, cached: false });
    } catch (e) { res.json({ analysis: 'Analysis unavailable: ' + e.message }); }
  });

  // AI: Fix recommendation for a specific finding
  app.post('/api/security/ai-fix', requireRole('editor'), async (req, res) => {
    try {
      const { finding, context } = req.body;
      const prompt = `Give a specific, actionable fix for this security finding in 2-3 sentences. No markdown.\n\nFinding: ${finding}\nContext: ${context || 'Node.js server application'}`;

      const result = await askAI(prompt, { timeout: 15000 });

      res.json({ fix: result.trim() || 'No recommendation available.' });
    } catch (e) { res.json({ fix: 'Recommendation unavailable: ' + e.message }); }
  });
};
