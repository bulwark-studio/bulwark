/**
 * Neural Cache Engine — Multi-Tier AI-Powered Cache System
 * Tier 1: Hot Cache (LRU, <0.1ms)
 * Tier 2: Semantic Cache (Jaccard similarity for Claude/AI responses)
 * Tier 3: Predictive Prefetch (route co-occurrence patterns)
 */

const MAX_ENTRIES = 500;
const SEMANTIC_THRESHOLD = 0.82;
const MIN_TTL = 5000;
const MAX_TTL = 300000;
const DEFAULT_TTL = 30000;
const HEATMAP_WINDOW = 3600000; // 1 hour
const PREFETCH_WINDOW = 5000; // 5s co-occurrence window
const MAX_TIMELINE = 200;
const MAX_SEMANTIC = 100;
const SEMANTIC_TTL = 86400000; // 24 hours — semantic entries expire

// ── Tier 1: Hot Cache (LRU) ─────────────────────────────────────────────
const hotCache = new Map(); // key → { data, expires, ttl, created, hits, lastAccess, size }
// Doubly-linked list for O(1) LRU eviction
const lruMap = new Map(); // key → { key, prev, next }
let lruHead = null; // least recently used
let lruTail = null; // most recently used

// ── Tier 2: Semantic Cache ──────────────────────────────────────────────
const semanticCache = []; // [{ prompt, response, tokens, hits, created, lastAccess }]

// ── Tier 3: Predictive Prefetch ─────────────────────────────────────────
const prefetchPatterns = {}; // routeA → { routeB: count }
const recentAccess = []; // [{ route, ts }] — sliding window for co-occurrence

// ── Analytics ───────────────────────────────────────────────────────────
const stats = {
  tier1: { hits: 0, misses: 0, sets: 0, evictions: 0 },
  tier2: { hits: 0, misses: 0, sets: 0 },
  tier3: { hits: 0, prefetches: 0 },
  total: { hits: 0, misses: 0, latencySaved: 0, started: Date.now() },
};

const routeStats = {}; // route → { hits, misses, avgLatency, lastAccess, ttl, invalidations }
const timeline = []; // [{ ts, type, route, tier, latency }]
const heatmap = []; // [{ route, ts }] — for frequency visualization

// ── Adaptive TTL ────────────────────────────────────────────────────────
const adaptiveTTL = {}; // route → { baseTTL, invalidations, stableSince, currentTTL }

function getAdaptiveTTL(route) {
  if (!adaptiveTTL[route]) {
    adaptiveTTL[route] = { baseTTL: DEFAULT_TTL, invalidations: 0, stableSince: Date.now(), currentTTL: DEFAULT_TTL };
  }
  const a = adaptiveTTL[route];
  const stableMs = Date.now() - a.stableSince;
  // Stable routes get longer TTL (up to 5min)
  if (a.invalidations === 0 && stableMs > 60000) {
    a.currentTTL = Math.min(MAX_TTL, a.baseTTL * Math.min(10, 1 + stableMs / 60000));
  }
  // Frequently invalidated routes get shorter TTL
  if (a.invalidations > 5) {
    a.currentTTL = Math.max(MIN_TTL, a.baseTTL / 2);
  }
  return Math.round(a.currentTTL);
}

function recordInvalidation(route) {
  if (adaptiveTTL[route]) {
    adaptiveTTL[route].invalidations++;
    adaptiveTTL[route].stableSince = Date.now();
    adaptiveTTL[route].currentTTL = Math.max(MIN_TTL, adaptiveTTL[route].currentTTL * 0.7);
  }
}

// ── Core Operations ─────────────────────────────────────────────────────

function get(key, routeLabel) {
  const route = routeLabel || key;
  const entry = hotCache.get(key);

  trackRoute(route, 'access');

  if (entry) {
    if (Date.now() > entry.expires) {
      hotCache.delete(key);
      removeLRU(key);
      logEvent('EXPIRE', route, 1, 0);
      stats.tier1.misses++;
      stats.total.misses++;
      trackRoute(route, 'miss');
      return null;
    }
    entry.hits++;
    entry.lastAccess = Date.now();
    touchLRU(key);
    const latency = entry.avgLatency || 10;
    stats.tier1.hits++;
    stats.total.hits++;
    stats.total.latencySaved += latency;
    logEvent('HIT', route, 1, latency);
    trackRoute(route, 'hit');
    return entry.data;
  }

  stats.tier1.misses++;
  stats.total.misses++;
  logEvent('MISS', route, 1, 0);
  trackRoute(route, 'miss');
  return null;
}

