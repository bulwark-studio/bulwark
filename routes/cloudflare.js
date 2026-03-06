/**
 * Cloudflare Routes — Analytics, DNS, SSL, Cache Purge
 */
const cf = require('../lib/cloudflare');

module.exports = function (app, ctx) {
  const { requireAdmin } = ctx;

  // Get config (without exposing full token)
  app.get('/api/cloudflare/config', requireAdmin, (req, res) => {
    const cfg = cf.loadConfig();
    res.json({
      configured: !!cfg.apiToken,
      accountId: cfg.accountId || '',
      zoneCount: (cfg.zones || []).length,
      tokenHint: cfg.apiToken ? '****' + cfg.apiToken.slice(-4) : '',
    });
  });

  // Save config + auto-discover zones
  app.post('/api/cloudflare/config', requireAdmin, async (req, res) => {
    try {
      const { apiToken, accountId } = req.body;
      if (!apiToken) return res.status(400).json({ error: 'API token required' });

      // Test token by fetching zones
      const zones = await cf.fetchZones(apiToken);
      if (!zones || zones.length === 0) return res.json({ error: 'Token valid but no zones found', zones: [] });

      const cfg = { apiToken, accountId: accountId || '', zones };
      cf.saveConfig(cfg);
      res.json({ success: true, zones });
    } catch (e) {
      res.status(500).json({ error: 'Invalid token or Cloudflare API error: ' + e.message });
    }
  });

  // List zones
  app.get('/api/cloudflare/zones', requireAdmin, async (req, res) => {
    try {
      const cfg = cf.loadConfig();
      if (!cfg.apiToken) return res.json({ error: 'Not configured', zones: [] });
      const zones = await cf.fetchZones(cfg.apiToken);
      res.json({ zones });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Zone analytics
  app.get('/api/cloudflare/analytics/:zoneId', requireAdmin, async (req, res) => {
    try {
      const cfg = cf.loadConfig();
      if (!cfg.apiToken) return res.json({ error: 'Not configured' });
      const range = req.query.range || '24h';
      const data = await cf.fetchAnalytics(cfg.apiToken, req.params.zoneId, range);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // All zones overview
  app.get('/api/cloudflare/analytics/overview', requireAdmin, async (req, res) => {
    try {
      const cfg = cf.loadConfig();
      if (!cfg.apiToken) return res.json({ error: 'Not configured' });
      const range = req.query.range || '24h';
      const data = await cf.fetchOverview(cfg.apiToken, range);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // DNS records
  app.get('/api/cloudflare/dns/:zoneId', requireAdmin, async (req, res) => {
    try {
      const cfg = cf.loadConfig();
      if (!cfg.apiToken) return res.json({ error: 'Not configured' });
      const records = await cf.fetchDNS(cfg.apiToken, req.params.zoneId);
      res.json({ records });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // SSL status
  app.get('/api/cloudflare/ssl/:zoneId', requireAdmin, async (req, res) => {
    try {
      const cfg = cf.loadConfig();
      if (!cfg.apiToken) return res.json({ error: 'Not configured' });
      const data = await cf.fetchSSLStatus(cfg.apiToken, req.params.zoneId);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Purge cache
  app.post('/api/cloudflare/purge/:zoneId', requireAdmin, async (req, res) => {
    try {
      const cfg = cf.loadConfig();
      if (!cfg.apiToken) return res.json({ error: 'Not configured' });
      const urls = req.body.urls || [];
      const result = await cf.purgeCache(cfg.apiToken, req.params.zoneId, urls);
      res.json({ success: !!result.success, result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // AI analysis
  app.get('/api/cloudflare/ai-analysis', requireAdmin, async (req, res) => {
    try {
      const cfg = cf.loadConfig();
      if (!cfg.apiToken) return res.json({ error: 'Not configured' });

      const neuralCache = require('../lib/neural-cache');
      const overview = await cf.fetchOverview(cfg.apiToken, req.query.range || '24h');

      const context = [
        `${overview.zoneCount} domains monitored`,
        `Total requests: ${overview.totalRequests}, Cached: ${overview.cachedRequests} (${overview.cacheRatio}%)`,
        `Bandwidth: ${formatBytes(overview.totalBytes)}, Saved by cache: ${formatBytes(overview.cachedBytes)}`,
        `Threats blocked: ${overview.totalThreats}`,
        `Unique visitors: ${overview.totalUniques}`,
        `Page views: ${overview.totalPageViews}`,
        `Per-domain breakdown:`,
        ...overview.zones.map(z => `  ${z.domain}: ${z.totalRequests} reqs, ${z.cacheRatio}% cached, ${z.totalThreats} threats`),
      ].join('\n');

      const prompt = context + '\n\nAnalyze this Cloudflare traffic data. Give 4-5 sentences with specific insights about traffic patterns, cache optimization, security posture, and recommendations. Mention specific domains. No markdown.';

      // Check semantic cache
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ analysis: cached.response, cached: true });

      const { spawn } = require('child_process');
      const cleanEnv = { ...process.env };
      delete cleanEnv.CLAUDECODE;
      const result = await new Promise((resolve, reject) => {
        const child = spawn('claude', ['--print'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, timeout: 20000, env: cleanEnv });
        let stdout = '', stderr = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => { stderr += d; });
        child.on('close', code => resolve({ stdout, stderr, code }));
        child.on('error', reject);
        child.stdin.on('error', () => {});
        child.stdin.write(prompt);
        child.stdin.end();
      });

      const analysis = result.stdout.trim() || 'Analysis unavailable';
      neuralCache.semanticSet(prompt, analysis);
      res.json({ analysis, cached: false });
    } catch (e) {
      res.json({ analysis: 'Unable to generate analysis: ' + e.message, cached: false, fallback: true });
    }
  });
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}
