/**
 * Git Projects Routes — Dynamic repo management (add/edit/remove/switch)
 * Stores repo configs in data/git-projects.json
 * Supports private repos via credential vault (SSH key or HTTPS token)
 */
const fs = require('fs');
const path = require('path');
const vault = require('../lib/credential-vault');

const PROJECTS_FILE = path.join(__dirname, '..', 'data', 'git-projects.json');

function loadProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  } catch {}
  return { projects: [], activeId: null };
}

function saveProjects(data) {
  const dir = path.dirname(PROJECTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getActiveProject() {
  const data = loadProjects();
  if (!data.activeId && data.projects.length) data.activeId = data.projects[0].id;
  return data.projects.find(p => p.id === data.activeId) || null;
}

function getRepoCwd(project) {
  if (!project) return null;
  return project.localPath || null;
}

/** Build git env with auth for private repos */
function getGitEnv(project) {
  const env = { ...process.env };
  if (!project || !project.credentialId) return env;
  try {
    const cred = vault.getCredential(project.credentialId);
    if (!cred) return env;
    if (cred.type === 'ssh_key' && cred.secret) {
      // Write temp SSH key file for this operation
      const tmpKey = path.join(__dirname, '..', 'data', '.git-ssh-key-' + project.id);
      fs.writeFileSync(tmpKey, cred.secret, { mode: 0o600 });
      env.GIT_SSH_COMMAND = `ssh -i "${tmpKey}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
    } else if (cred.type === 'api_token' && cred.secret) {
      // For HTTPS repos, inject token into credential helper
      env.GIT_ASKPASS = 'echo';
      env.GIT_TOKEN = cred.secret;
      // Override the remote URL to include token (handled per-command)
    }
  } catch {}
  return env;
}

/** Get authenticated remote URL for HTTPS token repos */
function getAuthRemoteUrl(project) {
  if (!project || !project.credentialId || !project.remoteUrl) return null;
  try {
    const cred = vault.getCredential(project.credentialId);
    if (cred && cred.type === 'api_token' && cred.secret) {
      // https://github.com/user/repo.git → https://TOKEN@github.com/user/repo.git
      return project.remoteUrl.replace(/^https:\/\//, 'https://' + cred.secret + '@');
    }
  } catch {}
  return null;
}

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole, execCommand } = ctx;

  // Expose getActiveProject and getRepoCwd on ctx for git-enhanced.js
  ctx.getActiveGitProject = getActiveProject;
  ctx.getGitCwd = function () {
    const proj = getActiveProject();
    return getRepoCwd(proj) || ctx.REPO_DIR;
  };
  ctx.getGitEnv = function () {
    const proj = getActiveProject();
    return getGitEnv(proj);
  };

  // ── List projects ──
  app.get('/api/git/projects', requireAdmin, (req, res) => {
    const data = loadProjects();
    // Enrich with live status
    const enriched = data.projects.map(p => {
      const cwd = getRepoCwd(p);
      return { ...p, hasLocalPath: !!cwd && fs.existsSync(cwd), active: p.id === data.activeId };
    });
    res.json({ projects: enriched, activeId: data.activeId });
  });

  // ── Add project ──
  app.post('/api/git/projects', requireRole('editor'), async (req, res) => {
    const { name, localPath, remoteUrl, credentialId, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    if (!localPath && !remoteUrl) return res.status(400).json({ error: 'Local path or remote URL required' });

    const id = require('crypto').randomUUID();
    const project = {
      id,
      name,
      localPath: localPath || '',
      remoteUrl: remoteUrl || '',
      credentialId: credentialId || null,
      description: description || '',
      createdAt: new Date().toISOString(),
    };

    // If only remote URL given, clone it
    if (remoteUrl && !localPath) {
      const cloneDir = path.join(__dirname, '..', 'data', 'repos', id);
      if (!fs.existsSync(path.dirname(cloneDir))) fs.mkdirSync(path.dirname(cloneDir), { recursive: true });
      try {
        const env = getGitEnv(project);
        const authUrl = getAuthRemoteUrl(project) || remoteUrl;
        const safeUrl = authUrl.replace(/"/g, '');
        await execCommand(`git clone "${safeUrl}" "${cloneDir}"`, { cwd: __dirname, timeout: 120000, env });
        project.localPath = cloneDir;
      } catch (e) {
        return res.status(500).json({ error: 'Clone failed: ' + (e.message || e.stderr || 'Unknown error') });
      }
    }

    const data = loadProjects();
    data.projects.push(project);
    if (!data.activeId) data.activeId = id;
    saveProjects(data);
    res.json({ success: true, project });
  });

  // ── Update project ──
  app.put('/api/git/projects/:id', requireRole('editor'), (req, res) => {
    const data = loadProjects();
    const idx = data.projects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Project not found' });
    const { name, localPath, remoteUrl, credentialId, description } = req.body;
    if (name !== undefined) data.projects[idx].name = name;
    if (localPath !== undefined) data.projects[idx].localPath = localPath;
    if (remoteUrl !== undefined) data.projects[idx].remoteUrl = remoteUrl;
    if (credentialId !== undefined) data.projects[idx].credentialId = credentialId;
    if (description !== undefined) data.projects[idx].description = description;
    saveProjects(data);
    res.json({ success: true, project: data.projects[idx] });
  });

  // ── Delete project ──
  app.delete('/api/git/projects/:id', requireAdmin, (req, res) => {
    const data = loadProjects();
    const idx = data.projects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Project not found' });
    const removed = data.projects.splice(idx, 1)[0];
    if (data.activeId === req.params.id) data.activeId = data.projects.length ? data.projects[0].id : null;
    saveProjects(data);
    res.json({ success: true, removed: removed.name });
  });

  // ── Activate project ──
  app.post('/api/git/projects/:id/activate', requireRole('editor'), (req, res) => {
    const data = loadProjects();
    const project = data.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    data.activeId = req.params.id;
    saveProjects(data);
    res.json({ success: true, activeId: data.activeId, name: project.name });
  });

  // ── Test connection (verify repo is accessible) ──
  app.post('/api/git/projects/test', requireRole('editor'), async (req, res) => {
    const { localPath, remoteUrl, credentialId } = req.body;
    try {
      if (localPath) {
        if (!fs.existsSync(localPath)) return res.json({ success: false, error: 'Path does not exist' });
        const r = await execCommand('git rev-parse --is-inside-work-tree', { cwd: localPath, timeout: 5000 });
        if (r.stdout.trim() === 'true') {
          const branch = await execCommand('git branch --show-current', { cwd: localPath, timeout: 5000 });
          return res.json({ success: true, message: 'Git repo found', branch: branch.stdout.trim() });
        }
        return res.json({ success: false, error: 'Not a git repository' });
      }
      if (remoteUrl) {
        const tmpProject = { credentialId, remoteUrl };
        const env = getGitEnv(tmpProject);
        const authUrl = getAuthRemoteUrl(tmpProject) || remoteUrl;
        const safeUrl = authUrl.replace(/"/g, '');
        const r = await execCommand(`git ls-remote --heads "${safeUrl}" 2>&1 | head -5`, { cwd: __dirname, timeout: 30000, env });
        if (r.stdout.trim()) return res.json({ success: true, message: 'Remote accessible', refs: r.stdout.trim().split('\n').length + ' refs' });
        return res.json({ success: false, error: r.stderr || 'Could not access remote' });
      }
      res.json({ success: false, error: 'Provide localPath or remoteUrl' });
    } catch (e) { res.json({ success: false, error: e.message }); }
  });
};
