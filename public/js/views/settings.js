/**
 * Chester Dev Monitor v2.0 — Settings View
 * My Account, 2FA, User Management
 */
(function () {
  'use strict';

  Views.settings = {
    init: function () {
      var container = document.getElementById('view-settings');
      if (container) {
        container.innerHTML =
          '<div style="margin-bottom:16px">' +
            '<h3 style="margin:0;color:var(--text-primary);font-size:16px;font-weight:600">Settings</h3>' +
            '<p style="margin:4px 0 0;color:var(--text-tertiary);font-size:12px">Account, security & user management</p>' +
          '</div>' +
          /* My Account */
          '<div class="card" style="margin-bottom:16px">' +
            '<div class="card-title" style="margin-bottom:12px">My Account</div>' +
            '<div id="my-account"><div style="color:var(--text-tertiary);font-size:12px">Loading...</div></div>' +
          '</div>' +
          /* Two-Factor Authentication */
          '<div class="card" style="margin-bottom:16px">' +
            '<div class="card-title" style="margin-bottom:12px">Two-Factor Authentication</div>' +
            '<div id="my-2fa"><div style="color:var(--text-tertiary);font-size:12px">Loading...</div></div>' +
          '</div>' +
          /* User Management */
          '<div class="card">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
              '<div class="card-title">User Management</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">' +
              '<div class="form-group" style="margin:0;flex:1;min-width:120px">' +
                '<label class="form-label" style="font-size:11px">Username</label>' +
                '<input id="new-username" class="form-input" placeholder="username">' +
              '</div>' +
              '<div class="form-group" style="margin:0;flex:1;min-width:120px">' +
                '<label class="form-label" style="font-size:11px">Password</label>' +
                '<input id="new-password" class="form-input" type="password" placeholder="password">' +
              '</div>' +
              '<div class="form-group" style="margin:0;min-width:100px">' +
                '<label class="form-label" style="font-size:11px">Role</label>' +
                '<select id="new-role" class="form-input">' +
                  '<option value="viewer">Viewer</option>' +
                  '<option value="admin">Admin</option>' +
                '</select>' +
              '</div>' +
              '<button class="btn btn-sm btn-cyan" onclick="createUser()" style="height:34px">Add User</button>' +
            '</div>' +
            '<div class="table-wrap"><table>' +
              '<thead><tr><th>Username</th><th>Role</th><th>2FA</th><th>Created</th><th>Actions</th></tr></thead>' +
              '<tbody id="users-table"></tbody>' +
            '</table></div>' +
          '</div>';
      }
    },

    show: function () {
      loadMyAccount();
      loadUsers();
    },

    hide: function () {},

    update: function () {}
  };

  function loadMyAccount() {
    fetch('/api/me').then(function (r) { return r.json(); }).then(function (u) {
      var el = document.getElementById('my-account');
      if (!el) return;
      el.innerHTML = '<div style="margin-bottom:8px"><strong>Username:</strong> ' + esc(u.username) + '</div>' +
        '<div style="margin-bottom:8px"><strong>Role:</strong> <span class="badge badge-cyan">' + esc(u.role) + '</span></div>' +
        '<button class="btn btn-sm" onclick="changePasswordModal(\'' + u.id + '\')">Change Password</button>';

      var tfaEl = document.getElementById('my-2fa');
      if (tfaEl) {
        var tfaStatus = u.totp_enabled ? '<span style="color:var(--cyan)">Enabled</span>' : '<span style="color:var(--orange)">Disabled</span>';
        tfaEl.innerHTML = '<div style="margin-bottom:8px">Status: ' + tfaStatus + '</div>' +
          (u.totp_enabled
            ? '<button class="btn btn-sm btn-danger" onclick="disable2FA(\'' + u.id + '\')">Disable 2FA</button>'
            : '<button class="btn btn-sm btn-primary" onclick="setup2FA(\'' + u.id + '\')">Enable 2FA</button>');
      }
    }).catch(function () {});
  }

  function loadUsers() {
    fetch('/api/users').then(function (r) { return r.json(); }).then(function (d) {
      var tbody = document.getElementById('users-table');
      if (!tbody) return;
      var users = d.users || [];
      tbody.innerHTML = users.map(function (u) {
        return '<tr><td>' + esc(u.username) + '</td><td><span class="badge badge-cyan">' + esc(u.role) + '</span></td>' +
          '<td>' + (u.totp_enabled ? '<span style="color:var(--cyan)">Yes</span>' : '<span style="color:var(--text-tertiary)">No</span>') + '</td>' +
          '<td style="color:var(--text-tertiary)">' + (u.created ? new Date(u.created).toLocaleDateString() : '--') + '</td>' +
          '<td><button class="btn btn-sm btn-danger" onclick="deleteUser(\'' + u.id + '\',\'' + esc(u.username) + '\')">Delete</button></td></tr>';
      }).join('');
    }).catch(function () {});
  }

  window.changePasswordModal = function (userId) {
    Modal.open({
      title: 'Change Password', size: 'sm',
      body: '<div class="form-group"><label class="form-label">New Password</label>' +
        '<input type="password" id="new-pass-input" class="form-input" placeholder="Min 8 characters"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" id="save-pass-btn">Save</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('save-pass-btn');
      if (btn) btn.onclick = function () {
        var pw = (document.getElementById('new-pass-input') || {}).value;
        if (!pw || pw.length < 8) { Toast.warning('Password must be at least 8 characters'); return; }
        fetch('/api/users/' + userId + '/password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (d.error) { Toast.error(d.error); return; }
          Toast.success('Password changed');
          Modal.close(btn.closest('.modal-overlay'));
        }).catch(function () { Toast.error('Failed to change password'); });
      };
    }, 50);
  };

  window.setup2FA = function (userId) {
    fetch('/api/users/' + userId + '/2fa/setup', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        Modal.open({
          title: 'Enable 2FA', size: 'sm',
          body: '<p style="margin-bottom:12px">Add this secret to your authenticator app:</p>' +
            '<div style="background:var(--canvas);padding:8px;border-radius:6px;font-family:monospace;word-break:break-all;margin-bottom:12px">' + esc(d.secret) + '</div>' +
            '<div class="form-group"><label class="form-label">Enter 6-digit code</label>' +
            '<input type="text" id="totp-verify-input" class="form-input" maxlength="6" placeholder="000000"></div>',
          footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
            '<button class="btn btn-sm btn-primary" id="verify-totp-btn">Verify & Enable</button>'
        });
        setTimeout(function () {
          var btn = document.getElementById('verify-totp-btn');
          if (btn) btn.onclick = function () {
            var code = (document.getElementById('totp-verify-input') || {}).value;
            fetch('/api/users/' + userId + '/2fa/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: code })
            }).then(function (r) { return r.json(); }).then(function (d2) {
              if (d2.error) { Toast.error(d2.error); return; }
              Toast.success('2FA enabled');
              Modal.close(btn.closest('.modal-overlay'));
              loadMyAccount();
            }).catch(function () { Toast.error('Verification failed'); });
          };
        }, 50);
      })
      .catch(function () { Toast.error('Failed to setup 2FA'); });
  };

  window.disable2FA = function (userId) {
    Modal.confirm({ title: 'Disable 2FA', message: 'Are you sure you want to disable two-factor authentication?', confirmText: 'Disable', dangerous: true })
      .then(function (ok) {
        if (!ok) return;
        fetch('/api/users/' + userId + '/2fa/disable', { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function () { Toast.success('2FA disabled'); loadMyAccount(); })
          .catch(function () { Toast.error('Failed to disable 2FA'); });
      });
  };

  window.createUser = function () {
    var username = (document.getElementById('new-username') || {}).value;
    var password = (document.getElementById('new-password') || {}).value;
    var role = (document.getElementById('new-role') || {}).value;
    if (!username || !password) { Toast.warning('Username and password required'); return; }
    fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password, role: role })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { Toast.error(d.error); return; }
      Toast.success('User created');
      document.getElementById('new-username').value = '';
      document.getElementById('new-password').value = '';
      loadUsers();
    }).catch(function () { Toast.error('Failed to create user'); });
  };

  window.deleteUser = function (id, name) {
    Modal.confirm({ title: 'Delete User', message: 'Delete user "' + name + '"?', confirmText: 'Delete', dangerous: true })
      .then(function (ok) {
        if (!ok) return;
        fetch('/api/users/' + id, { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('User deleted');
            loadUsers();
          })
          .catch(function () { Toast.error('Failed to delete user'); });
      });
  };

  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
