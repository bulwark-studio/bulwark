/**
 * Chester Dev Monitor v2.0 — PM2 Processes View
 * Process table with status, CPU, memory, uptime, actions
 */
(function () {
  'use strict';

  Views.pm2 = {
    init: function () {
      var el = document.getElementById('view-pm2');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header">' +
          '<div class="section-title">PM2 Processes</div>' +
          '<button class="btn btn-sm" onclick="fetchProcesses()">Refresh</button>' +
        '</div>' +
        '<div class="table-wrapper">' +
          '<table class="table">' +
            '<thead><tr>' +
              '<th>Name</th><th>Status</th><th>CPU</th><th>Memory</th>' +
              '<th>Uptime</th><th>Restarts</th><th>PID</th><th>Actions</th>' +
            '</tr></thead>' +
            '<tbody id="pm2-table">' +
              '<tr><td colspan="8" style="text-align:center;color:var(--text-tertiary)">Loading processes...</td></tr>' +
            '</tbody>' +
          '</table>' +
        '</div>';
    },

    show: function () {
      fetchProcesses();
    },

    hide: function () {},

    update: function (data) {
      if (data && data.processes) renderProcesses(data.processes);
    }
  };

  window.fetchProcesses = function () {
    fetch('/api/processes').then(function (r) { return r.json(); }).then(function (d) {
      renderProcesses(d.processes || []);
    }).catch(function () { renderProcesses([]); });
  };

  function renderProcesses(procs) {
    var tbody = document.getElementById('pm2-table');
    if (!tbody) return;
    if (!procs.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3)">No PM2 processes found</td></tr>';
      return;
    }
    tbody.innerHTML = procs.map(function (p) {
      var statusColor = p.status === 'online' ? 'var(--cyan)' : 'var(--orange)';
      var uptime = p.uptime ? formatUptime(p.uptime) : '--';
      return '<tr>' +
        '<td style="font-weight:600">' + esc(p.name) + '</td>' +
        '<td><span class="proc-status" style="background:' + statusColor + '"></span>' + esc(p.status || 'unknown') + '</td>' +
        '<td>' + (p.cpu || 0) + '%</td>' +
        '<td>' + (p.memory || 0) + ' MB</td>' +
        '<td>' + uptime + '</td>' +
        '<td>' + (p.restarts || 0) + '</td>' +
        '<td style="color:var(--text3)">' + (p.pid || '--') + '</td>' +
        '<td><div style="display:flex;gap:4px">' +
          '<button class="btn btn-sm" onclick="pm2Action(\'restart\',\'' + esc(p.name) + '\')">Restart</button>' +
          '<button class="btn btn-sm" onclick="pm2Action(\'stop\',\'' + esc(p.name) + '\')">Stop</button>' +
          '<button class="btn btn-sm btn-danger" onclick="pm2Delete(\'' + esc(p.name) + '\')">Delete</button>' +
        '</div></td></tr>';
    }).join('');
  }

  window.pm2Action = function (action, name) {
    Toast.info(action + 'ing ' + name + '...');
    fetch('/api/pm2/' + action + '/' + encodeURIComponent(name), { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success(name + ' ' + action + 'ed');
        setTimeout(fetchProcesses, 1000);
      })
      .catch(function () { Toast.error('Failed to ' + action + ' ' + name); });
  };

  window.pm2Delete = function (name) {
    Modal.confirm({ title: 'Delete Process', message: 'Delete PM2 process "' + name + '"?', confirmText: 'Delete', dangerous: true })
      .then(function (ok) {
        if (!ok) return;
        pm2Action('delete', name);
      });
  };

  function formatUptime(ts) {
    var diff = Date.now() - ts;
    if (diff < 0) return '--';
    var s = Math.floor(diff / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60); s = s % 60;
    if (m < 60) return m + 'm ' + s + 's';
    var h = Math.floor(m / 60); m = m % 60;
    if (h < 24) return h + 'h ' + m + 'm';
    var d = Math.floor(h / 24); h = h % 24;
    return d + 'd ' + h + 'h';
  }

  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
