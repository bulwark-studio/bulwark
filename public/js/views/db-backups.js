/**
 * Chester Dev Monitor v2.0 — Database Backups View
 * pg_dump/pg_restore backup management
 */
(function () {
  'use strict';

  var currentPool = 'dev';

  Views['db-backups'] = {
    init: function () {
      var el = document.getElementById('view-db-backups');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<div class="section-title">Database Backups</div>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<select id="backups-pool-select" onchange="backupsSetPool(this.value)" style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text-primary);font-size:11px">' +
              '<option value="dev">Dev DB</option>' +
              '<option value="vps">VPS DB</option>' +
            '</select>' +
            '<button class="btn btn-sm btn-primary" onclick="createBackup()">Create Backup</button>' +
          '</div>' +
        '</div>' +
        '<div id="backup-status" class="db-info-bar" style="display:none"></div>' +
        '<div id="backup-list" style="border:1px solid var(--border);border-radius:10px;overflow:hidden">' +
          '<div style="padding:16px;color:var(--text-tertiary);font-size:11px">Loading backups...</div>' +
        '</div>';
    },

    show: function () {
      loadBackups();
    },

    hide: function () {},
    update: function () {}
  };

  window.backupsSetPool = function (pool) {
    currentPool = pool;
    loadBackups();
  };

  function loadBackups() {
    var el = document.getElementById('backup-list');
    if (!el) return;

    fetch('/api/db/backups')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var backups = d.backups || [];
        if (!backups.length) {
          el.innerHTML = '<div class="db-empty"><div class="db-empty-text">No backups yet</div>' +
            '<div class="db-empty-sub">Click "Create Backup" to run pg_dump</div></div>';
          return;
        }
        el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
          '<th>Filename</th><th>Size</th><th>Created</th><th>Actions</th>' +
          '</tr></thead><tbody>' +
          backups.map(function (b) {
            var created = b.created ? timeAgo(new Date(b.created)) : '--';
            return '<tr>' +
              '<td style="font-family:JetBrains Mono,monospace;font-size:11px">' + esc(b.name) + '</td>' +
              '<td>' + esc(b.size_pretty || '--') + '</td>' +
              '<td>' + esc(created) + '</td>' +
              '<td style="display:flex;gap:4px">' +
                '<a href="/api/db/backups/' + encodeURIComponent(b.name) + '/download" class="btn btn-sm" download>Download</a>' +
                '<button class="btn btn-sm" onclick="restoreBackup(\'' + esc(b.name) + '\')">Restore</button>' +
              '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table></div>';
      })
      .catch(function (e) {
        el.innerHTML = '<div style="padding:16px;color:var(--orange);font-size:11px">' + esc(e.message) + '</div>';
      });
  }

  window.createBackup = function () {
    var statusEl = document.getElementById('backup-status');
    if (statusEl) {
      statusEl.style.display = '';
      statusEl.innerHTML = '<span style="color:var(--cyan)">Creating backup via pg_dump... this may take a moment</span>';
    }
    Toast.info('Creating backup...');

    fetch('/api/db/backup?pool=' + currentPool, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) {
          Toast.error('Backup failed: ' + d.error);
          if (statusEl) statusEl.innerHTML = '<span style="color:var(--orange)">' + esc(d.error) + '</span>';
          return;
        }
        Toast.success('Backup created: ' + d.filename + ' (' + d.size_pretty + ')');
        if (statusEl) {
          statusEl.innerHTML =
            '<div class="info-item"><span>Last backup:</span> <span class="info-value">' + esc(d.filename) + '</span></div>' +
            '<div class="info-item"><span>Size:</span> <span class="info-value">' + esc(d.size_pretty) + '</span></div>';
        }
        loadBackups();
      })
      .catch(function (e) {
        Toast.error('Backup error: ' + e.message);
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--orange)">' + esc(e.message) + '</span>';
      });
  };

  window.restoreBackup = function (filename) {
    Modal.confirm({
      title: 'Restore Backup',
      message: 'Restore <strong>' + esc(filename) + '</strong> to <strong>' + currentPool + '</strong> database?<br><br>' +
        '<span style="color:var(--orange);font-weight:600">WARNING: This will overwrite existing data in the target database.</span>',
      confirmLabel: 'Restore',
      onConfirm: function () {
        Toast.info('Restoring backup...');
        var statusEl = document.getElementById('backup-status');
        if (statusEl) {
          statusEl.style.display = '';
          statusEl.innerHTML = '<span style="color:var(--cyan)">Restoring ' + esc(filename) + '...</span>';
        }

        fetch('/api/db/backup/restore?pool=' + currentPool, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: filename })
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.success) {
            Toast.success('Backup restored');
            if (statusEl) statusEl.innerHTML = '<span style="color:var(--cyan)">Restore complete</span>';
          } else {
            Toast.error('Restore had issues');
            if (statusEl) statusEl.innerHTML = '<span style="color:var(--orange)">Restore completed with warnings</span>';
          }
        })
        .catch(function (e) {
          Toast.error('Restore failed: ' + e.message);
          if (statusEl) statusEl.innerHTML = '<span style="color:var(--orange)">' + esc(e.message) + '</span>';
        });
      }
    });
  };

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
