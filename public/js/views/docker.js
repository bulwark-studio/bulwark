// =============================================================================
// Docker Command Center — AI-Powered Container Fleet Management
// =============================================================================
(function () {
  'use strict';

  var containers = [];
  var images = [];
  var networks = [];
  var volumes = [];
  var stats = {};
  var refreshTimer = null;
  var dockerAvailable = false;
  var activeTab = 'containers';
  var serverConfig = {};
  var connections = [];  // All saved infrastructure connections

  Views.docker = {
    init: function () {
      var el = document.getElementById('view-docker');
      if (!el) return;
      el.innerHTML = buildTemplate();
    },
    show: function () {
      this.init();
      checkDocker();
      // Only restore cached AI — never auto-fetch
      if (window.AICache) {
        var restored = window.AICache.restore('docker');
        if (restored) {
          var body = document.getElementById('docker-ai-body');
          if (body) body.textContent = restored.response;
          var fb = document.getElementById('docker-ai-freshness');
          if (fb) fb.innerHTML = window.AICache.freshnessBadge('docker');
        }
      }
      refreshTimer = setInterval(refreshActive, 10000);
    },
    hide: function () {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    },
    update: function () {}
  };

  function buildTemplate() {
    return '<div class="docker-dashboard">' +
      // Connections Manager (always visible)
      '<div class="glass-card" id="docker-connections-panel" style="padding:16px;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="18" height="18"><rect x="2" y="10" width="5" height="5"/><rect x="9" y="10" width="5" height="5"/><rect x="16" y="10" width="5" height="5"/><rect x="5.5" y="4" width="5" height="5"/><rect x="12.5" y="4" width="5" height="5"/><path d="M0 18c3 4 18 4 24 0"/></svg>' +
            '<span style="font-weight:600;color:var(--text-primary);font-size:14px">Infrastructure Connections</span>' +
          '</div>' +
          '<button class="btn btn-sm btn-cyan" onclick="Views.docker.showAddConnection()">+ Add Connection</button>' +
        '</div>' +
        '<div id="docker-connections-list"></div>' +
      '</div>' +
      // AI Analysis
      '<div class="docker-ai-section">' +
        '<div class="briefing-card glass-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="22" height="22"><rect x="2" y="10" width="5" height="5"/><rect x="9" y="10" width="5" height="5"/><rect x="16" y="10" width="5" height="5"/><rect x="5.5" y="4" width="5" height="5"/><rect x="12.5" y="4" width="5" height="5"/><path d="M0 18c3 4 18 4 24 0"/></svg></div>' +
            '<div class="briefing-title">Docker Fleet Intelligence <span id="docker-ai-freshness"></span></div>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.docker.runAI(true)" id="docker-ai-btn">Analyze</button>' +
          '</div>' +
          '<div class="briefing-body" id="docker-ai-body"><span class="text-secondary">Click Analyze for AI-powered container fleet insights.</span></div>' +
        '</div>' +
      '</div>' +
      // Fleet Status Banner
      '<div class="docker-fleet-banner glass-card" id="docker-fleet-banner"></div>' +
      // Tabs
      '<div class="docker-tabs">' +
        tabBtn('containers', 'Containers', true) +
        tabBtn('deploy', 'Deploy') +
        tabBtn('images', 'Images') +
        tabBtn('networks', 'Networks & Volumes') +
        tabBtn('system', 'System') +
        tabBtn('bulwark-ai', 'AI Assistant') +
      '</div>' +
      // Tab panels
      '<div class="docker-tab-panel" id="docker-panel-containers"></div>' +
      '<div class="docker-tab-panel" id="docker-panel-deploy" style="display:none"></div>' +
      '<div class="docker-tab-panel" id="docker-panel-images" style="display:none"></div>' +
      '<div class="docker-tab-panel" id="docker-panel-networks" style="display:none"></div>' +
      '<div class="docker-tab-panel" id="docker-panel-system" style="display:none"></div>' +
      '<div class="docker-tab-panel" id="docker-panel-bulwark-ai" style="display:none"></div>' +
    '</div>';
  }

  function tabBtn(id, label, active) {
    return '<button class="docker-tab-btn' + (active ? ' active' : '') + '" data-tab="' + id + '" onclick="Views.docker.switchTab(\'' + id + '\')">' + label + '</button>';
  }

  Views.docker.switchTab = function (tab) {
    activeTab = tab;
    document.querySelectorAll('.docker-tab-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
    ['containers', 'deploy', 'images', 'networks', 'system', 'bulwark-ai'].forEach(function (t) {
      var p = document.getElementById('docker-panel-' + t);
      if (p) p.style.display = t === tab ? '' : 'none';
    });
    if (tab === 'images' && images.length === 0) loadImages();
    if (tab === 'networks') loadNetworksVolumes();
    if (tab === 'system') loadSystem();
    if (tab === 'bulwark-ai') renderBulwark();
  };

  // ── Docker Status Check ──
  function checkDocker() {
    // Load connections list + status in parallel
    Promise.all([
      fetch('/api/docker/connections').then(function (r) { return r.json(); }),
      fetch('/api/docker/status').then(function (r) { return r.json(); })
    ]).then(function (results) {
      var connData = results[0];
      var statusData = results[1];
      connections = connData.connections || [];
      serverConfig = statusData.config || {};
      serverConfig.serverPlatform = statusData.serverPlatform || connData.serverPlatform || '';
      dockerAvailable = statusData.available;
      renderConnectionsList();
      if (dockerAvailable) {
        loadContainers();
        loadImages();
        renderDeployPanel();
      } else {
        renderUnavailable();
      }
    }).catch(function () {
      connections = [];
      renderConnectionsList();
      renderUnavailable();
    });
  }

  // ── Render Connections List ──
  function renderConnectionsList() {
    var el = document.getElementById('docker-connections-list');
    if (!el) return;
    if (connections.length === 0) {
      el.innerHTML = '<div class="text-tertiary" style="font-size:12px;padding:8px 0">No connections configured. Click "+ Add Connection" to connect to a Docker engine.</div>';
      return;
    }
    el.innerHTML = connections.map(function (c) {
      var addr = c.type === 'remote' ? 'tcp://' + esc(c.host || '') + ':' + (c.port || 2375) : (c.socketPath || '/var/run/docker.sock');
      var statusDot = c.active && dockerAvailable ? '<span style="color:var(--cyan)">●</span>' : c.active ? '<span style="color:var(--orange)">●</span>' : '<span style="color:var(--text-tertiary)">○</span>';
      var statusLabel = c.active && dockerAvailable ? 'Active' : c.active ? 'Unreachable' : 'Inactive';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:rgba(0,0,0,0.2);margin-bottom:6px;border:1px solid ' + (c.active ? 'rgba(34,211,238,0.15)' : 'var(--border)') + '">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            statusDot +
            '<span style="font-weight:600;font-size:13px;color:var(--text-primary)">' + esc(c.name) + '</span>' +
            '<span class="badge badge-ghost" style="font-size:10px">' + esc(c.type) + '</span>' +
            '<span class="badge ' + (c.active && dockerAvailable ? 'badge-cyan' : c.active ? 'badge-orange' : 'badge-ghost') + '" style="font-size:10px">' + statusLabel + '</span>' +
          '</div>' +
          '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);margin-top:3px">' + esc(addr) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          (!c.active ? '<button class="btn btn-sm btn-ghost" onclick="Views.docker.activateConn(\'' + esc(c.id) + '\')" style="font-size:10px;color:var(--cyan);padding:2px 8px" title="Switch to this connection">Activate</button>' : '') +
          '<button class="btn btn-sm btn-ghost" onclick="Views.docker.removeConn(\'' + esc(c.id) + '\')" style="font-size:10px;color:var(--orange);padding:2px 8px" title="Remove connection">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ── Connection Actions ──
  Views.docker.activateConn = function (id) {
    fetch('/api/docker/connections/' + id + '/activate', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.success) {
          Toast.success('Connection activated');
          connections = d.connections || connections;
          dockerAvailable = false;
          containers = []; images = []; networks = []; volumes = []; stats = {};
          checkDocker();
        }
      }).catch(function () { Toast.error('Failed to activate'); });
  };

  Views.docker.removeConn = function (id) {
    var conn = connections.find(function (c) { return c.id === id; });
    Modal.confirm({ title: 'Remove Connection', message: 'Remove "' + (conn ? conn.name : 'this connection') + '"? You can add it back anytime.', confirmText: 'Remove', dangerous: true }).then(function (ok) {
      if (!ok) return;
      fetch('/api/docker/connections/' + id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.success) {
            Toast.success('Connection removed');
            connections = d.connections || [];
            if (connections.length === 0) {
              dockerAvailable = false;
              containers = []; images = []; networks = []; volumes = []; stats = {};
            }
            checkDocker();
          }
        }).catch(function () { Toast.error('Failed to remove'); });
    });
  };

  // ── Add Connection (opens wizard in modal) ──
  Views.docker.showAddConnection = function () {
    var defaultSocket = (serverConfig && serverConfig.socketPath) || '/var/run/docker.sock';
    var platform = serverConfig.serverPlatform || 'unknown';

    Modal.open({
      title: 'Add Infrastructure Connection',
      size: 'lg',
      body:
        '<p class="text-secondary" style="font-size:12px;margin:0 0 16px">Connect to a local or remote Docker engine. Server platform: <strong>' + esc(platform) + '</strong></p>' +
        // Connection Type Picker
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
          '<div class="glass-card" id="modal-conn-local" onclick="Views.docker._pickModalConn(\'local\')" style="cursor:pointer;padding:16px;border:2px solid rgba(34,211,238,0.3);transition:all 0.2s">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' +
              '<span style="color:#22d3ee;font-weight:600;font-size:13px">Local Docker</span>' +
            '</div>' +
            '<p class="text-secondary" style="font-size:11px;margin:0;line-height:1.4">Unix socket or Windows named pipe on this machine.</p>' +
          '</div>' +
          '<div class="glass-card" id="modal-conn-remote" onclick="Views.docker._pickModalConn(\'remote\')" style="cursor:pointer;padding:16px;border:2px solid transparent;transition:all 0.2s">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
              '<span style="color:var(--text-primary);font-weight:600;font-size:13px">Remote Docker</span>' +
            '</div>' +
            '<p class="text-secondary" style="font-size:11px;margin:0;line-height:1.4">Docker Engine on a remote server via TCP.</p>' +
          '</div>' +
        '</div>' +
        // Name
        '<label style="display:block;margin-bottom:12px">' +
          '<span class="text-secondary" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Connection Name</span>' +
          '<input type="text" id="modal-conn-name" class="form-input" placeholder="e.g. Production Server" style="font-size:12px">' +
        '</label>' +
        // Local form
        '<div id="modal-form-local">' +
          '<label style="display:block;margin-bottom:12px">' +
            '<span class="text-secondary" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Socket Path</span>' +
            '<input type="text" id="modal-socket-input" class="form-input" value="' + esc(defaultSocket) + '" style="font-family:var(--font-mono);font-size:12px">' +
          '</label>' +
        '</div>' +
        // Remote form
        '<div id="modal-form-remote" style="display:none">' +
          '<div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px">' +
            '<label>' +
              '<span class="text-secondary" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Host / IP</span>' +
              '<input type="text" id="modal-host-input" class="form-input" placeholder="192.168.1.100" style="font-family:var(--font-mono);font-size:12px">' +
            '</label>' +
            '<label>' +
              '<span class="text-secondary" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Port</span>' +
              '<input type="number" id="modal-port-input" class="form-input" value="2375" style="font-family:var(--font-mono);font-size:12px">' +
            '</label>' +
          '</div>' +
        '</div>' +
        // Status
        '<div id="modal-conn-status" style="font-size:12px;font-family:var(--font-mono);min-height:20px;margin-bottom:8px"></div>',
      footer:
        '<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>' +
        '<button class="btn btn-cyan" id="modal-test-btn" onclick="Views.docker._testModalConn()">Test Connection</button>' +
        '<button class="btn btn-cyan" id="modal-save-btn" onclick="Views.docker._saveModalConn()" style="display:none">Save & Connect</button>'
    });
    Views.docker._modalConnType = 'local';
  };

  Views.docker._pickModalConn = function (type) {
    Views.docker._modalConnType = type;
    var local = document.getElementById('modal-conn-local');
    var remote = document.getElementById('modal-conn-remote');
    var formLocal = document.getElementById('modal-form-local');
    var formRemote = document.getElementById('modal-form-remote');
    if (type === 'local') {
      if (local) local.style.borderColor = 'rgba(34,211,238,0.3)';
      if (remote) remote.style.borderColor = 'transparent';
      if (formLocal) formLocal.style.display = '';
      if (formRemote) formRemote.style.display = 'none';
    } else {
      if (local) local.style.borderColor = 'transparent';
      if (remote) remote.style.borderColor = 'rgba(34,211,238,0.3)';
      if (formLocal) formLocal.style.display = 'none';
      if (formRemote) formRemote.style.display = '';
    }
    var s = document.getElementById('modal-conn-status');
    if (s) s.innerHTML = '';
    var sb = document.getElementById('modal-save-btn');
    if (sb) sb.style.display = 'none';
  };

  Views.docker._testModalConn = function () {
    var btn = document.getElementById('modal-test-btn');
    var status = document.getElementById('modal-conn-status');
    var type = Views.docker._modalConnType;
    var config = { type: type };

    if (type === 'remote') {
      config.host = (document.getElementById('modal-host-input') || {}).value || '';
      config.port = parseInt((document.getElementById('modal-port-input') || {}).value) || 2375;
      if (!config.host) { if (status) status.innerHTML = '<span style="color:#ff6b2b">Enter a host address</span>'; return; }
    } else {
      config.socketPath = (document.getElementById('modal-socket-input') || {}).value || '';
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Testing...'; }
    if (status) status.innerHTML = '<span class="text-secondary">Connecting...</span>';

    fetch('/api/docker/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; }
      if (d.success) {
        if (status) status.innerHTML = '<span style="color:#22d3ee">✓ Connected — Docker ' + esc(d.version) + ' (' + esc(d.os) + ')</span>';
        var sb = document.getElementById('modal-save-btn');
        if (sb) sb.style.display = '';
        Views.docker._testedModalConfig = config;
      } else {
        if (status) status.innerHTML = '<span style="color:#ff6b2b">✗ ' + esc(d.error || 'Connection failed') + '</span>';
      }
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; }
      if (status) status.innerHTML = '<span style="color:#ff6b2b">✗ Network error</span>';
    });
  };

  Views.docker._saveModalConn = function () {
    var config = Views.docker._testedModalConfig;
    if (!config) return;
    var name = (document.getElementById('modal-conn-name') || {}).value || '';

    fetch('/api/docker/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || (config.host ? 'Remote ' + config.host : 'Local Docker'),
        type: config.type,
        socketPath: config.socketPath || null,
        host: config.host || null,
        port: config.port || null
      })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.success) {
        Modal.close();
        Toast.success('Connection added');
        connections = d.connections || [];
        checkDocker();
      } else {
        Toast.error('Failed to save: ' + (d.error || 'Unknown'));
      }
    }).catch(function () { Toast.error('Failed to save connection'); });
  };


  function renderUnavailable() {
    var el = document.getElementById('docker-panel-containers');
    if (!el) return;
    var hasConns = connections.length > 0;
    el.innerHTML =
      '<div style="text-align:center;padding:40px 20px">' +
        '<svg viewBox="0 0 48 48" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" width="48" height="48" style="margin-bottom:16px;opacity:0.5"><rect x="4" y="20" width="10" height="10"/><rect x="18" y="20" width="10" height="10"/><rect x="32" y="20" width="10" height="10"/><rect x="11" y="8" width="10" height="10"/><rect x="25" y="8" width="10" height="10"/><path d="M0 36c6 8 36 8 48 0"/></svg>' +
        '<h3 style="color:var(--text-primary);margin:0 0 8px">' + (hasConns ? 'Docker Unreachable' : 'No Connections') + '</h3>' +
        '<p class="text-secondary" style="font-size:13px;margin:0 0 16px">' +
          (hasConns ? 'The active connection can\'t reach Docker. Check that the daemon is running.' : 'Add a Docker engine connection using the panel above.') +
        '</p>' +
        (hasConns ? '' : '<button class="btn btn-cyan" onclick="Views.docker.showAddConnection()">+ Add Connection</button>') +
      '</div>';
    // Hide fleet banner when unavailable
    var banner = document.getElementById('docker-fleet-banner');
    if (banner) banner.style.display = 'none';
  }

  // Legacy disconnect (kept for backward compat)
  Views.docker.disconnect = function () {
    if (connections.length === 0) return;
    var active = connections.find(function (c) { return c.active; });
    if (active) Views.docker.removeConn(active.id);
  };

  function refreshActive() {
    if (!dockerAvailable) return;
    if (activeTab === 'containers') loadContainers();
  }

  // ── Containers ──
  function loadContainers() {
    fetch('/api/docker/containers?all=true').then(function (r) { return r.json(); }).then(function (d) {
      containers = d.containers || [];
      renderFleetBanner();
      renderContainers();
      // Load stats for running containers
      containers.filter(function (c) { return c.state === 'running'; }).slice(0, 20).forEach(function (c) {
        fetch('/api/docker/containers/' + c.id + '/stats').then(function (r) { return r.json(); }).then(function (s) {
          if (s && !s.error) {
            stats[c.id] = s;
            updateContainerCard(c.id, s);
          }
        }).catch(function () {});
      });
    }).catch(function () {});
  }

  function renderFleetBanner() {
    var el = document.getElementById('docker-fleet-banner');
    if (!el) return;
    el.style.display = '';
    var running = containers.filter(function (c) { return c.state === 'running'; }).length;
    var stopped = containers.filter(function (c) { return c.state !== 'running'; }).length;
    var totalCpu = 0, totalMem = 0;
    Object.values(stats).forEach(function (s) { totalCpu += s.cpuPct || 0; totalMem += parseFloat(s.memUsageMB) || 0; });

    el.innerHTML =
      '<div class="fleet-stats">' +
        fleetStat(containers.length, 'Total', '') +
        fleetStat(running, 'Running', 'cyan') +
        fleetStat(stopped, 'Stopped', stopped > 0 ? 'orange' : '') +
        fleetStat(totalCpu.toFixed(1) + '%', 'CPU', '') +
        fleetStat(totalMem.toFixed(0) + ' MB', 'Memory', '') +
      '</div>';
  }

  function fleetStat(value, label, color) {
    var style = color ? ' style="color:var(--' + color + ')"' : '';
    return '<div class="fleet-stat"><div class="fleet-stat-value"' + style + '>' + value + '</div><div class="fleet-stat-label">' + label + '</div></div>';
  }

  function renderContainers() {
    var el = document.getElementById('docker-panel-containers');
    if (!el) return;
    if (containers.length === 0) {
      el.innerHTML = '<div class="empty-state text-secondary">No containers found</div>';
      return;
    }
    el.innerHTML = '<div class="docker-container-grid">' + containers.map(function (c) {
      var running = c.state === 'running';
      var s = stats[c.id];
      return '<div class="docker-container-card glass-card" id="dc-' + c.shortId + '">' +
        '<div class="dc-header">' +
          '<span class="dot ' + (running ? 'dot-healthy' : 'dot-unhealthy') + '"></span>' +
          '<span class="dc-name">' + esc(c.name) + '</span>' +
          '<span class="dc-state ' + (running ? 'state-running' : 'state-stopped') + '">' + c.state + '</span>' +
        '</div>' +
        '<div class="dc-image">' + esc(c.image) + '</div>' +
        '<div class="dc-status">' + esc(c.status) + '</div>' +
        // Stats gauges
        '<div class="dc-gauges" id="dc-gauges-' + c.shortId + '">' +
          (s ? gaugeRow(s) : '<span class="text-tertiary" style="font-size:10px">' + (running ? 'Loading stats...' : 'Stopped') + '</span>') +
        '</div>' +
        // Ports
        (c.ports.length > 0 ? '<div class="dc-ports">' + c.ports.filter(function (p) { return p.publicPort; }).map(function (p) {
          return '<span class="dc-port-badge">' + (p.publicPort || '') + ':' + p.privatePort + '/' + p.type + '</span>';
        }).join('') + '</div>' : '') +
        // Mounts
        (c.mounts.length > 0 ? '<div class="dc-mounts">' + c.mounts.slice(0, 2).map(function (m) {
          return '<span class="dc-mount-badge" title="' + esc(m.source) + ' → ' + esc(m.destination) + '">' + esc(shortPath(m.destination)) + '</span>';
        }).join('') + (c.mounts.length > 2 ? '<span class="dc-mount-badge">+' + (c.mounts.length - 2) + '</span>' : '') + '</div>' : '') +
        // Networks
        (c.networks.length > 0 ? '<div class="dc-nets">' + c.networks.map(function (n) {
          return '<span class="dc-net-badge">' + esc(n) + '</span>';
        }).join('') + '</div>' : '') +
        // Actions
        '<div class="dc-actions">' +
          (running
            ? '<button class="btn btn-sm" onclick="Views.docker.action(\'' + c.id + '\',\'stop\')">Stop</button>' +
              '<button class="btn btn-sm" onclick="Views.docker.action(\'' + c.id + '\',\'restart\')">Restart</button>'
            : '<button class="btn btn-sm btn-primary" onclick="Views.docker.action(\'' + c.id + '\',\'start\')">Start</button>') +
          '<button class="btn btn-sm" onclick="Views.docker.logs(\'' + c.id + '\',\'' + esc(c.name) + '\')">Logs</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="Views.docker.remove(\'' + c.id + '\',\'' + esc(c.name) + '\')">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function gaugeRow(s) {
    return '<div class="dc-gauge">' + miniGauge(s.cpuPct, 'CPU', s.cpuPct.toFixed(1) + '%') + '</div>' +
      '<div class="dc-gauge">' + miniGauge(parseFloat(s.memPct), 'MEM', s.memUsageMB + 'MB') + '</div>' +
      '<div class="dc-net-io"><span title="Download">↓' + s.netRxFormatted + '</span><span title="Upload">↑' + s.netTxFormatted + '</span></div>';
  }

  function miniGauge(pct, label, text) {
    pct = Math.min(100, Math.max(0, pct || 0));
    var r = 18, circ = 2 * Math.PI * r;
    var offset = circ - (circ * pct / 100);
    var color = pct > 80 ? 'var(--orange)' : 'var(--cyan)';
    return '<svg viewBox="0 0 44 44" width="44" height="44">' +
      '<circle cx="22" cy="22" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>' +
      '<circle cx="22" cy="22" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="4" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" transform="rotate(-90 22 22)"/>' +
      '<text x="22" y="20" text-anchor="middle" fill="var(--text-primary)" font-size="9" font-weight="600">' + Math.round(pct) + '%</text>' +
      '<text x="22" y="30" text-anchor="middle" fill="var(--text-tertiary)" font-size="7">' + label + '</text>' +
    '</svg>';
  }

  function updateContainerCard(id, s) {
    var c = containers.find(function (c) { return c.id === id; });
    if (!c) return;
    var el = document.getElementById('dc-gauges-' + c.shortId);
    if (el) el.innerHTML = gaugeRow(s);
  }

  // ── Container Actions ──
  Views.docker.action = function (id, action) {
    if (window.Toast) Toast.info(action + 'ing container...');
    fetch('/api/docker/containers/' + id + '/' + action, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Container ' + action + 'ed');
        setTimeout(loadContainers, 1500);
      })
      .catch(function () { Toast.error('Failed to ' + action); });
  };

  Views.docker.remove = function (id, name) {
    if (!confirm('Remove container "' + name + '"? This cannot be undone.')) return;
    fetch('/api/docker/containers/' + id + '?force=true', { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Container removed');
        setTimeout(loadContainers, 1000);
      })
      .catch(function () { Toast.error('Failed to remove'); });
  };

  // ── Logs Viewer ──
  Views.docker.logs = function (id, name) {
    var overlay = Modal.open({
      title: 'Logs: ' + name,
      size: 'xl',
      body: '<div class="docker-logs-controls">' +
        '<select id="docker-logs-tail" onchange="Views.docker.reloadLogs(\'' + id + '\')" class="input" style="width:auto">' +
          '<option value="100">100 lines</option><option value="500" selected>500 lines</option><option value="1000">1000 lines</option><option value="5000">5000 lines</option>' +
        '</select>' +
        '<label style="display:flex;align-items:center;gap:4px;color:var(--text-secondary);font-size:11px"><input type="checkbox" id="docker-logs-autoscroll" checked> Auto-scroll</label>' +
        '<input type="text" id="docker-logs-search" class="input" placeholder="Search logs..." style="width:200px" oninput="Views.docker.filterLogs()">' +
      '</div>' +
      '<pre class="docker-logs-pre" id="docker-logs-content">Loading...</pre>'
    });
    Views.docker._logsId = id;
    Views.docker._logsRaw = '';
    Views.docker.reloadLogs(id);
  };

  Views.docker.reloadLogs = function (id) {
    var tailEl = document.getElementById('docker-logs-tail');
    var tail = tailEl ? tailEl.value : 500;
    var el = document.getElementById('docker-logs-content');
    if (el) el.textContent = 'Loading...';
    fetch('/api/docker/containers/' + id + '/logs?tail=' + tail)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        Views.docker._logsRaw = d.logs || '';
        Views.docker.filterLogs();
        var autoscroll = document.getElementById('docker-logs-autoscroll');
        if (autoscroll && autoscroll.checked && el) el.scrollTop = el.scrollHeight;
      })
      .catch(function () { if (el) el.textContent = 'Failed to load logs'; });
  };

  Views.docker.filterLogs = function () {
    var el = document.getElementById('docker-logs-content');
    var searchEl = document.getElementById('docker-logs-search');
    if (!el) return;
    var raw = Views.docker._logsRaw || '';
    var search = searchEl ? searchEl.value.toLowerCase() : '';
    if (search) {
      var lines = raw.split('\n').filter(function (l) { return l.toLowerCase().indexOf(search) >= 0; });
      el.textContent = lines.join('\n') || 'No matches';
    } else {
      el.textContent = raw;
    }
  };

  // ── Deploy Panel ──
  function renderDeployPanel() {
    var el = document.getElementById('docker-panel-deploy');
    if (!el) return;
    el.innerHTML = '<div class="glass-card docker-deploy-form">' +
      '<h3 style="color:var(--text-primary);margin-bottom:16px">Deploy Container</h3>' +
      '<div class="deploy-presets">' +
        '<span class="text-secondary" style="font-size:11px;margin-right:8px">Presets:</span>' +
        presetBtn('Node.js', 'node', '18-alpine', '3000:3000') +
        presetBtn('PostgreSQL', 'postgres', '17-alpine', '5432:5432') +
        presetBtn('Redis', 'redis', '7-alpine', '6379:6379') +
        presetBtn('Nginx', 'nginx', 'alpine', '80:80') +
      '</div>' +
      '<div class="deploy-fields">' +
        '<div class="deploy-row"><label>Image</label><input type="text" id="deploy-image" class="input" placeholder="node:18-alpine"></div>' +
        '<div class="deploy-row"><label>Name</label><input type="text" id="deploy-name" class="input" placeholder="my-container"></div>' +
        '<div class="deploy-row"><label>Ports</label><input type="text" id="deploy-ports" class="input" placeholder="8080:80, 443:443"></div>' +
        '<div class="deploy-row"><label>Env Vars</label><textarea id="deploy-env" class="input" rows="3" placeholder="KEY=value (one per line)"></textarea></div>' +
        '<div class="deploy-row"><label>Volumes</label><input type="text" id="deploy-volumes" class="input" placeholder="/host/path:/container/path"></div>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="Views.docker.deploy()" id="deploy-btn">Deploy</button>' +
    '</div>';
  }

  function presetBtn(label, image, tag, ports) {
    return '<button class="btn btn-sm btn-ghost" onclick="Views.docker.applyPreset(\'' + image + '\',\'' + tag + '\',\'' + ports + '\')">' + label + '</button>';
  }

  Views.docker.applyPreset = function (image, tag, ports) {
    setVal('deploy-image', image + ':' + tag);
    setVal('deploy-name', image + '-' + Date.now().toString(36).slice(-4));
    setVal('deploy-ports', ports);
  };

  Views.docker.deploy = function () {
    var image = getVal('deploy-image');
    if (!image) { Toast.error('Image required'); return; }
    var config = {
      image: image,
      name: getVal('deploy-name') || undefined,
      ports: getVal('deploy-ports').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      env: getVal('deploy-env').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      volumes: getVal('deploy-volumes').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    };
    var btn = document.getElementById('deploy-btn');
    btn.disabled = true; btn.textContent = 'Deploying...';
    fetch('/api/docker/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).then(function (r) { return r.json(); }).then(function (d) {
      btn.disabled = false; btn.textContent = 'Deploy';
      if (d.success || d.status === 201) {
        Toast.success('Container deployed!');
        Views.docker.switchTab('containers');
        setTimeout(loadContainers, 1500);
      } else {
        Toast.error(d.error || d.data?.message || 'Deploy failed');
      }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Deploy'; Toast.error('Deploy failed'); });
  };

  // ── Images ──
  function loadImages() {
    var el = document.getElementById('docker-panel-images');
    if (!el) return;
    fetch('/api/docker/images').then(function (r) { return r.json(); }).then(function (d) {
      images = d.images || [];
      var html = '<div class="docker-images-header">' +
        '<div class="docker-pull-form">' +
          '<input type="text" id="docker-pull-input" class="input" placeholder="Image name (e.g. nginx:alpine)">' +
          '<button class="btn btn-sm btn-primary" onclick="Views.docker.pullImage()">Pull</button>' +
        '</div>' +
      '</div>';
      if (images.length === 0) {
        html += '<div class="text-secondary" style="padding:20px">No images found</div>';
      } else {
        html += '<div class="table-wrap"><table class="docker-images-table"><thead><tr><th>Repository</th><th>Tag</th><th>Size</th><th>Created</th><th></th></tr></thead><tbody>';
        images.forEach(function (img) {
          html += '<tr><td>' + esc(img.repo) + '</td><td>' + esc(img.tag) + '</td>' +
            '<td>' + img.sizeFormatted + '</td>' +
            '<td class="text-tertiary">' + (img.created ? new Date(img.created * 1000).toLocaleDateString() : '--') + '</td>' +
            '<td><button class="btn btn-sm btn-ghost" onclick="Views.docker.removeImage(\'' + esc(img.id) + '\')">Remove</button></td></tr>';
        });
        html += '</tbody></table></div>';
      }
      el.innerHTML = html;
    }).catch(function () {});
  }

  Views.docker.pullImage = function () {
    var input = document.getElementById('docker-pull-input');
    if (!input || !input.value.trim()) return;
    var parts = input.value.trim().split(':');
    Toast.info('Pulling ' + input.value.trim() + '...');
    fetch('/api/docker/images/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: parts[0], tag: parts[1] || 'latest' }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.success) { Toast.success('Image pulled'); loadImages(); }
      else Toast.error(d.error || 'Pull failed');
    }).catch(function () { Toast.error('Pull failed'); });
  };

  Views.docker.removeImage = function (id) {
    if (!confirm('Remove this image?')) return;
    fetch('/api/docker/images/' + id + '?force=true', { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.success) { Toast.success('Image removed'); loadImages(); }
        else Toast.error(d.error || 'Remove failed');
      }).catch(function () { Toast.error('Failed'); });
  };

  // ── Networks & Volumes ──
  function loadNetworksVolumes() {
    var el = document.getElementById('docker-panel-networks');
    if (!el) return;
    Promise.all([
      fetch('/api/docker/networks').then(function (r) { return r.json(); }),
      fetch('/api/docker/volumes').then(function (r) { return r.json(); }),
    ]).then(function (results) {
      networks = results[0].networks || [];
      volumes = results[1].volumes || [];
      var html = '<div class="docker-nv-grid">';
      // Networks
      html += '<div class="glass-card docker-nv-panel"><div class="card-header">Networks (' + networks.length + ')</div>';
      if (networks.length > 0) {
        html += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Driver</th><th>Subnet</th><th>Containers</th></tr></thead><tbody>';
        networks.forEach(function (n) {
          html += '<tr><td>' + esc(n.name) + '</td><td class="text-tertiary">' + esc(n.driver) + '</td><td class="text-tertiary">' + esc(n.subnet || '--') + '</td><td>' + n.containers + '</td></tr>';
        });
        html += '</tbody></table></div>';
      } else { html += '<div class="text-secondary" style="padding:12px">No networks</div>'; }
      html += '</div>';
      // Volumes
      html += '<div class="glass-card docker-nv-panel"><div class="card-header">Volumes (' + volumes.length + ')</div>';
      if (volumes.length > 0) {
        html += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Driver</th><th>Mount Point</th></tr></thead><tbody>';
        volumes.forEach(function (v) {
          html += '<tr><td>' + esc(v.name.length > 20 ? v.name.slice(0, 20) + '...' : v.name) + '</td><td class="text-tertiary">' + esc(v.driver) + '</td><td class="text-tertiary" style="font-size:10px">' + esc(shortPath(v.mountpoint)) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      } else { html += '<div class="text-secondary" style="padding:12px">No volumes</div>'; }
      html += '</div></div>';
      el.innerHTML = html;
    }).catch(function () {});
  }

  // ── AI Analysis ──
  Views.docker.runAI = function (force) {
    var btn = document.getElementById('docker-ai-btn');
    var body = document.getElementById('docker-ai-body');
    if (!btn || !body) return;
    if (!force && window.AICache) {
      var restored = window.AICache.restore('docker');
      if (restored) {
        body.textContent = restored.response;
        var fb = document.getElementById('docker-ai-freshness');
        if (fb) fb.innerHTML = window.AICache.freshnessBadge('docker');
        return;
      }
      return; // No cache and not forced — wait for user click
    }
    if (!force) return;
    btn.disabled = true; btn.textContent = 'Analyzing...';
    body.innerHTML = '<span class="text-secondary">Analyzing container fleet...</span>';
    fetch('/api/docker/ai-analysis').then(function (r) { return r.json(); }).then(function (d) {
      btn.disabled = false; btn.textContent = 'Analyze';
      if (d.analysis) {
        typewriter(body, d.analysis);
        if (window.AICache) {
          window.AICache.set('docker', {}, d.analysis);
          var fb = document.getElementById('docker-ai-freshness');
          if (fb) fb.innerHTML = window.AICache.freshnessBadge('docker');
        }
      } else { body.innerHTML = '<span class="text-secondary">Analysis unavailable</span>'; }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Analyze'; });
  };

  // ── System Tab ──
  var systemLoaded = false;
  function loadSystem() {
    var el = document.getElementById('docker-panel-system');
    if (!el) return;
    if (!systemLoaded) {
      el.innerHTML = '<div class="docker-system-grid">' +
        '<div class="glass-card docker-sys-info" id="docker-sys-info"><div class="card-header">Docker Engine</div><div class="text-secondary" style="padding:12px">Loading...</div></div>' +
        '<div class="glass-card docker-sys-disk" id="docker-sys-disk"><div class="card-header">Disk Usage</div><div class="text-secondary" style="padding:12px">Loading...</div></div>' +
        '<div class="glass-card docker-sys-prune" id="docker-sys-prune"><div class="card-header">Cleanup Operations</div>' +
          '<div class="docker-prune-grid">' +
            '<button class="btn btn-sm btn-ghost docker-prune-btn" onclick="Views.docker.prune(\'containers\')"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="12" height="10" rx="1"/><path d="M5 4V2h6v2"/></svg> Containers</button>' +
            '<button class="btn btn-sm btn-ghost docker-prune-btn" onclick="Views.docker.prune(\'images\')"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="8" cy="8" r="3"/></svg> Images</button>' +
            '<button class="btn btn-sm btn-ghost docker-prune-btn" onclick="Views.docker.prune(\'volumes\')"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2h10v12H3z"/><path d="M3 6h10M3 10h10"/></svg> Volumes</button>' +
            '<button class="btn btn-sm btn-ghost docker-prune-btn" onclick="Views.docker.prune(\'networks\')"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="4" cy="4" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><path d="M4 6v2l4 4m4-8v2l-4 4"/></svg> Networks</button>' +
            '<button class="btn btn-sm btn-ghost docker-prune-btn" onclick="Views.docker.prune(\'buildcache\')"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4l6-2 6 2v8l-6 2-6-2z"/><path d="M2 4l6 2 6-2"/></svg> Build Cache</button>' +
            '<button class="btn btn-sm btn-orange docker-prune-btn" onclick="Views.docker.systemPrune()"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2l12 12M14 2L2 14"/></svg> System Prune</button>' +
          '</div>' +
        '</div>' +
      '</div>';
      systemLoaded = true;
    }
    fetchSystemInfo();
    fetchDiskUsage();
  }

  function fetchSystemInfo() {
    fetch('/api/docker/system/info').then(function (r) { return r.json(); }).then(function (d) {
      var el = document.getElementById('docker-sys-info');
      if (!el) return;
      var v = d.version || {};
      var info = d.info || {};
      el.innerHTML = '<div class="card-header">Docker Engine</div>' +
        '<div class="docker-info-grid">' +
          infoRow('Version', v.Version || '--') +
          infoRow('API', v.ApiVersion || '--') +
          infoRow('OS/Arch', (v.Os || '--') + '/' + (v.Arch || '--')) +
          infoRow('Kernel', v.KernelVersion || '--') +
          infoRow('CPUs', (info.NCPU || '--') + ' cores') +
          infoRow('Memory', info.MemTotal ? fmtBytes(info.MemTotal) : '--') +
          infoRow('Driver', info.Driver || '--') +
          infoRow('Containers', (info.Containers || 0) + ' (' + (info.ContainersRunning || 0) + ' running)') +
          infoRow('Images', info.Images || 0) +
        '</div>';
    }).catch(function () {});
  }

  function fetchDiskUsage() {
    fetch('/api/docker/system/df').then(function (r) { return r.json(); }).then(function (d) {
      var el = document.getElementById('docker-sys-disk');
      if (!el) return;
      var sections = [
        { label: 'Images', total: sumSize(d.Images), reclaimable: sumReclaimable(d.Images), count: (d.Images || []).length },
        { label: 'Containers', total: sumSize(d.Containers), reclaimable: sumReclaimable(d.Containers), count: (d.Containers || []).length },
        { label: 'Volumes', total: sumVolSize(d.Volumes), reclaimable: sumVolReclaimable(d.Volumes), count: (d.Volumes || []).length },
        { label: 'Build Cache', total: sumSize(d.BuildCache), reclaimable: sumReclaimable(d.BuildCache), count: (d.BuildCache || []).length },
      ];
      var grandTotal = sections.reduce(function (a, s) { return a + s.total; }, 0);
      var html = '<div class="card-header">Disk Usage <span class="text-tertiary" style="font-size:11px;font-weight:400">Total: ' + fmtBytes(grandTotal) + '</span></div>';
      sections.forEach(function (s) {
        var pct = grandTotal > 0 ? Math.round(s.total / grandTotal * 100) : 0;
        html += '<div class="docker-disk-row">' +
          '<div class="docker-disk-label">' + s.label + ' <span class="text-tertiary">(' + s.count + ')</span></div>' +
          '<div class="docker-disk-bar-wrap"><div class="docker-disk-bar" style="width:' + pct + '%;background:var(--cyan)"></div></div>' +
          '<div class="docker-disk-size">' + fmtBytes(s.total) + '</div>' +
          '<div class="docker-disk-reclaim text-tertiary">' + fmtBytes(s.reclaimable) + ' reclaimable</div>' +
        '</div>';
      });
      el.innerHTML = html;
    }).catch(function () {});
  }

  function infoRow(label, val) {
    return '<div class="docker-info-row"><span class="text-secondary">' + label + '</span><span class="text-primary">' + esc(String(val)) + '</span></div>';
  }
  function sumSize(arr) { return (arr || []).reduce(function (a, i) { return a + (i.Size || i.SizeRw || 0); }, 0); }
  function sumReclaimable(arr) { return (arr || []).reduce(function (a, i) { return a + (i.Reclaimable || i.SizeRootFs || 0); }, 0); }
  function sumVolSize(v) { return (v && v.Volumes || v || []).reduce(function (a, i) { return a + (i.UsageData ? i.UsageData.Size : 0); }, 0); }
  function sumVolReclaimable(v) { return (v && v.Volumes || v || []).reduce(function (a, i) { return a + (i.UsageData && i.UsageData.RefCount === 0 ? i.UsageData.Size : 0); }, 0); }
  function fmtBytes(b) {
    if (!b || b <= 0) return '0 B';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
  }

  Views.docker.prune = function (type) {
    if (!confirm('Prune ' + type + '? This removes unused ' + type + '.')) return;
    fetch('/api/docker/prune/' + type, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.success) { Toast.success(type + ' pruned successfully'); fetchDiskUsage(); }
        else Toast.error(d.error || 'Prune failed');
      }).catch(function () { Toast.error('Prune failed'); });
  };

  Views.docker.systemPrune = function () {
    if (!confirm('System Prune removes ALL unused containers, networks, images, and optionally volumes. Continue?')) return;
    var inclVol = confirm('Also prune volumes? (This deletes unused volume data!)');
    fetch('/api/docker/system/prune', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ includeVolumes: inclVol }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.success) { Toast.success('System pruned'); fetchDiskUsage(); loadContainers(); loadImages(); }
        else Toast.error(d.error || 'System prune failed');
      }).catch(function () { Toast.error('System prune failed'); });
  };

  // ── AI Assistant — Conversational Docker Management ──
  var bulwarkInited = false;
  var bulwarkHistory = [];

  function renderBulwark() {
    var el = document.getElementById('docker-panel-bulwark-ai');
    if (!el) return;
    if (!bulwarkInited) {
      el.innerHTML =
        '<div class="docker-bulwark">' +
          '<div class="glass-card docker-bulwark-header">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              '<div class="docker-bulwark-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="28" height="28"><circle cx="12" cy="12" r="10"/><path d="M8 9h0M16 9h0M9 15c1.5 1.5 4.5 1.5 6 0"/></svg></div>' +
              '<div><div style="color:var(--text-primary);font-weight:600;font-size:15px">Bulwark AI</div>' +
              '<div class="text-tertiary" style="font-size:11px">Docker fleet intelligence — natural language container management</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="docker-bulwark-chat" id="bulwark-chat">' +
            '<div class="bulwark-msg bulwark-system">I\'m Bulwark, your AI Docker assistant. Ask me anything about your containers, images, or fleet health. Try:<br>' +
              '<span class="bulwark-suggestion" onclick="Views.docker.bulwarkSend(\'Show me container resource usage\')">Show me container resource usage</span>' +
              '<span class="bulwark-suggestion" onclick="Views.docker.bulwarkSend(\'Which containers should I clean up?\')">Which containers should I clean up?</span>' +
              '<span class="bulwark-suggestion" onclick="Views.docker.bulwarkSend(\'Analyze my Docker disk usage\')">Analyze my Docker disk usage</span>' +
              '<span class="bulwark-suggestion" onclick="Views.docker.bulwarkSend(\'Are any containers unhealthy?\')">Are any containers unhealthy?</span>' +
            '</div>' +
          '</div>' +
          '<div class="docker-bulwark-input">' +
            '<input type="text" id="bulwark-input" placeholder="Ask Bulwark about your Docker fleet..." onkeydown="if(event.key===\'Enter\')Views.docker.bulwarkSend()" />' +
            '<button class="btn btn-sm btn-cyan" onclick="Views.docker.bulwarkSend()" id="bulwark-send-btn">Send</button>' +
          '</div>' +
        '</div>';
      bulwarkInited = true;
    }
  }

  Views.docker.bulwarkSend = function (preset) {
    var input = document.getElementById('bulwark-input');
    var chat = document.getElementById('bulwark-chat');
    var btn = document.getElementById('bulwark-send-btn');
    var msg = preset || (input ? input.value.trim() : '');
    if (!msg || !chat) return;
    if (input) input.value = '';

    // Add user message
    chat.innerHTML += '<div class="bulwark-msg bulwark-user">' + esc(msg) + '</div>';
    var responseDiv = document.createElement('div');
    responseDiv.className = 'bulwark-msg bulwark-assistant';
    responseDiv.innerHTML = '<span class="text-secondary bulwark-thinking">Analyzing fleet...</span>';
    chat.appendChild(responseDiv);
    chat.scrollTop = chat.scrollHeight;
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    // Gather context then ask Claude
    Promise.all([
      fetch('/api/docker/containers?all=true').then(function (r) { return r.json(); }).catch(function () { return { containers: [] }; }),
      fetch('/api/docker/images').then(function (r) { return r.json(); }).catch(function () { return { images: [] }; }),
      fetch('/api/docker/system/df').then(function (r) { return r.json(); }).catch(function () { return {}; }),
      fetch('/api/docker/system/info').then(function (r) { return r.json(); }).catch(function () { return {}; }),
    ]).then(function (results) {
      var ctrs = results[0].containers || [];
      var imgs = results[1].images || [];
      var df = results[2];
      var sysInfo = results[3];

      var context = 'Docker Fleet Context:\n';
      context += 'Containers (' + ctrs.length + '): ' + ctrs.map(function (c) { return c.name + ' (' + c.image + ') [' + c.state + ']'; }).join(', ') + '\n';
      context += 'Images (' + imgs.length + '): ' + imgs.map(function (i) { return (i.tags && i.tags[0] || '<none>') + ' ' + fmtBytes(i.size); }).join(', ') + '\n';
      if (sysInfo.version) context += 'Docker ' + (sysInfo.version.Version || '') + ', ' + (sysInfo.info ? sysInfo.info.NCPU + ' CPUs, ' + fmtBytes(sysInfo.info.MemTotal || 0) + ' RAM' : '') + '\n';
      if (df.Images) context += 'Disk: Images=' + fmtBytes(sumSize(df.Images)) + ', Containers=' + fmtBytes(sumSize(df.Containers)) + ', Volumes=' + fmtBytes(sumVolSize(df.Volumes)) + '\n';

      // Conversation history for multi-turn
      var historyStr = bulwarkHistory.slice(-6).map(function (h) { return h.role + ': ' + h.text; }).join('\n');
      var prompt = context + '\n' + (historyStr ? 'Previous conversation:\n' + historyStr + '\n\n' : '') +
        'User asks: ' + msg + '\n\nRespond as Bulwark, a Docker AI assistant. Be concise (3-6 sentences). Reference specific container names, images, sizes. If the user asks to perform an action (prune, restart, stop), explain what would happen and which API endpoint to use. No markdown formatting.';

      bulwarkHistory.push({ role: 'user', text: msg });

      return fetch('/api/docker/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
      });
    }).then(function (r) { return r.json(); }).then(function (d) {
      var text = d.response || 'I couldn\'t analyze the fleet right now. Try again in a moment.';
      bulwarkHistory.push({ role: 'bulwark-ai', text: text });
      responseDiv.innerHTML = '';
      typewriter(responseDiv, text);
      if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
      chat.scrollTop = chat.scrollHeight;
    }).catch(function () {
      responseDiv.innerHTML = '<span class="text-secondary">Connection issue. Please try again.</span>';
      if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
    });
  };

  // ── Helpers ──
  function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s || '')) : String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function shortPath(p) { if (!p) return ''; if (p.length > 30) return '...' + p.slice(-27); return p; }
  function getVal(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function setVal(id, v) { var e = document.getElementById(id); if (e) e.value = v; }
  function typewriter(el, text) { el.innerHTML = ''; var span = document.createElement('span'); span.className = 'typewriter-text'; el.appendChild(span); var i = 0; (function tick() { if (i < text.length) { span.textContent += text[i++]; setTimeout(tick, 8 + Math.random() * 12); } })(); }
})();
