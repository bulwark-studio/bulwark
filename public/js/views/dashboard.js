/**
 * Chester Dev Monitor v2.0 — Dashboard View
 * Metric cards, server health, activity feed, PM2 summary, quick actions
 */
(function () {
  'use strict';

  var cpuChart = null;
  var memChart = null;

  Views.dashboard = {
    init: function () {
      var container = document.getElementById('view-dashboard');
      if (container) {
        container.innerHTML =
          /* ── Metric Cards Row ── */
          '<div class="grid-4" style="margin-bottom:var(--space-5)">' +
            /* CPU */
            '<div class="card metric-card" id="dash-cpu">' +
              '<div class="card-header"><span class="card-title">CPU</span><span class="badge badge-cyan">LIVE</span></div>' +
              '<div class="metric-value">--</div>' +
              '<div class="progress" style="margin:var(--space-2) 0"><div class="progress-bar cyan" style="width:0%"></div></div>' +
              '<canvas id="cpu-spark" height="40"></canvas>' +
            '</div>' +
            /* Memory */
            '<div class="card metric-card" id="dash-mem">' +
              '<div class="card-header"><span class="card-title">Memory</span><span class="badge badge-purple">LIVE</span></div>' +
              '<div class="metric-value">--</div>' +
              '<div class="card-sub" style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-bottom:var(--space-1)">-- / --</div>' +
              '<div class="progress" style="margin:var(--space-2) 0"><div class="progress-bar purple" style="width:0%"></div></div>' +
              '<canvas id="mem-spark" height="40"></canvas>' +
            '</div>' +
            /* Disk */
            '<div class="card metric-card" id="dash-disk">' +
              '<div class="card-header"><span class="card-title">Disk</span></div>' +
              '<div class="metric-value">--</div>' +
              '<div class="progress" style="margin:var(--space-2) 0"><div class="progress-bar cyan" style="width:0%"></div></div>' +
            '</div>' +
            /* Network */
            '<div class="card metric-card" id="dash-net">' +
              '<div class="card-header"><span class="card-title">Network</span></div>' +
              '<div class="metric-value">-- / --</div>' +
            '</div>' +
          '</div>' +
          /* ── Bottom Sections ── */
          '<div class="grid-2">' +
            /* Activity Feed */
            '<div class="card">' +
              '<div class="card-header">' +
                '<span class="card-title">Activity Feed</span>' +
                '<span class="badge badge-cyan" id="dash-ticket-count">0</span>' +
              '</div>' +
              '<div id="dash-activity"><div class="empty-state"><div class="empty-state-text">No recent activity</div></div></div>' +
            '</div>' +
            /* PM2 + Servers */
            '<div style="display:flex;flex-direction:column;gap:var(--space-5)">' +
              '<div class="card">' +
                '<div class="card-header"><span class="card-title">PM2 Processes</span></div>' +
                '<div id="dash-pm2"><div class="empty-state"><div class="empty-state-text">No PM2 processes</div></div></div>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-header"><span class="card-title">Server Health</span></div>' +
                '<div id="dash-servers"><div class="empty-state"><div class="empty-state-text">No servers configured</div></div></div>' +
              '</div>' +
            '</div>' +
          '</div>';
      }

      cpuChart = Charts.create('cpu-spark', 'line', {
        data: { labels: [], datasets: [Object.assign({ data: [], label: 'CPU' }, Charts.defaultLineConfig(Charts.colors.cyan))] },
        options: { scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
      });
      memChart = Charts.create('mem-spark', 'line', {
        data: { labels: [], datasets: [Object.assign({ data: [], label: 'Mem' }, Charts.defaultLineConfig(Charts.colors.purple))] },
        options: { scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
      });
    },

    show: function () {
      fetch('/api/system').then(function (r) { return r.json(); }).then(function (d) {
        Views.dashboard.update({ system: d });
      }).catch(function () {});
      fetch('/api/activity').then(function (r) { return r.json(); }).then(function (d) {
        Views.dashboard.renderActivity(d.activity || []);
      }).catch(function () {});
      fetch('/api/processes').then(function (r) { return r.json(); }).then(function (d) {
        Views.dashboard.renderProcesses(d.processes || []);
      }).catch(function () {});
      fetch('/api/servers').then(function (r) { return r.json(); }).then(function (d) {
        Views.dashboard.renderServers(d.servers || []);
      }).catch(function () {});
      fetch('/api/tickets').then(function (r) { return r.json(); }).then(function (d) {
        var el = document.getElementById('dash-ticket-count');
        if (el) el.textContent = (d.tickets || []).length;
      }).catch(function () {});
    },

    hide: function () {},

    update: function (data) {
      if (data && data.system) {
        var s = data.system;
        var cpuEl = document.getElementById('dash-cpu');
        var memEl = document.getElementById('dash-mem');
        var diskEl = document.getElementById('dash-disk');
        var netEl = document.getElementById('dash-net');
        if (cpuEl) {
          var cpuVal = s.cpuPct || (typeof s.cpu === 'number' ? s.cpu : 0);
          var valEl = cpuEl.querySelector('.metric-value');
          if (valEl) animateValue(valEl, cpuVal, 400);
          var bar = cpuEl.querySelector('.progress-bar');
          if (bar) bar.style.width = cpuVal + '%';
          if (cpuChart) Charts.appendPoint('cpu-spark', '', cpuVal, 30);
        }
        if (memEl) {
          var memPct = s.usedMemPct || s.memPct || 0;
          var memValEl = memEl.querySelector('.metric-value');
          if (memValEl) animateValue(memValEl, memPct, 400);
          var sub = memEl.querySelector('.card-sub');
          if (sub) sub.textContent = (s.usedMemMB || 0) + ' MB / ' + (s.totalMemMB || 0) + ' MB';
          var mBar = memEl.querySelector('.progress-bar');
          if (mBar) mBar.style.width = memPct + '%';
          if (memChart) Charts.appendPoint('mem-spark', '', memPct, 30);
        }
        if (diskEl) {
          var diskPct = s.diskPct || (s.disk && s.disk.percent) || 0;
          var dValEl = diskEl.querySelector('.metric-value');
          if (dValEl && diskPct) dValEl.textContent = diskPct.toFixed ? diskPct.toFixed(1) + '%' : diskPct + '%';
          var dBar = diskEl.querySelector('.progress-bar');
          if (dBar) dBar.style.width = diskPct + '%';
        }
        if (netEl) {
          var netValEl = netEl.querySelector('.metric-value');
          if (netValEl) netValEl.textContent = (s.nodeVersion || 'Node') + ' | ' + (s.cpuCount || 0) + ' cores';
        }
      }
      if (data && data.activity) this.renderActivity(data.activity);
      if (data && data.processes) this.renderProcesses(data.processes);
      if (data && data.servers) this.renderServers(data.servers);
    },

    renderActivity: function (items) {
      var el = document.getElementById('dash-activity');
      if (!el) return;
      if (!items || !items.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No recent activity</div></div>'; return; }
      el.innerHTML = items.slice(0, 10).map(function (a) {
        var time = a.created_at ? new Date(a.created_at).toLocaleTimeString() : '';
        return '<div class="activity-item"><div class="activity-dot" style="background:var(--cyan)"></div><div class="desc">' +
          escapeHtml(a.title || a.type || '') + '</div><div class="time">' + time + '</div></div>';
      }).join('');
    },

    renderProcesses: function (procs) {
      var el = document.getElementById('dash-pm2');
      if (!el) return;
      if (!procs || !procs.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No PM2 processes</div></div>'; return; }
      el.innerHTML = procs.map(function (p) {
        var color = p.status === 'online' ? 'var(--cyan)' : 'var(--orange)';
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
          '<span class="dot" style="background:' + color + ';width:8px;height:8px"></span>' +
          '<span style="flex:1">' + escapeHtml(p.name) + '</span>' +
          '<span style="color:var(--text-tertiary);font-size:11px">' + (p.cpu || 0) + '% / ' + (p.memory || 0) + 'MB</span></div>';
      }).join('');
    },

    renderServers: function (servers) {
      var el = document.getElementById('dash-servers');
      if (!el) return;
      if (!servers || !servers.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No servers configured</div></div>'; return; }
      el.innerHTML = servers.map(function (s) {
        var dotClass = s.status === 'healthy' ? 'dot-healthy' : s.status === 'unhealthy' ? 'dot-unhealthy' : 'dot-idle';
        return '<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px">' +
          '<span class="dot ' + dotClass + '"></span>' +
          '<div style="flex:1"><div style="font-weight:600">' + escapeHtml(s.name) + '</div>' +
          '<div style="font-size:11px;color:var(--text-tertiary)">' + escapeHtml(s.host || '') + '</div></div>' +
          '<span class="badge badge-' + (s.provider === 'aws' ? 'orange' : 'cyan') + '">' + escapeHtml(s.provider || 'local') + '</span></div>';
      }).join('');
    }
  };

  function formatBytes(b) {
    if (b === 0) return '0 B';
    var k = 1024; var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
