/**
 * Chester Dev Monitor v2.0 — Main Application Controller
 * Global state, Socket.IO, view registry, navigation
 */

// ── Client-Side Cache System ──
window.Cache = {
  _store: new Map(),
  get: function(key) {
    var entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { this._store.delete(key); return null; }
    return entry.data;
  },
  set: function(key, data, ttlMs) {
    ttlMs = ttlMs || 30000;
    this._store.set(key, { data: data, time: Date.now(), expires: Date.now() + ttlMs });
  },
  invalidate: function(key) { this._store.delete(key); },
  invalidatePrefix: function(prefix) {
    var self = this;
    this._store.forEach(function(_, k) { if (k.startsWith(prefix)) self._store.delete(k); });
  },
  clear: function() { this._store.clear(); }
};

// Cached fetch wrapper
window.cachedFetch = function(url, ttlMs) {
  ttlMs = ttlMs || 30000;
  var cached = Cache.get(url);
  if (cached) return Promise.resolve(cached);
  return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
    Cache.set(url, data, ttlMs);
    return data;
  });
};

// ── Animated Number Counter ──
window.animateValue = function(el, end, duration) {
  if (!el) return;
  duration = duration || 500;
  var start = parseFloat(el.textContent) || 0;
  if (start === end) return;
  var range = end - start;
  var startTime = performance.now();
  var suffix = el.textContent.replace(/[\d.-]/g, '').trim();
  function step(now) {
    var progress = Math.min((now - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = start + range * eased;
    el.textContent = (Math.abs(range) > 10 ? Math.round(current) : current.toFixed(1)) + (suffix || '');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
};

(function () {
  'use strict';

  // ── Global Application State ──
  window.state = {
    currentView: null,
    system: null,
    tickets: [],
    ticketSummary: [],
    activity: [],
    processes: [],
    servers: [],
    claudeRunning: false,
    cpuHistory: [],
    memHistory: []
  };

  // ── View Registry ──
  // Each view JS file registers itself: Views.viewName = { init(), show(), hide(), update(data) }
  window.Views = {};

  // ── Socket.IO Connection ──
  window.socket = io();

  // ── Status Bar Update ──
  function updateStatusBar() {
    var el = document.getElementById('sb-last-update');
    if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString();
  }

  window.socket.on('connect', function () {
    var dot = document.getElementById('sidebar-status-dot');
    var text = document.getElementById('sidebar-status-text');
    if (dot) {
      dot.className = 'status-dot ok';
    }
    if (text) {
      text.textContent = 'Connected';
    }
    // Update status bar connection indicators
    var sbDot = document.getElementById('sb-conn-dot');
    var sbText = document.getElementById('sb-conn-text');
    if (sbDot) sbDot.className = 'status-dot ok';
    if (sbText) sbText.textContent = 'Connected';
    console.log('[Monitor] Socket connected:', window.socket.id);
  });

  window.socket.on('disconnect', function () {
    var dot = document.getElementById('sidebar-status-dot');
    var text = document.getElementById('sidebar-status-text');
    if (dot) {
      dot.className = 'status-dot err';
    }
    if (text) {
      text.textContent = 'Disconnected';
    }
    // Update status bar connection indicators
    var sbDot = document.getElementById('sb-conn-dot');
    var sbText = document.getElementById('sb-conn-text');
    if (sbDot) sbDot.className = 'status-dot err';
    if (sbText) sbText.textContent = 'Disconnected';
    console.log('[Monitor] Socket disconnected');
  });

  window.socket.on('init', function (data) {
    if (data.system) {
      window.state.system = data.system;
    }
    // init emits tickets as getTicketSummary() result: { summary: [], tickets: [] }
    if (data.tickets) {
      var initTickets = data.tickets;
      if (Array.isArray(initTickets)) {
        window.state.tickets = initTickets;
        window.state.ticketSummary = [];
      } else if (initTickets && typeof initTickets === 'object') {
        window.state.tickets = Array.isArray(initTickets.tickets) ? initTickets.tickets : [];
        window.state.ticketSummary = Array.isArray(initTickets.summary) ? initTickets.summary : [];
      }
    }
    if (data.activity) {
      window.state.activity = Array.isArray(data.activity) ? data.activity : [];
    }
    if (data.processes) {
      window.state.processes = Array.isArray(data.processes) ? data.processes : [];
    }
    if (data.servers) {
      window.state.servers = Array.isArray(data.servers) ? data.servers : [];
    }
    // Notify all initialized views
    Object.keys(window.Views).forEach(function (name) {
      var view = window.Views[name];
      if (typeof view.update === 'function') {
        view.update(data);
      }
    });
    // Update ticket badge with initial data
    updateTicketBadge();
    console.log('[Monitor] Init data received');
  });

  window.socket.on('metrics', function (data) {
    // Server emits { system: getSystemInfo(), extended: metrics, ts: Date.now() }
    // getSystemInfo() returns { hostname, platform, arch, cpuCount, cpuModel, cpuPct, totalMemMB, freeMemMB, usedMemMB, memPct }
    var sys = data && data.system ? data.system : data;
    window.state.system = sys;

    // Push to history arrays (max 30 data points)
    if (typeof sys.cpuPct !== 'undefined') {
      window.state.cpuHistory.push(sys.cpuPct);
      if (window.state.cpuHistory.length > 30) {
        window.state.cpuHistory.shift();
      }
    }
    if (typeof sys.usedMemPct !== 'undefined') {
      window.state.memHistory.push(sys.usedMemPct);
      if (window.state.memHistory.length > 30) {
        window.state.memHistory.shift();
      }
    }

    // Update relevant views
    if (window.Views.dashboard && typeof window.Views.dashboard.update === 'function') {
      window.Views.dashboard.update({ system: sys });
    }
    if (window.Views.metrics && typeof window.Views.metrics.update === 'function') {
      window.Views.metrics.update({ system: sys });
    }

    // Update status bar timestamp
    updateStatusBar();
  });

  window.socket.on('tickets', function (data) {
    // Invalidate ticket caches on live update
    Cache.invalidatePrefix('/api/tickets');
    // Server emits getTicketSummary() result: { summary: [], tickets: [] }
    // Also handle legacy array format for backwards compatibility
    var ticketData = Array.isArray(data) ? { tickets: data, summary: [] }
      : (data && typeof data === 'object') ? data : { tickets: [], summary: [] };
    window.state.tickets = Array.isArray(ticketData.tickets) ? ticketData.tickets : [];
    window.state.ticketSummary = Array.isArray(ticketData.summary) ? ticketData.summary : [];
    if (window.Views.tickets && typeof window.Views.tickets.update === 'function') {
      window.Views.tickets.update({ tickets: window.state.tickets, summary: window.state.ticketSummary });
    }
    // Update ticket badge count
    updateTicketBadge();
  });

  window.socket.on('activity', function (data) {
    // Invalidate activity caches on live update
    Cache.invalidatePrefix('/api/activity');
    // Server emits { activity: [...] } — extract the array
    var activityArr = Array.isArray(data) ? data
      : (data && Array.isArray(data.activity)) ? data.activity : [];
    window.state.activity = activityArr;
    if (window.Views.dashboard && typeof window.Views.dashboard.update === 'function') {
      window.Views.dashboard.update({ activity: window.state.activity });
    }
    if (window.Views.activity && typeof window.Views.activity.update === 'function') {
      window.Views.activity.update({ activity: window.state.activity });
    }
  });

  window.socket.on('process_list', function (data) {
    // Invalidate process caches on live update
    Cache.invalidatePrefix('/api/process');
    Cache.invalidatePrefix('/api/pm2');
    // Server emits { processes: [...] } — extract the array
    var procArr = Array.isArray(data) ? data
      : (data && Array.isArray(data.processes)) ? data.processes : [];
    window.state.processes = procArr;
    if (window.Views.pm2 && typeof window.Views.pm2.update === 'function') {
      window.Views.pm2.update({ processes: window.state.processes });
    }
    if (window.Views.dashboard && typeof window.Views.dashboard.update === 'function') {
      window.Views.dashboard.update({ processes: window.state.processes });
    }
  });

  window.socket.on('server_health', function (data) {
    // Invalidate server caches on live update
    Cache.invalidatePrefix('/api/server');
    // Server emits { servers: [...] } — extract the array
    var serverArr = Array.isArray(data) ? data
      : (data && Array.isArray(data.servers)) ? data.servers : [];
    window.state.servers = serverArr;
    if (window.Views.servers && typeof window.Views.servers.update === 'function') {
      window.Views.servers.update({ servers: window.state.servers });
    }
    if (window.Views.dashboard && typeof window.Views.dashboard.update === 'function') {
      window.Views.dashboard.update({ servers: window.state.servers });
    }
  });

  window.socket.on('claude_output', function (data) {
    window.state.claudeRunning = true;
    if (window.Views.claude && typeof window.Views.claude.update === 'function') {
      window.Views.claude.update({ type: 'output', data: data });
    }
  });

  window.socket.on('claude_done', function (data) {
    window.state.claudeRunning = false;
    if (window.Views.claude && typeof window.Views.claude.update === 'function') {
      window.Views.claude.update({ type: 'done', data: data });
    }
  });

  // ── Ticket Badge ──
  function updateTicketBadge() {
    var badge = document.getElementById('ticket-badge');
    if (!badge) return;
    var count = window.state.tickets.length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  // ── View Switching ──
  window.switchView = function (viewName) {
    // Hide all views
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      views[i].classList.remove('active');
    }

    // Call hide() on current view if it exists
    if (window.state.currentView && window.Views[window.state.currentView]) {
      var currentView = window.Views[window.state.currentView];
      if (typeof currentView.hide === 'function') {
        currentView.hide();
      }
    }

    // Show target view
    var targetEl = document.getElementById('view-' + viewName);
    if (targetEl) {
      targetEl.classList.add('active');
    }

    // Update nav active state
    var navItems = document.querySelectorAll('.nav-item');
    for (var j = 0; j < navItems.length; j++) {
      var item = navItems[j];
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    }

    // Update topbar title
    var titleEl = document.getElementById('topbar-title');
    if (titleEl) {
      var titleMap = {
        dashboard: 'Dashboard',
        metrics: 'Metrics',
        uptime: 'Uptime',
        servers: 'Servers',
        docker: 'Docker',
        databases: 'Databases',
        pm2: 'PM2 Processes',
        ssl: 'SSL / Domains',
        terminal: 'Terminal',
        claude: 'Claude',
        tickets: 'Tickets',
        git: 'Git',
        deploy: 'Deploy',
        cron: 'Cron Jobs',
        files: 'File Manager',
        envvars: 'Env Variables',
        security: 'Security Center',
        ftp: 'FTP',
        notifications: 'Notifications',
        logs: 'Logs',
        'multi-server': 'Multi-Server',
        settings: 'Settings'
      };
      titleEl.textContent = titleMap[viewName] || viewName.charAt(0).toUpperCase() + viewName.slice(1);
    }

    // Call show() on target view
    if (window.Views[viewName]) {
      if (typeof window.Views[viewName].show === 'function') {
        window.Views[viewName].show();
      }
    }

    // Update state and persist
    window.state.currentView = viewName;
    try {
      localStorage.setItem('monitor_currentView', viewName);
    } catch (e) {
      // localStorage may be unavailable
    }
  };

  // ── Nav Group Toggle (Collapsible Sections) ──
  window.toggleNavGroup = function (groupId) {
    var group = document.getElementById('nav-group-' + groupId);
    if (!group) return;

    group.classList.toggle('collapsed');

    // Persist collapsed state
    try {
      var collapsed = JSON.parse(localStorage.getItem('monitor_navGroups') || '{}');
      collapsed[groupId] = group.classList.contains('collapsed');
      localStorage.setItem('monitor_navGroups', JSON.stringify(collapsed));
    } catch (e) {
      // localStorage may be unavailable
    }
  };

  // ── Restore Nav Group State from localStorage ──
  function restoreNavGroupState() {
    try {
      var collapsed = JSON.parse(localStorage.getItem('monitor_navGroups') || '{}');
      Object.keys(collapsed).forEach(function (groupId) {
        if (collapsed[groupId]) {
          var group = document.getElementById('nav-group-' + groupId);
          if (group) {
            group.classList.add('collapsed');
          }
        }
      });
    } catch (e) {
      // localStorage may be unavailable
    }
  }

  // ── Topbar Clock ──
  function updateClock() {
    var clockEl = document.getElementById('sidebar-clock');
    if (!clockEl) return;

    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();
    var seconds = now.getSeconds();
    var ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    clockEl.textContent = hours + ':' + minutes + ':' + seconds + ' ' + ampm;
  }

  // ── Refresh Current View ──
  window.refreshCurrentView = function () {
    window.socket.emit('refresh');
    if (window.state.currentView && window.Views[window.state.currentView]) {
      var view = window.Views[window.state.currentView];
      if (typeof view.show === 'function') {
        view.show();
      }
    }
    if (typeof Toast !== 'undefined') {
      Toast.info('Refreshing...');
    }
  };

  // Alias for the existing refreshAll button in HTML
  window.refreshAll = window.refreshAll || window.refreshCurrentView;

  // ── Keyboard Shortcuts ──
  document.addEventListener('keydown', function (e) {
    // Ctrl+K / Cmd+K — Command palette placeholder
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      console.log('[Monitor] Command palette triggered (placeholder)');
      if (typeof Toast !== 'undefined') {
        Toast.info('Command palette coming soon');
      }
    }
  });

  // ── Initialize on DOMContentLoaded ──
  document.addEventListener('DOMContentLoaded', function () {
    // Restore nav group collapsed states
    restoreNavGroupState();

    // Start clock
    updateClock();
    setInterval(updateClock, 1000);

    // Initialize all registered views
    Object.keys(window.Views).forEach(function (name) {
      var view = window.Views[name];
      if (typeof view.init === 'function') {
        view.init();
      }
    });

    // Switch to saved view or default to dashboard
    var savedView;
    try {
      savedView = localStorage.getItem('monitor_currentView');
    } catch (e) {
      savedView = null;
    }
    window.switchView(savedView || 'dashboard');

    console.log('[Monitor] App initialized, views:', Object.keys(window.Views).join(', '));
  });

})();
