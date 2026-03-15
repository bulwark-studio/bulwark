/**
 * Bulwark v2.1 — Schema Browser View
 * Functions, Triggers, Extensions, Indexes overview
 */
(function () {
  'use strict';

  var activeTab = 'functions';
  var currentPool = 'dev';
  var cachedData = {};

  // Reset stale data when project switches
  if (window.DbProjects) window.DbProjects.onProjectChange(function () {
    cachedData = {};
    var content = document.getElementById('schema-content');
    if (content) content.innerHTML = '';
    var tabs = document.getElementById('schema-tabs');
    if (tabs) tabs.innerHTML = '';
  });

  Views.schema = {
    init: function () {
      var el = document.getElementById('view-schema');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<div class="section-title">Schema Browser</div>' +
        '</div>' +
        '<div class="db-tabs" id="schema-tabs"></div>' +
        '<div id="schema-content" style="margin-top:0;border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;overflow:auto;max-height:calc(100vh - 200px)"></div>';
    },

    show: function () {
      if (!window.DbHeader || !window.DbHeader.require()) return;
      cachedData = {};
      renderTabs();
      loadTab(activeTab);
    },

    hide: function () {},
    update: function () {}
  };

  window.schemaSetPool = function (pool) {
    currentPool = pool;
    cachedData = {};
    loadTab(activeTab);
  };

  function renderTabs() {
    var el = document.getElementById('schema-tabs');
    if (!el) return;
    var tabs = [
      { key: 'functions', label: 'Functions' },
      { key: 'triggers', label: 'Triggers' },
      { key: 'extensions', label: 'Extensions' },
      { key: 'indexes', label: 'Indexes' },
    ];
    el.innerHTML = tabs.map(function (t) {
      var count = cachedData[t.key] ? ' (' + cachedData[t.key].length + ')' : '';
      return '<div class="db-tab' + (activeTab === t.key ? ' active' : '') + '" onclick="schemaSetTab(\'' + t.key + '\')">' + t.label + count + '</div>';
    }).join('');
  }

  window.schemaSetTab = function (tab) {
    activeTab = tab;
    renderTabs();
    if (cachedData[tab]) renderContent(tab, cachedData[tab]);
    else loadTab(tab);
  };

  function loadTab(tab) {
    var el = document.getElementById('schema-content');
    if (!el) return;
    el.innerHTML = '<div style="padding:16px;color:var(--text-tertiary)">Loading...</div>';

    fetch('/api/db/' + tab + '?' + dbParam())
      .then(safeJson)
      .then(function (d) {
        var items = d[tab] || [];
        cachedData[tab] = items;
        renderTabs();
        renderContent(tab, items);
      })
      .catch(function (e) {
        el.innerHTML = '<div style="padding:16px;color:var(--orange)">' + esc(e.message) + '</div>';
      });
  }

  function renderContent(tab, items) {
    var el = document.getElementById('schema-content');
    if (!el) return;

    if (!items.length) {
      el.innerHTML = '<div class="db-empty"><div class="db-empty-text">No ' + tab + ' found</div></div>';
      return;
    }

    if (tab === 'functions') {
      el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
        '<th>Name</th><th>Arguments</th><th>Returns</th><th>Language</th><th>Source</th>' +
        '</tr></thead><tbody>' +
        items.map(function (f) {
          return '<tr>' +
            '<td style="font-weight:600;color:var(--cyan)">' + esc(f.name) + '</td>' +
            '<td style="font-size:10px">' + esc(f.args || '--') + '</td>' +
            '<td><span class="db-badge db-badge-type">' + esc(f.return_type || '--') + '</span></td>' +
            '<td>' + esc(f.language || '--') + '</td>' +
            '<td><button class="btn btn-sm" onclick="viewFunctionSource(\'' + esc(f.name) + '\')">View</button></td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';

    } else if (tab === 'triggers') {
      el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
        '<th>Name</th><th>Table</th><th>Event</th><th>Timing</th><th>Action</th>' +
        '</tr></thead><tbody>' +
        items.map(function (t) {
          return '<tr>' +
            '<td style="font-weight:600">' + esc(t.trigger_name) + '</td>' +
            '<td style="color:var(--cyan)">' + esc(t.table_name) + '</td>' +
            '<td><span class="db-badge db-badge-pk">' + esc(t.event) + '</span></td>' +
            '<td>' + esc(t.timing) + '</td>' +
            '<td style="font-size:10px;max-width:300px;overflow:hidden;text-overflow:ellipsis">' + esc(t.action_statement) + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';

    } else if (tab === 'extensions') {
      el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
        '<th>Name</th><th>Version</th><th>Schema</th><th>Description</th>' +
        '</tr></thead><tbody>' +
        items.map(function (e) {
          return '<tr>' +
            '<td style="font-weight:600;color:var(--cyan)">' + esc(e.name) + '</td>' +
            '<td>' + esc(e.version || '--') + '</td>' +
            '<td>' + esc(e.schema || '--') + '</td>' +
            '<td style="color:var(--text-tertiary);font-size:11px">' + esc(e.description || '--') + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';

    } else if (tab === 'indexes') {
      // Group by table
      var groups = {};
      items.forEach(function (ix) {
        var t = ix.table_name || 'unknown';
        if (!groups[t]) groups[t] = [];
        groups[t].push(ix);
      });
      var tables = Object.keys(groups).sort();
      var html = '';
      tables.forEach(function (t) {
        html += '<div style="padding:8px 14px;font-size:12px;font-weight:600;color:var(--cyan);border-bottom:1px solid var(--border);background:rgba(34,211,238,0.03)">' +
          esc(t) + ' <span style="color:var(--text-tertiary);font-weight:400">(' + groups[t].length + ')</span></div>';
        groups[t].forEach(function (ix) {
          html += '<div style="padding:6px 14px 6px 28px;border-bottom:1px solid rgba(255,255,255,0.02);display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:11px;font-family:JetBrains Mono,monospace;color:var(--text-primary);min-width:200px">' + esc(ix.name) + '</span>' +
            (ix.is_unique ? '<span class="db-badge db-badge-unique">UNIQUE</span>' : '') +
            '<span style="font-size:10px;color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(ix.definition || '') + '</span>' +
            '<span style="font-size:10px;color:var(--text-tertiary)">' + esc(ix.size || '') + '</span>' +
          '</div>';
        });
      });
      el.innerHTML = html;
    }
  }

  window.viewFunctionSource = function (name) {
    var fn = (cachedData.functions || []).find(function (f) { return f.name === name; });
    if (!fn) return;
    Modal.open({
      title: 'Function: ' + name,
      size: 'xl',
      body: '<pre style="font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-primary);white-space:pre-wrap;max-height:60vh;overflow:auto;background:rgba(0,0,0,0.2);padding:16px;border-radius:8px;border:1px solid var(--border)">' +
        esc(fn.source || 'Source not available') + '</pre>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>'
    });
  };

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
