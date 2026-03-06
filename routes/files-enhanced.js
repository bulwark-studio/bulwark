/**
 * Files Enhanced Routes — AI file analysis, search, stats, git-aware browsing
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

module.exports = function (app, ctx) {
  const { requireAdmin, execCommand, REPO_DIR } = ctx;

  // File search (name-based + content grep)
  app.get('/api/files/search', requireAdmin, async (req, res) => {
    try {
      const q = req.query.q;
      const mode = req.query.mode || 'name'; // name | content
      if (!q) return res.json({ results: [] });

      let results = [];
      if (mode === 'content') {
        const r = await execCommand(`git grep -n -I --max-count=5 "${q.replace(/"/g, '\\"')}" -- ":(exclude).git"`, { cwd: REPO_DIR, timeout: 10000 });
        results = r.stdout.trim().split('\n').filter(Boolean).slice(0, 50).map(line => {
          const idx = line.indexOf(':');
          const idx2 = line.indexOf(':', idx + 1);
          return { file: line.slice(0, idx), line: parseInt(line.slice(idx + 1, idx2)) || 0, match: line.slice(idx2 + 1).trim() };
        });
      } else {
        const r = await execCommand(`git ls-files | grep -i "${q.replace(/"/g, '\\"')}"`, { cwd: REPO_DIR, timeout: 5000 });
        results = r.stdout.trim().split('\n').filter(Boolean).slice(0, 50).map(f => ({ file: f, line: 0, match: '' }));
      }
      res.json({ results });
    } catch (e) { res.json({ results: [], error: e.message }); }
  });

  // File stats — size by type, total counts
  app.get('/api/files/stats', requireAdmin, async (req, res) => {
    try {
      const [files, size] = await Promise.all([
        execCommand('git ls-files', { cwd: REPO_DIR, timeout: 10000 }),
        execCommand('du -sh .', { cwd: REPO_DIR, timeout: 5000 }),
      ]);

      const fileList = files.stdout.trim().split('\n').filter(Boolean);
      const byExt = {};
      const byDir = {};
      let totalSize = 0;

      for (const f of fileList) {
        const ext = path.extname(f).toLowerCase() || '(none)';
        byExt[ext] = (byExt[ext] || 0) + 1;
        const dir = f.split('/')[0] || '.';
        byDir[dir] = (byDir[dir] || 0) + 1;
        try {
          const full = path.join(REPO_DIR, f);
          const stat = fs.statSync(full);
          totalSize += stat.size;
        } catch {}
      }

      // Sort by count
      const extensions = Object.entries(byExt).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([ext, count]) => ({ ext, count }));
      const directories = Object.entries(byDir).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([dir, count]) => ({ dir, count }));

      res.json({
        totalFiles: fileList.length,
        totalSize,
        repoSize: size.stdout.trim().split('\t')[0],
        extensions,
        directories,
      });
    } catch (e) { res.json({ totalFiles: 0, extensions: [], directories: [], error: e.message }); }
  });

  // Git-aware file info (last commit, author for a file)
  app.get('/api/files/git-info', requireAdmin, async (req, res) => {
    try {
      const filePath = req.query.path;
      if (!filePath) return res.json({ error: 'path required' });

      const [log, blame] = await Promise.all([
        execCommand(`git log --format="%H|||%an|||%aI|||%s" -5 -- "${filePath.replace(/"/g, '\\"')}"`, { cwd: REPO_DIR, timeout: 5000 }),
        execCommand(`git log --format="%an" -1 -- "${filePath.replace(/"/g, '\\"')}"`, { cwd: REPO_DIR, timeout: 3000 }),
      ]);

      const commits = log.stdout.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, date, message] = line.split('|||');
        return { hash: hash?.slice(0, 7), author, date, message };
      });

      res.json({ file: filePath, lastAuthor: blame.stdout.trim(), commits });
    } catch (e) { res.json({ commits: [], error: e.message }); }
  });

  // Recently modified files
  app.get('/api/files/recent', requireAdmin, async (req, res) => {
    try {
      const r = await execCommand('git log --name-only --format="" -10 | sort -u | head -30', { cwd: REPO_DIR, timeout: 5000 });
      const files = r.stdout.trim().split('\n').filter(Boolean);
      res.json({ files });
    } catch (e) { res.json({ files: [] }); }
  });

  // Large files
  app.get('/api/files/large', requireAdmin, async (req, res) => {
    try {
      const r = await execCommand('git ls-files -z | xargs -0 ls -la 2>/dev/null | sort -k5 -n -r | head -20', { cwd: REPO_DIR, timeout: 10000 });
      const files = r.stdout.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) return null;
        return { size: parseInt(parts[4]) || 0, name: parts.slice(8).join(' ') };
      }).filter(Boolean);
      res.json({ files });
    } catch (e) { res.json({ files: [] }); }
  });

  // AI: Summarize file
  app.post('/api/files/ai-summarize', requireAdmin, async (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) return res.status(400).json({ error: 'filePath required' });

      const resolved = path.resolve(REPO_DIR, filePath);
      if (!resolved.startsWith(path.resolve(REPO_DIR))) return res.status(403).json({ error: 'Access denied' });

      const content = fs.readFileSync(resolved, 'utf8').substring(0, 4000);
      const prompt = `Summarize this file in 2-3 sentences. What does it do, key exports/functions, and any notable patterns. No markdown.\n\nFile: ${filePath}\n\n${content}`;

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ summary: cached.response, cached: true });

      const cleanEnv = { ...process.env };
      delete cleanEnv.CLAUDECODE;
      const result = await new Promise((resolve, reject) => {
        const child = spawn('claude', ['--print'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, timeout: 20000, env: cleanEnv });
        let stdout = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', () => {});
        child.on('close', () => resolve(stdout));
        child.on('error', reject);
        child.stdin.on('error', () => {});
        child.stdin.write(prompt);
        child.stdin.end();
      });

      const summary = result.trim() || 'Summary unavailable.';
      neuralCache.semanticSet(prompt, summary);
      res.json({ summary, cached: false });
    } catch (e) { res.json({ summary: 'Summary unavailable: ' + e.message }); }
  });

  // AI: Analyze project structure
  app.get('/api/files/ai-analysis', requireAdmin, async (req, res) => {
    try {
      const r = await execCommand('git ls-files | head -100', { cwd: REPO_DIR, timeout: 5000 });
      const stats = await execCommand('git ls-files | wc -l', { cwd: REPO_DIR });

      const prompt = `Analyze this project's file structure in 4-5 sentences. Comment on: organization quality, naming conventions, potential improvements, notable patterns. No markdown.\n\nTotal files: ${stats.stdout.trim()}\nSample files:\n${r.stdout}`;

      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ analysis: cached.response, cached: true });

      const cleanEnv = { ...process.env };
      delete cleanEnv.CLAUDECODE;
      const result = await new Promise((resolve, reject) => {
        const child = spawn('claude', ['--print'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, timeout: 20000, env: cleanEnv });
        let stdout = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', () => {});
        child.on('close', () => resolve(stdout));
        child.on('error', reject);
        child.stdin.on('error', () => {});
        child.stdin.write(prompt);
        child.stdin.end();
      });

      const analysis = result.trim() || 'Analysis unavailable.';
      neuralCache.semanticSet(prompt, analysis);
      res.json({ analysis, cached: false });
    } catch (e) { res.json({ analysis: 'Analysis unavailable: ' + e.message }); }
  });
};
