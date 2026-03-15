'use strict';

const store = require('./store');
const { NODE_TYPES, MAX_RETRIES } = require('./types');

/**
 * Execute a flow (DAG) using BFS traversal
 * @param {string} flowId
 * @param {string} userId
 * @param {object} triggerPayload - optional payload from trigger
 * @returns {Promise<object>} - the completed flow run
 */
async function executeFlow(flowId, userId, triggerPayload) {
  // 1. Load flow
  var flow = store.getFlow(flowId);
  if (!flow) throw new Error('Flow not found: ' + flowId);
  if (flow.status !== 'active' && flow.status !== 'draft') {
    throw new Error('Flow is not runnable (status: ' + flow.status + ')');
  }

  // 2. Create flow run record
  var run = store.createFlowRun(flowId, userId, triggerPayload ? 'api' : 'manual');
  store.updateFlowRun(run.id, { status: 'running' });

  // 3. Build adjacency list from edges
  var adj = {};
  var edgeMap = {};
  for (var i = 0; i < flow.nodes.length; i++) {
    adj[flow.nodes[i].id] = [];
  }
  for (var j = 0; j < flow.edges.length; j++) {
    var edge = flow.edges[j];
    if (!adj[edge.source]) adj[edge.source] = [];
    adj[edge.source].push(edge.target);
    edgeMap[edge.source + '->' + edge.target] = edge;
  }

  // 4. Find start node
  var startNode = null;
  for (var k = 0; k < flow.nodes.length; k++) {
    if (flow.nodes[k].type === 'start') { startNode = flow.nodes[k]; break; }
  }
  if (!startNode) {
    store.updateFlowRun(run.id, {
      status: 'failed',
      error: 'No start node found in flow',
      completed_at: new Date().toISOString(),
    });
    return store.getFlowRun(run.id);
  }

  // 5. Build node lookup
  var nodeMap = {};
  for (var n = 0; n < flow.nodes.length; n++) {
    nodeMap[flow.nodes[n].id] = flow.nodes[n];
  }

  // 6. BFS execution
  var state = { _trigger: triggerPayload || {}, _variables: flow.variables || {} };
  var visited = {};
  var completedCount = 0;
  var queue = [startNode.id];
  var timeoutAt = Date.now() + (flow.timeout_ms || 300000);

  try {
    while (queue.length > 0) {
      if (Date.now() > timeoutAt) {
        throw new Error('Flow execution timed out after ' + (flow.timeout_ms || 300000) + 'ms');
      }

      var currentId = queue.shift();
      if (visited[currentId]) continue;
      visited[currentId] = true;

      var node = nodeMap[currentId];
      if (!node) continue;

      // Update current node
      store.updateFlowRun(run.id, { current_node_id: currentId });

      // Execute node
      var result = null;
      var retries = 0;
      var maxRetries = flow.error_strategy === 'retry' ? MAX_RETRIES : 1;

      while (retries < maxRetries) {
        try {
          result = await executeNode(node, state, flow);
          break;
        } catch (nodeErr) {
          retries++;
          if (retries >= maxRetries) {
            if (flow.error_strategy === 'stop') throw nodeErr;
            if (flow.error_strategy === 'skip') {
              result = { skipped: true, error: nodeErr.message };
              break;
            }
          }
          // Brief pause before retry
          await sleep(1000 * retries);
        }
      }

      // Store result in state (truncate large outputs to prevent bloat)
      state[currentId] = truncateResult(result);
      completedCount++;
      store.updateFlowRun(run.id, { state: state, completed_nodes: completedCount });

      // Determine next nodes
      var nextNodes = [];
      if (node.type === 'condition' && result) {
        // For condition nodes, follow the matching edge label
        var outEdges = flow.edges.filter(function (e) { return e.source === currentId; });
        var branchValue = result.result ? 'true' : 'false';
        for (var ei = 0; ei < outEdges.length; ei++) {
          if (outEdges[ei].label === branchValue || (!outEdges[ei].label && branchValue === 'true')) {
            nextNodes.push(outEdges[ei].target);
          }
        }
        // If no labeled edges found, fall back to all outgoing
        if (nextNodes.length === 0 && outEdges.length > 0) {
          nextNodes = outEdges.map(function (e) { return e.target; });
        }
      } else if (node.type === 'end') {
        // End node: stop this branch
      } else {
        // Follow all outgoing edges
        nextNodes = adj[currentId] || [];
      }

      for (var ni = 0; ni < nextNodes.length; ni++) {
        if (!visited[nextNodes[ni]]) {
          queue.push(nextNodes[ni]);
        }
      }
    }

    // 7. Mark completed
    store.updateFlowRun(run.id, {
      status: 'completed',
      state: state,
      current_node_id: null,
      completed_nodes: completedCount,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    // 7. Mark failed
    store.updateFlowRun(run.id, {
      status: 'failed',
      state: state,
      error: err.message,
      completed_at: new Date().toISOString(),
    });
  }

  return store.getFlowRun(run.id);
}

/**
 * Execute a single node based on its type
 */
async function executeNode(node, state, flow) {
  var config = node.config || {};
  var type = node.type;

  switch (type) {
    case 'start':
      return { status: 'ok', message: 'Flow started' };

    case 'end':
      return { status: 'ok', message: 'Flow ended' };

    case 'llm':
      return await executeLLMNode(node, state, config);

    case 'agent':
      return await executeAgentNode(node, state, config);

    case 'condition':
      return executeConditionNode(node, state, config);

    case 'delay':
      return await executeDelayNode(node, state, config);

    case 'http':
      return await executeHTTPNode(node, state, config);

    case 'notify':
      return executeNotifyNode(node, state, config);

    default:
      return { status: 'unknown', message: 'Unknown node type: ' + type };
  }
}

/**
 * LLM node: call askAI with prompt + state context
 */
async function executeLLMNode(node, state, config) {
  var askAI;
  try {
    askAI = require('../ai').askAI;
  } catch (err) {
    return { status: 'error', error: 'AI module not available: ' + err.message };
  }

  var prompt = config.prompt || 'Analyze the following data and provide insights.';
  // Inject state context into prompt
  var contextStr = '';
  try {
    var contextData = {};
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].charAt(0) !== '_') contextData[keys[i]] = state[keys[i]];
    }
    contextStr = JSON.stringify(contextData, null, 2);
  } catch (e) {
    contextStr = '[unable to serialize state]';
  }

  var fullPrompt = prompt + '\n\nContext from previous steps:\n```json\n' + contextStr + '\n```';

  try {
    // Per-node AI config (Vigil/Arcline pattern): node.config.ai overrides flow defaults
    var aiConfig = config.ai || {};
    var response = await askAI(fullPrompt, {
      systemPrompt: config.systemPrompt || 'You are a helpful DevOps assistant processing a workflow step.',
      routeKey: 'flow',
      preferredProvider: aiConfig.provider && aiConfig.provider !== 'auto' ? aiConfig.provider : undefined,
      model: aiConfig.model || undefined,
      timeout: config.timeout || 60000,
    });
    return { status: 'ok', output: response };
  } catch (err) {
    throw new Error('LLM node failed: ' + err.message);
  }
}

