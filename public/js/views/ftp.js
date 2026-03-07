/**
 * Bulwark v2.1 — FTP Management View
 * Native detection of vsftpd/proftpd, AI-powered setup & management
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
          '<div id="ftp-content"></div>';
      }
    },
    show: function () { loadFtp(); },
    hide: function () {},
    update: function () {}
  };

  function loadFtp() {
    var el = document.getElementById('ftp-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary);padding:16px">Detecting FTP service...</div>';

    fetch('/api/ftp/status').then(function (r) { return r.json(); }).then(function (d) {
      // No FTP server detected
      if (d.installed === false || d.tool === 'none') {
        el.innerHTML =
          '<div class="card" style="text-align:center;padding:40px">' +
            '<div style="font-size:36px;margin-bottom:12px">&#128233;</div>' +
            '<div style="color:var(--text-primary);font-weight:600;font-size:15px;margin-bottom:8px">No FTP Server Detected</div>' +
            '<div style="color:var(--text-tertiary);font-size:12px;max-width:480px;margin:0 auto 24px;line-height:1.7">' +
              (d.platform === 'win32'
                ? 'FTP servers on Windows typically use IIS FTP or FileZilla Server. Bulwark can help you set one up.'
                : 'FTP lets you transfer files to and from your server. Most Linux servers use <b>vsftpd</b> (Very Secure FTP Daemon) — it\'s lightweight and secure.') +
            '</div>' +
            '<div style="color:var(--text-tertiary);font-size:11px;max-width:480px;margin:0 auto 20px;line-height:1.6;padding:12px;background:rgba(0,0,0,0.2);border-radius:6px;text-align:left">' +
              '<b style="color:var(--text-secondary)">Consider SFTP instead:</b> Most modern workflows use SFTP (SSH File Transfer Protocol) which is already built into SSH — no extra software needed. FTP is only necessary for legacy systems or specific compliance requirements.' +
            '</div>' +
            '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
              '<button class="sec-ai-btn" onclick="ftpAISetup()">&#10024; AI Setup Guide</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="ftpAIAsk()">Ask AI a Question</button>' +
            '</div>' +
          '</div>';
        return;
      }

      // FTP server found — show status + users + sessions
      var running = d.running;
      var statusColor = running ? 'var(--cyan)' : 'var(--orange)';
      var statusIcon = running ? '&#9679;' : '&#9675;';

      var html =
        // Status card
        '<div class="card" style="margin-bottom:16px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between">' +
            '<div>' +
              '<div class="card-title">' + esc(d.tool || 'FTP') + ' Service</div>' +
              '<div style="margin-top:4px"><span style="color:' + statusColor + '">' + statusIcon + ' ' + (running ? 'Running' : 'Stopped') + '</span></div>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
              '<button class="sec-ai-btn" onclick="ftpAIAsk()">&#10024; Ask AI</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="loadFtp()">Refresh</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      // Users section
      var users = d.users || [];
      html +=
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<div class="section-title" style="margin:0">FTP Users</div>' +
          '<button class="btn btn-sm btn-primary" onclick="ftpAIAddUser()">+ Add User (AI)</button>' +
        '</div>';

      if (users.length) {
        html += '<div class="table-wrap"><table><thead><tr><th>Username</th><th>Home Directory</th><th>Shell</th></tr></thead><tbody>' +
          users.map(function (u) {
            return '<tr><td>' + esc(u.name || '') + '</td><td style="font-family:monospace;font-size:11px">' + esc(u.home || '') + '</td>' +
              '<td style="font-size:11px;color:var(--text-tertiary)">' + esc(u.shell || '') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        html += '<div class="card" style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:12px">No FTP users detected</div>';
      }

      // Sessions section
      var sessions = d.sessions || [];
      html += '<div class="section-title" style="margin-top:20px">Active Sessions</div>';
      if (sessions.length) {
        html += '<div class="table-wrap"><table><thead><tr><th>User</th><th>Client IP</th><th>Connected</th></tr></thead><tbody>' +
          sessions.map(function (s) {
            return '<tr><td>' + esc(s.user || '') + '</td><td>' + esc(s.ip || '') + '</td><td>' + esc(s.since || '') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        html += '<div class="card" style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:12px">No active sessions</div>';
      }

      // AI help
      html += '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="sec-ai-btn" onclick="ftpAISetup()">&#10024; AI Configuration Guide</button>' +
        '<button class="btn btn-sm btn-ghost" onclick="ftpAIAsk()">Ask AI a Question</button>' +
      '</div>';

      el.innerHTML = html;
    }).catch(function () {
      el.innerHTML =
        '<div class="card" style="text-align:center;padding:40px">' +
          '<div style="font-size:36px;margin-bottom:12px">&#128233;</div>' +
          '<div style="color:var(--text-primary);font-weight:600;margin-bottom:8px">FTP Status Unknown</div>' +
          '<div style="color:var(--text-tertiary);font-size:12px;margin-bottom:16px">Could not detect FTP configuration.</div>' +
          '<div style="display:flex;gap:8px;justify-content:center">' +
            '<button class="sec-ai-btn" onclick="ftpAISetup()">&#10024; AI Setup Guide</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="ftpAIAsk()">Ask AI a Question</button>' +
          '</div>' +
        '</div>';
    });
  }

  // AI: Full FTP setup guide
  window.ftpAISetup = function () {
    Modal.open({ title: '&#10024; AI FTP Setup Guide', size: 'lg',
      body: '<div id="ftp-ai-result" style="color:var(--text-secondary);font-size:13px;line-height:1.7">Generating FTP setup guide...<span class="cursor-blink"></span></div>'
    });
    fetch('/api/ftp/ai-setup').then(function (r) { return r.json(); }).then(function (d) {
      var el = document.getElementById('ftp-ai-result');
      if (el) el.innerHTML = '<pre style="white-space:pre-wrap;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-secondary);line-height:1.7">' + esc(d.guide || 'Could not generate guide.') + '</pre>';
    }).catch(function () {
      var el = document.getElementById('ftp-ai-result');
      if (el) el.textContent = 'AI unavailable. Configure an AI provider in Settings > AI Provider.';
    });
  };

  // AI: Ask about FTP
  window.ftpAIAsk = function () {
    Modal.open({ title: '&#10024; Ask AI About FTP', size: 'md',
      body: '<div class="form-group"><label class="form-label">Describe what you need in plain English</label>' +
        '<textarea id="ftp-ai-q" class="form-input" rows="3" placeholder="e.g., How do I create an FTP user with read-only access?\ne.g., Should I use FTP or SFTP?\ne.g., How do I restrict users to their home directory?"></textarea></div>' +
        '<div id="ftp-ai-answer" style="margin-top:12px"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>' +
        '<button class="btn btn-sm btn-primary" id="ftp-ai-send">&#10024; Ask AI</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('ftp-ai-send');
      if (btn) btn.onclick = function () {
        var q = (document.getElementById('ftp-ai-q') || {}).value;
        if (!q) return;
        var ans = document.getElementById('ftp-ai-answer');
        if (ans) ans.innerHTML = '<div style="color:var(--text-tertiary);font-size:12px">Thinking...<span class="cursor-blink"></span></div>';
        btn.disabled = true;
        fetch('/api/ftp/ai-ask', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (ans) ans.innerHTML = '<pre style="white-space:pre-wrap;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-secondary);line-height:1.7;margin-top:8px;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px">' + esc(d.answer || 'No answer.') + '</pre>';
            btn.disabled = false;
          });
      };
    }, 50);
  };

  // AI: Add user via natural language
  window.ftpAIAddUser = function () {
    Modal.open({ title: '&#10024; Add FTP User', size: 'md',
      body: '<div class="form-group"><label class="form-label">Describe the user in plain English</label>' +
        '<input id="ftp-ai-user" class="form-input" placeholder="e.g., Create user \'deploy\' with access to /var/www only"></div>' +
        '<div id="ftp-ai-cmd" style="margin-top:12px"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>' +
        '<button class="btn btn-sm btn-primary" id="ftp-ai-gen">&#10024; Generate Commands</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('ftp-ai-gen');
      if (btn) btn.onclick = function () {
        var desc = (document.getElementById('ftp-ai-user') || {}).value;
        if (!desc) return;
        var out = document.getElementById('ftp-ai-cmd');
        if (out) out.innerHTML = '<div style="color:var(--text-tertiary);font-size:12px">Generating commands...<span class="cursor-blink"></span></div>';
        btn.disabled = true;
        fetch('/api/ftp/ai-ask', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'Generate the exact Linux commands to: ' + desc + '. Include useradd, password, home directory, and vsftpd user list configuration. Explain each command. Warn about security implications.' }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (out) out.innerHTML = '<pre style="white-space:pre-wrap;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-secondary);line-height:1.7;margin-top:8px;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px">' + esc(d.answer || 'No answer.') + '</pre>' +
              '<div style="color:var(--text-tertiary);font-size:11px;margin-top:8px">&#9888; Copy and run these commands in your terminal. Bulwark generates but does not auto-execute user changes for safety.</div>';
            btn.disabled = false;
          });
      };
    }, 50);
  };

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
