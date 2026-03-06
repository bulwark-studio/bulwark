/**
 * Git Enhanced Routes — Rich git data for Git Intelligence Center
 */
const { askAI } = require('../lib/ai');

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole, execCommand, REPO_DIR } = ctx;
  // Dynamic cwd: use active git project if set, else fall back to static REPO_DIR
  function getCwd() { return (ctx.getGitCwd && ctx.getGitCwd()) || REPO_DIR; }
  function getEnv() { return (ctx.getGitEnv && ctx.getGitEnv()) || process.env; }
  // Legacy compat: `cwd` used throughout — override getter
  const cwd = null; // force use of getCwd()

  // Rich commit log with stats
  app.get('/api/git/log', requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const r = await execCommand(
        `git log --format="%H|||%an|||%ae|||%aI|||%s" -${limit} --shortstat`,
        { cwd: getCwd(), timeout: 10000 }
      );
      const lines = r.stdout.trim().split('\n');
      const commits = [];
      let current = null;
      for (const line of lines) {
        if (line.includes('|||')) {
          const [hash, author, email, date, message] = line.split('|||');
          current = { hash, shortHash: hash.slice(0, 7), author, email, date, message, files: 0, insertions: 0, deletions: 0 };
          commits.push(current);
        } else if (current && line.trim()) {
          const fm = line.match(/(\d+) files? changed/);
          const im = line.match(/(\d+) insertions?/);
          const dm = line.match(/(\d+) deletions?/);
          if (fm) current.files = parseInt(fm[1]);
          if (im) current.insertions = parseInt(im[1]);
          if (dm) current.deletions = parseInt(dm[1]);
        }
      }
      res.json({ commits });
    } catch (e) { res.json({ commits: [], error: e.message }); }
  });

  // Diff — staged + unstaged
  app.get('/api/git/diff', requireAdmin, async (req, res) => {
    try {
      const [staged, unstaged, stagedStat, unstagedStat] = await Promise.all([
        execCommand('git diff --cached', { cwd: getCwd(), timeout: 10000 }),
        execCommand('git diff', { cwd: getCwd(), timeout: 10000 }),
        execCommand('git diff --cached --stat', { cwd: getCwd(), timeout: 10000 }),
        execCommand('git diff --stat', { cwd: getCwd(), timeout: 10000 }),
      ]);
      res.json({
        staged: staged.stdout,
        unstaged: unstaged.stdout,
        stagedStat: stagedStat.stdout,
        unstagedStat: unstagedStat.stdout,
      });
    } catch (e) { res.json({ staged: '', unstaged: '', error: e.message }); }
  });

  // Diff for specific commit
  app.get('/api/git/diff/:hash', requireAdmin, async (req, res) => {
    try {
      const hash = req.params.hash.replace(/[^a-f0-9]/gi, '').slice(0, 40);
      const r = await execCommand(`git show --stat --format="" ${hash}`, { cwd: getCwd(), timeout: 10000 });
      const d = await execCommand(`git show --format="" ${hash}`, { cwd: getCwd(), timeout: 10000 });
      res.json({ stat: r.stdout, diff: d.stdout.substring(0, 50000) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // All branches with details
  app.get('/api/git/branches', requireAdmin, async (req, res) => {
    try {
      const [local, remote, current] = await Promise.all([
        execCommand('git branch --format="%(refname:short)|||%(objectname:short)|||%(committerdate:iso)|||%(subject)"', { cwd: getCwd() }),
        execCommand('git branch -r --format="%(refname:short)|||%(objectname:short)|||%(committerdate:iso)|||%(subject)"', { cwd: getCwd() }),
        execCommand('git branch --show-current', { cwd: getCwd() }),
      ]);
      const parse = (raw, isRemote) => raw.stdout.trim().split('\n').filter(Boolean).map(line => {
        const [name, hash, date, message] = line.split('|||');
        return { name, hash, date, message, remote: isRemote };
      });
      res.json({
        current: current.stdout.trim(),
        local: parse(local, false),
        remote: parse(remote, true),
      });
    } catch (e) { res.json({ current: '', local: [], remote: [], error: e.message }); }
  });

  // Stash operations
  app.get('/api/git/stash', requireAdmin, async (req, res) => {
    try {
      const r = await execCommand('git stash list --format="%gd|||%s|||%aI"', { cwd: getCwd() });
      const stashes = r.stdout.trim().split('\n').filter(Boolean).map(line => {
        const [ref, message, date] = line.split('|||');
        return { ref, message, date };
      });
      res.json({ stashes });
    } catch (e) { res.json({ stashes: [] }); }
  });

  app.post('/api/git/stash', requireRole('editor'), async (req, res) => {
    try {
      const msg = (req.body.message || 'Quick stash').replace(/"/g, '\\"');
      const r = await execCommand(`git stash push -m "${msg}"`, { cwd: getCwd(), timeout: 10000 });
      res.json({ success: true, output: r.stdout });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/git/stash/pop', requireRole('editor'), async (req, res) => {
    try {
      const r = await execCommand('git stash pop', { cwd: getCwd(), timeout: 10000 });
      res.json({ success: true, output: r.stdout });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Commit with message
  app.post('/api/git/commit', requireRole('editor'), async (req, res) => {
    try {
      const { message, addAll } = req.body;
      if (!message) return res.status(400).json({ error: 'Commit message required' });
      if (addAll) await execCommand('git add -A', { cwd: getCwd() });
      const safeMsg = message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      const r = await execCommand(`git commit -m "${safeMsg}"`, { cwd: getCwd(), timeout: 15000 });
      res.json({ success: true, output: r.stdout });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Contributors
  app.get('/api/git/contributors', requireAdmin, async (req, res) => {
    try {
      const r = await execCommand('git shortlog -sne --all', { cwd: getCwd(), timeout: 10000 });
      const contributors = r.stdout.trim().split('\n').filter(Boolean).map(line => {
        const m = line.trim().match(/^\s*(\d+)\s+(.+?)\s+<(.+?)>$/);
        return m ? { commits: parseInt(m[1]), name: m[2], email: m[3] } : null;
      }).filter(Boolean);
      res.json({ contributors });
    } catch (e) { res.json({ contributors: [] }); }
  });

  // Repo stats
  app.get('/api/git/repo-stats', requireAdmin, async (req, res) => {
    try {
      const [totalCommits, firstCommit, fileCount, repoSize] = await Promise.all([
        execCommand('git rev-list --count HEAD', { cwd: getCwd() }),
        execCommand('git log --reverse --format="%aI" -1', { cwd: getCwd() }),
        execCommand('git ls-files | wc -l', { cwd: getCwd() }),
        execCommand('git count-objects -vH', { cwd: getCwd() }),
      ]);
      // Parse size
      const sizeMatch = repoSize.stdout.match(/size-pack:\s*(.+)/);
      res.json({
        totalCommits: parseInt(totalCommits.stdout.trim()) || 0,
        firstCommit: firstCommit.stdout.trim(),
        fileCount: parseInt(fileCount.stdout.trim()) || 0,
        repoSize: sizeMatch ? sizeMatch[1].trim() : 'unknown',
      });
    } catch (e) { res.json({ totalCommits: 0, fileCount: 0, error: e.message }); }
  });

  // Heatmap data — commits per day for last year
  app.get('/api/git/heatmap', requireAdmin, async (req, res) => {
    try {
      const r = await execCommand('git log --format="%aI" --since="1 year ago"', { cwd: getCwd(), timeout: 10000 });
      const days = {};
      r.stdout.trim().split('\n').filter(Boolean).forEach(d => {
        const day = d.substring(0, 10);
        days[day] = (days[day] || 0) + 1;
      });
      res.json({ heatmap: days });
    } catch (e) { res.json({ heatmap: {} }); }
  });

  // AI: generate commit message from staged diff
  app.post('/api/git/ai-commit-msg', requireRole('editor'), async (req, res) => {
    try {
      const diff = await execCommand('git diff --cached --stat', { cwd: getCwd(), timeout: 5000 });
      const fullDiff = await execCommand('git diff --cached', { cwd: getCwd(), timeout: 5000 });
      if (!diff.stdout.trim()) return res.json({ message: '', error: 'No staged changes' });

      const prompt = `Generate a concise git commit message for these changes. Use conventional commit format (feat/fix/refactor/docs/chore). One line, max 72 chars. No quotes around it.\n\nFiles changed:\n${diff.stdout}\n\nDiff (first 3000 chars):\n${fullDiff.stdout.substring(0, 3000)}`;

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ message: cached.response, cached: true });

      const raw = await askAI(prompt, { timeout: 20000 });
      const message = (raw || '').replace(/^["']|["']$/g, '').trim() || 'chore: update files';
      neuralCache.semanticSet(prompt, message);
      res.json({ message, cached: false });
    } catch (e) { res.json({ message: 'chore: update', error: e.message }); }
  });

  // AI: review staged changes
  app.post('/api/git/ai-review', requireRole('editor'), async (req, res) => {
    try {
      const diff = await execCommand('git diff --cached', { cwd: getCwd(), timeout: 5000 });
      if (!diff.stdout.trim()) return res.json({ review: 'No staged changes to review.' });

      const prompt = `Review this git diff for a code review. Be concise (4-6 sentences). Check for: bugs, security issues (XSS, injection, hardcoded secrets), performance concerns, and code quality. Mention specific file names and line patterns. No markdown.\n\n${diff.stdout.substring(0, 5000)}`;

      const review = await askAI(prompt, { timeout: 25000 }) || 'Review unavailable.';
      res.json({ review });
    } catch (e) { res.json({ review: 'Review unavailable: ' + e.message }); }
  });

  // AI: repo analysis
  app.get('/api/git/ai-analysis', requireAdmin, async (req, res) => {
    try {
      const [stats, recent, branches] = await Promise.all([
        execCommand('git rev-list --count HEAD', { cwd: getCwd() }),
        execCommand('git log --oneline -10', { cwd: getCwd() }),
        execCommand('git branch -a', { cwd: getCwd() }),
      ]);

      const prompt = `Analyze this git repository. Be concise (4-5 sentences). Total commits: ${stats.stdout.trim()}. Branches: ${branches.stdout.trim()}. Recent commits:\n${recent.stdout}\nComment on: commit patterns, branch hygiene, areas of activity, recommendations. No markdown.`;

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ analysis: cached.response, cached: true });

      const analysis = await askAI(prompt, { timeout: 20000 }) || 'Analysis unavailable.';
      neuralCache.semanticSet(prompt, analysis);
      res.json({ analysis, cached: false });
    } catch (e) { res.json({ analysis: 'Analysis unavailable: ' + e.message }); }
  });

  // AI: branch cleanup analysis
  app.get('/api/git/ai-branch-cleanup', requireAdmin, async (req, res) => {
    try {
      const [local, remote, current] = await Promise.all([
        execCommand('git branch --format="%(refname:short) %(committerdate:iso) %(subject)"', { cwd: getCwd() }),
        execCommand('git branch -r --format="%(refname:short) %(committerdate:iso) %(subject)"', { cwd: getCwd() }),
        execCommand('git branch --show-current', { cwd: getCwd() }),
      ]);
      const prompt = `Analyze these git branches for cleanup. Current branch: ${current.stdout.trim()}.

Local branches:
${local.stdout}

Remote branches:
${remote.stdout}

Return JSON with:
- "stale": array of branch names that look stale (no recent activity, already merged, etc.)
- "merged": array of branches that appear to be merged (based on commit messages like "merge", "deployed", etc.)
- "active": array of branches with recent activity
- "recommendations": array of 2-3 cleanup suggestions (strings)
- "summary": one-sentence summary

Return ONLY the JSON object, no markdown.`;

      const { askAIJSON } = require('../lib/ai');
      const result = await askAIJSON(prompt, { timeout: 30000 });
      res.json(result.error ? { stale: [], merged: [], active: [], recommendations: [], summary: result.error } : result);
    } catch (e) { res.json({ stale: [], merged: [], active: [], recommendations: [], summary: 'Analysis unavailable: ' + e.message }); }
  });

  // AI: generate PR description from branch diff
  app.post('/api/git/ai-pr-description', requireRole('editor'), async (req, res) => {
    try {
      const base = (req.body.base || 'main').replace(/[^a-zA-Z0-9/_.-]/g, '');
      const current = (await execCommand('git branch --show-current', { cwd: getCwd() })).stdout.trim();
      const [diffStat, log] = await Promise.all([
        execCommand(`git diff ${base}...HEAD --stat`, { cwd: getCwd(), timeout: 10000 }),
        execCommand(`git log ${base}...HEAD --oneline`, { cwd: getCwd(), timeout: 10000 }),
      ]);
      if (!log.stdout.trim()) return res.json({ title: '', body: '', error: 'No commits ahead of ' + base });

      const prompt = `Generate a GitHub Pull Request title and description for merging branch "${current}" into "${base}".

Commits:
${log.stdout}

Files changed:
${diffStat.stdout.substring(0, 3000)}

Return JSON with:
- "title": PR title (under 70 chars, conventional format)
- "summary": 2-3 bullet points summarizing what changed
- "test_plan": 2-3 bullet points for testing the changes
- "breaking": true/false if there are breaking changes
- "labels": array of suggested labels (e.g. "bug", "feature", "refactor")

Return ONLY the JSON object, no markdown.`;

      const { askAIJSON } = require('../lib/ai');
      const result = await askAIJSON(prompt, { timeout: 30000 });
      res.json(result.error ? { title: '', body: '', error: result.error } : result);
    } catch (e) { res.json({ title: '', body: '', error: e.message }); }
  });

  // AI: analyze merge conflicts
  app.post('/api/git/ai-conflict-help', requireRole('editor'), async (req, res) => {
    try {
      const status = await execCommand('git status --short', { cwd: getCwd(), timeout: 5000 });
      const conflicted = status.stdout.split('\n').filter(l => l.startsWith('UU') || l.startsWith('AA') || l.startsWith('DD'));
      if (!conflicted.length) return res.json({ conflicts: [], resolution: 'No merge conflicts detected.' });

      const files = conflicted.map(l => l.slice(3).trim());
      let conflictContent = '';
      for (const f of files.slice(0, 5)) {
        try {
          const content = await execCommand(`git diff ${f.replace(/"/g, '\\"')}`, { cwd: getCwd(), timeout: 5000 });
          conflictContent += `\n--- ${f} ---\n${content.stdout.substring(0, 2000)}\n`;
        } catch {}
      }

      const prompt = `Analyze these git merge conflicts and suggest resolutions. Be specific about what to keep/remove.

Conflicted files: ${files.join(', ')}

Conflict diffs:
${conflictContent.substring(0, 5000)}

Return JSON with:
- "conflicts": array of objects with "file" (string), "description" (what the conflict is about), "suggestion" (how to resolve it)
- "resolution": overall strategy recommendation (1-2 sentences)
- "risk": "low" | "medium" | "high"

Return ONLY the JSON object, no markdown.`;

      const { askAIJSON } = require('../lib/ai');
      const result = await askAIJSON(prompt, { timeout: 30000 });
      res.json(result.error ? { conflicts: [], resolution: result.error, risk: 'unknown' } : result);
    } catch (e) { res.json({ conflicts: [], resolution: 'Analysis unavailable: ' + e.message }); }
  });
};
