// =============================================================================
// Server Intelligence Center — AI-Powered Fleet Monitoring
// =============================================================================
(function () {
  'use strict';

  var servers = [];
  var latencyHistory = {}; // name → [{ ts, latency }]
  var refreshTimer = null;

  Views.servers = {
    init: function () {
      var el = document.getElementById('view-servers');
      if (!el) return;
      el.innerHTML = buildTemplate();
    },
    show: function () {
      this.init();
      loadServers();
      refreshTimer = setInterval(loadServers, 30000);
    },
    hide: function () {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    },
    update: function (data) {
      if (data && data.servers) {
        servers = data.servers;
        render();
      }
    }
  };

  function buildTemplate() {
    return '<div class="srv-dashboard">' +
      // AI Analysis
      '<div class="srv-ai-section">' +
        '<div class="briefing-card glass-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="22" height="22"><rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><circle cx="7" cy="6.5" r="1" fill="var(--cyan)"/><circle cx="7" cy="17.5" r="1" fill="var(--cyan)"/><line x1="11" y1="6.5" x2="17" y2="6.5"/><line x1="11" y1="17.5" x2="17" y2="17.5"/></svg></div>' +
            '<div class="briefing-title">Infrastructure Intelligence</div>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.servers.runAI()" id="srv-ai-btn">Analyze</button>' +
          '</div>' +
          '<div class="briefing-body" id="srv-ai-body"><span class="text-secondary">Click Analyze for AI infrastructure health assessment.</span></div>' +
        '</div>' +
      '</div>' +
      // Status Banner
      '<div class="srv-status-banner glass-card" id="srv-status-banner"></div>' +
      // Fleet Cards
      '<div class="srv-fleet-grid" id="srv-fleet-grid"></div>' +
      // Bottom row: Latency Chart + Topology
      '<div class="srv-bottom-row">' +
        '<div class="glass-card srv-latency-card"><div class="card-header">Latency History</div><div id="srv-latency-chart-wrap"><canvas id="srv-latency-chart" height="180"></canvas></div></div>' +
        '<div class="glass-card srv-topology-card"><div class="card-header">Network Topology</div><div id="srv-topology"></div></div>' +
      '</div>' +
      // Timeline
      '<div class="glass-card srv-timeline-card"><div class="card-header">Fleet Events</div><div id="srv-timeline" class="srv-timeline"></div></div>' +
    '</div>';
  }

  function loadServers() {
    fetch('/api/servers').then(safeJson).then(function (d) {
      servers = d.servers || [];
      servers.forEach(function (s) {
        if (!latencyHistory[s.name]) latencyHistory[s.name] = [];
        latencyHistory[s.name].push({ ts: Date.now(), latency: s.latency || 0 });
        if (latencyHistory[s.name].length > 60) latencyHistory[s.name].shift();
      });
      render();
    }).catch(function () {});
  }

  function render() {
    renderBanner();
    renderFleetCards();
    renderLatencyChart();
    renderTopology();
    renderTimeline();
  }

  function renderBanner() {
    var el = document.getElementById('srv-status-banner');
    if (!el) return;
    var healthy = servers.filter(function (s) { return s.status === 'healthy'; }).length;
    var total = servers.length;
    var avgLat = total > 0 ? Math.round(servers.reduce(function (sum, s) { return sum + (s.latency || 0); }, 0) / total) : 0;
    var allHealthy = healthy === total && total > 0;
    var anyDown = servers.some(function (s) { return s.status === 'error' || s.status === 'unreachable'; });
    var statusText = allHealthy ? 'All Systems Operational' : anyDown ? 'Service Degradation Detected' : 'Partial Systems Online';
    var statusColor = allHealthy ? 'var(--cyan)' : 'var(--orange)';

    el.innerHTML = '<div class="srv-banner-status" style="color:' + statusColor + '">' +
        '<span class="dot ' + (allHealthy ? 'dot-healthy' : 'dot-unhealthy') + '" style="width:10px;height:10px"></span>' + statusText +
      '</div>' +
      '<div class="srv-banner-stats">' +
        '<div class="srv-banner-stat"><span class="srv-banner-num">' + total + '</span> Servers</div>' +
        '<div class="srv-banner-stat"><span class="srv-banner-num" style="color:var(--cyan)">' + healthy + '</span> Healthy</div>' +
        '<div class="srv-banner-stat"><span class="srv-banner-num">' + avgLat + 'ms</span> Avg Latency</div>' +
      '</div>';
  }

  function renderFleetCards() {
    var el = document.getElementById('srv-fleet-grid');
    if (!el) return;
    if (servers.length === 0) { el.innerHTML = '<div class="text-secondary" style="padding:20px">No servers configured</div>'; return; }
    el.innerHTML = servers.map(function (s) {
      var healthy = s.status === 'healthy';
      var sys = s.system || {};
      var cpu = sys.cpuPct || sys.cpu || 0;
      var mem = sys.usedMemPct || sys.mem || 0;
      var disk = sys.diskPct || 0;
      var history = latencyHistory[s.name] || [];

      return '<div class="srv-fleet-card glass-card">' +
        '<div class="srv-card-header">' +
          '<span class="dot ' + (healthy ? 'dot-healthy' : 'dot-unhealthy') + '"></span>' +
          '<span class="srv-card-name">' + esc(s.name) + '</span>' +
          '<span class="srv-provider-badge srv-provider-' + (s.provider || 'local').toLowerCase() + '">' + esc(s.provider || 'Local') + '</span>' +
        '</div>' +
        '<div class="srv-card-host">' + esc(s.host || 'localhost') + '</div>' +
        '<div class="srv-gauges">' + srvGauge(cpu, 'CPU') + srvGauge(mem, 'MEM') + srvGauge(disk, 'DISK') + '</div>' +
        '<div class="srv-card-metrics">' +
          metric('Latency', (s.latency || 0) + 'ms', s.latency > 500 ? 'var(--orange)' : '') +
          metric('Uptime', formatUptime(sys.uptimeSec || sys.uptime || 0), '') +
          (sys.nodeVersion ? metric('Node', sys.nodeVersion, '') : '') +
          (s.commit ? metric('Commit', String(s.commit).slice(0, 7), '') : '') +
          (s.db !== undefined ? metric('DB', s.db === 'connected' || s.db === true ? 'Connected' : 'Down', s.db === 'connected' || s.db === true ? 'var(--cyan)' : 'var(--orange)') : '') +
        '</div>' +
        (history.length > 3 ? '<div class="srv-sparkline">' + sparklineSVG(history.map(function (h) { return h.latency; })) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function metric(label, value, color) {
    return '<div><span class="text-tertiary">' + label + '</span><span' + (color ? ' style="color:' + color + '"' : '') + '>' + esc(value) + '</span></div>';
  }

  function srvGauge(pct, label) {
    pct = Math.min(100, Math.max(0, pct || 0));
    var r = 20, circ = 2 * Math.PI * r;
    var offset = circ - (circ * pct / 100);
    var color = pct > 85 ? 'var(--orange)' : pct > 60 ? '#eab308' : 'var(--cyan)';
    return '<div class="srv-gauge"><svg viewBox="0 0 48 48" width="48" height="48">' +
      '<circle cx="24" cy="24" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>' +
      '<circle cx="24" cy="24" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="4" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" transform="rotate(-90 24 24)" style="transition:stroke-dashoffset 0.6s"/>' +
      '<text x="24" y="22" text-anchor="middle" fill="var(--text-primary)" font-size="10" font-weight="600">' + Math.round(pct) + '%</text>' +
      '<text x="24" y="32" text-anchor="middle" fill="var(--text-tertiary)" font-size="7">' + label + '</text>' +
    '</svg></div>';
  }

  function sparklineSVG(data) {
    if (data.length < 2) return '';
    var w = 140, h = 28, pad = 2;
    var max = Math.max.apply(null, data) || 1, min = Math.min.apply(null, data), range = max - min || 1;
    var points = data.map(function (v, i) {
      return (pad + (i / (data.length - 1)) * (w - 2 * pad)) + ',' + (pad + (1 - (v - min) / range) * (h - 2 * pad));
    }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"><polyline points="' + points + '" fill="none" stroke="var(--cyan)" stroke-width="1.5" opacity="0.7"/></svg>';
  }

  var latChart = null;
  function renderLatencyChart() {
    var ctx = document.getElementById('srv-latency-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (latChart) { latChart.destroy(); latChart = null; }
    var datasets = [], colors = ['#22d3ee', '#ff6b2b', '#a78bfa', '#34d399', '#f472b6', '#facc15'];
    var maxLen = 0;
    Object.keys(latencyHistory).forEach(function (name, i) {
      var hist = latencyHistory[name];
      if (hist.length > maxLen) maxLen = hist.length;
      datasets.push({ label: name, data: hist.map(function (h) { return h.latency; }), borderColor: colors[i % colors.length], backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2 });
    });
    var labels = []; for (var i = 0; i < maxLen; i++) labels.push('');
    latChart = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: datasets }, options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b8b92', font: { size: 10 } }, title: { display: true, text: 'ms', color: '#52525a' } } },
      plugins: { legend: { display: true, labels: { color: '#8b8b92', font: { size: 10 } } } },
    }});
  }

  function renderTopology() {
    var el = document.getElementById('srv-topology');
    if (!el) return;
    fetch('/api/cloudflare/config').then(safeJson).then(function (d) {
      drawTopology(el, d.configured);
    }).catch(function () { drawTopology(el, false); });
  }

  function drawTopology(el, hasCF) {
    var w = 500, h = 200;
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '">';
    var userX = w / 2, userY = 20, cfY = 70, srvY = 150;
    svg += topoNode(userX, userY, 'Users', '#8b8b92', 'U');
    if (hasCF) {
      svg += topoNode(userX, cfY, 'Cloudflare', '#f6821f', 'CF');
      svg += topoEdge(userX, userY + 18, userX, cfY - 18, '#f6821f');
    }
    var startY = hasCF ? cfY : userY;
    var n = servers.length;
    servers.forEach(function (s, i) {
      var x = n === 1 ? w / 2 : 60 + (i * ((w - 120) / Math.max(n - 1, 1)));
      var healthy = s.status === 'healthy';
      var color = healthy ? '#22d3ee' : '#ff6b2b';
      svg += topoNode(x, srvY, s.name.length > 12 ? s.name.slice(0, 12) + '..' : s.name, color, s.provider ? s.provider[0] : 'S');
      svg += topoEdge(userX, startY + 18, x, srvY - 18, color, (s.latency || 0) + 'ms');
    });
    svg += '</svg>';
    el.innerHTML = svg;
  }

  function topoNode(x, y, label, color, icon) {
    return '<circle cx="' + x + '" cy="' + y + '" r="16" fill="rgba(14,14,18,0.8)" stroke="' + color + '" stroke-width="1.5"/>' +
      '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" fill="' + color + '" font-size="10" font-weight="700">' + icon + '</text>' +
      '<text x="' + x + '" y="' + (y + 30) + '" text-anchor="middle" fill="var(--text-secondary)" font-size="9">' + label + '</text>';
  }

  function topoEdge(x1, y1, x2, y2, color, label) {
    var svg = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="1" opacity="0.4" stroke-dasharray="4 3"/>';
    if (label) { var mx = (x1 + x2) / 2, my = (y1 + y2) / 2; svg += '<text x="' + mx + '" y="' + (my - 3) + '" text-anchor="middle" fill="var(--text-tertiary)" font-size="8">' + label + '</text>'; }
    return svg;
  }

  function renderTimeline() {
    var el = document.getElementById('srv-timeline');
    if (!el) return;
    if (servers.length === 0) { el.innerHTML = '<span class="text-secondary">No events</span>'; return; }
    el.innerHTML = servers.map(function (s) {
      var healthy = s.status === 'healthy';
      return '<div class="srv-tl-event ' + (healthy ? 'tl-healthy' : 'tl-alert') + '">' +
        '<span class="dot ' + (healthy ? 'dot-healthy' : 'dot-unhealthy') + '" style="width:6px;height:6px"></span>' +
        '<span class="srv-tl-msg">' + esc(s.name + ' — ' + (healthy ? 'Operational' : s.status) + ' (' + (s.latency || 0) + 'ms)') + '</span>' +
        '<span class="srv-tl-time">now</span>' +
      '</div>';
    }).join('');
  }

  Views.servers.runAI = function () {
    var btn = document.getElementById('srv-ai-btn');
    var body = document.getElementById('srv-ai-body');
    if (!btn || !body) return;
    btn.disabled = true; btn.textContent = 'Analyzing...';
    body.innerHTML = '<span class="text-secondary">Analyzing infrastructure...</span>';
    fetch('/api/briefing').then(safeJson).then(function (d) {
      btn.disabled = false; btn.textContent = 'Analyze';
      if (d.briefing) { typewriter(body, d.briefing); } else if (d.fallback) { typewriter(body, d.fallback); }
      else { body.innerHTML = '<span class="text-secondary">Analysis unavailable</span>'; }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Analyze'; });
  };

  function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s || '')) : String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function formatUptime(sec) { if (!sec) return '--'; var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600); if (d > 0) return d + 'd ' + h + 'h'; if (h > 0) return h + 'h ' + Math.floor((sec % 3600) / 60) + 'm'; return Math.floor(sec / 60) + 'm'; }
  function typewriter(el, text) { el.innerHTML = ''; var span = document.createElement('span'); span.className = 'typewriter-text'; el.appendChild(span); var i = 0; (function tick() { if (i < text.length) { span.textContent += text[i++]; setTimeout(tick, 8 + Math.random() * 12); } })(); }
})();
