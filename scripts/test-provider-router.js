#!/usr/bin/env node
/**
 * Test: Provider Router System
 * Tests detection, fallback chains, strategy selection, and provider resolution
 */

const path = require('path');
process.chdir(path.join(__dirname, '..'));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  \x1b[32m✓\x1b[0m ' + message);
    passed++;
  } else {
    console.log('  \x1b[31m✗\x1b[0m ' + message);
    failed++;
  }
}

console.log('\n\x1b[36m=== Provider Router Tests ===\x1b[0m\n');

// Test 1: Provider modules load
console.log('Provider Module Loading:');
try {
  const ollama = require('../lib/ai/providers/ollama');
  assert(typeof ollama.chat === 'function', 'Ollama provider has chat()');
  assert(typeof ollama.isAvailable === 'function', 'Ollama provider has isAvailable()');
  assert(typeof ollama.listModels === 'function', 'Ollama provider has listModels()');
  assert(typeof ollama.chatStream === 'function', 'Ollama provider has chatStream()');
} catch (e) {
  assert(false, 'Ollama provider loads: ' + e.message);
}

try {
  const anthropic = require('../lib/ai/providers/anthropic');
  assert(typeof anthropic.chat === 'function', 'Anthropic provider has chat()');
  assert(typeof anthropic.isAvailable === 'function', 'Anthropic provider has isAvailable()');
} catch (e) {
  assert(false, 'Anthropic provider loads: ' + e.message);
}

try {
  const claudeCli = require('../lib/ai/providers/claude-cli');
  assert(typeof claudeCli.chat === 'function', 'Claude CLI provider has chat()');
  assert(typeof claudeCli.isAvailable === 'function', 'Claude CLI provider has isAvailable()');
} catch (e) {
  assert(false, 'Claude CLI provider loads: ' + e.message);
}

try {
  const codexCli = require('../lib/ai/providers/codex-cli');
  assert(typeof codexCli.chat === 'function', 'Codex CLI provider has chat()');
} catch (e) {
  assert(false, 'Codex CLI provider loads: ' + e.message);
}

try {
  const geminiCli = require('../lib/ai/providers/gemini-cli');
  assert(typeof geminiCli.chat === 'function', 'Gemini CLI provider has chat()');
} catch (e) {
  assert(false, 'Gemini CLI provider loads: ' + e.message);
}

// Test 2: Provider router loads
console.log('\nProvider Router:');
try {
  const router = require('../lib/ai/provider-router');
  assert(typeof router.resolveProvider === 'function', 'Router has resolveProvider()');
  assert(typeof router.detectProviders === 'function', 'Router has detectProviders()');
  assert(typeof router.getProviderStatus === 'function', 'Router has getProviderStatus()');
  assert(typeof router.STRATEGIES === 'object', 'Router has STRATEGIES');
  assert(typeof router.ROUTE_DEFAULTS === 'object', 'Router has ROUTE_DEFAULTS');

  // Validate strategies
  assert(router.STRATEGIES.balanced.length === 5, 'Balanced strategy has 5 providers');
  assert(router.STRATEGIES.premium[0] === 'claude-api', 'Premium strategy starts with claude-api');
  assert(router.STRATEGIES.economy[0] === 'ollama', 'Economy strategy starts with ollama');
  assert(router.STRATEGIES.speed.length === 5, 'Speed strategy has 5 providers');

  // Validate route defaults
  assert(router.ROUTE_DEFAULTS.brain === 'ollama', 'Brain route defaults to ollama');
  assert(router.ROUTE_DEFAULTS.agent === 'ollama', 'Agent route defaults to ollama');
  assert(router.ROUTE_DEFAULTS.analysis === 'claude-api', 'Analysis route defaults to claude-api');
} catch (e) {
  assert(false, 'Provider router loads: ' + e.message);
}

// Test 3: AI facade loads (backward compatible)
console.log('\nAI Facade (backward compat):');
try {
  const ai = require('../lib/ai');
  assert(typeof ai.getProvider === 'function', 'Facade has getProvider()');
  assert(typeof ai.askAI === 'function', 'Facade has askAI()');
  assert(typeof ai.askAIJSON === 'function', 'Facade has askAIJSON()');
  assert(typeof ai.getAICommand === 'function', 'Facade has getAICommand()');
  assert(typeof ai.askAIStructured === 'function', 'Facade has askAIStructured()');
  assert(typeof ai.streamAI === 'function', 'Facade has streamAI()');
  assert(typeof ai.askBrain === 'function', 'Facade has askBrain()');
  assert(typeof ai.resolveProvider === 'function', 'Facade re-exports resolveProvider()');
  assert(typeof ai.detectProviders === 'function', 'Facade re-exports detectProviders()');
  assert(typeof ai.getProviderStatus === 'function', 'Facade re-exports getProviderStatus()');
} catch (e) {
  assert(false, 'AI facade loads: ' + e.message);
}

// Test 4: Provider detection (async)
console.log('\nProvider Detection (async):');
(async function () {
  try {
    const router = require('../lib/ai/provider-router');
    const detected = await router.detectProviders();
    assert(typeof detected === 'object', 'detectProviders returns object');
    assert('ollama' in detected, 'Detection includes ollama');
    assert('claude-api' in detected, 'Detection includes claude-api');
    assert('claude-cli' in detected, 'Detection includes claude-cli');
    assert('codex-cli' in detected, 'Detection includes codex-cli');
    assert('gemini-cli' in detected, 'Detection includes gemini-cli');

    console.log('\n  Detected providers:');
    for (const [id, available] of Object.entries(detected)) {
      console.log('    ' + (available ? '\x1b[32m●\x1b[0m' : '\x1b[31m○\x1b[0m') + ' ' + id);
    }

    // Test resolution
    const result = await router.resolveProvider({ routeKey: 'brain' });
    assert(result.providerId !== undefined, 'resolveProvider returns providerId: ' + result.providerId);
    assert(Array.isArray(result.fallbacksAttempted), 'resolveProvider returns fallbacksAttempted array');
  } catch (e) {
    assert(false, 'Provider detection: ' + e.message);
  }

  console.log('\n\x1b[36m=== Results ===\x1b[0m');
  console.log('  Passed: \x1b[32m' + passed + '\x1b[0m');
  console.log('  Failed: \x1b[31m' + failed + '\x1b[0m');
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
})();
