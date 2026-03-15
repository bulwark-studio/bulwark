/**
 * Bulwark v2.1 — Metrics Command Center
 * AI-powered system intelligence with real-time visualization
 */
(function () {
  'use strict';

  var timeRange = 60;
  var cpuHistory = [], memHistory = [], coreHistory = [];
  var MAX_HISTORY = 200;
  var aiAnalysisCache = null;
  var aiCacheTime = 0;
  var typewriterTimer = null;

  // ── SVG Icons ──────────────────────────────────────────────────────
  var IC = {
    cpu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
    mem: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="14"/><line x1="14" y1="10" x2="14" y2="14"/><line x1="18" y1="10" x2="18" y2="14"/></svg>',
    brain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z"/><path d="M9 21h6"/></svg>',
    refresh: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    activity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    zap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    disc: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
    clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
  };

  // ── Core heatmap color (0-100 → dark to cyan) ─────────────────────
  function coreColor(pct) {
    if (pct > 80) return '#ff6b2b';
    if (pct > 50) return '#f59e0b';
    if (pct > 20) return '#22d3ee';
    return '#5eead4';
  }

  function coreBg(pct) {
    if (pct > 80) return 'rgba(255,107,43,0.25)';
    if (pct > 50) return 'rgba(245,158,11,0.20)';
    if (pct > 20) return 'rgba(34,211,238,0.18)';
    return 'rgba(34,211,238,0.10)';
  }

  // ── Build layout ───────────────────────────────────────────────────
  Views.metrics = {
    init: function () {
      var c = document.getElementById('view-metrics');
      if (!c) return;

      c.innerHTML =
        '<div class="overview-grid">' +

        /* ── Anomaly Alert Slot ── */
        '<div id="ai-anomaly-alert"></div>' +

        /* ── AI Analysis Banner ── */
        '<div class="briefing-card" id="metrics-ai-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-label">' + IC.brain + ' AI Performance Analysis <span id="metrics-ai-freshness"></span></div>' +
            '<button class="briefing-refresh" onclick="Views.metrics.runAnalysis(true)">' + IC.refresh + ' Analyze</button>' +
          '</div>' +
          '<div class="briefing-text" id="metrics-ai-text" style="min-height:40px">' +
            '<span style="color:var(--text-tertiary)">Click Analyze for AI-powered performance insights</span>' +
          '</div>' +
        '</div>' +

        /* ── Top Stats Row ── */
        '<div class="metrics-hero-row" id="metrics-hero">' +
          heroStat('m-cpu', 'CPU', IC.cpu, '#22d3ee', '0%') +
          heroStat('m-mem', 'MEMORY', IC.mem, '#a78bfa', '0%') +
          heroStat('m-cores', 'CORES', IC.cpu, '#3b82f6', '0') +
          heroStat('m-uptime', 'UPTIME', IC.clock, '#f59e0b', '--') +
        '</div>' +

        /* ── Time Range Bar ── */
        '<div class="metrics-toolbar">' +
          '<div class="metrics-toolbar-left">' + IC.activity + ' <span>Real-time Telemetry</span></div>' +
          '<div class="metrics-range-bar">' +
            rangeBtn(30, '5m') + rangeBtn(60, '15m', true) + rangeBtn(120, '1h') + rangeBtn(360, '6h') +
          '</div>' +
        '</div>' +

        /* ── CPU Section ── */
        '<div class="overview-row overview-row-2">' +
          '<div class="metrics-panel">' +
            '<div class="metrics-panel-header"><span>' + IC.cpu + ' CPU Aggregate</span><span class="metrics-live-dot"></span></div>' +
            '<div class="metrics-chart-wrap"><canvas id="m-cpu-chart" height="200"></canvas></div>' +
          '</div>' +
          '<div class="metrics-panel">' +
            '<div class="metrics-panel-header"><span>' + IC.cpu + ' Core Heatmap</span><span id="m-core-count" class="metrics-badge">0 cores</span></div>' +
            '<div id="m-core-heatmap" class="core-heatmap"></div>' +
            '<div id="m-core-legend" class="core-legend"></div>' +
          '</div>' +
        '</div>' +

        /* ── Memory + System Section ── */
        '<div class="overview-row overview-row-2">' +
          '<div class="metrics-panel">' +
            '<div class="metrics-panel-header"><span>' + IC.mem + ' Memory Usage</span><span class="metrics-live-dot"></span></div>' +
            '<div class="metrics-chart-wrap"><canvas id="m-mem-chart" height="200"></canvas></div>' +
            '<div class="metrics-mem-bar-wrap">' +
              '<div class="metrics-mem-bar" id="m-mem-bar"><div class="metrics-mem-fill" id="m-mem-fill"></div></div>' +
              '<div class="metrics-mem-labels"><span id="m-mem-used">0 MB</span><span id="m-mem-total">0 MB</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="metrics-panel">' +
            '<div class="metrics-panel-header"><span>' + IC.disc + ' System Info</span></div>' +
            '<div id="m-sysinfo" class="sysinfo-grid"></div>' +
          '</div>' +
        '</div>' +

        /* ── Per-Core History (sparklines) ── */
        '<div class="metrics-panel">' +
          '<div class="metrics-panel-header"><span>' + IC.zap + ' Per-Core Activity (last ' + timeRange + ' readings)</span></div>' +
          '<div id="m-core-sparks" class="core-sparks-grid"></div>' +
        '</div>' +

        '</div>'; // end overview-grid
    },

    show: function () {
      initCharts();
      fetchAll();
      // Restore cached AI analysis on nav-back (no re-fetch)
      this.runAnalysis(false);
    },

    hide: function () {
      if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    },

    update: function (data) {
      if (!data || !data.system) return;
      var s = data.system;
      var cpu = s.cpuPct || 0;
      var mem = s.usedMemPct || s.memPct || 0;
      var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Track history
      cpuHistory.push({ t: now, v: cpu });
      memHistory.push({ t: now, v: mem });
      if (cpuHistory.length > MAX_HISTORY) cpuHistory.shift();
      if (memHistory.length > MAX_HISTORY) memHistory.shift();

      // Update charts
      Charts.appendPoint('m-cpu-chart', now, cpu, timeRange);
      Charts.appendPoint('m-mem-chart', now, mem, timeRange);

      // Hero stats
      setHero('m-cpu', cpu.toFixed(1) + '%', cpu);
      setHero('m-mem', mem.toFixed(1) + '%', mem);
      if (s.usedMemMB) {
        var usedEl = document.getElementById('m-mem-used');
        var totalEl = document.getElementById('m-mem-total');
        var fillEl = document.getElementById('m-mem-fill');
        if (usedEl) usedEl.textContent = formatMB(s.usedMemMB) + ' used';
        if (totalEl) totalEl.textContent = formatMB(s.totalMemMB) + ' total';
        if (fillEl) fillEl.style.width = mem + '%';
      }
      if (s.uptimeHours !== undefined) {
        setHeroText('m-uptime', formatUptime(s.uptimeHours));
      }

      // Extended metrics (per-core) from socket
      if (data.extended && data.extended.perCore) {
        updateCoreHeatmap(data.extended.perCore);
        trackCoreHistory(data.extended.perCore);
      }
    },

    // ── AI Analysis ──────────────────────────────────────────────────
    runAnalysis: function (force) {
      var el = document.getElementById('metrics-ai-text');
      var badge = document.getElementById('metrics-ai-freshness');
      if (!el) return;

      // On nav-back (not forced), restore cached response instantly
      if (!force && window.AICache) {
        var restored = window.AICache.restore('metrics');
        if (restored) {
          el.textContent = restored.response;
          if (badge) badge.innerHTML = window.AICache.freshnessBadge('metrics');
          return;
        }
        // No cache and not forced — don't auto-fetch, wait for user click
        return;
      }
      if (!force) return;

      el.innerHTML = '<div class="briefing-shimmer" style="width:90%"></div><div class="briefing-shimmer" style="width:65%"></div>';

      var cpuArr = cpuHistory.slice(-30).map(function (h) { return h.v; });
      var memArr = memHistory.slice(-30).map(function (h) { return h.v; });
      var coresArr = coreHistory.length ? coreHistory[coreHistory.length - 1] : [];
      var cpuAvg = cpuHistory.length ? +(cpuHistory.reduce(function (s, h) { return s + h.v; }, 0) / cpuHistory.length).toFixed(1) : 0;
      var memAvg = memHistory.length ? +(memHistory.reduce(function (s, h) { return s + h.v; }, 0) / memHistory.length).toFixed(1) : 0;
      var cpuMax = cpuHistory.length ? Math.max.apply(null, cpuHistory.map(function (h) { return h.v; })) : 0;
      var memMax = memHistory.length ? Math.max.apply(null, memHistory.map(function (h) { return h.v; })) : 0;

      var prompt = 'Analyze this real-time system performance data and give a 2-3 sentence assessment. ' +
        'CPU history (last 30 readings): [' + cpuArr.join(',') + ']. ' +
        'Memory history: [' + memArr.join(',') + ']. ' +
        'CPU avg: ' + cpuAvg + '%, max: ' + cpuMax + '%. ' +
        'Memory avg: ' + memAvg + '%, max: ' + memMax + '%. ' +
        'Cores (' + coresArr.length + '): [' + coresArr.join(',') + ']. ' +
        'Identify any anomalies, hot cores, memory pressure, or optimization opportunities. Be specific with numbers. No markdown.';

      fetch('/api/db/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      }).then(safeJson).then(function (d) {
        var text = d.response || d.error || 'Analysis unavailable';
        el.style.opacity = '';
        // Store in AICache
        if (window.AICache) {
          window.AICache.set('metrics', {}, text, { sensitivity: 'medium' });
          if (badge) badge.innerHTML = window.AICache.freshnessBadge('metrics');
        }
        // Also keep legacy cache for backwards compat
        aiAnalysisCache = text;
        aiCacheTime = Date.now();
        typeWriter(el, text);
      }).catch(function () {
        el.style.opacity = '';
        el.textContent = 'AI analysis unavailable — check AI provider in Settings';
      });
    }
  };

  // ── Chart initialization ───────────────────────────────────────────
  function initCharts() {
    Charts.create('m-cpu-chart', 'line', {
      data: {
        labels: cpuHistory.map(function (h) { return h.t; }),
        datasets: [Object.assign({ data: cpuHistory.map(function (h) { return h.v; }), label: 'CPU %' }, Charts.defaultLineConfig('#22d3ee'))]
      },
      options: { scales: { y: { min: 0, max: 100 } } }
    });
    Charts.create('m-mem-chart', 'line', {
      data: {
        labels: memHistory.map(function (h) { return h.t; }),
        datasets: [Object.assign({ data: memHistory.map(function (h) { return h.v; }), label: 'Memory %' }, Charts.defaultLineConfig('#a78bfa'))]
      },
      options: { scales: { y: { min: 0, max: 100 } } }
    });
    // Force full render after creation (fixes gradient fill not showing on initial data)
    setTimeout(function () {
      var cpuChart = Charts.instances['m-cpu-chart'];
      var memChart = Charts.instances['m-mem-chart'];
      if (cpuChart) cpuChart.update();
      if (memChart) memChart.update();
    }, 100);
  }

  // ── Fetch initial data ─────────────────────────────────────────────
  function fetchAll() {
    // System info
    fetch('/api/system').then(safeJson).then(function (s) {
      setHero('m-cpu', (s.cpuPct || 0).toFixed(1) + '%', s.cpuPct || 0);
      setHero('m-mem', (s.usedMemPct || 0).toFixed(1) + '%', s.usedMemPct || 0);
      setHero('m-cores', s.cpuCount || 0);
      setHeroText('m-uptime', formatUptime(s.uptimeHours || 0));

      var usedEl = document.getElementById('m-mem-used');
      var totalEl = document.getElementById('m-mem-total');
      var fillEl = document.getElementById('m-mem-fill');
      if (usedEl) usedEl.textContent = formatMB(s.usedMemMB || 0) + ' used';
      if (totalEl) totalEl.textContent = formatMB(s.totalMemMB || 0) + ' total';
      if (fillEl) fillEl.style.width = (s.usedMemPct || 0) + '%';

      renderSysInfo(s);
    }).catch(function () {});

    // History
    fetch('/api/metrics/history?type=cpu&count=' + timeRange).then(safeJson).then(function (d) {
      if (d.data && d.data.length) {
        cpuHistory = d.data.map(function (p) {
          return { t: new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), v: p.value || p.cpuPct || 0 };
        });
        Charts.update('m-cpu-chart',
          cpuHistory.map(function (h) { return h.t; }),
          [{ data: cpuHistory.map(function (h) { return h.v; }) }]
        );
        // Core history from first fetch
        if (d.data[0] && d.data[0].perCore) {
          d.data.forEach(function (p) { if (p.perCore) coreHistory.push(p.perCore); });
          if (coreHistory.length > MAX_HISTORY) coreHistory = coreHistory.slice(-MAX_HISTORY);
          updateCoreHeatmap(d.data[d.data.length - 1].perCore);
          setHero('m-cores', d.data[d.data.length - 1].perCore.length);
          document.getElementById('m-core-count').textContent = d.data[d.data.length - 1].perCore.length + ' cores';
          renderCoreSparklines();
        }
      }
    }).catch(function () {});

    fetch('/api/metrics/history?type=memory&count=' + timeRange).then(safeJson).then(function (d) {
      if (d.data && d.data.length) {
        memHistory = d.data.map(function (p) {
          return { t: new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), v: p.pct || p.value || 0 };
        });
        Charts.update('m-mem-chart',
          memHistory.map(function (h) { return h.t; }),
          [{ data: memHistory.map(function (h) { return h.v; }) }]
        );
      }
    }).catch(function () {});

    // Extended (per-core live)
    fetch('/api/metrics/extended').then(safeJson).then(function (d) {
      if (d.perCore) {
        updateCoreHeatmap(d.perCore);
        trackCoreHistory(d.perCore);
        setHero('m-cores', d.perCore.length);
        var cc = document.getElementById('m-core-count');
        if (cc) cc.textContent = d.perCore.length + ' cores';
      }
    }).catch(function () {});
  }

  // ── Core Heatmap ───────────────────────────────────────────────────
  function updateCoreHeatmap(cores) {
    var el = document.getElementById('m-core-heatmap');
    if (!el) return;
    el.innerHTML = cores.map(function (pct, i) {
      return '<div class="core-cell" style="background:' + coreBg(pct) + ';border:1px solid rgba(255,255,255,0.06)" title="Core ' + i + ': ' + pct + '%">' +
        '<div class="core-cell-id">Core ' + i + '</div>' +
        '<div class="core-cell-pct" style="color:' + coreColor(pct) + '">' + pct + '%</div>' +
      '</div>';
    }).join('');

    // Legend
    var leg = document.getElementById('m-core-legend');
    if (leg) {
      var avg = cores.reduce(function (s, v) { return s + v; }, 0) / cores.length;
      var max = Math.max.apply(null, cores);
      var hot = cores.filter(function (v) { return v > 50; }).length;
      leg.innerHTML =
        '<span>Avg: <b>' + avg.toFixed(1) + '%</b></span>' +
        '<span>Peak: <b style="color:' + coreColor(max) + '">' + max + '%</b></span>' +
        '<span>Hot cores: <b style="color:' + (hot > 0 ? '#ff6b2b' : '#22d3ee') + '">' + hot + '</b></span>';
    }
  }

  function trackCoreHistory(cores) {
    coreHistory.push(cores.slice());
    if (coreHistory.length > MAX_HISTORY) coreHistory.shift();
  }

  // ── Per-Core Sparklines ────────────────────────────────────────────
  function renderCoreSparklines() {
    var el = document.getElementById('m-core-sparks');
    if (!el || coreHistory.length < 2) { if (el) el.innerHTML = '<div style="color:var(--text-tertiary);font-size:11px;padding:12px">Collecting data...</div>'; return; }

    var numCores = coreHistory[0].length;
    var html = '';
    for (var i = 0; i < numCores; i++) {
      var vals = coreHistory.map(function (snap) { return snap[i] || 0; });
      var max = Math.max.apply(null, vals);
      var avg = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
      var lineColor = coreColor(avg);
      html += '<div class="core-spark-row">' +
        '<span class="core-spark-label">Core ' + i + '</span>' +
        '<svg class="core-spark-svg" viewBox="0 0 ' + vals.length + ' 50" preserveAspectRatio="none">' +
          '<polyline points="' + vals.map(function (v, j) { return j + ',' + (50 - v * 0.5); }).join(' ') + '" ' +
          'fill="none" stroke="' + lineColor + '" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>' +
        '<span class="core-spark-avg" style="color:' + lineColor + '">' + avg.toFixed(0) + '%</span>' +
      '</div>';
    }
    el.innerHTML = html;
  }

  // ── System Info Panel ──────────────────────────────────────────────
  function renderSysInfo(s) {
    var el = document.getElementById('m-sysinfo');
    if (!el) return;
    var items = [
      ['Hostname', s.hostname || '--'],
      ['Platform', s.platform || '--'],
      ['Architecture', s.arch || '--'],
      ['CPU Model', (s.cpuModel || '--').trim()],
      ['Cores', s.cpuCount || 0],
      ['Node.js', s.nodeVersion || '--'],
      ['Uptime', formatUptime(s.uptimeHours || 0)],
      ['Load Avg', (s.loadAvg || []).map(function (l) { return parseFloat(l).toFixed(2); }).join(' / ')]
    ];
    el.innerHTML = items.map(function (item) {
      return '<div class="sysinfo-item">' +
        '<div class="sysinfo-label">' + item[0] + '</div>' +
        '<div class="sysinfo-value">' + esc(String(item[1])) + '</div>' +
      '</div>';
    }).join('');
  }

  // ── Hero stat helpers ──────────────────────────────────────────────
  function heroStat(id, label, icon, color, val) {
    return '<div class="metrics-hero-stat" id="' + id + '">' +
      '<div class="metrics-hero-icon" style="color:' + color + '">' + icon + '</div>' +
      '<div class="metrics-hero-value" id="' + id + '-val">' + val + '</div>' +
      '<div class="metrics-hero-label">' + label + '</div>' +
      '<div class="metrics-hero-bar"><div class="metrics-hero-fill" id="' + id + '-fill" style="background:' + color + ';width:0%"></div></div>' +
    '</div>';
  }

  function setHero(id, text, pct) {
    var v = document.getElementById(id + '-val');
    var f = document.getElementById(id + '-fill');
    if (v) v.textContent = text;
    if (f && pct !== undefined) f.style.width = Math.min(100, pct) + '%';
  }

  function setHeroText(id, text) {
    var v = document.getElementById(id + '-val');
    if (v) v.textContent = text;
  }

  // ── Utilities ──────────────────────────────────────────────────────
  function formatMB(mb) {
    if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
    return Math.round(mb) + ' MB';
  }

  function formatUptime(hours) {
    if (hours >= 24) return Math.floor(hours / 24) + 'd ' + Math.floor(hours % 24) + 'h';
    if (hours >= 1) return hours.toFixed(1) + 'h';
    return Math.round(hours * 60) + 'm';
  }

  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  function typeWriter(el, text, speed) {
    speed = speed || 18;
    if (typewriterTimer) clearInterval(typewriterTimer);
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
        typewriterTimer = null;
        setTimeout(function () { if (cursor.parentNode) cursor.remove(); }, 2000);
      }
    }, speed);
  }

  function rangeBtn(pts, label, active) {
    return '<button class="metrics-range-btn' + (active ? ' active' : '') + '" data-range="' + pts + '" onclick="Views.metrics.setRange(' + pts + ')">' + label + '</button>';
  }

  Views.metrics.setRange = function (pts) {
    timeRange = pts;
    var btns = document.querySelectorAll('.metrics-range-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = 'metrics-range-btn' + (parseInt(btns[i].dataset.range) === pts ? ' active' : '');
    }
    // Re-fetch with new range
    fetch('/api/metrics/history?type=cpu&count=' + pts).then(safeJson).then(function (d) {
      if (d.data && d.data.length) {
        cpuHistory = d.data.map(function (p) {
          return { t: new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), v: p.value || p.cpuPct || 0 };
        });
        Charts.update('m-cpu-chart', cpuHistory.map(function (h) { return h.t; }), [{ data: cpuHistory.map(function (h) { return h.v; }) }]);
        if (d.data[0] && d.data[0].perCore) {
          coreHistory = d.data.filter(function (p) { return p.perCore; }).map(function (p) { return p.perCore; });
          renderCoreSparklines();
        }
      }
    }).catch(function () {});
    fetch('/api/metrics/history?type=memory&count=' + pts).then(safeJson).then(function (d) {
      if (d.data && d.data.length) {
        memHistory = d.data.map(function (p) {
          return { t: new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), v: p.pct || p.value || 0 };
        });
        Charts.update('m-mem-chart', memHistory.map(function (h) { return h.t; }), [{ data: memHistory.map(function (h) { return h.v; }) }]);
      }
    }).catch(function () {});
    // Update sparkline header
    var hdr = document.querySelector('#m-core-sparks').parentNode.querySelector('.metrics-panel-header span');
    if (hdr) hdr.innerHTML = IC.zap + ' Per-Core Activity (last ' + pts + ' readings)';
  };

})();
