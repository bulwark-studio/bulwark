// =============================================================================
// PM2 Process Intelligence — AI-Powered Process Management
// =============================================================================
(function () {
  'use strict';

  var processes = [];
  var restartHistory = {}; // name → [timestamps]
  var refreshTimer = null;

  Views.pm2 = {
    init: function () {
      var el = document.getElementById('view-pm2');
      if (!el) return;
      el.innerHTML = buildTemplate();
    },
    show: function () {
      this.init();
      loadProcesses();
      refreshTimer = setInterval(loadProcesses, 10000);
    },
    hide: function () {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    },
    update: function (data) {
      if (data && data.processes) {
        processes = data.processes;
        render();
      }
    }
  };

  function buildTemplate() {
    return '<div class="pm2-dashboard">' +
      // AI Analysis
      '<div class="pm2-ai-section">' +
        '<div class="briefing-card glass-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="22" height="22"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg></div>' +
            '<div class="briefing-title">Process Intelligence</div>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.pm2.runAI()" id="pm2-ai-btn">Analyze</button>' +
          '</div>' +
          '<div class="briefing-body" id="pm2-ai-body"><span class="text-secondary">Click Analyze for AI-powered process health insights.</span></div>' +
        '</div>' +
      '</div>' +
      // Fleet Overview
      '<div class="pm2-fleet-banner glass-card" id="pm2-fleet-banner"></div>' +
      // Process Cards
      '<div class="pm2-process-grid" id="pm2-process-grid"></div>' +
      // Bottom row: Resource Comparison + Quick Actions
      '<div class="pm2-bottom-row">' +
        '<div class="glass-card pm2-resource-card"><div class="card-header">Resource Comparison</div><canvas id="pm2-resource-chart" height="200"></canvas></div>' +
        '<div class="glass-card pm2-actions-card">' +
          '<div class="card-header">Quick Actions</div>' +
          '<div class="pm2-quick-actions">' +
            '<button class="btn btn-sm" onclick="Views.pm2.bulkAction(\'restart\')">Restart All</button>' +
            '<button class="btn btn-sm" onclick="Views.pm2.bulkAction(\'stop\')">Stop All</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.pm2.flushLogs()">Flush Logs</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.pm2.save()">Save (pm2 save)</button>' +
          '</div>' +
          '<div class="pm2-restart-timeline" id="pm2-restart-timeline"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function loadProcesses() {
    fetch('/api/processes').then(function (r) { return r.json(); }).then(function (d) {
      var procs = Array.isArray(d) ? d : (d.processes || []);
      processes = procs.map(function (p) {
        var env = p.pm2_env || {};
        return {
          name: p.name || env.name || '--',
          pm_id: p.pm_id != null ? p.pm_id : (env.pm_id || '--'),
          pid: p.pid || env.pid || 0,
          status: env.status || p.status || 'unknown',
          cpu: p.monit ? p.monit.cpu : (p.cpu || 0),
          memory: p.monit ? p.monit.memory : (p.memory || 0),
          memoryMB: ((p.monit ? p.monit.memory : (p.memory || 0)) / 1048576).toFixed(1),
          uptime: env.pm_uptime ? Date.now() - env.pm_uptime : 0,
          restarts: env.restart_time || p.restarts || 0,
          mode: env.exec_mode || 'fork',
          instances: env.instances || 1,
          cwd: env.pm_cwd || '',
          nodeVersion: env.node_version || '',
        };
      });

      // Track restart counts
      processes.forEach(function (p) {
        if (!restartHistory[p.name]) restartHistory[p.name] = [];
        restartHistory[p.name].push({ ts: Date.now(), count: p.restarts });
        if (restartHistory[p.name].length > 60) restartHistory[p.name].shift();
      });

      render();
    }).catch(function () {});
  }

  function render() {
    renderFleetBanner();
    renderProcessCards();
    renderResourceChart();
    renderRestartTimeline();
  }

  function renderFleetBanner() {
    var el = document.getElementById('pm2-fleet-banner');
    if (!el) return;
    var online = processes.filter(function (p) { return p.status === 'online'; }).length;
    var stopped = processes.filter(function (p) { return p.status === 'stopped'; }).length;
    var errored = processes.filter(function (p) { return p.status === 'errored'; }).length;
    var totalCpu = processes.reduce(function (s, p) { return s + (p.cpu || 0); }, 0);
    var totalMem = processes.reduce(function (s, p) { return s + parseFloat(p.memoryMB || 0); }, 0);

    el.innerHTML = '<div class="fleet-stats">' +
      fleetStat(processes.length, 'Total', '') +
      fleetStat(online, 'Online', 'cyan') +
      fleetStat(stopped, 'Stopped', stopped > 0 ? 'orange' : '') +
      fleetStat(errored, 'Errored', errored > 0 ? 'orange' : '') +
      fleetStat(totalCpu.toFixed(1) + '%', 'CPU', '') +
      fleetStat(totalMem.toFixed(0) + ' MB', 'Memory', '') +
    '</div>';
  }

  function fleetStat(value, label, color) {
    var style = color ? ' style="color:var(--' + color + ')"' : '';
    return '<div class="fleet-stat"><div class="fleet-stat-value"' + style + '>' + value + '</div><div class="fleet-stat-label">' + label + '</div></div>';
  }

  function renderProcessCards() {
    var el = document.getElementById('pm2-process-grid');
    if (!el) return;
    if (processes.length === 0) {
      el.innerHTML = '<div class="text-secondary" style="padding:20px">No PM2 processes found. Is PM2 running?</div>';
      return;
    }
    el.innerHTML = processes.map(function (p) {
      var online = p.status === 'online';
      var rh = restartHistory[p.name] || [];
      var restartTrend = '';
      if (rh.length >= 2) {
        var diff = rh[rh.length - 1].count - rh[0].count;
        restartTrend = diff > 0 ? ' <span style="color:var(--orange);font-size:9px">+' + diff + '</span>' : '';
      }

      return '<div class="pm2-process-card glass-card">' +
        '<div class="pm2-card-header">' +
          '<span class="dot ' + (online ? 'dot-healthy' : 'dot-unhealthy') + '"></span>' +
          '<span class="pm2-card-name">' + esc(p.name) + '</span>' +
          '<span class="pm2-mode-badge">' + (p.mode === 'cluster_mode' ? 'Cluster' : 'Fork') + '</span>' +
        '</div>' +
        '<div class="pm2-card-ids">PM2 ID: ' + p.pm_id + ' | PID: ' + p.pid + '</div>' +
        '<div class="pm2-card-status ' + (online ? 'status-online' : 'status-stopped') + '">' + p.status + '</div>' +
        // Gauges
        '<div class="pm2-gauges">' +
          pm2Gauge(p.cpu, 'CPU') +
          pm2Gauge(Math.min(100, (p.memory / 536870912) * 100), 'MEM') + // scale to 512MB
        '</div>' +
        '<div class="pm2-card-metrics">' +
          '<div><span class="text-tertiary">Memory</span><span>' + p.memoryMB + ' MB</span></div>' +
          '<div><span class="text-tertiary">Uptime</span><span>' + formatMs(p.uptime) + '</span></div>' +
          '<div><span class="text-tertiary">Restarts</span><span>' + p.restarts + restartTrend + '</span></div>' +
        '</div>' +
        '<div class="pm2-card-actions">' +
          (online
            ? '<button class="btn btn-sm" onclick="Views.pm2.action(' + p.pm_id + ',\'restart\')">Restart</button>' +
              '<button class="btn btn-sm" onclick="Views.pm2.action(' + p.pm_id + ',\'stop\')">Stop</button>'
            : '<button class="btn btn-sm btn-primary" onclick="Views.pm2.action(' + p.pm_id + ',\'restart\')">Start</button>') +
          '<button class="btn btn-sm" onclick="Views.pm2.logs(\'' + esc(p.name) + '\')">Logs</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="Views.pm2.action(' + p.pm_id + ',\'delete\')">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function pm2Gauge(pct, label) {
    pct = Math.min(100, Math.max(0, pct || 0));
    var r = 18, circ = 2 * Math.PI * r, offset = circ - (circ * pct / 100);
    var color = pct > 80 ? 'var(--orange)' : 'var(--cyan)';
    return '<div class="pm2-gauge"><svg viewBox="0 0 44 44" width="44" height="44">' +
      '<circle cx="22" cy="22" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>' +
      '<circle cx="22" cy="22" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="4" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" transform="rotate(-90 22 22)"/>' +
      '<text x="22" y="20" text-anchor="middle" fill="var(--text-primary)" font-size="9" font-weight="600">' + Math.round(pct) + '%</text>' +
      '<text x="22" y="30" text-anchor="middle" fill="var(--text-tertiary)" font-size="7">' + label + '</text>' +
    '</svg></div>';
  }

  var resChart = null;
  function renderResourceChart() {
    var ctx = document.getElementById('pm2-resource-chart');
    if (!ctx || typeof Chart === 'undefined' || processes.length === 0) return;
    if (resChart) { resChart.destroy(); resChart = null; }
    var labels = processes.map(function (p) { return p.name; });
    resChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'CPU %', data: processes.map(function (p) { return p.cpu || 0; }), backgroundColor: 'rgba(34,211,238,0.6)', borderRadius: 3 },
          { label: 'Memory MB', data: processes.map(function (p) { return parseFloat(p.memoryMB) || 0; }), backgroundColor: 'rgba(255,107,43,0.5)', borderRadius: 3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8b8b92', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b8b92', font: { size: 10 } } },
        },
        plugins: { legend: { labels: { color: '#8b8b92', font: { size: 10 } } } },
      }
    });
  }

  function renderRestartTimeline() {
    var el = document.getElementById('pm2-restart-timeline');
    if (!el) return;
    var events = processes.filter(function (p) { return p.restarts > 0; }).sort(function (a, b) { return b.restarts - a.restarts; });
    if (events.length === 0) { el.innerHTML = '<div class="text-secondary" style="font-size:11px;margin-top:12px">No restart events</div>'; return; }
    el.innerHTML = '<div class="card-header" style="font-size:11px;margin-top:12px">Restart History</div>' +
      events.map(function (p) {
        return '<div class="pm2-restart-event">' +
          '<span class="pm2-restart-name">' + esc(p.name) + '</span>' +
          '<span class="pm2-restart-count" style="color:' + (p.restarts > 5 ? 'var(--orange)' : 'var(--text-secondary)') + '">' + p.restarts + ' restarts</span>' +
        '</div>';
      }).join('');
  }

  // ── Actions ──
  Views.pm2.action = function (id, action) {
    if (action === 'delete' && !confirm('Delete this process from PM2?')) return;
    Toast.info(action + 'ing process...');
    fetch('/api/processes/' + id + '/' + action, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Process ' + action + 'ed');
        setTimeout(loadProcesses, 1500);
      })
      .catch(function () { Toast.error('Failed to ' + action); });
  };

  Views.pm2.bulkAction = function (action) {
    if (!confirm(action + ' all processes?')) return;
    Toast.info(action + 'ing all...');
    fetch('/api/processes/all/' + action, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function () { Toast.success('All processes ' + action + 'ed'); setTimeout(loadProcesses, 2000); })
      .catch(function () { Toast.error('Failed'); });
  };

  Views.pm2.flushLogs = function () {
    fetch('/api/processes/flush', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function () { Toast.success('Logs flushed'); })
      .catch(function () { Toast.error('Failed to flush logs'); });
  };

  Views.pm2.save = function () {
    fetch('/api/processes/save', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function () { Toast.success('Process list saved'); })
      .catch(function () { Toast.error('Failed to save'); });
  };

  Views.pm2.logs = function (name) {
    Modal.open({
      title: 'Logs: ' + name,
      size: 'xl',
      body: '<div style="color:var(--text-tertiary)">Loading logs...</div>'
    });
    fetch('/api/logs/' + encodeURIComponent(name) + '?lines=500')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var body = document.querySelector('.modal-body');
        if (!body) return;
        var logs = d.logs || d.stdout || d.output || 'No logs available';
        body.innerHTML = '<pre class="docker-logs-pre">' + esc(typeof logs === 'string' ? logs : JSON.stringify(logs, null, 2)) + '</pre>';
        body.querySelector('pre').scrollTop = 99999;
      })
      .catch(function () {
        var body = document.querySelector('.modal-body');
        if (body) body.innerHTML = '<div style="color:var(--orange)">Failed to load logs</div>';
      });
  };

  // AI
  Views.pm2.runAI = function () {
    var btn = document.getElementById('pm2-ai-btn');
    var body = document.getElementById('pm2-ai-body');
    if (!btn || !body) return;
    btn.disabled = true; btn.textContent = 'Analyzing...';
    body.innerHTML = '<span class="text-secondary">Analyzing processes...</span>';
    fetch('/api/briefing').then(function (r) { return r.json(); }).then(function (d) {
      btn.disabled = false; btn.textContent = 'Analyze';
      if (d.briefing) { typewriter(body, d.briefing); } else if (d.fallback) { typewriter(body, d.fallback); }
      else { body.innerHTML = '<span class="text-secondary">Analysis unavailable</span>'; }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Analyze'; });
  };

  function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s || '')) : String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function formatMs(ms) { if (!ms) return '--'; var s = Math.floor(ms / 1000); var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600); if (d > 0) return d + 'd ' + h + 'h'; if (h > 0) return h + 'h ' + Math.floor((s % 3600) / 60) + 'm'; return Math.floor(s / 60) + 'm ' + (s % 60) + 's'; }
  function typewriter(el, text) { el.innerHTML = ''; var span = document.createElement('span'); span.className = 'typewriter-text'; el.appendChild(span); var i = 0; (function tick() { if (i < text.length) { span.textContent += text[i++]; setTimeout(tick, 8 + Math.random() * 12); } })(); }
})();
