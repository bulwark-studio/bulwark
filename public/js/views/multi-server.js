/**
 * Chester Dev Monitor v2.0 — Multi-Server View
 * Agent grid, register/delete, health checks
 */
(function () {
  'use strict';

  Views['multi-server'] = {
    init: function () {
      var container = document.getElementById('view-multi-server');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div>' +
              '<h3 style="margin:0;color:var(--text-primary);font-size:16px;font-weight:600">Multi-Server Fleet</h3>' +
              '<p style="margin:4px 0 0;color:var(--text-tertiary);font-size:12px">Monitor and manage distributed server agents</p>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
              '<button class="btn btn-sm btn-ghost" onclick="checkAllAgents()">Health Check All</button>' +
              '<button class="btn btn-sm btn-cyan" onclick="registerAgent()">Register Agent</button>' +
            '</div>' +
          '</div>' +
          '<div id="ms-content"></div>';
      }
    },
    show: function () { loadAgents(); },
    hide: function () {},
    update: function () {}
  };

  function loadAgents() {
    var el = document.getElementById('ms-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading agents...</div>';
    fetch('/api/multi-server/agents')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var agents = d.agents || [];
        if (!agents.length) {
          el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No agents registered</div></div>';
          return;
        }
        el.innerHTML = '<div class="card-grid">' + agents.map(function (a) {
          var dotClass = a.status === 'healthy' ? 'dot-healthy' : a.status === 'unhealthy' ? 'dot-unhealthy' : 'dot-idle';
          return '<div class="card" style="cursor:pointer" onclick="agentDetail(\'' + a.id + '\')">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
            '<span class="dot ' + dotClass + '" style="width:10px;height:10px"></span>' +
            '<strong>' + esc(a.name) + '</strong></div>' +
            '<div style="font-size:11px;color:var(--text-tertiary)">' + esc(a.host) + '</div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">Latency: ' + (a.latency >= 0 ? a.latency + 'ms' : '--') +
            ' | Last: ' + (a.lastCheck ? new Date(a.lastCheck).toLocaleTimeString() : '--') + '</div>' +
            '<button class="btn btn-sm btn-danger" style="margin-top:8px" onclick="event.stopPropagation();deleteAgent(\'' + a.id + '\')">Remove</button>' +
            '</div>';
        }).join('') + '</div>';
      })
      .catch(function () { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load agents</div></div>'; });
  }

  window.registerAgent = function () {
    Modal.open({
      title: 'Register Agent', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Name</label><input id="agent-name" class="form-input" placeholder="Production Server"></div>' +
        '<div class="form-group"><label class="form-label">Host URL</label><input id="agent-host" class="form-input" placeholder="https://server.example.com"></div>' +
        '<div class="form-group"><label class="form-label">Auth Key (optional)</label><input id="agent-key" class="form-input" placeholder="secret-key"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="agent-save">Register</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('agent-save');
      if (btn) btn.onclick = function () {
        var name = (document.getElementById('agent-name') || {}).value;
        var host = (document.getElementById('agent-host') || {}).value;
        var authKey = (document.getElementById('agent-key') || {}).value;
        if (!name || !host) { Toast.warning('Name and host required'); return; }
        fetch('/api/multi-server/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, host: host, authKey: authKey }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Agent registered'); Modal.close(btn.closest('.modal-overlay')); loadAgents();
          })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.agentDetail = function (id) {
    var overlay = Modal.open({ title: 'Agent Health', body: '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>' });
    fetch('/api/multi-server/agents/' + id + '/health')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var body = overlay.querySelector('.modal-body');
        if (!body) return;
        var color = d.status === 'healthy' ? 'var(--cyan)' : 'var(--orange)';
        body.innerHTML = '<div style="margin-bottom:12px"><strong>Status:</strong> <span style="color:' + color + '">' + esc(d.status) + '</span></div>' +
          '<div style="margin-bottom:12px"><strong>Latency:</strong> ' + (d.latency || '--') + 'ms</div>' +
          '<pre style="font-size:11px;color:var(--text-secondary);white-space:pre-wrap">' + esc(JSON.stringify(d.data || d, null, 2)) + '</pre>';
      })
      .catch(function (e) {
        var body = overlay.querySelector('.modal-body');
        if (body) body.innerHTML = '<div style="color:var(--orange)">' + esc(e.message) + '</div>';
      });
  };

  window.deleteAgent = function (id) {
    Modal.confirm({ title: 'Remove Agent', message: 'Remove this agent?', dangerous: true, confirmText: 'Remove' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/multi-server/agents/' + id, { method: 'DELETE' })
        .then(function () { Toast.success('Removed'); loadAgents(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  window.checkAllAgents = function () {
    Toast.info('Checking all agents...');
    fetch('/api/multi-server/overview')
      .then(function (r) { return r.json(); })
      .then(function () { Toast.success('Check complete'); loadAgents(); })
      .catch(function () { Toast.error('Failed'); });
  };

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
