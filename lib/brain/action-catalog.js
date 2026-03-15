'use strict';

const ACTIONS = [
  // ── Infrastructure ────────────────────────────────────────────────────
  { id: 'view-docker', name: 'Docker Containers', category: 'infrastructure', intentKeywords: ['docker', 'container', 'image', 'compose', 'dockerfile'], intentPatterns: [/docker/i, /container/i], targetSection: 'docker', riskLevel: 'low' },
  { id: 'view-servers', name: 'Servers', category: 'infrastructure', intentKeywords: ['server', 'host', 'node', 'remote', 'instance', 'vm'], intentPatterns: [/server/i, /host/i, /instance/i], targetSection: 'servers', riskLevel: 'low' },
  { id: 'view-cloudflare', name: 'Cloudflare DNS', category: 'infrastructure', intentKeywords: ['dns', 'cloudflare', 'domain', 'record', 'tunnel'], intentPatterns: [/dns/i, /cloudflare/i], targetSection: 'cloudflare', riskLevel: 'low' },
  { id: 'view-multi-server', name: 'Multi-Server', category: 'infrastructure', intentKeywords: ['multi-server', 'fleet', 'cluster', 'remote server', 'all servers'], intentPatterns: [/multi.?server/i, /fleet/i, /all server/i], targetSection: 'multi-server', riskLevel: 'low' },

  // ── Database ──────────────────────────────────────────────────────────
  { id: 'view-db', name: 'Database Studio', category: 'database', intentKeywords: ['database', 'sql', 'query', 'postgres', 'table', 'schema'], intentPatterns: [/database/i, /sql/i, /postgres/i], targetSection: 'sql-editor', riskLevel: 'low' },
  { id: 'view-tables', name: 'Table Browser', category: 'database', intentKeywords: ['table', 'columns', 'rows', 'browse', 'data'], intentPatterns: [/table/i, /column/i, /browse/i], targetSection: 'tables', riskLevel: 'low' },
  { id: 'view-schema', name: 'Schema Viewer', category: 'database', intentKeywords: ['schema', 'erd', 'relations', 'foreign key', 'constraints'], intentPatterns: [/schema/i, /erd/i, /constraint/i], targetSection: 'schema', riskLevel: 'low' },
  { id: 'view-migrations', name: 'Migrations', category: 'database', intentKeywords: ['migration', 'migrate', 'alter', 'version', 'schema change'], intentPatterns: [/migrat/i, /alter/i], targetSection: 'migrations', riskLevel: 'medium' },
  { id: 'view-roles', name: 'Database Roles', category: 'database', intentKeywords: ['role', 'user', 'permission', 'grant', 'privilege', 'access'], intentPatterns: [/role/i, /grant/i, /privilege/i], targetSection: 'roles', riskLevel: 'low' },
  { id: 'view-db-projects', name: 'Database Projects', category: 'database', intentKeywords: ['project', 'connection', 'db project', 'connect'], intentPatterns: [/db.?project/i, /connection/i], targetSection: 'db-projects', riskLevel: 'low' },
  { id: 'view-db-assistant', name: 'DB Assistant', category: 'database', intentKeywords: ['db assistant', 'ai sql', 'generate query', 'explain query'], intentPatterns: [/db.?assist/i, /ai.?sql/i, /explain.?query/i], targetSection: 'db-assistant', riskLevel: 'low' },
  { id: 'view-backups', name: 'Database Backups', category: 'database', intentKeywords: ['backup', 'restore', 'dump', 'disaster', 'recovery'], intentPatterns: [/backup/i, /restore/i, /dump/i], targetSection: 'db-backups', riskLevel: 'medium' },
  { id: 'view-databases', name: 'Databases Overview', category: 'database', intentKeywords: ['databases', 'db overview', 'all databases'], intentPatterns: [/databases/i], targetSection: 'databases', riskLevel: 'low' },

  // ── DevOps ────────────────────────────────────────────────────────────
  { id: 'view-terminal', name: 'Terminal', category: 'system', intentKeywords: ['terminal', 'shell', 'bash', 'ssh', 'command'], intentPatterns: [/terminal/i, /shell/i, /ssh/i], targetSection: 'terminal', riskLevel: 'low' },
  { id: 'view-git', name: 'Git Operations', category: 'devops', intentKeywords: ['git', 'commit', 'push', 'pull', 'branch', 'merge', 'pr'], intentPatterns: [/git/i, /commit/i, /branch/i], targetSection: 'git', riskLevel: 'low' },
  { id: 'view-github', name: 'GitHub Hub', category: 'devops', intentKeywords: ['github', 'repo', 'repository', 'pull request', 'issue', 'actions'], intentPatterns: [/github/i, /repo/i, /pull.?request/i], targetSection: 'github-hub', riskLevel: 'low' },
  { id: 'view-deploy', name: 'Deployment', category: 'devops', intentKeywords: ['deploy', 'rollback', 'release', 'pipeline', 'ci/cd'], intentPatterns: [/deploy/i, /rollback/i, /release/i], targetSection: 'deploy', riskLevel: 'medium' },
  { id: 'view-cron', name: 'Cron Jobs', category: 'system', intentKeywords: ['cron', 'schedule', 'job', 'timer', 'recurring'], intentPatterns: [/cron/i, /schedul/i], targetSection: 'cron', riskLevel: 'low' },
  { id: 'view-files', name: 'File Manager', category: 'system', intentKeywords: ['file', 'directory', 'folder', 'path', 'edit'], intentPatterns: [/file/i, /director/i], targetSection: 'files', riskLevel: 'low' },
  { id: 'view-envvars', name: 'Environment Variables', category: 'config', intentKeywords: ['env', 'environment', 'variable', 'config', 'secret'], intentPatterns: [/env\b/i, /environment/i, /variable/i], targetSection: 'envvars', riskLevel: 'medium' },

  // ── Monitoring ────────────────────────────────────────────────────────
  { id: 'view-metrics', name: 'System Metrics', category: 'monitoring', intentKeywords: ['cpu', 'memory', 'disk', 'metrics', 'performance', 'load'], intentPatterns: [/metric/i, /cpu|memory|disk/i], targetSection: 'metrics', riskLevel: 'low' },
  { id: 'view-uptime', name: 'Uptime Monitoring', category: 'monitoring', intentKeywords: ['uptime', 'health', 'status', 'monitoring', 'check'], intentPatterns: [/uptime/i, /health/i, /monitor/i], targetSection: 'uptime', riskLevel: 'low' },
  { id: 'view-dashboard', name: 'Dashboard', category: 'monitoring', intentKeywords: ['dashboard', 'overview', 'summary', 'home'], intentPatterns: [/dashboard/i, /overview/i, /summary/i], targetSection: 'dashboard', riskLevel: 'low' },
  { id: 'view-logs', name: 'Logs', category: 'monitoring', intentKeywords: ['log', 'logs', 'output', 'stdout', 'stderr', 'error log'], intentPatterns: [/\blog/i, /stdout|stderr/i], targetSection: 'logs', riskLevel: 'low' },

  // ── Security ──────────────────────────────────────────────────────────
  { id: 'view-ssl', name: 'SSL/TLS Certificates', category: 'security', intentKeywords: ['ssl', 'tls', 'certificate', 'https', 'cert'], intentPatterns: [/ssl|tls/i, /certif/i], targetSection: 'ssl', riskLevel: 'low' },
  { id: 'view-security', name: 'Security Center', category: 'security', intentKeywords: ['security', 'audit', 'vulnerability', 'hardening', 'firewall'], intentPatterns: [/secur/i, /audit/i, /harden/i], targetSection: 'security', riskLevel: 'low' },
  { id: 'view-ftp', name: 'FTP Management', category: 'security', intentKeywords: ['ftp', 'sftp', 'file transfer', 'upload', 'download'], intentPatterns: [/ftp/i, /sftp/i, /file.?transfer/i], targetSection: 'ftp', riskLevel: 'low' },

  // ── AI ────────────────────────────────────────────────────────────────
  { id: 'view-agents', name: 'AI Agents', category: 'ai', intentKeywords: ['agent', 'automate', 'analyze', 'optimize', 'audit'], intentPatterns: [/agent/i, /automat/i], targetSection: 'agents', riskLevel: 'low' },
  { id: 'view-flows', name: 'AI Flows', category: 'ai', intentKeywords: ['flow', 'workflow', 'pipeline', 'dag', 'orchestrate', 'chain'], intentPatterns: [/flow/i, /workflow/i, /orchestrat/i], targetSection: 'flows', riskLevel: 'low' },
  { id: 'view-mcp', name: 'MCP Tools', category: 'ai', intentKeywords: ['mcp', 'tool', 'model context', 'integration'], intentPatterns: [/mcp/i, /model.?context/i], targetSection: 'mcp', riskLevel: 'low' },

  // ── System ────────────────────────────────────────────────────────────
  { id: 'view-pm2', name: 'Process Manager', category: 'system', intentKeywords: ['pm2', 'process', 'service', 'daemon', 'restart'], intentPatterns: [/pm2/i, /process/i, /service/i], targetSection: 'pm2', riskLevel: 'low' },
  { id: 'view-settings', name: 'Settings', category: 'system', intentKeywords: ['settings', 'configure', 'setup', 'ollama', 'provider'], intentPatterns: [/setting/i, /configur/i, /ollama/i], targetSection: 'settings', riskLevel: 'low' },
  { id: 'view-cache', name: 'Cache Dashboard', category: 'system', intentKeywords: ['cache', 'neural cache', 'hit rate', 'eviction', 'ttl'], intentPatterns: [/cache/i, /hit.?rate/i, /evict/i], targetSection: 'cache', riskLevel: 'low' },
  { id: 'view-notifications', name: 'Notifications', category: 'system', intentKeywords: ['notification', 'alert', 'notify', 'bell', 'message'], intentPatterns: [/notif/i, /alert/i], targetSection: 'notifications', riskLevel: 'low' },
  { id: 'view-tickets', name: 'Support Tickets', category: 'system', intentKeywords: ['ticket', 'issue', 'support', 'bug', 'request'], intentPatterns: [/ticket/i, /issue/i, /support/i], targetSection: 'tickets', riskLevel: 'low' },

  // ── Workspace ─────────────────────────────────────────────────────────
  { id: 'view-calendar', name: 'Calendar', category: 'workspace', intentKeywords: ['calendar', 'event', 'meeting', 'schedule', 'appointment'], intentPatterns: [/calendar/i, /event/i, /meeting/i], targetSection: 'calendar', riskLevel: 'low' },
  { id: 'view-notes', name: 'Notes', category: 'workspace', intentKeywords: ['note', 'notes', 'memo', 'documentation', 'write'], intentPatterns: [/notes?/i, /memo/i], targetSection: 'notes', riskLevel: 'low' },
  { id: 'view-docs', name: 'Documentation', category: 'workspace', intentKeywords: ['docs', 'documentation', 'help', 'guide', 'manual'], intentPatterns: [/docs?/i, /documentation/i, /guide/i], targetSection: 'docs', riskLevel: 'low' },
];

function matchIntent(query) {
  if (!query) return [];
  const lower = query.toLowerCase();
  const scored = [];

  for (const action of ACTIONS) {
    let score = 0;
    for (const pattern of action.intentPatterns) {
      if (pattern.test(lower)) score += 20;
    }
    for (const keyword of action.intentKeywords) {
      if (lower.includes(keyword)) score += 10;
    }
    if (score > 0) scored.push({ ...action, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

function getSuggestedActions(section) {
  return ACTIONS.filter(a => a.targetSection === section).slice(0, 3);
}

module.exports = { ACTIONS, matchIntent, getSuggestedActions };
