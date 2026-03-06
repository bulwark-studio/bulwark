// =============================================================================
// Cloudflare Analytics Center — Traffic, Security, Cache across all domains
// =============================================================================
(function () {
  'use strict';

  var config = null;
  var zones = [];
  var selectedZone = null; // null = overview
  var analytics = null;
  var range = '24h';
  var refreshTimer = null;
  var charts = {};

  Views.cloudflare = {
    init: function () {
      var el = document.getElementById('view-cloudflare');
      if (!el) return;
      el.innerHTML = buildShell();
      checkConfig();
    },
    show: function () {
      checkConfig();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(function () { loadData(); }, 60000);
    },
    hide: function () {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
      destroyCharts();
    },
    update: function () {}
  };

  function buildShell() {
    return '<div class="cf-dashboard">' +
      '<div id="cf-setup-panel"></div>' +
      '<div id="cf-main" style="display:none">' +
        // AI Analysis
        '<div class="cf-ai-section">' +
          '<div class="briefing-card glass-card">' +
            '<div class="briefing-header">' +
              '<div class="briefing-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="22" height="22"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg></div>' +
              '<div class="briefing-title">Cloudflare Traffic Intelligence</div>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.cloudflare.runAI()" id="cf-ai-btn">Analyze</button>' +
            '</div>' +
            '<div class="briefing-body" id="cf-ai-body"><span class="text-secondary">Click Analyze for AI-powered traffic insights across all domains.</span></div>' +
          '</div>' +
        '</div>' +
        // Domain switcher + range
        '<div class="cf-controls-row">' +
          '<div class="cf-domain-tabs" id="cf-domain-tabs"></div>' +
          '<div class="cf-range-btns">' +
            rangeBtn('1h') + rangeBtn('6h') + rangeBtn('24h', true) + rangeBtn('7d') + rangeBtn('30d') +
          '</div>' +
        '</div>' +
        // Hero stats
        '<div class="cf-hero-stats" id="cf-hero-stats"></div>' +
        // Charts row
        '<div class="cf-charts-row">' +
          '<div class="glass-card cf-chart-card"><div class="card-header">Requests</div><canvas id="cf-chart-requests" height="200"></canvas></div>' +
          '<div class="glass-card cf-chart-card"><div class="card-header">Bandwidth</div><canvas id="cf-chart-bandwidth" height="200"></canvas></div>' +
        '</div>' +
        // Bottom row: Countries + Cache + Security
        '<div class="cf-bottom-row">' +
          '<div class="glass-card cf-geo-card"><div class="card-header">Geographic Distribution</div><div id="cf-geo-table"></div></div>' +
          '<div class="glass-card cf-cache-card"><div class="card-header">Cache Performance</div><div id="cf-cache-panel"></div></div>' +
          '<div class="glass-card cf-security-card"><div class="card-header">Security</div><div id="cf-security-panel"></div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function rangeBtn(r, active) {
    return '<button class="cf-range-btn' + (active ? ' active' : '') + '" data-range="' + r + '" onclick="Views.cloudflare.setRange(\'' + r + '\')">' + r + '</button>';
  }

  // ── Config Check ──
  function checkConfig() {
    fetch('/api/cloudflare/config').then(function (r) { return r.json(); }).then(function (d) {
      if (d.configured) {
        config = d;
        show('cf-main'); hide('cf-setup-panel');
        loadZones();
      } else {
        renderSetup();
      }
    }).catch(function () { renderSetup(); });
  }

  function renderSetup() {
    hide('cf-main');
    var el = document.getElementById('cf-setup-panel');
    if (!el) return;
    el.style.display = '';
    el.innerHTML = '<div class="glass-card cf-setup">' +
      '<div class="cf-setup-icon"><svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="var(--cyan)" stroke-width="1.5"><circle cx="24" cy="24" r="20"/><path d="M4 24h40M24 4a30.6 30.6 0 018 20 30.6 30.6 0 01-8 20 30.6 30.6 0 01-8-20A30.6 30.6 0 0124 4z"/></svg></div>' +
      '<h3>Connect Cloudflare</h3>' +
      '<p class="text-secondary">Enter your Cloudflare API Token to enable traffic analytics across all your domains.</p>' +
      '<div class="cf-setup-form">' +
        '<input type="password" id="cf-token-input" class="input" placeholder="Cloudflare API Token" autocomplete="off">' +
        '<input type="text" id="cf-account-input" class="input" placeholder="Account ID (optional)" autocomplete="off">' +
        '<button class="btn btn-primary" onclick="Views.cloudflare.connect()" id="cf-connect-btn">Connect</button>' +
      '</div>' +
      '<p class="text-tertiary" style="font-size:11px;margin-top:12px">Create a token at dash.cloudflare.com/profile/api-tokens with Zone:Read + Analytics:Read permissions.</p>' +
    '</div>';
  }

  Views.cloudflare.connect = function () {
    var token = document.getElementById('cf-token-input').value.trim();
    var account = document.getElementById('cf-account-input').value.trim();
    if (!token) return;
    var btn = document.getElementById('cf-connect-btn');
    btn.disabled = true; btn.textContent = 'Connecting...';
    fetch('/api/cloudflare/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiToken: token, accountId: account }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      btn.disabled = false; btn.textContent = 'Connect';
      if (d.zones && d.zones.length > 0) {
        if (window.Toast) Toast.success('Connected! Found ' + d.zones.length + ' domains.');
        config = { configured: true };
        zones = d.zones;
        show('cf-main'); hide('cf-setup-panel');
        renderDomainTabs();
        loadData();
      } else if (d.error) {
        if (window.Toast) Toast.error(d.error);
      }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Connect'; });
  };

  // ── Data Loading ──
  function loadZones() {
    fetch('/api/cloudflare/zones').then(function (r) { return r.json(); }).then(function (d) {
      zones = d.zones || [];
      renderDomainTabs();
      loadData();
    }).catch(function () {});
  }

  function loadData() {
    var url = selectedZone
      ? '/api/cloudflare/analytics/' + selectedZone + '?range=' + range
      : '/api/cloudflare/analytics/overview?range=' + range;
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) return;
      analytics = d;
      renderHeroStats();
      renderCharts();
      renderGeo();
      renderCache();
      renderSecurity();
    }).catch(function () {});
  }

  // ── Domain Tabs ──
  function renderDomainTabs() {
    var el = document.getElementById('cf-domain-tabs');
    if (!el) return;
    var html = '<button class="cf-domain-tab' + (!selectedZone ? ' active' : '') + '" onclick="Views.cloudflare.selectZone(null)">All Domains</button>';
    zones.forEach(function (z) {
      html += '<button class="cf-domain-tab' + (selectedZone === z.id ? ' active' : '') + '" onclick="Views.cloudflare.selectZone(\'' + z.id + '\')">' + esc(z.domain) + '</button>';
    });
    el.innerHTML = html;
  }

  Views.cloudflare.selectZone = function (zoneId) {
    selectedZone = zoneId;
    renderDomainTabs();
    loadData();
  };

  Views.cloudflare.setRange = function (r) {
    range = r;
    document.querySelectorAll('.cf-range-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-range') === r); });
    loadData();
  };

  // ── Hero Stats ──
  function renderHeroStats() {
    var el = document.getElementById('cf-hero-stats');
    if (!el || !analytics) return;
    var a = analytics;
    el.innerHTML =
      heroStat('Requests', fmtNum(a.totalRequests), 'total') +
      heroStat('Cached', fmtNum(a.cachedRequests || 0), a.cacheRatio + '%') +
      heroStat('Bandwidth', fmtBytes(a.totalBytes), 'total') +
      heroStat('Saved', fmtBytes(a.cachedBytes || a.bandwidthSaved || 0), 'by cache') +
      heroStat('Visitors', fmtNum(a.totalUniques || 0), 'unique') +
      heroStat('Threats', fmtNum(a.totalThreats || 0), 'blocked');
  }

  function heroStat(label, value, sub) {
    return '<div class="cf-hero-stat glass-card">' +
      '<div class="cf-hero-value">' + value + '</div>' +
      '<div class="cf-hero-label">' + label + '</div>' +
      '<div class="cf-hero-sub">' + sub + '</div>' +
    '</div>';
  }

  // ── Charts ──
  function renderCharts() {
    if (!analytics) return;
    var tl = analytics.timeline || [];
    if (tl.length === 0) {
      // If overview, try zone-level timelines
      if (analytics.zones) {
        analytics.zones.forEach(function (z) { if (z.timeline) tl = tl.concat(z.timeline); });
      }
    }
    var labels = tl.map(function (t) { return shortTime(t.time); });
    var cached = tl.map(function (t) { return t.cached || 0; });
    var uncached = tl.map(function (t) { return (t.requests || 0) - (t.cached || 0); });
    var bw = tl.map(function (t) { return (t.bytes || 0) / 1048576; }); // MB

    destroyCharts();
    var reqCtx = document.getElementById('cf-chart-requests');
    var bwCtx = document.getElementById('cf-chart-bandwidth');
    if (!reqCtx || !bwCtx || typeof Chart === 'undefined') return;

    charts.requests = new Chart(reqCtx, {
      type: 'bar', data: {
        labels: labels,
        datasets: [
          { label: 'Cached', data: cached, backgroundColor: 'rgba(34,211,238,0.6)', borderRadius: 2 },
          { label: 'Uncached', data: uncached, backgroundColor: 'rgba(255,107,43,0.5)', borderRadius: 2 },
        ]
      },
      options: chartOpts('Requests', true)
    });

    charts.bandwidth = new Chart(bwCtx, {
      type: 'line', data: {
        labels: labels,
        datasets: [{
          label: 'MB', data: bw, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.08)',
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
        }]
      },
      options: chartOpts('MB')
    });
  }

  function chartOpts(yLabel, stacked) {
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      scales: {
        x: { display: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b8b92', maxTicksLimit: 12, font: { size: 10 } } },
        y: { display: true, stacked: !!stacked, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b8b92', font: { size: 10 } }, title: { display: true, text: yLabel, color: '#52525a', font: { size: 10 } } },
      },
      plugins: { legend: { display: !!stacked, labels: { color: '#8b8b92', font: { size: 10 } } } },
    };
  }

  function destroyCharts() {
    Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); delete charts[k]; } });
  }

  // ── Geographic Table ──
  function renderGeo() {
    var el = document.getElementById('cf-geo-table');
    if (!el || !analytics) return;
    var countries = analytics.countries || [];
    // If overview, aggregate from zones
    if (!countries.length && analytics.zones) {
      var agg = {};
      analytics.zones.forEach(function (z) {
        (z.countries || []).forEach(function (c) { agg[c.name] = (agg[c.name] || 0) + c.requests; });
      });
      countries = Object.entries(agg).map(function (e) { return { name: e[0], requests: e[1] }; }).sort(function (a, b) { return b.requests - a.requests; }).slice(0, 20);
    }
    if (countries.length === 0) { el.innerHTML = '<span class="text-secondary">No geographic data</span>'; return; }
    var max = countries[0].requests || 1;
    var html = '<table class="cf-geo-tbl"><tbody>';
    countries.slice(0, 15).forEach(function (c) {
      var pct = ((c.requests / max) * 100).toFixed(0);
      html += '<tr><td class="geo-name">' + esc(c.name) + '</td><td class="geo-bar"><div class="geo-bar-fill" style="width:' + pct + '%"></div></td><td class="geo-count">' + fmtNum(c.requests) + '</td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  // ── Cache Panel ──
  function renderCache() {
    var el = document.getElementById('cf-cache-panel');
    if (!el || !analytics) return;
    var a = analytics;
    var ratio = a.cacheRatio || 0;
    var ringOffset = 251.3 - (251.3 * ratio / 100);
    el.innerHTML =
      '<div class="cf-cache-ring-wrap">' +
        '<svg viewBox="0 0 100 100" width="100" height="100">' +
          '<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>' +
          '<circle cx="50" cy="50" r="40" fill="none" stroke="var(--cyan)" stroke-width="8" stroke-dasharray="251.3" stroke-dashoffset="' + ringOffset + '" stroke-linecap="round" transform="rotate(-90 50 50)" style="transition:stroke-dashoffset 0.6s ease"/>' +
          '<text x="50" y="47" text-anchor="middle" fill="var(--text-primary)" font-size="18" font-weight="700">' + ratio + '%</text>' +
          '<text x="50" y="62" text-anchor="middle" fill="var(--text-secondary)" font-size="8">HIT RATIO</text>' +
        '</svg>' +
      '</div>' +
      '<div class="cf-cache-stats">' +
        '<div><span class="text-secondary">Cached</span><span class="text-primary">' + fmtNum(a.cachedRequests || 0) + '</span></div>' +
        '<div><span class="text-secondary">Uncached</span><span class="text-primary">' + fmtNum(a.uncachedRequests || (a.totalRequests - (a.cachedRequests || 0))) + '</span></div>' +
        '<div><span class="text-secondary">BW Saved</span><span class="text-primary">' + fmtBytes(a.cachedBytes || a.bandwidthSaved || 0) + '</span></div>' +
      '</div>';
  }

  // ── Security Panel ──
  function renderSecurity() {
    var el = document.getElementById('cf-security-panel');
    if (!el || !analytics) return;
    var a = analytics;
    var statusCodes = a.statusCodes || [];
    // Aggregate from zones if overview
    if (!statusCodes.length && a.zones) {
      var agg = {};
      a.zones.forEach(function (z) { (z.statusCodes || []).forEach(function (s) { agg[s.code] = (agg[s.code] || 0) + s.count; }); });
      statusCodes = Object.entries(agg).map(function (e) { return { code: parseInt(e[0]), count: e[1] }; }).sort(function (a, b) { return b.count - a.count; });
    }

    var html = '<div class="cf-sec-stats">' +
      '<div class="cf-sec-stat"><span class="cf-sec-num">' + fmtNum(a.totalThreats || 0) + '</span><span class="text-secondary">Threats Blocked</span></div>' +
      '<div class="cf-sec-stat"><span class="cf-sec-num">' + fmtNum(a.totalPageViews || 0) + '</span><span class="text-secondary">Page Views</span></div>' +
    '</div>';

    if (statusCodes.length > 0) {
      html += '<div class="cf-status-codes"><div class="card-header" style="font-size:11px">Status Codes</div>';
      statusCodes.slice(0, 8).forEach(function (s) {
        var cls = s.code < 300 ? 'sc-2xx' : s.code < 400 ? 'sc-3xx' : s.code < 500 ? 'sc-4xx' : 'sc-5xx';
        html += '<span class="cf-sc-badge ' + cls + '">' + s.code + ' <small>' + fmtNum(s.count) + '</small></span>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
  }

  // ── AI Analysis ──
  Views.cloudflare.runAI = function () {
    var btn = document.getElementById('cf-ai-btn');
    var body = document.getElementById('cf-ai-body');
    if (!btn || !body) return;
    btn.disabled = true; btn.textContent = 'Analyzing...';
    body.innerHTML = '<span class="text-secondary">Consulting Claude about traffic patterns...</span>';
    fetch('/api/cloudflare/ai-analysis?range=' + range).then(function (r) { return r.json(); }).then(function (d) {
      btn.disabled = false; btn.textContent = 'Analyze';
      if (d.analysis) { typewriter(body, d.analysis); } else { body.innerHTML = '<span class="text-secondary">' + esc(d.error || 'Unavailable') + '</span>'; }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Analyze'; body.innerHTML = '<span class="text-secondary">Failed to reach analysis endpoint.</span>'; });
  };

  // ── Helpers ──
  function show(id) { var e = document.getElementById(id); if (e) e.style.display = ''; }
  function hide(id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; }
  function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtNum(n) { if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (n >= 1000) return (n / 1000).toFixed(1) + 'K'; return String(n); }
  function fmtBytes(b) { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'; return (b / 1073741824).toFixed(2) + ' GB'; }
  function shortTime(t) { if (!t) return ''; var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':00'; }
  function typewriter(el, text) { el.innerHTML = ''; var span = document.createElement('span'); span.className = 'typewriter-text'; el.appendChild(span); var i = 0; (function tick() { if (i < text.length) { span.textContent += text[i++]; setTimeout(tick, 8 + Math.random() * 12); } })(); }
})();
