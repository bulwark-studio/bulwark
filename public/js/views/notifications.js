/**
 * Bulwark v2.1 — Notifications View
 * Webhook channels: Discord/Slack/Telegram/Email, test, enable/disable
 * Email alerts with AI-composed messages, SMTP config link
 */
(function () {
  'use strict';

  var EVENT_TYPES = [
    { value: 'uptime', label: 'Uptime (endpoint down/up)' },
    { value: 'deploy', label: 'Deploy (success/failure)' },
    { value: 'security', label: 'Security (scan alerts)' },
    { value: 'system', label: 'System (general)' },
    { value: 'cron', label: 'Cron Jobs' },
    { value: 'git', label: 'Git Activity' },
  ];

  Views.notifications = {
    init: function () {
      var container = document.getElementById('view-notifications');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div>' +
              '<h3 style="margin:0;color:var(--text-primary);font-size:16px;font-weight:600">Notification Channels</h3>' +
              '<p style="margin:4px 0 0;color:var(--text-tertiary);font-size:12px">Email, Discord, Slack & Telegram — get alerted when things happen</p>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
              '<button class="btn btn-sm btn-cyan" onclick="addChannel()">+ Add Channel</button>' +
              '<button class="btn btn-sm" onclick="notifSendAdhoc()">&#9993; Send Email</button>' +
            '</div>' +
          '</div>' +
          // SMTP status banner
          '<div id="smtp-status-banner"></div>' +
          '<div id="notif-content"></div>';
      }
    },
    show: function () { checkSmtpStatus(); loadChannels(); },
    hide: function () {},
    update: function () {}
  };

  function checkSmtpStatus() {
    var banner = document.getElementById('smtp-status-banner');
    if (!banner) return;
    fetch('/api/settings').then(safeJson).then(function (s) {
      if (s.smtp && s.smtp.host) {
        banner.innerHTML =
          '<div class="card" style="margin-bottom:16px;padding:12px;display:flex;align-items:center;gap:8px">' +
            '<span style="color:var(--cyan)">&#9679;</span>' +
            '<span style="font-size:12px;color:var(--text-secondary)">SMTP configured: <span style="font-family:monospace">' + esc(s.smtp.host) + ':' + (s.smtp.port || 587) + '</span> as <span style="font-family:monospace">' + esc(s.smtp.user || '') + '</span></span>' +
            '<span style="flex:1"></span>' +
            '<button class="btn btn-sm" onclick="switchView(\'settings\')">Edit SMTP</button>' +
          '</div>';
      } else {
        banner.innerHTML =
          '<div class="card" style="margin-bottom:16px;padding:12px;display:flex;align-items:center;gap:8px;border-color:var(--orange)">' +
            '<span style="color:var(--orange)">&#9675;</span>' +
            '<span style="font-size:12px;color:var(--text-secondary)">Email not configured — set up SMTP in Settings to enable email alerts</span>' +
            '<span style="flex:1"></span>' +
            '<button class="btn btn-sm btn-primary" onclick="switchView(\'settings\')">Configure SMTP</button>' +
          '</div>';
      }
    }).catch(function () {});
  }

  function loadChannels() {
    var el = document.getElementById('notif-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading channels...</div>';
    fetch('/api/notifications/channels')
      .then(safeJson)
      .then(function (d) {
        var channels = d.channels || [];
        if (!channels.length) {
          el.innerHTML =
            '<div class="card" style="text-align:center;padding:40px">' +
              '<div style="font-size:36px;margin-bottom:12px">&#128276;</div>' +
              '<div style="color:var(--text-primary);font-weight:600;margin-bottom:8px">No Notification Channels</div>' +
              '<div style="color:var(--text-tertiary);font-size:12px;max-width:400px;margin:0 auto 20px;line-height:1.6">' +
                'Add a channel to get alerted via email, Discord, Slack, or Telegram when endpoints go down, deploys fail, or security issues arise.' +
              '</div>' +
              '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
                '<button class="btn btn-sm btn-cyan" onclick="addChannel()">+ Add Channel</button>' +
                '<button class="sec-ai-btn" onclick="notifAIHelp()">&#10024; AI Setup Guide</button>' +
              '</div>' +
            '</div>';
          return;
        }
        el.innerHTML = '<div class="card-grid">' + channels.map(function (ch) {
          var icon = ch.type === 'discord' ? '&#128172;' : ch.type === 'slack' ? '&#128488;' : ch.type === 'telegram' ? '&#9992;' : ch.type === 'email' ? '&#9993;' : '&#128276;';
          var enabled = ch.enabled !== false;
          var detail = ch.type === 'email' ? esc(ch.email || '--') : esc(ch.webhookUrl || ch.botToken || '--');
          var events = (ch.events && ch.events.length) ? ch.events.map(function (e) { return '<span class="badge" style="font-size:9px;margin:1px">' + esc(e) + '</span>'; }).join('') : '<span style="color:var(--text-tertiary);font-size:10px">all events</span>';
          return '<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
            '<span style="font-size:20px">' + icon + '</span><div style="flex:1"><strong>' + esc(ch.name) + '</strong>' +
            '<div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase">' + esc(ch.type) + (ch.cc ? ' + CC' : '') + '</div></div>' +
            '<span class="dot ' + (enabled ? 'dot-healthy' : 'dot-idle') + '" style="width:8px;height:8px"></span></div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;font-family:monospace;word-break:break-all">' + detail + '</div>' +
            '<div style="margin-bottom:8px">' + events + '</div>' +
            '<div style="display:flex;gap:4px">' +
              '<button class="btn btn-sm" onclick="toggleChannel(\'' + ch.id + '\',' + !enabled + ')">' + (enabled ? 'Disable' : 'Enable') + '</button>' +
              '<button class="btn btn-sm btn-primary" onclick="testChannel(\'' + ch.id + '\')">Test</button>' +
              '<button class="btn btn-sm" onclick="editChannel(\'' + ch.id + '\')">Edit</button>' +
              '<button class="btn btn-sm btn-danger" onclick="deleteChannel(\'' + ch.id + '\')">Del</button>' +
            '</div></div>';
        }).join('') + '</div>' +
        '<div style="margin-top:16px;display:flex;gap:8px">' +
          '<button class="sec-ai-btn" onclick="notifAIHelp()">&#10024; AI Setup Help</button>' +
        '</div>';
      })
      .catch(function () { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load channels</div></div>'; });
  }

  window.addChannel = function () {
    var eventsChecks = EVENT_TYPES.map(function (e) {
      return '<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-secondary)">' +
        '<input type="checkbox" class="ch-event-check" value="' + e.value + '"> ' + e.label + '</label>';
    }).join('');

    Modal.open({
      title: 'Add Notification Channel', size: 'md',
      body:
        '<div class="form-group"><label class="form-label">Type</label>' +
          '<select id="ch-type" class="form-input"><option value="email">Email</option><option value="discord">Discord</option><option value="slack">Slack</option><option value="telegram">Telegram</option></select></div>' +
        '<div class="form-group"><label class="form-label">Channel Name</label><input id="ch-name" class="form-input" placeholder="e.g., My Alerts, Team Email"></div>' +
        // Email fields
        '<div id="ch-email-fields">' +
          '<div class="form-group"><label class="form-label">Recipient Email</label><input id="ch-email" class="form-input" type="email" placeholder="you@example.com"></div>' +
          '<div class="form-group"><label class="form-label">CC (optional)</label><input id="ch-cc" class="form-input" type="email" placeholder="team@example.com"></div>' +
        '</div>' +
        // Webhook fields
        '<div id="ch-webhook-fields" style="display:none">' +
          '<div class="form-group"><label class="form-label">Webhook URL</label><input id="ch-webhook" class="form-input" placeholder="https://discord.com/api/webhooks/..."></div>' +
        '</div>' +
        // Telegram fields
        '<div id="ch-telegram-fields" style="display:none">' +
          '<div class="form-group"><label class="form-label">Bot Token</label><input id="ch-bot-token" class="form-input" placeholder="123456:ABC..."></div>' +
          '<div class="form-group"><label class="form-label">Chat ID</label><input id="ch-chat-id" class="form-input" placeholder="-100..."></div>' +
        '</div>' +
        // Event filters
        '<div class="form-group"><label class="form-label">Trigger On (leave all unchecked = all events)</label>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">' + eventsChecks + '</div>' +
        '</div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="ch-save">Add Channel</button>'
    });
    setTimeout(function () {
      var typeEl = document.getElementById('ch-type');
      function updateFields() {
        var t = typeEl.value;
        toggle('ch-email-fields', t === 'email');
        toggle('ch-webhook-fields', t === 'discord' || t === 'slack');
        toggle('ch-telegram-fields', t === 'telegram');
      }
      if (typeEl) { typeEl.onchange = updateFields; updateFields(); }

      var btn = document.getElementById('ch-save');
      if (btn) btn.onclick = function () {
        var type = val('ch-type');
        var name = val('ch-name');
        if (!name) { Toast.warning('Name required'); return; }
        var body = { type: type, name: name, events: getCheckedEvents() };
        if (type === 'email') {
          body.email = val('ch-email');
          body.cc = val('ch-cc');
          if (!body.email) { Toast.warning('Email address required'); return; }
        } else if (type === 'telegram') {
          body.botToken = val('ch-bot-token');
          body.chatId = val('ch-chat-id');
        } else {
          body.webhookUrl = val('ch-webhook');
        }
        fetch('/api/notifications/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(safeJson)
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Channel added'); Modal.close(btn.closest('.modal-overlay')); loadChannels();
          })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.editChannel = function (id) {
    // Reload full config to get unmasked data
    fetch('/api/notifications/channels').then(safeJson).then(function (d) {
      var ch = (d.channels || []).find(function (c) { return c.id === id; });
      if (!ch) { Toast.error('Channel not found'); return; }

      var eventsChecks = EVENT_TYPES.map(function (e) {
        var checked = (ch.events || []).indexOf(e.value) >= 0 ? ' checked' : '';
        return '<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-secondary)">' +
          '<input type="checkbox" class="ch-event-check" value="' + e.value + '"' + checked + '> ' + e.label + '</label>';
      }).join('');

      Modal.open({
        title: 'Edit Channel: ' + esc(ch.name), size: 'md',
        body:
          (ch.type === 'email' ?
            '<div class="form-group"><label class="form-label">Recipient Email</label><input id="ch-edit-email" class="form-input" type="email" value="' + esc(ch.email || '') + '"></div>' +
            '<div class="form-group"><label class="form-label">CC (optional)</label><input id="ch-edit-cc" class="form-input" type="email" value="' + esc(ch.cc || '') + '"></div>'
          : '') +
          '<div class="form-group"><label class="form-label">Trigger On</label>' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">' + eventsChecks + '</div>' +
          '</div>',
        footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="ch-edit-save">Save</button>'
      });
      setTimeout(function () {
        var btn = document.getElementById('ch-edit-save');
        if (btn) btn.onclick = function () {
          var body = { events: getCheckedEvents() };
          if (ch.type === 'email') {
            body.email = val('ch-edit-email');
            body.cc = val('ch-edit-cc');
          }
          fetch('/api/notifications/channels/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(safeJson)
            .then(function () { Toast.success('Updated'); Modal.close(btn.closest('.modal-overlay')); loadChannels(); })
            .catch(function () { Toast.error('Failed'); });
        };
      }, 50);
    });
  };

  window.toggleChannel = function (id, enabled) {
    fetch('/api/notifications/channels/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: enabled }) })
      .then(function () { Toast.success(enabled ? 'Enabled' : 'Disabled'); loadChannels(); })
      .catch(function () { Toast.error('Failed'); });
  };

  window.testChannel = function (id) {
    Toast.info('Sending test notification...');
    fetch('/api/notifications/test/' + id, { method: 'POST' })
      .then(safeJson)
      .then(function (d) {
        if (d.error) { Toast.error('Test failed: ' + d.error); return; }
        Toast.success('Test sent successfully!');
      })
      .catch(function () { Toast.error('Failed to send test'); });
  };

  window.deleteChannel = function (id) {
    Modal.confirm({ title: 'Delete Channel', message: 'Delete this notification channel?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/notifications/channels/' + id, { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadChannels(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  // Send ad-hoc email with AI compose
  window.notifSendAdhoc = function () {
    Modal.open({
      title: '&#9993; Send Email Alert', size: 'lg',
      body:
        '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
          '<div class="form-group" style="flex:1;min-width:200px"><label class="form-label">To</label><input id="adhoc-to" class="form-input" type="email" placeholder="recipient@example.com"></div>' +
          '<div class="form-group" style="flex:1;min-width:200px"><label class="form-label">CC (optional)</label><input id="adhoc-cc" class="form-input" type="email" placeholder="cc@example.com"></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Subject</label><input id="adhoc-subject" class="form-input" placeholder="Bulwark Alert: ..."></div>' +
        '<div class="form-group"><label class="form-label">Message Body</label><textarea id="adhoc-body" class="form-input" rows="6" placeholder="Describe the alert..."></textarea></div>' +
        '<div style="margin-bottom:8px"><button class="sec-ai-btn" id="adhoc-ai-compose" style="font-size:11px">&#10024; AI Compose from Alert</button></div>' +
        '<div id="adhoc-result"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="adhoc-send">Send Email</button>'
    });
    setTimeout(function () {
      var aiBtn = document.getElementById('adhoc-ai-compose');
      if (aiBtn) aiBtn.onclick = function () {
        var title = val('adhoc-subject') || 'Server Alert';
        var message = val('adhoc-body') || '';
        aiBtn.disabled = true;
        aiBtn.textContent = 'Composing...';
        fetch('/api/notifications/ai-compose', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'system', title: title, message: message, severity: 'warning' }) })
          .then(safeJson)
          .then(function (d) {
            var el = document.getElementById('adhoc-body');
            if (el && d.body) el.value = d.body;
            aiBtn.disabled = false;
            aiBtn.innerHTML = '&#10024; AI Compose from Alert';
          });
      };
      var sendBtn = document.getElementById('adhoc-send');
      if (sendBtn) sendBtn.onclick = function () {
        var to = val('adhoc-to');
        if (!to) { Toast.warning('Recipient required'); return; }
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        var result = document.getElementById('adhoc-result');
        fetch('/api/notifications/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: to, cc: val('adhoc-cc'), subject: val('adhoc-subject'), body: val('adhoc-body') }) })
          .then(safeJson)
          .then(function (d) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Email';
            if (d.error) {
              if (result) result.innerHTML = '<div style="color:var(--orange);font-size:12px;margin-top:8px">' + esc(d.error) + '</div>';
              Toast.error(d.error);
            } else {
              if (result) result.innerHTML = '<div style="color:var(--cyan);font-size:12px;margin-top:8px">&#10003; ' + esc(d.message || 'Email sent') + '</div>';
              Toast.success('Email sent!');
            }
          })
          .catch(function () { sendBtn.disabled = false; sendBtn.textContent = 'Send Email'; Toast.error('Failed to send'); });
      };
    }, 50);
  };

  // AI setup help for notifications
  window.notifAIHelp = function () {
    Modal.open({ title: '&#10024; AI Notification Setup Guide', size: 'lg',
      body: '<div id="notif-ai-result" style="color:var(--text-secondary);font-size:13px;line-height:1.7">Generating guide...<span class="cursor-blink"></span></div>'
    });
    fetch('/api/ftp/ai-ask', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Explain how to set up email notifications for a server monitoring tool. Cover: 1) Getting SMTP credentials from Gmail (App Passwords), Outlook, or a custom SMTP server. 2) What are Discord webhooks and how to create one. 3) What are Slack incoming webhooks. 4) How to create a Telegram bot and get a chat ID. Keep it beginner-friendly with exact steps. No markdown formatting.' }) })
      .then(safeJson)
      .then(function (d) {
        var el = document.getElementById('notif-ai-result');
        if (el) el.innerHTML = '<pre style="white-space:pre-wrap;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-secondary);line-height:1.7">' + esc(d.answer || 'Could not generate guide.') + '</pre>';
      })
      .catch(function () {
        var el = document.getElementById('notif-ai-result');
        if (el) el.textContent = 'AI unavailable. Configure an AI provider in Settings.';
      });
  };

  function getCheckedEvents() {
    var checks = document.querySelectorAll('.ch-event-check:checked');
    var events = [];
    for (var i = 0; i < checks.length; i++) events.push(checks[i].value);
    return events;
  }

  function toggle(id, show) { var el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; }
  function val(id) { return (document.getElementById(id) || {}).value || ''; }
  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
