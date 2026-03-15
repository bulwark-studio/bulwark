'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROFILES_FILE = path.join(__dirname, '..', '..', 'data', 'brain-profiles.json');

const DISCOVERY_QUESTIONS = [
  { field: 'infrastructure.cloud_providers', question: 'What cloud providers does your infrastructure use? (AWS, GCP, Azure, on-prem, hybrid)', type: 'multi-select', options: ['aws', 'gcp', 'azure', 'on-prem', 'hybrid', 'none'], weight: 12 },
  { field: 'infrastructure.primary_stack', question: 'What is your primary tech stack? (Node.js, Python, Go, Java, .NET, PHP, Ruby, Rust)', type: 'multi-select', weight: 11 },
  { field: 'infrastructure.container_runtime', question: 'Do you use containers? (Docker, Kubernetes, ECS, EKS, GKE, none)', type: 'select', options: ['docker', 'kubernetes', 'ecs', 'eks', 'gke', 'none'], weight: 10 },
  { field: 'infrastructure.databases', question: 'What databases do you use? (PostgreSQL, MySQL, MongoDB, Redis, DynamoDB, etc.)', type: 'multi-select', weight: 10 },
  { field: 'infrastructure.server_os', question: 'What server OS do you run? (Ubuntu, Debian, RHEL/CentOS, Alpine, Amazon Linux, Windows Server)', type: 'select', options: ['ubuntu', 'debian', 'rhel', 'alpine', 'amazon-linux', 'windows-server'], weight: 9 },
  { field: 'infrastructure.ci_cd', question: 'What CI/CD platform do you use? (GitHub Actions, GitLab CI, Jenkins, CircleCI, ArgoCD)', type: 'multi-select', weight: 9 },
  { field: 'infrastructure.deploy_strategy', question: 'How do you deploy? (containers, VMs, serverless, bare metal, PaaS)', type: 'select', options: ['containers', 'vms', 'serverless', 'bare-metal', 'paas'], weight: 8 },
  { field: 'team.size', question: 'How large is your team? (solo, small 2-5, medium 6-20, large 20+)', type: 'select', options: ['solo', 'small', 'medium', 'large'], weight: 8 },
  { field: 'infrastructure.monitoring', question: 'What monitoring do you use? (Prometheus, Grafana, Datadog, CloudWatch, New Relic, none)', type: 'multi-select', weight: 7 },
  { field: 'infrastructure.dns_cdn', question: 'What DNS/CDN do you use? (Cloudflare, Route53, Fastly, CloudFront, none)', type: 'multi-select', weight: 7 },
  { field: 'preferences.budget_priority', question: 'What is your budget priority? (cost-optimize, balanced, performance-first)', type: 'select', options: ['cost-optimize', 'balanced', 'performance-first'], weight: 6 },
  { field: 'compliance.frameworks', question: 'Any compliance requirements? (SOC 2, HIPAA, PCI DSS, ISO 27001, GDPR, none)', type: 'multi-select', options: ['soc2', 'hipaa', 'pci-dss', 'iso27001', 'gdpr', 'none'], weight: 5 },
  { field: 'infrastructure.scale', question: 'What is your approximate scale? (hobby, startup, growth, enterprise)', type: 'select', options: ['hobby', 'startup', 'growth', 'enterprise'], weight: 5 },
  { field: 'preferences.technical_level', question: 'What technical depth do you prefer? (beginner — explain everything, intermediate, expert — skip basics)', type: 'select', options: ['beginner', 'intermediate', 'expert'], weight: 4 },
  { field: 'preferences.response_style', question: 'How should I format responses? (concise — bullets and short, detailed — full explanations, executive — business-focused)', type: 'select', options: ['concise', 'detailed', 'executive'], weight: 3 },
];

