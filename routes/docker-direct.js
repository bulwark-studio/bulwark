/**
 * Docker Direct Routes — Docker Engine API (falls back to adapter)
 */
const docker = require('../lib/docker-engine');
const { askAI } = require('../lib/ai');

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole } = ctx;

  // ── Test Docker connection with given config (don't save yet) ──
  app.post('/api/docker/test-connection', requireRole('editor'), async (req, res) => {
    const { type, socketPath, host, port, tlsVerify } = req.body;
    const http = require('http');
    const testOpts = { method: 'GET', path: '/_ping', timeout: 8000 };

    if (type === 'remote' && host) {
      testOpts.hostname = host;
      testOpts.port = port || 2375;
    } else {
      testOpts.socketPath = socketPath || (process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock');
    }

    try {
      const result = await new Promise((resolve, reject) => {
        const r = http.request(testOpts, (resp) => {
          let d = '';
          resp.on('data', c => d += c);
          resp.on('end', () => resolve({ status: resp.statusCode, body: d }));
        });
        r.on('error', reject);
        r.setTimeout(8000, () => { r.destroy(); reject(new Error('Connection timed out after 8s')); });
        r.end();
      });

      if (result.status === 200) {
        // Also grab version info
        const verResult = await new Promise((resolve, reject) => {
          const vOpts = { ...testOpts, path: '/version' };
          const r = http.request(vOpts, (resp) => {
            let d = '';
            resp.on('data', c => d += c);
            resp.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
          });
          r.on('error', () => resolve({}));
          r.setTimeout(5000, () => { r.destroy(); resolve({}); });
          r.end();
        });

        res.json({
          success: true,
          version: verResult.Version || 'unknown',
          apiVersion: verResult.ApiVersion || 'unknown',
          os: (verResult.Os || '') + '/' + (verResult.Arch || ''),
          kernel: verResult.KernelVersion || ''
        });
      } else {
        res.json({ success: false, error: 'Docker responded with status ' + result.status });
      }
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // ── AI diagnose connection failure ──
  app.post('/api/docker/ai-diagnose', requireRole('editor'), async (req, res) => {
    const { error, type, socketPath, host, port, platform } = req.body;
    const prompt = `A user is trying to connect Bulwark (a server management dashboard) to Docker Engine and getting this error:

Error: ${error}
Connection type: ${type || 'local'}
${type === 'remote' ? 'Remote host: ' + host + ':' + (port || 2375) : 'Socket path: ' + (socketPath || 'default')}
Platform: ${platform || process.platform}

Diagnose the problem and give step-by-step instructions to fix it. Be specific with exact commands the user should run. Keep it concise (5-8 steps max). If it's a remote connection, include how to enable Docker TCP and secure it with TLS. No markdown headers, just numbered steps.`;

    try {
      const diagnosis = await askAI(prompt, { timeout: 25000 });
      res.json({ diagnosis: diagnosis || 'Unable to diagnose. Check that Docker is installed and running.' });
    } catch (e) {
      res.json({ diagnosis: 'AI diagnosis unavailable. Common fixes:\n1. Install Docker: curl -fsSL https://get.docker.com | sh\n2. Start Docker: sudo systemctl start docker\n3. Add your user to docker group: sudo usermod -aG docker $USER\n4. For remote: enable TCP with dockerd -H tcp://0.0.0.0:2375' });
    }
  });

  // Health check — is Docker available?
  app.get('/api/docker/status', requireAdmin, async (req, res) => {
    try {
      const active = docker.getActiveConnection();
      const available = active ? await docker.isAvailable() : false;
      res.json({ available, config: docker.loadConfig(), activeConnection: active, serverPlatform: process.platform });
    } catch (e) {
      res.json({ available: false, error: e.message });
    }
  });

  // ── Multi-Connection Management ──

  // List all saved connections
  app.get('/api/docker/connections', requireAdmin, (req, res) => {
    res.json({ connections: docker.loadConnections(), serverPlatform: process.platform });
  });

  // Add a new connection
  app.post('/api/docker/connections', requireRole('editor'), (req, res) => {
    try {
      const { name, type, socketPath, host, port } = req.body;
      const conns = docker.loadConnections();
      // Deactivate all existing
      conns.forEach(c => { c.active = false; });
      const conn = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name || (host ? 'Remote ' + host : 'Local Docker'),
        type: type || (host ? 'remote' : 'local'),
        socketPath: type === 'local' ? (socketPath || null) : null,
        host: type === 'remote' ? (host || null) : null,
        port: type === 'remote' ? (port || 2375) : null,
        active: true,
        added: new Date().toISOString()
      };
      conns.push(conn);
      docker.saveConnections(conns);
      res.json({ success: true, connection: conn, connections: conns });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Activate a connection (switch to it)
  app.post('/api/docker/connections/:id/activate', requireRole('editor'), (req, res) => {
    try {
      const conns = docker.loadConnections();
      const target = conns.find(c => c.id === req.params.id);
      if (!target) return res.status(404).json({ error: 'Connection not found' });
      conns.forEach(c => { c.active = (c.id === req.params.id); });
      docker.saveConnections(conns);
      res.json({ success: true, connections: conns });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove a connection
  app.delete('/api/docker/connections/:id', requireRole('editor'), (req, res) => {
    try {
      let conns = docker.loadConnections();
      const removed = conns.find(c => c.id === req.params.id);
      conns = conns.filter(c => c.id !== req.params.id);
      // If we removed the active one, activate the first remaining
      if (removed && removed.active && conns.length > 0) {
        conns[0].active = true;
      }
      docker.saveConnections(conns);
      res.json({ success: true, connections: conns });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Legacy save config (adds connection)
  app.post('/api/docker/config', requireRole('editor'), (req, res) => {
    try {
      docker.saveConfig(req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Legacy delete config (removes active connection)
  app.delete('/api/docker/config', requireRole('editor'), (req, res) => {
    try {
      const conns = docker.loadConnections();
      const filtered = conns.filter(c => !c.active);
      if (filtered.length > 0) filtered[0].active = true;
      docker.saveConnections(filtered);
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
  app.post('/api/docker/containers/:id/:action', requireRole('editor'), async (req, res) => {
    const allowed = ['start', 'stop', 'restart', 'pause', 'unpause', 'kill'];
    if (!allowed.includes(req.params.action)) return res.status(400).json({ error: 'Invalid action' });
    try {
      const result = await docker.containerAction(req.params.id, req.params.action);
      res.json({ success: result.status >= 200 && result.status < 400, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove container (admin only — destructive)
  app.delete('/api/docker/containers/:id', requireRole('admin'), async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await docker.removeContainer(req.params.id, force);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Deploy new container
  app.post('/api/docker/deploy', requireRole('editor'), async (req, res) => {
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
  app.post('/api/docker/images/pull', requireRole('editor'), async (req, res) => {
    try {
      const { name, tag } = req.body;
      if (!name) return res.status(400).json({ error: 'Image name required' });
      const result = await docker.pullImage(name, tag);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove image (admin only — destructive)
  app.delete('/api/docker/images/:id', requireRole('admin'), async (req, res) => {
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

  // Full system prune (admin only — destructive)
  app.post('/api/docker/system/prune', requireRole('admin'), async (req, res) => {
    try {
      const includeVolumes = req.body.includeVolumes === true;
      const result = await docker.systemPrune(includeVolumes);
      res.json({ success: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Individual prune operations
  app.post('/api/docker/prune/containers', requireRole('admin'), async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneContainers()) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/docker/prune/images', requireRole('admin'), async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneImages(req.body.dangling !== false)) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/docker/prune/volumes', requireRole('admin'), async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneVolumes()) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/docker/prune/networks', requireRole('admin'), async (req, res) => {
    try { res.json({ success: true, ...(await docker.pruneNetworks()) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/docker/prune/buildcache', requireRole('admin'), async (req, res) => {
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
  app.post('/api/docker/containers/:id/rename', requireRole('editor'), async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name required' });
      const ok = await docker.renameContainer(req.params.id, name);
      res.json({ success: ok });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Bulwark AI — conversational Docker assistant
  app.post('/api/docker/assistant', requireRole('editor'), async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Prompt required' });

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ response: cached.response, cached: true });

      const { askAI } = require('../lib/ai');
      const response = await askAI(prompt, { timeout: 30000 }) || 'Analysis unavailable';
      neuralCache.semanticSet(prompt, response);
      res.json({ response, cached: false });
    } catch (e) {
      res.json({ response: 'Bulwark is temporarily unavailable: ' + e.message, fallback: true });
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

      const { askAI } = require('../lib/ai');
      const analysis = await askAI(prompt, { timeout: 20000 }) || 'Analysis unavailable';
      neuralCache.semanticSet(prompt, analysis);
      res.json({ analysis, cached: false });
    } catch (e) {
      res.json({ analysis: 'Docker analysis unavailable: ' + e.message, fallback: true });
    }
  });
};
