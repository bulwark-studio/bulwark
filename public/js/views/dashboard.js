/**
 * Bulwark v2.1 — Overview Dashboard (AI Command Center)
 * 8 sections: Briefing, Health Ring, Commands, Pulse Gauges, Infra Map, DB Stats, Timeline, Tickets
 */
(function () {
  'use strict';

  var CIRC = 2 * Math.PI * 52; // gauge circumference (r=52)
  var RING_R = 58, RING_CIRC = 2 * Math.PI * RING_R;
  var typewriterTimer = null;
  var cpuSpark = null, memSpark = null, diskSpark = null;
  var briefingCtrl = null; // AbortController

  // ── SVG Defs (glow filters) ──────────────────────────────────────────
  var SVG_DEFS =
    '<defs>' +
      '<filter id="glow-cyan"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="glow-cyan-strong"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="glow-purple"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="glow-amber"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="glow-orange"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="node-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '</defs>';

  // ── Icons (inline SVG) ───────────────────────────────────────────────
  var ICONS = {
    brain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z"/><path d="M9 21h6"/></svg>',
    heartPulse: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>',
    zap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    terminal: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    refresh: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    database: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    server: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    ticket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>',
    rocket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>',
    send: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    network: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4m-7 4V12h14v4"/></svg>'
  };

  function icon(name, w, h) {
    var s = ICONS[name] || '';
    if (w) s = s.replace(/width="\d+"/, 'width="' + w + '"').replace(/height="\d+"/, 'height="' + h + '"');
    return s;
  }

  // ── Gauge SVG builder ────────────────────────────────────────────────
  function gaugeSVG(id, label, colorClass) {
    return '<div class="gauge-card">' +
      '<svg class="gauge-svg" viewBox="0 0 120 120">' +
        '<circle class="gauge-track" cx="60" cy="60" r="52"/>' +
        '<circle class="gauge-arc ' + colorClass + '" id="gauge-arc-' + id + '" cx="60" cy="60" r="52" ' +
          'stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="' + CIRC.toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
        '<text class="gauge-value" id="gauge-val-' + id + '" x="60" y="56" text-anchor="middle">0%</text>' +
        '<text class="gauge-label-text" x="60" y="74" text-anchor="middle">' + label + '</text>' +
      '</svg>' +
      '<div class="gauge-sub" id="gauge-sub-' + id + '">--</div>' +
      '<div class="gauge-spark-wrap"><canvas class="gauge-spark" id="spark-' + id + '" height="32"></canvas></div>' +
    '</div>';
  }

  // ── Health ring SVG ──────────────────────────────────────────────────
  var RING_COLORS = ['#22d3ee', '#a78bfa', '#3b82f6', '#10b981', '#f59e0b'];
  var RING_KEYS = ['system', 'database', 'servers', 'pm2', 'tickets'];
  var RING_LABELS = ['System', 'Database', 'Servers', 'PM2', 'Tickets'];

  function healthRingSVG() {
    var segs = '';
    for (var i = 0; i < 5; i++) {
      segs += '<circle class="health-seg" id="ring-seg-' + i + '" cx="70" cy="70" r="' + RING_R + '" ' +
        'fill="none" stroke="' + RING_COLORS[i] + '" stroke-width="7" stroke-linecap="round" ' +
        'stroke-dasharray="0 ' + RING_CIRC.toFixed(1) + '" ' +
        'transform="rotate(-90 70 70)" opacity="0.85" filter="url(#glow-cyan)"/>';
    }
    var breakdown = RING_LABELS.map(function (l, i) {
      return '<div class="health-sub"><span class="health-dot" style="background:' + RING_COLORS[i] + '"></span>' +
        '<span id="ring-sub-' + RING_KEYS[i] + '">--</span> ' + l + '</div>';
    }).join('');

    return '<div class="health-ring-card">' +
      '<svg class="health-ring-svg" viewBox="0 0 140 140" width="160" height="160">' +
        '<circle cx="70" cy="70" r="' + RING_R + '" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="7"/>' +
        segs +
        '<text class="health-ring-score" id="ring-score" x="70" y="66" text-anchor="middle">--</text>' +
        '<text class="health-ring-label" x="70" y="82" text-anchor="middle">HEALTH</text>' +
      '</svg>' +
      '<div class="health-breakdown">' + breakdown + '</div>' +
    '</div>';
  }

  // ── View Registration ────────────────────────────────────────────────
  Views.dashboard = {
    init: function () {
      var c = document.getElementById('view-dashboard');
      if (!c) return;

      c.innerHTML =
        '<div class="overview-grid">' +

        /* 1. AI Briefing Hero */
        '<div class="briefing-card" id="dash-briefing">' +
          '<div class="briefing-header">' +
            '<div class="briefing-label">' + icon('brain') + ' AI Briefing</div>' +
            '<button class="briefing-refresh" onclick="Views.dashboard.loadBriefing(true)">' + icon('refresh') + ' Refresh</button>' +
          '</div>' +
          '<div class="briefing-text" id="briefing-text">' +
            '<div class="briefing-shimmer" style="width:90%"></div>' +
            '<div class="briefing-shimmer" style="width:70%"></div>' +
            '<div class="briefing-shimmer" style="width:45%"></div>' +
          '</div>' +
        '</div>' +

        /* 2 + 3. Health Ring + Command Hub row */
        '<div class="overview-row overview-row-health">' +
          healthRingSVG() +
          '<div>' +
            '<div class="section-title">' + icon('zap') + ' Command Hub</div>' +
            '<div class="command-hub">' +
              '<button class="cmd-btn" onclick="Views.dashboard.cmd(\'diag\')">' + icon('heartPulse') + ' Run Diagnostics</button>' +
              '<button class="cmd-btn" onclick="Views.dashboard.cmd(\'deploy\')">' + icon('rocket') + ' Deploy Check</button>' +
              '<button class="cmd-btn" onclick="Views.dashboard.cmd(\'claude\')">' + icon('terminal') + ' Ask Claude</button>' +
              '<button class="cmd-btn" onclick="Views.dashboard.cmd(\'refresh\')">' + icon('refresh') + ' Refresh All</button>' +
            '</div>' +
            '<div class="claude-inline" id="claude-inline">' +
              '<div class="claude-input-row">' +
                '<input class="claude-input" id="claude-q" placeholder="Ask about your infrastructure..." onkeydown="if(event.key===\'Enter\')Views.dashboard.askClaude()"/>' +
                '<button class="claude-send" onclick="Views.dashboard.askClaude()">' + icon('send') + ' Send</button>' +
              '</div>' +
              '<div class="claude-response" id="claude-resp" style="display:none"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* Hidden SVG defs for glow filters */
        '<svg width="0" height="0" style="position:absolute">' + SVG_DEFS + '</svg>' +

        /* 4. Live Pulse Gauges */
        '<div>' +
          '<div class="section-title">' + icon('heartPulse') + ' Live Metrics</div>' +
          '<div class="pulse-grid">' +
            gaugeSVG('cpu', 'CPU', 'cyan') +
            gaugeSVG('mem', 'MEMORY', 'purple') +
            gaugeSVG('disk', 'DISK', 'amber') +
          '</div>' +
        '</div>' +

        /* 5 + 6. Infra Map + DB Stats row */
        '<div class="overview-row overview-row-2">' +
          '<div class="infra-card">' +
            '<div class="infra-title">' + icon('network') + ' Infrastructure Map</div>' +
            '<svg class="infra-map-svg" id="infra-map" viewBox="0 0 500 180">' + SVG_DEFS + '</svg>' +
          '</div>' +
          '<div class="db-stats-card">' +
            '<div class="section-title">' + icon('database') + ' Database</div>' +
            '<div id="db-stats-content"><div class="db-unavailable">Loading...</div></div>' +
          '</div>' +
        '</div>' +

        /* 7 + 8. Timeline + Tickets row */
        '<div class="overview-row overview-row-bottom">' +
          '<div class="timeline-card">' +
            '<div class="section-title">' + icon('clock') + ' Activity Timeline</div>' +
            '<div id="dash-timeline"><div class="db-unavailable">No recent activity</div></div>' +
          '</div>' +
          '<div class="ticket-card" onclick="if(window.switchView)switchView(\'tickets\')">' +
            '<div class="section-title">' + icon('ticket') + ' Tickets</div>' +
            '<div id="dash-tickets"><div class="db-unavailable">Loading...</div></div>' +
          '</div>' +
        '</div>' +

        /* 9. Workspace — Calendar + Notes widgets */
        '<div class="overview-row overview-row-workspace">' +
          '<div class="workspace-widget workspace-cal-widget" onclick="if(window.switchView)switchView(\'calendar\')">' +
            '<div class="section-title"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="14" height="13" rx="2"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="7" y1="2" x2="7" y2="6"/><line x1="13" y1="2" x2="13" y2="6"/></svg> Calendar</div>' +
            '<div id="dash-cal-widget"><div class="db-unavailable">Loading...</div></div>' +
          '</div>' +
          '<div class="workspace-widget workspace-notes-widget" onclick="if(window.switchView)switchView(\'notes\')">' +
            '<div class="section-title"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"/><line x1="7" y1="7" x2="13" y2="7"/><line x1="7" y1="10" x2="13" y2="10"/></svg> Notes</div>' +
            '<div id="dash-notes-widget"><div class="db-unavailable">Loading...</div></div>' +
          '</div>' +
        '</div>' +

        '</div>'; // end overview-grid

      // Create sparkline charts
      try {
        cpuSpark = Charts.create('spark-cpu', 'line', sparkOpts('#22d3ee'));
        memSpark = Charts.create('spark-mem', 'line', sparkOpts('#a78bfa'));
        diskSpark = Charts.create('spark-disk', 'line', sparkOpts('#f59e0b'));
      } catch (e) {}
    },

    show: function () {
      this.loadBriefing(false);
      this.loadDbStats();
      this.loadInfra();
      fetch('/api/activity').then(r2j).then(function (d) {
        var items = d.activity || [];
        if (items.length === 0) {
          // Fallback: show query history as activity
          fetch('/api/db/query/history').then(r2j).then(function (h) {
            var hist = Array.isArray(h) ? h : (h && h.history ? h.history : []);
            var mapped = hist.slice(0, 20).map(function (q) {
              return { title: (q.type || 'SQL') + ': ' + (q.sql || '').substring(0, 80), type: 'query', created_at: q.ts };
            });
            Views.dashboard.renderTimeline(mapped.length ? mapped : []);
          }).catch(function () { Views.dashboard.renderTimeline([]); });
        } else {
          Views.dashboard.renderTimeline(items);
        }
      }).catch(noop);
      fetch('/api/tickets').then(r2j).then(function (d) {
        Views.dashboard.renderTickets(d);
      }).catch(noop);
      // Workspace widgets
      fetch('/api/calendar/stats').then(r2j).then(function (d) {
        Views.dashboard.renderCalWidget(d);
      }).catch(noop);
      fetch('/api/notes?search=').then(r2j).then(function (d) {
        Views.dashboard.renderNotesWidget(d);
      }).catch(noop);
    },

    hide: function () {
      if (typewriterTimer) clearInterval(typewriterTimer);
      if (briefingCtrl) briefingCtrl.abort();
    },

    update: function (data) {
      if (data && data.system) {
        var s = data.system;
        var cpu = s.cpuPct || (typeof s.cpu === 'number' ? s.cpu : 0);
        var mem = s.usedMemPct || s.memPct || 0;
        var disk = s.diskPct || (s.disk && s.disk.percent) || 0;
        updateGauge('cpu', cpu);
        updateGauge('mem', mem);
        updateGauge('disk', disk);
        var cpuSub = document.getElementById('gauge-sub-cpu');
        if (cpuSub) cpuSub.textContent = (s.cpuCount || 0) + ' cores \u00b7 ' + (s.nodeVersion || 'Node');
        var memSub = document.getElementById('gauge-sub-mem');
        if (memSub) memSub.textContent = (s.usedMemMB || 0) + ' / ' + (s.totalMemMB || 0) + ' MB';
        var diskSub = document.getElementById('gauge-sub-disk');
        if (diskSub && s.uptimeHours) diskSub.textContent = 'Uptime ' + s.uptimeHours.toFixed(1) + 'h';
        if (cpuSpark) Charts.appendPoint('spark-cpu', '', cpu, 30);
        if (memSpark) Charts.appendPoint('spark-mem', '', mem, 30);
        if (diskSpark) Charts.appendPoint('spark-disk', '', disk, 30);
      }
      if (data && data.activity) this.renderTimeline(data.activity);
      if (data && data.processes) this.updateInfraProcesses(data.processes);
      if (data && data.servers) this.updateInfraServers(data.servers);
    },

    // ── AI Briefing ──────────────────────────────────────────────────
    loadBriefing: function (refresh) {
      var el = document.getElementById('briefing-text');
      if (!el) return;
      if (typewriterTimer) clearInterval(typewriterTimer);
      el.innerHTML = '<div class="briefing-shimmer" style="width:90%"></div><div class="briefing-shimmer" style="width:70%"></div><div class="briefing-shimmer" style="width:45%"></div>';
      if (briefingCtrl) briefingCtrl.abort();
      briefingCtrl = new AbortController();
      fetch('/api/briefing' + (refresh ? '?refresh=1' : ''), { signal: briefingCtrl.signal })
        .then(r2j)
        .then(function (d) {
          if (d.error) { el.textContent = d.error; return; }
          typeWriter(el, d.briefing || 'No briefing available');
          if (d.score !== undefined) updateHealthRing(d.score, d.subscores || {});
        })
        .catch(function (e) {
          if (e.name !== 'AbortError') el.textContent = 'Briefing unavailable — Claude CLI not responding';
        });
    },

    // ── DB Stats ─────────────────────────────────────────────────────
    loadDbStats: function () {
      var el = document.getElementById('db-stats-content');
      if (!el) return;
      // Try main pool first, then active project
      var param = window.DbProjects && window.DbProjects.param ? window.DbProjects.param() : '';
      var infoUrl = '/api/db/info' + (param ? '?' + param : '');
      Promise.allSettled([
        fetch(infoUrl).then(r2j),
        fetch('/api/db/query/history').then(r2j)
      ]).then(function (results) {
        var info = results[0].status === 'fulfilled' ? results[0].value : null;
        var hist = results[1].status === 'fulfilled' ? results[1].value : null;
        if (!info || info.error || info.degraded) {
          // Try schema summary from active project
          var summUrl = '/api/db/assistant/schema-summary' + (param ? '?' + param : '');
          fetch(summUrl).then(r2j).then(function (s) {
            if (!s || s.error) {
              el.innerHTML = '<div class="db-unavailable">No database connected \u2014 add one in DB Projects</div>';
              return;
            }
            var queries = Array.isArray(hist) ? hist.length : (hist && hist.history ? hist.history.length : 0);
            el.innerHTML =
              '<div class="db-stats-grid">' +
                dbStat(s.tables || 0, 'Tables') +
                dbStat(s.size || '--', 'Size') +
                dbStat(s.indexes || 0, 'Indexes') +
                dbStat(queries, 'Queries') +
                dbStat(s.foreignKeys || 0, 'FKs') +
              '</div>';
          }).catch(function () {
            el.innerHTML = '<div class="db-unavailable">No database connected</div>';
          });
          return;
        }
        var queries = Array.isArray(hist) ? hist.length : (hist && hist.history ? hist.history.length : 0);
        el.innerHTML =
          '<div class="db-stats-grid">' +
            dbStat(info.tables || info.table_count || 0, 'Tables') +
            dbStat(info.size || info.db_size || '--', 'Size') +
            dbStat(info.connections || info.active_connections || 0, 'Conns') +
            dbStat(queries, 'Queries') +
            dbStat(info.version ? info.version.split(' ').slice(0, 2).join(' ') : 'PG', 'Version') +
          '</div>';
      });
    },

    // ── Infrastructure Map ───────────────────────────────────────────
    loadInfra: function () {
      var self = this;
      Promise.allSettled([
        fetch('/api/servers').then(r2j),
        fetch('/api/processes').then(r2j)
      ]).then(function (r) {
        var servers = r[0].status === 'fulfilled' ? (r[0].value.servers || []) : [];
        var procs = r[1].status === 'fulfilled' ? (r[1].value.processes || []) : [];
        self.renderInfraMap(servers, procs);
      });
    },

    renderInfraMap: function (servers, procs) {
      var svg = document.getElementById('infra-map');
      if (!svg) return;

      var nodes = [];
      var edges = [];

      // Users node (far left) — shows connected clients
      var clientCount = (window.state.system && window.state.system.connectedClients) || 1;
      nodes.push({ id: 'users', x: 30, y: 30, label: clientCount + '', status: clientCount > 0 ? 'healthy' : 'unhealthy', detail: 'Users', small: true });

      // Local node (center-left)
      nodes.push({ id: 'local', x: 130, y: 90, label: 'Local', status: 'healthy', detail: 'Bulwark' });
      edges.push({ from: 'users', to: 'local', status: 'healthy', label: '' });

      // Server nodes
      var sx = 280, sy = 50;
      (servers || []).forEach(function (s, i) {
        var id = 'srv-' + i;
        nodes.push({ id: id, x: sx, y: sy + i * 70, label: esc(s.name || 'Server'), status: s.status === 'healthy' || s.status === 'up' ? 'healthy' : 'unhealthy', detail: esc(s.host || s.provider || '') });
        edges.push({ from: 'local', to: id, status: s.status === 'healthy' || s.status === 'up' ? 'healthy' : 'unhealthy', label: s.latency ? s.latency + 'ms' : '' });
      });

      // DB node (if connected)
      nodes.push({ id: 'db', x: 430, y: 60, label: 'PostgreSQL', status: 'healthy', detail: 'Database' });
      if (servers.length > 0) {
        edges.push({ from: 'srv-0', to: 'db', status: 'healthy', label: '' });
      } else {
        edges.push({ from: 'local', to: 'db', status: 'healthy', label: '' });
      }

      // PM2 process nodes (bottom cluster)
      var px = 80;
      (procs || []).slice(0, 6).forEach(function (p, i) {
        var id = 'pm2-' + i;
        nodes.push({ id: id, x: px + i * 80, y: 160, label: esc(p.name || 'proc'), status: p.status === 'online' ? 'healthy' : 'unhealthy', detail: (p.cpu || 0) + '% cpu', small: true });
        edges.push({ from: 'local', to: id, status: p.status === 'online' ? 'healthy' : 'unhealthy', label: '' });
      });

      // Build SVG content
      var html = SVG_DEFS;

      // Edges
      edges.forEach(function (e) {
        var from = nodes.find(function (n) { return n.id === e.from; });
        var to = nodes.find(function (n) { return n.id === e.to; });
        if (!from || !to) return;
        html += '<line class="infra-edge ' + e.status + '" x1="' + from.x + '" y1="' + from.y + '" x2="' + to.x + '" y2="' + to.y + '"/>';
        if (e.label) {
          html += '<text class="infra-latency" x="' + ((from.x + to.x) / 2) + '" y="' + ((from.y + to.y) / 2 - 6) + '">' + e.label + '</text>';
        }
      });

      // Nodes
      nodes.forEach(function (n) {
        var r = n.small ? 14 : 20;
        var fill = n.status === 'healthy' ? 'rgba(34,211,238,0.15)' : 'rgba(255,107,43,0.15)';
        var stroke = n.status === 'healthy' ? '#22d3ee' : '#ff6b2b';
        html += '<circle class="infra-node-circle" cx="' + n.x + '" cy="' + n.y + '" r="' + r + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5" filter="url(#node-glow)"/>';
        html += '<text class="infra-node-label" x="' + n.x + '" y="' + (n.y + (n.small ? 3 : 4)) + '">' + n.label + '</text>';
        if (n.detail && !n.small) {
          html += '<text class="infra-node-status" x="' + n.x + '" y="' + (n.y + r + 12) + '">' + n.detail + '</text>';
        }
      });

      svg.innerHTML = html;
    },

    updateInfraProcesses: function (procs) {
      // Quick update — just re-render the full map with cached servers
      this.loadInfra();
    },

    updateInfraServers: function (servers) {
      this.loadInfra();
    },

    // ── Timeline ─────────────────────────────────────────────────────
    renderTimeline: function (items) {
      var el = document.getElementById('dash-timeline');
      if (!el) return;
      if (!items || !items.length) {
        el.innerHTML = '<div class="db-unavailable">No recent activity</div>';
        return;
      }

      // Group by relative time
      var groups = { 'Just now': [], '5 min ago': [], '30 min ago': [], 'Earlier today': [], 'Older': [] };
      var now = Date.now();
      items.slice(0, 20).forEach(function (a) {
        var t = a.created_at ? new Date(a.created_at).getTime() : 0;
        var diff = (now - t) / 60000; // minutes
        var group = diff < 2 ? 'Just now' : diff < 10 ? '5 min ago' : diff < 60 ? '30 min ago' : diff < 1440 ? 'Earlier today' : 'Older';
        groups[group].push(a);
      });

      var html = '';
      Object.keys(groups).forEach(function (g) {
        if (!groups[g].length) return;
        html += '<div class="timeline-group-label">' + g + '</div>';
        groups[g].forEach(function (a) {
          var type = classifyActivity(a);
          var time = a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          html += '<div class="timeline-item type-' + type + '">' +
            '<div class="timeline-icon">' + activityIcon(type) + '</div>' +
            '<div class="timeline-content"><div class="timeline-text">' + esc(a.title || a.type || 'Activity') + '</div></div>' +
            '<div class="timeline-time">' + time + '</div>' +
          '</div>';
        });
      });

      el.innerHTML = html;
    },

    // ── Tickets ──────────────────────────────────────────────────────
    renderTickets: function (data) {
      var el = document.getElementById('dash-tickets');
      if (!el) return;
      var tickets = (data && data.tickets) || [];
      var summary = (data && data.summary) || [];
      var open = 0, progress = 0, resolved = 0;
      if (summary.length) {
        summary.forEach(function (s) {
          if (s.fix_status === 'deployed' || s.fix_status === 'approved') resolved += parseInt(s.count || 0);
          else if (s.fix_status === 'fixing' || s.fix_status === 'testing' || s.fix_status === 'analyzing') progress += parseInt(s.count || 0);
          else open += parseInt(s.count || 0);
        });
      } else {
        open = tickets.length;
      }
      var total = open + progress + resolved || 1;

      el.innerHTML =
        '<div class="ticket-counts">' +
          ticketCount(open, 'Open', '#ff6b2b') +
          ticketCount(progress, 'In Progress', '#f59e0b') +
          ticketCount(resolved, 'Resolved', '#22d3ee') +
        '</div>' +
        '<div class="ticket-bar">' +
          '<div class="ticket-bar-seg open" style="width:' + (open / total * 100) + '%"></div>' +
          '<div class="ticket-bar-seg progress" style="width:' + (progress / total * 100) + '%"></div>' +
          '<div class="ticket-bar-seg resolved" style="width:' + (resolved / total * 100) + '%"></div>' +
        '</div>';
    },

    // ── Commands ─────────────────────────────────────────────────────
    cmd: function (action) {
      if (action === 'refresh') {
        this.show();
        Toast.info('Refreshing dashboard...');
        return;
      }
      if (action === 'claude') {
        var el = document.getElementById('claude-inline');
        if (el) {
          el.classList.toggle('open');
          if (el.classList.contains('open')) {
            var inp = document.getElementById('claude-q');
            if (inp) inp.focus();
          }
        }
        return;
      }
      if (action === 'diag') {
        this.runDiagModal();
        return;
      }
      if (action === 'deploy') {
        this.runDeployModal();
        return;
      }
    },

    runDiagModal: function () {
      Modal.open({ title: 'Running diagnostics...', body: '<div style="text-align:center;padding:20px;color:var(--text-tertiary)">Please wait...</div>', size: 'sm' });
      fetch('/api/db/assistant/diagnostics').then(r2j).then(function (d) {
        if (d.error) { Modal.close(); Toast.error(d.error); return; }
        var html = '<div style="text-align:center;margin-bottom:20px">' +
          '<div style="font-size:48px;font-weight:700;font-family:var(--font-mono);color:' + (d.score >= 70 ? '#22d3ee' : '#ff6b2b') + '">' + d.score + '</div>' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-tertiary)">Health Score</div></div>';
        html += '<div style="display:grid;gap:8px">';
        (d.checks || []).forEach(function (c) {
          var color = c.status === 'good' ? '#22d3ee' : c.status === 'warn' ? '#f59e0b' : c.status === 'bad' ? '#ff6b2b' : 'var(--text-tertiary)';
          html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,0.2);border-radius:6px">' +
            '<span style="width:6px;height:6px;border-radius:50%;background:' + color + ';flex-shrink:0"></span>' +
            '<span style="flex:1;font-size:12px">' + esc(c.name) + '</span>' +
            '<span style="font-family:var(--font-mono);font-size:11px;color:' + color + '">' + esc(c.value || c.status) + '</span></div>';
        });
        html += '</div>';
        Modal.close();
        Modal.open({ title: 'Database Diagnostics', body: html });
      }).catch(function (e) {
        Modal.close();
        Toast.error('Diagnostics failed: ' + e.message);
      });
    },

    runDeployModal: function () {
      Modal.open({ title: 'Checking deploy readiness...', body: '<div style="text-align:center;padding:20px;color:var(--text-tertiary)">Please wait...</div>', size: 'sm' });
      fetch('/api/db/assistant/deploy-check').then(r2j).then(function (d) {
        if (d.error) { Modal.close(); Toast.error(d.error); return; }
        var ready = d.ready;
        var html = '<div style="text-align:center;margin-bottom:20px">' +
          '<div style="font-size:14px;font-weight:600;font-family:var(--font-mono);padding:8px 20px;border-radius:6px;display:inline-block;background:' +
          (ready ? 'rgba(34,211,238,0.1);color:#22d3ee;border:1px solid rgba(34,211,238,0.2)' : 'rgba(255,107,43,0.1);color:#ff6b2b;border:1px solid rgba(255,107,43,0.2)') + '">' +
          (ready ? 'READY TO DEPLOY' : 'BLOCKED') + '</div></div>';
        html += '<div style="display:grid;gap:8px">';
        (d.checks || []).forEach(function (c) {
          var sym = c.status === 'pass' ? '\u2713' : c.status === 'warn' ? '\u26a0' : '\u2717';
          var color = c.status === 'pass' ? '#22d3ee' : c.status === 'warn' ? '#f59e0b' : '#ff6b2b';
          html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,0.2);border-radius:6px">' +
            '<span style="color:' + color + ';font-size:14px">' + sym + '</span>' +
            '<span style="flex:1;font-size:12px">' + esc(c.name) + '</span>' +
            '<span style="font-family:var(--font-mono);font-size:11px;color:var(--text-tertiary)">' + esc(c.detail || '') + '</span></div>';
        });
        html += '</div>';
        Modal.close();
        Modal.open({ title: 'Deploy Readiness', body: html });
      }).catch(function (e) {
        Modal.close();
        Toast.error('Deploy check failed: ' + e.message);
      });
    },

    askClaude: function () {
      var inp = document.getElementById('claude-q');
      var resp = document.getElementById('claude-resp');
      if (!inp || !resp) return;
      var q = inp.value.trim();
      if (!q) return;
      inp.disabled = true;
      resp.style.display = 'block';
      resp.textContent = 'Thinking...';
      fetch('/api/db/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q })
      }).then(r2j).then(function (d) {
        inp.disabled = false;
        inp.value = '';
        if (d.error) { resp.textContent = d.error; return; }
        resp.textContent = d.response || 'No response';
      }).catch(function (e) {
        inp.disabled = false;
        resp.textContent = 'Error: ' + e.message;
      });
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────

  function r2j(r) {
    var ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error('Non-JSON response');
    return r.json();
  }
  function noop() {}

  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  function updateGauge(id, pct) {
    pct = Math.min(100, Math.max(0, pct || 0));
    var arc = document.getElementById('gauge-arc-' + id);
    var val = document.getElementById('gauge-val-' + id);
    if (arc) {
      arc.setAttribute('stroke-dashoffset', (CIRC * (1 - pct / 100)).toFixed(1));
      if (pct > 80) arc.classList.add('pulsing');
      else arc.classList.remove('pulsing');
    }
    if (val) val.textContent = Math.round(pct) + '%';
  }

  function updateHealthRing(score, subscores) {
    var scoreEl = document.getElementById('ring-score');
    if (scoreEl) scoreEl.textContent = score;

    // Update subscores text
    RING_KEYS.forEach(function (k) {
      var el = document.getElementById('ring-sub-' + k);
      if (el) el.textContent = (subscores[k] !== null && subscores[k] !== undefined) ? subscores[k] : 'N/A';
    });

    // Update ring segments — distribute proportionally (skip nulls)
    var total = 0;
    var vals = RING_KEYS.map(function (k) { var v = (subscores[k] !== null && subscores[k] !== undefined) ? subscores[k] : 0; total += v; return v; });
    if (total === 0) return;

    var offset = 0;
    vals.forEach(function (v, i) {
      var seg = document.getElementById('ring-seg-' + i);
      if (!seg) return;
      var len = (v / total) * RING_CIRC * (score / 100);
      var gap = RING_CIRC - len;
      seg.setAttribute('stroke-dasharray', len.toFixed(1) + ' ' + gap.toFixed(1));
      seg.setAttribute('stroke-dashoffset', (-offset).toFixed(1));
      offset += len + 2; // 2px gap between segments
    });
  }

  function typeWriter(el, text, speed) {
    speed = speed || 18;
    el.innerHTML = '';
    var i = 0;
    var cursor = document.createElement('span');
    cursor.className = 'briefing-cursor';
    typewriterTimer = setInterval(function () {
      if (i < text.length) {
        el.textContent = text.substring(0, i + 1);
        el.appendChild(cursor);
        i++;
      } else {
        clearInterval(typewriterTimer);
        // Remove cursor after 2s
        setTimeout(function () { if (cursor.parentNode) cursor.parentNode.removeChild(cursor); }, 2000);
      }
    }, speed);
  }

  function sparkOpts(color) {
    return {
      data: { labels: [], datasets: [Object.assign({ data: [], label: '' }, Charts.defaultLineConfig ? Charts.defaultLineConfig(color) : { borderColor: color, backgroundColor: color + '20', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5 })] },
      options: { scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: { enabled: false } }, maintainAspectRatio: false }
    };
  }

  function dbStat(value, label) {
    return '<div class="db-stat"><div class="db-stat-value">' + esc(String(value)) + '</div><div class="db-stat-label">' + label + '</div></div>';
  }

  function ticketCount(n, label, color) {
    return '<div class="ticket-count-item"><div class="ticket-count-num" style="color:' + color + '">' + n + '</div><div class="ticket-count-label">' + label + '</div></div>';
  }

  function classifyActivity(a) {
    var t = ((a.type || '') + ' ' + (a.title || '')).toLowerCase();
    if (t.indexOf('error') >= 0 || t.indexOf('fail') >= 0 || t.indexOf('crash') >= 0) return 'error';
    if (t.indexOf('deploy') >= 0 || t.indexOf('push') >= 0) return 'deploy';
    if (t.indexOf('claude') >= 0 || t.indexOf('ai') >= 0) return 'claude';
    if (t.indexOf('ticket') >= 0 || t.indexOf('bug') >= 0) return 'alert';
    if (t.indexOf('query') >= 0 || t.indexOf('select') >= 0 || t.indexOf('sql') >= 0) return 'query';
    return 'success';
  }

  function activityIcon(type) {
    if (type === 'error') return icon('zap');
    if (type === 'deploy') return icon('rocket');
    if (type === 'claude') return icon('terminal');
    if (type === 'alert') return icon('ticket');
    if (type === 'query') return icon('database');
    return icon('server');
  }

  function calEvIcon(cat) {
    var m = { meeting: '&#128101;', deploy: '&#128640;', deadline: '&#9888;', reminder: '&#128276;', maintenance: '&#128295;' };
    return m[cat] || '&#128197;';
  }

  // Expose widget renderers on Views.dashboard
  var vd = Views.dashboard;
  vd.renderCalWidget = function (d) {
    var el = document.getElementById('dash-cal-widget');
    if (!el) return;
    el.innerHTML =
      '<div class="wk-widget-stats">' +
        '<div class="wk-stat"><span class="wk-stat-val" style="color:var(--cyan)">' + (d.todayCount || 0) + '</span><span class="wk-stat-lbl">Today</span></div>' +
        '<div class="wk-stat"><span class="wk-stat-val">' + (d.weekCount || 0) + '</span><span class="wk-stat-lbl">This Week</span></div>' +
        '<div class="wk-stat"><span class="wk-stat-val">' + (d.totalEvents || 0) + '</span><span class="wk-stat-lbl">Total</span></div>' +
      '</div>' +
      ((d.todayEvents && d.todayEvents.length) ?
        '<div class="wk-widget-list">' + d.todayEvents.slice(0, 3).map(function (e) {
          return '<div class="wk-widget-item"><span class="wk-widget-icon">' + calEvIcon(e.category) + '</span><span>' + esc(e.title) + '</span>' + (e.time ? '<span class="wk-widget-time">' + e.time + '</span>' : '') + '</div>';
        }).join('') + '</div>'
        : '<div class="wk-widget-empty">No events today</div>');
  };

  vd.renderNotesWidget = function (d) {
    var el = document.getElementById('dash-notes-widget');
    if (!el) return;
    var notes = d.notes || [];
    var pinned = notes.filter(function (n) { return n.pinned; });
    el.innerHTML =
      '<div class="wk-widget-stats">' +
        '<div class="wk-stat"><span class="wk-stat-val" style="color:var(--cyan)">' + notes.length + '</span><span class="wk-stat-lbl">Notes</span></div>' +
        '<div class="wk-stat"><span class="wk-stat-val">' + pinned.length + '</span><span class="wk-stat-lbl">Pinned</span></div>' +
      '</div>' +
      (notes.length ?
        '<div class="wk-widget-list">' + notes.slice(0, 3).map(function (n) {
          return '<div class="wk-widget-item"><span class="wk-widget-icon">' + (n.pinned ? '&#128204;' : '&#128196;') + '</span><span>' + esc(n.title) + '</span></div>';
        }).join('') + '</div>'
        : '<div class="wk-widget-empty">No notes yet</div>');
  };

})();
