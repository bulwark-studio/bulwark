/**
 * Docker Direct Routes — Docker Engine API (falls back to adapter)
 */
const docker = require('../lib/docker-engine');

module.exports = function (app, ctx) {
  const { requireAdmin } = ctx;

  // Health check — is Docker available?
  app.get('/api/docker/status', requireAdmin, async (req, res) => {
    try {
      const available = await docker.isAvailable();
      res.json({ available, config: docker.loadConfig() });
    } catch (e) {
      res.json({ available: false, error: e.message });
    }
  });

  // Save config
  app.post('/api/docker/config', requireAdmin, (req, res) => {
    try {
      docker.saveConfig(req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // List containers
  app.get('/api/docker/containers', requireAdmin, async (req, res) => {
    try {
      const all = req.query.all !== 'false';
      const containers = await docker.listContainers(all);
      res.json({ containers });
    } catch (e) {
      // Fallback to adapter
      try {
        const data = await ctx.callAdapter('/docker/containers');
        res.json(data);
      } catch {
        res.json({ containers: [], error: e.message, degraded: true });
      }
    }
  });

  // Inspect container
  app.get('/api/docker/containers/:id/inspect', requireAdmin, async (req, res) => {
    try {
      const data = await docker.inspectContainer(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Container stats
  app.get('/api/docker/containers/:id/stats', requireAdmin, async (req, res) => {
    try {
      const stats = await docker.containerStats(req.params.id);
      res.json(stats || { error: 'No stats available' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Container logs
  app.get('/api/docker/containers/:id/logs', requireAdmin, async (req, res) => {
    try {
      const tail = parseInt(req.query.tail) || 200;
      const logs = await docker.containerLogs(req.params.id, tail);
      res.json({ logs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Container actions (start/stop/restart/pause/unpause/kill)
  app.post('/api/docker/containers/:id/:action', requireAdmin, async (req, res) => {
    const allowed = ['start', 'stop', 'restart', 'pause', 'unpause', 'kill'];
    if (!allowed.includes(req.params.action)) return res.status(400).json({ error: 'Invalid action' });
    try {
      const result = await docker.containerAction(req.params.id, req.params.action);
      res.json({ success: result.status >= 200 && result.status < 400, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove container
  app.delete('/api/docker/containers/:id', requireAdmin, async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await docker.removeContainer(req.params.id, force);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Deploy new container
  app.post('/api/docker/deploy', requireAdmin, async (req, res) => {
    try {
      const result = await docker.createContainer(req.body);
      res.json({ success: result.status === 201, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // List images
  app.get('/api/docker/images', requireAdmin, async (req, res) => {
    try {
      const images = await docker.listImages();
      res.json({ images });
    } catch (e) {
      res.json({ images: [], error: e.message });
    }
  });

  // Pull image
  app.post('/api/docker/images/pull', requireAdmin, async (req, res) => {
    try {
      const { name, tag } = req.body;
      if (!name) return res.status(400).json({ error: 'Image name required' });
      const result = await docker.pullImage(name, tag);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove image
  app.delete('/api/docker/images/:id', requireAdmin, async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await docker.removeImage(req.params.id, force);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Networks
  app.get('/api/docker/networks', requireAdmin, async (req, res) => {
    try {
      const networks = await docker.listNetworks();
      res.json({ networks });
    } catch (e) {
      res.json({ networks: [], error: e.message });
    }
  });

  // Volumes
  app.get('/api/docker/volumes', requireAdmin, async (req, res) => {
    try {
      const volumes = await docker.listVolumes();
      res.json({ volumes });
    } catch (e) {
      res.json({ volumes: [], error: e.message });
    }
  });

  // ── System Operations ──

  // System disk usage
  app.get('/api/docker/system/df', requireAdmin, async (req, res) => {
    try { res.json(await docker.systemDf()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // System info + version
  app.get('/api/docker/system/info', requireAdmin, async (req, res) => {
    try { res.json(await docker.systemInfo()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Full system prune
  app.post('/api/docker/system/prune', requireAdmin, async (req, res) => {
    try {
      const includeVolumes = req.body.includeVolumes === true;
      const result = await docker.systemPrune(includeVolumes);
      res.json({ success: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Individual prune operations
  app.post('/api/docker/prune/containers', requireAdmin, async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneContainers()) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/docker/prune/images', requireAdmin, async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneImages(req.body.dangling !== false)) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/docker/prune/volumes', requireAdmin, async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneVolumes()) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/docker/prune/networks', requireAdmin, async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneNetworks()) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/docker/prune/buildcache', requireAdmin, async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneBuildCache()) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Container top — processes inside container
  app.get('/api/docker/containers/:id/top', requireAdmin, async (req, res) => {
    try { res.json(await docker.containerTop(req.params.id, req.query.ps_args)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Container filesystem changes
  app.get('/api/docker/containers/:id/changes', requireAdmin, async (req, res) => {
    try { res.json({ changes: await docker.containerChanges(req.params.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Rename container
  app.post('/api/docker/containers/:id/rename', requireAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name required' });
      const ok = await docker.renameContainer(req.params.id, name);
      res.json({ success: ok });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Chester AI — conversational Docker assistant
  app.post('/api/docker/chester', requireAdmin, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Prompt required' });

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ response: cached.response, cached: true });

      const { spawn } = require('child_process');
      const cleanEnv = { ...process.env };
      delete cleanEnv.CLAUDECODE;
      const result = await new Promise((resolve, reject) => {
        const child = spawn('claude', ['--print'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, timeout: 30000, env: cleanEnv });
        let stdout = '', stderr = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => { stderr += d; });
        child.on('close', code => resolve({ stdout, stderr, code }));
        child.on('error', reject);
        child.stdin.on('error', () => {});
        child.stdin.write(prompt);
        child.stdin.end();
      });

      const response = result.stdout.trim() || 'Analysis unavailable';
      neuralCache.semanticSet(prompt, response);
      res.json({ response, cached: false });
    } catch (e) {
      res.json({ response: 'Chester is temporarily unavailable: ' + e.message, fallback: true });
    }
  });

  // AI Analysis — Claude analyzes container fleet
  app.get('/api/docker/ai-analysis', requireAdmin, async (req, res) => {
    try {
      const containers = await docker.listContainers(true);
      const statsAll = await Promise.allSettled(
        containers.filter(c => c.state === 'running').slice(0, 10).map(c => docker.containerStats(c.id))
      );

      const lines = containers.map((c, i) => {
        const s = statsAll[i]?.value;
        return `${c.name} (${c.image}): ${c.state}/${c.status}` +
          (s ? `, CPU: ${s.cpuPct}%, Mem: ${s.memUsageMB}MB/${s.memLimitMB}MB (${s.memPct}%), Net: rx=${s.netRxFormatted} tx=${s.netTxFormatted}` : '');
      });

      const context = `Docker fleet: ${containers.length} containers (${containers.filter(c => c.state === 'running').length} running)\n` + lines.join('\n');
      const prompt = context + '\n\nAnalyze this Docker fleet. Give 4-5 sentences: resource efficiency, any concerns (high CPU/memory, stopped containers), security observations, optimization recommendations. Mention specific container names. No markdown.';

      const neuralCache = require('../lib/neural-cache');
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
      res.json({ analysis: 'Docker analysis unavailable: ' + e.message, fallback: true });
    }
  });
};