function set(key, data, ttl, avgLatency, routeLabel) {
  const route = routeLabel || key;
  ttl = ttl || getAdaptiveTTL(key);
  const size = estimateSize(data);

  // Evict if at capacity
  while (hotCache.size >= MAX_ENTRIES && lruHead) {
    const evictKey = lruHead.key;
    removeLRU(evictKey);
    hotCache.delete(evictKey);
    stats.tier1.evictions++;
    logEvent('EVICT', evictKey, 1, 0);
  }

  hotCache.set(key, {
    data,
    expires: Date.now() + ttl,
    ttl,
    created: Date.now(),
    hits: 0,
    lastAccess: Date.now(),
    size,
    avgLatency: avgLatency || 10,
  });
  touchLRU(key);
  stats.tier1.sets++;
  logEvent('SET', route, 1, 0);

  // Track route pattern for prefetch
  trackPrefetchPattern(route);
}

function invalidate(key) {
  hotCache.delete(key);
  removeLRU(key);
  recordInvalidation(key);
  logEvent('INVALIDATE', key, 1, 0);
}

function invalidatePrefix(prefix) {
  const keys = [];
  hotCache.forEach((_, k) => { if (k.startsWith(prefix)) keys.push(k); });
  keys.forEach(k => { hotCache.delete(k); removeLRU(k); });
  recordInvalidation(prefix);
  if (keys.length) logEvent('INVALIDATE_PREFIX', prefix, 1, 0);
}

function flush() {
  hotCache.clear();
  lruMap.clear();
  lruHead = null;
  lruTail = null;
  semanticCache.length = 0;
  logEvent('FLUSH', '*', 0, 0);
}

// ── Tier 2: Semantic Cache ──────────────────────────────────────────────

function tokenize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  setA.forEach(w => { if (setB.has(w)) intersection++; });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function semanticGet(prompt) {
  const tokens = tokenize(prompt);
  if (tokens.length < 3) return null;

  let bestMatch = null;
  let bestScore = 0;
  const now = Date.now();

  for (let i = semanticCache.length - 1; i >= 0; i--) {
    const entry = semanticCache[i];
    // Expire entries older than SEMANTIC_TTL
    if (now - entry.created > SEMANTIC_TTL) {
      semanticCache.splice(i, 1);
      continue;
    }
    const score = jaccardSimilarity(tokens, entry.tokens);
    if (score > bestScore && score >= SEMANTIC_THRESHOLD) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    bestMatch.hits++;
    bestMatch.lastAccess = now;
    stats.tier2.hits++;
    stats.total.hits++;
    stats.total.latencySaved += 8000; // avg Claude response time
    logEvent('SEMANTIC_HIT', 'claude', 2, 8000);
    return { response: bestMatch.response, score: bestScore, cached: true };
  }

  stats.tier2.misses++;
  return null;
}

function semanticSet(prompt, response) {
  const tokens = tokenize(prompt);
  if (tokens.length < 3) return;

  // Check if similar prompt already cached
  for (const entry of semanticCache) {
    if (jaccardSimilarity(tokens, entry.tokens) >= 0.95) {
      entry.response = response;
      entry.lastAccess = Date.now();
      return;
    }
  }

  // Evict oldest if at capacity
  if (semanticCache.length >= MAX_SEMANTIC) {
    semanticCache.sort((a, b) => a.lastAccess - b.lastAccess);
    semanticCache.shift();
  }

  semanticCache.push({ prompt: prompt.substring(0, 200), response, tokens, hits: 0, created: Date.now(), lastAccess: Date.now() });
  stats.tier2.sets++;
  logEvent('SEMANTIC_SET', 'claude', 2, 0);
}

// ── Tier 3: Predictive Prefetch ─────────────────────────────────────────

