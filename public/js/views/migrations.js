/**
 * Bulwark v3.0 — Migration Manager View
 * Migration list, run, Docker test-run, schema diff, Claude review
 */
(function () {
  'use strict';

  var migrations = [];
  var diffResult = null;
  var currentPool = 'dev';

  // Reset stale data when project switches
  if (window.DbProjects) window.DbProjects.onProjectChange(function () {
    migrations = []; diffResult = null;
    var list = document.getElementById('mig-list');
    if (list) list.innerHTML = '';
    var diff = document.getElementById('mig-diff-section');
    if (diff) diff.innerHTML = '';
    var bar = document.getElementById('mig-status-bar');
    if (bar) bar.innerHTML = 'Select a project to view migrations';
  });

  Views.migrations = {
    init: function () {
      var el = document.getElementById('view-migrations');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<div class="section-title">Migration Manager</div>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<button class="btn btn-sm" onclick="runDeployAudit()">Audit Deployment</button>' +
            '<button class="btn btn-sm" onclick="runSchemaDiff()">Schema Diff</button>' +
            '<button class="btn btn-sm btn-primary" onclick="runDockerTest()">Docker Test</button>' +
          '</div>' +
        '</div>' +
        '<div id="mig-status-bar" class="db-info-bar">Loading...</div>' +
        '<div id="mig-list" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;max-height:50vh;overflow-y:auto"></div>' +
        '<div id="mig-diff-section" style="margin-top:16px"></div>';
    },

    show: function () {
      if (!window.DbHeader || !window.DbHeader.require()) return;
      loadMigrations();
    },

    hide: function () {},
    update: function () {}
  };

  window.migSetPool = function (pool) {
    currentPool = pool;
    loadMigrations();
  };

  function loadMigrations() {
    var statusEl = document.getElementById('mig-status-bar');
    var listEl = document.getElementById('mig-list');
    if (statusEl) statusEl.innerHTML = 'Loading migrations...';

    fetch('/api/db/migrations?' + dbParam())
      .then(safeJson)
      .then(function (d) {
        migrations = d.migrations || [];
        var applied = d.applied || 0;
        var pending = d.pending || 0;
        var total = d.total || 0;

        if (statusEl) {
          statusEl.innerHTML =
            '<div class="info-item"><span>Total:</span> <span class="info-value">' + total + '</span></div>' +
            '<div class="info-item"><span>Applied:</span> <span class="info-value" style="color:var(--cyan)">' + applied + '</span></div>' +
            '<div class="info-item"><span>Pending:</span> <span class="info-value" style="color:' + (pending > 0 ? 'var(--orange)' : 'var(--text-tertiary)') + '">' + pending + '</span></div>' +
            '<div class="info-item"><span>Pool:</span> <span class="info-value">' + esc(currentPool) + '</span></div>';
        }

        renderMigrationList();
      })
      .catch(function (e) {
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--orange)">' + esc(e.message) + '</span>';
      });
  }

  function renderMigrationList() {
    var el = document.getElementById('mig-list');
    if (!el) return;

    if (!migrations.length) {
      el.innerHTML = '<div class="db-empty"><div class="db-empty-text">No migration files found</div>' +
        '<div class="db-empty-sub">Expected at: admin/supabase/migrations/</div></div>';
      return;
    }

    el.innerHTML = migrations.map(function (m) {
      var statusClass = m.applied ? 'applied' : 'pending';
      var statusIcon = m.applied ? '&#10003;' : '&#9675;';
      var dateStr = m.applied_at ? timeAgo(new Date(m.applied_at)) : 'PENDING';
      return '<div class="migration-item">' +
        '<div class="migration-status ' + statusClass + '">' + statusIcon + '</div>' +
        '<div class="migration-name">' + esc(m.name) + '</div>' +
        '<div class="migration-date">' + esc(dateStr) + '</div>' +
        '<div style="display:flex;gap:4px">' +
          '<button class="btn btn-sm" onclick="previewMigration(\'' + esc(m.name) + '\')">View</button>' +
          (!m.applied ? '<button class="btn btn-sm btn-primary" onclick="applyMigration(\'' + esc(m.name) + '\')">Apply</button>' : '') +
          '<button class="btn btn-sm" onclick="dockerTestMigration(\'' + esc(m.name) + '\')">Test</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.previewMigration = function (name) {
    fetch('/api/db/migrations/' + encodeURIComponent(name) + '/preview')
      .then(safeJson)
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Modal.open({
          title: 'Migration: ' + name,
          size: 'xl',
          body: '<pre style="font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-primary);white-space:pre-wrap;max-height:60vh;overflow:auto;background:rgba(0,0,0,0.2);padding:16px;border-radius:8px;border:1px solid var(--border)">' +
            esc(d.sql) + '</pre>',
          footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>' +
            '<button class="btn btn-sm" onclick="claudeReviewMigration(\'' + esc(name) + '\')">Claude Review</button>'
        });
      })
      .catch(function (e) { Toast.error(e.message); });
  };

  window.applyMigration = function (name) {
    Modal.confirm({
      title: 'Apply Migration',
      message: 'Apply "' + name + '" to ' + currentPool + ' database? This will execute the SQL directly against the live database.',
      confirmText: 'Apply Migration',
      dangerous: true
    }).then(function (yes) {
      if (!yes) return;
      Toast.info('Applying migration...');
      fetch('/api/db/migrations/run?' + dbParam(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
      })
      .then(safeJson)
      .then(function (d) {
        if (d.error) { Toast.error('Migration failed: ' + d.error); return; }
        Toast.success('Migration applied: ' + name);
        loadMigrations();
      })
      .catch(function (e) { Toast.error(e.message); });
    });
  };

  window.dockerTestMigration = function (name) {
    Toast.info('Starting Docker test for ' + name + '...');
    var statusEl = document.getElementById('mig-status-bar');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--cyan)">Docker test running... spinning up container, loading schema, applying migration</span>';

    fetch('/api/db/migrations/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    })
    .then(safeJson)
    .then(function (d) {
      loadMigrations(); // restore status bar
      if (d.error) {
        Toast.error('Docker test failed');
        showDockerResult(name, false, d.error);
        return;
      }
      if (d.success) {
        Toast.success('Docker test PASSED');
      } else {
        Toast.error('Docker test FAILED');
      }
      showDockerResult(name, d.success, d.migration_output, d.table_count, d.schema_loaded);
    })
    .catch(function (e) {
      loadMigrations();
      Toast.error('Docker test error: ' + e.message);
    });
  };

  window.runDockerTest = function () {
    // Test all pending migrations
    var pending = migrations.filter(function (m) { return !m.applied; });
    if (!pending.length) { Toast.info('No pending migrations to test'); return; }
    dockerTestMigration(pending[0].name);
  };

  function showDockerResult(name, success, output, tableCount, schemaLoaded) {
    Modal.open({
      title: 'Docker Test: ' + name,
      size: 'xl',
      body:
        '<div style="margin-bottom:12px">' +
          '<span class="db-badge ' + (success ? 'db-badge-pk' : 'db-badge-notnull') + '" style="font-size:12px;padding:4px 12px">' +
            (success ? 'PASSED' : 'FAILED') +
          '</span>' +
          (tableCount ? ' <span style="color:var(--text-tertiary);font-size:11px;margin-left:8px">' + tableCount + ' tables after migration</span>' : '') +
          (schemaLoaded !== undefined ? ' <span style="color:var(--text-tertiary);font-size:11px;margin-left:8px">Schema load: ' + (schemaLoaded ? 'OK' : 'FAILED') + '</span>' : '') +
        '</div>' +
        '<pre style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--text-primary);white-space:pre-wrap;max-height:50vh;overflow:auto;background:rgba(0,0,0,0.2);padding:16px;border-radius:8px;border:1px solid var(--border)">' +
          esc(output || 'No output') +
        '</pre>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>'
    });
  }

  window.runSchemaDiff = function () {
    var diffEl = document.getElementById('mig-diff-section');
    if (!diffEl) return;
    diffEl.innerHTML = '<div style="padding:12px;color:var(--text-tertiary);font-size:11px">Running schema diff...</div>';

    fetch('/api/db/migrations/diff?' + dbParam(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(safeJson)
    .then(function (d) {
      if (d.error) { diffEl.innerHTML = '<div style="color:var(--orange)">' + esc(d.error) + '</div>'; return; }
      diffResult = d;
      renderDiff(d);
    })
    .catch(function (e) { diffEl.innerHTML = '<div style="color:var(--orange)">' + esc(e.message) + '</div>'; });
  };

  function renderDiff(d) {
    var diffEl = document.getElementById('mig-diff-section');
    if (!diffEl) return;

    var html = '<div class="db-info-bar" style="margin-bottom:12px">' +
      '<div class="info-item"><span>Live Tables:</span> <span class="info-value">' + d.live_tables + '</span></div>' +
      '<div class="info-item"><span>Expected (schema + migrations):</span> <span class="info-value">' + d.schema_tables + '</span></div>' +
      (d.schema_only ? '<div class="info-item"><span>From schema.sql:</span> <span class="info-value">' + d.schema_only + '</span></div>' : '') +
      (d.migration_added ? '<div class="info-item"><span>Added by migrations:</span> <span class="info-value">' + d.migration_added + '</span></div>' : '') +
      '<div class="info-item"><span>Status:</span> <span class="info-value" style="color:' + (d.match ? 'var(--cyan)' : 'var(--orange)') + '">' + (d.match ? 'IN SYNC' : 'OUT OF SYNC') + '</span></div>' +
    '</div>';

    if (d.missing_in_live && d.missing_in_live.length) {
      html += '<div class="diff-section diff-missing">' +
        '<div class="diff-title">Missing in Live DB (' + d.missing_in_live.length + ')</div>' +
        '<div class="diff-list">' + d.missing_in_live.map(function (t) { return esc(t); }).join('<br>') + '</div>' +
      '</div>';
    }

    if (d.extra_in_live && d.extra_in_live.length) {
      html += '<div class="diff-section diff-extra">' +
        '<div class="diff-title">Extra in Live DB (not in schema.sql) (' + d.extra_in_live.length + ')</div>' +
        '<div class="diff-list">' + d.extra_in_live.map(function (t) { return esc(t); }).join('<br>') + '</div>' +
      '</div>';
    }

    if (d.match) {
      html += '<div class="diff-section" style="border-color:rgba(34,211,238,0.3);background:rgba(34,211,238,0.05)">' +
        '<div class="diff-title" style="color:var(--cyan)">Schema is in sync</div>' +
      '</div>';
    }

    diffEl.innerHTML = html;
  }

  window.claudeReviewMigration = function (name) {
    Modal.close(document.querySelector('.modal-overlay'));
    Toast.info('Asking Claude to review migration...');
    fetch('/api/db/migrations/' + encodeURIComponent(name) + '/preview')
      .then(safeJson)
      .then(function (d) {
        if (!d.sql) { Toast.error('Could not load migration'); return; }
        fetch('/api/claude/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Review this PostgreSQL migration SQL for safety issues, potential data loss, missing indexes, and best practices. Migration file: ' + name + '\n\n' + d.sql.substring(0, 4000)
          })
        })
        .then(function () { Toast.success('Claude reviewing — check Claude view for output'); })
        .catch(function () { Toast.error('Claude CLI not available'); });
      })
      .catch(function (e) { Toast.error(e.message); });
  };

  // ── Deployment Audit ────────────────────────────────────────────────────
  window.runDeployAudit = function () {
    Toast.info('Running deployment audit...');
    var diffEl = document.getElementById('mig-diff-section');
    if (diffEl) diffEl.innerHTML = '<div style="padding:16px;color:var(--text-tertiary);font-size:12px">Auditing database — checking tables, columns, indexes, triggers, foreign keys, extensions, migrations, seed data...</div>';

    fetch('/api/db/migrations/audit?' + dbParam(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(safeJson)
    .then(function (d) {
      if (d.error) { Toast.error(d.error); if (diffEl) diffEl.innerHTML = ''; return; }
      renderAuditReport(d);
      if (d.healthy) Toast.success('Audit passed — grade ' + d.grade);
      else Toast.error(d.issues.length + ' issue(s) found — grade ' + d.grade);
    })
    .catch(function (e) { Toast.error(e.message); if (diffEl) diffEl.innerHTML = ''; });
  };

  function renderAuditReport(d) {
    var diffEl = document.getElementById('mig-diff-section');
    if (!diffEl) return;

    var gradeColor = d.grade === 'A' ? 'var(--cyan)' : d.grade === 'B' ? '#facc15' : 'var(--orange)';

    var html =
      // Header
      '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-top:4px">' +
        '<div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.15)">' +
          '<div>' +
            '<div style="font-size:15px;font-weight:600;color:var(--text-primary)">Deployment Audit</div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">' + esc(d.summary) + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:16px">' +
            '<div style="text-align:center">' +
              '<div style="font-size:28px;font-weight:700;color:' + gradeColor + ';line-height:1">' + esc(d.grade) + '</div>' +
              '<div style="font-size:10px;color:var(--text-tertiary)">' + d.score + '/' + d.maxScore + ' checks</div>' +
            '</div>' +
          '</div>' +
        '</div>';

    // Issues banner
    if (d.issues && d.issues.length) {
      html += '<div style="padding:10px 20px;background:rgba(255,107,43,0.08);border-bottom:1px solid rgba(255,107,43,0.2)">';
      d.issues.forEach(function (issue) {
        html += '<div style="font-size:12px;color:var(--orange);margin:2px 0">&#9888; ' + esc(issue) + '</div>';
      });
      html += '</div>';
    }

    // Categories
    d.categories.forEach(function (cat) {
      var icon = cat.status === 'pass' ? '<span style="color:var(--cyan)">&#10003;</span>' :
                 cat.status === 'warn' ? '<span style="color:#facc15">&#9679;</span>' :
                 '<span style="color:var(--orange)">&#10007;</span>';
      html += '<div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px">' +
        '<div style="font-size:14px;margin-top:1px;flex-shrink:0;width:18px;text-align:center">' + icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:13px;font-weight:600;color:var(--text-primary)">' + esc(cat.name) + '</span>' +
            '<span style="font-size:11px;color:var(--text-tertiary)">' + esc(cat.detail) + '</span>' +
          '</div>';

      // Extra details per category
      if (cat.missing && cat.missing.length) {
        html += '<div style="margin-top:6px;font-size:11px;color:var(--orange)">Missing: ' + cat.missing.map(esc).join(', ') + '</div>';
      }
      if (cat.unapplied && cat.unapplied.length) {
        html += '<div style="margin-top:6px;font-size:11px;color:var(--orange)">Unapplied: ' + cat.unapplied.map(esc).join(', ') + '</div>';
      }
      if (cat.empty_tables && cat.empty_tables.length) {
        html += '<div style="margin-top:6px;font-size:11px;color:#facc15">Empty tables: ' + cat.empty_tables.map(esc).join(', ') + '</div>';
      }
      if (cat.installed) {
        html += '<div style="margin-top:6px;font-size:11px;color:var(--text-tertiary)">' + cat.installed.map(esc).join(', ') + '</div>';
      }
      if (cat.functions && cat.functions.length) {
        html += '<div style="margin-top:6px;font-size:11px;color:var(--text-tertiary)">' + cat.functions.map(esc).join(', ') + '</div>';
      }
      if (cat.top_tables && cat.top_tables.length) {
        html += '<div style="margin-top:6px;font-size:11px;color:var(--text-tertiary)">' +
          cat.top_tables.map(function (t) { return esc(t.table) + ' (' + t.rows + ')'; }).join(', ') + '</div>';
      }

      html += '</div></div>';
    });

    html += '</div>';
    diffEl.innerHTML = html;
  }

  function timeAgo(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return seconds + 's ago';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
