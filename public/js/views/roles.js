/**
 * Bulwark v2.1 — Roles & Permissions Intelligence
 * AI-powered security audit, permission heatmap, least-privilege analysis
 */
(function () {
  'use strict';

  var roles = [];
  var selectedRole = null;
  var currentPool = 'dev';
  var auditData = null;
  var activeTab = 'overview';

  if (window.DbProjects) window.DbProjects.onProjectChange(function () {
    roles = []; selectedRole = null; auditData = null;
    var el = document.getElementById('view-roles');
    if (el) Views.roles.init();
  });

  Views.roles = {
    init: function () {
      var el = document.getElementById('view-roles');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<div class="section-title">Roles & Permissions Intelligence</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-sm" onclick="rolesRunAudit()" id="roles-audit-btn">AI Security Audit</button>' +
            '<button class="btn btn-sm btn-primary" onclick="rolesCreateRole()">Create Role</button>' +
          '</div>' +
        '</div>' +
        // AI Audit Banner
        '<div id="roles-audit-banner" style="display:none"></div>' +
        // Tabs
        '<div class="db-tabs" id="roles-tabs">' +
          '<div class="db-tab active" onclick="rolesTab(\'overview\')">Overview</div>' +
          '<div class="db-tab" onclick="rolesTab(\'heatmap\')">Permission Heatmap</div>' +
          '<div class="db-tab" onclick="rolesTab(\'findings\')">Security Findings</div>' +
        '</div>' +
        // Tab content
        '<div id="roles-tab-content" style="margin-top:12px">' +
          '<div class="db-two-panel" style="height:calc(100vh - 240px)">' +
            '<div class="db-panel-left">' +
              '<div class="db-panel-left-header"><span style="font-size:12px;font-weight:600;color:var(--text-primary)">Roles</span></div>' +
              '<div class="db-panel-list" id="roles-list"></div>' +
            '</div>' +
            '<div class="db-panel-right" id="roles-detail">' +
              '<div class="db-empty"><div class="db-empty-text">Select a role to view details</div></div>' +
            '</div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      if (!window.DbHeader || !window.DbHeader.require()) return;
      loadRoles();
    },

    hide: function () {},
    update: function () {}
  };

  window.rolesSetPool = function (pool) { currentPool = pool; selectedRole = null; auditData = null; loadRoles(); };

  window.rolesTab = function (tab) {
    activeTab = tab;
    var tabs = document.querySelectorAll('#roles-tabs .db-tab');
    tabs.forEach(function (t, i) { t.className = 'db-tab' + (['overview', 'heatmap', 'findings'][i] === tab ? ' active' : ''); });
    renderTabContent();
  };

  function renderTabContent() {
    var el = document.getElementById('roles-tab-content');
    if (!el) return;
    if (activeTab === 'overview') {
      el.innerHTML =
        '<div class="db-two-panel" style="height:calc(100vh - 240px)">' +
          '<div class="db-panel-left">' +
            '<div class="db-panel-left-header"><span style="font-size:12px;font-weight:600;color:var(--text-primary)">Roles</span></div>' +
            '<div class="db-panel-list" id="roles-list"></div>' +
          '</div>' +
          '<div class="db-panel-right" id="roles-detail">' +
            '<div class="db-empty"><div class="db-empty-text">Select a role to view details</div></div>' +
          '</div>' +
        '</div>';
      renderRoleList();
      if (selectedRole) loadRoleDetail(selectedRole);
    } else if (activeTab === 'heatmap') {
      renderHeatmap(el);
    } else if (activeTab === 'findings') {
      renderFindings(el);
    }
  }

  function loadRoles() {
    var el = document.getElementById('roles-list');
    if (el) el.innerHTML = '<div style="padding:12px;color:var(--text-tertiary);font-size:11px">Loading...</div>';

    fetch('/api/db/roles?' + dbParam())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        roles = d.roles || [];
        renderRoleList();
        renderRoleStats();
      })
      .catch(function (e) {
        if (el) el.innerHTML = '<div style="padding:12px;color:var(--orange);font-size:11px">' + esc(e.message) + '</div>';
      });
  }

  function renderRoleStats() {
    // Quick stats above tabs if no audit yet
    if (auditData) return;
    var supers = roles.filter(function (r) { return r.is_super; }).length;
    var logins = roles.filter(function (r) { return r.can_login; }).length;
    var active = roles.reduce(function (s, r) { return s + (parseInt(r.active_connections) || 0); }, 0);
    var banner = document.getElementById('roles-audit-banner');
    if (!banner) return;
    banner.style.display = '';
    banner.innerHTML =
      '<div class="db-info-bar">' +
        '<div class="info-item"><span>Total Roles:</span> <span class="info-value">' + roles.length + '</span></div>' +
        '<div class="info-item"><span>Superusers:</span> <span class="info-value" style="color:' + (supers > 1 ? 'var(--orange)' : 'var(--cyan)') + '">' + supers + '</span></div>' +
        '<div class="info-item"><span>Login Roles:</span> <span class="info-value">' + logins + '</span></div>' +
        '<div class="info-item"><span>Active Connections:</span> <span class="info-value">' + active + '</span></div>' +
      '</div>';
  }

  function renderRoleList() {
    var el = document.getElementById('roles-list');
    if (!el) return;
    el.innerHTML = roles.map(function (r) {
      var cls = 'db-panel-list-item' + (selectedRole === r.name ? ' active' : '');
      var badges = '';
      if (r.is_super) badges += '<span style="color:var(--orange);font-size:9px;font-weight:600">SUPER</span>';
      if (r.can_login) badges += ' <span style="color:var(--cyan);font-size:9px">LOGIN</span>';
      var connDot = (parseInt(r.active_connections) || 0) > 0 ?
        '<span style="width:6px;height:6px;border-radius:50%;background:var(--cyan);display:inline-block;margin-right:4px" title="Active"></span>' : '';
      return '<div class="' + cls + '" onclick="selectRole(\'' + esc(r.name) + '\')">' +
        '<span class="item-name">' + connDot + esc(r.name) + '</span>' +
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

    // Find audit findings for this role
    var roleFindings = [];
    if (auditData && auditData.findings) {
      roleFindings = auditData.findings.filter(function (f) { return f.role === name; });
    }

    var html =
      '<div style="padding:14px;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="font-size:16px;font-weight:600;color:var(--text-primary);font-family:JetBrains Mono,monospace">' + esc(name) + '</div>' +
          '<button class="btn btn-sm" onclick="rolesAIAnalyzeRole(\'' + esc(name) + '\')">AI Analyze</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
          attrBadge('Superuser', role.is_super, role.is_super) +
          attrBadge('Can Login', role.can_login, false) +
          attrBadge('Create DB', role.can_create_db, role.can_create_db) +
          attrBadge('Create Role', role.can_create_role, role.can_create_role) +
        '</div>' +
        '<div style="margin-top:8px;font-size:11px;color:var(--text-tertiary)">' +
          'Connection limit: ' + (role.connection_limit === -1 ? '<span style="color:var(--orange)">unlimited</span>' : role.connection_limit) +
          ' · Active: ' + (role.active_connections || 0) +
          (role.valid_until ? ' · Expires: ' + new Date(role.valid_until).toLocaleDateString() : ' · <span style="color:var(--orange)">No expiry</span>') +
          (Array.isArray(role.member_of) && role.member_of.length ? ' · Member of: ' + role.member_of.join(', ') : '') +
        '</div>' +
      '</div>';

    // Security findings for this role
    if (roleFindings.length) {
      html += '<div style="padding:12px 14px;border-bottom:1px solid var(--border)">' +
        '<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Security Findings</div>';
      roleFindings.forEach(function (f) {
        var color = f.severity === 'critical' ? 'var(--orange)' : f.severity === 'warning' ? '#f0c674' : 'var(--text-secondary)';
        html += '<div style="padding:8px 10px;margin-bottom:4px;border-radius:6px;border:1px solid ' + color + '20;background:' + color + '08">' +
          '<div style="font-size:11px;font-weight:600;color:' + color + ';text-transform:uppercase;margin-bottom:2px">' + esc(f.severity) + '</div>' +
          '<div style="font-size:12px;color:var(--text-primary)">' + esc(f.issue) + '</div>' +
          (f.fix ? '<div style="margin-top:4px;font-size:11px;font-family:JetBrains Mono,monospace;color:var(--cyan);cursor:pointer" onclick="roleCopySQL(\'' + esc(f.fix).replace(/'/g, "\\'") + '\')" title="Click to copy">Fix: ' + esc(f.fix) + '</div>' : '') +
        '</div>';
      });
      html += '</div>';
    }

    // Permissions
    html += '<div style="padding:14px">' +
      '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:10px">Table Permissions</div>' +
      '<div id="role-perms-content"><div style="color:var(--text-tertiary);font-size:11px">Loading permissions...</div></div>' +
    '</div>';

    detail.innerHTML = html;
    loadRolePermissions(name);
  }

  function loadRolePermissions(name) {
    var el = document.getElementById('role-perms-content');
    if (!el) return;

    fetch('/api/db/roles/' + encodeURIComponent(name) + '/permissions?' + dbParam())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var perms = d.permissions || {};
        var tables = Object.keys(perms).sort();
        if (!tables.length) { el.innerHTML = '<div style="color:var(--text-tertiary);font-size:11px">No explicit table permissions</div>'; return; }

        var html = '<div class="db-table-wrap" style="max-height:50vh;overflow:auto"><table class="db-table"><thead><tr>' +
          '<th>Table</th><th>SELECT</th><th>INSERT</th><th>UPDATE</th><th>DELETE</th>' +
          '</tr></thead><tbody>';
        var allPrivs = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
        tables.forEach(function (t) {
          var privs = perms[t] || [];
          html += '<tr><td style="font-family:JetBrains Mono,monospace;font-size:11px">' + esc(t) + '</td>';
          allPrivs.forEach(function (p) {
            var has = privs.indexOf(p) >= 0;
            html += '<td style="text-align:center"><span style="color:' + (has ? 'var(--cyan)' : 'var(--text-tertiary)') + ';font-size:14px">' + (has ? '\u2713' : '\u2013') + '</span></td>';
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
      })
      .catch(function (e) { el.innerHTML = '<div style="color:var(--orange);font-size:11px">' + esc(e.message) + '</div>'; });
  }

  // ── Permission Heatmap ──────────────────────────────────────────────────
  function renderHeatmap(container) {
    container.innerHTML = '<div style="padding:20px;color:var(--text-tertiary);font-size:12px">Loading permission matrix...</div>';

    // Load permissions for all roles
    var promises = roles.filter(function (r) { return r.can_login || r.is_super; }).map(function (r) {
      return fetch('/api/db/roles/' + encodeURIComponent(r.name) + '/permissions?' + dbParam())
        .then(function (res) { return res.json(); })
        .then(function (d) { return { role: r.name, permissions: d.permissions || {}, is_super: r.is_super }; });
    });

    Promise.all(promises).then(function (results) {
      // Collect all tables
      var tableSet = {};
      results.forEach(function (r) {
        Object.keys(r.permissions).forEach(function (t) { tableSet[t] = true; });
      });
      var tables = Object.keys(tableSet).sort();
      if (!tables.length && !results.some(function (r) { return r.is_super; })) {
        container.innerHTML = '<div class="db-empty"><div class="db-empty-text">No explicit permissions found</div><div class="db-empty-sub">Superusers have implicit access to all tables</div></div>';
        return;
      }

      var privTypes = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
      var html = '<div style="padding:12px"><div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px">Permission Heatmap</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:16px">Visual matrix of role-table privileges. Superusers shown with full access.</div>' +
        '<div style="display:flex;gap:12px;margin-bottom:12px;font-size:10px;color:var(--text-tertiary)">' +
          '<span><span style="display:inline-block;width:12px;height:12px;background:rgba(34,211,238,0.5);border-radius:2px;vertical-align:middle"></span> Full CRUD</span>' +
          '<span><span style="display:inline-block;width:12px;height:12px;background:rgba(34,211,238,0.25);border-radius:2px;vertical-align:middle"></span> Partial</span>' +
          '<span><span style="display:inline-block;width:12px;height:12px;background:rgba(255,107,43,0.3);border-radius:2px;vertical-align:middle"></span> Read Only</span>' +
          '<span><span style="display:inline-block;width:12px;height:12px;background:rgba(255,255,255,0.04);border-radius:2px;vertical-align:middle"></span> No Access</span>' +
        '</div>';

      html += '<div class="db-table-wrap" style="max-height:calc(100vh - 320px);overflow:auto"><table class="db-table"><thead><tr><th style="position:sticky;left:0;z-index:2;background:rgba(14,14,18,0.95)">Table</th>';
      results.forEach(function (r) {
        html += '<th style="text-align:center;font-size:10px;max-width:80px;overflow:hidden;text-overflow:ellipsis" title="' + esc(r.role) + '">' +
          (r.is_super ? '<span style="color:var(--orange)">' : '') + esc(r.role) + (r.is_super ? '</span>' : '') + '</th>';
      });
      html += '</tr></thead><tbody>';

      tables.forEach(function (t) {
        html += '<tr><td style="font-family:JetBrains Mono,monospace;font-size:10px;position:sticky;left:0;background:rgba(14,14,18,0.9);z-index:1">' + esc(t) + '</td>';
        results.forEach(function (r) {
          var privs = r.is_super ? privTypes : (r.permissions[t] || []);
          var count = privs.length;
          var bg, label;
          if (count === 4 || r.is_super) { bg = 'rgba(34,211,238,0.5)'; label = 'FULL'; }
          else if (count >= 2) { bg = 'rgba(34,211,238,0.25)'; label = count + '/4'; }
          else if (count === 1) { bg = 'rgba(255,107,43,0.3)'; label = privs[0].substring(0, 3); }
          else { bg = 'rgba(255,255,255,0.04)'; label = '-'; }
          html += '<td style="text-align:center;background:' + bg + ';font-size:9px;color:var(--text-secondary);padding:4px 6px" ' +
            'title="' + esc(r.role) + ' on ' + esc(t) + ': ' + (r.is_super ? 'SUPERUSER' : privs.join(', ') || 'none') + '">' + label + '</td>';
        });
        html += '</tr>';
      });

      html += '</tbody></table></div></div>';
      container.innerHTML = html;
    });
  }

  // ── Security Findings Tab ───────────────────────────────────────────────
  function renderFindings(container) {
    if (!auditData || !auditData.findings) {
      container.innerHTML = '<div class="db-empty"><div class="db-empty-text">Run AI Security Audit first</div>' +
        '<div class="db-empty-sub">Click "AI Security Audit" button to analyze role security</div>' +
        '<button class="btn btn-sm btn-primary" style="margin-top:16px" onclick="rolesRunAudit()">Run Audit Now</button></div>';
      return;
    }

    var findings = auditData.findings || [];
    var critical = findings.filter(function (f) { return f.severity === 'critical'; });
    var warnings = findings.filter(function (f) { return f.severity === 'warning'; });
    var info = findings.filter(function (f) { return f.severity === 'info'; });

    var html = '<div style="padding:16px">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px">';

    // Stats cards
    var statsItems = [
      { label: 'Security Score', value: (auditData.score || 0) + '/100', color: (auditData.score || 0) >= 70 ? 'var(--cyan)' : 'var(--orange)' },
      { label: 'Grade', value: auditData.grade || '?', color: 'var(--text-primary)' },
      { label: 'Critical Issues', value: critical.length, color: critical.length ? 'var(--orange)' : 'var(--cyan)' },
      { label: 'Warnings', value: warnings.length, color: warnings.length ? '#f0c674' : 'var(--cyan)' }
    ];
    statsItems.forEach(function (s) {
      html += '<div style="padding:14px;border:1px solid var(--border);border-radius:10px;background:rgba(0,0,0,0.15)">' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px">' + s.label + '</div>' +
        '<div style="font-size:24px;font-weight:700;color:' + s.color + ';font-family:JetBrains Mono,monospace">' + s.value + '</div>' +
      '</div>';
    });
    html += '</div>';

    // Summary
    if (auditData.summary) {
      html += '<div style="padding:14px;border:1px solid var(--border);border-radius:10px;margin-bottom:16px;background:rgba(0,0,0,0.1)">' +
        '<div style="font-size:13px;color:var(--text-primary);line-height:1.6">' + esc(auditData.summary) + '</div></div>';
    }

    // Findings list
    function renderFindingGroup(title, items, color) {
      if (!items.length) return '';
      var h = '<div style="margin-bottom:16px"><div style="font-size:13px;font-weight:600;color:' + color + ';margin-bottom:8px">' + title + ' (' + items.length + ')</div>';
      items.forEach(function (f) {
        h += '<div class="roles-finding" style="padding:10px 12px;margin-bottom:6px;border-radius:8px;border-left:3px solid ' + color + ';background:rgba(255,255,255,0.02)">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
            '<span style="font-size:11px;font-weight:600;font-family:JetBrains Mono,monospace;color:var(--cyan)">' + esc(f.role || '') + '</span>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-primary);line-height:1.5">' + esc(f.issue) + '</div>' +
          (f.fix ? '<div style="margin-top:6px;padding:6px 10px;background:rgba(0,0,0,0.3);border-radius:4px;font-family:JetBrains Mono,monospace;font-size:11px;color:#c3e88d;cursor:pointer" onclick="roleCopySQL(this.textContent)" title="Click to copy">' + esc(f.fix) + '</div>' : '') +
        '</div>';
      });
      return h + '</div>';
    }

    html += renderFindingGroup('Critical', critical, 'var(--orange)');
    html += renderFindingGroup('Warnings', warnings, '#f0c674');
    html += renderFindingGroup('Info', info, 'var(--text-secondary)');

    // Recommendations
    if (auditData.recommendations && auditData.recommendations.length) {
      html += '<div style="margin-top:16px"><div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Recommendations</div>';
      auditData.recommendations.forEach(function (r) {
        html += '<div style="padding:8px 12px;margin-bottom:4px;font-size:12px;color:var(--text-secondary);border-left:2px solid var(--cyan);padding-left:12px">' + esc(r) + '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ── AI Actions ──────────────────────────────────────────────────────────
  window.rolesRunAudit = function () {
    var btn = document.getElementById('roles-audit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
    var banner = document.getElementById('roles-audit-banner');
    if (banner) {
      banner.style.display = '';
      banner.innerHTML = '<div class="db-info-bar" style="border-color:rgba(34,211,238,0.3)"><span style="color:var(--cyan)">AI is auditing role security... this may take a moment</span></div>';
    }

    fetch('/api/db/roles/ai/audit?' + dbParam())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        auditData = d;
        if (btn) { btn.disabled = false; btn.textContent = 'AI Security Audit'; }
        // Render audit banner
        if (banner && !d.error) {
          var scoreColor = (d.score || 0) >= 80 ? 'var(--cyan)' : (d.score || 0) >= 50 ? '#f0c674' : 'var(--orange)';
          banner.innerHTML =
            '<div class="db-info-bar" style="border-color:' + scoreColor + '30">' +
              '<div style="display:flex;align-items:center;gap:16px;width:100%">' +
                '<div style="width:50px;height:50px;border-radius:50%;border:3px solid ' + scoreColor + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(0,0,0,0.3)">' +
                  '<span style="font-size:18px;font-weight:700;color:' + scoreColor + ';font-family:JetBrains Mono,monospace">' + (d.score || '?') + '</span>' +
                '</div>' +
                '<div style="flex:1">' +
                  '<div style="font-size:14px;font-weight:600;color:var(--text-primary)">Security Grade: ' +
                    '<span style="color:' + scoreColor + '">' + (d.grade || '?') + '</span></div>' +
                  '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">' + esc(d.summary || '') + '</div>' +
                '</div>' +
                (d.stats ? '<div style="display:flex;gap:16px;font-size:11px;color:var(--text-tertiary)">' +
                  '<span>Superusers: <span style="color:' + (d.stats.superusers > 1 ? 'var(--orange)' : 'var(--cyan)') + '">' + d.stats.superusers + '</span></span>' +
                  '<span>Excessive: <span style="color:' + (d.stats.excessive_privileges > 0 ? 'var(--orange)' : 'var(--cyan)') + '">' + (d.stats.excessive_privileges || 0) + '</span></span>' +
                  '<span>Dormant: <span style="color:var(--text-secondary)">' + (d.stats.dormant_roles || 0) + '</span></span>' +
                '</div>' : '') +
              '</div>' +
            '</div>';
        } else if (d.error) {
          banner.innerHTML = '<div class="db-info-bar" style="border-color:rgba(255,107,43,0.3)"><span style="color:var(--orange)">' + esc(d.error) + '</span></div>';
        }
        // Switch to findings tab if on it
        if (activeTab === 'findings') renderTabContent();
        if (activeTab === 'overview' && selectedRole) loadRoleDetail(selectedRole);
      })
      .catch(function (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'AI Security Audit'; }
        Toast.error('Audit failed: ' + e.message);
      });
  };

  window.rolesAIAnalyzeRole = function (name) {
    // Just run full audit and focus on that role
    if (!auditData) {
      rolesRunAudit();
      return;
    }
    // Show findings for this role
    var findings = (auditData.findings || []).filter(function (f) { return f.role === name; });
    if (!findings.length) {
      Toast.info('No security issues found for ' + name);
    } else {
      Toast.info(findings.length + ' finding(s) for ' + name + ' — check Security Findings tab');
      rolesTab('findings');
    }
  };

  window.rolesCreateRole = function () {
    Modal.open({
      title: 'Create Role',
      body: '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<div><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Role Name</label>' +
          '<input type="text" id="new-role-name" style="width:100%;padding:8px 12px;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;outline:none" placeholder="app_readonly"></div>' +
        '<div><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Or describe what this role should do (AI generates SQL)</label>' +
          '<textarea id="new-role-desc" rows="3" style="width:100%;padding:8px 12px;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;outline:none;resize:vertical;font-family:inherit" placeholder="e.g. Read-only access to all tables except user_profiles"></textarea></div>' +
        '<div id="new-role-ai-sql" style="display:none"></div>' +
      '</div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button>' +
        '<button class="btn btn-sm" onclick="rolesAIGenerate()" id="role-gen-btn">AI Generate</button>' +
        '<button class="btn btn-sm btn-primary" onclick="rolesExecuteCreate()" id="role-exec-btn">Execute SQL</button>',
      size: 'md'
    });
  };

  window.rolesAIGenerate = function () {
    var desc = document.getElementById('new-role-desc');
    if (!desc || !desc.value.trim()) { Toast.error('Enter a role description'); return; }
    var btn = document.getElementById('role-gen-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

    fetch('/api/db/roles/ai/generate?' + dbParam(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc.value.trim() })
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'AI Generate'; }
      var sqlEl = document.getElementById('new-role-ai-sql');
      if (sqlEl && d.sql) {
        sqlEl.style.display = '';
        sqlEl.innerHTML = '<div style="font-size:11px;color:var(--cyan);margin-bottom:4px">Generated SQL:</div>' +
          '<pre style="padding:10px;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;font-family:JetBrains Mono,monospace;font-size:11px;color:#c3e88d;white-space:pre-wrap;max-height:200px;overflow:auto" id="gen-role-sql">' + esc(d.sql) + '</pre>';
      } else if (d.error) {
        Toast.error(d.error);
      }
    })
    .catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'AI Generate'; }
      Toast.error('Generation failed');
    });
  };

  window.rolesExecuteCreate = function () {
    var sqlEl = document.getElementById('gen-role-sql');
    var nameEl = document.getElementById('new-role-name');
    var sql = sqlEl ? sqlEl.textContent : '';

    if (!sql && nameEl && nameEl.value.trim()) {
      sql = 'CREATE ROLE ' + nameEl.value.trim() + ' WITH LOGIN;';
    }
    if (!sql) { Toast.error('No SQL to execute. Generate SQL first or enter a role name.'); return; }

    fetch('/api/db/query?allow_ddl=true&' + dbParam(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sql })
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { Toast.error('Error: ' + d.error); return; }
      Toast.success('Role created successfully');
      Modal.close();
      loadRoles();
    })
    .catch(function (e) { Toast.error('Failed: ' + e.message); });
  };

  window.roleCopySQL = function (sql) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sql);
      Toast.success('SQL copied to clipboard');
    }
  };

  function attrBadge(label, value, isWarning) {
    var color = value ? (isWarning ? 'var(--orange)' : 'var(--cyan)') : 'var(--text-tertiary)';
    var bg = value ? (isWarning ? 'rgba(255,107,43,0.1)' : 'rgba(34,211,238,0.1)') : 'rgba(255,255,255,0.04)';
    return '<span style="padding:3px 8px;border-radius:4px;font-size:10px;font-weight:500;color:' + color + ';background:' + bg + '">' +
      label + ': ' + (value ? 'Yes' : 'No') + '</span>';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
