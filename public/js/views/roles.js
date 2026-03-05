/**
 * Chester Dev Monitor v2.0 — Roles & Permissions View
 * PostgreSQL roles, attributes, and table-level permissions
 */
(function () {
  'use strict';

  var roles = [];
  var selectedRole = null;
  var currentPool = 'dev';

  Views.roles = {
    init: function () {
      var el = document.getElementById('view-roles');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<div class="section-title">Roles & Permissions</div>' +
          '<select id="roles-pool-select" onchange="rolesSetPool(this.value)" style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text-primary);font-size:11px">' +
            '<option value="dev">Dev DB</option>' +
            '<option value="vps">VPS DB</option>' +
          '</select>' +
        '</div>' +
        '<div class="db-two-panel" style="height:calc(100vh - 160px)">' +
          '<div class="db-panel-left">' +
            '<div class="db-panel-left-header"><span style="font-size:12px;font-weight:600;color:var(--text-primary)">Roles</span></div>' +
            '<div class="db-panel-list" id="roles-list"></div>' +
          '</div>' +
          '<div class="db-panel-right" id="roles-detail">' +
            '<div class="db-empty"><div class="db-empty-text">Select a role</div></div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      loadRoles();
    },

    hide: function () {},
    update: function () {}
  };

  window.rolesSetPool = function (pool) {
    currentPool = pool;
    selectedRole = null;
    loadRoles();
  };

  function loadRoles() {
    var el = document.getElementById('roles-list');
    if (!el) return;
    el.innerHTML = '<div style="padding:12px;color:var(--text-tertiary);font-size:11px">Loading...</div>';

    fetch('/api/db/roles?pool=' + currentPool)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        roles = d.roles || [];
        renderRoleList();
      })
      .catch(function (e) {
        el.innerHTML = '<div style="padding:12px;color:var(--orange);font-size:11px">' + esc(e.message) + '</div>';
      });
  }

  function renderRoleList() {
    var el = document.getElementById('roles-list');
    if (!el) return;

    el.innerHTML = roles.map(function (r) {
      var cls = 'db-panel-list-item' + (selectedRole === r.name ? ' active' : '');
      var badges = '';
      if (r.is_super) badges += '<span style="color:var(--orange);font-size:9px;font-weight:600">SUPER</span>';
      if (r.can_login) badges += ' <span style="color:var(--cyan);font-size:9px">LOGIN</span>';
      return '<div class="' + cls + '" onclick="selectRole(\'' + esc(r.name) + '\')">' +
        '<span class="item-name">' + esc(r.name) + '</span>' +
        '<span class="item-badge">' + badges + '</span>' +
      '</div>';
    }).join('');
  }

  window.selectRole = function (name) {
    selectedRole = name;
    renderRoleList();
    loadRoleDetail(name);
  };

  function loadRoleDetail(name) {
    var detail = document.getElementById('roles-detail');
    if (!detail) return;

    var role = roles.find(function (r) { return r.name === name; });
    if (!role) { detail.innerHTML = '<div class="db-empty"><div class="db-empty-text">Role not found</div></div>'; return; }

    var html =
      '<div style="padding:14px;border-bottom:1px solid var(--border)">' +
        '<div style="font-size:16px;font-weight:600;color:var(--text-primary);font-family:JetBrains Mono,monospace;margin-bottom:8px">' + esc(name) + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          attrBadge('Superuser', role.is_super) +
          attrBadge('Can Login', role.can_login) +
          attrBadge('Create DB', role.can_create_db) +
          attrBadge('Create Role', role.can_create_role) +
        '</div>' +
        '<div style="margin-top:8px;font-size:11px;color:var(--text-tertiary)">' +
          'Connection limit: ' + (role.connection_limit === -1 ? 'unlimited' : role.connection_limit) +
          ' · Active: ' + (role.active_connections || 0) +
          (role.member_of && role.member_of.length ? ' · Member of: ' + role.member_of.join(', ') : '') +
        '</div>' +
      '</div>' +
      '<div style="padding:14px">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:10px">Table Permissions</div>' +
        '<div id="role-perms-content"><div style="color:var(--text-tertiary);font-size:11px">Loading permissions...</div></div>' +
      '</div>';

    detail.innerHTML = html;
    loadRolePermissions(name);
  }

  function loadRolePermissions(name) {
    var el = document.getElementById('role-perms-content');
    if (!el) return;

    fetch('/api/db/roles/' + encodeURIComponent(name) + '/permissions?pool=' + currentPool)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var perms = d.permissions || {};
        var tables = Object.keys(perms).sort();
        if (!tables.length) { el.innerHTML = '<div style="color:var(--text-tertiary);font-size:11px">No explicit table permissions</div>'; return; }

        var html = '<div class="db-table-wrap" style="max-height:50vh;overflow:auto"><table class="db-table"><thead><tr>' +
          '<th>Table</th><th>Permissions</th>' +
          '</tr></thead><tbody>';
        tables.forEach(function (t) {
          var privs = perms[t] || [];
          html += '<tr><td style="font-family:JetBrains Mono,monospace;font-size:11px">' + esc(t) + '</td><td><div class="role-badges">';
          privs.forEach(function (p) {
            var cls = 'perm-badge perm-badge-' + p.toLowerCase();
            html += '<span class="' + cls + '">' + esc(p) + '</span>';
          });
          html += '</div></td></tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
      })
      .catch(function (e) { el.innerHTML = '<div style="color:var(--orange);font-size:11px">' + esc(e.message) + '</div>'; });
  }

  function attrBadge(label, value) {
    var color = value ? 'var(--cyan)' : 'var(--text-tertiary)';
    var bg = value ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)';
    return '<span style="padding:3px 8px;border-radius:4px;font-size:10px;font-weight:500;color:' + color + ';background:' + bg + '">' +
      label + ': ' + (value ? 'Yes' : 'No') + '</span>';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
