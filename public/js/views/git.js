/**
 * Chester Dev Monitor v2.0 — Git View
 * Branch info, recent commits, file status, pull/push
 */
(function () {
  'use strict';

  Views.git = {
    init: function () {
      var container = document.getElementById('view-git');
      if (container) {
        container.innerHTML =
          '<div class="grid-2" style="margin-bottom:16px">' +
            '<div class="card" style="padding:16px">' +
              '<div style="font-size:12px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Current Branch</div>' +
              '<div id="git-branch" style="font-weight:600;font-size:18px;color:var(--cyan)">--</div>' +
            '</div>' +
            '<div class="card" style="padding:16px">' +
              '<div style="font-size:12px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Status</div>' +
              '<div id="git-status" style="font-weight:600;color:var(--text-primary)">--</div>' +
            '</div>' +
          '</div>' +
          '<div class="card" style="padding:16px;margin-bottom:16px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
              '<span style="font-weight:600;color:var(--text-primary)">Actions</span>' +
              '<div id="git-remotes" style="font-size:12px;color:var(--text-tertiary)">--</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
              '<button class="btn btn-sm btn-cyan" onclick="gitPull()">Pull</button>' +
              '<button class="btn btn-sm btn-orange" onclick="gitPush()">Push</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="fetchGit()">Refresh</button>' +
            '</div>' +
          '</div>' +
          '<div class="card" style="padding:16px">' +
            '<div style="font-weight:600;color:var(--text-primary);margin-bottom:12px">Recent Commits</div>' +
            '<ul id="git-commits" style="list-style:none;padding:0;margin:0">' +
              '<li style="color:var(--text-tertiary);padding:8px 0">Loading...</li>' +
            '</ul>' +
          '</div>';
      }
    },

    show: function () {
      fetchGit();
    },

    hide: function () {},

    update: function () {}
  };

  window.fetchGit = function () {
    fetch('/api/git').then(function (r) { return r.json(); }).then(function (d) {
      var branchEl = document.getElementById('git-branch');
      var statusEl = document.getElementById('git-status');
      var commitsEl = document.getElementById('git-commits');
      var remotesEl = document.getElementById('git-remotes');

      if (branchEl) branchEl.textContent = d.branch || '--';
      if (statusEl) statusEl.textContent = d.status || 'Clean';
      if (remotesEl) remotesEl.textContent = d.remotes || '--';

      if (commitsEl) {
        var commits = d.commits || [];
        if (!commits.length) {
          commitsEl.innerHTML = '<li style="color:var(--text-tertiary);padding:8px 0">No commits found</li>';
          return;
        }
        commitsEl.innerHTML = commits.map(function (c) {
          var parts = c.split(' ');
          var hash = parts[0] || '';
          var msg = parts.slice(1).join(' ');
          return '<li class="commit-item"><span class="commit-hash">' + esc(hash) + '</span><span class="commit-msg">' + esc(msg) + '</span></li>';
        }).join('');
      }
    }).catch(function () {
      Toast.error('Failed to load git info');
    });
  };

  window.gitPull = function () {
    Toast.info('Pulling from main...');
    fetch('/api/git/pull', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Pull complete');
        fetchGit();
      })
      .catch(function () { Toast.error('Pull failed'); });
  };

  window.gitPush = function () {
    Toast.info('Pushing current branch...');
    fetch('/api/git/push', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Pushed ' + (d.branch || 'current branch'));
      })
      .catch(function () { Toast.error('Push failed'); });
  };

  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
