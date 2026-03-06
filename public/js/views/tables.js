/**
 * Bulwark v2.1 — Table Browser View
 * Two-panel: table list (left) + columns/data/constraints/FK/indexes (right)
 */
(function () {
  'use strict';

  var allTables = [];
  var selectedTable = null;
  var cachedDetail = null;
  var activeTab = 'columns';
  var rowOffset = 0;
  var rowSort = '';
  var rowOrder = 'asc';
  var currentPool = 'dev';

  // Reset stale data when project switches
  if (window.DbProjects) window.DbProjects.onProjectChange(function () {
    allTables = []; selectedTable = null; cachedDetail = null; activeTab = 'columns';
    var detail = document.getElementById('table-detail');
    if (detail) detail.innerHTML = '<div class="db-empty"><div class="db-empty-text">Select a table</div><div class="db-empty-sub">Click a table from the list to view its structure</div></div>';
    var list = document.getElementById('table-list');
    if (list) list.innerHTML = '';
  });

  Views.tables = {
    init: function () {
      var el = document.getElementById('view-tables');
      if (!el) return;
      el.innerHTML =
        '<div class="db-info-bar" id="tables-info-bar">Loading database info...</div>' +
        '<div class="db-two-panel">' +
          '<div class="db-panel-left">' +
            '<div class="db-panel-left-header">' +
              '<input type="text" id="table-filter" placeholder="Filter tables..." oninput="filterTableList()">' +
            '</div>' +
            '<div class="db-panel-list" id="table-list"></div>' +
          '</div>' +
          '<div class="db-panel-right" id="table-detail">' +
            '<div class="db-empty"><div class="db-empty-text">Select a table</div><div class="db-empty-sub">Click a table from the list to view its structure</div></div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      if (!window.DbHeader || !window.DbHeader.require()) return;
      selectedTable = null;
      loadTableList();
      loadDbInfo();
    },

    hide: function () {},
    update: function () {}
  };

  function loadDbInfo() {
    fetch('/api/db/info?' + dbParam())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var el = document.getElementById('tables-info-bar');
        if (!el) return;
        if (d.error || d.degraded) {
          el.innerHTML = '<span style="color:var(--orange)">Database not connected</span>';
          return;
        }
        el.innerHTML =
          '<div class="info-item"><span>Database:</span> <span class="info-value">' + esc(d.database) + '</span></div>' +
          '<div class="info-item"><span>Size:</span> <span class="info-value">' + esc(d.size) + '</span></div>' +
          '<div class="info-item"><span>Connections:</span> <span class="info-value">' + d.connections + '</span></div>' +
          '<div class="info-item"><span>Pool:</span> <span class="info-value">' + esc(d.pool) + '</span></div>';
      })
      .catch(function () {});
  }

  function loadTableList() {
    var el = document.getElementById('table-list');
    if (!el) return;
    el.innerHTML = '<div style="padding:12px;color:var(--text-tertiary);font-size:11px">Loading...</div>';
    fetch('/api/db/tables?' + dbParam())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        allTables = d.tables || [];
        renderTableList();
      })
      .catch(function (e) {
        el.innerHTML = '<div style="padding:12px;color:var(--orange);font-size:11px">' + esc(e.message) + '</div>';
      });
  }

  function renderTableList() {
    var el = document.getElementById('table-list');
    if (!el) return;
    var filter = (document.getElementById('table-filter') || {}).value || '';
    var q = filter.toLowerCase();
    var filtered = q ? allTables.filter(function (t) { return t.name.toLowerCase().indexOf(q) >= 0; }) : allTables;

    el.innerHTML = filtered.map(function (t) {
      var cls = 'db-panel-list-item' + (selectedTable === t.name ? ' active' : '');
      var rows = t.row_estimate >= 0 ? t.row_estimate : '~';
      return '<div class="' + cls + '" onclick="selectTable(\'' + esc(t.name) + '\')">' +
        '<span class="item-name">' + esc(t.name) + '</span>' +
        '<span class="item-badge">' + rows + '</span>' +
      '</div>';
    }).join('');
  }

  window.filterTableList = renderTableList;

  window.tablesSetPool = function (pool) {
    currentPool = pool;
    selectedTable = null;
    loadTableList();
    loadDbInfo();
    var detail = document.getElementById('table-detail');
    if (detail) detail.innerHTML = '<div class="db-empty"><div class="db-empty-text">Select a table</div></div>';
  };

  window.selectTable = function (name) {
    selectedTable = name;
    activeTab = 'columns';
    rowOffset = 0;
    rowSort = '';
    renderTableList();
    loadTableDetail(name);
  };

  function loadTableDetail(name) {
    var detail = document.getElementById('table-detail');
    if (!detail) return;
    detail.innerHTML = '<div style="padding:16px;color:var(--text-tertiary);font-size:11px">Loading ' + esc(name) + '...</div>';

    fetch('/api/db/tables/' + encodeURIComponent(name) + '?' + dbParam())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        renderDetail(name, d);
      })
      .catch(function (e) {
        detail.innerHTML = '<div style="padding:16px;color:var(--orange);font-size:11px">' + esc(e.message) + '</div>';
      });
  }

  function renderDetail(name, d) {
    cachedDetail = d;
    var detail = document.getElementById('table-detail');
    if (!detail) return;

    var info = d.info || {};
    var tabs = [
      { key: 'columns', label: 'Columns (' + (d.columns || []).length + ')' },
      { key: 'data', label: 'Data' },
      { key: 'constraints', label: 'Constraints (' + (d.constraints || []).length + ')' },
      { key: 'fk', label: 'Foreign Keys (' + (d.foreignKeys || []).length + ')' },
      { key: 'indexes', label: 'Indexes (' + (d.indexes || []).length + ')' },
    ];

    var html =
      '<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">' +
        '<div style="font-size:14px;font-weight:600;color:var(--text-primary);font-family:JetBrains Mono,monospace">' + esc(name) + '</div>' +
        '<div style="display:flex;gap:12px;font-size:11px;color:var(--text-tertiary)">' +
          '<span>' + esc(info.row_estimate || '0') + ' rows</span>' +
          '<span>' + esc(info.size || '--') + '</span>' +
          '<button class="btn btn-sm" onclick="openTableInEditor(\'' + esc(name) + '\')">Open in SQL Editor</button>' +
        '</div>' +
      '</div>' +
      '<div class="db-tabs">' +
        tabs.map(function (t) {
          return '<div class="db-tab' + (activeTab === t.key ? ' active' : '') + '" onclick="setTableTab(\'' + t.key + '\')">' + t.label + '</div>';
        }).join('') +
      '</div>' +
      '<div id="table-tab-content" style="flex:1;overflow:auto"></div>';

    detail.innerHTML = html;
    renderTabContent(name, d);
  }

  window.setTableTab = function (tab) {
    activeTab = tab;
    rowOffset = 0;
    if (cachedDetail) renderDetail(selectedTable, cachedDetail);
    if (tab === 'data') loadTableRows(selectedTable);
  };

  function renderTabContent(name, d) {
    var el = document.getElementById('table-tab-content');
    if (!el) return;

    if (activeTab === 'columns') {
      var cols = d.columns || [];
      el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
        '<th>Column</th><th>Type</th><th>Nullable</th><th>Default</th><th>Attributes</th>' +
        '</tr></thead><tbody>' +
        cols.map(function (c) {
          var badges = '';
          if (c.is_pk) badges += '<span class="db-badge db-badge-pk">PK</span> ';
          if (c.is_nullable === 'NO') badges += '<span class="db-badge db-badge-notnull">NOT NULL</span> ';
          var typeName = c.udt_name || c.data_type;
          if (c.character_maximum_length) typeName += '(' + c.character_maximum_length + ')';
          return '<tr>' +
            '<td style="font-weight:600">' + esc(c.column_name) + '</td>' +
            '<td><span class="db-badge db-badge-type">' + esc(typeName) + '</span></td>' +
            '<td>' + (c.is_nullable === 'YES' ? '<span style="color:var(--text-tertiary)">yes</span>' : '<span style="color:var(--cyan)">no</span>') + '</td>' +
            '<td style="font-size:10px;color:var(--text-tertiary);max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(c.column_default || '--') + '</td>' +
            '<td>' + badges + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';

    } else if (activeTab === 'data') {
      el.innerHTML = '<div style="padding:12px;color:var(--text-tertiary)">Loading rows...</div>';
      loadTableRows(name);

    } else if (activeTab === 'constraints') {
      var cons = d.constraints || [];
      if (!cons.length) { el.innerHTML = '<div class="db-empty"><div class="db-empty-text">No constraints</div></div>'; return; }
      el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
        '<th>Name</th><th>Type</th><th>Columns</th>' +
        '</tr></thead><tbody>' +
        cons.map(function (c) {
          var typeClass = c.constraint_type === 'PRIMARY KEY' ? 'db-badge-pk' : c.constraint_type === 'UNIQUE' ? 'db-badge-unique' : 'db-badge-notnull';
          return '<tr><td>' + esc(c.constraint_name) + '</td><td><span class="db-badge ' + typeClass + '">' + esc(c.constraint_type) + '</span></td><td>' + esc(c.columns) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';

    } else if (activeTab === 'fk') {
      var fks = d.foreignKeys || [];
      if (!fks.length) { el.innerHTML = '<div class="db-empty"><div class="db-empty-text">No foreign keys</div></div>'; return; }
      el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
        '<th>Constraint</th><th>Column</th><th>References</th><th>Foreign Column</th>' +
        '</tr></thead><tbody>' +
        fks.map(function (f) {
          return '<tr><td>' + esc(f.constraint_name) + '</td><td>' + esc(f.column_name) + '</td>' +
            '<td><a style="color:var(--cyan);cursor:pointer" onclick="selectTable(\'' + esc(f.foreign_table) + '\')">' + esc(f.foreign_table) + '</a></td>' +
            '<td>' + esc(f.foreign_column) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';

    } else if (activeTab === 'indexes') {
      var idxs = d.indexes || [];
      if (!idxs.length) { el.innerHTML = '<div class="db-empty"><div class="db-empty-text">No indexes</div></div>'; return; }
      el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
        '<th>Name</th><th>Definition</th><th>Size</th>' +
        '</tr></thead><tbody>' +
        idxs.map(function (ix) {
          return '<tr><td>' + esc(ix.indexname) + '</td><td style="font-size:10px">' + esc(ix.indexdef) + '</td><td>' + esc(ix.size || '--') + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';
    }
  }

  function loadTableRows(name) {
    var el = document.getElementById('table-tab-content');
    if (!el) return;
    var sortParam = rowSort ? '&sort=' + rowSort + '&order=' + rowOrder : '';
    fetch('/api/db/tables/' + encodeURIComponent(name) + '/rows?' + dbParam() + '&limit=50&offset=' + rowOffset + sortParam)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { el.innerHTML = '<div style="padding:12px;color:var(--orange)">' + esc(d.error) + '</div>'; return; }
        var rows = d.rows || [];
        if (!rows.length) { el.innerHTML = '<div class="db-empty"><div class="db-empty-text">No rows</div></div>'; return; }
        var cols = Object.keys(rows[0]);
        var html = '<div class="db-table-wrap"><table class="db-table"><thead><tr>';
        cols.forEach(function (c) {
          var sortClass = '';
          if (rowSort === c) sortClass = rowOrder === 'asc' ? ' sorted-asc' : ' sorted-desc';
          html += '<th class="' + sortClass + '" onclick="sortTableRows(\'' + esc(c) + '\')">' + esc(c) + '</th>';
        });
        html += '</tr></thead><tbody>';
        rows.forEach(function (r) {
          html += '<tr>';
          cols.forEach(function (c) {
            var v = r[c];
            if (v == null) { html += '<td class="null-val">NULL</td>'; }
            else if (typeof v === 'object') { html += '<td title="' + esc(JSON.stringify(v)) + '">' + esc(JSON.stringify(v).substring(0, 60)) + '</td>'; }
            else { var s = String(v); html += '<td title="' + esc(s) + '">' + esc(s.substring(0, 120)) + '</td>'; }
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '<div class="db-pagination">' +
          '<span>Showing ' + (rowOffset + 1) + '-' + (rowOffset + rows.length) + ' of ' + d.total + '</span>' +
          '<div class="page-buttons">' +
            '<button onclick="tablePagePrev()" ' + (rowOffset === 0 ? 'disabled' : '') + '>Prev</button>' +
            '<button onclick="tablePageNext()" ' + (rowOffset + 50 >= d.total ? 'disabled' : '') + '>Next</button>' +
          '</div>' +
        '</div>';
        el.innerHTML = html;
      })
      .catch(function (e) { el.innerHTML = '<div style="padding:12px;color:var(--orange)">' + esc(e.message) + '</div>'; });
  }

  window.sortTableRows = function (col) {
    if (rowSort === col) { rowOrder = rowOrder === 'asc' ? 'desc' : 'asc'; }
    else { rowSort = col; rowOrder = 'asc'; }
    rowOffset = 0;
    loadTableRows(selectedTable);
  };

  window.tablePagePrev = function () {
    rowOffset = Math.max(0, rowOffset - 50);
    loadTableRows(selectedTable);
  };

  window.tablePageNext = function () {
    rowOffset += 50;
    loadTableRows(selectedTable);
  };

  window.openTableInEditor = function (name) {
    switchView('sql-editor');
    setTimeout(function () {
      if (typeof sqlLoadHistory === 'undefined') return;
      // Set editor value directly via CodeMirror instance
      var container = document.getElementById('sql-editor-container');
      if (container && container.querySelector('.CodeMirror')) {
        var cm = container.querySelector('.CodeMirror').CodeMirror;
        if (cm) cm.setValue('SELECT *\nFROM ' + name + '\nLIMIT 50;');
      }
    }, 200);
  };

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
