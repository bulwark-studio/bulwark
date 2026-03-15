/**
 * Brain Routes — AI-powered DevOps assistant with context-aware KB
 * Endpoints for brain chat, profile management, memory, and KB search
 */

module.exports = function(app, ctx) {
  const { requireAuth } = ctx;

  // Lazy-load brain to avoid slowing server startup
  let brain = null;
  function getBrain() {
    if (!brain) brain = require('../lib/brain');
    return brain;
  }

  let brainProfile = null;
  function getProfile() {
    if (!brainProfile) brainProfile = require('../lib/brain/brain-profile');
    return brainProfile;
  }

  let brainMemory = null;
  function getMemory() {
    if (!brainMemory) brainMemory = require('../lib/brain/memory');
    return brainMemory;
  }

  // ── Brain Chat ────────────────────────────────────────────────
  app.post('/api/brain/chat', requireAuth, async (req, res) => {
    try {
      const { message, sectionContext, conversationHistory } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const userId = req.user?.username || 'default';
      const result = await getBrain().brainChat(message, {
        userId,
        sectionContext,
        conversationHistory: conversationHistory || [],
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Brain error: ' + err.message });
    }
  });

  // ── Brain Stats ───────────────────────────────────────────────
  app.get('/api/brain/stats', requireAuth, (req, res) => {
    try {
      const userId = req.user?.username || 'default';
      const stats = getBrain().getBrainStats(userId);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── KB Search ─────────────────────────────────────────────────
  app.get('/api/brain/kb/search', requireAuth, (req, res) => {
    try {
      const { q, max } = req.query;
      if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
      const results = getBrain().searchKB(q, { maxResults: parseInt(max) || 10 });
      res.json({ results, count: results.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Profile ───────────────────────────────────────────────────
  app.get('/api/brain/profile', requireAuth, (req, res) => {
    try {
      const userId = req.user?.username || 'default';
      const profile = getProfile().getOrCreateProfile(userId);
      const nextQuestion = getProfile().getNextDiscoveryQuestion(profile);
      res.json({
        profile,
        nextQuestion: nextQuestion ? nextQuestion.question : null,
        completion: profile.completion_score,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/brain/profile', requireAuth, (req, res) => {
    try {
      const userId = req.user?.username || 'default';
      const updated = getProfile().updateProfile(userId, req.body);
      res.json({ profile: updated, completion: updated.completion_score });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Memory ────────────────────────────────────────────────────
  app.get('/api/brain/memories', requireAuth, (req, res) => {
    try {
      const userId = req.user?.username || 'default';
      const { type, limit } = req.query;
      const memories = getMemory().getMemories(userId, {
        type: type || undefined,
        limit: parseInt(limit) || 50,
      });
      const stats = getMemory().getMemoryStats(userId);
      res.json({ memories, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/brain/memories/:id', requireAuth, (req, res) => {
    try {
      const userId = req.user?.username || 'default';
      const deleted = getMemory().deleteMemory(userId, req.params.id);
      res.json({ deleted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Provider Status ───────────────────────────────────────────
  app.get('/api/brain/providers', requireAuth, async (req, res) => {
    try {
      const { getProviderStatus, refreshDetection } = require('../lib/ai');
      if (req.query.refresh === 'true') await refreshDetection();
      const status = await getProviderStatus();
      res.json({ providers: status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
