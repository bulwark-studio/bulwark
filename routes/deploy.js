/**
 * Deploy Pipeline Routes — Environment management, deploy execution, history
 * Data stored in JSON files (no DB needed)
 */
const fs = require('fs');
const path = require('path');
const { askAI } = require('../lib/ai');

const DATA = path.join(__dirname, '..', 'data');
const TARGETS_PATH = path.join(DATA, 'deploy-targets.json');
const HISTORY_PATH = path.join(DATA, 'deploy-history.json');
const PROFILES_PATH = path.join(DATA, 'build-profiles.json');

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8'); }

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole, execCommand, REPO_DIR } = ctx;

  // ── Deploy Targets ──
  app.get('/api/deploy/targets', requireAdmin, (req, res) => {
    res.json({ targets: readJSON(TARGETS_PATH, []) });
  });

  app.post('/api/deploy/targets', requireRole('editor'), (req, res) => {
    const targets = readJSON(TARGETS_PATH, []);
    const { id, name, host, method, branch, credentialId, buildCmd, deployCmd, verifyUrl, preCmd, postCmd } = req.body;
    if (!name || !method) return res.status(400).json({ error: 'name and method required' });

    const target = {
      id: id || require('crypto').randomUUID(),
      name, host: host || null, method, // ssh_git, docker, rsync, custom
      branch: branch || 'main',
      credentialId: credentialId || null,
      buildCmd: buildCmd || null,
      deployCmd: deployCmd || null,
      verifyUrl: verifyUrl || null,
      preCmd: preCmd || null,
      postCmd: postCmd || null,
      createdAt: new Date().toISOString(),
      lastDeploy: null,
      lastStatus: null,
    };

    const idx = targets.findIndex(t => t.id === target.id);
    if (idx >= 0) { Object.assign(targets[idx], target); targets[idx].createdAt = targets[idx].createdAt || target.createdAt; }
    else targets.push(target);

    writeJSON(TARGETS_PATH, targets);
    res.json({ success: true, id: target.id });
  });

  app.delete('/api/deploy/targets/:id', requireAdmin, (req, res) => {
    let targets = readJSON(TARGETS_PATH, []);
    const before = targets.length;
    targets = targets.filter(t => t.id !== req.params.id);
    writeJSON(TARGETS_PATH, targets);
    res.json({ success: targets.length < before });
  });

  // ── Deploy History ──
  app.get('/api/deploy/history', requireAdmin, (req, res) => {
    const history = readJSON(HISTORY_PATH, []);
    res.json({ deploys: history.slice(-50).reverse() });
  });

  // ── Pre-flight Checks ──
  app.get('/api/deploy/preflight', requireAdmin, async (req, res) => {
    try {
      const checks = [];
      // Git clean?
      const status = await execCommand('git status --porcelain', { cwd: REPO_DIR, timeout: 5000 });
      const clean = !status.stdout.trim();
      checks.push({ name: 'Git Status', pass: clean, detail: clean ? 'Working tree clean' : status.stdout.trim().split('\n').length + ' changed files' });

      // Current branch
      const branch = await execCommand('git branch --show-current', { cwd: REPO_DIR });
      checks.push({ name: 'Branch', pass: true, detail: branch.stdout.trim() });

      // Behind remote?
      try {
        await execCommand('git fetch --dry-run', { cwd: REPO_DIR, timeout: 10000 });
        const behind = await execCommand('git rev-list HEAD..@{u} --count', { cwd: REPO_DIR });
        const count = parseInt(behind.stdout.trim()) || 0;
        checks.push({ name: 'Remote Sync', pass: count === 0, detail: count === 0 ? 'Up to date' : count + ' commits behind' });
      } catch { checks.push({ name: 'Remote Sync', pass: true, detail: 'Could not check' }); }

      // Last commit
      const last = await execCommand('git log --oneline -1', { cwd: REPO_DIR });
      checks.push({ name: 'Last Commit', pass: true, detail: last.stdout.trim() });

      res.json({ checks, allPass: checks.every(c => c.pass) });
    } catch (e) { res.json({ checks: [], allPass: false, error: e.message }); }
  });

  // ── Execute Deploy ──
  app.post('/api/deploy/execute/:id', requireRole('editor'), async (req, res) => {
    const targets = readJSON(TARGETS_PATH, []);
    const target = targets.find(t => t.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Target not found' });

    const deployLog = { id: require('crypto').randomUUID(), targetId: target.id, targetName: target.name, startedAt: new Date().toISOString(), stages: [], status: 'running' };
    const history = readJSON(HISTORY_PATH, []);

    try {
      // Stage 1: Pre-flight
      const preStage = { name: 'Pre-flight', status: 'running', startedAt: Date.now(), log: '' };
      deployLog.stages.push(preStage);
      const status = await execCommand('git status --porcelain', { cwd: REPO_DIR, timeout: 5000 });
      preStage.log = status.stdout || 'Clean';
      preStage.status = 'pass';
      preStage.duration = Date.now() - preStage.startedAt;

      // Stage 2: Build (if configured)
      if (target.buildCmd) {
        const buildStage = { name: 'Build', status: 'running', startedAt: Date.now(), log: '' };
        deployLog.stages.push(buildStage);
        try {
          const build = await execCommand(target.buildCmd, { cwd: REPO_DIR, timeout: 120000 });
          buildStage.log = (build.stdout + '\n' + build.stderr).trim();
          buildStage.status = 'pass';
        } catch (e) {
          buildStage.log = e.message;
          buildStage.status = 'fail';
          throw new Error('Build failed: ' + e.message);
        }
        buildStage.duration = Date.now() - buildStage.startedAt;
      }

      // Stage 3: Deploy
      const deployStage = { name: 'Deploy', status: 'running', startedAt: Date.now(), log: '' };
      deployLog.stages.push(deployStage);

      if (target.method === 'ssh_git' && target.host && target.deployCmd) {
        // Get SSH credential if linked
        let sshPrefix = '';
        if (target.credentialId) {
          const vault = require('../lib/credential-vault');
          const cred = vault.getCredential(target.credentialId);
          if (cred && cred.type === 'ssh_key') {
            const tmpKey = path.join(require('os').tmpdir(), `deploy-${target.id}.pem`);
            fs.writeFileSync(tmpKey, cred.secret, { mode: 0o600 });
            const user = cred.username ? `${cred.username}@` : '';
            const port = cred.port ? `-p ${cred.port}` : '';
            sshPrefix = `ssh -i "${tmpKey}" -o StrictHostKeyChecking=no ${port} ${user}${target.host}`;
            setTimeout(() => { try { fs.unlinkSync(tmpKey); } catch {} }, 60000);
          }
        }
        const cmd = sshPrefix ? `${sshPrefix} "${target.deployCmd.replace(/"/g, '\\"')}"` : target.deployCmd;
        const r = await execCommand(cmd, { cwd: REPO_DIR, timeout: 120000 });
        deployStage.log = (r.stdout + '\n' + r.stderr).trim();
        deployStage.status = 'pass';
      } else if (target.deployCmd) {
        const r = await execCommand(target.deployCmd, { cwd: REPO_DIR, timeout: 120000 });
        deployStage.log = (r.stdout + '\n' + r.stderr).trim();
        deployStage.status = 'pass';
      } else {
        deployStage.log = 'No deploy command configured';
        deployStage.status = 'pass';
      }
      deployStage.duration = Date.now() - deployStage.startedAt;

      // Stage 4: Verify (if URL configured)
      if (target.verifyUrl) {
        const verifyStage = { name: 'Verify', status: 'running', startedAt: Date.now(), log: '' };
        deployLog.stages.push(verifyStage);
        try {
          const resp = await fetch(target.verifyUrl, { timeout: 10000 });
          verifyStage.log = `HTTP ${resp.status} ${resp.statusText}`;
          verifyStage.status = resp.ok ? 'pass' : 'fail';
        } catch (e) {
          verifyStage.log = 'Health check failed: ' + e.message;
          verifyStage.status = 'fail';
        }
        verifyStage.duration = Date.now() - verifyStage.startedAt;
      }

      deployLog.status = 'success';
      deployLog.finishedAt = new Date().toISOString();
      deployLog.duration = Date.now() - new Date(deployLog.startedAt).getTime();

      // Update target
      target.lastDeploy = deployLog.finishedAt;
      target.lastStatus = 'success';
      writeJSON(TARGETS_PATH, targets);

    } catch (e) {
      deployLog.status = 'failed';
      deployLog.error = e.message;
      deployLog.finishedAt = new Date().toISOString();
      target.lastStatus = 'failed';
      writeJSON(TARGETS_PATH, targets);
    }

    history.push(deployLog);
    if (history.length > 100) history.splice(0, history.length - 100);
    writeJSON(HISTORY_PATH, history);

    res.json(deployLog);
  });

  // ── Build Profiles ──
  app.get('/api/deploy/profiles', requireAdmin, (req, res) => {
    const profiles = readJSON(PROFILES_PATH, [
      { id: 'nextjs', name: 'Next.js SaaS', buildCmd: 'npm install && npm run build', deployCmd: 'pm2 restart all', icon: 'next' },
      { id: 'docker', name: 'Docker Deploy', buildCmd: 'docker build -t app .', deployCmd: 'docker compose up -d', icon: 'docker' },
      { id: 'static', name: 'Static Site', buildCmd: 'npm run build', deployCmd: 'rsync -avz ./out/ deploy@host:/var/www/', icon: 'static' },
      { id: 'node', name: 'Node.js API', buildCmd: 'npm install --production', deployCmd: 'pm2 restart api', icon: 'node' },
    ]);
    res.json({ profiles });
  });

  app.post('/api/deploy/profiles', requireRole('editor'), (req, res) => {
    const profiles = readJSON(PROFILES_PATH, []);
    const { id, name, buildCmd, deployCmd, icon } = req.body;
    const profile = { id: id || require('crypto').randomUUID(), name, buildCmd, deployCmd, icon: icon || 'custom' };
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) profiles[idx] = profile;
    else profiles.push(profile);
    writeJSON(PROFILES_PATH, profiles);
    res.json({ success: true });
  });

  // ── AI Deploy Review ──
  app.post('/api/deploy/ai-review', requireRole('editor'), async (req, res) => {
    try {
      const [status, diff, branch] = await Promise.all([
        execCommand('git status --short', { cwd: REPO_DIR }),
        execCommand('git diff --cached --stat', { cwd: REPO_DIR }),
        execCommand('git branch --show-current', { cwd: REPO_DIR }),
      ]);

      const prompt = `You are a deploy readiness advisor. Assess if this codebase is ready to deploy.\nBranch: ${branch.stdout.trim()}\nUncommitted changes:\n${status.stdout || 'None'}\nStaged changes:\n${diff.stdout || 'None'}\n\nGive 3-5 sentences: deploy readiness (go/no-go), risk assessment, recommendations. No markdown.`;

      const result = await askAI(prompt, { timeout: 20000 });

      res.json({ review: result.trim() || 'Review unavailable.' });
    } catch (e) { res.json({ review: 'Review unavailable: ' + e.message }); }
  });
};
