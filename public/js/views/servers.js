/**
 * Chester Dev Monitor v2.0 — Servers View
 * Server health cards with status dots, latency, provider badge
 */
(function () {
  'use strict';

  Views.servers = {
    init: function () {
      var el = document.getElementById('view-servers');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header">' +
          '<div class="section-title">Servers</div>' +
          '<button class="btn btn-sm" onclick="refreshServers()">Refresh</button>' +
        '</div>' +
        '<div id="server-cards" class="grid-3">' +
          '<div class="empty-state"><div class="empty-state-text">Loading servers...</div></div>' +
        '</div>';
    },

    show: function () {
      fetch('/api/servers').then(function (r) { return r.json(); }).then(function (d) {
        renderServers(d.servers || []);
      }).catch(function () { renderServers([]); });
    },

    hide: function () {},

    update: function (data) {
      if (data && data.servers) renderServers(data.servers);
    }
  };

  function renderServers(servers) {
    var el = document.getElementById('server-cards');
    if (!el) return;
    if (!servers.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No servers configured</div></div>';
      return;
    }
    el.innerHTML = servers.map(function (s) {
      var dotClass = s.status === 'healthy' ? 'dot-healthy' : s.status === 'unhealthy' ? 'dot-unhealthy' : 'dot-idle';
      var latencyText = s.latency >= 0 ? s.latency + 'ms' : '--';
      var providerBadge = s.provider ? '<span class="badge badge-' + providerColor(s.provider) + '">' + esc(s.provider) + '</span>' : '';
      return '<div class="card server-card">' +
        '<span class="dot ' + dotClass + '" style="width:12px;height:12px"></span>' +
        '<div class="server-info"><div class="server-name">' + esc(s.name) + '</div>' +
        '<div class="server-host">' + esc(s.host || '') + '</div></div>' +
        '<div class="server-stats"><span><span class="server-stat-label">Latency</span> ' + latencyText + '</span>' +
        providerBadge + '</div></div>';
    }).join('');
  }

  function providerColor(p) {
    var m = { aws: 'orange', gcp: 'blue', local: 'cyan', fly: 'purple' };
    return m[p] || 'cyan';
  }

  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  window.refreshServers = function () {
    Toast.info('Checking servers...');
    Views.servers.show();
  };
})();