function createDefaultProfile(userId) {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    completion_score: 0,
    infrastructure: { cloud_providers: [], primary_stack: [], container_runtime: '', databases: [], server_os: '', ci_cd: [], deploy_strategy: '', monitoring: [], dns_cdn: [], scale: '', domains: [], ip_ranges: [] },
    compliance: { frameworks: [], audit_cycle: '', last_audit_date: null },
    team: { size: '', roles: [] },
    preferences: { response_style: 'concise', technical_level: 'intermediate', budget_priority: 'balanced' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function loadProfiles() {
  try { if (fs.existsSync(PROFILES_FILE)) return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')); } catch {}
  return {};
}

function saveProfiles(profiles) {
  const dir = path.dirname(PROFILES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = PROFILES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(profiles, null, 2));
  fs.renameSync(tmp, PROFILES_FILE);
}

function getOrCreateProfile(userId) {
  const profiles = loadProfiles();
  if (profiles[userId]) return profiles[userId];
  const profile = createDefaultProfile(userId);
  profiles[userId] = profile;
  saveProfiles(profiles);
  return profile;
}

function updateProfile(userId, patch) {
  const profiles = loadProfiles();
  const profile = profiles[userId] || createDefaultProfile(userId);
  for (const [section, value] of Object.entries(patch)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && profile[section]) {
      Object.assign(profile[section], value);
    } else {
      profile[section] = value;
    }
  }
  profile.completion_score = calculateCompletionScore(profile);
  profile.updated_at = new Date().toISOString();
  profiles[userId] = profile;
  saveProfiles(profiles);
  return profile;
}

function calculateCompletionScore(profile) {
  let earned = 0, total = 0;
  for (const q of DISCOVERY_QUESTIONS) {
    total += q.weight;
    const value = getNestedValue(profile, q.field);
    if (value && (Array.isArray(value) ? value.length > 0 : value !== '')) earned += q.weight;
  }
  return total > 0 ? Math.round((earned / total) * 100) : 0;
}

function getNextDiscoveryQuestion(profile) {
  const sorted = [...DISCOVERY_QUESTIONS].sort((a, b) => b.weight - a.weight);
  for (const q of sorted) {
    const value = getNestedValue(profile, q.field);
    if (!value || (Array.isArray(value) && value.length === 0) || value === '') return q;
  }
  return null;
}

function getProfileSummary(profile) {
  const parts = [];
  if (profile.infrastructure.cloud_providers.length) parts.push('Cloud: ' + profile.infrastructure.cloud_providers.join(', '));
  if (profile.infrastructure.primary_stack.length) parts.push('Stack: ' + profile.infrastructure.primary_stack.join(', '));
  if (profile.infrastructure.container_runtime) parts.push('Containers: ' + profile.infrastructure.container_runtime);
  if (profile.infrastructure.databases.length) parts.push('Databases: ' + profile.infrastructure.databases.join(', '));
  if (profile.infrastructure.server_os) parts.push('OS: ' + profile.infrastructure.server_os);
  if (profile.infrastructure.ci_cd.length) parts.push('CI/CD: ' + profile.infrastructure.ci_cd.join(', '));
  if (profile.infrastructure.deploy_strategy) parts.push('Deploy: ' + profile.infrastructure.deploy_strategy);
  if (profile.infrastructure.monitoring.length) parts.push('Monitoring: ' + profile.infrastructure.monitoring.join(', '));
  if (profile.infrastructure.scale) parts.push('Scale: ' + profile.infrastructure.scale);
  if (profile.compliance.frameworks.length) parts.push('Compliance: ' + profile.compliance.frameworks.join(', '));
  if (profile.preferences.budget_priority && profile.preferences.budget_priority !== 'balanced') parts.push('Budget: ' + profile.preferences.budget_priority);
  return parts.length ? parts.join('. ') + '.' : 'No profile configured yet.';
}

function extractProfileUpdates(message) {
  const updates = {};
  const lower = message.toLowerCase();

  const clouds = [];
  if (/\baws\b/i.test(lower)) clouds.push('aws');
  if (/\bgcp\b|google\s+cloud/i.test(lower)) clouds.push('gcp');
  if (/\bazure\b/i.test(lower)) clouds.push('azure');
  if (/\bon.?prem/i.test(lower)) clouds.push('on-prem');
  if (clouds.length) updates.infrastructure = { ...updates.infrastructure, cloud_providers: clouds };

  const stacks = [];
  if (/\bnode\.?js\b|node\b/i.test(lower)) stacks.push('nodejs');
  if (/\bpython\b/i.test(lower)) stacks.push('python');
  if (/\bgo\b|golang\b/i.test(lower)) stacks.push('go');
  if (/\bjava\b/i.test(lower) && !/javascript/i.test(lower)) stacks.push('java');
  if (/\.net\b|dotnet\b/i.test(lower)) stacks.push('dotnet');
  if (/\brust\b/i.test(lower)) stacks.push('rust');
  if (stacks.length) updates.infrastructure = { ...updates.infrastructure, primary_stack: stacks };

  const dbs = [];
  if (/\bpostgres/i.test(lower)) dbs.push('postgresql');
  if (/\bmysql\b/i.test(lower)) dbs.push('mysql');
  if (/\bmongo/i.test(lower)) dbs.push('mongodb');
  if (/\bredis\b/i.test(lower)) dbs.push('redis');
  if (dbs.length) updates.infrastructure = { ...updates.infrastructure, databases: dbs };

  if (/\bdocker\b/i.test(lower) && !/kubernetes/i.test(lower)) updates.infrastructure = { ...updates.infrastructure, container_runtime: 'docker' };
  if (/\bkubernetes\b|\bk8s\b/i.test(lower)) updates.infrastructure = { ...updates.infrastructure, container_runtime: 'kubernetes' };

  const frameworks = [];
  if (/soc\s*2/i.test(lower)) frameworks.push('soc2');
  if (/hipaa/i.test(lower)) frameworks.push('hipaa');
  if (/pci[\s-]*dss/i.test(lower)) frameworks.push('pci-dss');
  if (/gdpr/i.test(lower)) frameworks.push('gdpr');
  if (frameworks.length) updates.compliance = { ...updates.compliance, frameworks };

  return Object.keys(updates).length ? updates : null;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

module.exports = { DISCOVERY_QUESTIONS, getOrCreateProfile, updateProfile, calculateCompletionScore, getNextDiscoveryQuestion, getProfileSummary, extractProfileUpdates };
