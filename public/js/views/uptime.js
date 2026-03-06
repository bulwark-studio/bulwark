/**
 * Bulwark v2.1 — Uptime Intelligence Center
 * Real-time server monitoring, latency tracking, AI incident analysis
 */
(function () {
  'use strict';

  var refreshTimer = null;
  var serverData = [];
  var uptimeData = [];
  var latencyHistory = {}; // { serverId: [{ts, latency}] }

  var IC = {
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    brain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z"/><path d="M9 21h6"/></svg>',
    refresh: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    server: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    cloud: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    monitor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    zap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    activity: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
  };

  Views.uptime = {
    init: function () {
      var c = document.getElementById('view-uptime');
      if (!c) return;
      c.innerHTML =
        '<div class="overview-grid">' +

        /* ── AI Incident Analysis ── */
        '<div class="briefing-card" id="uptime-ai-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-label">' + IC.brain + ' AI Uptime Analysis <span id="uptime-ai-freshness"></span></div>' +
            '<button class="briefing-refresh" onclick="Views.uptime.aiAnalysis(true)">' + IC.zap + ' Analyze</button>' +
          '</div>' +
          '<div class="briefing-text" id="uptime-ai-text">' +
            '<span style="color:var(--text-secondary)">Click Analyze for AI-powered uptime and reliability insights</span>' +
          '</div>' +
        '</div>' +

        /* ── Global Status Banner ── */
        '<div class="uptime-status-banner" id="uptime-banner">' +
          '<div class="uptime-banner-left">' +
            '<div class="uptime-banner-icon" id="uptime-banner-icon"></div>' +
            '<div><div class="uptime-banner-title" id="uptime-banner-title">Checking...</div>' +
            '<div class="uptime-banner-sub" id="uptime-banner-sub">Loading server status</div></div>' +
          '</div>' +
          '<div class="uptime-banner-stats" id="uptime-banner-stats"></div>' +
        '</div>' +

        /* ── Server Cards ── */
        '<div class="uptime-section-title">' + IC.server + ' Connected Servers <span class="uptime-badge" id="srv-count">0</span></div>' +
        '<div id="uptime-servers" class="uptime-servers-grid"></div>' +

        /* ── Latency Chart ── */
        '<div class="metrics-panel">' +
          '<div class="metrics-panel-header"><span>' + IC.activity + ' Response Time History</span><span class="metrics-live-dot"></span></div>' +
          '<div class="metrics-chart-wrap"><canvas id="uptime-latency-chart" height="200"></canvas></div>' +
        '</div>' +

        /* ── Monitored Endpoints ── */
        '<div class="uptime-section-title">' + IC.globe + ' Monitored Endpoints ' +
          '<button class="uptime-add-btn" onclick="Views.uptime.addEndpoint()">' + IC.plus + ' Add</button>' +
        '</div>' +
        '<div id="uptime-endpoints"></div>' +

        '</div>'; // end grid
    },

    show: function () {
      loadAll();
      Views.uptime.aiAnalysis(false);
      // Auto-refresh every 30s
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(loadAll, 30000);
    },

    hide: function () {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    },

    update: function (data) {
      if (data && data.servers) {
        serverData = data.servers;
        renderServers();
        updateBanner();
      }
    },

    // ── AI Analysis ──────────────────────────────────────────────────
    aiAnalysis: function (force) {
      var el = document.getElementById('uptime-ai-text');
      if (!el) return;
      if (!force && window.AICache) {
        var restored = window.AICache.restore('uptime');
        if (restored) {
          el.textContent = restored.response;
          var fb = document.getElementById('uptime-ai-freshness');
          if (fb) fb.innerHTML = window.AICache.freshnessBadge('uptime');
          return;
        }
      }
      el.innerHTML = '<div class="briefing-shimmer" style="width:90%"></div><div class="briefing-shimmer" style="width:65%"></div>';

      var ctx = serverData.map(function (s) {
        return s.name + ': ' + s.status + ', latency ' + (s.latency || 0) + 'ms' +
          (s.system ? ', CPU ' + (s.system.cpuPct || 0) + '%, Mem ' + (s.system.usedMemPct || 0) + '%, uptime ' + ((s.system.uptimeHours || 0).toFixed(1)) + 'h' : '') +
          (s.error ? ' ERROR: ' + s.error : '');
      }).join('. ');

      var epCtx = uptimeData.map(function (ep) {
        var pct24 = ep.uptime24h !== null ? ep.uptime24h + '%' : 'no data';
        var avgLat = calcAvgLatency(ep.recentChecks || []);
        var downs = (ep.recentChecks || []).filter(function (c) { return !c.ok; }).length;
        return ep.name + ': 24h uptime ' + pct24 + ', avg latency ' + avgLat + 'ms, ' + downs + ' failures in last 90 checks';
      }).join('. ');

      var prompt = 'Analyze this infrastructure uptime data. Servers: ' + (ctx || 'none') +
        '. Endpoints: ' + (epCtx || 'none') +
        '. Give 2-3 sentences about reliability, latency trends, potential risks, and recommendations. Be specific with numbers. No markdown.';

      fetch('/api/db/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      }).then(function (r) { return r.json(); }).then(function (d) {
        var text = d.response || d.error || 'Analysis unavailable';
        typeWriter(el, text);
        if (window.AICache) {
          window.AICache.set('uptime', {}, text);
          var fb = document.getElementById('uptime-ai-freshness');
          if (fb) fb.innerHTML = window.AICache.freshnessBadge('uptime');
        }
      }).catch(function () {
        el.textContent = 'AI analysis unavailable';
      });
    },

    // ── Add Endpoint ─────────────────────────────────────────────────
    addEndpoint: function () {
      Modal.open({
        title: 'Add Monitored Endpoint', size: 'sm',
        body: '<div class="form-group"><label class="form-label">Name</label><input id="up-name" class="form-input" placeholder="My API"></div>' +
          '<div class="form-group"><label class="form-label">URL</label><input id="up-url" class="form-input" placeholder="https://api.example.com/health"></div>' +
          '<div class="form-group"><label class="form-label">Check Interval (seconds)</label><input id="up-interval" class="form-input" type="number" value="60"></div>' +
          '<div class="form-group"><label class="form-label">Expected Status Code</label><input id="up-status" class="form-input" type="number" value="200"></div>',
        footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="up-save">Add Endpoint</button>'
      });
      setTimeout(function () {
        var btn = document.getElementById('up-save');
        if (btn) btn.onclick = function () {
          var name = (document.getElementById('up-name') || {}).value;
          var url = (document.getElementById('up-url') || {}).value;
          var interval = parseInt((document.getElementById('up-interval') || {}).value) || 60;
          var expectedStatus = parseInt((document.getElementById('up-status') || {}).value) || 200;
          if (!name || !url) { Toast.warning('Name and URL required'); return; }
          fetch('/api/uptime/endpoints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, url: url, interval: interval, expectedStatus: expectedStatus }) })
            .then(function (r) { return r.json(); }).then(function (d) {
              if (d.error) { Toast.error(d.error); return; }
              Toast.success('Endpoint added');
              Modal.close(btn.closest('.modal-overlay'));
              loadEndpoints();
            }).catch(function () { Toast.error('Failed'); });
        };
      }, 50);
    }
  };

  // ── Load Everything ────────────────────────────────────────────────
  function loadAll() {
    loadServers();
    loadEndpoints();
  }

  function loadServers() {
    fetch('/api/servers').then(function (r) { return r.json(); }).then(function (d) {
      serverData = d.servers || [];
      renderServers();
      updateBanner();
      updateLatencyChart();
    }).catch(function () {});
  }

  function loadEndpoints() {
    fetch('/api/uptime').then(function (r) { return r.json(); }).then(function (d) {
      uptimeData = d.endpoints || [];
      renderEndpoints();
    }).catch(function () {});
  }

  // ── Global Status Banner ───────────────────────────────────────────
  function updateBanner() {
    var iconEl = document.getElementById('uptime-banner-icon');
    var titleEl = document.getElementById('uptime-banner-title');
    var subEl = document.getElementById('uptime-banner-sub');
    var statsEl = document.getElementById('uptime-banner-stats');
    var banner = document.getElementById('uptime-banner');
    if (!banner) return;

    var total = serverData.length;
    var healthy = serverData.filter(function (s) { return s.status === 'healthy' || s.status === 'up'; }).length;
    var unreachable = serverData.filter(function (s) { return s.status === 'unreachable'; }).length;
    var allGood = healthy === total && total > 0;

    banner.className = 'uptime-status-banner ' + (allGood ? 'status-healthy' : unreachable > 0 ? 'status-down' : 'status-degraded');
    if (iconEl) iconEl.innerHTML = allGood ? IC.check : IC.x;
    if (titleEl) titleEl.textContent = allGood ? 'All Systems Operational' : unreachable > 0 ? 'Service Disruption Detected' : 'Degraded Performance';
    if (subEl) subEl.textContent = healthy + ' of ' + total + ' servers healthy \u00b7 Last checked ' + new Date().toLocaleTimeString();

    if (statsEl) {
      var avgLatency = 0;
      var latCount = 0;
      serverData.forEach(function (s) { if (s.latency > 0) { avgLatency += s.latency; latCount++; } });
      avgLatency = latCount ? Math.round(avgLatency / latCount) : 0;

      statsEl.innerHTML =
        bannerStat(healthy, 'Healthy', '#22d3ee') +
        bannerStat(total - healthy, 'Down', total - healthy > 0 ? '#ff6b2b' : 'var(--text-secondary)') +
        bannerStat(avgLatency + 'ms', 'Avg Latency', avgLatency > 500 ? '#ff6b2b' : '#22d3ee');
    }
  }

  function bannerStat(val, label, color) {
    return '<div class="uptime-banner-stat">' +
      '<div class="uptime-banner-stat-val" style="color:' + color + '">' + val + '</div>' +
      '<div class="uptime-banner-stat-label">' + label + '</div>' +
    '</div>';
  }

  // ── Server Cards ───────────────────────────────────────────────────
  function renderServers() {
    var el = document.getElementById('uptime-servers');
    var countEl = document.getElementById('srv-count');
    if (!el) return;
    if (countEl) countEl.textContent = serverData.length;

    if (!serverData.length) {
      el.innerHTML = '<div class="db-unavailable">No servers connected</div>';
      return;
    }

    el.innerHTML = serverData.map(function (s) {
      var isUp = s.status === 'healthy' || s.status === 'up';
      var statusColor = isUp ? '#22d3ee' : s.status === 'unreachable' ? '#ff6b2b' : '#f59e0b';
      var statusText = isUp ? 'OPERATIONAL' : s.status === 'unreachable' ? 'UNREACHABLE' : 'DEGRADED';
      var icon = s.provider === 'aws' ? IC.cloud : s.provider === 'local' ? IC.monitor : IC.server;
      var sys = s.system || {};

      // Track latency
      var key = s.name.replace(/\s/g, '_');
      if (!latencyHistory[key]) latencyHistory[key] = [];
      if (s.latency >= 0) {
        latencyHistory[key].push({ ts: Date.now(), v: s.latency });
        if (latencyHistory[key].length > 60) latencyHistory[key].shift();
      }

      // Mini latency sparkline SVG
      var sparkSvg = '';
      var hist = latencyHistory[key];
      if (hist.length > 2) {
        var maxLat = Math.max.apply(null, hist.map(function (h) { return h.v; })) || 1;
        var points = hist.map(function (h, i) { return i * (120 / hist.length) + ',' + (28 - (h.v / maxLat) * 24); }).join(' ');
        sparkSvg = '<svg class="srv-latency-spark" viewBox="0 0 120 30" preserveAspectRatio="none">' +
          '<polyline points="' + points + '" fill="none" stroke="' + statusColor + '" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/></svg>';
      }

      return '<div class="srv-card ' + (isUp ? '' : 'srv-down') + '">' +
        '<div class="srv-card-header">' +
          '<div class="srv-card-icon" style="color:' + statusColor + '">' + icon + '</div>' +
          '<div class="srv-card-info">' +
            '<div class="srv-card-name">' + esc(s.name) + '</div>' +
            '<div class="srv-card-host">' + esc(s.host || '') + '</div>' +
          '</div>' +
          '<div class="srv-card-status" style="color:' + statusColor + ';border-color:' + statusColor + '">' +
            '<span class="srv-status-dot" style="background:' + statusColor + '"></span>' + statusText +
          '</div>' +
        '</div>' +
        '<div class="srv-card-metrics">' +
          (s.latency >= 0 ? srvMetric(s.latency + 'ms', 'Latency', s.latency > 500 ? '#ff6b2b' : s.latency > 200 ? '#f59e0b' : '#22d3ee') : srvMetric('--', 'Latency', 'var(--text-secondary)')) +
          (sys.cpuPct !== undefined ? srvMetric(sys.cpuPct + '%', 'CPU', sys.cpuPct > 80 ? '#ff6b2b' : '#22d3ee') : srvMetric('--', 'CPU', 'var(--text-secondary)')) +
          (sys.usedMemPct !== undefined ? srvMetric(sys.usedMemPct + '%', 'Memory', sys.usedMemPct > 80 ? '#ff6b2b' : '#a78bfa') : srvMetric('--', 'Memory', 'var(--text-secondary)')) +
          (sys.uptimeHours !== undefined ? srvMetric(formatUptime(sys.uptimeHours), 'Uptime', '#22d3ee') : srvMetric('--', 'Uptime', 'var(--text-secondary)')) +
          (sys.cpuCount ? srvMetric(sys.cpuCount, 'Cores', '#3b82f6') : '') +
          (sys.nodeVersion ? srvMetric(sys.nodeVersion, 'Node', 'var(--text-secondary)') : '') +
        '</div>' +
        (sparkSvg ? '<div class="srv-card-spark">' + sparkSvg + '</div>' : '') +
        (s.error ? '<div class="srv-card-error">' + esc(s.error) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function srvMetric(val, label, color) {
    return '<div class="srv-metric">' +
      '<div class="srv-metric-val" style="color:' + color + '">' + val + '</div>' +
      '<div class="srv-metric-label">' + label + '</div>' +
    '</div>';
  }

  // ── Latency Chart ──────────────────────────────────────────────────
  function updateLatencyChart() {
    var datasets = [];
    var colors = ['#22d3ee', '#ff6b2b', '#a78bfa', '#f59e0b', '#3b82f6'];
    var maxLen = 0;
    var ci = 0;
    var labels = [];

    serverData.forEach(function (s) {
      var key = s.name.replace(/\s/g, '_');
      var hist = latencyHistory[key] || [];
      if (hist.length > maxLen) {
        maxLen = hist.length;
        labels = hist.map(function (h) { return new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); });
      }
      if (s.latency >= 0) {
        var color = colors[ci % colors.length];
        datasets.push(Object.assign({ data: hist.map(function (h) { return h.v; }), label: s.name },
          Charts.defaultLineConfig ? Charts.defaultLineConfig(color) : { borderColor: color, fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }));
        ci++;
      }
    });

    if (Charts.instances['uptime-latency-chart']) {
      Charts.update('uptime-latency-chart', labels, datasets);
    } else if (datasets.length) {
      Charts.create('uptime-latency-chart', 'line', {
        data: { labels: labels, datasets: datasets },
        options: {
          scales: { y: { min: 0, title: { display: true, text: 'ms', color: '#8b8b92', font: { size: 10 } } } },
          plugins: { legend: { display: true, labels: { color: '#a1a1aa', font: { size: 10 } } } }
        }
      });
    }
  }

  // ── Endpoint Cards ─────────────────────────────────────────────────
  function renderEndpoints() {
    var el = document.getElementById('uptime-endpoints');
    if (!el) return;

    if (!uptimeData.length) {
      el.innerHTML = '<div class="uptime-empty">' +
        '<div class="uptime-empty-icon">' + IC.globe + '</div>' +
        '<div>No endpoints monitored yet</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Add URLs to monitor their availability and response times</div>' +
      '</div>';
      return;
    }

    el.innerHTML = uptimeData.map(function (ep) {
      var pct24 = ep.uptime24h;
      var pct7d = ep.uptime7d;
      var pct30d = ep.uptime30d;
      var checks = ep.recentChecks || [];
      var avgLat = calcAvgLatency(checks);
      var lastCheck = checks.length ? checks[checks.length - 1] : null;
      var isUp = lastCheck ? lastCheck.ok : null;

      return '<div class="ep-card">' +
        '<div class="ep-card-header">' +
          '<div class="ep-card-status" style="color:' + (isUp === null ? 'var(--text-secondary)' : isUp ? '#22d3ee' : '#ff6b2b') + '">' +
            (isUp === null ? IC.clock : isUp ? IC.check : IC.x) +
          '</div>' +
          '<div class="ep-card-info">' +
            '<div class="ep-card-name">' + esc(ep.name) + '</div>' +
            '<div class="ep-card-url">' + esc(ep.url) + '</div>' +
          '</div>' +
          '<button class="ep-delete" onclick="Views.uptime.deleteEp(\'' + esc(ep.id) + '\')" title="Delete">' + IC.trash + '</button>' +
        '</div>' +
        '<div class="ep-metrics">' +
          epMetric(fmtPct(pct24), '24h', pctColor(pct24)) +
          epMetric(fmtPct(pct7d), '7d', pctColor(pct7d)) +
          epMetric(fmtPct(pct30d), '30d', pctColor(pct30d)) +
          epMetric(avgLat + 'ms', 'Latency', avgLat > 500 ? '#ff6b2b' : '#22d3ee') +
        '</div>' +
        '<div class="ep-bar-wrap">' +
          '<div class="ep-bar-label">Last 90 checks</div>' +
          '<div class="ep-bar">' + renderBar(checks) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  Views.uptime.deleteEp = function (id) {
    Modal.confirm({ title: 'Delete Endpoint', message: 'Remove this monitored endpoint?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/uptime/endpoints/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadEndpoints(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  // ── Bar renderer ───────────────────────────────────────────────────
  function renderBar(checks) {
    if (!checks || !checks.length) return '<span style="color:var(--text-secondary);font-size:10px">No data yet</span>';
    var recent = checks.slice(-90);
    return recent.map(function (c) {
      var up = c.ok;
      var color = up ? '#22d3ee' : '#ff6b2b';
      var opacity = up ? '0.7' : '1';
      return '<div class="ep-bar-tick" style="background:' + color + ';opacity:' + opacity + '" title="' + (c.latency || 0) + 'ms — ' + (up ? 'OK' : 'FAIL') + '"></div>';
    }).join('');
  }

  function epMetric(val, label, color) {
    return '<div class="ep-metric">' +
      '<div class="ep-metric-val" style="color:' + color + '">' + val + '</div>' +
      '<div class="ep-metric-label">' + label + '</div>' +
    '</div>';
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function calcAvgLatency(checks) {
    var sum = 0, count = 0;
    (checks || []).forEach(function (c) { if (c.latency > 0) { sum += c.latency; count++; } });
    return count ? Math.round(sum / count) : 0;
  }

  function pctColor(pct) {
    if (pct === null || pct === undefined) return 'var(--text-secondary)';
    if (pct >= 99) return '#22d3ee';
    if (pct >= 95) return '#f59e0b';
    return '#ff6b2b';
  }

  function fmtPct(pct) { return typeof pct === 'number' ? pct.toFixed(2) + '%' : '--'; }

  function formatUptime(hours) {
    if (hours >= 24) return Math.floor(hours / 24) + 'd ' + Math.floor(hours % 24) + 'h';
    if (hours >= 1) return hours.toFixed(1) + 'h';
    return Math.round(hours * 60) + 'm';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }

  function typeWriter(el, text, speed) {
    speed = speed || 18;
    el.innerHTML = '';
    var i = 0;
    var cursor = document.createElement('span');
    cursor.className = 'briefing-cursor';
    var timer = setInterval(function () {
      if (i < text.length) {
        el.textContent = text.substring(0, i + 1);
        el.appendChild(cursor);
        i++;
      } else {
        clearInterval(timer);
        setTimeout(function () { if (cursor.parentNode) cursor.remove(); }, 2000);
      }
    }, speed);
  }
})();
