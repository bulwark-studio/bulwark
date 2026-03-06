/**
 * Bulwark v2.1 — Databases View
 * Database list, create database, query console, users, backups
 */
(function () {
  'use strict';

  var activeTab = 'databases';

  Views.databases = {
    init: function () {
      var el = document.getElementById('view-databases');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header">' +
          '<div class="section-title">Databases</div>' +
        '</div>' +
        '<div id="db-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"></div>' +
        '<div id="db-content">' +
          '<div class="empty-state"><div class="empty-state-text">Loading databases...</div></div>' +
        '</div>';
    },

    show: function () {
      renderTabs();
      loadDatabases();
    },

    hide: function () {},

    update: function () {}
  };

  function renderTabs() {
    var el = document.getElementById('db-tabs');
    if (!el) return;
    var tabs = [
      { key: 'databases', label: 'Databases' },
      { key: 'users', label: 'Users' },
      { key: 'backups', label: 'Backups' }
    ];
    el.innerHTML = tabs.map(function (t) {
      var cls = t.key === activeTab ? 'btn btn-sm btn-primary' : 'btn btn-sm';
      return '<button class="' + cls + '" onclick="switchDbTab(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('') + ' <button class="btn btn-sm" onclick="openCreateDbModal()">Create Database</button>' +
      ' <button class="btn btn-sm" onclick="openQueryConsole()">Query Console</button>';
  }

  window.switchDbTab = function (tab) {
    activeTab = tab;
    renderTabs();
    if (tab === 'databases') loadDatabases();
    else if (tab === 'users') loadDbUsers();
    else if (tab === 'backups') loadBackups();
  };

  function loadDatabases() {
    var el = document.getElementById('db-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading...</div>';
    fetch('/adapter/databases')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded || d.error) { el.innerHTML = degraded(d.error); return; }
        var dbs = Array.isArray(d) ? d : d.databases || [];
        if (!dbs.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No databases found</div></div>'; return; }
        el.innerHTML = '<div class="card-grid">' + dbs.map(function (db) {
          var name = db.name || db.datname || db;
          return '<div class="card"><div class="card-title">' + esc(name) + '</div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">Owner: ' + esc(db.owner || db.datowner || '--') + '</div>' +
            (db.size ? '<div style="font-size:11px;color:var(--text-tertiary)">Size: ' + esc(db.size) + '</div>' : '') +
            '</div>';
        }).join('') + '</div>';
      })
      .catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  function loadDbUsers() {
    var el = document.getElementById('db-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading...</div>';
    fetch('/adapter/databases/users')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded || d.error) { el.innerHTML = degraded(d.error); return; }
        var users = Array.isArray(d) ? d : d.users || [];
        el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Username</th><th>Superuser</th><th>Can Login</th></tr></thead><tbody>' +
          users.map(function (u) {
            return '<tr><td>' + esc(u.usename || u.name || u) + '</td><td>' + (u.usesuper ? 'Yes' : 'No') + '</td><td>' + (u.usecreatedb !== false ? 'Yes' : '--') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  function loadBackups() {
    var el = document.getElementById('db-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading...</div>';
    fetch('/adapter/databases/backups')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded || d.error) { el.innerHTML = degraded(d.error); return; }
        var backups = Array.isArray(d) ? d : d.backups || [];
        if (!backups.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No backups found</div></div>'; return; }
        el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>File</th><th>Size</th><th>Created</th></tr></thead><tbody>' +
          backups.map(function (b) {
            return '<tr><td>' + esc(b.name || b.file || '') + '</td><td>' + esc(b.size || '--') + '</td><td>' + esc(b.created || b.date || '--') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  window.openCreateDbModal = function () {
    Modal.open({
      title: 'Create Database', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Database Name</label><input id="create-db-name" class="form-input" placeholder="my_database"></div>' +
        '<div class="form-group"><label class="form-label">Engine</label><select id="create-db-engine" class="form-input"><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option></select></div>' +
        '<div class="form-group"><label class="form-label">Owner</label><input id="create-db-owner" class="form-input" placeholder="postgres"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" id="create-db-btn">Create</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('create-db-btn');
      if (btn) btn.onclick = function () {
        var name = (document.getElementById('create-db-name') || {}).value;
        var engine = (document.getElementById('create-db-engine') || {}).value;
        var owner = (document.getElementById('create-db-owner') || {}).value;
        if (!name) { Toast.warning('Database name required'); return; }
        fetch('/adapter/databases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, engine: engine, owner: owner }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Database created'); Modal.close(btn.closest('.modal-overlay')); loadDatabases();
          })
          .catch(function () { Toast.error('Failed to create database'); });
      };
    }, 50);
  };

  window.openQueryConsole = function () {
    Modal.open({
      title: 'Query Console', size: 'xl',
      body: '<div class="form-group"><label class="form-label">SQL Query</label>' +
        '<textarea id="sql-query" class="form-input" rows="5" placeholder="SELECT 1" style="font-family:monospace"></textarea></div>' +
        '<button class="btn btn-sm btn-primary" id="run-query-btn" style="margin-bottom:12px">Run Query</button>' +
        '<div id="query-results" style="max-height:40vh;overflow:auto"></div>'
    });
    setTimeout(function () {
      var btn = document.getElementById('run-query-btn');
      if (btn) btn.onclick = function () {
        var sql = (document.getElementById('sql-query') || {}).value;
        if (!sql) return;
        var resEl = document.getElementById('query-results');
        if (resEl) resEl.innerHTML = '<div style="color:var(--text-tertiary)">Running...</div>';
        fetch('/adapter/databases/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!resEl) return;
            if (d.error) { resEl.innerHTML = '<div style="color:var(--orange)">' + esc(d.error) + '</div>'; return; }
            var rows = d.rows || d.results || [];
            if (!rows.length) { resEl.innerHTML = '<div style="color:var(--text-tertiary)">No rows returned</div>'; return; }
            var cols = Object.keys(rows[0]);
            resEl.innerHTML = '<div class="table-wrap"><table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
              rows.slice(0, 100).map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + esc(String(r[c] != null ? r[c] : '')) + '</td>'; }).join('') + '</tr>'; }).join('') +
              '</tbody></table></div>';
          })
          .catch(function (e) { if (resEl) resEl.innerHTML = '<div style="color:var(--orange)">' + esc(e.message) + '</div>'; });
      };
    }, 50);
  };

  window.loadAdapterDatabases = function () { loadDatabases(); };

  function degraded(err) {
    return '<div class="card" style="text-align:center;padding:32px"><div style="color:var(--orange);font-weight:600;margin-bottom:4px">Adapter Not Connected</div>' +
      '<div style="color:var(--text-tertiary);font-size:11px">' + esc(err || 'Database adapter is not available') + '</div></div>';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
