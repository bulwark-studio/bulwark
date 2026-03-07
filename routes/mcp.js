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

module.exports = function (app, ctx) {

  // ── Build the MCP server with all tools/resources/prompts ───────────────

  function createMcpServer() {
    const server = new McpServer({
      name: 'bulwark-monitor',
      version: '2.1.0',
      instructions: 'Bulwark server monitoring and management. Use tools to check system health, manage Docker containers, query databases, handle tickets, and deploy code.',
    });

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
        const docker = require('../lib/docker-engine');
        const containers = await docker.listContainers(all);
        const summary = containers.map(c => ({
          id: (c.Id || '').substring(0, 12),
          name: (c.Names || ['/unknown'])[0].replace(/^\//, ''),
          image: c.Image,
          state: c.State,
          status: c.Status,
          ports: (c.Ports || []).map(p => (p.PublicPort || '') + ':' + (p.PrivatePort || '')).join(', '),
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
        const docker = require('../lib/docker-engine');
        const logs = await docker.getContainerLogs(containerId, tail);
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
        const docker = require('../lib/docker-engine');
        await docker.containerAction(containerId, action);
        return { content: [{ type: 'text', text: 'Container ' + containerId + ' ' + action + 'ed successfully' }] };
      } catch (e) {
        return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
      }
    });

    // ── Database ──

    server.tool('list_database_tables', 'List all tables in the connected database', {},
      async () => {
        try {
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
        if (!ctx.dbQuery) return { content: [{ type: 'text', text: 'No database connected' }] };
        const trimmed = sql.trim().toUpperCase();
        if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH') && !trimmed.startsWith('EXPLAIN')) {
          return { content: [{ type: 'text', text: 'Only SELECT, WITH, and EXPLAIN queries are allowed via MCP for safety.' }], isError: true };
        }
        const safeSql = sql.replace(/;\s*$/, '') + ' LIMIT ' + limit;
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
        const where = status === 'all' ? '' : " WHERE status = '" + status + "'";
        const tickets = await ctx.dbQuery('SELECT id, subject, status, priority, created_at FROM support_tickets' + where + ' ORDER BY created_at DESC LIMIT 20');
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
          // Use internal fetch to hit our own security endpoint
          const http = require('http');
          return new Promise((resolve) => {
            const req = http.get('http://localhost:' + (process.env.MONITOR_PORT || 3001) + '/api/security/posture', (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                try {
                  const parsed = JSON.parse(data);
                  resolve({ content: [{ type: 'text', text: JSON.stringify(parsed, null, 2) }] });
                } catch {
                  resolve({ content: [{ type: 'text', text: data }] });
                }
              });
            });
            req.on('error', (e) => resolve({ content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true }));
            req.setTimeout(10000, () => { req.destroy(); resolve({ content: [{ type: 'text', text: 'Security scan timed out' }], isError: true }); });
          });
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

    // ════════════════════════════════════════════════════════════════════════
    // PROMPTS — User-invoked templates
    // ════════════════════════════════════════════════════════════════════════

    server.prompt('diagnose_server', 'Analyze server health and identify issues', {},
      () => ({
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Use the get_system_metrics and get_process_list tools to analyze the current server health. Check CPU, memory, disk, and load averages. Identify any anomalies, potential issues, or performance concerns. Provide a clear summary with specific recommendations.' },
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
          content: { type: 'text', text: 'Generate a daily operations briefing. Use get_system_metrics for server health, get_uptime_status for endpoint availability, get_deploy_history for recent deployments, get_recent_alerts for any incidents, and list_docker_containers for infrastructure status. Summarize everything in a concise briefing format with action items.' },
        }],
      })
    );

    return server;
  }

  // ── MCP HTTP endpoint ─────────────────────────────────────────────────────

  // POST /mcp — Streamable HTTP transport (stateless, one request = one connection)
  app.post('/mcp', ctx.requireAuth, async (req, res) => {
    try {
      const server = createMcpServer();
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

  // ── MCP connection info endpoint (for UI) ─────────────────────────────────

  app.get('/api/mcp/info', ctx.requireAuth, (req, res) => {
    const host = req.headers.host || 'localhost:3001';
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const mcpUrl = protocol + '://' + host + '/mcp';
    res.json({
      url: mcpUrl,
      transport: 'streamable-http',
      version: '2.1.0',
      tools: 16,
      resources: 2,
      prompts: 4,
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
