/**
 * DB Projects — named database connections for DB Studio
 *
 * Provides:
 *   window.DbProjects        — state: list, activeId, active(), param(), onChange callbacks
 *   window.dbParam()         — "project=<id>" or "pool=dev"
 *   window.DbHeader          — topbar renderer, picker modal, require() guard
 *   Views['db-projects']     — management view
 */
(function () {
  'use strict';

  var DB_VIEWS = ['sql-editor', 'tables', 'schema', 'migrations', 'roles', 'db-backups', 'db-projects', 'db-assistant'];
  var COLORS   = ['#22d3ee', '#a78bfa', '#fb923c', '#34d399', '#f472b6', '#facc15', '#60a5fa', '#f87171'];

  // ── Global project state ──────────────────────────────────────────────────

  window.DbProjects = {
    list:     [],
    activeId: localStorage.getItem('db_active_project') || null,
    _onChange: [],   // reset callbacks registered by each view

    active: function () {
      return this.list.find(function (p) { return p.id === window.DbProjects.activeId; }) || null;
    },

    setActive: function (id) {
      this.activeId = id || null;
      if (id) localStorage.setItem('db_active_project', id);
      else     localStorage.removeItem('db_active_project');

      // Fire all reset callbacks so stale data is cleared
      this._onChange.forEach(function (fn) { try { fn(); } catch (e) {} });

      DbHeader.render();
      renderSidebarIndicator();
    },

    // Register a cache-reset callback (called by each DB view on load)
    onProjectChange: function (fn) { this._onChange.push(fn); },

    param: function () {
      return this.activeId ? 'project=' + this.activeId : 'pool=dev';
    },
  };

  window.dbParam = function () { return window.DbProjects.param(); };

  // ── Load projects from API ────────────────────────────────────────────────

  function loadProjects(cb) {
    fetch('/api/db/projects')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        window.DbProjects.list = data.projects || [];
        // If stored active no longer exists, clear it
        if (window.DbProjects.activeId && !window.DbProjects.active()) {
          window.DbProjects.activeId = null;
          localStorage.removeItem('db_active_project');
        }
        DbHeader.render();
        renderSidebarIndicator();
        if (cb) cb();
      })
      .catch(function () { if (cb) cb(); });
  }

  loadProjects(); // init

  // ── Sidebar — project indicator in Database nav group header ──────────────
  // Injects a colored pill next to "Database" text in the nav group header.

  function renderSidebarIndicator() {
    var header = document.querySelector('#nav-group-database .nav-group-header');
    if (!header) return;

    var existing = header.querySelector('.db-nav-indicator');
    if (existing) existing.remove();

    var active = window.DbProjects.active();
    if (!active) {
      // Show faint "No DB" hint
      var hint = document.createElement('span');
      hint.className = 'db-nav-indicator db-nav-indicator-empty';
      hint.textContent = 'No DB';
      hint.title = 'Click Projects to connect a database';
      // Insert before chevron
      var chevron = header.querySelector('.chevron');
      if (chevron) header.insertBefore(hint, chevron);
      else header.appendChild(hint);
      return;
    }

    var pill = document.createElement('div');
    pill.className = 'db-nav-indicator';
    pill.title = 'Switch project — currently: ' + active.name;
    pill.onclick = function (e) { e.stopPropagation(); DbHeader.openPicker(); };
    pill.innerHTML =
      '<span style="width:7px;height:7px;border-radius:50%;background:' + active.color + ';flex-shrink:0;display:inline-block"></span>' +
      '<span class="db-nav-indicator-name">' + esc(active.name) + '</span>';

    var chevron = header.querySelector('.chevron');
    if (chevron) header.insertBefore(pill, chevron);
    else header.appendChild(pill);
  }

  // ── DB Header bar (above DB view content) ────────────────────────────────

  window.DbHeader = {

    render: function () {
      var bar = document.getElementById('db-topbar');
      if (!bar) return;
      var active   = window.DbProjects.active();
      var projects = window.DbProjects.list;

      if (!projects.length) {
        bar.innerHTML =
          '<div class="db-topbar-inner db-topbar-empty">' +
            _dbIcon() +
            '<span>No database projects yet.</span>' +
            '<button class="btn btn-sm btn-primary" onclick="switchView(\'db-projects\')">+ Add Project</button>' +
          '</div>';
        return;
      }

      if (!active) {
        bar.innerHTML =
          '<div class="db-topbar-inner db-topbar-empty">' +
            _dbIcon() +
            '<span>No database selected</span>' +
            '<button class="btn btn-sm btn-primary" onclick="DbHeader.openPicker()">Select Project →</button>' +
            '<div style="flex:1"></div>' +
            '<button class="btn btn-sm" onclick="switchView(\'db-projects\')" title="Manage projects">Manage</button>' +
          '</div>';
        return;
      }

      bar.innerHTML =
        '<div class="db-topbar-inner">' +
          // Active project — click to switch
          '<div class="db-topbar-project" onclick="DbHeader.openPicker()" title="Click to switch project">' +
            '<span class="db-proj-dot" style="background:' + active.color + '"></span>' +
            '<span class="db-proj-name">' + esc(active.name) + '</span>' +
            (active.description ? '<span class="db-proj-desc">' + esc(active.description) + '</span>' : '') +
            '<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.4;margin-left:2px"><path d="M2 4l4 4 4-4"/></svg>' +
          '</div>' +
          '<div class="db-topbar-sep"></div>' +
          '<div id="db-topbar-info" class="db-topbar-info">' +
            '<span class="db-topbar-status" style="color:var(--text-tertiary);font-size:11px">Connecting...</span>' +
          '</div>' +
          '<div style="flex:1"></div>' +
          '<button class="btn btn-sm" onclick="switchView(\'db-projects\')" style="font-size:11px">' +
            '⚙ Manage Projects' +
          '</button>' +
        '</div>';

      // Async: load connection info
      fetch('/api/db/info?' + dbParam())
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var info = document.getElementById('db-topbar-info');
          if (!info) return;
          if (d.error || d.degraded) {
            info.innerHTML = '<span class="db-topbar-status err">✕ Not connected — ' + esc(d.error || 'check URL') + '</span>';
          } else {
            info.innerHTML =
              '<span class="db-topbar-status ok">✓</span>' +
              '<span class="db-topbar-chip">' + esc(d.database) + '</span>' +
              '<span class="db-topbar-chip">' + esc(d.size) + '</span>' +
              '<span class="db-topbar-chip" title="Active connections">' + d.connections + ' conn</span>' +
              '<span class="db-topbar-chip" title="PostgreSQL version">' + esc((d.version || '').split(' ').slice(0,2).join(' ')) + '</span>';
          }
        })
        .catch(function () {
          var info = document.getElementById('db-topbar-info');
          if (info) info.innerHTML = '<span class="db-topbar-status err">✕ Connection failed</span>';
        });
    },

    show: function () {
      var bar = document.getElementById('db-topbar');
      if (bar) { bar.style.display = ''; DbHeader.render(); }
    },

    hide: function () {
      var bar = document.getElementById('db-topbar');
      if (bar) bar.style.display = 'none';
    },

    // Returns true if project active; opens picker + returns false if not.
    // Call at the top of every DB view's show() to guard.
    require: function () {
      if (window.DbProjects.active()) return true;
      DbHeader.openPicker();
      return false;
    },

    openPicker: function () {
      var projects = window.DbProjects.list;
      if (!projects.length) { switchView('db-projects'); return; }

      var html =
        '<div class="db-picker-grid">' +
        projects.map(function (p) {
          var isActive = p.id === window.DbProjects.activeId;
          return '<div class="db-picker-card' + (isActive ? ' active' : '') + '" onclick="DbHeader.pick(\'' + p.id + '\')">' +
            '<div class="db-picker-card-top">' +
              '<span class="db-picker-dot" style="background:' + p.color + '"></span>' +
              '<span class="db-picker-name">' + esc(p.name) + '</span>' +
              (isActive ? '<span class="db-picker-active-badge">Active</span>' : '') +
            '</div>' +
            (p.description ? '<div class="db-picker-desc">' + esc(p.description) + '</div>' : '') +
            '<div class="db-picker-url">' + esc(p.url) + '</div>' +
          '</div>';
        }).join('') +
        '</div>' +
        '<div style="margin-top:14px;text-align:center">' +
          '<button class="btn btn-sm" onclick="Modal.close();switchView(\'db-projects\')">+ Add / Manage Projects</button>' +
        '</div>';

      Modal.open({ title: 'Select Database', body: html, footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button>' });
    },

    pick: function (id) {
      Modal.close();
      window.DbProjects.setActive(id);  // fires reset callbacks + re-renders topbar + sidebar

      // Update title to reflect new project
      updateDbTitle();

      // Reload current DB view with new project data
      var cur = window.state && window.state.currentView;
      if (cur && DB_VIEWS.indexOf(cur) !== -1 && Views[cur] && Views[cur].show) {
        Views[cur].show();
      }

      var p = window.DbProjects.active();
      Toast.success('Switched to ' + (p ? p.name : 'database'));
    },
  };

  // ── Title helper — keeps topbar title in sync with active project ─────────

  var DB_TITLES = {
    'db-projects': 'DB Projects',
    'sql-editor':  'SQL Editor',
    'tables':      'Tables',
    'schema':      'Schema',
    'migrations':  'Migrations',
    'roles':       'Roles',
    'db-backups':  'Backups',
    'db-assistant': 'AI Assistant',
  };

  function updateDbTitle(viewName) {
    viewName = viewName || (window.state && window.state.currentView);
    if (!viewName || !DB_TITLES[viewName]) return;
    var el = document.getElementById('topbar-title');
    if (!el) return;
    var active = window.DbProjects.active();
    el.textContent = DB_TITLES[viewName] + (active ? ' \u2014 ' + active.name : '');
  }

  // ── Hook switchView to show/hide DB topbar + update title ─────────────────
  // db-projects.js loads AFTER app.js so window.switchView already exists.

  var _origSwitch = window.switchView;
  window.switchView = function (viewName) {
    // Show/hide DB topbar BEFORE calling show() on the view
    if (DB_VIEWS.indexOf(viewName) !== -1) {
      DbHeader.show();
    } else {
      DbHeader.hide();
    }

    _origSwitch(viewName);

    // Override title AFTER _origSwitch sets its own title
    if (DB_TITLES[viewName]) {
      setTimeout(function () { updateDbTitle(viewName); }, 0);
    }
  };

  // ── Projects Management View ──────────────────────────────────────────────

  Views['db-projects'] = {
    init: function () {
      var el = document.getElementById('view-db-projects');
      if (!el) return;
      el.innerHTML =
        '<div class="view-header">' +
          '<div>' +
            '<h2 class="view-title">DB Projects</h2>' +
            '<p class="view-subtitle">Connect to any PostgreSQL database. Switch projects to use different DBs across all views.</p>' +
          '</div>' +
          '<button class="btn btn-primary" onclick="DbProjectsMgr.openAdd()">+ Add Project</button>' +
        '</div>' +
        '<div id="db-projects-grid" class="db-projects-grid"></div>';
    },

    show: function () {
      loadProjects(function () { DbProjectsMgr.render(); });
    },

    hide: function () {},
  };

  // ── Projects CRUD Manager ─────────────────────────────────────────────────

  window.DbProjectsMgr = {

    render: function () {
      var el = document.getElementById('db-projects-grid');
      if (!el) return;
      var projects = window.DbProjects.list;

      if (!projects.length) {
        el.innerHTML =
          '<div class="empty-state">' +
            '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="var(--text-tertiary)" stroke-width="1.2">' +
              '<ellipse cx="32" cy="16" rx="20" ry="8"/>' +
              '<path d="M12 16v16c0 4.4 9 8 20 8s20-3.6 20-8V16"/>' +
              '<path d="M12 32v16c0 4.4 9 8 20 8s20-3.6 20-8V32"/>' +
            '</svg>' +
            '<p style="color:var(--text-secondary);margin:14px 0 4px;font-size:15px;font-weight:600">No projects yet</p>' +
            '<p style="color:var(--text-tertiary);font-size:13px;margin-bottom:20px">Add a project to connect to any PostgreSQL database</p>' +
            '<button class="btn btn-primary" onclick="DbProjectsMgr.openAdd()">+ Add your first project</button>' +
          '</div>';
        return;
      }

      el.innerHTML = projects.map(function (p) {
        var isActive = p.id === window.DbProjects.activeId;
        return '<div class="db-project-card' + (isActive ? ' active' : '') + '">' +
          '<div class="db-project-card-accent" style="background:' + p.color + '"></div>' +
          '<div class="db-project-card-body">' +
            '<div class="db-project-card-header">' +
              '<div style="display:flex;align-items:center;gap:10px;min-width:0">' +
                '<div class="db-project-card-dot" style="background:' + p.color + ';flex-shrink:0"></div>' +
                '<div style="min-width:0">' +
                  '<div class="db-project-card-name">' + esc(p.name) + '</div>' +
                  (p.description ? '<div class="db-project-card-desc">' + esc(p.description) + '</div>' : '') +
                '</div>' +
              '</div>' +
              (isActive
                ? '<span style="background:rgba(34,211,238,.12);color:var(--cyan);font-size:10px;padding:3px 10px;border-radius:20px;white-space:nowrap;flex-shrink:0">● Active</span>'
                : '') +
            '</div>' +
            '<div class="db-project-card-url">' + esc(p.url) + '</div>' +
            '<div class="db-project-card-actions">' +
              (!isActive
                ? '<button class="btn btn-sm btn-primary" onclick="DbHeader.pick(\'' + p.id + '\')">Use This DB</button>'
                : '<button class="btn btn-sm" disabled style="opacity:.4;cursor:not-allowed">Currently Active</button>') +
              '<button class="btn btn-sm" onclick="DbProjectsMgr.test(\'' + p.id + '\',this)">Test</button>' +
              '<button class="btn btn-sm" onclick="DbProjectsMgr.openEdit(\'' + p.id + '\')">Edit</button>' +
              '<button class="btn btn-sm" style="color:var(--orange);border-color:rgba(255,107,43,.3)" onclick="DbProjectsMgr.del(\'' + p.id + '\',\'' + esc(p.name) + '\')">Delete</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    },

    openAdd: function () {
      var color = COLORS[window.DbProjects.list.length % COLORS.length];
      Modal.open({
        title: 'Add Database Project',
        body: DbProjectsMgr._form(null, color),
        footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button><button class="btn btn-sm btn-primary" onclick="DbProjectsMgr.save(null)">Add Project</button>',
      });
    },

    openEdit: function (id) {
      var p = window.DbProjects.list.find(function (x) { return x.id === id; });
      if (!p) return;
      Modal.open({
        title: 'Edit — ' + p.name,
        body: DbProjectsMgr._form(p, p.color),
        footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button><button class="btn btn-sm btn-primary" onclick="DbProjectsMgr.save(\'' + id + '\')">Save</button>',
      });
    },

    _form: function (p, color) {
      return '<div style="display:flex;flex-direction:column;gap:16px">' +
        '<div>' +
          '<label class="form-label">Project Name *</label>' +
          '<input id="pf-name" class="form-input" placeholder="Admin, Bulwark, Security..." value="' + (p ? esc(p.name) : '') + '" autofocus>' +
        '</div>' +
        '<div>' +
          '<label class="form-label">PostgreSQL URL *</label>' +
          '<input id="pf-url" class="form-input" placeholder="postgresql://user:password@host:5432/dbname" value="' + (p ? esc(p.url) : '') + '" autocomplete="off" spellcheck="false" style="font-family:monospace;font-size:12px">' +
          '<div style="margin-top:5px;font-size:11px;color:var(--text-tertiary)">Include credentials in the URL. Tested server-side only — never exposed to browser.</div>' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Description <span style="color:var(--text-tertiary)">(optional)</span></label>' +
          '<input id="pf-desc" class="form-input" placeholder="e.g. Main admin panel database" value="' + (p ? esc(p.description || '') : '') + '">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Color</label>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">' +
          COLORS.map(function (c) {
            var sel = c === color;
            return '<div onclick="DbProjectsMgr._pickColor(this,\'' + c + '\')" data-color="' + c + '" ' +
              'style="width:28px;height:28px;border-radius:50%;background:' + c + ';cursor:pointer;' +
              'border:2.5px solid ' + (sel ? 'white' : 'transparent') + ';' +
              'box-shadow:' + (sel ? '0 0 0 2px rgba(255,255,255,.2)' : 'none') + ';' +
              'transition:all .15s"></div>';
          }).join('') +
          '<input type="hidden" id="pf-color" value="' + color + '">' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<input type="checkbox" id="pf-ssl"' + (p && p.ssl ? ' checked' : '') + ' style="width:15px;height:15px">' +
          '<label for="pf-ssl" style="font-size:12px;color:var(--text-secondary);cursor:pointer;margin:0">Require SSL (Supabase / cloud PostgreSQL)</label>' +
        '</div>' +
      '</div>';
    },

    _pickColor: function (el, color) {
      el.parentNode.querySelectorAll('[data-color]').forEach(function (x) {
        x.style.borderColor = 'transparent';
        x.style.boxShadow = 'none';
      });
      el.style.borderColor = 'white';
      el.style.boxShadow = '0 0 0 2px rgba(255,255,255,.2)';
      var inp = document.getElementById('pf-color');
      if (inp) inp.value = color;
    },

    save: function (id) {
      var name  = (document.getElementById('pf-name')  || {}).value || '';
      var url   = (document.getElementById('pf-url')   || {}).value || '';
      var desc  = (document.getElementById('pf-desc')  || {}).value || '';
      var color = (document.getElementById('pf-color') || {}).value || '#22d3ee';
      var ssl   = !!(document.getElementById('pf-ssl') || {}).checked;

      if (!name.trim()) { Toast.error('Name is required'); return; }
      if (!url.trim())  { Toast.error('Database URL is required'); return; }

      Toast.info('Saving...');
      fetch(id ? '/api/db/projects/' + id : '/api/db/projects', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), description: desc.trim(), color: color, ssl: ssl }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          Modal.close();
          if (d.error) { Toast.error(d.error); return; }
          Toast.success('Saved');
          // If we edited the active project, invalidate its pool
          if (id && id === window.DbProjects.activeId) {
            window.DbProjects.setActive(id);
          }
          loadProjects(function () { DbProjectsMgr.render(); });
        })
        .catch(function () { Modal.close(); Toast.error('Save failed'); });
    },

    del: function (id, name) {
      Modal.confirm({ title: 'Delete Project', message: 'Delete "' + name + '"? The actual database is not affected.', dangerous: true, confirmText: 'Delete' }).then(function (yes) {
        if (!yes) return;
        if (window.DbProjects.activeId === id) window.DbProjects.setActive(null);
        fetch('/api/db/projects/' + id, { method: 'DELETE' })
          .then(function () {
            Toast.success('Deleted');
            loadProjects(function () { DbProjectsMgr.render(); });
          })
          .catch(function () { Toast.error('Delete failed'); });
      });
    },

    test: function (id, btn) {
      var orig = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Testing...'; btn.disabled = true; }
      fetch('/api/db/projects/' + id + '/test', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (btn) { btn.textContent = orig; btn.disabled = false; }
          if (d.ok) Toast.success('✓ Connected — ' + d.database + ' (' + d.version + ')');
          else      Toast.error('✗ ' + d.error);
        })
        .catch(function () {
          if (btn) { btn.textContent = orig; btn.disabled = false; }
          Toast.error('Test failed');
        });
    },
  };

  function _dbIcon() {
    return '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" style="flex-shrink:0;opacity:.6">' +
      '<ellipse cx="10" cy="5" rx="7" ry="3"/>' +
      '<path d="M3 5v10c0 1.66 3.13 3 7 3s7-1.34 7-3V5"/>' +
      '<path d="M3 10c0 1.66 3.13 3 7 3s7-1.34 7-3"/>' +
    '</svg>';
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