/**
 * Agent node: call executeAgent from agent executor
 */
async function executeAgentNode(node, state, config) {
  var executeAgent;
  try {
    executeAgent = require('../agents/executor').executeAgent;
  } catch (err) {
    return { status: 'error', error: 'Agent executor not available: ' + err.message };
  }

  var agentSlug = config.agentSlug || config.agent_slug || config.agent;
  if (!agentSlug) {
    throw new Error('Agent node missing agentSlug in config');
  }

  // Build input from state context
  var input = config.input || '';
  if (!input) {
    try {
      var contextData = {};
      var keys = Object.keys(state);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].charAt(0) !== '_') contextData[keys[i]] = state[keys[i]];
      }
      input = 'Previous workflow data:\n' + JSON.stringify(contextData, null, 2);
    } catch (e) {
      input = 'Process workflow step';
    }
  }

  try {
    var result = await executeAgent(agentSlug, input, {
      userId: 'flow-executor',
      routeKey: 'flow',
    });
    return { status: result.blocked ? 'blocked' : 'ok', output: result.output, provider: result.provider };
  } catch (err) {
    throw new Error('Agent node failed (' + agentSlug + '): ' + err.message);
  }
}

/**
 * Condition node: evaluate expression against state
 */
function executeConditionNode(node, state, config) {
  var expression = config.expression || config.condition || 'true';
  var result = false;

  try {
    // Simple expression evaluator: supports dot-path comparisons
    // e.g. "nodeId.status === 'ok'" or "nodeId.output.length > 0"
    // For safety, we do basic pattern matching instead of eval
    result = evaluateCondition(expression, state);
  } catch (err) {
    result = false;
  }

  return { status: 'ok', expression: expression, result: result };
}

/**
 * Safe condition evaluator
 * Supports: equals, not equals, contains, exists, gt, lt, true, false
 */
