/**
 * Agent Routes — AI-powered DevOps agents
 * Endpoints for agent catalog, execution, custom agents, and run history
 * IMPORTANT: Static routes (stats, runs/history) MUST be before wildcard /:slugOrId
 */

module.exports = function(app, ctx) {
  const { requireAuth } = ctx;

  // Lazy-load agents
  let catalog = null;
  function getCatalog() {
    if (!catalog) catalog = require('../lib/agents/catalog');
    return catalog;
  }

  let executor = null;
  function getExecutor() {
    if (!executor) executor = require('../lib/agents/executor');
    return executor;
  }

  // ── List All Agents ───────────────────────────────────────────
  app.get('/api/agents', requireAuth, (req, res) => {
    try {
      const { category } = req.query;
      let agents = getCatalog().getAllAgents();
      if (category) agents = agents.filter(a => a.category === category);
      res.json({
        agents: agents.map(a => ({
          id: a.id,
          slug: a.slug,
          name: a.name,
          description: a.description,
          category: a.category,
          risk_level: a.risk_level,
          custom: !!a.custom,
        })),
        categories: getCatalog().AGENT_CATEGORIES,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create Custom Agent (POST before wildcards) ───────────────
  app.post('/api/agents', requireAuth, (req, res) => {
    try {
      const { name, description, category, system_prompt, task_prompt, risk_level, config } = req.body;
      if (!name || !system_prompt) {
        return res.status(400).json({ error: 'Name and system_prompt are required' });
      }
      const agent = getCatalog().createCustomAgent({
        name,
        description: description || '',
        category: category || 'devops',
        system_prompt,
        task_prompt: task_prompt || '{{input}}',
        risk_level: risk_level || 'low',
        config,
      });
      res.json({ agent, created: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Agent Stats (BEFORE wildcard) ─────────────────────────────
  app.get('/api/agents/stats', requireAuth, (req, res) => {
    try {
      const agents = getCatalog().getAllAgents();
      const allRuns = getExecutor().getRuns({ limit: 1000 });
      const categories = getCatalog().AGENT_CATEGORIES;

      const byCategory = {};
      categories.forEach(c => { byCategory[c] = 0; });
      agents.forEach(a => { byCategory[a.category] = (byCategory[a.category] || 0) + 1; });

      const oneDayAgo = Date.now() - 86400000;
      const recentActivity = allRuns.filter(r => {
        try { return new Date(r.created_at).getTime() > oneDayAgo; } catch (e) { return false; }
      }).length;

      res.json({ totalAgents: agents.length, totalRuns: allRuns.length, categoryCount: categories.length, byCategory, recentActivity });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Run History (BEFORE wildcard) ─────────────────────────────
  app.get('/api/agents/runs/history', requireAuth, (req, res) => {
    try {
      const { agentId, limit } = req.query;
      const runs = getExecutor().getRuns({
        agentId: agentId || undefined,
        limit: parseInt(limit) || 20,
      });
      res.json({ runs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get Single Run (BEFORE wildcard) ──────────────────────────
  app.get('/api/agents/runs/:runId', requireAuth, (req, res) => {
    try {
      const run = getExecutor().getRun(req.params.runId);
      if (!run) return res.status(404).json({ error: 'Run not found' });
      res.json({ run });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get Single Agent (wildcard AFTER static routes) ───────────
  app.get('/api/agents/:slugOrId', requireAuth, (req, res) => {
    try {
      const agent = getCatalog().getAgent(req.params.slugOrId);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      res.json({ agent });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Execute Agent ─────────────────────────────────────────────
  app.post('/api/agents/:slugOrId/run', requireAuth, async (req, res) => {
    try {
      const { input, preferredProvider, strategy } = req.body;
      if (!input || typeof input !== 'string') {
        return res.status(400).json({ error: 'Input is required' });
      }
      const userId = req.user?.username || 'default';
      const result = await getExecutor().executeAgent(req.params.slugOrId, input, { userId, preferredProvider, strategy });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Agent execution error: ' + err.message });
    }
  });

  // ── Update Custom Agent (PATCH) ──────────────────────────
  app.patch('/api/agents/:id', requireAuth, (req, res) => {
    try {
      const agent = getCatalog().getAgent(req.params.id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      if (!agent.custom) {
        return res.status(400).json({ error: 'Built-in agents cannot be edited. Clone as a custom agent instead.', builtin: true });
      }
      const updated = getCatalog().updateCustomAgent(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Custom agent not found' });
      res.json({ agent: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Delete Custom Agent ───────────────────────────────────────
  app.delete('/api/agents/:id', requireAuth, (req, res) => {
    try {
      const deleted = getCatalog().deleteCustomAgent(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Custom agent not found' });
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