function trackPrefetchPattern(route) {
  const now = Date.now();
  recentAccess.push({ route, ts: now });

  // Trim old entries
  while (recentAccess.length > 0 && now - recentAccess[0].ts > PREFETCH_WINDOW * 2) {
    recentAccess.shift();
  }

  // Find co-occurring routes within the window
  const windowStart = now - PREFETCH_WINDOW;
  const recent = recentAccess.filter(a => a.ts >= windowStart && a.route !== route);
  recent.forEach(a => {
    if (!prefetchPatterns[a.route]) prefetchPatterns[a.route] = {};
    if (!prefetchPatterns[a.route][route]) prefetchPatterns[a.route][route] = 0;
    prefetchPatterns[a.route][route]++;
  });
}

function getPrefetchSuggestions(route) {
  const patterns = prefetchPatterns[route];
  if (!patterns) return [];
  return Object.entries(patterns)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([r, count]) => ({ route: r, confidence: Math.min(100, count * 10) }));
}

// ── Analytics & Helpers ─────────────────────────────────────────────────

const MAX_ROUTE_STATS = 200;

function trackRoute(route, type) {
  if (!routeStats[route]) routeStats[route] = { hits: 0, misses: 0, accesses: 0, lastAccess: 0, firstAccess: Date.now() };
  routeStats[route].lastAccess = Date.now();
  routeStats[route].accesses++;
  if (type === 'hit') routeStats[route].hits++;
  if (type === 'miss') routeStats[route].misses++;

  // Prune stale route stats when map grows too large
  const routeKeys = Object.keys(routeStats);
  if (routeKeys.length > MAX_ROUTE_STATS) {
    const sorted = routeKeys.sort((a, b) => routeStats[a].lastAccess - routeStats[b].lastAccess);
    const toRemove = sorted.slice(0, routeKeys.length - MAX_ROUTE_STATS);
    toRemove.forEach(k => { delete routeStats[k]; delete adaptiveTTL[k]; });
  }

  heatmap.push({ route, ts: Date.now() });
  // Trim heatmap to window
  const cutoff = Date.now() - HEATMAP_WINDOW;
  while (heatmap.length > 0 && heatmap[0].ts < cutoff) heatmap.shift();
}

function logEvent(type, route, tier, latency) {
  timeline.unshift({ ts: Date.now(), type, route, tier, latency });
  if (timeline.length > MAX_TIMELINE) timeline.length = MAX_TIMELINE;
}

function touchLRU(key) {
  removeLRU(key);
  // Add to tail (most recently used)
  const node = { key, prev: lruTail, next: null };
  if (lruTail) lruTail.next = node;
  lruTail = node;
  if (!lruHead) lruHead = node;
  lruMap.set(key, node);
}

function removeLRU(key) {
  const node = lruMap.get(key);
  if (!node) return;
  if (node.prev) node.prev.next = node.next;
  else lruHead = node.next;
  if (node.next) node.next.prev = node.prev;
  else lruTail = node.prev;
  lruMap.delete(key);
}

function estimateSize(data) {
  try { return JSON.stringify(data).length; } catch { return 100; }
}

function getMemoryEstimate() {
  let total = 0;
  hotCache.forEach(entry => { total += entry.size || 100; });
  semanticCache.forEach(entry => { total += (entry.response || '').length + (entry.prompt || '').length; });
  return total;
}

function getHealthScore() {
  const totalReqs = stats.total.hits + stats.total.misses;
  if (totalReqs === 0) return 50;
  const hitRatio = stats.total.hits / totalReqs;
  const memEfficiency = Math.max(0, 1 - hotCache.size / MAX_ENTRIES);
  const latencyScore = Math.min(1, stats.total.latencySaved / Math.max(1, totalReqs * 100));
  return Math.round(hitRatio * 40 + latencyScore * 30 + memEfficiency * 20 + (semanticCache.length > 0 ? 10 : 0));
}

