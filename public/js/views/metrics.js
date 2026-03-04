/**
 * Chester Dev Monitor v2.0 — Enhanced Metrics View
 * CPU per-core bar + aggregate line, Memory line + processes, Network RX/TX, Disk donut + I/O
 * Time range selector: 5m, 15m, 1h, 6h, 24h
 */
(function () {
  'use strict';

  var timeRange = 60; // data points
  var initialized = false;

  Views.metrics = {
    init: function () {
      var container = document.getElementById('view-metrics');
      if (container) {
        container.innerHTML =
          /* ── Time Range Selector ── */
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5)">' +
            '<div class="card-title" style="font-size:var(--font-size-lg)">System Metrics</div>' +
            '<div style="display:flex;gap:var(--space-2)">' +
              '<button class="btn btn-sm metrics-range-btn" data-range="15" onclick="setMetricsRange(15)">5m</button>' +
              '<button class="btn btn-sm metrics-range-btn" data-range="30" onclick="setMetricsRange(30)">15m</button>' +
              '<button class="btn btn-sm btn-primary metrics-range-btn" data-range="60" onclick="setMetricsRange(60)">1h</button>' +
              '<button class="btn btn-sm metrics-range-btn" data-range="180" onclick="setMetricsRange(180)">6h</button>' +
              '<button class="btn btn-sm metrics-range-btn" data-range="720" onclick="setMetricsRange(720)">24h</button>' +
            '</div>' +
          '</div>' +
          /* ── Charts 2x2 Grid ── */
          '<div class="grid-2">' +
            /* CPU Panel */
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">CPU Usage</span><span class="badge badge-cyan">%</span></div>' +
              '<canvas id="metrics-cpu-line" height="180"></canvas>' +
              '<div style="margin-top:var(--space-4)">' +
                '<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--space-2)">Per-Core Utilization</div>' +
                '<div id="metrics-cpu-cores"><div style="color:var(--text-tertiary);font-size:var(--font-size-xs)">Waiting for data...</div></div>' +
              '</div>' +
            '</div>' +
            /* Memory Panel */
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">Memory Usage</span><span class="badge badge-purple">%</span></div>' +
              '<canvas id="metrics-mem-line" height="180"></canvas>' +
              '<div style="margin-top:var(--space-4)">' +
                '<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--space-2)">Top Processes (by Memory)</div>' +
                '<div id="metrics-top-procs"><div style="color:var(--text-tertiary);font-size:var(--font-size-xs)">Waiting for data...</div></div>' +
              '</div>' +
            '</div>' +
            /* Network Panel */
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">Network I/O</span><span class="badge badge-cyan">RX</span><span class="badge badge-orange" style="margin-left:4px">TX</span></div>' +
              '<canvas id="metrics-net-line" height="220"></canvas>' +
            '</div>' +
            /* Disk Panel */
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">Disk Usage</span></div>' +
              '<div style="display:flex;align-items:center;gap:var(--space-6)">' +
                '<div style="position:relative;width:160px;height:160px">' +
                  '<canvas id="metrics-disk-donut" width="160" height="160"></canvas>' +
                  '<div id="metrics-disk-label" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:var(--font-size-lg);font-weight:700;color:var(--text-primary)">--</div>' +
                '</div>' +
                '<div style="flex:1;font-size:var(--font-size-xs);color:var(--text-tertiary)">Disk utilization across primary mount point.</div>' +
              '</div>' +
            '</div>' +
          '</div>';
      }
    },

    show: function () {
      if (!initialized) {
        initCharts();
        initialized = true;
      }
      fetchMetrics();
    },

    hide: function () {},

    update: function (data) {
      if (data && data.system) {
        var s = data.system;
        var now = new Date().toLocaleTimeString();
        if (s.cpu !== undefined) {
          Charts.appendPoint('metrics-cpu-line', now, typeof s.cpu === 'number' ? s.cpu : s.cpu.percent || 0, timeRange);
        }
        if (s.memory) {
          var memPct = s.memory.percent || (s.memory.used / s.memory.total * 100);
          Charts.appendPoint('metrics-mem-line', now, memPct, timeRange);
        }
        if (s.network) {
          Charts.appendPoint('metrics-net-line', now, [s.network.rx || 0, s.network.tx || 0], timeRange);
        }
      }
    }
  };

  function initCharts() {
    // CPU Line
    Charts.create('metrics-cpu-line', 'line', {
      data: { labels: [], datasets: [Object.assign({ data: [], label: 'CPU %' }, Charts.defaultLineConfig(Charts.colors.cyan))] },
      options: { scales: { y: { min: 0, max: 100 } } }
    });
    // Memory Line
    Charts.create('metrics-mem-line', 'line', {
      data: { labels: [], datasets: [Object.assign({ data: [], label: 'Memory %' }, Charts.defaultLineConfig(Charts.colors.purple))] },
      options: { scales: { y: { min: 0, max: 100 } } }
    });
    // Network Line (RX + TX)
    Charts.create('metrics-net-line', 'line', {
      data: { labels: [], datasets: [
        Object.assign({ data: [], label: 'RX' }, Charts.defaultLineConfig(Charts.colors.cyan)),
        Object.assign({ data: [], label: 'TX' }, Charts.defaultLineConfig(Charts.colors.orange))
      ] },
      options: { plugins: { legend: { display: true, labels: { color: '#94a3b8', font: { size: 10 } } } } }
    });
    // Disk Donut
    Charts.create('metrics-disk-donut', 'doughnut', {
      data: {
        labels: ['Used', 'Free'],
        datasets: [{ data: [0, 100], backgroundColor: [Charts.colors.cyan, 'rgba(255,255,255,0.06)'], borderWidth: 0 }]
      },
      options: { cutout: '70%', plugins: { legend: { display: false } } }
    });
  }

  function fetchMetrics() {
    // Extended metrics
    fetch('/api/metrics/extended')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        // CPU per-core bars
        var cpuEl = document.getElementById('metrics-cpu-cores');
        if (cpuEl && d.cpuPerCore) {
          cpuEl.innerHTML = d.cpuPerCore.map(function (pct, i) {
            var w = Math.min(pct, 100);
            return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="width:40px;font-size:10px;color:var(--text3)">Core ' + i + '</span>' +
              '<div style="flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden"><div style="height:100%;width:' + w + '%;background:var(--cyan);border-radius:4px;transition:width 0.5s"></div></div>' +
              '<span style="width:35px;text-align:right;font-size:10px;color:var(--text2)">' + pct.toFixed(0) + '%</span></div>';
          }).join('');
        }
        // Top processes
        var procEl = document.getElementById('metrics-top-procs');
        if (procEl && d.topProcesses) {
          procEl.innerHTML = d.topProcesses.slice(0, 5).map(function (p) {
            return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px"><span>' + esc(p.name || p.command || '') + '</span><span style="color:var(--text3)">' + (p.mem || p.memory || 0) + ' MB</span></div>';
          }).join('');
        }
      })
      .catch(function () {});

    // Disk usage
    fetch('/api/metrics/disk')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var disks = d.disks || [];
        if (disks.length) {
          var disk = disks[0];
          var pct = disk.percent || disk.use || 0;
          Charts.update('metrics-disk-donut', null, [{ data: [pct, 100 - pct] }]);
          var label = document.getElementById('metrics-disk-label');
          if (label) label.textContent = pct + '% used';
        }
      })
      .catch(function () {});

    // History for charts
    fetch('/api/metrics/history?type=cpu&count=' + timeRange)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.data && d.data.length) {
          var labels = d.data.map(function (_, i) { return i; });
          Charts.update('metrics-cpu-line', labels, [{ data: d.data }]);
        }
      })
      .catch(function () {});

    fetch('/api/metrics/history?type=memory&count=' + timeRange)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.data && d.data.length) {
          var labels = d.data.map(function (_, i) { return i; });
          Charts.update('metrics-mem-line', labels, [{ data: d.data }]);
        }
      })
      .catch(function () {});
  }

  window.setMetricsRange = function (points) {
    timeRange = points;
    var btns = document.querySelectorAll('.metrics-range-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = btns[i].dataset.range == points ? 'btn btn-sm btn-primary metrics-range-btn' : 'btn btn-sm metrics-range-btn';
    }
    fetchMetrics();
  };

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
