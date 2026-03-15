/**
 * AI Provider Facade — Backward-compatible wrapper over provider router
 * Routes to Ollama, Claude API, Claude CLI, Codex CLI, Gemini CLI
 * with strategy-based fallback chains
 */
const { resolveProvider, detectProviders, getProviderStatus, refreshDetection, loadProviders } = require('./ai/provider-router');

// Lazy-loaded brain reference
let brainModule = null;

/**
 * Get the currently configured provider name
 */
function getProvider() {
  const fs = require('fs');
  const path = require('path');
  try {
    const file = path.join(__dirname, '..', 'data', 'settings.json');
    if (fs.existsSync(file)) {
      const s = JSON.parse(fs.readFileSync(file, 'utf8'));
      return s.aiProvider || 'ollama';
    }
  } catch {}
  return 'ollama';
}

/**
 * Ask AI a question and get raw text back
 * Now routes through provider router with fallback chain
 * @param {string} prompt
 * @param {object} opts - { timeout, systemPrompt, routeKey, preferredProvider, strategy, model, temperature }
 * @returns {Promise<string>}
 */
async function askAI(prompt, opts = {}) {
  const provider = getProvider();
  if (provider === 'none') return 'AI provider is disabled. Configure in Settings > AI Provider.';

  const { provider: resolved, providerId, fallbacksAttempted } = await resolveProvider({
    routeKey: opts.routeKey || 'general',
    preferredProvider: opts.preferredProvider,
    strategy: opts.strategy,
  });

  if (!resolved) {
    // No provider available — return helpful message
    return 'No AI provider available. ' +
      (fallbacksAttempted.length ? 'Tried: ' + fallbacksAttempted.join(', ') + '. ' : '') +
      'Install Ollama (ollama.com) or configure an API key in Settings.';
  }

  try {
    const result = await resolved.chat(prompt, {
      systemPrompt: opts.systemPrompt,
      timeout: opts.timeout || 120000,
      model: opts.model,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    });
    return result.text;
  } catch (err) {
    // Primary failed — force re-detect and try remaining providers in strategy chain
    console.error(`[AI] Provider ${providerId} failed:`, err.message);
    try {
      await refreshDetection();
      const { provider: retryProvider, providerId: retryId } = await resolveProvider({
        routeKey: opts.routeKey || 'general',
        strategy: opts.strategy,
        // Exclude the failed provider by not passing it as preferred
      });
      if (retryProvider && retryId !== providerId) {
        const result = await retryProvider.chat(prompt, {
          systemPrompt: opts.systemPrompt,
          timeout: opts.timeout || 120000,
          model: opts.model,
        });
        return result.text;
      }
    } catch {}
    return 'AI error: ' + err.message;
  }
}

/**
 * Ask AI with structured response including provider metadata
 * @param {string} prompt
 * @param {object} opts
 * @returns {Promise<object>} { response, provider, model, fallbacksAttempted, fromKB, durationMs }
 */
async function askAIStructured(prompt, opts = {}) {
  const start = Date.now();
  const { provider: resolved, providerId, fallbacksAttempted } = await resolveProvider({
    routeKey: opts.routeKey || 'general',
    preferredProvider: opts.preferredProvider,
    strategy: opts.strategy,
  });

  if (!resolved) {
    return {
      response: 'No AI provider available.',
      provider: 'none',
      model: null,
      fallbacksAttempted,
      fromKB: false,
      durationMs: Date.now() - start,
    };
  }

  try {
    const result = await resolved.chat(prompt, {
      systemPrompt: opts.systemPrompt,
      timeout: opts.timeout || 120000,
      model: opts.model,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    });

    return {
      response: result.text,
      provider: result.provider,
      model: result.model,
      fallbacksAttempted,
      fromKB: false,
      durationMs: Date.now() - start,
      usage: result.usage || null,
    };
  } catch (err) {
    return {
      response: 'AI error: ' + err.message,
      provider: providerId,
      model: null,
      fallbacksAttempted,
      fromKB: false,
      durationMs: Date.now() - start,
      error: err.message,
    };
  }
}

/**
 * Stream AI response with provider routing
 * @param {string} prompt
 * @param {function} onChunk - callback(text)
 * @param {object} opts
 * @returns {Promise<object>} { text, provider, model }
 */
async function streamAI(prompt, onChunk, opts = {}) {
  const { provider: resolved, providerId } = await resolveProvider({
    routeKey: opts.routeKey || 'general',
    preferredProvider: opts.preferredProvider,
    strategy: opts.strategy,
  });

  if (!resolved) {
    const msg = 'No AI provider available.';
    if (onChunk) onChunk(msg);
    return { text: msg, provider: 'none', model: null };
  }

  // Use streaming if provider supports it
  if (resolved.chatStream) {
    return resolved.chatStream(prompt, onChunk, {
      systemPrompt: opts.systemPrompt,
      timeout: opts.timeout || 120000,
      model: opts.model,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    });
  }

  // Fallback: non-streaming
  const result = await resolved.chat(prompt, {
    systemPrompt: opts.systemPrompt,
    timeout: opts.timeout || 120000,
    model: opts.model,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });
  if (onChunk) onChunk(result.text);
  return result;
}

/**
 * Ask AI and parse JSON response with fallback extraction
 * Backward compatible with existing code
 */
async function askAIJSON(prompt, opts = {}) {
  const provider = getProvider();
  if (provider === 'none') return { error: 'AI provider is disabled' };

  try {
    const raw = await askAI(prompt, { timeout: opts.timeout || 120000, ...opts });
    const jsonStr = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
    try {
      return JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrMatch) return JSON.parse(arrMatch[0]);
      return { error: 'Could not parse AI response', raw: raw.substring(0, 500) };
    }
  } catch (e) {
    return { error: 'AI unavailable: ' + e.message };
  }
}

/**
 * Get AI command string (backward compat for routes using exec pattern)
 */
function getAICommand(prompt) {
  const provider = getProvider();
  if (provider === 'codex-cli') return 'codex "' + prompt + '"';
  if (provider === 'gemini-cli') return 'gemini -p "' + prompt + '"';
  return 'claude --print "' + prompt + '"';
}

/**
 * Ask brain (lazy-loaded to avoid circular deps)
 */
async function askBrain(message, options = {}) {
  if (!brainModule) {
    try {
      brainModule = require('./brain');
    } catch {
      return { response: await askAI(message, options) };
    }
  }
  return brainModule.brainChat(message, options);
}

module.exports = {
  getProvider,
  askAI,
  askAIJSON,
  askAIStructured,
  streamAI,
  getAICommand,
  askBrain,
  resolveProvider,
  detectProviders,
  getProviderStatus,
  refreshDetection,
};
