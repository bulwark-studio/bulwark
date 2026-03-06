// =============================================================================
// Cache Intelligence Dashboard — Neural Cache Engine Frontend
// =============================================================================
(function() {
  'use strict';

  var statsData = null;
  var heatmapData = null;
  var timelineData = [];
  var refreshTimer = null;
  var timelineMax = 200;

  Views.cache = {
    init: function() {
      var el = document.getElementById('view-cache');
      if (!el) return;
      el.innerHTML = buildTemplate();
    },

    show: function() {
      this.init();
      fetchAll();
      refreshTimer = setInterval(fetchAll, 5000);
    },

    hide: function() {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    },

    update: function(data) {
      if (data && data.cache_stats) {
        statsData = data.cache_stats;
        renderStats();
        renderHealthRing();
        renderTiers();
      }
    }
  };

  function buildTemplate() {
    return '' +
      '<div class="cache-dashboard">' +
        // AI Analysis
        '<div class="cache-ai-section">' +
          '<div class="briefing-card">' +
            '<div class="briefing-header">' +
              '<div class="briefing-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="22" height="22"><path d="M12 2a7 7 0 017 7c0 2.5-1.2 4.7-3 6v2a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2c-1.8-1.3-3-3.5-3-6a7 7 0 017-7z"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="10" y1="23" x2="14" y2="23"/></svg></div>' +
              '<div class="briefing-title">Cache Intelligence Analysis</div>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.cache.runAnalysis()" id="cache-ai-btn">Analyze</button>' +
            '</div>' +
            '<div class="briefing-body" id="cache-ai-body">' +
              '<span class="text-secondary">Click Analyze to generate AI-powered cache optimization insights.</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Health Ring + Stats Row
        '<div class="cache-top-row">' +
          '<div class="cache-health-card glass-card">' +
            '<div class="cache-health-label">Cache Health</div>' +
            '<div class="cache-health-ring-wrap">' +
              '<svg viewBox="0 0 120 120" width="120" height="120" id="cache-health-svg">' +
                '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>' +
                '<circle cx="60" cy="60" r="52" fill="none" stroke="var(--cyan)" stroke-width="8" id="cache-health-arc" stroke-dasharray="326.7" stroke-dashoffset="326.7" stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 0.8s ease"/>' +
                '<text x="60" y="56" text-anchor="middle" fill="var(--text-primary)" font-size="28" font-weight="700" id="cache-health-val">--</text>' +
                '<text x="60" y="74" text-anchor="middle" fill="var(--text-secondary)" font-size="11">SCORE</text>' +
              '</svg>' +
            '</div>' +
          '</div>' +
          '<div class="cache-stats-grid" id="cache-stats-grid">' +
            statCard('Hit Rate', '--', '%', 'cache-stat-hitrate') +
            statCard('Total Hits', '--', '', 'cache-stat-hits') +
            statCard('Total Misses', '--', '', 'cache-stat-misses') +
            statCard('Entries', '--', '', 'cache-stat-entries') +
            statCard('Memory', '--', 'KB', 'cache-stat-memory') +
            statCard('Latency Saved', '--', 'ms', 'cache-stat-latency') +
          '</div>' +
        '</div>' +

        // Heatmap + Tiers
        '<div class="cache-mid-row">' +
          '<div class="glass-card cache-heatmap-card">' +
            '<div class="card-header">Route Heatmap</div>' +
            '<div class="cache-heatmap" id="cache-heatmap">Loading...</div>' +
          '</div>' +
          '<div class="glass-card cache-tiers-card">' +
            '<div class="card-header">Tier Breakdown</div>' +
            '<div class="cache-tiers" id="cache-tiers"></div>' +
          '</div>' +
        '</div>' +

        // Timeline
        '<div class="glass-card cache-timeline-card">' +
          '<div class="card-header">' +
            '<span>Cache Event Timeline</span>' +
            '<div class="cache-timeline-filters" id="cache-timeline-filters">' +
              filterBtn('ALL', true) + filterBtn('HIT') + filterBtn('MISS') + filterBtn('SET') +
              filterBtn('EVICT') + filterBtn('SEMANTIC') + filterBtn('PREFETCH') +
            '</div>' +
          '</div>' +
          '<div class="cache-timeline" id="cache-timeline"><span class="text-secondary">Waiting for events...</span></div>' +
        '</div>' +

        // Controls
        '<div class="cache-controls">' +
          '<button class="btn btn-sm btn-ghost" onclick="Views.cache.flush()">Flush All</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="fetchAll()">Refresh</button>' +
        '</div>' +
      '</div>';
  }

  function statCard(label, value, unit, id) {
    return '<div class="cache-stat-card glass-card">' +
      '<div class="cache-stat-value"><span id="' + id + '">' + value + '</span><small>' + unit + '</small></div>' +
      '<div class="cache-stat-label">' + label + '</div>' +
    '</div>';
  }

  function filterBtn(type, active) {
    return '<button class="cache-filter-btn' + (active ? ' active' : '') + '" data-filter="' + type + '" onclick="Views.cache.filterTimeline(\'' + type + '\')">' + type + '</button>';
  }

  // ── Data Fetching ──
  function fetchAll() {
    fetch('/api/cache/stats').then(function(r) { return r.json(); }).then(function(d) {
      if (!d.error) { statsData = d; renderStats(); renderHealthRing(); renderTiers(); }
    }).catch(function() {});

    fetch('/api/cache/heatmap').then(function(r) { return r.json(); }).then(function(d) {
      if (!d.error) { heatmapData = d.heatmap || d; renderHeatmap(); }
    }).catch(function() {});

    fetch('/api/cache/timeline?limit=50').then(function(r) { return r.json(); }).then(function(d) {
      var events = Array.isArray(d) ? d : (d.events || []);
      if (events.length > 0) {
        var existing = {};
        timelineData.forEach(function(e) { existing[e.ts + e.key] = true; });
        events.forEach(function(e) {
          if (!existing[e.ts + e.key]) timelineData.unshift(e);
        });
        if (timelineData.length > timelineMax) timelineData = timelineData.slice(0, timelineMax);
      }
      renderTimeline();
    }).catch(function() {});
  }
  window.fetchAll = fetchAll; // for onclick

  // ── Renderers ──
  function renderStats() {
    if (!statsData) return;
    var s = statsData;
    setText('cache-stat-hitrate', s.hitRate != null ? Number(s.hitRate).toFixed(1) : '0');
    setText('cache-stat-hits', fmt(s.total ? s.total.hits || 0 : 0));
    setText('cache-stat-misses', fmt(s.total ? s.total.misses || 0 : 0));
    setText('cache-stat-entries', fmt(s.entries || 0));
    var memKB = s.memory ? (s.memory / 1024).toFixed(1) : '0';
    setText('cache-stat-memory', memKB);
    setText('cache-stat-latency', fmt(s.total ? s.total.latencySaved || 0 : 0));
  }

  function renderHealthRing() {
    if (!statsData) return;
    var score = statsData.health || 0;
    var arc = document.getElementById('cache-health-arc');
    var val = document.getElementById('cache-health-val');
    if (!arc || !val) return;
    var circumference = 326.7;
    arc.setAttribute('stroke-dashoffset', circumference - (circumference * score / 100));
    val.textContent = Math.round(score);
    // Color by score
    var color = score >= 70 ? 'var(--cyan)' : score >= 40 ? '#eab308' : 'var(--orange)';
    arc.setAttribute('stroke', color);
  }

  function renderTiers() {
    var el = document.getElementById('cache-tiers');
    if (!el || !statsData) return;
    var html = '';
    var tierDefs = [
      { key: 'tier1', name: 'Tier 1 — Hot Cache', icon: 'H', desc: 'In-memory LRU, <0.1ms' },
      { key: 'tier2', name: 'Tier 2 — Semantic', icon: 'S', desc: 'AI prompt matching' },
      { key: 'tier3', name: 'Tier 3 — Prefetch', icon: 'P', desc: 'Predictive pre-warming' }
    ];
    tierDefs.forEach(function(t) {
      var d = statsData[t.key] || { entries: 0, hits: 0, misses: 0 };
      var rate = (d.hits + d.misses) > 0 ? ((d.hits / (d.hits + d.misses)) * 100).toFixed(1) : '0.0';
      html += '<div class="cache-tier-card">' +
        '<div class="cache-tier-icon">' + t.icon + '</div>' +
        '<div class="cache-tier-info">' +
          '<div class="cache-tier-name">' + t.name + '</div>' +
          '<div class="cache-tier-desc">' + t.desc + '</div>' +
          '<div class="cache-tier-stats">' +
            '<span>' + d.entries + ' entries</span>' +
            '<span>' + rate + '% hit rate</span>' +
            '<span>' + (d.hits || 0) + ' hits</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  function renderHeatmap() {
    var el = document.getElementById('cache-heatmap');
    if (!el || !heatmapData) return;
    var routes = Array.isArray(heatmapData) ? heatmapData : (heatmapData.routes || []);
    if (routes.length === 0) { el.innerHTML = '<span class="text-secondary">No cached routes yet</span>'; return; }

    routes.sort(function(a, b) { return (b.total || 0) - (a.total || 0); });
    var maxAccess = routes[0].total || 1;

    var html = '<div class="heatmap-grid">';
    routes.forEach(function(r) {
      var intensity = Math.min((r.total || 0) / maxAccess, 1);
      var hue = intensity > 0.66 ? '180' : intensity > 0.33 ? '45' : '220'; // cyan / orange / blue
      var sat = '80%';
      var light = (20 + intensity * 40) + '%';
      var bg = 'hsl(' + hue + ',' + sat + ',' + light + ')';
      var border = 'hsl(' + hue + ',' + sat + ',' + (30 + intensity * 30) + '%)';
      html += '<div class="heatmap-cell" style="background:' + bg + ';border-color:' + border + '" title="' +
        escapeHtml(r.route) + '\nTotal: ' + (r.total || 0) + ' | Recent: ' + (r.recent || 0) + '">' +
        '<div class="heatmap-route">' + escapeHtml(shortRoute(r.route)) + '</div>' +
        '<div class="heatmap-count">' + fmt(r.total || 0) + '</div>' +
      '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  var activeFilter = 'ALL';
  Views.cache.filterTimeline = function(type) {
    activeFilter = type;
    // Update button states
    var btns = document.querySelectorAll('.cache-filter-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-filter') === type); });
    renderTimeline();
  };

  function renderTimeline() {
    var el = document.getElementById('cache-timeline');
    if (!el) return;
    var filtered = activeFilter === 'ALL' ? timelineData : timelineData.filter(function(e) {
      if (activeFilter === 'SEMANTIC') return e.type === 'SEMANTIC_HIT';
      return e.type === activeFilter;
    });
    if (filtered.length === 0) {
      el.innerHTML = '<span class="text-secondary">No ' + activeFilter + ' events yet</span>';
      return;
    }
    var html = '';
    filtered.slice(0, 100).forEach(function(e) {
      var cls = 'tl-' + (e.type || 'SET').toLowerCase().replace('_', '-');
      html += '<div class="cache-tl-event ' + cls + '">' +
        '<span class="tl-type">' + (e.type || 'SET') + '</span>' +
        '<span class="tl-key">' + escapeHtml(shortRoute(e.key || '')) + '</span>' +
        '<span class="tl-tier">' + (e.tier || '') + '</span>' +
        '<span class="tl-time">' + timeAgo(e.ts) + '</span>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  // ── AI Analysis ──
  Views.cache.runAnalysis = function() {
    var btn = document.getElementById('cache-ai-btn');
    var body = document.getElementById('cache-ai-body');
    if (!btn || !body) return;
    btn.disabled = true; btn.textContent = 'Analyzing...';
    body.innerHTML = '<span class="text-secondary typing-dots">Consulting Claude...</span>';

    fetch('/api/cache/ai-analysis').then(function(r) { return r.json(); }).then(function(d) {
      btn.disabled = false; btn.textContent = 'Analyze';
      if (d.analysis) {
        typewriterEffect(body, d.analysis);
      } else {
        body.innerHTML = '<span class="text-secondary">' + escapeHtml(d.error || 'Analysis unavailable') + '</span>';
      }
    }).catch(function() {
      btn.disabled = false; btn.textContent = 'Analyze';
      body.innerHTML = '<span class="text-secondary">Failed to reach cache analysis endpoint.</span>';
    });
  };

  Views.cache.flush = function() {
    if (!confirm('Flush all cache tiers? This cannot be undone.')) return;
    fetch('/api/cache/flush', { method: 'POST' }).then(function(r) { return r.json(); }).then(function(d) {
      if (window.Toast) Toast.success('Cache flushed successfully');
      fetchAll();
    }).catch(function() {
      if (window.Toast) Toast.error('Failed to flush cache');
    });
  };

  // ── Helpers ──
  function setText(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
  function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function escapeHtml(s) { return window.escapeHtml ? window.escapeHtml(s) : s.replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function shortRoute(r) { return r.length > 35 ? '...' + r.slice(-32) : r; }
  function timeAgo(ts) {
    if (!ts) return '--';
    var diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 5) return 'now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return Math.floor(diff / 3600) + 'h ago';
  }

  function typewriterEffect(el, text) {
    el.innerHTML = '';
    var i = 0;
    var span = document.createElement('span');
    span.className = 'typewriter-text';
    el.appendChild(span);
    function tick() {
      if (i < text.length) {
        span.textContent += text[i];
        i++;
        setTimeout(tick, 8 + Math.random() * 12);
      }
    }
    tick();
  }
})();