function evaluateCondition(expr, state) {
  expr = expr.trim();

  // Literal booleans
  if (expr === 'true') return true;
  if (expr === 'false') return false;

  // Pattern: path == value or path === value
  var eqMatch = expr.match(/^([\w.]+)\s*={2,3}\s*['"]?(.+?)['"]?$/);
  if (eqMatch) {
    var val = resolvePath(state, eqMatch[1]);
    return String(val) === String(eqMatch[2]);
  }

  // Pattern: path != value or path !== value
  var neqMatch = expr.match(/^([\w.]+)\s*!={1,2}\s*['"]?(.+?)['"]?$/);
  if (neqMatch) {
    var val2 = resolvePath(state, neqMatch[1]);
    return String(val2) !== String(neqMatch[2]);
  }

  // Pattern: path > value
  var gtMatch = expr.match(/^([\w.]+)\s*>\s*(\d+)$/);
  if (gtMatch) {
    var val3 = resolvePath(state, gtMatch[1]);
    return Number(val3) > Number(gtMatch[2]);
  }

  // Pattern: path < value
  var ltMatch = expr.match(/^([\w.]+)\s*<\s*(\d+)$/);
  if (ltMatch) {
    var val4 = resolvePath(state, ltMatch[1]);
    return Number(val4) < Number(ltMatch[2]);
  }

  // Pattern: path.contains(value)
  var containsMatch = expr.match(/^([\w.]+)\.contains\(['"](.+?)['"]\)$/);
  if (containsMatch) {
    var val5 = resolvePath(state, containsMatch[1]);
    return typeof val5 === 'string' && val5.indexOf(containsMatch[2]) !== -1;
  }

  // Pattern: exists(path)
  var existsMatch = expr.match(/^exists\(([\w.]+)\)$/);
  if (existsMatch) {
    var val6 = resolvePath(state, existsMatch[1]);
    return val6 !== undefined && val6 !== null;
  }

  // Default: falsy
  return false;
}

/**
 * Resolve a dot-path on an object: "a.b.c" -> obj.a.b.c
 */
function resolvePath(obj, dotPath) {
  var parts = dotPath.split('.');
  var current = obj;
  for (var i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) return undefined;
    current = current[parts[i]];
  }
  return current;
}

/**
 * Delay node: wait for configured milliseconds
 */
async function executeDelayNode(node, state, config) {
  var delayMs = config.delayMs || config.delay_ms || config.delay || 1000;
  // Cap at 5 minutes to prevent runaway delays
  if (delayMs > 300000) delayMs = 300000;
  await sleep(delayMs);
  return { status: 'ok', delayed_ms: delayMs };
}

/**
 * HTTP node: fetch URL with config
 */
async function executeHTTPNode(node, state, config) {
  var url = config.url;
  if (!url) throw new Error('HTTP node missing url in config');

  var method = (config.method || 'GET').toUpperCase();
  var headers = config.headers || {};
  var body = config.body || null;

  // Template variable substitution in URL and body
  url = templateReplace(url, state);
  if (typeof body === 'string') body = templateReplace(body, state);

  var fetchOpts = {
    method: method,
    headers: headers,
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    fetchOpts.body = typeof body === 'object' ? JSON.stringify(body) : body;
    if (!headers['Content-Type'] && !headers['content-type']) {
      fetchOpts.headers['Content-Type'] = 'application/json';
    }
  }

  // Add timeout via AbortController
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, config.timeout || 30000);
  fetchOpts.signal = controller.signal;

  try {
    var response = await fetch(url, fetchOpts);
    clearTimeout(timeout);

    var responseBody = null;
    var contentType = response.headers.get('content-type') || '';
    if (contentType.indexOf('application/json') !== -1) {
      try { responseBody = await response.json(); } catch (e) { responseBody = await response.text(); }
    } else {
      responseBody = await response.text();
      // Truncate large text responses
      if (typeof responseBody === 'string' && responseBody.length > 10000) {
        responseBody = responseBody.substring(0, 10000) + '... [truncated]';
      }
    }

    return {
      status: response.ok ? 'ok' : 'error',
      statusCode: response.status,
      statusText: response.statusText,
      body: responseBody,
    };
  } catch (err) {
    clearTimeout(timeout);
    throw new Error('HTTP request failed (' + url + '): ' + err.message);
  }
}

/**
 * Notify node: store notification result
 */
function executeNotifyNode(node, state, config) {
  var message = config.message || 'Flow notification';
  var channel = config.channel || 'internal';

  // Template variable substitution
  message = templateReplace(message, state);

  return {
    status: 'ok',
    notification: {
      channel: channel,
      message: message,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Simple template replacement: {{path}} -> state value
 * Logs warnings for unresolved references
 */
function templateReplace(str, state) {
  return str.replace(/\{\{([\w.]+)\}\}/g, function (match, path) {
    var val = resolvePath(state, path);
    if (val === undefined || val === null) {
      console.warn('[FLOW] Unresolved template ref: ' + match);
      return match;
    }
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  });
}

/**
 * Truncate large node results to prevent flow-runs.json bloat
 */
var MAX_OUTPUT_LEN = 10000;
function truncateResult(result) {
  if (!result || typeof result !== 'object') return result;
  var copy = Object.assign({}, result);
  if (typeof copy.output === 'string' && copy.output.length > MAX_OUTPUT_LEN) {
    copy.output = copy.output.substring(0, MAX_OUTPUT_LEN) + '... [truncated]';
  }
  if (typeof copy.body === 'string' && copy.body.length > MAX_OUTPUT_LEN) {
    copy.body = copy.body.substring(0, MAX_OUTPUT_LEN) + '... [truncated]';
  }
  return copy;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

module.exports = { executeFlow };
