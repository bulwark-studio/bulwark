/**
 * Flow Routes — DAG orchestration system
 * Endpoints for flow CRUD, execution, templates, and run history
 */

module.exports = function(app, ctx) {
  var requireAuth = ctx.requireAuth;

  // Lazy-load modules
  var store = null;
  function getStore() {
    if (!store) store = require('../lib/flows/store');
    return store;
  }

  var executor = null;
  function getExecutor() {
    if (!executor) executor = require('../lib/flows/executor');
    return executor;
  }

  var templates = null;
  function getTemplates() {
    if (!templates) templates = require('../lib/flows/templates');
    return templates;
  }

  // ── List All Flows ────────────────────────────────────────────────
  app.get('/api/flows', requireAuth, function(req, res) {
    try {
      var flows = getStore().getFlows();
      var category = req.query.category;
      var status = req.query.status;

      if (category) flows = flows.filter(function(f) { return f.category === category; });
      if (status) flows = flows.filter(function(f) { return f.status === status; });

      // Return summary (no full nodes/edges in list)
      var summary = flows.map(function(f) {
        return {
          id: f.id,
          name: f.name,
          slug: f.slug,
          description: f.description,
          category: f.category,
          status: f.status,
          trigger_type: f.trigger_type,
          node_count: f.nodes ? f.nodes.length : 0,
          edge_count: f.edges ? f.edges.length : 0,
          run_count: f.run_count || 0,
          version: f.version,
          error_strategy: f.error_strategy,
          created_at: f.created_at,
          updated_at: f.updated_at,
        };
      });

      res.json({ flows: summary });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Flow Stats ────────────────────────────────────────────────────
  app.get('/api/flows/stats', requireAuth, function(req, res) {
    try {
      var flows = getStore().getFlows();
      var runs = getStore().getFlowRuns(null, 1000);

      var total = flows.length;
      var active = flows.filter(function(f) { return f.status === 'active'; }).length;
      var drafts = flows.filter(function(f) { return f.status === 'draft'; }).length;
      var totalRuns = runs.length;
      var completedRuns = runs.filter(function(r) { return r.status === 'completed'; }).length;
      var failedRuns = runs.filter(function(r) { return r.status === 'failed'; }).length;

      res.json({
        total: total,
        active: active,
        drafts: drafts,
        paused: flows.filter(function(f) { return f.status === 'paused'; }).length,
        totalRuns: totalRuns,
        completedRuns: completedRuns,
        failedRuns: failedRuns,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── List Templates ────────────────────────────────────────────────
  app.get('/api/flows/templates', requireAuth, function(req, res) {
    try {
      res.json({ templates: getTemplates().getTemplates() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get Single Run (BEFORE wildcard /:id) ────────────────────────
  app.get('/api/flows/runs/:runId', requireAuth, function(req, res) {
    try {
      var run = getStore().getFlowRun(req.params.runId);
      if (!run) return res.status(404).json({ error: 'Run not found' });
      res.json({ run: run });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get Single Flow (wildcard AFTER static routes) ──────────────
  app.get('/api/flows/:id', requireAuth, function(req, res) {
    try {
      var flow = getStore().getFlow(req.params.id);
      if (!flow) return res.status(404).json({ error: 'Flow not found' });
      res.json({ flow: flow });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create Flow ───────────────────────────────────────────────────
  app.post('/api/flows', requireAuth, function(req, res) {
    try {
      var data = req.body;

      // If creating from template
      if (data.template) {
        var tplData = getTemplates().instantiateTemplate(data.template);
        if (!tplData) return res.status(404).json({ error: 'Template not found: ' + data.template });
        // Merge any overrides
        if (data.name) tplData.name = data.name;
        if (data.description) tplData.description = data.description;
        data = tplData;
      }

      if (!data.name) return res.status(400).json({ error: 'Flow name is required' });

      var flow = getStore().createFlow(data);
      res.json({ flow: flow, created: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Update Flow ───────────────────────────────────────────────────
  app.put('/api/flows/:id', requireAuth, function(req, res) {
    try {
      var flow = getStore().updateFlow(req.params.id, req.body);
      if (!flow) return res.status(404).json({ error: 'Flow not found' });
      res.json({ flow: flow });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Delete Flow ───────────────────────────────────────────────────
  app.delete('/api/flows/:id', requireAuth, function(req, res) {
    try {
      var deleted = getStore().deleteFlow(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Flow not found' });
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Execute Flow ──────────────────────────────────────────────────
  app.post('/api/flows/:id/execute', requireAuth, async function(req, res) {
    try {
      var userId = req.user ? (req.user.username || req.user.user || 'default') : 'default';
      var triggerPayload = req.body.payload || null;

      var flow = getStore().getFlow(req.params.id);
      if (!flow) return res.status(404).json({ error: 'Flow not found' });

      // Respond immediately, executor creates the run record internally
      res.json({ message: 'Flow execution started', flowId: req.params.id });

      // Execute in background (don't await in response handler)
      getExecutor().executeFlow(req.params.id, userId, triggerPayload).catch(function(err) {
        console.error('[Flows] Execution error for flow ' + req.params.id + ':', err.message);
      });
    } catch (err) {
      res.status(500).json({ error: 'Execution error: ' + err.message });
    }
  });

  // ── Clone Flow ────────────────────────────────────────────────────
  app.post('/api/flows/:id/clone', requireAuth, function(req, res) {
    try {
      var source = getStore().getFlow(req.params.id);
      if (!source) return res.status(404).json({ error: 'Flow not found' });

      var cloneData = JSON.parse(JSON.stringify(source));
      delete cloneData.id;
      cloneData.name = (req.body.name || source.name) + ' (clone)';
      cloneData.slug = source.slug + '-clone';
      cloneData.status = 'draft';
      cloneData.run_count = 0;
      cloneData.version = 1;

      var clone = getStore().createFlow(cloneData);
      res.json({ flow: clone, cloned: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Flow Run History ──────────────────────────────────────────────
  app.get('/api/flows/:id/runs', requireAuth, function(req, res) {
    try {
      var limit = parseInt(req.query.limit) || 20;
      var runs = getStore().getFlowRuns(req.params.id, limit);
      res.json({ runs: runs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

};
