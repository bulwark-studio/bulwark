/**
 * Provider Router — Strategy-based provider selection with fallback chains
 * Combines Vigil's direct API approach + Arcline's strategy/detection pattern
 */
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'settings.json');

// Provider modules (lazy-loaded)
let providers = null;

function loadProviders() {
  if (providers) return providers;
  providers = {
    ollama: require('./providers/ollama'),
    'claude-api': require('./providers/anthropic'),
    'claude-cli': require('./providers/claude-cli'),
    'codex-cli': require('./providers/codex-cli'),
    'gemini-cli': require('./providers/gemini-cli'),
  };
  return providers;
}

// Strategy fallback chains
const STRATEGIES = {
  balanced: ['ollama', 'claude-cli', 'claude-api', 'codex-cli', 'gemini-cli'],
  premium: ['claude-api', 'claude-cli', 'ollama', 'codex-cli', 'gemini-cli'],
  speed: ['gemini-cli', 'codex-cli', 'ollama', 'claude-cli', 'claude-api'],
  economy: ['ollama', 'codex-cli', 'gemini-cli', 'claude-cli', 'claude-api'],
};

// Route-key defaults (what provider to prefer for each purpose)
const ROUTE_DEFAULTS = {
  brain: 'ollama',
  agent: 'ollama',
  flow: 'ollama',
  scan: 'ollama',
  general: 'ollama',
  analysis: 'claude-api',
  research: 'claude-api',
};

// Category → route key mapping (matches Vigil pattern)
const CATEGORY_ROUTES = {
  devops: 'agent',
  sysadmin: 'agent',
  cloud: 'analysis',
  database: 'agent',
  security: 'analysis',
  monitoring: 'agent',
  networking: 'agent',
  git: 'agent',
};

// Detection cache — single-flight pattern prevents concurrent detection races
let detectedProviders = null;
let detectionTimestamp = 0;
let detectionInFlight = null; // Promise when detection is running
const DETECTION_CACHE_MS = 60000; // 60 seconds

// Valid provider IDs for validation
const VALID_PROVIDERS = new Set(['ollama', 'claude-api', 'claude-cli', 'codex-cli', 'gemini-cli']);

/**
 * Detect which providers are available (cached, single-flight)
 */
async function detectProviders(force = false) {
  const now = Date.now();
  if (!force && detectedProviders && (now - detectionTimestamp) < DETECTION_CACHE_MS) {
    return detectedProviders;
  }

  // Single-flight: if detection is already running, wait for it
  if (detectionInFlight) return detectionInFlight;

  detectionInFlight = (async () => {
    try {
      const provs = loadProviders();
      const checks = await Promise.allSettled(
        Object.entries(provs).map(async ([id, provider]) => {
          try {
            const available = await provider.isAvailable();
            return { id, available };
          } catch (err) {
            console.error(`[PROVIDER] ${id} detection failed:`, err.message);
            return { id, available: false };
          }
        })
      );

      const result = {};
      for (const check of checks) {
        if (check.status === 'fulfilled') {
          result[check.value.id] = check.value.available;
        }
      }

      // Atomic update of both fields
      detectedProviders = result;
      detectionTimestamp = Date.now();
      return result;
    } finally {
      detectionInFlight = null;
    }
  })();

  return detectionInFlight;
}

/**
 * Get settings from data/settings.json
 */
function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

/**
 * Resolve the best provider for a given purpose
 * Returns { provider, providerId, fallbacksAttempted }
 */
async function resolveProvider(opts = {}) {
  const {
    routeKey = 'general',
    preferredProvider = null,
    strategy = null,
  } = opts;

  const settings = getSettings();
  const provs = loadProviders();
  const detected = await detectProviders();

  // Determine strategy
  const activeStrategy = strategy || settings.aiStrategy || 'balanced';
  const chain = STRATEGIES[activeStrategy] || STRATEGIES.balanced;

  // Determine preferred provider (with validation)
  let preferred = preferredProvider;
  if (!preferred) {
    // Check settings for global override
    preferred = settings.aiProvider;
  }
  // Validate provider ID if explicitly set
  if (preferred && preferred !== 'auto' && preferred !== 'none' && !VALID_PROVIDERS.has(preferred)) {
    console.warn(`[PROVIDER] Invalid provider ID '${preferred}', falling back to auto-detect`);
    preferred = null;
  }
  if (!preferred || preferred === 'auto' || preferred === 'none') {
    // Auto-detect: if ANTHROPIC_API_KEY exists, prefer claude-api
    if (process.env.ANTHROPIC_API_KEY || settings.anthropicApiKey) {
      preferred = 'claude-api';
    } else {
      // Use route default
      preferred = ROUTE_DEFAULTS[routeKey] || 'ollama';
    }
  }

  // Build resolution order: preferred first, then fallback chain (deduplicated)
  const order = [preferred, ...chain.filter(p => p !== preferred)];

  const fallbacksAttempted = [];
  for (const providerId of order) {
    if (!provs[providerId]) continue;

    if (detected[providerId]) {
      return {
        provider: provs[providerId],
        providerId,
        fallbacksAttempted,
      };
    } else {
      fallbacksAttempted.push(providerId + ' (unavailable)');
    }
  }

  // Nothing available
  return {
    provider: null,
    providerId: 'none',
    fallbacksAttempted,
  };
}

/**
 * Get list of all providers with their availability status
 */
async function getProviderStatus() {
  const detected = await detectProviders();
  const settings = getSettings();

  return Object.entries(detected).map(([id, available]) => ({
    id,
    available,
    isDefault: (settings.aiProvider || 'ollama') === id,
  }));
}

/**
 * Force re-detection of providers
 */
async function refreshDetection() {
  return detectProviders(true);
}

/**
 * Resolve provider for a task using config object (Vigil/Arcline pattern)
 * Reads provider/model/fallbackChain from config.ai field on agent or flow node
 * @param {object} args - { config, category, surface }
 * @param {object} args.config - AI config object { provider, model, fallbackChain } or null
 * @param {string} args.category - Agent/flow category for route mapping
 * @param {string} args.surface - 'agent' | 'flow' | 'brain'
 * @returns {Promise<object>} { provider, providerId, model, fallbacksAttempted }
 */
async function resolveTaskProvider(args = {}) {
  const { config, category, surface = 'agent' } = args;

  // Read AI config from agent/flow/node
  const aiConfig = (config && typeof config === 'object') ? config : {};
  const preferredProvider = (typeof aiConfig.provider === 'string' && aiConfig.provider !== 'auto')
    ? aiConfig.provider : null;
  const preferredModel = (typeof aiConfig.model === 'string') ? aiConfig.model : null;
  const customFallback = Array.isArray(aiConfig.fallbackChain) ? aiConfig.fallbackChain : null;

  // Map category to route key
  const routeKey = CATEGORY_ROUTES[category] || surface || 'agent';

  // Resolve using main resolver
  const result = await resolveProvider({
    routeKey,
    preferredProvider,
    strategy: customFallback ? null : undefined, // Use default strategy unless custom chain
  });

  // Attach model preference
  result.model = preferredModel;

  return result;
}

module.exports = {
  resolveProvider,
  resolveTaskProvider,
  detectProviders,
  getProviderStatus,
  refreshDetection,
  STRATEGIES,
  ROUTE_DEFAULTS,
  CATEGORY_ROUTES,
  VALID_PROVIDERS,
  loadProviders,
};
