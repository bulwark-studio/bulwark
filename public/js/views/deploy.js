/**
 * Chester Dev Monitor v2.0 — Deploy View
 * Git pull/push, deployment history
 */
(function () {
  'use strict';

  Views.deploy = {
    init: function () {
      var container = document.getElementById('view-deploy');
      if (container) {
        container.innerHTML =
          '<div class="card" style="padding:16px;margin-bottom:16px">' +
            '<div style="font-weight:600;color:var(--text-primary);margin-bottom:12px">Deploy Actions</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button class="btn btn-sm btn-cyan" onclick="gitPull()">Git Pull</button>' +
              '<button class="btn btn-sm btn-orange" onclick="triggerVPSDeploy()">Deploy to VPS</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.deploy.show()">Refresh</button>' +
            '</div>' +
          '</div>' +
          '<div class="card" style="padding:16px">' +
            '<div style="font-weight:600;color:var(--text-primary);margin-bottom:12px">Deployment History</div>' +
            '<div id="deploy-history">' +
              '<div style="color:var(--text-tertiary)">Loading...</div>' +
            '</div>' +
          '</div>';
      }
    },

    show: function () {
      fetch('/api/activity').then(function (r) { return r.json(); }).then(function (d) {
        var items = (d.activity || []).filter(function (a) {
          return a.type && (a.type.indexOf('deploy') !== -1 || a.type.indexOf('approved') !== -1 || a.type === 'git_push' || a.type === 'git_pull');
        });
        renderHistory(items);
      }).catch(function () { renderHistory([]); });
    },

    hide: function () {},

    update: function () {}
  };

  function renderHistory(items) {
    var el = document.getElementById('deploy-history');
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No deployment activity yet</div></div>';
      return;
    }
    el.innerHTML = items.slice(0, 20).map(function (a) {
      var time = a.created_at ? new Date(a.created_at).toLocaleString() : '';
      var dotColor = a.type.indexOf('approved') !== -1 ? 'var(--cyan)' : 'var(--purple)';
      return '<div class="activity-item">' +
        '<div class="activity-dot" style="background:' + dotColor + '"></div>' +
        '<div class="desc">' + esc(a.title || a.type) + '</div>' +
        '<div class="time">' + time + '</div></div>';
    }).join('');
  }

  window.triggerVPSDeploy = function () {
    Toast.info('VPS deploy trigger coming soon');
  };

  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
