/**
 * Chester Dev Monitor v2.0 — Environment Variables View
 * App selector, variable table, add/delete/bulk import, history
 */
(function () {
  'use strict';

  var currentApp = null;
  var apps = [];

  Views.envvars = {
    init: function () {
      var container = document.getElementById('view-envvars');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<span style="font-weight:600;color:var(--text-primary)">Environment Variables</span>' +
          '</div>' +
          '<div id="env-apps" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">' +
            '<span style="color:var(--text-tertiary);font-size:12px">Loading apps...</span>' +
          '</div>' +
          '<div id="env-content">' +
            '<div style="color:var(--text-tertiary)">Select an app to view variables</div>' +
          '</div>';
      }
    },
    show: function () { loadApps(); },
    hide: function () {},
    update: function () {}
  };

  function loadApps() {
    fetch('/api/envvars').then(function (r) { return r.json(); }).then(function (d) {
      apps = d.apps || [];
      renderAppSelector();
      if (apps.length && !currentApp) {
        currentApp = apps[0].name;
      }
      if (currentApp) loadVars();
    }).catch(function () { apps = []; renderAppSelector(); });
  }

  function renderAppSelector() {
    var el = document.getElementById('env-apps');
    if (!el) return;
    el.innerHTML = apps.map(function (a) {
      var cls = a.name === currentApp ? 'btn btn-sm btn-primary' : 'btn btn-sm';
      return '<button class="' + cls + '" onclick="selectEnvApp(\'' + esc(a.name) + '\')">' + esc(a.name) + ' (' + a.count + ')</button>';
    }).join('') + ' <button class="btn btn-sm" onclick="addEnvVar()">Add Variable</button>' +
      ' <button class="btn btn-sm" onclick="bulkImport()">Bulk Import</button>' +
      ' <button class="btn btn-sm" onclick="showEnvHistory()">History</button>';
  }

  window.selectEnvApp = function (name) {
    currentApp = name;
    renderAppSelector();
    loadVars();
  };

  function loadVars() {
    var el = document.getElementById('env-content');
    if (!el || !currentApp) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading...</div>';
    fetch('/api/envvars/' + encodeURIComponent(currentApp))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var vars = d.vars || [];
        if (!vars.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No variables for ' + esc(currentApp) + '</div></div>'; return; }
        el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Key</th><th>Value</th><th>Updated</th><th>Actions</th></tr></thead><tbody>' +
          vars.map(function (v) {
            return '<tr><td style="font-weight:600;font-family:monospace">' + esc(v.key) + '</td>' +
              '<td><span class="env-val" style="cursor:pointer;color:var(--text-tertiary)" onclick="revealEnvVar(this,\'' + esc(currentApp) + '\',\'' + esc(v.key) + '\')">' + esc(v.value) + '</span></td>' +
              '<td style="color:var(--text-tertiary);font-size:11px">' + (v.updated ? new Date(v.updated).toLocaleString() : '--') + '</td>' +
              '<td><button class="btn btn-sm btn-danger" onclick="deleteEnvVar(\'' + esc(v.key) + '\')">Delete</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function () { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load variables</div></div>'; });
  }

  window.revealEnvVar = function (el, app, key) {
    fetch('/api/envvars/' + encodeURIComponent(app) + '?reveal=true')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var v = (d.vars || []).find(function (x) { return x.key === key; });
        if (v) el.textContent = v.value;
      })
      .catch(function () {});
  };

  window.addEnvVar = function () {
    var appName = currentApp || 'default';
    Modal.open({
      title: 'Add Variable to ' + appName, size: 'sm',
      body: '<div class="form-group"><label class="form-label">App Name</label><input id="env-app-name" class="form-input" value="' + esc(appName) + '"></div>' +
        '<div class="form-group"><label class="form-label">Key</label><input id="env-key" class="form-input" placeholder="MY_VAR"></div>' +
        '<div class="form-group"><label class="form-label">Value</label><input id="env-value" class="form-input" placeholder="secret_value"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="env-save">Save</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('env-save');
      if (btn) btn.onclick = function () {
        var app = (document.getElementById('env-app-name') || {}).value || appName;
        var key = (document.getElementById('env-key') || {}).value;
        var value = (document.getElementById('env-value') || {}).value;
        if (!key) { Toast.warning('Key required'); return; }
        fetch('/api/envvars/' + encodeURIComponent(app), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key, value: value }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Variable saved'); Modal.close(btn.closest('.modal-overlay'));
            currentApp = app; loadApps();
          })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.deleteEnvVar = function (key) {
    if (!currentApp) return;
    Modal.confirm({ title: 'Delete Variable', message: 'Delete "' + key + '"?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/envvars/' + encodeURIComponent(currentApp) + '/' + encodeURIComponent(key), { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadVars(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  window.bulkImport = function () {
    var appName = currentApp || 'default';
    Modal.open({
      title: 'Bulk Import', size: 'lg',
      body: '<div class="form-group"><label class="form-label">App</label><input id="bulk-app" class="form-input" value="' + esc(appName) + '"></div>' +
        '<div class="form-group"><label class="form-label">Paste .env content</label><textarea id="bulk-content" class="form-input" rows="10" placeholder="KEY=value\nANOTHER=secret" style="font-family:monospace"></textarea></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="bulk-save">Import</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('bulk-save');
      if (btn) btn.onclick = function () {
        var app = (document.getElementById('bulk-app') || {}).value || appName;
        var content = (document.getElementById('bulk-content') || {}).value;
        fetch('/api/envvars/' + encodeURIComponent(app) + '/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: content }) })
          .then(function (r) { return r.json(); })
          .then(function (d) { Toast.success('Imported ' + (d.imported || 0) + ' variables'); Modal.close(btn.closest('.modal-overlay')); currentApp = app; loadApps(); })
          .catch(function () { Toast.error('Import failed'); });
      };
    }, 50);
  };

  window.showEnvHistory = function () {
    if (!currentApp) return;
    fetch('/api/envvars/' + encodeURIComponent(currentApp) + '/history')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = d.history || [];
        Modal.open({
          title: 'History: ' + currentApp, size: 'lg',
          body: items.length ? items.map(function (h) {
            return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><strong>' + esc(h.action) + '</strong> ' +
              esc(h.key || '') + ' <span style="color:var(--text-tertiary)">by ' + esc(h.by || '') + ' at ' + (h.ts || '') + '</span></div>';
          }).join('') : '<div class="empty-state"><div class="empty-state-text">No history</div></div>'
        });
      })
      .catch(function () { Toast.error('Failed to load history'); });
  };

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
