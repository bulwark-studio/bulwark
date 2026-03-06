/**
 * Bulwark v2.1 — FTP Management View
 * Service status toggle, user management, active sessions
 */
(function () {
  'use strict';

  Views.ftp = {
    init: function () {
      var container = document.getElementById('view-ftp');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div>' +
              '<h3 style="margin:0;color:var(--text-primary);font-size:16px;font-weight:600">FTP Management</h3>' +
              '<p style="margin:4px 0 0;color:var(--text-tertiary);font-size:12px">Service control, user accounts & active sessions</p>' +
            '</div>' +
          '</div>' +
          '<div id="ftp-status"></div>' +
          '<div id="ftp-users"></div>' +
          '<div id="ftp-sessions"></div>';
      }
    },
    show: function () { loadFtpStatus(); loadFtpUsers(); loadFtpSessions(); },
    hide: function () {},
    update: function () {}
  };

  function loadFtpStatus() {
    var el = document.getElementById('ftp-status');
    if (!el) return;
    fetch('/adapter/ftp/status')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded) { el.innerHTML = degraded(d.error); return; }
        var running = d.running || d.status === 'running' || d.active;
        el.innerHTML = '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div><div class="card-title">FTP Service</div>' +
          '<div style="margin-top:4px"><span class="dot ' + (running ? 'dot-healthy' : 'dot-unhealthy') + '" style="width:10px;height:10px;vertical-align:middle"></span> ' +
          '<span style="color:' + (running ? 'var(--cyan)' : 'var(--orange)') + '">' + (running ? 'Running' : 'Stopped') + '</span></div></div>' +
          '<button class="btn btn-sm ' + (running ? 'btn-danger' : 'btn-primary') + '" onclick="toggleFtp()">' + (running ? 'Stop' : 'Start') + '</button>' +
          '</div></div>';
      })
      .catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  function loadFtpUsers() {
    var el = document.getElementById('ftp-users');
    if (!el) return;
    fetch('/adapter/ftp/users')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded) { el.innerHTML = ''; return; }
        var users = Array.isArray(d) ? d : d.users || [];
        el.innerHTML = '<div class="section-title" style="margin-top:16px">FTP Users</div>' +
          '<button class="btn btn-sm btn-primary" style="margin-bottom:12px" onclick="createFtpUser()">Create User</button>' +
          (users.length
            ? '<div class="table-wrap"><table><thead><tr><th>Username</th><th>Home Dir</th><th>Permissions</th><th>Actions</th></tr></thead><tbody>' +
              users.map(function (u) {
                return '<tr><td>' + esc(u.username || u.name || '') + '</td><td style="font-family:monospace;font-size:11px">' + esc(u.homeDir || u.home || '') + '</td>' +
                  '<td>' + esc(u.permissions || u.perms || '--') + '</td>' +
                  '<td><button class="btn btn-sm btn-danger" onclick="deleteFtpUser(\'' + esc(u.username || u.name) + '\')">Delete</button></td></tr>';
              }).join('') + '</tbody></table></div>'
            : '<div class="empty-state"><div class="empty-state-text">No FTP users</div></div>');
      })
      .catch(function () { el.innerHTML = ''; });
  }

  function loadFtpSessions() {
    var el = document.getElementById('ftp-sessions');
    if (!el) return;
    fetch('/adapter/ftp/sessions')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded) { el.innerHTML = ''; return; }
        var sessions = Array.isArray(d) ? d : d.sessions || [];
        if (!sessions.length) { el.innerHTML = '<div class="section-title" style="margin-top:16px">Active Sessions</div><div class="empty-state"><div class="empty-state-text">No active sessions</div></div>'; return; }
        el.innerHTML = '<div class="section-title" style="margin-top:16px">Active Sessions</div>' +
          '<div class="table-wrap"><table><thead><tr><th>User</th><th>IP</th><th>Connected</th></tr></thead><tbody>' +
          sessions.map(function (s) {
            return '<tr><td>' + esc(s.user || '') + '</td><td>' + esc(s.ip || '') + '</td><td>' + esc(s.since || s.connected || '') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function () { el.innerHTML = ''; });
  }

  window.toggleFtp = function () {
    Toast.info('Toggling FTP service...');
    fetch('/adapter/ftp/toggle', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function () { Toast.success('FTP toggled'); loadFtpStatus(); })
      .catch(function () { Toast.error('Failed'); });
  };

  window.createFtpUser = function () {
    Modal.open({
      title: 'Create FTP User', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Username</label><input id="ftp-user" class="form-input" placeholder="ftpuser"></div>' +
        '<div class="form-group"><label class="form-label">Password</label><input id="ftp-pass" class="form-input" type="password" placeholder="password"></div>' +
        '<div class="form-group"><label class="form-label">Home Directory</label><input id="ftp-home" class="form-input" placeholder="/home/ftpuser"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="ftp-create-btn">Create</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('ftp-create-btn');
      if (btn) btn.onclick = function () {
        var username = (document.getElementById('ftp-user') || {}).value;
        var password = (document.getElementById('ftp-pass') || {}).value;
        var homeDir = (document.getElementById('ftp-home') || {}).value;
        if (!username || !password) { Toast.warning('Username and password required'); return; }
        fetch('/adapter/ftp/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, password: password, homeDir: homeDir }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('User created'); Modal.close(btn.closest('.modal-overlay')); loadFtpUsers();
          })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.deleteFtpUser = function (name) {
    Modal.confirm({ title: 'Delete FTP User', message: 'Delete user "' + name + '"?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/adapter/ftp/users/' + encodeURIComponent(name), { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadFtpUsers(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  function degraded(err) {
    return '<div class="card" style="text-align:center;padding:32px"><div style="color:var(--orange);font-weight:600;margin-bottom:4px">Adapter Not Connected</div>' +
      '<div style="color:var(--text-tertiary);font-size:11px">' + esc(err || 'FTP adapter unavailable') + '</div></div>';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
