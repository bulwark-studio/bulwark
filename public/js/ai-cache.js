/**
 * Bulwark v2.1 — Reactive AI Intelligence Layer
 *
 * Solves: AI re-fetches on every view navigation, wasting tokens and time.
 *
 * Architecture:
 *   1. Content-addressed cache — hashes the INPUT DATA, not the prompt.
 *      If system metrics haven't changed significantly, cached AI response is still valid.
 *   2. Statistical anomaly detection — z-score on rolling metric windows.
 *      AI is only triggered when something genuinely interesting happens.
 *   3. Freshness gradient — visual indicator decays from "fresh" to "aging" to "stale"
 *      so users always know how current the analysis is.
 *   4. Background pre-fetch — when anomalies are detected, pre-analyze affected views
 *      before the user even navigates there.
 *   5. Cross-view synthesis — a single system state change can invalidate
 *      multiple related caches intelligently.
 */
(function () {
  'use strict';

  // ── Fingerprinting ──────────────────────────────────────────────────
  // Quantize numbers to reduce noise. CPU going from 12.3% to 12.7% shouldn't
  // invalidate cache. But 12% → 45% absolutely should.
  function quantize(val, step) {
    return Math.round(val / step) * step;
  }

  function fingerprint(data, sensitivity) {
    var step = sensitivity === 'low' ? 10 : sensitivity === 'high' ? 2 : 5;
    var str = JSON.stringify(data, function (key, val) {
      if (typeof val === 'number') return quantize(val, step);
      return val;
    });
    // FNV-1a 32-bit hash — fast, good distribution
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(36);
  }

  // ── Anomaly Detection ───────────────────────────────────────────────
  // Modified Z-score using median absolute deviation (MAD) — robust to outliers.
  // Returns true if the latest value is anomalous relative to the window.
  function isAnomaly(values, threshold) {
    if (values.length < 10) return false;
    threshold = threshold || 3.0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var median = sorted[Math.floor(sorted.length / 2)];
    var deviations = sorted.map(function (v) { return Math.abs(v - median); });
    deviations.sort(function (a, b) { return a - b; });
    var mad = deviations[Math.floor(deviations.length / 2)];
    if (mad === 0) mad = 0.01; // prevent div by zero
    var latest = values[values.length - 1];
    var score = 0.6745 * Math.abs(latest - median) / mad;
    return score > threshold;
  }

  // Trend detection — is the metric consistently rising/falling?
  function detectTrend(values, window) {
    if (values.length < window) return 'stable';
    var recent = values.slice(-window);
    var rising = 0, falling = 0;
    for (var i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1] + 0.5) rising++;
      else if (recent[i] < recent[i - 1] - 0.5) falling++;
    }
    var ratio = (window - 1);
    if (rising / ratio > 0.7) return 'rising';
    if (falling / ratio > 0.7) return 'falling';
    return 'stable';
  }

  // ── View dependency graph ───────────────────────────────────────────
  // When system state changes in one domain, which views should be invalidated?
  var VIEW_GROUPS = {
    system:   ['metrics', 'dashboard', 'uptime', 'servers', 'multi-server', 'logs'],
    docker:   ['docker'],
    database: ['sql-editor', 'tables', 'schema', 'roles', 'db-backups', 'db-assistant', 'db-projects', 'migrations'],
    security: ['security'],
    deploy:   ['deploy', 'git'],
    files:    ['files'],
    cron:     ['cron'],
    envvars:  ['envvars'],
    network:  ['cloudflare', 'ssl'],
    schedule: ['calendar', 'notes'],
    cache:    ['cache'],
    github:   ['github-hub'],
    mcp:      ['mcp'],
    processes: ['pm2'],
    notifications: ['notifications', 'notification-center'],
    tickets:  ['tickets'],
    briefing: ['briefing'],
    settings: ['settings', 'docs']
  };

  // ── Core Cache Store ────────────────────────────────────────────────
  var store = {};  // viewId → { fingerprint, response, timestamp, hits, dataSnapshot }
  var anomalyLog = [];  // Recent anomaly events for the insight feed
  var metricWindows = { cpu: [], mem: [], disk: [] };  // Rolling windows for anomaly detection
  var WINDOW_SIZE = 60;
  var listeners = [];  // { viewId, callback } — notified on cache events

  // ── Freshness Thresholds ────────────────────────────────────────────
  var FRESH_MS    = 120000;   // 2 min — analysis is "fresh"
  var WARM_MS     = 300000;   // 5 min — analysis is "warm" (still useful)
  var STALE_MS    = 600000;   // 10 min — analysis is "stale" (show but suggest refresh)
  var EXPIRED_MS  = 1800000;  // 30 min — analysis expired, don't show

  function freshness(entry) {
    if (!entry) return 'none';
    var age = Date.now() - entry.timestamp;
    if (age < FRESH_MS) return 'fresh';
    if (age < WARM_MS) return 'warm';
    if (age < STALE_MS) return 'stale';
    if (age < EXPIRED_MS) return 'expired';
    return 'none';
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.AICache = {
    /**
     * Restore cached AI response for a view (no fingerprint check).
     * Use on show() / nav-back to instantly display previous analysis.
     * Returns: { response, freshness, age } or null
     */
    restore: function (viewId) {
      var entry = store[viewId];
      if (!entry) return null;
      var state = freshness(entry);
      if (state === 'none') { delete store[viewId]; return null; }
      entry.hits++;
      return {
        response: entry.response,
        freshness: state,
        age: Date.now() - entry.timestamp
      };
    },

    /**
     * Get cached AI response for a view (with fingerprint check).
     * Returns: { response, freshness, age, hit } or null
     *
     * @param {string} viewId — e.g., 'metrics', 'docker', 'security'
     * @param {object} currentData — the data that would be sent to AI
     * @param {object} opts — { sensitivity: 'low'|'medium'|'high', maxAge: ms }
     */
    get: function (viewId, currentData, opts) {
      opts = opts || {};
      var entry = store[viewId];
      if (!entry) return null;

      var state = freshness(entry);
      if (state === 'none') { delete store[viewId]; return null; }

      var currentFp = fingerprint(currentData, opts.sensitivity || 'medium');
      var dataUnchanged = (entry.fingerprint === currentFp);

      // Data hasn't changed → serve cache regardless of age (within expired limit)
      if (dataUnchanged) {
        entry.hits++;
        return {
          response: entry.response,
          freshness: state,
          age: Date.now() - entry.timestamp,
          hit: true,
          dataChanged: false
        };
      }

      // Data changed but analysis is still fresh → serve stale with hint
      if (state === 'fresh' || state === 'warm') {
        return {
          response: entry.response,
          freshness: 'stale-data',
          age: Date.now() - entry.timestamp,
          hit: true,
          dataChanged: true
        };
      }

      return null;
    },

    /**
     * Store AI response with its data fingerprint.
     */
    set: function (viewId, data, response, opts) {
      opts = opts || {};
      store[viewId] = {
        fingerprint: fingerprint(data, opts.sensitivity || 'medium'),
        response: response,
        timestamp: Date.now(),
        hits: 0,
        dataSnapshot: data
      };
      // Notify listeners
      for (var i = 0; i < listeners.length; i++) {
        if (listeners[i].viewId === viewId && listeners[i].callback) {
          listeners[i].callback({ viewId: viewId, freshness: 'fresh', response: response });
        }
      }
    },

    /**
     * Invalidate cache for a view or group of views.
     */
    invalidate: function (viewIdOrGroup) {
      if (VIEW_GROUPS[viewIdOrGroup]) {
        var views = VIEW_GROUPS[viewIdOrGroup];
        for (var i = 0; i < views.length; i++) delete store[views[i]];
      } else {
        delete store[viewIdOrGroup];
      }
    },

    /**
     * Feed live metrics into the anomaly detector.
     * Called from the Socket.IO metrics handler in app.js.
     * Returns anomaly report (or null if nothing interesting).
     */
    ingestMetrics: function (system) {
      if (!system) return null;
      var cpu = system.cpuPct || 0;
      var mem = system.usedMemPct || system.memPct || 0;
      var disk = system.usedDiskPct || system.diskPct || 0;

      metricWindows.cpu.push(cpu);
      metricWindows.mem.push(mem);
      if (disk > 0) metricWindows.disk.push(disk);
      if (metricWindows.cpu.length > WINDOW_SIZE) metricWindows.cpu.shift();
      if (metricWindows.mem.length > WINDOW_SIZE) metricWindows.mem.shift();
      if (metricWindows.disk.length > WINDOW_SIZE) metricWindows.disk.shift();

      var anomalies = [];

      if (isAnomaly(metricWindows.cpu, 3.0)) {
        anomalies.push({ metric: 'cpu', value: cpu, trend: detectTrend(metricWindows.cpu, 10) });
      }
      if (isAnomaly(metricWindows.mem, 3.0)) {
        anomalies.push({ metric: 'mem', value: mem, trend: detectTrend(metricWindows.mem, 10) });
      }
      if (isAnomaly(metricWindows.disk, 3.0)) {
        anomalies.push({ metric: 'disk', value: disk, trend: detectTrend(metricWindows.disk, 10) });
      }

      // Threshold-based alerts (simpler but important)
      if (cpu > 90) anomalies.push({ metric: 'cpu', value: cpu, type: 'critical' });
      if (mem > 90) anomalies.push({ metric: 'mem', value: mem, type: 'critical' });
      if (disk > 95) anomalies.push({ metric: 'disk', value: disk, type: 'critical' });

      if (anomalies.length > 0) {
        var event = { timestamp: Date.now(), anomalies: anomalies };
        anomalyLog.push(event);
        if (anomalyLog.length > 100) anomalyLog.shift();

        // Invalidate system views — their cached analysis is now outdated
        this.invalidate('system');

        // Pre-fetch for metrics view if user has visited it before
        if (store.metrics && store.metrics.hits > 0) {
          this._prefetchHint('metrics', anomalies);
        }

        return event;
      }

      return null;
    },

    /**
     * Listen for cache updates on a specific view.
     */
    onUpdate: function (viewId, callback) {
      listeners.push({ viewId: viewId, callback: callback });
    },

    /**
     * Get anomaly history for display.
     */
    getAnomalies: function () {
      return anomalyLog.slice(-20);
    },

    /**
     * Get cache stats for debugging/display.
     */
    stats: function () {
      var keys = Object.keys(store);
      var totalHits = 0;
      var entries = [];
      for (var i = 0; i < keys.length; i++) {
        var e = store[keys[i]];
        totalHits += e.hits;
        entries.push({
          view: keys[i],
          freshness: freshness(e),
          age: Math.round((Date.now() - e.timestamp) / 1000),
          hits: e.hits
        });
      }
      return { entries: entries, totalHits: totalHits, anomalies: anomalyLog.length };
    },

    /**
     * Render the freshness badge HTML for an AI card.
     * Drop this into any AI card header for a live freshness indicator.
     *
     * @param {string} viewId
     * @returns {string} HTML string
     */
    freshnessBadge: function (viewId) {
      var entry = store[viewId];
      var state = freshness(entry);
      var config = {
        fresh:     { color: '#22d3ee', pulse: true,  label: 'Live',   icon: '◉' },
        warm:      { color: '#22d3ee', pulse: false, label: '',       icon: '◉' },
        stale:     { color: '#f59e0b', pulse: false, label: 'Aging',  icon: '◎' },
        'stale-data': { color: '#f59e0b', pulse: true, label: 'Data changed', icon: '⟳' },
        expired:   { color: '#ff6b2b', pulse: false, label: 'Stale',  icon: '○' },
        none:      { color: '#52525a', pulse: false, label: '',       icon: '○' }
      };
      var c = config[state] || config.none;
      var age = entry ? this._formatAge(Date.now() - entry.timestamp) : '';
      var pulseClass = c.pulse ? ' ai-freshness-pulse' : '';

      return '<span class="ai-freshness-badge' + pulseClass + '" style="color:' + c.color + '" title="' + state + (age ? ' · ' + age + ' ago' : '') + '">' +
        '<span class="ai-freshness-dot" style="background:' + c.color + '"></span>' +
        (c.label ? '<span class="ai-freshness-label">' + c.label + '</span>' : '') +
        (age ? '<span class="ai-freshness-age">' + age + '</span>' : '') +
      '</span>';
    },

    /**
     * Smart fetch wrapper — checks cache first, falls back to fetch, stores result.
     * Drop-in replacement for raw fetch() in AI analysis functions.
     *
     * @param {string} viewId — cache key
     * @param {string} url — API endpoint
     * @param {object} fetchOpts — fetch options (method, body, etc.)
     * @param {object} dataContext — the data that drives this analysis (for fingerprinting)
     * @param {object} cacheOpts — { sensitivity, maxAge, responseKey }
     * @returns {Promise<{ response, cached, freshness }>}
     */
    smartFetch: function (viewId, url, fetchOpts, dataContext, cacheOpts) {
      cacheOpts = cacheOpts || {};
      var responseKey = cacheOpts.responseKey || 'response';

      // Check cache
      var cached = this.get(viewId, dataContext, cacheOpts);
      if (cached && !cached.dataChanged) {
        return Promise.resolve({
          response: cached.response,
          cached: true,
          freshness: cached.freshness
        });
      }

      // Fetch fresh
      var self = this;
      return fetch(url, fetchOpts).then(function (r) { return r.json(); }).then(function (d) {
        var text = d[responseKey] || d.analysis || d.briefing || d.summary || d.error || 'Analysis unavailable';
        self.set(viewId, dataContext, text, cacheOpts);
        return {
          response: text,
          cached: false,
          freshness: 'fresh',
          hadStale: cached ? cached.response : null
        };
      });
    },

    // ── Internal ──────────────────────────────────────────────────────
    _prefetchHint: function (viewId, anomalies) {
      // Emit a custom event so the view can optionally pre-analyze
      try {
        window.dispatchEvent(new CustomEvent('ai-prefetch', {
          detail: { viewId: viewId, anomalies: anomalies }
        }));
      } catch (e) {}
    },

    _formatAge: function (ms) {
      if (ms < 60000) return Math.round(ms / 1000) + 's';
      if (ms < 3600000) return Math.round(ms / 60000) + 'm';
      return Math.round(ms / 3600000) + 'h';
    }
  };

})();
