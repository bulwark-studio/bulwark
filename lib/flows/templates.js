'use strict';

const crypto = require('crypto');

/**
 * Generate a deterministic ID for template nodes/edges
 */
function tid(prefix, idx) {
  return prefix + '-' + idx;
}

/**
 * Built-in flow templates
 */
var templates = [
  // ── 1. Server Health Check ──────────────────────────────────────
  {
    id: 'tpl-server-health-check',
    name: 'Server Health Check',
    slug: 'server-health-check',
    description: 'Check an HTTP endpoint and notify if it is down. Start -> HTTP request -> Condition (status ok?) -> Notify (if down) -> End.',
    category: 'monitoring',
    trigger_type: 'schedule',
    trigger_config: { cron: '*/5 * * * *', description: 'Every 5 minutes' },
    error_strategy: 'retry',
    timeout_ms: 60000,
    variables: { endpoint: 'https://example.com/health' },
    nodes: [
      { id: 'shc-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'shc-2', type: 'http', label: 'Check Endpoint', position: { x: 0, y: 1 }, config: { url: '{{_variables.endpoint}}', method: 'GET', timeout: 10000 } },
      { id: 'shc-3', type: 'condition', label: 'Status OK?', position: { x: 0, y: 2 }, config: { expression: 'shc-2.statusCode === 200' } },  // fix: use === not ==
      { id: 'shc-4', type: 'notify', label: 'Alert: Server Down', position: { x: -1, y: 3 }, config: { message: 'Server health check FAILED for {{_variables.endpoint}} - Status: {{shc-2.statusCode}}', channel: 'internal' } },
      { id: 'shc-5', type: 'end', label: 'End', position: { x: 0, y: 4 }, config: {} },
    ],
    edges: [
      { source: 'shc-1', target: 'shc-2', label: '' },
      { source: 'shc-2', target: 'shc-3', label: '' },
      { source: 'shc-3', target: 'shc-4', label: 'false' },
      { source: 'shc-3', target: 'shc-5', label: 'true' },
      { source: 'shc-4', target: 'shc-5', label: '' },
    ],
  },

  // ── 2. Deploy Pipeline ──────────────────────────────────────────
  {
    id: 'tpl-deploy-pipeline',
    name: 'Deploy Pipeline',
    slug: 'deploy-pipeline',
    description: 'Plan a deployment with an AI agent, evaluate approval, generate deployment commands, and notify. Includes conditional approval gate.',
    category: 'deployment',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'stop',
    timeout_ms: 300000,
    variables: { project: 'my-app', environment: 'production' },
    nodes: [
      { id: 'dp-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'dp-2', type: 'agent', label: 'Deploy Planner', position: { x: 0, y: 1 }, config: { agentSlug: 'deploy-planner', input: 'Plan deployment for project {{_variables.project}} to {{_variables.environment}}' } },
      { id: 'dp-3', type: 'condition', label: 'Approved?', position: { x: 0, y: 2 }, config: { expression: 'dp-2.status === ok' } },
      { id: 'dp-4', type: 'llm', label: 'Generate Commands', position: { x: 0, y: 3 }, config: { prompt: 'Based on the deployment plan, generate the exact shell commands needed to deploy {{_variables.project}} to {{_variables.environment}}. Be precise and include rollback steps.', systemPrompt: 'You are a senior DevOps engineer. Generate safe, production-ready deployment commands.' } },
      { id: 'dp-5', type: 'notify', label: 'Notify Team', position: { x: 0, y: 4 }, config: { message: 'Deployment pipeline completed for {{_variables.project}} to {{_variables.environment}}', channel: 'internal' } },
      { id: 'dp-6', type: 'notify', label: 'Notify Rejected', position: { x: -1, y: 3 }, config: { message: 'Deployment REJECTED for {{_variables.project}} to {{_variables.environment}}', channel: 'internal' } },
      { id: 'dp-7', type: 'end', label: 'End', position: { x: 0, y: 5 }, config: {} },
    ],
    edges: [
      { source: 'dp-1', target: 'dp-2', label: '' },
      { source: 'dp-2', target: 'dp-3', label: '' },
      { source: 'dp-3', target: 'dp-4', label: 'true' },
      { source: 'dp-3', target: 'dp-6', label: 'false' },
      { source: 'dp-4', target: 'dp-5', label: '' },
      { source: 'dp-5', target: 'dp-7', label: '' },
      { source: 'dp-6', target: 'dp-7', label: '' },
    ],
  },

  // ── 3. Database Backup ──────────────────────────────────────────
  {
    id: 'tpl-database-backup',
    name: 'Database Backup',
    slug: 'database-backup',
    description: 'Run a database backup agent, wait for completion, verify the backup via HTTP, and notify with results.',
    category: 'database',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 2 * * *', description: 'Daily at 2 AM' },
    error_strategy: 'retry',
    timeout_ms: 600000,
    variables: { backup_verify_url: 'https://example.com/api/backups/latest' },
    nodes: [
      { id: 'db-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'db-2', type: 'agent', label: 'Backup Strategist', position: { x: 0, y: 1 }, config: { agentSlug: 'backup-strategist', input: 'Create a database backup strategy and execute backup procedures' } },
      { id: 'db-3', type: 'delay', label: 'Wait for Backup', position: { x: 0, y: 2 }, config: { delayMs: 5000 } },
      { id: 'db-4', type: 'http', label: 'Verify Backup', position: { x: 0, y: 3 }, config: { url: '{{_variables.backup_verify_url}}', method: 'GET', timeout: 15000 } },
      { id: 'db-5', type: 'notify', label: 'Backup Report', position: { x: 0, y: 4 }, config: { message: 'Database backup completed. Verification status: {{db-4.statusCode}}', channel: 'internal' } },
      { id: 'db-6', type: 'end', label: 'End', position: { x: 0, y: 5 }, config: {} },
    ],
    edges: [
      { source: 'db-1', target: 'db-2', label: '' },
      { source: 'db-2', target: 'db-3', label: '' },
      { source: 'db-3', target: 'db-4', label: '' },
      { source: 'db-4', target: 'db-5', label: '' },
      { source: 'db-5', target: 'db-6', label: '' },
    ],
  },

  // ── 4. Security Audit ───────────────────────────────────────────
  {
    id: 'tpl-security-audit',
    name: 'Security Audit',
    slug: 'security-audit',
    description: 'Run multiple security agents in sequence (server hardening, SSL audit), then summarize findings with LLM and notify.',
    category: 'security',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'skip',
    timeout_ms: 600000,
    variables: {},
    nodes: [
      { id: 'sa-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'sa-2', type: 'agent', label: 'Server Hardener', position: { x: 0, y: 1 }, config: { agentSlug: 'server-hardener', input: 'Perform a comprehensive server hardening audit. Check SSH config, firewall rules, open ports, and system permissions.' } },
      { id: 'sa-3', type: 'agent', label: 'SSL Auditor', position: { x: 0, y: 2 }, config: { agentSlug: 'ssl-auditor', input: 'Audit SSL/TLS configuration. Check certificate validity, cipher suites, and protocol versions.' } },
      { id: 'sa-4', type: 'llm', label: 'Summarize Findings', position: { x: 0, y: 3 }, config: { prompt: 'Summarize the security audit findings from both the server hardening and SSL audit steps. Prioritize issues by severity (critical, high, medium, low). Provide actionable recommendations.', systemPrompt: 'You are a senior security analyst. Create a concise, actionable security audit report.' } },
      { id: 'sa-5', type: 'notify', label: 'Audit Report', position: { x: 0, y: 4 }, config: { message: 'Security audit completed. Review the findings in the flow run details.', channel: 'internal' } },
      { id: 'sa-6', type: 'end', label: 'End', position: { x: 0, y: 5 }, config: {} },
    ],
    edges: [
      { source: 'sa-1', target: 'sa-2', label: '' },
      { source: 'sa-2', target: 'sa-3', label: '' },
      { source: 'sa-3', target: 'sa-4', label: '' },
      { source: 'sa-4', target: 'sa-5', label: '' },
      { source: 'sa-5', target: 'sa-6', label: '' },
    ],
  },

  // ── 5. Incident Response ────────────────────────────────────────
  {
    id: 'tpl-incident-response',
    name: 'Incident Response',
    slug: 'incident-response',
    description: 'Respond to incidents: triage with an agent, evaluate severity, notify the team, and generate a runbook with LLM.',
    category: 'devops',
    trigger_type: 'webhook',
    trigger_config: { path: '/hooks/incident' },
    error_strategy: 'stop',
    timeout_ms: 300000,
    variables: { severity_threshold: '3' },
    nodes: [
      { id: 'ir-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'ir-2', type: 'agent', label: 'Incident Triage', position: { x: 0, y: 1 }, config: { agentSlug: 'incident-responder', input: 'Triage the following incident. Determine severity, affected systems, and initial response steps.' } },
      { id: 'ir-3', type: 'condition', label: 'High Severity?', position: { x: 0, y: 2 }, config: { expression: 'ir-2.status === ok' } },
      { id: 'ir-4', type: 'notify', label: 'Alert Team', position: { x: 0, y: 3 }, config: { message: 'HIGH SEVERITY INCIDENT detected. Immediate action required. See flow run for details.', channel: 'internal' } },
      { id: 'ir-5', type: 'llm', label: 'Generate Runbook', position: { x: 0, y: 4 }, config: { prompt: 'Based on the incident triage results, generate a step-by-step runbook for resolving this incident. Include rollback procedures, communication templates, and post-mortem checklist.', systemPrompt: 'You are a senior SRE. Generate a comprehensive incident response runbook.' } },
      { id: 'ir-6', type: 'notify', label: 'Low Priority Note', position: { x: -1, y: 3 }, config: { message: 'Low-severity incident logged. Review when available.', channel: 'internal' } },
      { id: 'ir-7', type: 'end', label: 'End', position: { x: 0, y: 5 }, config: {} },
    ],
    edges: [
      { source: 'ir-1', target: 'ir-2', label: '' },
      { source: 'ir-2', target: 'ir-3', label: '' },
      { source: 'ir-3', target: 'ir-4', label: 'true' },
      { source: 'ir-3', target: 'ir-6', label: 'false' },
      { source: 'ir-4', target: 'ir-5', label: '' },
      { source: 'ir-5', target: 'ir-7', label: '' },
      { source: 'ir-6', target: 'ir-7', label: '' },
    ],
  },

  // ── 6. Full Server Audit ──────────────────────────────────────
  {
    id: 'tpl-full-server-audit',
    name: 'Full Server Audit',
    slug: 'full-server-audit',
    description: 'Comprehensive server audit combining hardening, SSL, and compliance checks. Agents run in sequence, findings are summarized by LLM, and a full audit report is sent.',
    category: 'security',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'skip',
    timeout_ms: 900000,
    variables: {},
    nodes: [
      { id: 'fsa-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'fsa-2', type: 'agent', label: 'Server Hardener', position: { x: 200, y: 0 }, config: { agentSlug: 'server-hardener', input: 'Perform a full server hardening audit including SSH, firewall, open ports, and file permissions.' } },
      { id: 'fsa-3', type: 'agent', label: 'SSL Auditor', position: { x: 400, y: 0 }, config: { agentSlug: 'ssl-auditor', input: 'Audit all SSL/TLS configurations, certificate chains, cipher suites, and protocol versions.' } },
      { id: 'fsa-4', type: 'agent', label: 'Compliance Auditor', position: { x: 600, y: 0 }, config: { agentSlug: 'compliance-auditor', input: 'Run compliance checks against CIS benchmarks and organizational security policies.' } },
      { id: 'fsa-5', type: 'llm', label: 'Summarize All Findings', position: { x: 800, y: 0 }, config: { prompt: 'Consolidate findings from server hardening, SSL audit, and compliance audit. Rank all issues by severity and provide a unified remediation plan.', systemPrompt: 'You are a senior security architect. Produce a comprehensive audit report with prioritized findings.' } },
      { id: 'fsa-6', type: 'notify', label: 'Send Audit Report', position: { x: 1000, y: 0 }, config: { message: 'Full server audit completed. Review the consolidated findings in the flow run details.', channel: 'internal' } },
      { id: 'fsa-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'fsa-1', target: 'fsa-2', label: '' },
      { source: 'fsa-2', target: 'fsa-3', label: '' },
      { source: 'fsa-3', target: 'fsa-4', label: '' },
      { source: 'fsa-4', target: 'fsa-5', label: '' },
      { source: 'fsa-5', target: 'fsa-6', label: '' },
      { source: 'fsa-6', target: 'fsa-7', label: '' },
    ],
  },

  // ── 7. CI/CD Pipeline Review ──────────────────────────────────
  {
    id: 'tpl-ci-cd-pipeline-review',
    name: 'CI/CD Pipeline Review',
    slug: 'ci-cd-pipeline-review',
    description: 'Review CI/CD pipeline configuration for security and best practices. If security issues are found, run compliance checks and generate fix recommendations.',
    category: 'devops',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'stop',
    timeout_ms: 300000,
    variables: { pipeline: 'main' },
    nodes: [
      { id: 'cpr-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'cpr-2', type: 'agent', label: 'CI/CD Builder', position: { x: 200, y: 0 }, config: { agentSlug: 'cicd-builder', input: 'Analyze the CI/CD pipeline configuration for {{_variables.pipeline}}. Identify security issues, misconfigurations, and optimization opportunities.' } },
      { id: 'cpr-3', type: 'condition', label: 'Has Security Issues?', position: { x: 400, y: 0 }, config: { expression: 'cpr-2.hasSecurityIssues === true' } },
      { id: 'cpr-4', type: 'agent', label: 'Compliance Auditor', position: { x: 600, y: -1 }, config: { agentSlug: 'compliance-auditor', input: 'Audit the CI/CD pipeline against security compliance standards. Review secrets management, artifact signing, and access controls.' } },
      { id: 'cpr-5', type: 'llm', label: 'Generate Fix Recommendations', position: { x: 800, y: 0 }, config: { prompt: 'Based on the CI/CD review and compliance audit findings, generate specific fix recommendations with code examples for each issue found.', systemPrompt: 'You are a DevSecOps engineer. Provide actionable pipeline security fixes.' } },
      { id: 'cpr-6', type: 'notify', label: 'Notify Team', position: { x: 1000, y: 0 }, config: { message: 'CI/CD pipeline review completed for {{_variables.pipeline}}. Check flow run for recommendations.', channel: 'internal' } },
      { id: 'cpr-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'cpr-1', target: 'cpr-2', label: '' },
      { source: 'cpr-2', target: 'cpr-3', label: '' },
      { source: 'cpr-3', target: 'cpr-4', label: 'true' },
      { source: 'cpr-3', target: 'cpr-5', label: 'false' },
      { source: 'cpr-4', target: 'cpr-5', label: '' },
      { source: 'cpr-5', target: 'cpr-6', label: '' },
      { source: 'cpr-6', target: 'cpr-7', label: '' },
    ],
  },

  // ── 8. Database Maintenance ───────────────────────────────────
  {
    id: 'tpl-database-maintenance',
    name: 'Database Maintenance',
    slug: 'database-maintenance',
    description: 'Automated database maintenance flow. Tune the database, check if vacuum is needed, wait for low traffic, run backups, and generate a maintenance report.',
    category: 'database',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 3 * * 0', description: 'Every Sunday at 3 AM' },
    error_strategy: 'retry',
    timeout_ms: 900000,
    variables: { db_name: 'production' },
    nodes: [
      { id: 'dm-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'dm-2', type: 'agent', label: 'DB Tuner', position: { x: 200, y: 0 }, config: { agentSlug: 'db-tuner', input: 'Analyze database {{_variables.db_name}} performance. Check query plans, index usage, bloat levels, and connection pool health.' } },
      { id: 'dm-3', type: 'condition', label: 'Needs Vacuum?', position: { x: 400, y: 0 }, config: { expression: 'dm-2.needsVacuum === true' } },
      { id: 'dm-4', type: 'delay', label: 'Wait for Low Traffic', position: { x: 600, y: -1 }, config: { delayMs: 30000 } },
      { id: 'dm-5', type: 'agent', label: 'Backup Strategist', position: { x: 800, y: 0 }, config: { agentSlug: 'backup-strategist', input: 'Create a pre-maintenance backup of {{_variables.db_name}} and verify backup integrity.' } },
      { id: 'dm-6', type: 'llm', label: 'Generate Maintenance Report', position: { x: 1000, y: 0 }, config: { prompt: 'Generate a database maintenance report covering: tuning analysis, vacuum status, backup verification, and recommended follow-up actions for {{_variables.db_name}}.', systemPrompt: 'You are a senior DBA. Produce a clear, actionable maintenance report.' } },
      { id: 'dm-7', type: 'notify', label: 'Send Report', position: { x: 1200, y: 0 }, config: { message: 'Database maintenance completed for {{_variables.db_name}}. See flow run for full report.', channel: 'internal' } },
      { id: 'dm-8', type: 'end', label: 'End', position: { x: 1400, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'dm-1', target: 'dm-2', label: '' },
      { source: 'dm-2', target: 'dm-3', label: '' },
      { source: 'dm-3', target: 'dm-4', label: 'true' },
      { source: 'dm-3', target: 'dm-5', label: 'false' },
      { source: 'dm-4', target: 'dm-5', label: '' },
      { source: 'dm-5', target: 'dm-6', label: '' },
      { source: 'dm-6', target: 'dm-7', label: '' },
      { source: 'dm-7', target: 'dm-8', label: '' },
    ],
  },

  // ── 9. Cost Optimization Sweep ────────────────────────────────
  {
    id: 'tpl-cost-optimization-sweep',
    name: 'Cost Optimization Sweep',
    slug: 'cost-optimization-sweep',
    description: 'Analyze cloud costs and capacity, identify savings opportunities over $100/month, generate an executive summary, and notify stakeholders.',
    category: 'cloud',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 8 1 * *', description: 'First day of each month at 8 AM' },
    error_strategy: 'stop',
    timeout_ms: 600000,
    variables: { savings_threshold: 100 },
    nodes: [
      { id: 'cos-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'cos-2', type: 'agent', label: 'Cost Analyzer', position: { x: 200, y: 0 }, config: { agentSlug: 'cost-analyzer', input: 'Analyze current cloud spend across all services. Identify unused resources, oversized instances, and reservation opportunities.' } },
      { id: 'cos-3', type: 'agent', label: 'Capacity Planner', position: { x: 400, y: 0 }, config: { agentSlug: 'capacity-planner', input: 'Review current capacity utilization and identify right-sizing opportunities without impacting performance.' } },
      { id: 'cos-4', type: 'condition', label: 'Savings > $100/mo?', position: { x: 600, y: 0 }, config: { expression: 'cos-2.monthlySavings > 100' } },
      { id: 'cos-5', type: 'llm', label: 'Generate Executive Summary', position: { x: 800, y: 0 }, config: { prompt: 'Create an executive summary of cloud cost optimization opportunities. Include: current monthly spend, potential savings, top 5 recommendations ranked by impact, and implementation timeline.', systemPrompt: 'You are a FinOps specialist. Produce a clear executive summary with dollar figures and ROI estimates.' } },
      { id: 'cos-6', type: 'notify', label: 'Notify Stakeholders', position: { x: 1000, y: 0 }, config: { message: 'Cost optimization sweep completed. Significant savings identified. Review the executive summary in flow run details.', channel: 'internal' } },
      { id: 'cos-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'cos-1', target: 'cos-2', label: '' },
      { source: 'cos-2', target: 'cos-3', label: '' },
      { source: 'cos-3', target: 'cos-4', label: '' },
      { source: 'cos-4', target: 'cos-5', label: 'true' },
      { source: 'cos-4', target: 'cos-7', label: 'false' },
      { source: 'cos-5', target: 'cos-6', label: '' },
      { source: 'cos-6', target: 'cos-7', label: '' },
    ],
  },

  // ── 10. Kubernetes Health Check ───────────────────────────────
  {
    id: 'tpl-kubernetes-health-check',
    name: 'Kubernetes Health Check',
    slug: 'kubernetes-health-check',
    description: 'Run a Kubernetes cluster health check, triage critical issues, set up monitoring for problem areas, and generate a remediation plan.',
    category: 'devops',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 */6 * * *', description: 'Every 6 hours' },
    error_strategy: 'retry',
    timeout_ms: 300000,
    variables: { cluster: 'production' },
    nodes: [
      { id: 'khc-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'khc-2', type: 'agent', label: 'K8s Advisor', position: { x: 200, y: 0 }, config: { agentSlug: 'k8s-advisor', input: 'Perform a health check on Kubernetes cluster {{_variables.cluster}}. Check node status, pod health, resource utilization, and pending deployments.' } },
      { id: 'khc-3', type: 'condition', label: 'Critical Issues?', position: { x: 400, y: 0 }, config: { expression: 'khc-2.hasCriticalIssues === true' } },
      { id: 'khc-4', type: 'agent', label: 'Monitoring Setup', position: { x: 600, y: -1 }, config: { agentSlug: 'monitoring-setup', input: 'Configure enhanced monitoring and alerts for the critical issues found in cluster {{_variables.cluster}}.' } },
      { id: 'khc-5', type: 'llm', label: 'Generate Remediation Plan', position: { x: 800, y: 0 }, config: { prompt: 'Based on the Kubernetes health check results, generate a prioritized remediation plan. Include kubectl commands, resource adjustments, and scaling recommendations.', systemPrompt: 'You are a Kubernetes platform engineer. Provide specific, executable remediation steps.' } },
      { id: 'khc-6', type: 'notify', label: 'Notify Team', position: { x: 1000, y: 0 }, config: { message: 'Kubernetes health check completed for cluster {{_variables.cluster}}. Review remediation plan in flow run details.', channel: 'internal' } },
      { id: 'khc-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'khc-1', target: 'khc-2', label: '' },
      { source: 'khc-2', target: 'khc-3', label: '' },
      { source: 'khc-3', target: 'khc-4', label: 'true' },
      { source: 'khc-3', target: 'khc-5', label: 'false' },
      { source: 'khc-4', target: 'khc-5', label: '' },
      { source: 'khc-5', target: 'khc-6', label: '' },
      { source: 'khc-6', target: 'khc-7', label: '' },
    ],
  },

  // ── 11. Network Security Scan ─────────────────────────────────
  {
    id: 'tpl-network-security-scan',
    name: 'Network Security Scan',
    slug: 'network-security-scan',
    description: 'Multi-agent network security scan covering architecture review, SSL audit, and server hardening. Findings are correlated by LLM for a unified threat assessment.',
    category: 'security',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'skip',
    timeout_ms: 900000,
    variables: {},
    nodes: [
      { id: 'nss-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'nss-2', type: 'agent', label: 'Network Architect', position: { x: 200, y: 0 }, config: { agentSlug: 'network-architect', input: 'Review network architecture, segmentation, firewall rules, and VPN configurations. Identify attack surface and lateral movement risks.' } },
      { id: 'nss-3', type: 'agent', label: 'SSL Auditor', position: { x: 400, y: 0 }, config: { agentSlug: 'ssl-auditor', input: 'Scan all network endpoints for SSL/TLS vulnerabilities, expired certificates, and weak cipher suites.' } },
      { id: 'nss-4', type: 'agent', label: 'Server Hardener', position: { x: 600, y: 0 }, config: { agentSlug: 'server-hardener', input: 'Check all network-facing servers for hardening issues, open ports, and unnecessary services.' } },
      { id: 'nss-5', type: 'llm', label: 'Correlate Findings', position: { x: 800, y: 0 }, config: { prompt: 'Correlate findings from the network architecture review, SSL audit, and server hardening scan. Identify attack chains, compound vulnerabilities, and provide a unified threat assessment with risk scores.', systemPrompt: 'You are a network security specialist. Produce a correlated threat assessment report.' } },
      { id: 'nss-6', type: 'notify', label: 'Send Scan Results', position: { x: 1000, y: 0 }, config: { message: 'Network security scan completed. Correlated threat assessment available in flow run details.', channel: 'internal' } },
      { id: 'nss-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'nss-1', target: 'nss-2', label: '' },
      { source: 'nss-2', target: 'nss-3', label: '' },
      { source: 'nss-3', target: 'nss-4', label: '' },
      { source: 'nss-4', target: 'nss-5', label: '' },
      { source: 'nss-5', target: 'nss-6', label: '' },
      { source: 'nss-6', target: 'nss-7', label: '' },
    ],
  },

  // ── 12. Disaster Recovery Test ────────────────────────────────
  {
    id: 'tpl-disaster-recovery-test',
    name: 'Disaster Recovery Test',
    slug: 'disaster-recovery-test',
    description: 'End-to-end disaster recovery test. Verify backups, run chaos engineering scenarios, simulate an outage, validate recovery, and generate a DR report.',
    category: 'devops',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'stop',
    timeout_ms: 1200000,
    variables: { recovery_target_minutes: 30 },
    nodes: [
      { id: 'drt-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'drt-2', type: 'agent', label: 'Backup Strategist', position: { x: 200, y: 0 }, config: { agentSlug: 'backup-strategist', input: 'Verify all backup systems are operational and latest backups are valid. Check backup freshness and integrity checksums.' } },
      { id: 'drt-3', type: 'agent', label: 'Chaos Engineer', position: { x: 400, y: 0 }, config: { agentSlug: 'chaos-engineer', input: 'Design and execute a controlled failure scenario. Simulate service outages, data corruption, and network partitions.' } },
      { id: 'drt-4', type: 'delay', label: 'Simulate Outage Window', position: { x: 600, y: 0 }, config: { delayMs: 60000 } },
      { id: 'drt-5', type: 'condition', label: 'Recovery Successful?', position: { x: 800, y: 0 }, config: { expression: 'drt-3.recoverySuccessful === true' } },
      { id: 'drt-6', type: 'llm', label: 'Generate DR Report', position: { x: 1000, y: 0 }, config: { prompt: 'Generate a disaster recovery test report. Include: RTO/RPO measurements vs targets (target: {{_variables.recovery_target_minutes}} min), failure scenarios tested, recovery steps executed, gaps identified, and improvement recommendations.', systemPrompt: 'You are a disaster recovery specialist. Produce a comprehensive DR test report with metrics.' } },
      { id: 'drt-7', type: 'notify', label: 'Notify Team', position: { x: 1200, y: 0 }, config: { message: 'Disaster recovery test completed. Review DR report in flow run details.', channel: 'internal' } },
      { id: 'drt-8', type: 'end', label: 'End', position: { x: 1400, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'drt-1', target: 'drt-2', label: '' },
      { source: 'drt-2', target: 'drt-3', label: '' },
      { source: 'drt-3', target: 'drt-4', label: '' },
      { source: 'drt-4', target: 'drt-5', label: '' },
      { source: 'drt-5', target: 'drt-6', label: 'true' },
      { source: 'drt-5', target: 'drt-6', label: 'false' },
      { source: 'drt-6', target: 'drt-7', label: '' },
      { source: 'drt-7', target: 'drt-8', label: '' },
    ],
  },

  // ── 13. Terraform Deploy Review ───────────────────────────────
  {
    id: 'tpl-terraform-deploy-review',
    name: 'Terraform Deploy Review',
    slug: 'terraform-deploy-review',
    description: 'Review Terraform plans for security and best practices before deployment. Run compliance checks if issues are found, generate a plan review, and notify.',
    category: 'cloud',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'stop',
    timeout_ms: 300000,
    variables: { workspace: 'production' },
    nodes: [
      { id: 'tdr-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'tdr-2', type: 'agent', label: 'Terraform Reviewer', position: { x: 200, y: 0 }, config: { agentSlug: 'terraform-reviewer', input: 'Review the Terraform plan for workspace {{_variables.workspace}}. Check for security misconfigurations, cost implications, and blast radius.' } },
      { id: 'tdr-3', type: 'condition', label: 'Security Issues?', position: { x: 400, y: 0 }, config: { expression: 'tdr-2.hasSecurityIssues === true' } },
      { id: 'tdr-4', type: 'agent', label: 'Compliance Auditor', position: { x: 600, y: -1 }, config: { agentSlug: 'compliance-auditor', input: 'Audit the Terraform plan against compliance policies. Check resource tagging, encryption settings, and network exposure.' } },
      { id: 'tdr-5', type: 'llm', label: 'Generate Plan Review', position: { x: 800, y: 0 }, config: { prompt: 'Generate a Terraform plan review summary for workspace {{_variables.workspace}}. Include: resources to be created/modified/destroyed, security assessment, cost impact estimate, and approval recommendation.', systemPrompt: 'You are a cloud infrastructure engineer. Provide a clear, decision-ready Terraform plan review.' } },
      { id: 'tdr-6', type: 'notify', label: 'Notify Team', position: { x: 1000, y: 0 }, config: { message: 'Terraform deploy review completed for workspace {{_variables.workspace}}. Check flow run for plan review.', channel: 'internal' } },
      { id: 'tdr-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'tdr-1', target: 'tdr-2', label: '' },
      { source: 'tdr-2', target: 'tdr-3', label: '' },
      { source: 'tdr-3', target: 'tdr-4', label: 'true' },
      { source: 'tdr-3', target: 'tdr-5', label: 'false' },
      { source: 'tdr-4', target: 'tdr-5', label: '' },
      { source: 'tdr-5', target: 'tdr-6', label: '' },
      { source: 'tdr-6', target: 'tdr-7', label: '' },
    ],
  },

  // ── 14. Incident Triage Flow ──────────────────────────────────
  {
    id: 'tpl-incident-triage-flow',
    name: 'Incident Triage Flow',
    slug: 'incident-triage-flow',
    description: 'Automated incident triage with severity assessment. SEV2+ incidents trigger runbook generation and incident communications drafting.',
    category: 'monitoring',
    trigger_type: 'webhook',
    trigger_config: { path: '/hooks/incident-triage' },
    error_strategy: 'stop',
    timeout_ms: 300000,
    variables: { severity_threshold: 'SEV2' },
    nodes: [
      { id: 'itf-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'itf-2', type: 'agent', label: 'Incident Responder', position: { x: 200, y: 0 }, config: { agentSlug: 'incident-responder', input: 'Triage the incoming incident. Classify severity, identify affected services, and determine blast radius.' } },
      { id: 'itf-3', type: 'condition', label: 'Severity >= SEV2?', position: { x: 400, y: 0 }, config: { expression: 'itf-2.severity <= 2' } },
      { id: 'itf-4', type: 'agent', label: 'Runbook Generator', position: { x: 600, y: -1 }, config: { agentSlug: 'runbook-generator', input: 'Generate an incident-specific runbook based on the triage findings. Include diagnostic commands, escalation paths, and recovery steps.' } },
      { id: 'itf-5', type: 'llm', label: 'Draft Incident Comms', position: { x: 800, y: 0 }, config: { prompt: 'Draft incident communications including: internal status update for engineering, customer-facing status page update, and executive summary. Tailor tone and detail level for each audience.', systemPrompt: 'You are an incident communications specialist. Draft clear, calm, and informative incident updates.' } },
      { id: 'itf-6', type: 'notify', label: 'Notify Team', position: { x: 1000, y: 0 }, config: { message: 'Incident triage completed. Severity assessment and communications drafts available in flow run details.', channel: 'internal' } },
      { id: 'itf-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'itf-1', target: 'itf-2', label: '' },
      { source: 'itf-2', target: 'itf-3', label: '' },
      { source: 'itf-3', target: 'itf-4', label: 'true' },
      { source: 'itf-3', target: 'itf-5', label: 'false' },
      { source: 'itf-4', target: 'itf-5', label: '' },
      { source: 'itf-5', target: 'itf-6', label: '' },
      { source: 'itf-6', target: 'itf-7', label: '' },
    ],
  },

  // ── 15. Migration Readiness ───────────────────────────────────
  {
    id: 'tpl-migration-readiness',
    name: 'Migration Readiness',
    slug: 'migration-readiness',
    description: 'Assess migration readiness by running planning, network, and capacity agents. Evaluate readiness and generate a comprehensive migration plan.',
    category: 'cloud',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'stop',
    timeout_ms: 900000,
    variables: { target_environment: 'aws', project: 'core-platform' },
    nodes: [
      { id: 'mr-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'mr-2', type: 'agent', label: 'Migration Planner', position: { x: 200, y: 0 }, config: { agentSlug: 'migration-planner', input: 'Assess migration readiness for {{_variables.project}} to {{_variables.target_environment}}. Inventory dependencies, data volumes, and service integrations.' } },
      { id: 'mr-3', type: 'agent', label: 'Network Architect', position: { x: 400, y: 0 }, config: { agentSlug: 'network-architect', input: 'Design the target network architecture for {{_variables.target_environment}}. Plan VPC layout, subnets, peering, and DNS strategy.' } },
      { id: 'mr-4', type: 'agent', label: 'Capacity Planner', position: { x: 600, y: 0 }, config: { agentSlug: 'capacity-planner', input: 'Calculate capacity requirements for {{_variables.project}} in {{_variables.target_environment}}. Size compute, storage, and networking resources.' } },
      { id: 'mr-5', type: 'condition', label: 'Ready?', position: { x: 800, y: 0 }, config: { expression: 'mr-2.readinessScore >= 80' } },
      { id: 'mr-6', type: 'llm', label: 'Generate Migration Plan', position: { x: 1000, y: 0 }, config: { prompt: 'Generate a comprehensive migration plan for {{_variables.project}} to {{_variables.target_environment}}. Include: phased timeline, resource mapping, risk register, rollback strategy, and success criteria.', systemPrompt: 'You are a cloud migration architect. Produce a detailed, executable migration plan.' } },
      { id: 'mr-7', type: 'notify', label: 'Notify Stakeholders', position: { x: 1200, y: 0 }, config: { message: 'Migration readiness assessment completed for {{_variables.project}}. Migration plan available in flow run details.', channel: 'internal' } },
      { id: 'mr-8', type: 'end', label: 'End', position: { x: 1400, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'mr-1', target: 'mr-2', label: '' },
      { source: 'mr-2', target: 'mr-3', label: '' },
      { source: 'mr-3', target: 'mr-4', label: '' },
      { source: 'mr-4', target: 'mr-5', label: '' },
      { source: 'mr-5', target: 'mr-6', label: 'true' },
      { source: 'mr-5', target: 'mr-6', label: 'false' },
      { source: 'mr-6', target: 'mr-7', label: '' },
      { source: 'mr-7', target: 'mr-8', label: '' },
    ],
  },

  // ── 16. Docker Optimization Pipeline ──────────────────────────
  {
    id: 'tpl-docker-optimization-pipeline',
    name: 'Docker Optimization Pipeline',
    slug: 'docker-optimization-pipeline',
    description: 'Optimize Docker images and configurations. Scan for security issues, harden if needed, and generate optimized Dockerfiles.',
    category: 'devops',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'stop',
    timeout_ms: 300000,
    variables: { image: 'app:latest' },
    nodes: [
      { id: 'dop-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'dop-2', type: 'agent', label: 'Docker Optimizer', position: { x: 200, y: 0 }, config: { agentSlug: 'docker-optimizer', input: 'Analyze Docker image {{_variables.image}}. Check image size, layer count, base image freshness, and build efficiency.' } },
      { id: 'dop-3', type: 'condition', label: 'Security Issues?', position: { x: 400, y: 0 }, config: { expression: 'dop-2.hasSecurityIssues === true' } },
      { id: 'dop-4', type: 'agent', label: 'Server Hardener', position: { x: 600, y: -1 }, config: { agentSlug: 'server-hardener', input: 'Harden the Docker image {{_variables.image}}. Remove unnecessary packages, fix file permissions, and apply security best practices.' } },
      { id: 'dop-5', type: 'llm', label: 'Generate Optimized Dockerfile', position: { x: 800, y: 0 }, config: { prompt: 'Based on the Docker analysis and security findings, generate an optimized Dockerfile for {{_variables.image}}. Use multi-stage builds, minimize layers, pin versions, and follow security best practices.', systemPrompt: 'You are a Docker specialist. Generate production-ready, optimized Dockerfiles with inline comments.' } },
      { id: 'dop-6', type: 'notify', label: 'Notify Team', position: { x: 1000, y: 0 }, config: { message: 'Docker optimization completed for {{_variables.image}}. Optimized Dockerfile available in flow run details.', channel: 'internal' } },
      { id: 'dop-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'dop-1', target: 'dop-2', label: '' },
      { source: 'dop-2', target: 'dop-3', label: '' },
      { source: 'dop-3', target: 'dop-4', label: 'true' },
      { source: 'dop-3', target: 'dop-5', label: 'false' },
      { source: 'dop-4', target: 'dop-5', label: '' },
      { source: 'dop-5', target: 'dop-6', label: '' },
      { source: 'dop-6', target: 'dop-7', label: '' },
    ],
  },

  // ── 17. Monitoring Bootstrap ──────────────────────────────────
  {
    id: 'tpl-monitoring-bootstrap',
    name: 'Monitoring Bootstrap',
    slug: 'monitoring-bootstrap',
    description: 'Bootstrap monitoring for a new service. Set up monitoring agents, analyze existing logs, generate alerting rules, and notify the team.',
    category: 'monitoring',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'stop',
    timeout_ms: 300000,
    variables: { service: 'my-service' },
    nodes: [
      { id: 'mb-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'mb-2', type: 'agent', label: 'Monitoring Setup', position: { x: 200, y: 0 }, config: { agentSlug: 'monitoring-setup', input: 'Set up comprehensive monitoring for {{_variables.service}}. Configure metrics collection, health checks, and dashboards.' } },
      { id: 'mb-3', type: 'agent', label: 'Log Analyzer', position: { x: 400, y: 0 }, config: { agentSlug: 'log-analyzer', input: 'Analyze existing logs for {{_variables.service}}. Identify error patterns, latency anomalies, and baseline normal behavior.' } },
      { id: 'mb-4', type: 'llm', label: 'Generate Alerting Rules', position: { x: 600, y: 0 }, config: { prompt: 'Based on the monitoring setup and log analysis for {{_variables.service}}, generate alerting rules in Prometheus/Alertmanager format. Include: error rate thresholds, latency p99 alerts, saturation alerts, and appropriate severity levels.', systemPrompt: 'You are an SRE specialist. Generate production-ready alerting rules with appropriate thresholds and runbook links.' } },
      { id: 'mb-5', type: 'notify', label: 'Notify Team', position: { x: 800, y: 0 }, config: { message: 'Monitoring bootstrap completed for {{_variables.service}}. Alerting rules and dashboards available in flow run details.', channel: 'internal' } },
      { id: 'mb-6', type: 'end', label: 'End', position: { x: 1000, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'mb-1', target: 'mb-2', label: '' },
      { source: 'mb-2', target: 'mb-3', label: '' },
      { source: 'mb-3', target: 'mb-4', label: '' },
      { source: 'mb-4', target: 'mb-5', label: '' },
      { source: 'mb-5', target: 'mb-6', label: '' },
    ],
  },

  // ── 18. API Security Review ───────────────────────────────────
  {
    id: 'tpl-api-security-review',
    name: 'API Security Review',
    slug: 'api-security-review',
    description: 'Comprehensive API security review covering gateway configuration, SSL/TLS, and compliance. Generates a unified API security report.',
    category: 'security',
    trigger_type: 'manual',
    trigger_config: {},
    error_strategy: 'skip',
    timeout_ms: 600000,
    variables: { api_base_url: 'https://api.example.com' },
    nodes: [
      { id: 'asr-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'asr-2', type: 'agent', label: 'API Gateway Architect', position: { x: 200, y: 0 }, config: { agentSlug: 'api-gateway-architect', input: 'Review API gateway configuration at {{_variables.api_base_url}}. Check rate limiting, authentication, CORS policies, input validation, and API versioning.' } },
      { id: 'asr-3', type: 'agent', label: 'SSL Auditor', position: { x: 400, y: 0 }, config: { agentSlug: 'ssl-auditor', input: 'Audit SSL/TLS configuration for {{_variables.api_base_url}}. Check certificate pinning, HSTS headers, and TLS version support.' } },
      { id: 'asr-4', type: 'agent', label: 'Compliance Auditor', position: { x: 600, y: 0 }, config: { agentSlug: 'compliance-auditor', input: 'Audit API endpoints against OWASP API Security Top 10 and organizational data handling policies.' } },
      { id: 'asr-5', type: 'llm', label: 'Generate API Security Report', position: { x: 800, y: 0 }, config: { prompt: 'Consolidate all API security findings into a comprehensive report. Cover: authentication/authorization gaps, data exposure risks, injection vulnerabilities, rate limiting adequacy, and compliance status. Prioritize by CVSS-like severity.', systemPrompt: 'You are an application security engineer specializing in API security. Produce a detailed, actionable API security assessment.' } },
      { id: 'asr-6', type: 'notify', label: 'Send Report', position: { x: 1000, y: 0 }, config: { message: 'API security review completed for {{_variables.api_base_url}}. Full security report available in flow run details.', channel: 'internal' } },
      { id: 'asr-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'asr-1', target: 'asr-2', label: '' },
      { source: 'asr-2', target: 'asr-3', label: '' },
      { source: 'asr-3', target: 'asr-4', label: '' },
      { source: 'asr-4', target: 'asr-5', label: '' },
      { source: 'asr-5', target: 'asr-6', label: '' },
      { source: 'asr-6', target: 'asr-7', label: '' },
    ],
  },

  // ── 19. Capacity Forecast ─────────────────────────────────────
  {
    id: 'tpl-capacity-forecast',
    name: 'Capacity Forecast',
    slug: 'capacity-forecast',
    description: 'Forecast capacity needs and cost implications. Plan capacity, analyze costs, check budget constraints, and generate a forecast report.',
    category: 'monitoring',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 9 * * 1', description: 'Every Monday at 9 AM' },
    error_strategy: 'stop',
    timeout_ms: 600000,
    variables: { budget_monthly: 50000, forecast_months: 6 },
    nodes: [
      { id: 'cf-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'cf-2', type: 'agent', label: 'Capacity Planner', position: { x: 200, y: 0 }, config: { agentSlug: 'capacity-planner', input: 'Analyze current resource utilization trends and forecast capacity needs for the next {{_variables.forecast_months}} months. Consider seasonal patterns and growth projections.' } },
      { id: 'cf-3', type: 'agent', label: 'Cost Analyzer', position: { x: 400, y: 0 }, config: { agentSlug: 'cost-analyzer', input: 'Calculate cost projections based on the capacity forecast. Include reserved instance opportunities, spot instance savings, and vendor discount programs.' } },
      { id: 'cf-4', type: 'condition', label: 'Budget Exceeded?', position: { x: 600, y: 0 }, config: { expression: 'cf-3.projectedMonthlyCost > _variables.budget_monthly' } },
      { id: 'cf-5', type: 'llm', label: 'Generate Forecast Report', position: { x: 800, y: 0 }, config: { prompt: 'Generate a {{_variables.forecast_months}}-month capacity and cost forecast report. Include: resource utilization trends, growth projections, cost trajectory, budget status (limit: ${{_variables.budget_monthly}}/mo), and optimization recommendations if budget is exceeded.', systemPrompt: 'You are a capacity planning specialist. Produce a data-driven forecast with clear visualizable metrics and actionable recommendations.' } },
      { id: 'cf-6', type: 'notify', label: 'Notify Stakeholders', position: { x: 1000, y: 0 }, config: { message: 'Capacity forecast report generated. Review projections and budget analysis in flow run details.', channel: 'internal' } },
      { id: 'cf-7', type: 'end', label: 'End', position: { x: 1200, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'cf-1', target: 'cf-2', label: '' },
      { source: 'cf-2', target: 'cf-3', label: '' },
      { source: 'cf-3', target: 'cf-4', label: '' },
      { source: 'cf-4', target: 'cf-5', label: 'true' },
      { source: 'cf-4', target: 'cf-5', label: 'false' },
      { source: 'cf-5', target: 'cf-6', label: '' },
      { source: 'cf-6', target: 'cf-7', label: '' },
    ],
  },

  // ── 20. Full-Stack Health Check ───────────────────────────────
  {
    id: 'tpl-full-stack-health-check',
    name: 'Full-Stack Health Check',
    slug: 'full-stack-health-check',
    description: 'Comprehensive full-stack health check covering server hardening, database tuning, Docker optimization, and monitoring. Produces an executive health summary.',
    category: 'devops',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 6 * * 1', description: 'Every Monday at 6 AM' },
    error_strategy: 'skip',
    timeout_ms: 1200000,
    variables: {},
    nodes: [
      { id: 'fsh-1', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'fsh-2', type: 'agent', label: 'Server Hardener', position: { x: 200, y: 0 }, config: { agentSlug: 'server-hardener', input: 'Perform a full server health and hardening assessment. Check OS patches, resource utilization, and security posture.' } },
      { id: 'fsh-3', type: 'agent', label: 'DB Tuner', position: { x: 400, y: 0 }, config: { agentSlug: 'db-tuner', input: 'Assess database health. Check query performance, connection pool status, replication lag, and storage utilization.' } },
      { id: 'fsh-4', type: 'agent', label: 'Docker Optimizer', position: { x: 600, y: 0 }, config: { agentSlug: 'docker-optimizer', input: 'Review all running Docker containers. Check image freshness, resource limits, restart policies, and vulnerability status.' } },
      { id: 'fsh-5', type: 'agent', label: 'Monitoring Setup', position: { x: 800, y: 0 }, config: { agentSlug: 'monitoring-setup', input: 'Verify monitoring coverage across all infrastructure layers. Check for alerting gaps, stale dashboards, and metric collection health.' } },
      { id: 'fsh-6', type: 'llm', label: 'Executive Health Summary', position: { x: 1000, y: 0 }, config: { prompt: 'Create an executive health summary covering all infrastructure layers: servers, databases, containers, and monitoring. Use a traffic-light (red/amber/green) system for each area. Highlight top 3 risks and recommended actions.', systemPrompt: 'You are a VP of Engineering. Produce a concise executive infrastructure health report suitable for leadership review.' } },
      { id: 'fsh-7', type: 'notify', label: 'Send Health Report', position: { x: 1200, y: 0 }, config: { message: 'Weekly full-stack health check completed. Executive summary available in flow run details.', channel: 'internal' } },
      { id: 'fsh-8', type: 'end', label: 'End', position: { x: 1400, y: 0 }, config: {} },
    ],
    edges: [
      { source: 'fsh-1', target: 'fsh-2', label: '' },
      { source: 'fsh-2', target: 'fsh-3', label: '' },
      { source: 'fsh-3', target: 'fsh-4', label: '' },
      { source: 'fsh-4', target: 'fsh-5', label: '' },
      { source: 'fsh-5', target: 'fsh-6', label: '' },
      { source: 'fsh-6', target: 'fsh-7', label: '' },
      { source: 'fsh-7', target: 'fsh-8', label: '' },
    ],
  },
];

function getTemplates() {
  return templates.map(function (t) {
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      category: t.category,
      trigger_type: t.trigger_type,
      node_count: t.nodes.length,
      edge_count: t.edges.length,
    };
  });
}

function getTemplate(idOrSlug) {
  return templates.find(function (t) {
    return t.id === idOrSlug || t.slug === idOrSlug;
  }) || null;
}

/**
 * Create a new flow from a template (deep clone with fresh IDs)
 */
function instantiateTemplate(idOrSlug) {
  var tpl = getTemplate(idOrSlug);
  if (!tpl) return null;

  // Deep clone
  var flow = JSON.parse(JSON.stringify(tpl));

  // Generate fresh node IDs and remap edges
  var idMap = {};
  for (var i = 0; i < flow.nodes.length; i++) {
    var oldId = flow.nodes[i].id;
    var newId = crypto.randomUUID().substring(0, 8);
    idMap[oldId] = newId;
    flow.nodes[i].id = newId;
  }
  for (var j = 0; j < flow.edges.length; j++) {
    flow.edges[j].source = idMap[flow.edges[j].source] || flow.edges[j].source;
    flow.edges[j].target = idMap[flow.edges[j].target] || flow.edges[j].target;
  }

  // Remove template ID
  delete flow.id;
  flow.name = tpl.name + ' (copy)';
  flow.slug = tpl.slug + '-copy';

  return flow;
}

module.exports = { getTemplates, getTemplate, instantiateTemplate };