// ── Periodic Cleanup ────────────────────────────────────────────────────
// Clean up stale semantic entries and expired hot cache entries every 5 min
const CLEANUP_INTERVAL = 300000;
setInterval(() => {
  const now = Date.now();
  // Purge expired semantic entries
  for (let i = semanticCache.length - 1; i >= 0; i--) {
    if (now - semanticCache[i].created > SEMANTIC_TTL) {
      semanticCache.splice(i, 1);
    }
  }
  // Purge expired hot cache entries
  const expired = [];
  hotCache.forEach((entry, key) => {
    if (now > entry.expires) expired.push(key);
  });
  expired.forEach(key => { hotCache.delete(key); removeLRU(key); });
}, CLEANUP_INTERVAL).unref();

// ── Express Middleware ───────────────────────────────────────────────────

function cacheMiddleware(baseTTL) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const routeKey = req.originalUrl || req.url;
    const key = buildRequestCacheKey(req);
    const cached = get(key, routeKey);
    if (cached) {
      return res.json(cached);
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && data && !data.error) {
        set(key, data, baseTTL || getAdaptiveTTL(routeKey), undefined, routeKey);
      }
      return originalJson(data);
    };
    next();
  };
}

// ── Write Invalidation Middleware ────────────────────────────────────────

function invalidationMiddleware(req, res, next) {
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE') {
    getInvalidationPrefixes(req.originalUrl || req.url).forEach(prefix => invalidatePrefix(prefix));
  }
  next();
}

// ── Stats Export ────────────────────────────────────────────────────────

function getStats() {
  const totalReqs = stats.total.hits + stats.total.misses;
  const hitRate = totalReqs > 0 ? (stats.total.hits / totalReqs * 100).toFixed(1) : '0.0';

  // Top routes by access
  const topRoutes = Object.entries(routeStats)
    .map(([route, s]) => ({
      route,
      hits: s.hits,
      misses: s.misses,
      hitRate: s.hits + s.misses > 0 ? Math.round(s.hits / (s.hits + s.misses) * 100) : 0,
      accesses: s.accesses,
      lastAccess: s.lastAccess,
      ttl: getAdaptiveTTL(route),
    }))
    .sort((a, b) => b.accesses - a.accesses)
    .slice(0, 20);

  return {
    health: getHealthScore(),
    hitRate: parseFloat(hitRate),
    tier1: { ...stats.tier1, entries: hotCache.size, maxEntries: MAX_ENTRIES },
    tier2: { ...stats.tier2, entries: semanticCache.length, maxEntries: MAX_SEMANTIC, threshold: SEMANTIC_THRESHOLD },
    tier3: { ...stats.tier3, patterns: Object.keys(prefetchPatterns).length },
    total: {
      ...stats.total,
      requests: totalReqs,
      uptime: Date.now() - stats.total.started,
    },
    memory: getMemoryEstimate(),
    memoryFormatted: formatBytes(getMemoryEstimate()),
    entries: hotCache.size + semanticCache.length,
    topRoutes,
    prefetchSuggestions: Object.entries(prefetchPatterns)
      .filter(([_, targets]) => Object.values(targets).some(c => c >= 3))
      .slice(0, 5)
      .map(([from, targets]) => ({
        from,
        to: Object.entries(targets).sort((a, b) => b[1] - a[1])[0],
      })),
  };
}

function getHeatmap() {
  // Aggregate heatmap data per route
  const agg = {};
  const now = Date.now();
  heatmap.forEach(h => {
    if (!agg[h.route]) agg[h.route] = { count: 0, recent: 0 };
    agg[h.route].count++;
    if (now - h.ts < 300000) agg[h.route].recent++; // last 5 min
  });
  return Object.entries(agg)
    .map(([route, d]) => ({ route, total: d.count, recent: d.recent, intensity: Math.min(100, d.count * 2) }))
    .sort((a, b) => b.total - a.total);
}

function getTimeline(limit) {
  return timeline.slice(0, limit || 50);
}

