/**
 * Bulwark v2.1 — Settings View
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
          /* AI Provider */
          '<div class="card" style="margin-bottom:16px">' +
            '<div class="card-title" style="margin-bottom:12px">AI Provider</div>' +
            '<div id="ai-provider-settings"><div style="color:var(--text-tertiary);font-size:12px">Loading...</div></div>' +
          '</div>' +
          /* Email (SMTP) */
          '<div class="card" style="margin-bottom:16px">' +
            '<div class="card-title" style="margin-bottom:4px">Email (SMTP)</div>' +
            '<p style="margin:0 0 12px;color:var(--text-tertiary);font-size:11px">Configure SMTP to send email alerts from Notifications</p>' +
            '<div id="smtp-settings"><div style="color:var(--text-tertiary);font-size:12px">Loading...</div></div>' +
          '</div>' +
          /* Audit Log */
          '<div class="card" style="margin-bottom:16px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
              '<div class="card-title">Audit Log</div>' +
              '<div style="display:flex;gap:6px">' +
                '<button class="btn btn-sm" onclick="exportAudit(\'json\')">Export JSON</button>' +
                '<button class="btn btn-sm" onclick="exportAudit(\'csv\')">Export CSV</button>' +
              '</div>' +
            '</div>' +
            '<div id="audit-stats" style="margin-bottom:12px"><div style="color:var(--text-tertiary);font-size:12px">Loading...</div></div>' +
            '<div class="table-wrap" style="max-height:300px;overflow-y:auto"><table>' +
              '<thead><tr><th>Time</th><th>User</th><th>Action</th><th>Result</th><th>IP</th></tr></thead>' +
              '<tbody id="audit-table"></tbody>' +
            '</table></div>' +
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
                  '<option value="editor">Editor</option>' +
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
      loadAIProvider();
      loadSmtpSettings();
      loadAuditLog();
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
        var roleSelect = isAdmin() ?
          '<select class="form-input" style="width:auto;padding:2px 6px;font-size:11px" onchange="changeUserRole(\'' + u.id + '\',this.value)">' +
            '<option value="viewer"' + (u.role === 'viewer' ? ' selected' : '') + '>Viewer</option>' +
            '<option value="editor"' + (u.role === 'editor' ? ' selected' : '') + '>Editor</option>' +
            '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
          '</select>' :
          '<span class="badge badge-cyan">' + esc(u.role) + '</span>';
        return '<tr><td>' + esc(u.username) + '</td><td>' + roleSelect + '</td>' +
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

  window.changeUserRole = function (userId, role) {
    fetch('/api/users/' + userId + '/role', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { Toast.error(d.error); loadUsers(); return; }
      Toast.success('Role updated to ' + role);
    }).catch(function () { Toast.error('Failed to change role'); loadUsers(); });
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

  function loadAIProvider() {
    Promise.all([
      fetch('/api/settings').then(function (r) { return r.json(); }),
      fetch('/api/settings/ai/detect').then(function (r) { return r.json(); }).catch(function () { return {}; })
    ]).then(function (results) {
      var settings = results[0];
      var detect = results[1];
      var el = document.getElementById('ai-provider-settings');
      if (!el) return;
      var providers = [
        { value: 'claude-cli', label: 'Claude CLI', desc: 'claude --print (requires Anthropic subscription)' },
        { value: 'codex-cli', label: 'Codex CLI', desc: 'codex (OpenAI open-source agent, requires API key)' },
        { value: 'none', label: 'None', desc: 'AI features disabled' }
      ];
      var options = providers.map(function (p) {
        var selected = settings.aiProvider === p.value ? ' selected' : '';
        var status = detect[p.value] ? (detect[p.value].installed ? ' <span style="color:var(--cyan)">installed</span>' : ' <span style="color:var(--orange)">not found</span>') : '';
        return '<option value="' + p.value + '"' + selected + '>' + p.label + '</option>';
      }).join('');
      var statusHtml = providers.filter(function (p) { return p.value !== 'none'; }).map(function (p) {
        var d = detect[p.value];
        var icon = d && d.installed ? '<span style="color:var(--cyan)">&#10003;</span>' : '<span style="color:var(--orange)">&#10007;</span>';
        var ver = d && d.version ? ' <span style="color:var(--text-tertiary);font-size:11px">(' + esc(d.version) + ')</span>' : '';
        return '<div style="margin-bottom:4px">' + icon + ' ' + p.label + ': ' + p.desc + ver + '</div>';
      }).join('');
      el.innerHTML =
        '<div style="margin-bottom:12px;font-size:12px;color:var(--text-secondary)">' + statusHtml + '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<select id="ai-provider-select" class="form-input" style="max-width:200px">' + options + '</select>' +
          '<button class="btn btn-sm btn-cyan" onclick="saveAIProvider()">Save</button>' +
        '</div>' +
        '<p style="margin-top:8px;font-size:11px;color:var(--text-tertiary)">BYOK: Users bring their own AI subscriptions. Install CLI tools on the server.</p>';
    });
  }

  window.saveAIProvider = function () {
    var provider = (document.getElementById('ai-provider-select') || {}).value;
    fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiProvider: provider })
    }).then(function (r) { return r.json(); }).then(function () {
      Toast.success('AI provider saved: ' + provider);
    }).catch(function () { Toast.error('Failed to save AI provider'); });
  };

  function loadSmtpSettings() {
    fetch('/api/settings').then(function (r) { return r.json(); }).then(function (settings) {
      var el = document.getElementById('smtp-settings');
      if (!el) return;
      var smtp = settings.smtp || {};
      var configured = !!(smtp.host && smtp.user);

      var presets = [
        { label: 'Gmail', host: 'smtp.gmail.com', port: 587, note: 'Use App Password (not your Gmail password)' },
        { label: 'Outlook/365', host: 'smtp.office365.com', port: 587, note: 'Use your Microsoft account' },
        { label: 'Custom', host: '', port: 587, note: '' }
      ];
      var presetBtns = presets.map(function (p) {
        return '<button class="btn btn-sm" onclick="smtpPreset(\'' + p.host + '\',' + p.port + ')" style="font-size:10px">' + p.label + '</button>';
      }).join('');

      el.innerHTML =
        (configured ?
          '<div style="margin-bottom:12px;padding:8px;background:rgba(34,211,238,0.08);border-radius:6px;display:flex;align-items:center;gap:8px">' +
            '<span style="color:var(--cyan)">&#9679;</span>' +
            '<span style="font-size:12px;color:var(--text-secondary)">Connected: ' + esc(smtp.host) + ':' + (smtp.port || 587) + '</span>' +
          '</div>'
        : '<div style="margin-bottom:12px;padding:8px;background:rgba(255,107,43,0.08);border-radius:6px;display:flex;align-items:center;gap:8px">' +
            '<span style="color:var(--orange)">&#9675;</span>' +
            '<span style="font-size:12px;color:var(--text-secondary)">Not configured</span>' +
          '</div>') +
        '<div style="margin-bottom:8px;display:flex;gap:4px">' +
          '<span style="font-size:11px;color:var(--text-tertiary);padding:4px 0">Presets:</span> ' + presetBtns +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
          '<div class="form-group" style="margin:0;flex:2;min-width:160px">' +
            '<label class="form-label" style="font-size:11px">SMTP Host</label>' +
            '<input id="smtp-host" class="form-input" placeholder="smtp.gmail.com" value="' + esc(smtp.host || '') + '">' +
          '</div>' +
          '<div class="form-group" style="margin:0;flex:0.5;min-width:70px">' +
            '<label class="form-label" style="font-size:11px">Port</label>' +
            '<input id="smtp-port" class="form-input" type="number" placeholder="587" value="' + (smtp.port || 587) + '">' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
          '<div class="form-group" style="margin:0;flex:1;min-width:160px">' +
            '<label class="form-label" style="font-size:11px">Username / Email</label>' +
            '<input id="smtp-user" class="form-input" placeholder="you@gmail.com" value="' + esc(smtp.user || '') + '">' +
          '</div>' +
          '<div class="form-group" style="margin:0;flex:1;min-width:160px">' +
            '<label class="form-label" style="font-size:11px">Password / App Password</label>' +
            '<input id="smtp-pass" class="form-input" type="password" placeholder="' + (configured ? '(saved)' : 'app password') + '">' +
          '</div>' +
        '</div>' +
        '<div class="form-group" style="margin:0 0 8px">' +
          '<label class="form-label" style="font-size:11px">From Address (optional)</label>' +
          '<input id="smtp-from" class="form-input" placeholder="alerts@yourdomain.com (defaults to username)" value="' + esc(smtp.from || '') + '">' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<button class="btn btn-sm btn-cyan" onclick="saveSmtp()">Save SMTP</button>' +
          '<button class="btn btn-sm btn-primary" onclick="testSmtp()">&#9993; Send Test Email</button>' +
          '<div id="smtp-result" style="flex:1"></div>' +
        '</div>' +
        '<p style="margin:8px 0 0;font-size:11px;color:var(--text-tertiary)">Gmail: Enable 2FA, then create an <a href="https://myaccount.google.com/apppasswords" target="_blank" style="color:var(--cyan)">App Password</a>. Use the 16-char code as the password.</p>';
    }).catch(function () {});
  }

  window.smtpPreset = function (host, port) {
    var h = document.getElementById('smtp-host');
    var p = document.getElementById('smtp-port');
    if (h) h.value = host;
    if (p) p.value = port;
  };

  window.saveSmtp = function () {
    var host = (document.getElementById('smtp-host') || {}).value;
    var port = (document.getElementById('smtp-port') || {}).value;
    var user = (document.getElementById('smtp-user') || {}).value;
    var pass = (document.getElementById('smtp-pass') || {}).value;
    var from = (document.getElementById('smtp-from') || {}).value;
    if (!host || !user) { Toast.warning('Host and username required'); return; }
    var smtp = { host: host, port: parseInt(port) || 587, user: user, from: from || '' };
    if (pass) smtp.pass = pass; // Only update password if entered
    // Get current settings to preserve other fields, then merge
    fetch('/api/settings').then(function (r) { return r.json(); }).then(function (current) {
      // If no new password entered, keep existing
      if (!pass && current.smtp && current.smtp.pass) {
        // We can't read the existing pass (it's masked), so skip pass update
        // The server will keep the existing smtp.pass if we send the whole object
      }
      return fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtp: smtp })
      });
    }).then(function (r) { return r.json(); }).then(function () {
      Toast.success('SMTP settings saved');
      loadSmtpSettings();
    }).catch(function () { Toast.error('Failed to save SMTP'); });
  };

  window.testSmtp = function () {
    var host = (document.getElementById('smtp-host') || {}).value;
    var port = (document.getElementById('smtp-port') || {}).value;
    var user = (document.getElementById('smtp-user') || {}).value;
    var pass = (document.getElementById('smtp-pass') || {}).value;
    var from = (document.getElementById('smtp-from') || {}).value;
    if (!host || !user) { Toast.warning('Save SMTP settings first'); return; }

    // Ask for test recipient
    Modal.open({
      title: '&#9993; Send Test Email', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Send test email to:</label>' +
        '<input id="smtp-test-to" class="form-input" type="email" placeholder="you@example.com" value="' + esc(user) + '"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" id="smtp-test-send">Send Test</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('smtp-test-send');
      if (btn) btn.onclick = function () {
        var to = (document.getElementById('smtp-test-to') || {}).value;
        if (!to) { Toast.warning('Enter a recipient'); return; }
        btn.disabled = true;
        btn.textContent = 'Sending...';
        fetch('/api/notifications/test-smtp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host: host, port: parseInt(port) || 587, user: user, pass: pass, from: from, to: to })
        }).then(function (r) { return r.json(); }).then(function (d) {
          btn.disabled = false;
          btn.textContent = 'Send Test';
          if (d.error) { Toast.error('Test failed: ' + d.error); return; }
          Toast.success(d.message || 'Test email sent!');
          Modal.close(btn.closest('.modal-overlay'));
        }).catch(function () { btn.disabled = false; btn.textContent = 'Send Test'; Toast.error('Failed to send test'); });
      };
    }, 50);
  };

  function loadAuditLog() {
    Promise.all([
      fetch('/api/audit?limit=50').then(function (r) { return r.ok ? r.json() : { entries: [], total: 0 }; }),
      fetch('/api/audit/stats').then(function (r) { return r.ok ? r.json() : null; })
    ]).then(function (results) {
      var data = results[0];
      var stats = results[1];
      var statsEl = document.getElementById('audit-stats');
      if (statsEl && stats) {
        statsEl.innerHTML =
          '<div style="display:flex;gap:16px;font-size:12px">' +
            '<div><span style="color:var(--cyan);font-weight:600">' + stats.last24h + '</span> <span style="color:var(--text-tertiary)">events (24h)</span></div>' +
            '<div><span style="color:var(--orange);font-weight:600">' + stats.errors + '</span> <span style="color:var(--text-tertiary)">errors</span></div>' +
            '<div><span style="color:var(--text-secondary);font-weight:600">' + stats.total + '</span> <span style="color:var(--text-tertiary)">total</span></div>' +
          '</div>';
      }
      var tbody = document.getElementById('audit-table');
      if (!tbody) return;
      var entries = data.entries || [];
      if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-tertiary);text-align:center">No audit entries yet</td></tr>';
        return;
      }
      tbody.innerHTML = entries.map(function (e) {
        var resultBadge = e.result === 'success' ? '<span class="badge badge-cyan">OK</span>' : '<span class="badge badge-danger">ERR</span>';
        var time = new Date(e.timestamp).toLocaleString();
        return '<tr><td style="font-size:11px;color:var(--text-tertiary)">' + time + '</td>' +
          '<td>' + esc(e.user) + '</td>' +
          '<td style="font-size:11px">' + esc(e.action) + '</td>' +
          '<td>' + resultBadge + '</td>' +
          '<td style="font-size:11px;color:var(--text-tertiary)">' + esc(e.ip) + '</td></tr>';
      }).join('');
    }).catch(function () {});
  }

  window.exportAudit = function (format) {
    window.open('/api/audit/export?format=' + format, '_blank');
  };

  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
