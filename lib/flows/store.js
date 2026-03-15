'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FLOW_STATUSES, FLOW_CATEGORIES, TRIGGER_TYPES, ERROR_STRATEGIES, DEFAULT_TIMEOUT_MS } = require('./types');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FLOWS_FILE = path.join(DATA_DIR, 'flows.json');
const RUNS_FILE = path.join(DATA_DIR, 'flow-runs.json');
const MAX_RUNS = 500;

// ── Helpers ─────────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return [];
}

function writeJSON(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 64);
}

// ── Flows CRUD ──────────────────────────────────────────────────────────────

function getFlows() {
  return readJSON(FLOWS_FILE);
}

function getFlow(id) {
  const flows = readJSON(FLOWS_FILE);
  return flows.find(function (f) { return f.id === id; }) || null;
}

function createFlow(data) {
  var flows = readJSON(FLOWS_FILE);
  var now = new Date().toISOString();
  var id = crypto.randomUUID();

  var flow = {
    id: id,
    name: data.name || 'Untitled Flow',
    slug: data.slug || slugify(data.name || 'untitled-flow'),
    description: data.description || '',
    category: FLOW_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'general',
    status: FLOW_STATUSES.indexOf(data.status) !== -1 ? data.status : 'draft',
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
    edges: Array.isArray(data.edges) ? data.edges : [],
    trigger_type: TRIGGER_TYPES.indexOf(data.trigger_type) !== -1 ? data.trigger_type : 'manual',
    trigger_config: data.trigger_config || {},
    variables: data.variables || {},
    error_strategy: ERROR_STRATEGIES.indexOf(data.error_strategy) !== -1 ? data.error_strategy : 'stop',
    timeout_ms: typeof data.timeout_ms === 'number' && data.timeout_ms > 0 ? data.timeout_ms : DEFAULT_TIMEOUT_MS,
    version: 1,
    run_count: 0,
    created_at: now,
    updated_at: now,
  };

  // Ensure unique slug
  var base = flow.slug;
  var counter = 1;
  while (flows.some(function (f) { return f.slug === flow.slug; })) {
    flow.slug = base + '-' + (++counter);
  }

  flows.push(flow);
  writeJSON(FLOWS_FILE, flows);
  return flow;
}

function updateFlow(id, patch) {
  var flows = readJSON(FLOWS_FILE);
  var idx = -1;
  for (var i = 0; i < flows.length; i++) {
    if (flows[i].id === id) { idx = i; break; }
  }
  if (idx === -1) return null;

  var flow = flows[idx];
  var graphChanged = false;

  // Apply allowed fields
  if (patch.name !== undefined) flow.name = patch.name;
  if (patch.description !== undefined) flow.description = patch.description;
  if (patch.category !== undefined && FLOW_CATEGORIES.indexOf(patch.category) !== -1) flow.category = patch.category;
  if (patch.status !== undefined && FLOW_STATUSES.indexOf(patch.status) !== -1) flow.status = patch.status;
  if (patch.trigger_type !== undefined && TRIGGER_TYPES.indexOf(patch.trigger_type) !== -1) flow.trigger_type = patch.trigger_type;
  if (patch.trigger_config !== undefined) flow.trigger_config = patch.trigger_config;
  if (patch.variables !== undefined) flow.variables = patch.variables;
  if (patch.error_strategy !== undefined && ERROR_STRATEGIES.indexOf(patch.error_strategy) !== -1) flow.error_strategy = patch.error_strategy;
  if (patch.timeout_ms !== undefined) flow.timeout_ms = typeof patch.timeout_ms === 'number' && patch.timeout_ms > 0 ? patch.timeout_ms : DEFAULT_TIMEOUT_MS;

  // Graph changes bump version
  if (patch.nodes !== undefined) {
    flow.nodes = Array.isArray(patch.nodes) ? patch.nodes : [];
    graphChanged = true;
  }
  if (patch.edges !== undefined) {
    flow.edges = Array.isArray(patch.edges) ? patch.edges : [];
    graphChanged = true;
  }

  if (graphChanged) flow.version = (flow.version || 1) + 1;
  flow.updated_at = new Date().toISOString();

  flows[idx] = flow;
  writeJSON(FLOWS_FILE, flows);
  return flow;
}

function deleteFlow(id) {
  var flows = readJSON(FLOWS_FILE);
  var idx = -1;
  for (var i = 0; i < flows.length; i++) {
    if (flows[i].id === id) { idx = i; break; }
  }
  if (idx === -1) return false;
  flows.splice(idx, 1);
  writeJSON(FLOWS_FILE, flows);
  return true;
}

function incrementRunCount(id) {
  var flows = readJSON(FLOWS_FILE);
  for (var i = 0; i < flows.length; i++) {
    if (flows[i].id === id) {
      flows[i].run_count = (flows[i].run_count || 0) + 1;
      writeJSON(FLOWS_FILE, flows);
      return;
    }
  }
}

// ── Flow Runs ───────────────────────────────────────────────────────────────

function createFlowRun(flowId, userId, trigger) {
  var runs = readJSON(RUNS_FILE);
  var now = new Date().toISOString();

  var flow = getFlow(flowId);
  var totalNodes = flow ? flow.nodes.length : 0;

  var run = {
    id: crypto.randomUUID(),
    flow_id: flowId,
    flow_name: flow ? flow.name : 'Unknown',
    user_id: userId || 'system',
    trigger: trigger || 'manual',
    status: 'pending',
    state: {},
    current_node_id: null,
    completed_nodes: 0,
    total_nodes: totalNodes,
    started_at: now,
    completed_at: null,
    error: null,
    flow_version: flow ? flow.version : 1,
  };

  runs.unshift(run);
  if (runs.length > MAX_RUNS) runs = runs.slice(0, MAX_RUNS);
  writeJSON(RUNS_FILE, runs);

  incrementRunCount(flowId);
  return run;
}

function updateFlowRun(runId, patch) {
  var runs = readJSON(RUNS_FILE);
  var idx = -1;
  for (var i = 0; i < runs.length; i++) {
    if (runs[i].id === runId) { idx = i; break; }
  }
  if (idx === -1) return null;

  var run = runs[idx];

  if (patch.status !== undefined) run.status = patch.status;
  if (patch.state !== undefined) run.state = patch.state;
  if (patch.current_node_id !== undefined) run.current_node_id = patch.current_node_id;
  if (patch.completed_nodes !== undefined) run.completed_nodes = patch.completed_nodes;
  if (patch.completed_at !== undefined) run.completed_at = patch.completed_at;
  if (patch.error !== undefined) run.error = patch.error;

  runs[idx] = run;
  writeJSON(RUNS_FILE, runs);
  return run;
}

function getFlowRuns(flowId, limit) {
  var runs = readJSON(RUNS_FILE);
  if (flowId) runs = runs.filter(function (r) { return r.flow_id === flowId; });
  if (limit) runs = runs.slice(0, limit);
  return runs;
}

function getFlowRun(runId) {
  var runs = readJSON(RUNS_FILE);
  return runs.find(function (r) { return r.id === runId; }) || null;
}

module.exports = {
  getFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  createFlowRun,
  updateFlowRun,
  getFlowRuns,
  getFlowRun,
  incrementRunCount,
};
