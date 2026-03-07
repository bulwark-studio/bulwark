/**
 * Bulwark v2.1 — Main Application Controller
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
    memHistory: [],
    userRole: 'viewer',
    userName: ''
  };

  // ── Load Current User Role ──
  function loadCurrentUser() {
    fetch('/api/me').then(function(r) { return r.json(); }).then(function(u) {
      if (!u || u.error) return;
      window.state.userRole = u.role || 'viewer';
      window.state.userName = u.username || '';
      document.body.setAttribute('data-role', u.role || 'viewer');
      var userEl = document.getElementById('topbar-user');
      if (userEl && u.username) {
        userEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
          u.username + ' <span style="color:var(--text-tertiary)">(' + (u.role || 'viewer') + ')</span>';
      }
    }).catch(function(e) { console.warn('[Monitor] Failed to load user:', e); });
  }
  loadCurrentUser();

  // ── Load Branding ──
  fetch('/api/branding').then(function(r) { return r.json(); }).then(function(b) {
    window.appName = b.name || 'Bulwark';
    var logo = document.querySelector('.sidebar-logo');
    if (logo) logo.textContent = b.name.toUpperCase();
    document.title = b.name;
  }).catch(function() { window.appName = 'Bulwark'; });

  // Helper: check if current user can perform an action
  window.canEdit = function() { return window.state.userRole === 'admin' || window.state.userRole === 'editor'; };
  window.isAdmin = function() { return window.state.userRole === 'admin'; };

  // ── Timezone-aware date formatting ──
  // Loaded from Settings, defaults to browser timezone
  window.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  fetch('/api/settings').then(function(r) { return r.json(); }).then(function(s) {
    if (s.timezone) window.userTimezone = s.timezone;
  }).catch(function() {});

  window.formatDate = function(d, opts) {
    if (!d) return '--';
    var date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '--';
    var defaults = { timeZone: window.userTimezone };
    return date.toLocaleString(undefined, Object.assign(defaults, opts || {}));
  };
  window.formatTime = function(d, opts) {
    if (!d) return '--';
    var date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '--';
    var defaults = { timeZone: window.userTimezone, hour: '2-digit', minute: '2-digit' };
    return date.toLocaleTimeString(undefined, Object.assign(defaults, opts || {}));
  };
  window.formatDateShort = function(d) {
    if (!d) return '--';
    var date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '--';
    return date.toLocaleDateString(undefined, { timeZone: window.userTimezone });
  };

  // ── View Registry ──
  // Each view JS file registers itself: Views.viewName = { init(), show(), hide(), update(data) }
  window.Views = {};

  // ── Socket.IO Connection ──
  window.socket = io();

  window.socket.on('connect_error', function (err) {
    if (err && err.message === 'Unauthorized') {
      console.warn('[Monitor] Socket auth failed — redirecting to login');
      window.location.href = '/login';
    }
  });

  // ── Status Bar Update ──
  function updateStatusBar() {
    var el = document.getElementById('sb-last-update');
    if (el) el.textContent = 'Updated ' + formatTime(new Date(), { second: '2-digit' });
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
    // Check DB status
    fetch('/api/db/info').then(function(r){return r.json();}).then(function(d){
      var dbEl = document.getElementById('sb-db');
      if (dbEl) dbEl.textContent = (d && !d.error && !d.degraded) ? 'DB: ' + (d.database || 'connected') : 'DB: not connected';
    }).catch(function(){ var dbEl = document.getElementById('sb-db'); if (dbEl) dbEl.textContent = 'DB: not connected'; });
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

    // Feed AI anomaly detector
    if (window.AICache) {
      var anomaly = window.AICache.ingestMetrics(sys);
      if (anomaly) {
        // Show anomaly alert on metrics view if visible
        var alertEl = document.getElementById('ai-anomaly-alert');
        if (alertEl) {
          var a = anomaly.anomalies[0];
          var label = a.metric === 'cpu' ? 'CPU' : 'Memory';
          alertEl.innerHTML = '<div class="ai-anomaly-bar">' +
            '<span class="anomaly-icon">⚡</span>' +
            '<span class="anomaly-text">' + label + ' anomaly detected: <b>' + a.value.toFixed(1) + '%</b>' + (a.trend ? ' (' + a.trend + ')' : '') + '</span>' +
            '<button class="anomaly-action" onclick="Views.metrics.runAnalysis(true)">Analyze Now</button>' +
          '</div>';
          setTimeout(function () { if (alertEl) alertEl.innerHTML = ''; }, 15000);
        }
      }
    }

    // Update relevant views
    if (window.Views.dashboard && typeof window.Views.dashboard.update === 'function') {
      window.Views.dashboard.update({ system: sys });
    }
    if (window.Views.metrics && typeof window.Views.metrics.update === 'function') {
      window.Views.metrics.update({ system: sys, extended: data.extended || null });
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
    if (window.Views.uptime && typeof window.Views.uptime.update === 'function') {
      window.Views.uptime.update({ servers: window.state.servers });
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

  window.socket.on('cache_stats', function (data) {
    if (window.Views.cache && typeof window.Views.cache.update === 'function') {
      window.Views.cache.update(data);
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
        settings: 'Settings',
        docs: 'Docs / FAQ'
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

    // Retry user load after DOM ready (in case early fetch raced)
    if (!window.state.userName) loadCurrentUser();

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
