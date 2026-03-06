const { getSystemInfo, getDiskUsage, getHistory, collectMetrics, getPerCoreCPU } = require("../lib/metrics-collector");

module.exports = function (app, ctx) {
  const { dbQuery, execCommand, REPO_DIR, requireRole } = ctx;

  async function getRecentActivity() {
    return await dbQuery(`SELECT id, type, title, description, created_at, metadata FROM chester_activity ORDER BY created_at DESC LIMIT 30`);
  }

  async function getProcessList() {
    try {
      const result = await execCommand("pm2 jlist");
      const procs = JSON.parse(result.stdout || "[]");
      return procs.map((p) => ({
        name: p.name, pm_id: p.pm_id, status: p.pm2_env?.status,
        cpu: p.monit?.cpu, memory: Math.round((p.monit?.memory || 0) / 1024 / 1024),
        uptime: p.pm2_env?.pm_uptime, restarts: p.pm2_env?.restart_time, pid: p.pid,
      }));
    } catch { return []; }
  }

  // Expose for broadcasts
  ctx.getRecentActivity = getRecentActivity;
  ctx.getProcessList = getProcessList;
  ctx.getSystemInfo = getSystemInfo;

  app.get("/api/system", (req, res) => {
    const sys = getSystemInfo();
    sys.connectedClients = ctx.io ? ctx.io.engine.clientsCount || 0 : 0;
    res.json(sys);
  });
  app.get("/api/activity", async (req, res) => res.json({ activity: await getRecentActivity() }));
  app.get("/api/processes", async (req, res) => res.json({ processes: await getProcessList() }));

  app.get("/api/metrics/extended", (req, res) => {
    const data = collectMetrics();
    res.json(data);
  });

  app.get("/api/metrics/history", (req, res) => {
    const type = req.query.type || "cpu";
    const count = Math.min(parseInt(req.query.count) || 60, 600);
    res.json({ type, data: getHistory(type, count) });
  });

  app.get("/api/metrics/disk", async (req, res) => {
    res.json({ disks: await getDiskUsage() });
  });

  app.get("/api/git", async (req, res) => {
    try {
      const gitCwd = (ctx.getGitCwd && ctx.getGitCwd()) || REPO_DIR;
      const [branch, log, status, remotes] = await Promise.all([
        execCommand("git branch --show-current", { cwd: gitCwd }),
        execCommand("git log --oneline -20", { cwd: gitCwd }),
        execCommand("git status --short", { cwd: gitCwd }),
        execCommand("git remote -v", { cwd: gitCwd }),
      ]);
      res.json({ branch: branch.stdout.trim(), commits: log.stdout.trim().split("\n").filter(Boolean), status: status.stdout.trim(), remotes: remotes.stdout.trim() });
    } catch (e) { res.json({ error: e.message }); }
  });

  app.get("/api/logs/:service", async (req, res) => {
    const { service } = req.params;
    if (!/^[a-zA-Z0-9_-]+$/.test(service)) return res.status(400).json({ error: "Invalid service name" });
    const safeLines = Math.min(Math.max(parseInt(req.query.lines, 10) || 100, 1), 500);
    const isWin = process.platform === 'win32';
    const path = require('path');
    const fs = require('fs');
    const auditFile = path.join(__dirname, '..', 'data', 'audit-log.json');

    // Bulwark audit log — always available, cross-platform
    function readAuditLog(prefix) {
      try {
        const entries = JSON.parse(fs.readFileSync(auditFile, 'utf8') || '[]').slice(-safeLines);
        if (entries.length) {
          const lines = prefix ? [prefix, ''] : [];
          entries.forEach(e => lines.push(`[${e.timestamp || ''}] ${e.user || 'system'} ${e.action || ''} ${e.path || ''} ${e.status || ''}`));
          return lines;
        }
      } catch {}
      return null;
    }

    // Per-service log commands (Linux)
    const linuxCmds = {
      pm2:      `pm2 logs --nostream --lines ${safeLines} 2>&1`,
      nginx:    `tail -n ${safeLines} /var/log/nginx/error.log /var/log/nginx/access.log 2>&1`,
      system:   `journalctl --no-pager -n ${safeLines} 2>&1`,
      auth:     `journalctl --no-pager -n ${safeLines} -u sshd 2>&1`,
      postgres: `journalctl --no-pager -n ${safeLines} -u postgresql 2>&1 || tail -n ${safeLines} /var/log/postgresql/*.log 2>&1`,
      docker:   `journalctl --no-pager -n ${safeLines} -u docker 2>&1`,
      bulwark:  null // handled below
    };

    // Bulwark's own audit log
    if (service === 'bulwark') {
      const lines = readAuditLog() || ['No audit log entries yet'];
      return res.json({ lines });
    }

    // On Windows, most services won't have system logs — use Docker logs where possible
    if (isWin) {
      // Docker container logs work on Windows via Docker Desktop
      if (service === 'postgres' || service === 'docker') {
        try {
          const containerName = service === 'postgres' ? 'postgres' : '';
          const cmd = containerName
            ? `docker logs --tail ${safeLines} $(docker ps -qf "name=${containerName}" 2>/dev/null) 2>&1`
            : `docker events --since 10m --format "{{.Time}} {{.Type}} {{.Action}} {{.Actor.Attributes.name}}" 2>&1`;
          const result = await execCommand(cmd, { timeout: 10000 });
          if (result.stdout && result.stdout.trim()) return res.json({ lines: result.stdout.trim().split("\n") });
        } catch {}
      }
      // Fallback to audit log with explanation
      const audit = readAuditLog(`[${service} system logs not available on Windows — showing Bulwark activity log]`);
      if (audit) return res.json({ lines: audit });
      return res.json({ lines: [`${service} logs are not available on Windows.`, 'On Linux servers, this reads journalctl/system logs.', '', 'Available on Windows:', '  - Bulwark (audit log)', '  - Docker / PostgreSQL (via Docker container logs)'] });
    }

    // Linux — run the appropriate command
    const cmd = linuxCmds[service];
    if (!cmd) return res.json({ lines: ["Unknown service: " + service] });
    try {
      const result = await execCommand(cmd, { timeout: 10000 });
      const output = (result.stdout || '').trim();
      res.json({ lines: output ? output.split("\n") : ["No logs available for " + service] });
    } catch {
      res.json({ lines: ["No logs available for " + service] });
    }
  });

  app.post("/api/exec", ctx.requireAdmin, async (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "command required" });
    const allowed = ["pm2", "git", "docker", "node", "npm", "curl", "ls", "cat", "head", "tail", "grep", "df", "free", "uptime", "whoami", "pwd", "claude", "top", "ps", "which", "echo", "date"];
    const cmd = command.trim().split(/\s+/)[0];
    if (!allowed.includes(cmd)) return res.status(403).json({ error: `Command '${cmd}' not allowed` });
    try {
      const result = await execCommand(command, { cwd: REPO_DIR, timeout: 30000 });
      res.json({ stdout: result.stdout, stderr: result.stderr, code: result.code });
    } catch (e) { res.json({ stdout: "", stderr: e.message, code: 1 }); }
  });

  app.post("/api/git/pull", requireRole('editor'), async (req, res) => {
    try {
      const gitCwd = (ctx.getGitCwd && ctx.getGitCwd()) || REPO_DIR;
      const r = await execCommand("git pull origin main", { cwd: gitCwd, timeout: 30000 });
      res.json({ stdout: r.stdout, stderr: r.stderr });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/git/push", requireRole('editor'), async (req, res) => {
    try {
      const gitCwd = (ctx.getGitCwd && ctx.getGitCwd()) || REPO_DIR;
      const b = await execCommand("git branch --show-current", { cwd: gitCwd });
      const r = await execCommand(`git push origin ${b.stdout.trim()}`, { cwd: gitCwd, timeout: 30000 });
      res.json({ stdout: r.stdout, stderr: r.stderr, branch: b.stdout.trim() });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/pm2/:action/:name", requireRole('admin'), async (req, res) => {
    const { action, name } = req.params;
    if (!["restart", "stop", "delete"].includes(action)) return res.status(400).json({ error: "Invalid action" });
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return res.status(400).json({ error: "Invalid process name" });
    try { const r = await execCommand(`pm2 ${action} ${name}`, { timeout: 15000 }); res.json({ stdout: r.stdout, stderr: r.stderr }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
};
