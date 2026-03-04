/**
 * Chester Dev Monitor v2.0 — Uptime Tracking View
 * Endpoint rows with status, uptime %, latency, 90-entry bar, add/delete
 */
(function () {
  'use strict';

  Views.uptime = {
    init: function () {
      var container = document.getElementById('view-uptime');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5)">' +
            '<div>' +
              '<div class="card-title" style="font-size:var(--font-size-lg)">Uptime Monitoring</div>' +
              '<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:var(--space-1)">Track endpoint health, latency, and availability</div>' +
            '</div>' +
            '<button class="btn btn-sm btn-primary" onclick="addEndpoint()">+ Add Endpoint</button>' +
          '</div>' +
          '<div class="card">' +
            '<div id="uptime-content"><div class="empty-state"><div class="empty-state-text">Loading uptime data...</div></div></div>' +
          '</div>';
      }
    },
    show: function () { loadUptime(); },
    hide: function () {},
    update: function () {}
  };

  function loadUptime() {
    var el = document.getElementById('uptime-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text3)">Loading uptime data...</div>';
    fetch('/api/uptime')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var endpoints = d.endpoints || [];
        if (!endpoints.length) {
          el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No endpoints configured</div></div>';
          return;
        }
        el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Status</th><th>Name</th><th>URL</th><th>24h</th><th>7d</th><th>30d</th><th>Avg Latency</th><th>History (90 checks)</th><th>Actions</th></tr></thead><tbody>' +
          endpoints.map(function (ep) {
            var healthy = ep.uptime24h > 95;
            var dotClass = healthy ? 'dot-healthy' : ep.uptime24h > 50 ? 'dot-unhealthy' : 'dot-idle';
            var bar = renderBar(ep.recentChecks || []);
            var avgLatency = calcAvgLatency(ep.recentChecks || []);
            return '<tr><td><span class="dot ' + dotClass + '" style="width:8px;height:8px"></span></td>' +
              '<td style="font-weight:600">' + esc(ep.name) + '</td>' +
              '<td style="font-size:11px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(ep.url) + '</td>' +
              '<td style="color:' + pctColor(ep.uptime24h) + '">' + fmtPct(ep.uptime24h) + '</td>' +
              '<td style="color:' + pctColor(ep.uptime7d) + '">' + fmtPct(ep.uptime7d) + '</td>' +
              '<td style="color:' + pctColor(ep.uptime30d) + '">' + fmtPct(ep.uptime30d) + '</td>' +
              '<td>' + avgLatency + 'ms</td>' +
              '<td><div style="display:flex;gap:1px;align-items:center;height:16px">' + bar + '</div></td>' +
              '<td><button class="btn btn-sm btn-danger" onclick="deleteEndpoint(\'' + esc(ep.id) + '\')">Del</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function () { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load uptime data</div></div>'; });
  }

  function renderBar(checks) {
    if (!checks || !checks.length) return '<span style="color:var(--text3);font-size:10px">No data</span>';
    // Take last 90
    var recent = checks.slice(-90);
    return recent.map(function (c) {
      var up = c.status === 'up' || c.statusCode === 200 || c.success;
      var color = up ? 'var(--cyan)' : 'var(--orange)';
      return '<div style="width:3px;height:' + (up ? '14px' : '14px') + ';background:' + color + ';border-radius:1px" title="' + (c.latency || 0) + 'ms"></div>';
    }).join('');
  }

  function calcAvgLatency(checks) {
    if (!checks || !checks.length) return 0;
    var sum = 0; var count = 0;
    checks.forEach(function (c) {
      if (c.latency > 0) { sum += c.latency; count++; }
    });
    return count ? Math.round(sum / count) : 0;
  }

  function pctColor(pct) {
    if (pct >= 99) return 'var(--cyan)';
    if (pct >= 95) return 'var(--yellow)';
    return 'var(--orange)';
  }

  function fmtPct(pct) {
    return typeof pct === 'number' ? pct.toFixed(2) + '%' : '--';
  }

  window.addEndpoint = function () {
    Modal.open({
      title: 'Add Endpoint', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Name</label><input id="up-name" class="form-input" placeholder="My API"></div>' +
        '<div class="form-group"><label class="form-label">URL</label><input id="up-url" class="form-input" placeholder="https://api.example.com/health"></div>' +
        '<div class="form-group"><label class="form-label">Check Interval (seconds)</label><input id="up-interval" class="form-input" type="number" value="60"></div>' +
        '<div class="form-group"><label class="form-label">Expected Status</label><input id="up-status" class="form-input" type="number" value="200"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="up-save">Add</button>'
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
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Endpoint added'); Modal.close(btn.closest('.modal-overlay')); loadUptime();
          })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.deleteEndpoint = function (id) {
    Modal.confirm({ title: 'Delete Endpoint', message: 'Delete this uptime endpoint?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/uptime/endpoints/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadUptime(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
