/**
 * Bulwark v2.1 — Notifications View
 * Webhook channels: Discord/Slack/Telegram, test, enable/disable
 */
(function () {
  'use strict';

  Views.notifications = {
    init: function () {
      var container = document.getElementById('view-notifications');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div>' +
              '<h3 style="margin:0;color:var(--text-primary);font-size:16px;font-weight:600">Notification Channels</h3>' +
              '<p style="margin:4px 0 0;color:var(--text-tertiary);font-size:12px">Discord, Slack & Telegram webhook integrations</p>' +
            '</div>' +
            '<button class="btn btn-sm btn-cyan" onclick="addChannel()">Add Channel</button>' +
          '</div>' +
          '<div id="notif-content"></div>';
      }
    },
    show: function () { loadChannels(); },
    hide: function () {},
    update: function () {}
  };

  function loadChannels() {
    var el = document.getElementById('notif-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading channels...</div>';
    fetch('/api/notifications/channels')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var channels = d.channels || [];
        if (!channels.length) {
          el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No notification channels configured</div></div>';
          return;
        }
        el.innerHTML = '<div class="card-grid">' + channels.map(function (ch) {
          var icon = ch.type === 'discord' ? '&#128172;' : ch.type === 'slack' ? '&#128488;' : ch.type === 'telegram' ? '&#9992;' : '&#128276;';
          var enabled = ch.enabled !== false;
          return '<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
            '<span style="font-size:20px">' + icon + '</span><div style="flex:1"><strong>' + esc(ch.name) + '</strong>' +
            '<div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase">' + esc(ch.type) + '</div></div>' +
            '<span class="dot ' + (enabled ? 'dot-healthy' : 'dot-idle') + '" style="width:8px;height:8px"></span></div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px;font-family:monospace">' + esc(ch.webhookUrl || ch.botToken || '--') + '</div>' +
            '<div style="display:flex;gap:4px">' +
              '<button class="btn btn-sm" onclick="toggleChannel(\'' + ch.id + '\',' + !enabled + ')">' + (enabled ? 'Disable' : 'Enable') + '</button>' +
              '<button class="btn btn-sm btn-primary" onclick="testChannel(\'' + ch.id + '\')">Test</button>' +
              '<button class="btn btn-sm btn-danger" onclick="deleteChannel(\'' + ch.id + '\')">Del</button>' +
            '</div></div>';
        }).join('') + '</div>';
      })
      .catch(function () { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load channels</div></div>'; });
  }

  window.addChannel = function () {
    Modal.open({
      title: 'Add Notification Channel', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Type</label>' +
        '<select id="ch-type" class="form-input"><option value="discord">Discord</option><option value="slack">Slack</option><option value="telegram">Telegram</option></select></div>' +
        '<div class="form-group"><label class="form-label">Name</label><input id="ch-name" class="form-input" placeholder="My Channel"></div>' +
        '<div class="form-group"><label class="form-label">Webhook URL</label><input id="ch-webhook" class="form-input" placeholder="https://discord.com/api/webhooks/..."></div>' +
        '<div class="form-group" id="ch-telegram-fields" style="display:none">' +
        '<label class="form-label">Bot Token</label><input id="ch-bot-token" class="form-input" placeholder="123456:ABC...">' +
        '<label class="form-label" style="margin-top:8px">Chat ID</label><input id="ch-chat-id" class="form-input" placeholder="-100...">' +
        '</div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="ch-save">Add</button>'
    });
    setTimeout(function () {
      var typeEl = document.getElementById('ch-type');
      if (typeEl) typeEl.onchange = function () {
        var tg = document.getElementById('ch-telegram-fields');
        if (tg) tg.style.display = typeEl.value === 'telegram' ? 'block' : 'none';
      };
      var btn = document.getElementById('ch-save');
      if (btn) btn.onclick = function () {
        var type = (document.getElementById('ch-type') || {}).value;
        var name = (document.getElementById('ch-name') || {}).value;
        var webhookUrl = (document.getElementById('ch-webhook') || {}).value;
        var botToken = (document.getElementById('ch-bot-token') || {}).value;
        var chatId = (document.getElementById('ch-chat-id') || {}).value;
        if (!name) { Toast.warning('Name required'); return; }
        var body = { type: type, name: name, webhookUrl: webhookUrl };
        if (type === 'telegram') { body.botToken = botToken; body.chatId = chatId; }
        fetch('/api/notifications/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Channel added'); Modal.close(btn.closest('.modal-overlay')); loadChannels();
          })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.toggleChannel = function (id, enabled) {
    fetch('/api/notifications/channels/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: enabled }) })
      .then(function () { loadChannels(); })
      .catch(function () { Toast.error('Failed'); });
  };

  window.testChannel = function (id) {
    Toast.info('Sending test notification...');
    fetch('/api/notifications/test/' + id, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Test sent');
      })
      .catch(function () { Toast.error('Failed'); });
  };

  window.deleteChannel = function (id) {
    Modal.confirm({ title: 'Delete Channel', message: 'Delete this notification channel?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/notifications/channels/' + id, { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadChannels(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
