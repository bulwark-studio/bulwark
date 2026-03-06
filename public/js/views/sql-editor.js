/**
 * Bulwark v2.1 — SQL Editor View
 * CodeMirror-powered SQL editor with autocomplete, history, Claude integration
 */
(function () {
  'use strict';

  var editor = null;
  var tableSchema = {};
  var currentPool = 'dev';

  // Reset stale data when project switches
  if (window.DbProjects) window.DbProjects.onProjectChange(function () {
    tableSchema = {};
    updateProjectBadge();
  });

  Views['sql-editor'] = {
    init: function () {
      var el = document.getElementById('view-sql-editor');
      if (!el) return;
      el.innerHTML =
        '<div class="sql-editor-layout">' +
          '<div class="sql-editor-top">' +
            // Left sidebar: saved + history
            '<div class="sql-sidebar">' +
              '<div class="sql-sidebar-section">' +
                '<div class="sql-sidebar-title">Saved Queries</div>' +
                '<div id="sql-saved-list" class="sql-sidebar-list" style="max-height:120px;overflow-y:auto"></div>' +
              '</div>' +
              '<div class="sql-sidebar-section" style="border-bottom:none;flex:1;display:flex;flex-direction:column;overflow:hidden">' +
                '<div class="sql-sidebar-title">History</div>' +
                '<div id="sql-history-list" class="sql-sidebar-list" style="flex:1;overflow-y:auto"></div>' +
              '</div>' +
            '</div>' +
            // Main editor
            '<div class="sql-editor-main">' +
              '<div class="sql-toolbar">' +
                '<div id="sql-project-badge" class="sql-project-badge" onclick="switchView(\'db-projects\')" title="Switch project in sidebar"></div>' +
                '<button class="btn btn-sm btn-primary" onclick="sqlRunQuery()" title="Ctrl+Enter">Run</button>' +
                '<button class="btn btn-sm" onclick="sqlAskClaude()" title="Ask Claude to generate SQL">Ask Claude</button>' +
                '<button class="btn btn-sm" onclick="sqlSaveQuery()">Save</button>' +
                '<button class="btn btn-sm" onclick="sqlExportCSV()" title="Export results as CSV">Export CSV</button>' +
                '<div style="flex:1"></div>' +
                '<span id="sql-status" style="font-size:11px;color:var(--text-tertiary)"></span>' +
              '</div>' +
              '<div id="sql-editor-container" style="flex:1"></div>' +
            '</div>' +
          '</div>' +
          // Results
          '<div class="sql-results">' +
            '<div class="sql-results-header">' +
              '<div class="result-meta">' +
                '<span id="sql-result-rows">Ready</span>' +
                '<span id="sql-result-time"></span>' +
                '<span id="sql-result-type"></span>' +
              '</div>' +
            '</div>' +
            '<div class="sql-results-body" id="sql-results-body">' +
              '<div class="db-empty"><div class="db-empty-text">Run a query to see results</div>' +
              '<div class="db-empty-sub">Ctrl+Enter to execute &middot; Ctrl+Space for autocomplete</div></div>' +
            '</div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      if (!window.DbHeader || !window.DbHeader.require()) return;
      initEditor();
      loadSchema();
      loadHistory();
      loadSaved();
    },

    hide: function () {},
    update: function () {}
  };

  function initEditor() {
    if (editor) return;
    var container = document.getElementById('sql-editor-container');
    if (!container || typeof CodeMirror === 'undefined') return;

    editor = CodeMirror(container, {
      value: 'SELECT table_name, pg_size_pretty(pg_total_relation_size(\n  quote_ident(\'public\')||\'.\' ||quote_ident(table_name)\n)) as size\nFROM information_schema.tables\nWHERE table_schema = \'public\'\nORDER BY pg_total_relation_size(\n  quote_ident(\'public\')||\'.\' ||quote_ident(table_name)\n) DESC\nLIMIT 20;',
      mode: 'text/x-pgsql',
      theme: 'material-darker',
      lineNumbers: true,
      lineWrapping: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      extraKeys: {
        'Ctrl-Enter': function () { sqlRunQuery(); },
        'Cmd-Enter': function () { sqlRunQuery(); },
        'Ctrl-Space': 'autocomplete',
        'Ctrl-S': function () { sqlSaveQuery(); },
      },
      hintOptions: {
        tables: tableSchema,
        completeSingle: false,
      },
    });

    // Auto-trigger hints on typing
    editor.on('inputRead', function (cm, change) {
      if (change.text[0] && /[a-zA-Z_.]/.test(change.text[0])) {
        cm.showHint({ completeSingle: false });
      }
    });
  }

  function loadSchema() {
    fetch('/api/db/tables?' + dbParam())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.tables) return;
        tableSchema = {};
        var promises = [];
        d.tables.forEach(function (t) {
          tableSchema[t.name] = [];
        });
        // Fetch columns for autocomplete (batch via individual table detail)
        // For performance, get all columns at once
        fetch('/api/db/query?' + dbParam(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position" })
        })
        .then(function (r) { return r.json(); })
        .then(function (cd) {
          if (cd.rows) {
            cd.rows.forEach(function (row) {
              if (tableSchema[row.table_name]) {
                tableSchema[row.table_name].push(row.column_name);
              }
            });
          }
          if (editor) {
            editor.setOption('hintOptions', { tables: tableSchema, completeSingle: false });
          }
        })
        .catch(function () {});
      })
      .catch(function () {});
  }

  function loadHistory() {
    fetch('/api/db/query/history')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var el = document.getElementById('sql-history-list');
        if (!el) return;
        var items = (d.history || []).slice(0, 50);
        if (!items.length) { el.innerHTML = '<div style="color:var(--text-tertiary);font-size:10px;padding:4px 8px">No history yet</div>'; return; }
        el.innerHTML = items.map(function (h, i) {
          var label = (h.sql || '').substring(0, 60).replace(/\s+/g, ' ');
          var color = h.type === 'ERROR' ? 'var(--orange)' : 'var(--text-secondary)';
          return '<button class="sql-sidebar-item" onclick="sqlLoadHistory(' + i + ')" style="color:' + color + '" title="' + esc(h.sql || '') + '">' + esc(label) + '</button>';
        }).join('');
      })
      .catch(function () {});
  }

  function loadSaved() {
    fetch('/api/db/query/saved')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var el = document.getElementById('sql-saved-list');
        if (!el) return;
        var items = d.queries || [];
        if (!items.length) { el.innerHTML = '<div style="color:var(--text-tertiary);font-size:10px;padding:4px 8px">No saved queries</div>'; return; }
        el.innerHTML = items.map(function (q, i) {
          return '<button class="sql-sidebar-item" onclick="sqlLoadSaved(' + i + ')" title="' + esc(q.sql || '') + '">' + esc(q.name) + '</button>';
        }).join('');
      })
      .catch(function () {});
  }

  // Stored results for export
  var lastResults = null;
  var lastHistory = [];

  function updateProjectBadge() {
    var badge = document.getElementById('sql-project-badge');
    if (!badge) return;
    var active = window.DbProjects && window.DbProjects.active ? window.DbProjects.active() : null;
    badge.innerHTML = '<span class="db-project-dot" style="background:' + (active ? active.color : 'var(--text-tertiary)') + '"></span>' +
      '<span>' + (active ? active.name : 'Default DB') + '</span>' +
      '<svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-left:2px"><path d="M2 4l4 4 4-4"/></svg>';
  }

  window.sqlRunQuery = function () {
    if (!editor) return;
    var sql = editor.getSelection() || editor.getValue();
    if (!sql.trim()) return;

    var statusEl = document.getElementById('sql-status');
    if (statusEl) statusEl.textContent = 'Running...';

    var isDDL = /^\s*(DROP|TRUNCATE|ALTER|CREATE)\s/i.test(sql);
    var url = '/api/db/query?' + dbParam();
    if (isDDL) {
      if (!confirm('This is a DDL statement (CREATE/ALTER/DROP/TRUNCATE). Execute?')) return;
      url += '&allow_ddl=true';
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sql })
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) {
        showError(d.error, d.position);
        if (statusEl) statusEl.textContent = 'Error';
        return;
      }
      lastResults = d;
      renderResults(d);
      loadHistory();
      if (statusEl) statusEl.textContent = '';
    })
    .catch(function (e) {
      showError(e.message);
      if (statusEl) statusEl.textContent = 'Error';
    });
  };

  window.sqlAskClaude = function () {
    Modal.open({
      title: 'Ask Claude — SQL Generator',
      size: 'sm',
      body: '<div class="form-group"><label class="form-label">Describe what you need</label>' +
        '<textarea id="claude-sql-prompt" class="form-input" rows="3" placeholder="e.g., Find all agents with more than 5 skills, sorted by creation date"></textarea></div>' +
        '<div id="claude-sql-status" style="color:var(--text-tertiary);font-size:11px;margin-top:8px"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" id="claude-sql-btn">Generate SQL</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('claude-sql-btn');
      if (btn) btn.onclick = function () {
        var prompt = (document.getElementById('claude-sql-prompt') || {}).value;
        if (!prompt) return;
        var status = document.getElementById('claude-sql-status');
        if (status) status.textContent = 'Generating...';
        btn.disabled = true;
        fetch('/api/db/claude/generate?' + dbParam(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt })
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.sql && editor) {
            editor.setValue(d.sql);
            Modal.close(btn.closest('.modal-overlay'));
            Toast.success('SQL generated — review before running');
          } else {
            if (status) status.textContent = d.error || 'No SQL generated';
            btn.disabled = false;
          }
        })
        .catch(function (e) {
          if (status) status.textContent = e.message;
          btn.disabled = false;
        });
      };
    }, 50);
  };

  window.sqlSaveQuery = function () {
    if (!editor) return;
    var sql = editor.getValue();
    if (!sql.trim()) return;
    var name = prompt('Query name:');
    if (!name) return;
    fetch('/api/db/query/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, sql: sql })
    })
    .then(function () { Toast.success('Query saved'); loadSaved(); })
    .catch(function () { Toast.error('Failed to save'); });
  };

  window.sqlExportCSV = function () {
    if (!lastResults || !lastResults.rows || !lastResults.rows.length) { Toast.warning('No results to export'); return; }
    var rows = lastResults.rows;
    var cols = Object.keys(rows[0]);
    var csv = cols.join(',') + '\n';
    rows.forEach(function (r) {
      csv += cols.map(function (c) {
        var v = r[c];
        if (v == null) return '';
        v = String(v);
        if (v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0) {
          return '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
      }).join(',') + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'query-results.csv';
    a.click();
    Toast.success('CSV downloaded');
  };

  window.sqlLoadHistory = function (idx) {
    fetch('/api/db/query/history')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var item = (d.history || [])[idx];
        if (item && editor) editor.setValue(item.sql || '');
      })
      .catch(function () {});
  };

  window.sqlLoadSaved = function (idx) {
    fetch('/api/db/query/saved')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var item = (d.queries || [])[idx];
        if (item && editor) editor.setValue(item.sql || '');
      })
      .catch(function () {});
  };

  function renderResults(d) {
    var rows = d.rows || [];
    var metaRows = document.getElementById('sql-result-rows');
    var metaTime = document.getElementById('sql-result-time');
    var metaType = document.getElementById('sql-result-type');
    var body = document.getElementById('sql-results-body');

    if (metaRows) metaRows.textContent = rows.length + ' rows' + (d.truncated ? ' (truncated)' : '');
    if (metaTime) metaTime.textContent = d.duration + 'ms';
    if (metaType) metaType.textContent = d.type || '';

    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '<div class="db-empty"><div class="db-empty-text">' +
        (d.rowCount != null ? d.rowCount + ' rows affected' : 'No rows returned') +
        '</div></div>';
      return;
    }

    var cols = Object.keys(rows[0]);
    var html = '<div class="db-table-wrap"><table class="db-table"><thead><tr>';
    cols.forEach(function (c) {
      html += '<th onclick="sqlSortResults(\'' + esc(c) + '\')">' + esc(c) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr>';
      cols.forEach(function (c) {
        var v = r[c];
        if (v == null) {
          html += '<td class="null-val">NULL</td>';
        } else if (typeof v === 'object') {
          html += '<td title="' + esc(JSON.stringify(v)) + '">' + esc(JSON.stringify(v).substring(0, 80)) + '</td>';
        } else {
          var s = String(v);
          html += '<td title="' + esc(s) + '">' + esc(s.substring(0, 200)) + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    body.innerHTML = html;
  }

  var sortCol = null, sortDir = 'asc';
  window.sqlSortResults = function (col) {
    if (!lastResults || !lastResults.rows) return;
    if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
    else { sortCol = col; sortDir = 'asc'; }
    lastResults.rows.sort(function (a, b) {
      var va = a[col], vb = b[col];
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    renderResults(lastResults);
  };

  function showError(msg, position) {
    var body = document.getElementById('sql-results-body');
    var metaRows = document.getElementById('sql-result-rows');
    if (metaRows) metaRows.textContent = 'Error';
    if (body) {
      body.innerHTML = '<div style="padding:16px;color:var(--orange);font-family:JetBrains Mono,monospace;font-size:12px;white-space:pre-wrap">' +
        esc(msg) + (position ? '\n\nPosition: ' + position : '') + '</div>';
    }
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
