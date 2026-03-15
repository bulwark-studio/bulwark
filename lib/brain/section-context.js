'use strict';

const SECTIONS = {
  // ── Overview ──────────────────────────────────────────────────────────
  dashboard: { name: 'Dashboard', description: 'System overview with key metrics, recent activity, and health status.', capabilities: ['view metrics', 'check uptime', 'recent activity'] },
  metrics: { name: 'System Metrics', description: 'Real-time CPU, memory, disk, and network metrics with charts.', capabilities: ['view CPU usage', 'check memory', 'disk space', 'load average'] },
  uptime: { name: 'Uptime Monitoring', description: 'HTTP endpoint monitoring with uptime percentages and alerts.', capabilities: ['add endpoints', 'view uptime history', 'content monitoring', 'web scraping'] },

  // ── AI ────────────────────────────────────────────────────────────────
  agents: { name: 'AI Agents', description: 'Run AI-powered DevOps agents for analysis and automation.', capabilities: ['run agents', 'view results', 'create custom agents'] },
  flows: { name: 'AI Flows', description: 'DAG-based workflow engine for chaining AI agents, LLM calls, HTTP requests, and conditions.', capabilities: ['create flows', 'execute workflows', 'view run history', 'condition branching'] },
  mcp: { name: 'MCP Tools', description: 'Model Context Protocol server exposing 37 tools for external AI integration. Resources, prompts, and RBAC.', capabilities: ['list tools', 'test tools', 'view resources', 'manage prompts'] },
  brain: { name: 'Brain Chat', description: 'AI-powered DevOps assistant with context-aware knowledge base.', capabilities: ['ask questions', 'get recommendations', 'KB search'] },

  // ── Infrastructure ────────────────────────────────────────────────────
  docker: { name: 'Docker', description: 'Docker container management with logs, stats, and image layer inspection.', capabilities: ['list containers', 'view logs', 'start/stop containers', 'inspect images', 'layer analysis'] },
  servers: { name: 'Servers', description: 'Multi-server management with health checks.', capabilities: ['add servers', 'health checks', 'remote monitoring'] },
  'multi-server': { name: 'Multi-Server', description: 'Fleet-wide management across multiple servers with centralized metrics and commands.', capabilities: ['fleet overview', 'cross-server commands', 'aggregate metrics'] },
  ssl: { name: 'SSL/TLS', description: 'SSL certificate management and monitoring.', capabilities: ['view certificates', 'renewal status', 'TLS configuration'] },
  cloudflare: { name: 'Cloudflare', description: 'Cloudflare DNS records and tunnel management.', capabilities: ['manage DNS', 'tunnels', 'page rules'] },
  pm2: { name: 'Process Manager', description: 'PM2 process management for Node.js applications.', capabilities: ['list processes', 'restart', 'logs', 'monitoring'] },

  // ── Database ──────────────────────────────────────────────────────────
  databases: { name: 'Databases Overview', description: 'Overview of all connected database projects and their status.', capabilities: ['view all databases', 'connection status', 'quick stats'] },
  'db-projects': { name: 'Database Projects', description: 'Manage multiple PostgreSQL database connections with per-project pools.', capabilities: ['add connections', 'test connectivity', 'switch projects'] },
  'sql-editor': { name: 'SQL Editor', description: 'CodeMirror-powered SQL editor with autocomplete and query history.', capabilities: ['execute SQL', 'saved queries', 'AI SQL generation'] },
  tables: { name: 'Table Browser', description: 'Browse database tables with schema, data, constraints, and indexes.', capabilities: ['view schema', 'browse data', 'view constraints'] },
  schema: { name: 'Schema Viewer', description: 'Visualize database schema with tables, relationships, and indexes.', capabilities: ['view ERD', 'inspect foreign keys', 'view indexes', 'column details'] },
  migrations: { name: 'Migrations', description: 'Database migration management for schema versioning and changes.', capabilities: ['view migrations', 'run migrations', 'rollback'] },
  roles: { name: 'Database Roles', description: 'PostgreSQL role and permission management.', capabilities: ['view roles', 'manage grants', 'audit privileges'] },
  'db-backups': { name: 'Database Backups', description: 'Database backup management with pg_dump and restore.', capabilities: ['create backup', 'restore', 'AI strategy'] },
  'db-assistant': { name: 'DB Assistant', description: 'AI-powered SQL assistant for query generation, optimization, and explanation.', capabilities: ['generate SQL', 'explain queries', 'optimize performance', 'suggest indexes'] },

  // ── DevOps ────────────────────────────────────────────────────────────
  terminal: { name: 'Terminal', description: 'Full PTY terminal emulation via xterm.js.', capabilities: ['run commands', 'SSH access', 'system administration'] },
  git: { name: 'Git Operations', description: 'Multi-repo management with diff, log, branches, and AI assistance.', capabilities: ['commit', 'push', 'pull', 'branch', 'AI commit messages', 'PR descriptions'] },
  'github-hub': { name: 'GitHub Hub', description: 'GitHub repository management with tracking, reports, and sync.', capabilities: ['track repos', 'view reports', 'sync repos', 'PR management'] },
  deploy: { name: 'Deployment', description: 'Deployment pipeline with rollback and history.', capabilities: ['deploy', 'rollback', 'view history', 'deployment pipeline'] },
  cron: { name: 'Cron Jobs', description: 'Cron job management with scheduling UI.', capabilities: ['create jobs', 'edit schedule', 'view logs'] },
  files: { name: 'File Manager', description: 'File browser with editor and permissions management.', capabilities: ['browse files', 'edit files', 'permissions'] },
  envvars: { name: 'Environment Variables', description: 'Encrypted environment variable management.', capabilities: ['view vars', 'add vars', 'edit vars'] },

  // ── Security ──────────────────────────────────────────────────────────
  security: { name: 'Security Center', description: 'Security scanning, reports, and hardening recommendations.', capabilities: ['security scan', 'view reports', 'hardening checklist'] },
  ftp: { name: 'FTP Management', description: 'FTP and SFTP file transfer operations.', capabilities: ['upload files', 'download files', 'manage connections'] },
  notifications: { name: 'Notifications', description: 'Alert and notification management with delivery channels.', capabilities: ['view alerts', 'configure channels', 'notification history'] },

  // ── Workspace ─────────────────────────────────────────────────────────
  calendar: { name: 'Calendar', description: 'Event scheduling and calendar management.', capabilities: ['view events', 'create events', 'schedule meetings'] },
  notes: { name: 'Notes', description: 'Note-taking and documentation workspace.', capabilities: ['create notes', 'organize notes', 'search notes'] },

  // ── System ────────────────────────────────────────────────────────────
  cache: { name: 'Cache Dashboard', description: 'Neural cache monitoring with hit rates, heatmap, and AI analysis.', capabilities: ['view cache stats', 'flush cache', 'view heatmap', 'AI analysis'] },
  logs: { name: 'Logs', description: 'Application and system log viewer with filtering and search.', capabilities: ['view logs', 'filter by level', 'search logs', 'real-time tail'] },
  settings: { name: 'Settings', description: 'Application settings including AI provider configuration.', capabilities: ['configure AI', 'set Ollama URL', 'manage providers'] },
  docs: { name: 'Documentation', description: 'Bulwark platform documentation and help guides.', capabilities: ['browse docs', 'search help', 'view guides'] },
  tickets: { name: 'Support Tickets', description: 'Issue tracking and support ticket management.', capabilities: ['create tickets', 'view tickets', 'track status', 'reply to tickets'] },
};

function getSectionContext(sectionId) {
  return SECTIONS[sectionId] || null;
}

module.exports = { SECTIONS, getSectionContext };
