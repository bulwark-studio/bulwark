'use strict';
const { getAgent } = require('./catalog');
const { evaluateGuardrails } = require('./guardrails');
const { askAIStructured } = require('../ai');
const { resolveTaskProvider } = require('../ai/provider-router');

/**
 * Execute an agent with the given input
 * Uses per-agent AI config (provider, model, fallbackChain) via resolveTaskProvider
 * matching Vigil/Arcline pattern
 * @param {string} agentSlugOrId
 * @param {string} input - User's input (replaces {{input}} in task_prompt)
 * @param {object} opts - { userId, routeKey, preferredProvider, strategy }
 * @returns {object} { output, provider, model, durationMs, agent, guardrailResult }
 */
async function executeAgent(agentSlugOrId, input, opts = {}) {
  const agent = getAgent(agentSlugOrId);
  if (!agent) throw new Error('Agent not found: ' + agentSlugOrId);

  // 1. Evaluate guardrails
  const guardrailResult = evaluateGuardrails(input, agent);
  if (guardrailResult.blocked) {
    return {
      output: 'Input blocked by safety guardrails: ' + guardrailResult.reason,
      provider: 'none',
      model: null,
      durationMs: 0,
      agent: { id: agent.id, name: agent.name, slug: agent.slug },
      guardrailResult,
      blocked: true,
    };
  }

  // 2. Build prompt from agent template
  const sanitizedInput = guardrailResult.sanitizedInput || input;
  const taskPrompt = agent.task_prompt.replace(/\{\{input\}\}/g, sanitizedInput);

  // 3. Resolve provider using per-agent config (Vigil/Arcline pattern)
  //    Each agent has config.ai with { provider, model, fallbackChain }
  const aiConfig = agent.config?.ai || {};
  const start = Date.now();
  const result = await askAIStructured(taskPrompt, {
    systemPrompt: agent.system_prompt,
    routeKey: opts.routeKey || 'agent',
    preferredProvider: aiConfig.provider !== 'auto' ? aiConfig.provider : opts.preferredProvider,
    model: aiConfig.model || opts.model,
    strategy: opts.strategy,
    timeout: 120000,
  });

  const durationMs = Date.now() - start;

  // 4. Store run record
  const runRecord = {
    id: require('crypto').randomUUID(),
    agent_id: agent.id,
    agent_name: agent.name,
    agent_slug: agent.slug,
    input: input.substring(0, 500), // Truncate for storage
    output: result.response,
    provider: result.provider,
    model: result.model,
    duration_ms: durationMs,
    status: result.error ? 'failed' : 'completed',
    error: result.error || null,
    user_id: opts.userId || 'default',
    created_at: new Date().toISOString(),
  };

  storeRun(runRecord);

  return {
    output: result.response,
    provider: result.provider,
    model: result.model,
    durationMs,
    agent: { id: agent.id, name: agent.name, slug: agent.slug, category: agent.category },
    guardrailResult,
    blocked: false,
    runId: runRecord.id,
    usage: result.usage || null,
  };
}

// Simple run history storage (JSON file, last 100 runs)
const fs = require('fs');
const path = require('path');
const RUNS_FILE = path.join(__dirname, '..', '..', 'data', 'agent-runs.json');

function storeRun(run) {
  try {
    let runs = [];
    if (fs.existsSync(RUNS_FILE)) {
      runs = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8'));
    }
    runs.unshift(run);
    if (runs.length > 100) runs = runs.slice(0, 100);
    const dir = path.dirname(RUNS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2));
  } catch {}
}

function getRuns(opts = {}) {
  try {
    if (fs.existsSync(RUNS_FILE)) {
      let runs = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8'));
      if (opts.agentId) runs = runs.filter(r => r.agent_id === opts.agentId);
      if (opts.userId) runs = runs.filter(r => r.user_id === opts.userId);
      if (opts.limit) runs = runs.slice(0, opts.limit);
      return runs;
    }
  } catch {}
  return [];
}

function getRun(runId) {
  try {
    if (fs.existsSync(RUNS_FILE)) {
      const runs = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8'));
      return runs.find(r => r.id === runId) || null;
    }
  } catch {}
  return null;
}

module.exports = { executeAgent, getRuns, getRun };