function getSemanticEntries() {
  return semanticCache.map(e => ({
    prompt: e.prompt,
    hits: e.hits,
    created: e.created,
    lastAccess: e.lastAccess,
    responseLength: (e.response || '').length,
  }));
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function buildRequestCacheKey(req) {
  const base = req.originalUrl || req.url;
  if (!req.user) return base;
  const role = req.user.role || 'unknown';
  const userId = req.user.userId || req.user.username || req.user.user || 'anonymous';
  return `${base}::role=${role}::user=${userId}`;
}

function getInvalidationPrefixes(url) {
  const pathname = (url || '').split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  const prefixes = [];
  for (let i = parts.length; i >= 2; i--) {
    prefixes.push('/' + parts.slice(0, i).join('/'));
  }
  return [...new Set(prefixes)];
}

// ── Route Registration ──────────────────────────────────────────────────

function registerRoutes(app, ctx) {
  const { requireAdmin } = ctx;

  app.get('/api/cache/stats', requireAdmin, (req, res) => {
    res.json(getStats());
  });

  app.get('/api/cache/heatmap', requireAdmin, (req, res) => {
    res.json({ heatmap: getHeatmap() });
  });

  app.get('/api/cache/timeline', requireAdmin, (req, res) => {
    res.json({ events: getTimeline(parseInt(req.query.limit) || 50) });
  });

  app.get('/api/cache/semantic', requireAdmin, (req, res) => {
    res.json({ entries: getSemanticEntries() });
  });

  app.post('/api/cache/flush', requireAdmin, (req, res) => {
    flush();
    res.json({ success: true, message: 'All caches flushed' });
  });

  app.get('/api/cache/ai-analysis', requireAdmin, async (req, res) => {
    const s = getStats();
    const h = getHeatmap();

    const context = [
      `Cache health score: ${s.health}/100, hit rate: ${s.hitRate}%`,
      `Tier 1 (Hot): ${s.tier1.entries}/${s.tier1.maxEntries} entries, ${s.tier1.hits} hits, ${s.tier1.misses} misses, ${s.tier1.evictions} evictions`,
      `Tier 2 (Semantic): ${s.tier2.entries} entries, ${s.tier2.hits} hits (Claude responses cached)`,
      `Tier 3 (Prefetch): ${s.tier3.patterns} route patterns learned`,
      `Total latency saved: ${s.total.latencySaved}ms across ${s.total.requests} requests`,
      `Memory: ${s.memoryFormatted}`,
      `Top routes: ${s.topRoutes.slice(0, 8).map(r => r.route + ' (' + r.hitRate + '% hit, TTL ' + r.ttl + 'ms)').join(', ')}`,
      `Heatmap hotspots: ${h.slice(0, 5).map(r => r.route + ' (' + r.total + ' accesses)').join(', ')}`,
    ].join('\n');

    const prompt = context + '\n\nAnalyze this cache performance data. Give 3-4 sentences with specific optimization recommendations. Mention exact routes, TTL suggestions, and cost savings. No markdown.';

    try {
      // Check semantic cache first
      const cached = semanticGet(prompt);
      if (cached) return res.json({ analysis: cached.response, cached: true });

      const { spawn } = require('child_process');
      const cleanEnv = { ...process.env };
      delete cleanEnv.CLAUDECODE;
      const result = await new Promise((resolve, reject) => {
        const child = spawn('claude', ['--print'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, timeout: 20000, env: cleanEnv });
        let stdout = '', stderr = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => { stderr += d; });
        child.on('close', code => resolve({ stdout, stderr, code }));
        child.on('error', reject);
        child.stdin.on('error', () => {});
        child.stdin.write(prompt);
        child.stdin.end();
      });

      const analysis = result.stdout.trim() || 'Analysis unavailable';
      semanticSet(prompt, analysis);
      res.json({ analysis, cached: false });
    } catch (e) {
      res.json({ analysis: `Cache is at ${s.hitRate}% hit rate with ${s.entries} entries using ${s.memoryFormatted}. ${s.health >= 70 ? 'Performance is healthy.' : 'Consider reviewing TTL settings for frequently accessed routes.'}`, cached: false, fallback: true });
    }
  });
}

module.exports = {
  get, set, invalidate, invalidatePrefix, flush,
  semanticGet, semanticSet,
  getPrefetchSuggestions,
  getStats, getHeatmap, getTimeline, getSemanticEntries,
  buildRequestCacheKey, getInvalidationPrefixes,
  cacheMiddleware, invalidationMiddleware,
  registerRoutes, getHealthScore,
};
