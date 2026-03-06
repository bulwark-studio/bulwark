/**
 * Notification Bell — Toolbar notification center
 * Polls for unread count, dropdown panel with mark read/clear
 */
(function () {
  'use strict';

  var notifOpen = false;
  var pollInterval = null;

  window.toggleNotifPanel = function () {
    var panel = document.getElementById('notif-panel');
    if (!panel) return;
    notifOpen = !notifOpen;
    if (notifOpen) {
      // Position panel below the bell button
      var btn = document.getElementById('notif-bell-wrap');
      if (btn) {
        var rect = btn.getBoundingClientRect();
        panel.style.top = (rect.bottom + 8) + 'px';
        panel.style.right = (window.innerWidth - rect.right) + 'px';
      }
      panel.style.display = 'block';
      loadNotifications();
    } else {
      panel.style.display = 'none';
    }
  };

  // Close on click outside
  document.addEventListener('click', function (e) {
    if (!notifOpen) return;
    var btn = document.getElementById('notif-bell-wrap');
    var panel = document.getElementById('notif-panel');
    if (btn && btn.contains(e.target)) return;
    if (panel && panel.contains(e.target)) return;
    notifOpen = false;
    if (panel) panel.style.display = 'none';
  });

  function loadNotifications() {
    fetch('/api/notification-center')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        updateBadge(d.unread || 0);
        renderNotifList(d.notifications || []);
      })
      .catch(function () {});
  }

  function updateBadge(count) {
    var badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.style.display = 'flex';
      badge.textContent = count > 99 ? '99+' : count;
    } else {
      badge.style.display = 'none';
    }
  }

  function renderNotifList(notifs) {
    var list = document.getElementById('notif-panel-list');
    if (!list) return;
    if (!notifs.length) {
      list.innerHTML = '<div class="notif-empty">No notifications</div>';
      return;
    }
    list.innerHTML = notifs.slice(0, 30).map(function (n) {
      var catIcons = { security: '&#128274;', deploy: '&#128640;', cron: '&#9202;', system: '&#9881;', git: '&#128737;' };
      var sevColors = { critical: 'var(--orange)', warning: '#f59e0b', info: 'var(--cyan)' };
      return '<div class="notif-item' + (n.read ? '' : ' unread') + '" onclick="readNotif(\'' + n.id + '\')">' +
        '<div class="notif-item-icon" style="color:' + (sevColors[n.severity] || 'var(--text-tertiary)') + '">' + (catIcons[n.category] || '&#128276;') + '</div>' +
        '<div class="notif-item-content">' +
          '<div class="notif-item-title">' + esc(n.title) + '</div>' +
          (n.message ? '<div class="notif-item-msg">' + esc(n.message).substring(0, 80) + '</div>' : '') +
          '<div class="notif-item-time">' + timeAgo(n.timestamp) + '</div>' +
        '</div>' +
        '<button class="notif-item-dismiss" onclick="event.stopPropagation();dismissNotif(\'' + n.id + '\')" title="Dismiss">&times;</button>' +
      '</div>';
    }).join('');
  }

  window.readNotif = function (id) {
    fetch('/api/notification-center/' + id + '/read', { method: 'POST' })
      .then(function () { loadNotifications(); });
  };

  window.dismissNotif = function (id) {
    fetch('/api/notification-center/' + id, { method: 'DELETE' })
      .then(function () { loadNotifications(); });
  };

  window.markAllNotifsRead = function () {
    fetch('/api/notification-center/read-all', { method: 'POST' })
      .then(function () { loadNotifications(); });
  };

  window.clearAllNotifs = function () {
    fetch('/api/notification-center/all', { method: 'DELETE' })
      .then(function () { loadNotifications(); updateBadge(0); });
  };

  // Poll for unread count every 15s
  function pollUnread() {
    fetch('/api/notification-center')
      .then(function (r) { return r.json(); })
      .then(function (d) { updateBadge(d.unread || 0); })
      .catch(function () {});
  }

  // Start polling after page load
  setTimeout(function () {
    pollUnread();
    pollInterval = setInterval(pollUnread, 15000);
  }, 2000);

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    var diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
    return Math.round(diff / 86400000) + 'd ago';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
