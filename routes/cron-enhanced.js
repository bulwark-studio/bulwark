/**
 * Cron Enhanced Routes — Local cron manager with AI, analytics, natural language
 * Data stored in data/cron-jobs.json (works without adapter)
 */
const fs = require('fs');
const path = require('path');
const { askAI } = require('../lib/ai');
const crypto = require('crypto');

const DATA = path.join(__dirname, '..', 'data');
const JOBS_PATH = path.join(DATA, 'cron-jobs.json');
const RUNS_PATH = path.join(DATA, 'cron-runs.json');

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// Parse cron expression to human-readable
function cronToHuman(expr) {
  if (!expr) return 'Unknown';
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hr, dom, mon, dow] = parts;
  const days = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat' };
  const months = { '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr', '5': 'May', '6': 'Jun', '7': 'Jul', '8': 'Aug', '9': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' };

  if (expr === '* * * * *') return 'Every minute';
  if (min !== '*' && hr !== '*' && dom === '*' && mon === '*' && dow === '*')
    return `Daily at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (min !== '*' && hr !== '*' && dom === '*' && mon === '*' && dow !== '*') {
    const dayNames = dow.split(',').map(d => days[d] || d).join(', ');
    return `${dayNames} at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  if (min === '0' && hr === '*' && dom === '*') return 'Every hour';
  if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`;
  if (hr.startsWith('*/')) return `Every ${hr.slice(2)} hours`;
  return expr;
}

// Calculate next run from cron expression (simplified)
function nextRun(expr) {
  if (!expr) return null;
  const now = new Date();
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [minP, hrP] = parts;
  const next = new Date(now);
  if (minP !== '*' && hrP !== '*') {
    next.setHours(parseInt(hrP), parseInt(minP), 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (minP.startsWith('*/')) {
    const interval = parseInt(minP.slice(2)) || 5;
    const nextMin = Math.ceil((now.getMinutes() + 1) / interval) * interval;
    next.setMinutes(nextMin, 0, 0);
    if (next <= now) next.setMinutes(next.getMinutes() + interval);
  } else {
    next.setMinutes(now.getMinutes() + 1, 0, 0);
  }
  return next.toISOString();
}

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole, execCommand, REPO_DIR } = ctx;

  // List all jobs
  app.get('/api/cron/jobs', requireAdmin, (req, res) => {
    const jobs = readJSON(JOBS_PATH, []);
    const runs = readJSON(RUNS_PATH, []);
    const enriched = jobs.map(j => {
      const jobRuns = runs.filter(r => r.jobId === j.id);
      const lastRun = jobRuns.length ? jobRuns[jobRuns.length - 1] : null;
      const successCount = jobRuns.filter(r => r.status === 'success').length;
      const failCount = jobRuns.filter(r => r.status === 'failed').length;
      const avgDuration = jobRuns.length ? Math.round(jobRuns.reduce((s, r) => s + (r.duration || 0), 0) / jobRuns.length) : 0;
      return {
        ...j,
        human: cronToHuman(j.schedule),
        nextRun: j.enabled !== false ? nextRun(j.schedule) : null,
        lastRun: lastRun?.finishedAt || null,
        lastStatus: lastRun?.status || null,
        stats: { total: jobRuns.length, success: successCount, fail: failCount, avgDuration },
      };
    });
    res.json({ jobs: enriched });
  });

  // Create/update job
  app.post('/api/cron/jobs', requireRole('editor'), (req, res) => {
    const jobs = readJSON(JOBS_PATH, []);
    const { id, name, schedule, command, description, category, tags } = req.body;
    if (!schedule || !command) return res.status(400).json({ error: 'schedule and command required' });

    const job = {
      id: id || crypto.randomUUID(),
      name: name || command.split(' ')[0],
      schedule,
      command,
      description: description || '',
      category: category || 'general',
      tags: tags || [],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const idx = jobs.findIndex(j => j.id === job.id);
    if (idx >= 0) { Object.assign(jobs[idx], job, { createdAt: jobs[idx].createdAt }); }
    else jobs.push(job);

    writeJSON(JOBS_PATH, jobs);
    res.json({ success: true, id: job.id, human: cronToHuman(schedule) });
  });

  // Toggle job
  app.post('/api/cron/jobs/:id/toggle', requireRole('editor'), (req, res) => {
    const jobs = readJSON(JOBS_PATH, []);
    const job = jobs.find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    job.enabled = !job.enabled;
    job.updatedAt = new Date().toISOString();
    writeJSON(JOBS_PATH, jobs);
    res.json({ success: true, enabled: job.enabled });
  });

  // Delete job
  app.delete('/api/cron/jobs/:id', requireRole('editor'), (req, res) => {
    let jobs = readJSON(JOBS_PATH, []);
    const before = jobs.length;
    jobs = jobs.filter(j => j.id !== req.params.id);
    writeJSON(JOBS_PATH, jobs);
    res.json({ success: jobs.length < before });
  });

  // Run job manually
  app.post('/api/cron/jobs/:id/run', requireRole('editor'), async (req, res) => {
    const jobs = readJSON(JOBS_PATH, []);
    const job = jobs.find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const run = { id: crypto.randomUUID(), jobId: job.id, jobName: job.name, startedAt: new Date().toISOString(), status: 'running', output: '', duration: 0 };
    try {
      const start = Date.now();
      const result = await execCommand(job.command, { cwd: REPO_DIR, timeout: 60000 });
      run.output = (result.stdout + '\n' + result.stderr).trim();
      run.status = 'success';
      run.duration = Date.now() - start;
    } catch (e) {
      run.output = e.message;
      run.status = 'failed';
      run.duration = 0;
    }
    run.finishedAt = new Date().toISOString();

    const runs = readJSON(RUNS_PATH, []);
    runs.push(run);
    if (runs.length > 500) runs.splice(0, runs.length - 500);
    writeJSON(RUNS_PATH, runs);

    res.json(run);
  });

  // Run history
  app.get('/api/cron/history', requireAdmin, (req, res) => {
    const runs = readJSON(RUNS_PATH, []);
    const jobId = req.query.jobId;
    const filtered = jobId ? runs.filter(r => r.jobId === jobId) : runs;
    res.json({ runs: filtered.slice(-100).reverse() });
  });

  // Analytics
  app.get('/api/cron/analytics', requireAdmin, (req, res) => {
    const jobs = readJSON(JOBS_PATH, []);
    const runs = readJSON(RUNS_PATH, []);
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(j => j.enabled !== false).length;
    const totalRuns = runs.length;
    const successRuns = runs.filter(r => r.status === 'success').length;
    const failedRuns = runs.filter(r => r.status === 'failed').length;
    const successRate = totalRuns ? Math.round((successRuns / totalRuns) * 100) : 100;

    // Runs per day (last 7 days)
    const daily = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      daily[d] = { success: 0, failed: 0 };
    }
    runs.forEach(r => {
      const d = (r.finishedAt || r.startedAt || '').slice(0, 10);
      if (daily[d]) { daily[d][r.status === 'success' ? 'success' : 'failed']++; }
    });

    // Categories
    const categories = {};
    jobs.forEach(j => { categories[j.category || 'general'] = (categories[j.category || 'general'] || 0) + 1; });

    res.json({ totalJobs, activeJobs, totalRuns, successRuns, failedRuns, successRate, daily, categories });
  });

  // AI: Natural language to cron
  app.post('/api/cron/ai-parse', requireRole('editor'), async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: 'text required' });

      const prompt = `Convert this natural language schedule to a cron expression. Return ONLY the cron expression (5 fields: min hour day month weekday), nothing else. No explanation.\n\n"${text}"`;

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ schedule: cached.response.trim(), cached: true });

      const result = await askAI(prompt, { timeout: 15000 });

      const schedule = result.trim().split('\n')[0].replace(/[`"']/g, '').trim();
      if (/^[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+$/.test(schedule)) {
        neuralCache.semanticSet(prompt, schedule);
        res.json({ schedule, human: cronToHuman(schedule), cached: false });
      } else {
        res.json({ schedule: null, error: 'Could not parse: ' + schedule });
      }
    } catch (e) { res.json({ schedule: null, error: e.message }); }
  });

  // AI: Analyze cron health
  app.get('/api/cron/ai-analysis', requireAdmin, async (req, res) => {
    try {
      const jobs = readJSON(JOBS_PATH, []);
      const runs = readJSON(RUNS_PATH, []);
      const recentFails = runs.filter(r => r.status === 'failed').slice(-10);

      const prompt = `Analyze these cron jobs for a server. Be concise (4-5 sentences). Comment on: schedule conflicts, failure patterns, optimization opportunities, missing monitoring. No markdown.\n\nJobs (${jobs.length} total):\n${jobs.map(j => `${j.schedule} | ${j.command} | ${j.enabled ? 'active' : 'paused'}`).join('\n')}\n\nRecent failures: ${recentFails.length ? recentFails.map(r => r.jobName + ': ' + (r.output || '').slice(0, 100)).join('; ') : 'None'}`;

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ analysis: cached.response, cached: true });

      const result = await askAI(prompt, { timeout: 20000 });

      const analysis = result.trim() || 'Analysis unavailable.';
      neuralCache.semanticSet(prompt, analysis);
      res.json({ analysis, cached: false });
    } catch (e) { res.json({ analysis: 'Analysis unavailable: ' + e.message }); }
  });
};
