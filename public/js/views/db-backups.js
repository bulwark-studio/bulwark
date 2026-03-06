/**
 * Chester Dev Monitor v2.1 — Backup Intelligence Center
 * AI-powered backup strategy, disaster recovery analysis, retention management
 */
(function () {
  'use strict';

  var currentPool = 'dev';
  var backups = [];
  var strategyData = null;
  var activeTab = 'backups';

  if (window.DbProjects) window.DbProjects.onProjectChange(function () {
    backups = []; strategyData = null;
    var el = document.getElementById('view-db-backups');
    if (el) Views['db-backups'].init();
  });

  Views['db-backups'] = {
    init: function () {
      var el = document.getElementById('view-db-backups');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<div class="section-title">Backup Intelligence Center</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-sm" onclick="backupAIStrategy()" id="backup-ai-btn">AI Strategy</button>' +
            '<button class="btn btn-sm btn-primary" onclick="createBackup()">Create Backup</button>' +
          '</div>' +
        '</div>' +
        // AI Strategy Banner
        '<div id="backup-strategy-banner" style="display:none"></div>' +
        // Tabs
        '<div class="db-tabs" id="backup-tabs">' +
          '<div class="db-tab active" onclick="backupTab(\'backups\')">Backups</div>' +
          '<div class="db-tab" onclick="backupTab(\'strategy\')">AI Strategy</div>' +
          '<div class="db-tab" onclick="backupTab(\'recovery\')">Disaster Recovery</div>' +
        '</div>' +
        '<div id="backup-tab-content" style="margin-top:12px">' +
          '<div id="backup-status" class="db-info-bar" style="display:none"></div>' +
          '<div id="backup-list" style="border:1px solid var(--border);border-radius:10px;overflow:hidden">' +
            '<div style="padding:16px;color:var(--text-tertiary);font-size:11px">Loading backups...</div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      if (!window.DbHeader || !window.DbHeader.require()) return;
      loadBackups();
    },

    hide: function () {},
    update: function () {}
  };

  window.backupsSetPool = function (pool) { currentPool = pool; strategyData = null; loadBackups(); };

  window.backupTab = function (tab) {
    activeTab = tab;
    var tabs = document.querySelectorAll('#backup-tabs .db-tab');
    tabs.forEach(function (t, i) { t.className = 'db-tab' + (['backups', 'strategy', 'recovery'][i] === tab ? ' active' : ''); });
    renderTabContent();
  };

  function renderTabContent() {
    var el = document.getElementById('backup-tab-content');
    if (!el) return;
    if (activeTab === 'backups') {
      el.innerHTML = '<div id="backup-status" class="db-info-bar" style="display:none"></div>' +
        '<div id="backup-list" style="border:1px solid var(--border);border-radius:10px;overflow:hidden"></div>';
      renderBackupList();
    } else if (activeTab === 'strategy') {
      renderStrategy(el);
    } else if (activeTab === 'recovery') {
      renderRecovery(el);
    }
  }

  function loadBackups() {
    fetch('/api/db/backups')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        backups = d.backups || [];
        renderBackupList();
        renderQuickStats();
      })
      .catch(function (e) {
        var el = document.getElementById('backup-list');
        if (el) el.innerHTML = '<div style="padding:16px;color:var(--orange);font-size:11px">' + esc(e.message) + '</div>';
      });
  }

  function renderQuickStats() {
    var banner = document.getElementById('backup-strategy-banner');
    if (!banner || strategyData) return;
    if (!backups.length) return;

    var totalSize = backups.reduce(function (s, b) { return s + b.size; }, 0);
    var newest = backups[0];
    var age = newest ? timeSince(new Date(newest.created)) : 'never';
    var sizePretty = totalSize > 1048576 ? (totalSize / 1048576).toFixed(1) + ' MB' : (totalSize / 1024).toFixed(0) + ' KB';

    banner.style.display = '';
    banner.innerHTML =
      '<div class="db-info-bar">' +
        '<div class="info-item"><span>Backups:</span> <span class="info-value">' + backups.length + '</span></div>' +
        '<div class="info-item"><span>Total Size:</span> <span class="info-value">' + sizePretty + '</span></div>' +
        '<div class="info-item"><span>Last Backup:</span> <span class="info-value" style="color:' + (parseAge(age) > 24 ? 'var(--orange)' : 'var(--cyan)') + '">' + age + '</span></div>' +
        '<div class="info-item"><span>Oldest:</span> <span class="info-value">' + (backups.length > 1 ? timeSince(new Date(backups[backups.length - 1].created)) : age) + '</span></div>' +
      '</div>';
  }

  function renderBackupList() {
    var el = document.getElementById('backup-list');
    if (!el) return;

    if (!backups.length) {
      el.innerHTML = '<div class="db-empty"><div class="db-empty-text">No backups yet</div>' +
        '<div class="db-empty-sub">Click "Create Backup" to run pg_dump</div></div>';
      return;
    }

    el.innerHTML = '<div class="db-table-wrap"><table class="db-table"><thead><tr>' +
      '<th>Status</th><th>Filename</th><th>Size</th><th>Created</th><th>Age</th><th>Actions</th>' +
      '</tr></thead><tbody>' +
      backups.map(function (b, i) {
        var age = timeSince(new Date(b.created));
        var ageHours = parseAge(age);
        var statusColor = ageHours < 24 ? 'var(--cyan)' : ageHours < 168 ? '#f0c674' : 'var(--orange)';
        var statusIcon = ageHours < 24 ? '\u2713' : ageHours < 168 ? '\u25CB' : '\u2717';
        return '<tr>' +
          '<td><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:' + statusColor + '15;color:' + statusColor + ';font-size:11px;font-weight:700">' + statusIcon + '</span></td>' +
          '<td style="font-family:JetBrains Mono,monospace;font-size:11px">' + esc(b.name) + '</td>' +
          '<td>' + esc(b.size_pretty || '--') + '</td>' +
          '<td style="font-size:11px;color:var(--text-secondary)">' + new Date(b.created).toLocaleString() + '</td>' +
          '<td style="color:' + statusColor + ';font-size:11px">' + age + '</td>' +
          '<td style="display:flex;gap:4px">' +
            '<a href="/api/db/backups/' + encodeURIComponent(b.name) + '/download" class="btn btn-sm" download>Download</a>' +
            '<button class="btn btn-sm" onclick="restoreBackup(\'' + esc(b.name) + '\')">Restore</button>' +
            '<button class="btn btn-sm" onclick="deleteBackupConfirm(\'' + esc(b.name) + '\')" style="color:var(--orange)">Delete</button>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  // ── AI Strategy Tab ─────────────────────────────────────────────────────
  function renderStrategy(container) {
    if (!strategyData) {
      container.innerHTML = '<div class="db-empty"><div class="db-empty-text">Run AI Backup Strategy Analysis</div>' +
        '<div class="db-empty-sub">AI will analyze your database and recommend backup frequency, retention, and storage optimization</div>' +
        '<button class="btn btn-sm btn-primary" style="margin-top:16px" onclick="backupAIStrategy()">Analyze Now</button></div>';
      return;
    }

    if (strategyData.error) {
      container.innerHTML = '<div class="db-empty"><div class="db-empty-text" style="color:var(--orange)">' + esc(strategyData.error) + '</div></div>';
      return;
    }

    var s = strategyData;
    var scoreColor = (s.health_score || 0) >= 70 ? 'var(--cyan)' : (s.health_score || 0) >= 40 ? '#f0c674' : 'var(--orange)';

    var html = '<div style="padding:16px">';

    // Health score header
    html += '<div style="display:flex;align-items:center;gap:20px;padding:20px;border:1px solid var(--border);border-radius:12px;background:rgba(0,0,0,0.15);margin-bottom:20px">' +
      '<div style="width:70px;height:70px;border-radius:50%;border:3px solid ' + scoreColor + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(0,0,0,0.3)">' +
        '<span style="font-size:22px;font-weight:700;color:' + scoreColor + ';font-family:JetBrains Mono,monospace">' + (s.health_score || 0) + '</span>' +
      '</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:15px;font-weight:600;color:var(--text-primary)">Backup Health Score</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.5">' + esc(s.summary || '') + '</div>' +
      '</div>' +
    '</div>';

    // Strategy recommendations
    if (s.strategy) {
      html += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px">Recommended Strategy</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px">';
      var stratItems = [
        { label: 'Backup Frequency', value: s.strategy.recommended_frequency || 'N/A', icon: '\u23F0' },
        { label: 'Retention Policy', value: s.strategy.retention_policy || 'N/A', icon: '\u{1F4C5}' },
        { label: 'Est. Backup Size', value: s.strategy.estimated_backup_size || 'N/A', icon: '\u{1F4BE}' },
        { label: 'Backup Window', value: s.strategy.backup_window || 'N/A', icon: '\u{1F319}' }
      ];
      stratItems.forEach(function (item) {
        html += '<div style="padding:14px;border:1px solid var(--border);border-radius:10px;background:rgba(0,0,0,0.1)">' +
          '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px">' + item.label + '</div>' +
          '<div style="font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.4">' + esc(item.value) + '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    // Risks
    if (s.risks && s.risks.length) {
      html += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px">Risk Assessment</div>';
      s.risks.forEach(function (r) {
        var color = r.level === 'critical' ? 'var(--orange)' : r.level === 'warning' ? '#f0c674' : 'var(--text-secondary)';
        html += '<div style="padding:10px 12px;margin-bottom:6px;border-radius:8px;border-left:3px solid ' + color + ';background:rgba(255,255,255,0.02)">' +
          '<div style="font-size:11px;font-weight:600;color:' + color + ';text-transform:uppercase;margin-bottom:2px">' + esc(r.level) + '</div>' +
          '<div style="font-size:12px;color:var(--text-primary)">' + esc(r.issue) + '</div>' +
          '<div style="font-size:11px;color:var(--cyan);margin-top:4px">Mitigation: ' + esc(r.mitigation) + '</div>' +
        '</div>';
      });
    }

    // Storage analysis
    if (s.storage_analysis) {
      html += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin:20px 0 12px">Storage Analysis</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">';
      var storItems = [
        { label: 'Current Usage', value: s.storage_analysis.current_usage || 'N/A' },
        { label: '30-Day Projection', value: s.storage_analysis.projected_30d || 'N/A' }
      ];
      storItems.forEach(function (item) {
        html += '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:rgba(0,0,0,0.1)">' +
          '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px">' + item.label + '</div>' +
          '<div style="font-size:16px;font-weight:700;color:var(--cyan);font-family:JetBrains Mono,monospace">' + esc(item.value) + '</div>' +
        '</div>';
      });
      html += '</div>';

      if (s.storage_analysis.cleanup_candidates && s.storage_analysis.cleanup_candidates.length) {
        html += '<div style="margin-top:12px;padding:10px 12px;border:1px solid rgba(255,107,43,0.2);border-radius:8px;background:rgba(255,107,43,0.05)">' +
          '<div style="font-size:11px;font-weight:600;color:var(--orange);margin-bottom:6px">Cleanup Candidates</div>';
        s.storage_analysis.cleanup_candidates.forEach(function (f) {
          html += '<div style="font-size:11px;font-family:JetBrains Mono,monospace;color:var(--text-secondary);padding:2px 0">' + esc(f) + '</div>';
        });
        html += '</div>';
      }
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ── Disaster Recovery Tab ───────────────────────────────────────────────
  function renderRecovery(container) {
    if (!strategyData || !strategyData.disaster_recovery) {
      container.innerHTML = '<div class="db-empty"><div class="db-empty-text">Run AI Strategy first for DR analysis</div>' +
        '<div class="db-empty-sub">The Disaster Recovery plan is generated as part of the AI Strategy analysis</div>' +
        '<button class="btn btn-sm btn-primary" style="margin-top:16px" onclick="backupAIStrategy()">Analyze Now</button></div>';
      return;
    }

    var dr = strategyData.disaster_recovery;
    var html = '<div style="padding:16px">' +
      '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px">Disaster Recovery Plan</div>';

    // RTO / RPO cards
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">' +
      '<div style="padding:20px;border:1px solid rgba(34,211,238,0.2);border-radius:12px;background:rgba(34,211,238,0.04);text-align:center">' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px">Recovery Time Objective (RTO)</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--cyan);font-family:JetBrains Mono,monospace">' + esc(dr.rto_estimate || 'Unknown') + '</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin-top:6px">Time to restore full service</div>' +
      '</div>' +
      '<div style="padding:20px;border:1px solid rgba(255,107,43,0.2);border-radius:12px;background:rgba(255,107,43,0.04);text-align:center">' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px">Recovery Point Objective (RPO)</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--orange);font-family:JetBrains Mono,monospace">' + esc(dr.rpo_current || 'Unknown') + '</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin-top:6px">Maximum data loss window</div>' +
      '</div>' +
    '</div>';

    // Recovery steps
    if (dr.recommendations && dr.recommendations.length) {
      html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px">Recovery Recommendations</div>';
      dr.recommendations.forEach(function (rec, i) {
        html += '<div style="display:flex;gap:12px;padding:12px;margin-bottom:8px;border:1px solid var(--border);border-radius:8px;background:rgba(0,0,0,0.1)">' +
          '<div style="width:28px;height:28px;border-radius:50%;background:rgba(34,211,238,0.12);color:var(--cyan);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + (i + 1) + '</div>' +
          '<div style="font-size:12px;color:var(--text-primary);line-height:1.5;padding-top:4px">' + esc(rec) + '</div>' +
        '</div>';
      });
    }

    // Quick recovery guide
    html += '<div style="margin-top:20px;padding:16px;border:1px solid var(--border);border-radius:10px;background:rgba(0,0,0,0.15)">' +
      '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Quick Recovery Commands</div>' +
      '<pre style="padding:10px;background:rgba(0,0,0,0.3);border-radius:6px;font-family:JetBrains Mono,monospace;font-size:11px;color:#c3e88d;white-space:pre-wrap;cursor:pointer" onclick="roleCopySQL(this.textContent)" title="Click to copy">' +
        '# 1. List available backups\nls -la data/backups/\n\n# 2. Restore from latest backup\npsql $DATABASE_URL < data/backups/LATEST_BACKUP.sql\n\n# 3. Verify restore\npsql $DATABASE_URL -c "SELECT count(*) FROM pg_tables WHERE schemaname=\'public\'"' +
      '</pre>' +
    '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ── AI Strategy Action ──────────────────────────────────────────────────
  window.backupAIStrategy = function () {
    var btn = document.getElementById('backup-ai-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
    var banner = document.getElementById('backup-strategy-banner');
    if (banner) {
      banner.style.display = '';
      banner.innerHTML = '<div class="db-info-bar" style="border-color:rgba(34,211,238,0.3)"><span style="color:var(--cyan)">AI is analyzing backup strategy... this may take a moment</span></div>';
    }

    fetch('/api/db/backups/ai/strategy?' + dbParam())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        strategyData = d;
        if (btn) { btn.disabled = false; btn.textContent = 'AI Strategy'; }

        if (banner && !d.error) {
          var scoreColor = (d.health_score || 0) >= 70 ? 'var(--cyan)' : (d.health_score || 0) >= 40 ? '#f0c674' : 'var(--orange)';
          banner.innerHTML =
            '<div class="db-info-bar" style="border-color:' + scoreColor + '30">' +
              '<div style="display:flex;align-items:center;gap:16px;width:100%">' +
                '<div style="width:50px;height:50px;border-radius:50%;border:3px solid ' + scoreColor + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(0,0,0,0.3)">' +
                  '<span style="font-size:18px;font-weight:700;color:' + scoreColor + ';font-family:JetBrains Mono,monospace">' + (d.health_score || '?') + '</span>' +
                '</div>' +
                '<div style="flex:1">' +
                  '<div style="font-size:14px;font-weight:600;color:var(--text-primary)">Backup Health: <span style="color:' + scoreColor + '">' + (d.health_score || 0) + '/100</span></div>' +
                  '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">' + esc(d.summary || '') + '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
        } else if (d.error) {
          banner.innerHTML = '<div class="db-info-bar" style="border-color:rgba(255,107,43,0.3)"><span style="color:var(--orange)">' + esc(d.error) + '</span></div>';
        }

        if (activeTab === 'strategy' || activeTab === 'recovery') renderTabContent();
      })
      .catch(function (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'AI Strategy'; }
        Toast.error('Analysis failed: ' + e.message);
      });
  };

  // ── Backup Actions ──────────────────────────────────────────────────────
  window.createBackup = function () {
    var statusEl = document.getElementById('backup-status');
    if (statusEl) {
      statusEl.style.display = '';
      statusEl.innerHTML = '<span style="color:var(--cyan)">Creating backup via pg_dump...</span>';
    }
    Toast.info('Creating backup...');

    fetch('/api/db/backup?' + dbParam(), { method: 'POST' })
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
      message: 'Restore "' + filename + '" to ' + currentPool + ' database?\n\nWARNING: This will overwrite existing data. This action cannot be undone.',
      confirmText: 'Restore',
      dangerous: true
    }).then(function (yes) {
      if (!yes) return;
      Toast.info('Restoring backup...');
      var statusEl = document.getElementById('backup-status');
      if (statusEl) {
        statusEl.style.display = '';
        statusEl.innerHTML = '<span style="color:var(--cyan)">Restoring ' + esc(filename) + '...</span>';
      }

      fetch('/api/db/backup/restore?' + dbParam(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename })
      })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.success) {
          Toast.success('Backup restored successfully');
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
    });
  };

  window.deleteBackupConfirm = function (filename) {
    Modal.confirm({
      title: 'Delete Backup',
      message: 'Permanently delete "' + filename + '"? This cannot be undone.',
      confirmText: 'Delete',
      dangerous: true
    }).then(function (yes) {
      if (!yes) return;
      fetch('/api/db/backups/' + encodeURIComponent(filename), { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.success) { Toast.success('Backup deleted'); loadBackups(); }
          else Toast.error(d.error || 'Delete failed');
        })
        .catch(function (e) { Toast.error('Delete failed: ' + e.message); });
    });
  };

  function timeSince(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return seconds + 's ago';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  function parseAge(str) {
    // Returns approximate hours from "Xd ago" / "Xh ago" etc
    var m = str.match(/(\d+)([dhms])/);
    if (!m) return 0;
    var val = parseInt(m[1]);
    if (m[2] === 'd') return val * 24;
    if (m[2] === 'h') return val;
    if (m[2] === 'm') return val / 60;
    return 0;
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
