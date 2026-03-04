/**
 * Chester Dev Monitor v2.0 — Docker View
 * Containers grid, images table, start/stop/restart/logs/stats actions
 */
(function () {
  'use strict';

  Views.docker = {
    init: function () {
      var el = document.getElementById('view-docker');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header">' +
          '<div class="section-title">Docker</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-sm" onclick="loadAdapterContainers()">Refresh</button>' +
          '</div>' +
        '</div>' +
        '<div id="docker-containers">' +
          '<div class="empty-state"><div class="empty-state-text">Loading containers...</div></div>' +
        '</div>' +
        '<div id="docker-images"></div>';
    },

    show: function () {
      loadContainers();
      loadImages();
    },

    hide: function () {},

    update: function () {}
  };

  function loadContainers() {
    var el = document.getElementById('docker-containers');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading containers...</div>';
    fetch('/adapter/docker/containers')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded || d.error) { el.innerHTML = degradedMsg(d.error); return; }
        var containers = Array.isArray(d) ? d : d.containers || [];
        if (!containers.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No containers found</div></div>'; return; }
        el.innerHTML = '<div class="card-grid">' + containers.map(function (c) {
          var running = c.State === 'running' || c.status === 'running';
          var dotClass = running ? 'dot-healthy' : 'dot-unhealthy';
          var name = (c.Names && c.Names[0]) || c.name || c.Id || '--';
          name = name.replace(/^\//, '');
          var id = c.Id || c.id || '';
          return '<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
            '<span class="dot ' + dotClass + '"></span><strong>' + esc(name) + '</strong></div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px">' + esc(c.Image || c.image || '') + '</div>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
            (running
              ? '<button class="btn btn-sm" onclick="dockerAction(\'' + id + '\',\'stop\')">Stop</button><button class="btn btn-sm" onclick="dockerAction(\'' + id + '\',\'restart\')">Restart</button>'
              : '<button class="btn btn-sm btn-primary" onclick="dockerAction(\'' + id + '\',\'start\')">Start</button>') +
            '<button class="btn btn-sm" onclick="dockerLogs(\'' + id + '\',\'' + esc(name) + '\')">Logs</button>' +
            '<button class="btn btn-sm" onclick="dockerStats(\'' + id + '\',\'' + esc(name) + '\')">Stats</button>' +
            '</div></div>';
        }).join('') + '</div>';
      })
      .catch(function (e) { el.innerHTML = degradedMsg(e.message); });
  }

  function loadImages() {
    var el = document.getElementById('docker-images');
    if (!el) return;
    fetch('/adapter/docker/images')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded || d.error) { el.innerHTML = ''; return; }
        var images = Array.isArray(d) ? d : d.images || [];
        if (!images.length) { el.innerHTML = ''; return; }
        el.innerHTML = '<div class="section-title" style="margin-top:20px">Images</div>' +
          '<div class="table-wrap"><table><thead><tr><th>Repository</th><th>Tag</th><th>Size</th><th>Created</th></tr></thead><tbody>' +
          images.map(function (img) {
            var tags = img.RepoTags || [img.tag || 'none'];
            var parts = (tags[0] || '').split(':');
            return '<tr><td>' + esc(parts[0]) + '</td><td>' + esc(parts[1] || 'latest') + '</td>' +
              '<td>' + formatSize(img.Size || img.size || 0) + '</td>' +
              '<td style="color:var(--text-tertiary)">' + (img.Created ? new Date(img.Created * 1000).toLocaleDateString() : '--') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function () { el.innerHTML = ''; });
  }

  window.dockerAction = function (id, action) {
    Toast.info(action + 'ing container...');
    fetch('/adapter/docker/containers/' + id + '/' + action, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Container ' + action + 'ed');
        setTimeout(loadContainers, 1000);
      })
      .catch(function () { Toast.error('Failed to ' + action + ' container'); });
  };

  window.dockerLogs = function (id, name) {
    var overlay = Modal.open({ title: 'Logs: ' + name, size: 'xl', body: '<div style="color:var(--text-tertiary)">Loading...</div>' });
    fetch('/adapter/docker/containers/' + id + '/logs?tail=200')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var body = overlay.querySelector('.modal-body');
        if (!body) return;
        var logs = d.logs || d.stdout || (typeof d === 'string' ? d : JSON.stringify(d));
        body.innerHTML = '<pre style="background:#000;color:var(--text-secondary);padding:12px;border-radius:6px;max-height:60vh;overflow:auto;font-size:11px;white-space:pre-wrap">' + esc(logs) + '</pre>';
      })
      .catch(function (e) {
        var body = overlay.querySelector('.modal-body');
        if (body) body.innerHTML = '<div style="color:var(--orange)">Error: ' + esc(e.message) + '</div>';
      });
  };

  window.dockerStats = function (id, name) {
    var overlay = Modal.open({ title: 'Stats: ' + name, size: 'lg', body: '<div style="color:var(--text-tertiary)">Loading...</div>' });
    fetch('/adapter/docker/containers/' + id + '/stats')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var body = overlay.querySelector('.modal-body');
        if (!body) return;
        body.innerHTML = '<div class="card-grid">' +
          '<div class="card"><div class="card-title">CPU</div><div class="card-value">' + ((d.cpu_percent || d.cpu || 0).toFixed ? (d.cpu_percent || d.cpu || 0).toFixed(1) : '0') + '%</div></div>' +
          '<div class="card"><div class="card-title">Memory</div><div class="card-value">' + formatSize(d.memory_usage || d.mem || 0) + '</div></div>' +
          '</div><pre style="margin-top:12px;font-size:10px;color:var(--text-tertiary);white-space:pre-wrap">' + esc(JSON.stringify(d, null, 2)) + '</pre>';
      })
      .catch(function (e) {
        var body = overlay.querySelector('.modal-body');
        if (body) body.innerHTML = '<div style="color:var(--orange)">Error: ' + esc(e.message) + '</div>';
      });
  };

  window.loadAdapterContainers = function () { loadContainers(); };

  function degradedMsg(err) {
    return '<div class="card" style="text-align:center;padding:32px"><div style="color:var(--orange);font-weight:600;margin-bottom:4px">Adapter Not Connected</div>' +
      '<div style="color:var(--text-tertiary);font-size:11px">' + esc(err || 'Server panel adapter is not running or unreachable') + '</div></div>';
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    var k = 1024; var s = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
