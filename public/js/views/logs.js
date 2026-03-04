/**
 * Chester Dev Monitor v2.0 — Logs View
 * Service selector, log output area, auto-scroll
 */
(function () {
  'use strict';

  Views.logs = {
    init: function () {
      var container = document.getElementById('view-logs');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div>' +
              '<h3 style="margin:0;color:var(--text-primary);font-size:16px;font-weight:600">System Logs</h3>' +
              '<p style="margin:4px 0 0;color:var(--text-tertiary);font-size:12px">Real-time log viewer for all services</p>' +
            '</div>' +
          '</div>' +
          '<div class="card" style="margin-bottom:16px;padding:12px">' +
            '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
              '<div class="form-group" style="margin:0;flex:1;min-width:160px">' +
                '<label class="form-label" style="margin-bottom:4px;font-size:11px">Service</label>' +
                '<select id="log-service" class="form-input" onchange="fetchLogs()">' +
                  '<option value="pm2">PM2</option>' +
                  '<option value="nginx">Nginx</option>' +
                  '<option value="system">System</option>' +
                  '<option value="auth">Auth</option>' +
                  '<option value="postgres">PostgreSQL</option>' +
                  '<option value="docker">Docker</option>' +
                '</select>' +
              '</div>' +
              '<div class="form-group" style="margin:0;min-width:80px">' +
                '<label class="form-label" style="margin-bottom:4px;font-size:11px">Lines</label>' +
                '<input id="log-lines" class="form-input" type="number" value="100" min="10" max="1000" style="width:80px">' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;margin-top:18px">' +
                '<label style="display:flex;align-items:center;gap:4px;color:var(--text-tertiary);font-size:11px;cursor:pointer">' +
                  '<input type="checkbox" id="log-autoscroll" checked> Auto-scroll' +
                '</label>' +
                '<button class="btn btn-sm btn-cyan" onclick="fetchLogs()">Fetch</button>' +
                '<button class="btn btn-sm btn-ghost" onclick="clearLogs()">Clear</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<pre id="log-viewer" style="background:var(--canvas);border:1px solid var(--border);border-radius:8px;padding:16px;font-family:\'JetBrains Mono\',monospace;font-size:11px;line-height:1.6;color:var(--text-secondary);height:calc(100vh - 320px);overflow-y:auto;white-space:pre-wrap;word-break:break-all"></pre>';
      }
    },

    show: function () {
      fetchLogs();
    },

    hide: function () {},

    update: function () {}
  };

  window.clearLogs = function () {
    var viewerEl = document.getElementById('log-viewer');
    if (viewerEl) viewerEl.textContent = '';
  };

  window.fetchLogs = function () {
    var serviceEl = document.getElementById('log-service');
    var viewerEl = document.getElementById('log-viewer');
    if (!serviceEl || !viewerEl) return;
    var service = serviceEl.value;
    var linesInput = document.getElementById('log-lines');
    var lines = linesInput ? parseInt(linesInput.value) || 100 : 100;
    viewerEl.textContent = 'Loading logs for ' + service + '...';

    fetch('/api/logs/' + encodeURIComponent(service) + '?lines=' + lines)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var logLines = d.lines || [];
        if (!logLines.length) {
          viewerEl.textContent = 'No logs available for ' + service;
          return;
        }
        viewerEl.textContent = logLines.join('\n');
        var autoScroll = document.getElementById('log-autoscroll');
        if (!autoScroll || autoScroll.checked) {
          viewerEl.scrollTop = viewerEl.scrollHeight;
        }
      })
      .catch(function (e) {
        viewerEl.textContent = 'Error loading logs: ' + e.message;
      });
  };
})();
