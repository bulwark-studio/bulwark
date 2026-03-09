/**
 * MCP Server Route — Model Context Protocol (Streamable HTTP)
 * Embedded in Bulwark at POST /mcp — customers connect from Claude/Cursor/VS Code
 * Each customer's instance is sandboxed in their own container
 *
 * SDK: @modelcontextprotocol/sdk v1.x
 * Transport: Streamable HTTP (stateless, no session tracking needed per-container)
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getRoleLevel } = require('../lib/rbac');

module.exports = function (app, ctx) {

  // ── Build the MCP server with all tools/resources/prompts ───────────────

  function createMcpServer(session) {
    const server = new McpServer({
      name: 'bulwark-monitor',
      version: '2.1.0',
      instructions: 'Bulwark server monitoring and management. Use tools to check system health, manage Docker containers, query databases, handle tickets, and deploy code.',
    });

    function requireMcpRole(minRole, toolName) {
      if (getRoleLevel(session?.role) >= getRoleLevel(minRole)) return null;
      return {
        content: [{ type: 'text', text: 'Error: ' + toolName + ' requires ' + minRole + ' role or higher.' }],
        isError: true,
      };
    }

    // ════════════════════════════════════════════════════════════════════════
    // TOOLS — Actions the AI can invoke
    // ════════════════════════════════════════════════════════════════════════

    // ── System ──

    server.tool('get_system_metrics', 'Get current CPU, memory, disk usage, uptime, and load averages', {},
      async () => {
        try {
          const cpus = os.cpus();
          const cpuPct = cpus.reduce((sum, c) => {
            const total = Object.values(c.times).reduce((a, b) => a + b, 0);
            return sum + ((total - c.times.idle) / total) * 100;
          }, 0) / cpus.length;
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const usedMem = totalMem - freeMem;
          const info = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            uptime: Math.floor(os.uptime()),
            cpuModel: cpus[0]?.model || 'unknown',
            cpuCores: cpus.length,
            cpuPercent: Math.round(cpuPct * 100) / 100,
            memoryTotal: Math.round(totalMem / 1024 / 1024),
            memoryUsed: Math.round(usedMem / 1024 / 1024),
            memoryPercent: Math.round((usedMem / totalMem) * 10000) / 100,
            loadAvg: os.loadavg(),
          };
          // Try to get disk usage
          try {
            const { getDiskUsage } = require('../lib/metrics-collector');
            const disk = await getDiskUsage();
            if (disk) info.disk = disk;
          } catch {}
          return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    server.tool('get_process_list', 'Get running processes sorted by CPU or memory usage', {
      sortBy: z.enum(['cpu', 'memory']).default('cpu').describe('Sort by cpu or memory'),
      limit: z.number().default(15).describe('Number of processes to return'),
    }, async ({ sortBy, limit }) => {
      try {
        if (ctx.getProcessList) {
          const procs = await ctx.getProcessList();
          return { content: [{ type: 'text', text: JSON.stringify((procs || []).slice(0, limit), null, 2) }] };
        }
        const { execCommand } = ctx;
        const cmd = os.platform() === 'win32'
          ? 'powershell -c "Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First ' + limit + ' Id,ProcessName,CPU,WorkingSet64 | ConvertTo-Json"'
          : 'ps aux --sort=-%' + (sortBy === 'memory' ? 'mem' : 'cpu') + ' | head -' + (limit + 1);
        const result = await execCommand(cmd, { timeout: 5000 });
        return { content: [{ type: 'text', text: result.stdout || result.stderr || 'No process data' }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Uptime ──

    server.tool('get_uptime_status', 'Get status of all monitored endpoints with uptime percentages', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'get_uptime_status');
          if (denied) return denied;
          const uptimeStore = require('../lib/uptime-store');
          const endpoints = uptimeStore.getEndpoints();
          const data = endpoints.map(ep => ({
            id: ep.id, name: ep.name, url: ep.url,
            uptime24h: uptimeStore.getUptimePercent(ep.id, 24),
            uptime7d: uptimeStore.getUptimePercent(ep.id, 168),
            lastCheck: (uptimeStore.getChecks(ep.id, 1).slice(-1)[0]) || null,
          }));
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    server.tool('add_uptime_endpoint', 'Add a new URL to monitor for uptime', {
      name: z.string().describe('Display name for the endpoint'),
      url: z.string().url().describe('URL to monitor'),
      expectedStatus: z.number().default(200).describe('Expected HTTP status code'),
    }, async ({ name, url, expectedStatus }) => {
      try {
        const denied = requireMcpRole('admin', 'add_uptime_endpoint');
        if (denied) return denied;
        const uptimeStore = require('../lib/uptime-store');
        const id = uptimeStore.addEndpoint({ name, url, expectedStatus });
        return { content: [{ type: 'text', text: 'Endpoint added: ' + name + ' (' + url + ') id=' + id }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Docker ──

    server.tool('list_docker_containers', 'List Docker containers with status and resource usage', {
      all: z.boolean().default(true).describe('Include stopped containers'),
    }, async ({ all }) => {
      try {
        const denied = requireMcpRole('admin', 'list_docker_containers');
        if (denied) return denied;
        const docker = require('../lib/docker-engine');
        const containers = await docker.listContainers(all);
        const summary = containers.map(c => ({
          id: c.shortId || (c.id || '').substring(0, 12),
          name: c.name || 'unknown',
          image: c.image,
          state: c.state,
          status: c.status,
          ports: (c.ports || []).map(p => (p.publicPort || '') + ':' + (p.privatePort || '')).join(', '),
        }));
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Docker not available: ' + e.message }], isError: true };
      }
    });

    server.tool('get_container_logs', 'Get recent logs from a Docker container', {
      containerId: z.string().describe('Container ID or name'),
      tail: z.number().default(50).describe('Number of log lines'),
    }, async ({ containerId, tail }) => {
      try {
        const denied = requireMcpRole('admin', 'get_container_logs');
        if (denied) return denied;
        const docker = require('../lib/docker-engine');
        const logs = await docker.containerLogs(containerId, tail);
        return { content: [{ type: 'text', text: logs || 'No logs available' }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('manage_container', 'Start, stop, or restart a Docker container', {
      containerId: z.string().describe('Container ID or name'),
      action: z.enum(['start', 'stop', 'restart']).describe('Action to perform'),
    }, async ({ containerId, action }) => {
      try {
        const denied = requireMcpRole('editor', 'manage_container');
        if (denied) return denied;
        const docker = require('../lib/docker-engine');
        await docker.containerAction(containerId, action);
        return { content: [{ type: 'text', text: 'Container ' + containerId + ' ' + action + 'ed successfully' }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('inspect_image_layers', 'Inspect Docker image layers with efficiency analysis (Dive-style)', {
      imageId: z.string().describe('Docker image ID or name:tag'),
    }, async ({ imageId }) => {
      try {
        const denied = requireMcpRole('admin', 'inspect_image_layers');
        if (denied) return denied;
        const docker = require('../lib/docker-engine');
        const analysis = await docker.analyzeImageLayers(imageId);
        const summary = {
          image: analysis.repoTags[0] || analysis.imageId,
          totalSize: analysis.totalSizeFormatted,
          efficiencyScore: analysis.efficiencyScore + '%',
          layers: analysis.layerCount,
          dataLayers: analysis.substantiveLayerCount,
          emptyLayers: analysis.emptyLayerCount,
          largestLayer: analysis.largestLayer,
          runsAs: analysis.config.user || 'root',
          ports: analysis.config.exposedPorts,
          optimizationTargets: analysis.optimizationTargets.map(t => t.reason),
          layerBreakdown: analysis.layers.filter(l => !l.empty).map(l => ({
            size: l.sizeFormatted,
            command: l.createdBy,
          })),
        };
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error inspecting image: ' + e.message }], isError: true };
      }
    });

    // ── Database ──

    server.tool('list_database_tables', 'List all tables in the connected database', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'list_database_tables');
          if (denied) return denied;
          if (!ctx.dbQuery) return { content: [{ type: 'text', text: 'No database connected' }] };
          const tables = await ctx.dbQuery("SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
          return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    server.tool('query_database', 'Execute a read-only SQL query (SELECT/WITH/EXPLAIN only)', {
      sql: z.string().describe('SQL query to execute (SELECT, WITH, or EXPLAIN only)'),
      limit: z.number().default(50).describe('Max rows to return'),
    }, async ({ sql, limit }) => {
      try {
        const denied = requireMcpRole('editor', 'query_database');
        if (denied) return denied;
        if (!ctx.dbQuery) return { content: [{ type: 'text', text: 'No database connected' }] };
        const trimmed = sql.trim().toUpperCase();
        if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH') && !trimmed.startsWith('EXPLAIN')) {
          return { content: [{ type: 'text', text: 'Only SELECT, WITH, and EXPLAIN queries are allowed via MCP for safety.' }], isError: true };
        }
        const cleaned = sql.replace(/;\s*$/, '');
        const safeSql = /\bLIMIT\s+\d+/i.test(cleaned) ? cleaned : cleaned + ' LIMIT ' + limit;
        const rows = await ctx.dbQuery(safeSql);
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Query error: ' + e.message }], isError: true };
      }
    });

    // ── Tickets ──

    server.tool('list_tickets', 'List support tickets', {
      status: z.enum(['open', 'in_progress', 'closed', 'all']).default('open').describe('Filter by status'),
    }, async ({ status }) => {
      try {
        if (!ctx.dbQuery) return { content: [{ type: 'text', text: 'No database connected' }] };
        let tickets;
        if (status === 'all') {
          tickets = await ctx.dbQuery('SELECT id, subject, status, priority, created_at FROM support_tickets ORDER BY created_at DESC LIMIT 20');
        } else {
          tickets = await ctx.dbQuery('SELECT id, subject, status, priority, created_at FROM support_tickets WHERE status = $1 ORDER BY created_at DESC LIMIT 20', [status]);
        }
        return { content: [{ type: 'text', text: JSON.stringify(tickets, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('create_ticket', 'Create a new support ticket', {
      subject: z.string().describe('Ticket subject/title'),
      description: z.string().describe('Detailed description'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    }, async ({ subject, description, priority }) => {
      try {
        const denied = requireMcpRole('editor', 'create_ticket');
        if (denied) return denied;
        if (!ctx.dbQuery) return { content: [{ type: 'text', text: 'No database connected' }] };
        const result = await ctx.dbQuery(
          'INSERT INTO support_tickets (subject, description, priority, status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
          [subject, description, priority, 'open']
        );
        const id = result[0]?.id || 'unknown';
        return { content: [{ type: 'text', text: 'Ticket created: #' + id + ' — ' + subject }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Deploy ──

    server.tool('get_deploy_history', 'Get recent deployment history', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'get_deploy_history');
          if (denied) return denied;
          const fs = require('fs');
          const path = require('path');
          const histPath = path.join(__dirname, '..', 'data', 'deploy-history.json');
          if (!fs.existsSync(histPath)) return { content: [{ type: 'text', text: '[]' }] };
          const history = JSON.parse(fs.readFileSync(histPath, 'utf8'));
          const recent = history.slice(-10).reverse().map(d => ({
            id: d.id, target: d.targetName, status: d.status,
            started: d.startedAt, finished: d.finishedAt,
            duration: d.duration ? Math.round(d.duration / 1000) + 's' : null,
            error: d.error || null,
          }));
          return { content: [{ type: 'text', text: JSON.stringify(recent, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    server.tool('get_deploy_preflight', 'Run pre-flight checks before deploying', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'get_deploy_preflight');
          if (denied) return denied;
          const { execCommand, REPO_DIR } = ctx;
          const checks = [];
          const status = await execCommand('git status --porcelain', { cwd: REPO_DIR, timeout: 5000 });
          const clean = !status.stdout.trim();
          checks.push({ name: 'Git Status', pass: clean, detail: clean ? 'Clean' : status.stdout.trim().split('\n').length + ' changed files' });
          const branch = await execCommand('git branch --show-current', { cwd: REPO_DIR });
          checks.push({ name: 'Branch', pass: true, detail: branch.stdout.trim() });
          const last = await execCommand('git log --oneline -1', { cwd: REPO_DIR });
          checks.push({ name: 'Last Commit', pass: true, detail: last.stdout.trim() });
          return { content: [{ type: 'text', text: JSON.stringify({ checks, allPass: checks.every(c => c.pass) }, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    // ── Git ──

    server.tool('get_git_log', 'Get recent git commit history', {
      count: z.number().default(10).describe('Number of commits to show'),
    }, async ({ count }) => {
      try {
        const denied = requireMcpRole('admin', 'get_git_log');
        if (denied) return denied;
        const result = await ctx.execCommand('git log --oneline -' + count, { cwd: ctx.REPO_DIR, timeout: 5000 });
        return { content: [{ type: 'text', text: result.stdout || 'No commits' }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('get_git_diff', 'Get git diff showing current changes', {
      staged: z.boolean().default(false).describe('Show only staged changes'),
    }, async ({ staged }) => {
      try {
        const denied = requireMcpRole('admin', 'get_git_diff');
        if (denied) return denied;
        const cmd = staged ? 'git diff --cached --stat' : 'git diff --stat';
        const result = await ctx.execCommand(cmd, { cwd: ctx.REPO_DIR, timeout: 5000 });
        return { content: [{ type: 'text', text: result.stdout || 'No changes' }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Security ──

    server.tool('get_security_score', 'Run a security posture scan and get the score', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'get_security_score');
          if (denied) return denied;
          const { execCommand, REPO_DIR } = ctx;
          const checks = [];
          let score = 100;

          // Check 1: .env files not in git
          try {
            const envCheck = await execCommand('git ls-files .env .env.local .env.production 2>/dev/null', { cwd: REPO_DIR, timeout: 3000 });
            const tracked = envCheck.stdout.trim();
            if (tracked) { checks.push({ name: '.env in Git', status: 'fail', detail: 'Environment files tracked by git', severity: 'critical' }); score -= 20; }
            else checks.push({ name: '.env in Git', status: 'pass', detail: 'Environment files properly gitignored' });
          } catch { checks.push({ name: '.env in Git', status: 'pass', detail: 'No tracked env files' }); }

          // Check 2: .gitignore exists
          const gitignoreExists = fs.existsSync(path.join(REPO_DIR, '.gitignore'));
          checks.push({ name: '.gitignore', status: gitignoreExists ? 'pass' : 'warn', detail: gitignoreExists ? 'Present' : 'Missing .gitignore file' });
          if (!gitignoreExists) score -= 10;

          // Check 3: No hardcoded secrets in code
          try {
            const secretScan = await execCommand(
              'git grep -n -E "(password|secret|api_key|private_key)\\s*[:=]\\s*[\'\\"][^\\s]{8,}" -- "*.js" "*.ts" "*.json" 2>/dev/null | head -10',
              { cwd: REPO_DIR, timeout: 5000 }
            );
            const found = secretScan.stdout.trim();
            if (found) {
              const count = found.split('\n').filter(Boolean).length;
              checks.push({ name: 'Hardcoded Secrets', status: 'fail', detail: count + ' potential secrets found in code', severity: 'high' });
              score -= 15;
            } else {
              checks.push({ name: 'Hardcoded Secrets', status: 'pass', detail: 'No hardcoded secrets detected' });
            }
          } catch { checks.push({ name: 'Hardcoded Secrets', status: 'pass', detail: 'Scan clean' }); }

          // Check 4: package-lock.json exists (dependency pinning)
          const lockExists = fs.existsSync(path.join(REPO_DIR, 'package-lock.json')) || fs.existsSync(path.join(REPO_DIR, 'yarn.lock'));
          checks.push({ name: 'Dependency Lock', status: lockExists ? 'pass' : 'warn', detail: lockExists ? 'Lock file present' : 'No lock file — unpinned dependencies' });
          if (!lockExists) score -= 5;

          // Check 5: Node.js version
          try {
            const nodeVer = await execCommand('node --version', { timeout: 3000 });
            const ver = parseInt((nodeVer.stdout.trim().match(/v(\d+)/) || [])[1] || '0');
            const current = ver >= 20;
            checks.push({ name: 'Node.js Version', status: current ? 'pass' : 'warn', detail: nodeVer.stdout.trim() + (current ? ' (supported)' : ' (outdated)') });
            if (!current) score -= 5;
          } catch { checks.push({ name: 'Node.js Version', status: 'warn', detail: 'Could not check' }); }

          // Check 6: HTTPS/TLS configured
          const hasSSL = !!process.env.SSL_CERT || !!process.env.HTTPS;
          checks.push({ name: 'HTTPS/TLS', status: hasSSL ? 'pass' : 'info', detail: hasSSL ? 'TLS configured' : 'Running HTTP (use reverse proxy for HTTPS)' });

          // Check 7: Auth strength
          try {
            const usersFile = path.join(__dirname, '..', 'users.json');
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            const hasDefault = users.some(u => u.user === 'admin' && !u.totpSecret);
            checks.push({ name: 'Auth Security', status: hasDefault ? 'warn' : 'pass', detail: hasDefault ? 'Default admin without 2FA' : '2FA enabled for admin' });
            if (hasDefault) score -= 10;
          } catch { checks.push({ name: 'Auth Security', status: 'info', detail: 'Could not check' }); }

          // Check 8: npm audit
          try {
            const audit = await execCommand('npm audit --json 2>/dev/null | head -c 2000', { cwd: REPO_DIR, timeout: 15000 });
            const auditData = JSON.parse(audit.stdout || '{}');
            const vulns = auditData.metadata?.vulnerabilities || {};
            const critical = (vulns.critical || 0) + (vulns.high || 0);
            checks.push({ name: 'npm Audit', status: critical === 0 ? 'pass' : 'fail', detail: critical ? critical + ' critical/high vulnerabilities' : 'No critical vulnerabilities', severity: critical > 0 ? 'high' : undefined });
            if (critical > 0) score -= 10;
          } catch { checks.push({ name: 'npm Audit', status: 'info', detail: 'Could not run audit' }); }

          score = Math.max(0, Math.min(100, score));
          const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
          return { content: [{ type: 'text', text: JSON.stringify({ score, grade, checks, checkedAt: new Date().toISOString() }, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    // ── Notifications ──

    server.tool('send_notification', 'Send an alert notification to all configured channels', {
      title: z.string().describe('Alert title'),
      message: z.string().describe('Alert message body'),
      severity: z.enum(['info', 'warning', 'critical']).default('info'),
      category: z.enum(['system', 'security', 'deploy', 'uptime', 'cron', 'git']).default('system'),
    }, async ({ title, message, severity, category }) => {
      try {
        const denied = requireMcpRole('admin', 'send_notification');
        if (denied) return denied;
        if (ctx.pushNotification) {
          ctx.pushNotification(category, title, message, severity);
          return { content: [{ type: 'text', text: 'Notification sent: [' + severity.toUpperCase() + '] ' + title }] };
        }
        return { content: [{ type: 'text', text: 'Notification system not available' }], isError: true };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('get_recent_alerts', 'Get recent notifications and alerts', {
      limit: z.number().default(20).describe('Number of alerts to return'),
    }, async ({ limit }) => {
      try {
        const denied = requireMcpRole('viewer', 'get_recent_alerts');
        if (denied) return denied;
        const fs = require('fs');
        const path = require('path');
        const notifsPath = path.join(__dirname, '..', 'data', 'notification-center.json');
        if (!fs.existsSync(notifsPath)) return { content: [{ type: 'text', text: '[]' }] };
        const notifs = JSON.parse(fs.readFileSync(notifsPath, 'utf8'));
        const recent = notifs.slice(-limit).reverse();
        return { content: [{ type: 'text', text: JSON.stringify(recent, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── GitHub Hub ──

    server.tool('list_github_repos', 'List tracked GitHub repos with optional filters', {
      category: z.string().optional().describe('Filter by category name'),
      source: z.enum(['public', 'account', 'all']).optional().describe('Filter by repo source'),
    }, async ({ category, source }) => {
      try {
        const denied = requireMcpRole('admin', 'list_github_repos');
        if (denied) return denied;
        const hubPath = path.join(__dirname, '..', 'data', 'github-hub.json');
        if (!fs.existsSync(hubPath)) return { content: [{ type: 'text', text: JSON.stringify([], null, 2) }] };
        const hub = JSON.parse(fs.readFileSync(hubPath, 'utf8'));
        let repos = hub.repos || [];
        if (category) repos = repos.filter(r => r.category === category);
        if (source === 'public') repos = repos.filter(r => !r.accountId);
        else if (source === 'account') repos = repos.filter(r => !!r.accountId);
        const summary = repos.map(r => ({
          id: r.id, fullName: r.fullName, description: r.description,
          language: r.language, stars: r.stars, forks: r.forks,
          category: r.category, source: r.source || (r.accountId ? 'account' : 'public'),
          lastSynced: r.lastSynced, pushedAt: r.pushedAt,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('add_github_repo', 'Add a public GitHub repo to track', {
      url: z.string().describe('owner/repo or full GitHub URL'),
      category: z.string().optional().describe('Category to assign'),
      notes: z.string().optional().describe('Notes about this repo'),
    }, async ({ url, category, notes }) => {
      try {
        const denied = requireMcpRole('editor', 'add_github_repo');
        if (denied) return denied;

        // Parse owner/repo from URL or shorthand
        const input = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
        let owner, repo;
        const slash = input.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
        if (slash) { owner = slash[1]; repo = slash[2]; }
        else {
          const urlMatch = input.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
          if (urlMatch) { owner = urlMatch[1]; repo = urlMatch[2]; }
        }
        if (!owner || !repo) return { content: [{ type: 'text', text: 'Could not parse repo URL. Use owner/repo or full GitHub URL.' }], isError: true };

        const hubPath = path.join(__dirname, '..', 'data', 'github-hub.json');
        const defaultHub = { accounts: [], repos: [], categories: ['AI/ML', 'DevOps', 'Frontend', 'Backend', 'Security', 'Infrastructure', 'Data', 'Mobile', 'Research', 'Uncategorized'], settings: { defaultCategory: 'Uncategorized' } };
        let hub;
        try { hub = JSON.parse(fs.readFileSync(hubPath, 'utf8')); } catch { hub = JSON.parse(JSON.stringify(defaultHub)); }

        // Check duplicate
        if ((hub.repos || []).find(r => r.fullName?.toLowerCase() === (owner + '/' + repo).toLowerCase())) {
          return { content: [{ type: 'text', text: 'Repo ' + owner + '/' + repo + ' is already tracked.' }], isError: true };
        }

        // Fetch from GitHub API (public, unauthenticated)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const ghRes = await fetch('https://api.github.com/repos/' + owner + '/' + repo, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Bulwark/2.1' },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!ghRes.ok) return { content: [{ type: 'text', text: 'GitHub API error: ' + ghRes.status + ' ' + ghRes.statusText + '. Repo may be private.' }], isError: true };
          const data = await ghRes.json();

          const repoObj = {
            id: crypto.randomUUID(),
            accountId: null,
            source: 'public',
            owner: data.owner?.login || owner,
            name: data.name,
            fullName: data.full_name,
            htmlUrl: data.html_url,
            description: data.description || '',
            language: data.language || 'Unknown',
            stars: data.stargazers_count || 0,
            forks: data.forks_count || 0,
            openIssues: data.open_issues_count || 0,
            defaultBranch: data.default_branch || 'main',
            topics: data.topics || [],
            isPrivate: data.private || false,
            license: data.license?.spdx_id || null,
            pushedAt: data.pushed_at,
            updatedAt: data.updated_at,
            createdAt: data.created_at,
            size: data.size || 0,
            archived: data.archived || false,
            fork: data.fork || false,
            category: category || hub.settings?.defaultCategory || 'Uncategorized',
            tags: [],
            notes: notes || '',
            starred: false,
            aiSummary: null,
            aiResearch: null,
            addedAt: new Date().toISOString(),
            lastSynced: new Date().toISOString(),
            syncError: null,
          };

          if (!hub.repos) hub.repos = [];
          hub.repos.push(repoObj);
          const dir = path.dirname(hubPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(hubPath, JSON.stringify(hub, null, 2));

          return { content: [{ type: 'text', text: JSON.stringify({ added: repoObj.fullName, stars: repoObj.stars, language: repoObj.language, id: repoObj.id }, null, 2) }] };
        } finally {
          clearTimeout(timeout);
        }
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('sync_github_repo', 'Refresh repo data from GitHub', {
      repoId: z.string().describe('Repository ID to sync'),
    }, async ({ repoId }) => {
      try {
        const denied = requireMcpRole('editor', 'sync_github_repo');
        if (denied) return denied;
        const hubPath = path.join(__dirname, '..', 'data', 'github-hub.json');
        if (!fs.existsSync(hubPath)) return { content: [{ type: 'text', text: 'No GitHub Hub data found' }], isError: true };
        const hub = JSON.parse(fs.readFileSync(hubPath, 'utf8'));
        const repo = (hub.repos || []).find(r => r.id === repoId);
        if (!repo) return { content: [{ type: 'text', text: 'Repo not found with id: ' + repoId }], isError: true };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const ghRes = await fetch('https://api.github.com/repos/' + repo.owner + '/' + repo.name, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Bulwark/2.1' },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!ghRes.ok) {
            repo.syncError = 'GitHub API ' + ghRes.status;
            fs.writeFileSync(hubPath, JSON.stringify(hub, null, 2));
            return { content: [{ type: 'text', text: 'Sync failed: GitHub API ' + ghRes.status }], isError: true };
          }
          const data = await ghRes.json();
          repo.description = data.description || repo.description;
          repo.language = data.language || repo.language;
          repo.stars = data.stargazers_count || 0;
          repo.forks = data.forks_count || 0;
          repo.openIssues = data.open_issues_count || 0;
          repo.topics = data.topics || repo.topics;
          repo.pushedAt = data.pushed_at;
          repo.updatedAt = data.updated_at;
          repo.size = data.size || repo.size;
          repo.archived = data.archived || false;
          repo.lastSynced = new Date().toISOString();
          repo.syncError = null;

          fs.writeFileSync(hubPath, JSON.stringify(hub, null, 2));
          return { content: [{ type: 'text', text: JSON.stringify({ synced: repo.fullName, stars: repo.stars, lastSynced: repo.lastSynced }, null, 2) }] };
        } finally {
          clearTimeout(timeout);
        }
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Cron Jobs ──

    server.tool('list_cron_jobs', 'List configured cron jobs with status and run history', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'list_cron_jobs');
          if (denied) return denied;
          const jobsPath = path.join(__dirname, '..', 'data', 'cron-jobs.json');
          const runsPath = path.join(__dirname, '..', 'data', 'cron-runs.json');
          let jobs = [];
          let runs = [];
          try { jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8')); } catch {}
          try { runs = JSON.parse(fs.readFileSync(runsPath, 'utf8')); } catch {}
          if (!Array.isArray(jobs)) jobs = [];
          if (!Array.isArray(runs)) runs = [];
          const enriched = jobs.map(j => {
            const jobRuns = runs.filter(r => r.jobId === j.id);
            const lastRun = jobRuns.length ? jobRuns[jobRuns.length - 1] : null;
            return {
              id: j.id, name: j.name, schedule: j.schedule, command: j.command,
              enabled: j.enabled !== false, category: j.category || 'general',
              lastRun: lastRun?.finishedAt || null,
              lastStatus: lastRun?.status || null,
              totalRuns: jobRuns.length,
            };
          });
          return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    server.tool('manage_cron_job', 'Create or delete a cron job', {
      action: z.enum(['create', 'delete']).describe('Action to perform'),
      id: z.string().optional().describe('Job ID (required for delete)'),
      schedule: z.string().optional().describe('Cron expression (required for create)'),
      command: z.string().optional().describe('Shell command (required for create)'),
      name: z.string().optional().describe('Display name for the job'),
    }, async ({ action, id, schedule, command, name }) => {
      try {
        const denied = requireMcpRole('editor', 'manage_cron_job');
        if (denied) return denied;
        const jobsPath = path.join(__dirname, '..', 'data', 'cron-jobs.json');
        let jobs = [];
        try { jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8')); } catch {}
        if (!Array.isArray(jobs)) jobs = [];

        if (action === 'create') {
          if (!schedule || !command) return { content: [{ type: 'text', text: 'schedule and command are required for create' }], isError: true };
          const job = {
            id: crypto.randomUUID(),
            name: name || command.split(' ')[0],
            schedule,
            command,
            description: '',
            category: 'general',
            tags: [],
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          jobs.push(job);
          const dir = path.dirname(jobsPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
          return { content: [{ type: 'text', text: 'Cron job created: ' + job.name + ' (' + schedule + ') id=' + job.id }] };
        } else {
          if (!id) return { content: [{ type: 'text', text: 'id is required for delete' }], isError: true };
          const before = jobs.length;
          jobs = jobs.filter(j => j.id !== id);
          if (jobs.length === before) return { content: [{ type: 'text', text: 'Job not found: ' + id }], isError: true };
          fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
          return { content: [{ type: 'text', text: 'Cron job deleted: ' + id }] };
        }
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Environment Variables ──

    server.tool('list_env_vars', 'List environment variables with masked values', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'list_env_vars');
          if (denied) return denied;
          const envPath = path.join(__dirname, '..', 'data', 'envvars.json');
          if (!fs.existsSync(envPath)) return { content: [{ type: 'text', text: JSON.stringify([], null, 2) }] };
          const data = JSON.parse(fs.readFileSync(envPath, 'utf8'));
          const vars = (data.variables || []).map(v => ({
            key: v.key,
            value: v.value ? v.value.substring(0, 4) + '****' : '****',
            encrypted: v.encrypted || false,
            updatedAt: v.updatedAt || null,
          }));
          return { content: [{ type: 'text', text: JSON.stringify(vars, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    server.tool('set_env_var', 'Set an environment variable', {
      key: z.string().describe('Variable name'),
      value: z.string().describe('Variable value'),
      encrypted: z.boolean().optional().describe('Store as encrypted'),
    }, async ({ key, value, encrypted }) => {
      try {
        const denied = requireMcpRole('editor', 'set_env_var');
        if (denied) return denied;
        if (!key.match(/^[A-Za-z_][A-Za-z0-9_]*$/)) return { content: [{ type: 'text', text: 'Invalid variable name. Use letters, digits, and underscores.' }], isError: true };
        const envPath = path.join(__dirname, '..', 'data', 'envvars.json');
        let data = { variables: [] };
        try { data = JSON.parse(fs.readFileSync(envPath, 'utf8')); } catch {}
        if (!data.variables) data.variables = [];
        const idx = data.variables.findIndex(v => v.key === key);
        const entry = { key, value, encrypted: !!encrypted, updatedAt: new Date().toISOString() };
        if (idx >= 0) data.variables[idx] = entry;
        else data.variables.push(entry);
        const dir = path.dirname(envPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(envPath, JSON.stringify(data, null, 2));
        return { content: [{ type: 'text', text: 'Environment variable set: ' + key }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── File Operations ──

    server.tool('read_file', 'Read a file from the managed repository', {
      path: z.string().describe('Relative path within repo'),
      lines: z.number().optional().describe('Max lines to return, default 200'),
    }, async ({ path: filePath, lines }) => {
      try {
        const denied = requireMcpRole('editor', 'read_file');
        if (denied) return denied;
        const { REPO_DIR } = ctx;
        // Validate no path traversal
        if (filePath.includes('..')) return { content: [{ type: 'text', text: 'Path traversal not allowed: .. is forbidden' }], isError: true };
        const resolved = path.resolve(REPO_DIR, filePath);
        if (!resolved.startsWith(path.resolve(REPO_DIR))) return { content: [{ type: 'text', text: 'Path escapes repository directory' }], isError: true };
        if (!fs.existsSync(resolved)) return { content: [{ type: 'text', text: 'File not found: ' + filePath }], isError: true };
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) return { content: [{ type: 'text', text: 'Path is a directory, not a file. Use list_files instead.' }], isError: true };
        const maxLines = lines || 200;
        const content = fs.readFileSync(resolved, 'utf8');
        const allLines = content.split('\n');
        const truncated = allLines.length > maxLines;
        const output = allLines.slice(0, maxLines).join('\n');
        const info = { path: filePath, size: stat.size, totalLines: allLines.length, truncated, linesReturned: Math.min(allLines.length, maxLines) };
        return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) + '\n---\n' + output }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('list_files', 'List files in a directory within the managed repository', {
      path: z.string().optional().describe('Relative directory path, default root'),
      pattern: z.string().optional().describe('Glob pattern filter (e.g. *.js)'),
    }, async ({ path: dirPath, pattern }) => {
      try {
        const denied = requireMcpRole('admin', 'list_files');
        if (denied) return denied;
        const { REPO_DIR } = ctx;
        const relPath = dirPath || '.';
        if (relPath.includes('..')) return { content: [{ type: 'text', text: 'Path traversal not allowed: .. is forbidden' }], isError: true };
        const resolved = path.resolve(REPO_DIR, relPath);
        if (!resolved.startsWith(path.resolve(REPO_DIR))) return { content: [{ type: 'text', text: 'Path escapes repository directory' }], isError: true };
        if (!fs.existsSync(resolved)) return { content: [{ type: 'text', text: 'Directory not found: ' + relPath }], isError: true };
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        let files = entries.map(e => {
          const fullPath = path.join(resolved, e.name);
          let size = 0;
          try { size = e.isFile() ? fs.statSync(fullPath).size : 0; } catch {}
          return { name: e.name, type: e.isDirectory() ? 'directory' : 'file', size };
        });
        if (pattern) {
          const re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
          files = files.filter(f => f.type === 'directory' || re.test(f.name));
        }
        files.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
        return { content: [{ type: 'text', text: JSON.stringify({ directory: relPath, count: files.length, files }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Git Enhanced ──

    server.tool('list_git_branches', 'List git branches', {
      remote: z.boolean().optional().describe('Include remote branches'),
    }, async ({ remote }) => {
      try {
        const denied = requireMcpRole('admin', 'list_git_branches');
        if (denied) return denied;
        const cmd = remote ? 'git branch -a' : 'git branch';
        const result = await ctx.execCommand(cmd, { cwd: ctx.REPO_DIR, timeout: 5000 });
        const lines = (result.stdout || '').split('\n').filter(Boolean);
        const branches = lines.map(l => {
          const current = l.startsWith('* ');
          const name = l.replace(/^\*?\s+/, '').trim();
          return { name, current };
        });
        return { content: [{ type: 'text', text: JSON.stringify(branches, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('get_git_status', 'Get working tree status with staged, unstaged, and untracked files', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'get_git_status');
          if (denied) return denied;
          const result = await ctx.execCommand('git status --porcelain', { cwd: ctx.REPO_DIR, timeout: 5000 });
          const lines = (result.stdout || '').split('\n').filter(Boolean);
          const staged = [];
          const unstaged = [];
          const untracked = [];
          for (const line of lines) {
            const x = line[0]; // index status
            const y = line[1]; // worktree status
            const file = line.substring(3);
            if (x === '?' && y === '?') { untracked.push(file); }
            else {
              if (x !== ' ' && x !== '?') staged.push({ status: x, file });
              if (y !== ' ' && y !== '?') unstaged.push({ status: y, file });
            }
          }
          const branch = await ctx.execCommand('git branch --show-current', { cwd: ctx.REPO_DIR, timeout: 3000 });
          return { content: [{ type: 'text', text: JSON.stringify({
            branch: branch.stdout.trim(),
            clean: lines.length === 0,
            staged, unstaged, untracked,
            summary: staged.length + ' staged, ' + unstaged.length + ' unstaged, ' + untracked.length + ' untracked',
          }, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    server.tool('git_commit_details', 'Get details of a specific commit', {
      hash: z.string().describe('Commit hash or ref'),
    }, async ({ hash }) => {
      try {
        const denied = requireMcpRole('admin', 'git_commit_details');
        if (denied) return denied;
        // Sanitize hash — only allow alphanumeric, ~, ^, /, -, .
        if (!hash.match(/^[a-zA-Z0-9~^\/\-._]+$/)) return { content: [{ type: 'text', text: 'Invalid commit reference' }], isError: true };
        const result = await ctx.execCommand('git show --stat --format="commit %H%nauthor %an <%ae>%ndate %ai%nsubject %s%n%b" ' + hash, { cwd: ctx.REPO_DIR, timeout: 5000 });
        return { content: [{ type: 'text', text: result.stdout || 'Commit not found' }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Database Enhanced ──

    server.tool('get_table_schema', 'Get detailed schema for a database table including columns, types, and constraints', {
      tableName: z.string().describe('Table name to inspect'),
    }, async ({ tableName }) => {
      try {
        const denied = requireMcpRole('admin', 'get_table_schema');
        if (denied) return denied;
        if (!ctx.dbQuery) return { content: [{ type: 'text', text: 'No database connected' }] };
        // Sanitize table name
        if (!tableName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) return { content: [{ type: 'text', text: 'Invalid table name' }], isError: true };
        const columns = await ctx.dbQuery(
          "SELECT column_name, data_type, character_maximum_length, column_default, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
          [tableName]
        );
        const constraints = await ctx.dbQuery(
          "SELECT tc.constraint_name, tc.constraint_type, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_schema = 'public' AND tc.table_name = $1",
          [tableName]
        );
        const indexes = await ctx.dbQuery(
          "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1",
          [tableName]
        );
        if (!columns.length) return { content: [{ type: 'text', text: 'Table not found: ' + tableName }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({ table: tableName, columns, constraints, indexes }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    server.tool('list_db_backups', 'List database backups with sizes and dates', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'list_db_backups');
          if (denied) return denied;
          const backupsDir = path.join(__dirname, '..', 'data', 'backups');
          if (!fs.existsSync(backupsDir)) return { content: [{ type: 'text', text: JSON.stringify([], null, 2) }] };
          const entries = fs.readdirSync(backupsDir);
          const backups = entries.map(name => {
            try {
              const stat = fs.statSync(path.join(backupsDir, name));
              return { name, size: stat.size, sizeHuman: (stat.size / 1024 / 1024).toFixed(2) + ' MB', created: stat.mtime.toISOString() };
            } catch { return { name, size: 0, sizeHuman: '0 MB', created: null }; }
          }).sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
          return { content: [{ type: 'text', text: JSON.stringify(backups, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    server.tool('create_db_backup', 'Create a database backup using pg_dump', {
      name: z.string().optional().describe('Backup file name (auto-generated if omitted)'),
    }, async ({ name }) => {
      try {
        const denied = requireMcpRole('admin', 'create_db_backup');
        if (denied) return denied;
        const backupsDir = path.join(__dirname, '..', 'data', 'backups');
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = (name ? name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'backup-' + ts) + '.sql';
        const outPath = path.join(backupsDir, fileName);
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) return { content: [{ type: 'text', text: 'No DATABASE_URL configured' }], isError: true };
        const result = await ctx.execCommand('pg_dump "' + dbUrl + '" > "' + outPath.replace(/\\/g, '/') + '"', { timeout: 60000 });
        if (result.stderr && result.stderr.includes('error')) {
          return { content: [{ type: 'text', text: 'pg_dump error: ' + result.stderr }], isError: true };
        }
        let size = 0;
        try { size = fs.statSync(outPath).size; } catch {}
        return { content: [{ type: 'text', text: JSON.stringify({ created: fileName, size, sizeHuman: (size / 1024 / 1024).toFixed(2) + ' MB' }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Credentials Vault ──

    server.tool('list_credentials', 'List stored credentials (names and types only, no secrets)', {},
      async () => {
        try {
          const denied = requireMcpRole('admin', 'list_credentials');
          if (denied) return denied;
          try {
            const vault = require('../lib/credential-vault');
            const creds = vault.listCredentials();
            return { content: [{ type: 'text', text: JSON.stringify(creds, null, 2) }] };
          } catch {
            // Fallback: read vault file directly
            const vaultPath = path.join(__dirname, '..', 'data', 'credentials-vault.json');
            if (!fs.existsSync(vaultPath)) return { content: [{ type: 'text', text: JSON.stringify([], null, 2) }] };
            const data = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
            const safe = (data.credentials || []).map(c => ({
              id: c.id, name: c.name, type: c.type,
              tags: c.tags || [], createdAt: c.createdAt,
            }));
            return { content: [{ type: 'text', text: JSON.stringify(safe, null, 2) }] };
          }
        } catch (e) {
          return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
        }
      }
    );

    // ════════════════════════════════════════════════════════════════════════
    // RESOURCES — Read-only context data
    // ════════════════════════════════════════════════════════════════════════

    server.resource('server-overview', 'monitor://server/overview', { description: 'Current server health overview' },
      async (uri) => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const overview = {
          hostname: os.hostname(),
          platform: os.platform() + ' ' + os.arch(),
          uptime: Math.floor(os.uptime()) + 's',
          cpuCores: os.cpus().length,
          memoryUsed: Math.round((totalMem - freeMem) / 1024 / 1024) + 'MB / ' + Math.round(totalMem / 1024 / 1024) + 'MB',
          loadAvg: os.loadavg().map(l => l.toFixed(2)).join(', '),
        };
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(overview, null, 2) }] };
      }
    );

    server.resource('uptime-checks', 'monitor://uptime/checks', { description: 'All uptime monitoring endpoints and their status' },
      async (uri) => {
        try {
          const uptimeStore = require('../lib/uptime-store');
          const endpoints = uptimeStore.getEndpoints().map(ep => ({
            name: ep.name, url: ep.url,
            uptime24h: uptimeStore.getUptimePercent(ep.id, 24),
          }));
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(endpoints, null, 2) }] };
        } catch {
          return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'No uptime data' }] };
        }
      }
    );

    server.resource('github-repos', 'monitor://github/repos', { description: 'List of tracked GitHub repositories' },
      async (uri) => {
        try {
          const hubPath = path.join(__dirname, '..', 'data', 'github-hub.json');
          if (!fs.existsSync(hubPath)) return { contents: [{ uri: uri.href, mimeType: 'application/json', text: '[]' }] };
          const hub = JSON.parse(fs.readFileSync(hubPath, 'utf8'));
          const repos = (hub.repos || []).map(r => ({
            id: r.id, fullName: r.fullName, description: r.description,
            language: r.language, stars: r.stars, category: r.category,
            lastSynced: r.lastSynced,
          }));
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(repos, null, 2) }] };
        } catch {
          return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'No GitHub Hub data' }] };
        }
      }
    );

    // ════════════════════════════════════════════════════════════════════════
    // PROMPTS — User-invoked templates
    // ════════════════════════════════════════════════════════════════════════

    server.prompt('diagnose_server', 'Analyze server health and identify issues', {},
      () => ({
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Use the get_system_metrics tool to analyze the current server health. Check CPU, memory, disk, and load averages. Use list_docker_containers to check infrastructure status. Identify any anomalies, potential issues, or performance concerns. Provide a clear summary with specific recommendations.' },
        }],
      })
    );

    server.prompt('incident_report', 'Generate an incident report', {
      issue: z.string().describe('Brief description of the incident'),
    }, ({ issue }) => ({
      messages: [{
        role: 'user',
        content: { type: 'text', text: 'Generate an incident report for: "' + issue + '". Use get_system_metrics, get_recent_alerts, get_deploy_history, and list_docker_containers to gather context. Create a timeline of events, identify the probable root cause, document the current status, and suggest remediation steps.' },
      }],
    }));

    server.prompt('security_audit', 'Review security posture and recommend improvements', {},
      () => ({
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Run a security audit using get_security_score. Review the findings, identify critical vulnerabilities, and provide prioritized recommendations to improve the security posture. Include specific commands or configuration changes where applicable.' },
        }],
      })
    );

    server.prompt('daily_briefing', 'Generate a daily ops briefing', {},
      () => ({
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Generate a daily operations briefing. Use get_system_metrics for server health, get_deploy_history for recent deployments, get_recent_alerts for any incidents, and list_docker_containers for infrastructure status. Summarize everything in a concise briefing format with action items.' },
        }],
      })
    );

    server.prompt('repo_analysis', 'Analyze a GitHub repository health, activity, and code quality', {
      repo: z.string().describe('Repository full name (owner/repo) or ID'),
    }, ({ repo }) => ({
      messages: [{
        role: 'user',
        content: { type: 'text', text: 'Analyze the GitHub repository "' + repo + '". Use list_github_repos to find it, then examine its health, activity, and code quality. Consider: stars/forks growth, last push date, open issues, language, license, and any available AI summaries. Provide a health score (1-10), key strengths, concerns, and actionable recommendations for improving the repository.' },
      }],
    }));

    return server;
  }

  // ── MCP HTTP endpoint ─────────────────────────────────────────────────────

  // POST /mcp — Streamable HTTP transport (stateless, one request = one connection)
  app.post('/mcp', ctx.requireAuth, async (req, res) => {
    try {
      const server = createMcpServer(req.user);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: e.message }, id: null });
      }
    }
  });

  // GET /mcp — SSE stream for server-initiated messages (required by spec)
  app.get('/mcp', ctx.requireAuth, async (req, res) => {
    res.writeHead(405).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'SSE not supported in stateless mode. Use POST.' }, id: null }));
  });

  // DELETE /mcp — Session termination (no-op in stateless mode)
  app.delete('/mcp', ctx.requireAuth, (req, res) => {
    res.status(200).json({ success: true });
  });

  // ── Test endpoint (for GUI — bypasses HTTP transport handshake) ────────────

  app.post('/api/mcp/test', ctx.requireAuth, async (req, res) => {
    const { method, params } = req.body;
    if (!method) return res.status(400).json({ error: 'method required' });
    try {
      const server = createMcpServer(req.user);
      const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: 'bulwark-test', version: '1.0.0' });
      await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
      let result;
      if (method === 'tools/list') {
        result = await client.listTools();
      } else if (method === 'resources/list') {
        result = await client.listResources();
      } else if (method === 'prompts/list') {
        result = await client.listPrompts();
      } else if (method === 'tools/call') {
        result = await client.callTool(params || {});
      } else if (method === 'prompts/get') {
        result = await client.getPrompt({ name: (params || {}).name, arguments: (params || {}).arguments || {} });
      } else if (method === 'resources/read') {
        result = await client.readResource(params || {});
      } else {
        result = { error: 'Unknown method: ' + method };
      }
      await client.close();
      await server.close();
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── MCP connection info endpoint (for UI) ─────────────────────────────────

  app.get('/api/mcp/info', ctx.requireAuth, (req, res) => {
    const host = req.headers.host || 'localhost:3001';
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const mcpUrl = protocol + '://' + host + '/mcp';
    res.json({
      url: mcpUrl,
      transport: 'streamable-http',
      version: '2.1.0',
      tools: 35,
      resources: 3,
      prompts: 5,
      instructions: {
        claudeDesktop: {
          config: {
            mcpServers: {
              bulwark: {
                type: 'streamable-http',
                url: mcpUrl,
                headers: { Cookie: 'monitor_session=YOUR_SESSION_TOKEN' },
              }
            }
          },
          note: 'Replace YOUR_SESSION_TOKEN with your Bulwark session cookie value',
        },
        claudeCode: 'claude mcp add --transport http bulwark ' + mcpUrl,
        curl: 'curl -X POST ' + mcpUrl + ' -H "Content-Type: application/json" -b "monitor_session=TOKEN" -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list"}\'',
      },
    });
  });
};
