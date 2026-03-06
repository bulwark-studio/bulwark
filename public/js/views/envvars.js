/**
 * Chester Dev Monitor — Environment Variables Intelligence
 * AI security analysis, categorization, secret detection, .env export, comparison
 */
(function () {
  'use strict';

  var currentApp = null;
  var apps = [];
  var activeTab = 'vars';

  Views.envvars = {
    init: function () {
      var c = document.getElementById('view-envvars');
      if (!c) return;
      c.innerHTML =
        '<div class="env-dashboard">' +
          // AI Analysis
          '<div class="env-ai-card" id="env-ai-card">' +
            '<div class="env-ai-header"><div class="ai-dot"></div><span>Chester Env Security</span></div>' +
            '<div class="env-ai-body" id="env-ai-body">Select an app and click analyze for AI security insights...</div>' +
            '<button class="env-ai-btn" onclick="envAiAnalysis()">Analyze Security</button>' +
          '</div>' +
          // Tabs
          '<div class="env-tabs">' +
            '<button class="env-tab-btn active" data-tab="vars" onclick="envTab(\'vars\')">Variables</button>' +
            '<button class="env-tab-btn" data-tab="categorized" onclick="envTab(\'categorized\')">Categorized</button>' +
            '<button class="env-tab-btn" data-tab="compare" onclick="envTab(\'compare\')">Compare</button>' +
            '<button class="env-tab-btn" data-tab="scan" onclick="envTab(\'scan\')">Scan Codebase</button>' +
            '<button class="env-tab-btn" data-tab="history" onclick="envTab(\'history\')">History</button>' +
          '</div>' +
          // App selector banner
          '<div class="env-banner" id="env-banner"></div>' +
          // Content
          '<div id="env-tab-content"></div>' +
        '</div>';
    },
    show: function () { loadApps(); },
    hide: function () {},
    update: function () {}
  };

  function loadApps() {
    fetch('/api/envvars').then(function (r) { return r.json(); }).then(function (d) {
      apps = d.apps || [];
      if (apps.length && !currentApp) currentApp = apps[0].name;
      renderBanner();
      renderTab();
    }).catch(function () { apps = []; renderBanner(); renderTab(); });
  }

  function renderBanner() {
    var el = document.getElementById('env-banner');
    if (!el) return;
    var totalVars = apps.reduce(function (s, a) { return s + a.count; }, 0);
    el.innerHTML =
      '<div class="env-banner-grid">' +
        '<div class="env-banner-item"><label>Apps</label><span>' + apps.length + '</span></div>' +
        '<div class="env-banner-item"><label>Total Variables</label><span>' + totalVars + '</span></div>' +
        '<div class="env-banner-item"><label>Active App</label><span style="color:var(--cyan)">' + esc(currentApp || 'None') + '</span></div>' +
      '</div>' +
      '<div class="env-banner-apps">' +
        apps.map(function (a) {
          return '<button class="env-app-btn' + (a.name === currentApp ? ' active' : '') + '" onclick="selectEnvApp(\'' + esc(a.name) + '\')">' +
            esc(a.name) + ' <span class="env-app-count">' + a.count + '</span></button>';
        }).join('') +
      '</div>' +
      '<div class="env-banner-actions">' +
        '<button onclick="addEnvVarEnhanced()">+ Add Variable</button>' +
        '<button onclick="bulkImportEnhanced()">Import .env</button>' +
        '<button onclick="exportEnv()">Export</button>' +
      '</div>';
  }

  window.selectEnvApp = function (name) {
    currentApp = name;
    renderBanner();
    renderTab();
  };

  window.envTab = function (tab) {
    activeTab = tab;
    document.querySelectorAll('.env-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderTab();
  };

  function renderTab() {
    var el = document.getElementById('env-tab-content');
    if (!el) return;
    if (activeTab === 'vars') renderVars(el);
    else if (activeTab === 'categorized') renderCategorized(el);
    else if (activeTab === 'compare') renderCompare(el);
    else if (activeTab === 'scan') renderScan(el);
    else if (activeTab === 'history') renderHistory(el);
  }

  // ── Variables Tab ──

  function renderVars(el) {
    if (!currentApp) { el.innerHTML = '<div class="env-section"><div class="env-empty">Select an app to view variables</div></div>'; return; }
    el.innerHTML = '<div class="env-section"><div style="color:var(--text-tertiary)">Loading...</div></div>';
    fetch('/api/envvars/' + encodeURIComponent(currentApp))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var vars = d.vars || [];
        if (!vars.length) { el.innerHTML = '<div class="env-section"><div class="env-empty">No variables for ' + esc(currentApp) + '</div></div>'; return; }
        el.innerHTML = '<div class="env-section"><div class="env-var-list">' +
          vars.map(function (v) {
            var cat = categorizeKey(v.key);
            return '<div class="env-var-row">' +
              '<div class="env-var-cat-dot" style="background:' + catColor(cat) + '" title="' + cat + '"></div>' +
              '<div class="env-var-key">' + esc(v.key) + '</div>' +
              '<div class="env-var-value">' +
                '<span class="env-val-masked" id="env-val-' + esc(v.key) + '" onclick="revealEnvVal(\'' + esc(currentApp) + '\',\'' + esc(v.key) + '\')">' + esc(v.value) + '</span>' +
              '</div>' +
              '<div class="env-var-meta">' + (v.updated ? timeAgo(v.updated) : '') + '</div>' +
              '<div class="env-var-actions">' +
                '<button class="env-var-action" onclick="editEnvVar(\'' + esc(v.key) + '\')">Edit</button>' +
                '<button class="env-var-action danger" onclick="deleteEnvVarEnhanced(\'' + esc(v.key) + '\')">Del</button>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div></div>';
      });
  }

  // ── Categorized Tab ──

  function renderCategorized(el) {
    if (!currentApp) { el.innerHTML = '<div class="env-section"><div class="env-empty">Select an app</div></div>'; return; }
    el.innerHTML = '<div class="env-section"><div style="color:var(--text-tertiary)">Loading...</div></div>';
    fetch('/api/envvars/' + encodeURIComponent(currentApp) + '/categorized')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var cats = d.categories || {};
        var risks = d.risks || [];
        var html = '';

        // Risk alerts
        if (risks.length) {
          html += '<div class="env-risk-card"><div class="env-risk-header"><span style="color:var(--orange)">Security Risks Detected (' + risks.length + ')</span></div>' +
            risks.map(function (r) {
              return '<div class="env-risk-item"><span class="env-risk-key">' + esc(r.key) + '</span><span class="env-risk-type">' + esc(r.risk) + '</span></div>';
            }).join('') +
          '</div>';
        }

        // Category groups
        var catOrder = ['api_key', 'database', 'cloud', 'security', 'payment', 'email', 'connection', 'config', 'feature_flag', 'general'];
        var catLabels = { api_key: 'API Keys', database: 'Database', cloud: 'Cloud', security: 'Security', payment: 'Payment', email: 'Email', connection: 'Connection', config: 'Config', feature_flag: 'Feature Flags', general: 'General' };

        catOrder.forEach(function (cat) {
          if (!cats[cat] || !cats[cat].length) return;
          html += '<div class="env-cat-group">' +
            '<div class="env-cat-header"><span class="env-cat-dot" style="background:' + catColor(cat) + '"></span><span>' + (catLabels[cat] || cat) + ' (' + cats[cat].length + ')</span></div>' +
            '<div class="env-cat-items">' +
              cats[cat].map(function (v) {
                return '<div class="env-cat-item"><span class="env-cat-key">' + esc(v.key) + '</span><span class="env-cat-updated">' + timeAgo(v.updated) + '</span></div>';
              }).join('') +
            '</div>' +
          '</div>';
        });

        el.innerHTML = '<div class="env-section">' + (html || '<div class="env-empty">No variables</div>') + '</div>';
      });
  }

  // ── Compare Tab ──

  function renderCompare(el) {
    if (apps.length < 2) { el.innerHTML = '<div class="env-section"><div class="env-empty">Need at least 2 apps to compare</div></div>'; return; }
    el.innerHTML =
      '<div class="env-section">' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:16px">' +
          '<select id="env-cmp-1" class="form-input" style="width:180px">' + apps.map(function (a) { return '<option value="' + esc(a.name) + '">' + esc(a.name) + '</option>'; }).join('') + '</select>' +
          '<span style="color:var(--text-tertiary)">vs</span>' +
          '<select id="env-cmp-2" class="form-input" style="width:180px">' + apps.map(function (a, i) { return '<option value="' + esc(a.name) + '"' + (i === 1 ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select>' +
          '<button class="btn btn-sm btn-cyan" onclick="runEnvCompare()">Compare</button>' +
        '</div>' +
        '<div id="env-compare-results"></div>' +
      '</div>';
  }

  window.runEnvCompare = function () {
    var a1 = (document.getElementById('env-cmp-1') || {}).value;
    var a2 = (document.getElementById('env-cmp-2') || {}).value;
    var results = document.getElementById('env-compare-results');
    if (!a1 || !a2 || !results) return;
    results.innerHTML = '<div style="color:var(--text-tertiary)">Comparing...</div>';
    fetch('/api/envvars/compare/' + encodeURIComponent(a1) + '/' + encodeURIComponent(a2))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var diff = d.diff || [];
        results.innerHTML =
          '<div class="env-compare-stats">' +
            '<span class="env-cmp-stat same">' + d.same + ' Same</span>' +
            '<span class="env-cmp-stat diff">' + d.different + ' Different</span>' +
            '<span class="env-cmp-stat only1">Only ' + esc(d.app1) + ': ' + d.onlyFirst + '</span>' +
            '<span class="env-cmp-stat only2">Only ' + esc(d.app2) + ': ' + d.onlySecond + '</span>' +
          '</div>' +
          '<div class="env-compare-list">' +
            diff.map(function (d) {
              var cls = d.status === 'same' ? '' : d.status === 'different' ? ' diff' : d.status === 'only_first' ? ' only1' : ' only2';
              return '<div class="env-compare-row' + cls + '">' +
                '<span class="env-compare-key">' + esc(d.key) + '</span>' +
                '<span class="env-compare-status">' + d.status.replace('_', ' ') + '</span>' +
                '<span class="env-compare-cat">' + esc(d.category) + '</span>' +
              '</div>';
            }).join('') +
          '</div>';
      });
  };

  // ── Scan Codebase Tab ──

  function renderScan(el) {
    el.innerHTML = '<div class="env-section"><h3>Codebase Env Var Scanner</h3><p style="color:var(--text-tertiary);font-size:12px;margin-bottom:12px">Scans source code for process.env.* references and checks which are defined.</p><button class="btn btn-sm btn-cyan" onclick="runEnvScan()">Scan Codebase</button><div id="env-scan-results" style="margin-top:16px"></div></div>';
  }

  window.runEnvScan = function () {
    var results = document.getElementById('env-scan-results');
    if (!results) return;
    results.innerHTML = '<div style="color:var(--text-tertiary)">Scanning...</div>';
    fetch('/api/envvars/scan-codebase')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var missing = d.missing || [];
        var defined = d.defined || [];
        results.innerHTML =
          '<div class="env-scan-stats">' +
            '<div class="env-stat-card"><div class="env-stat-val">' + (d.total || 0) + '</div><div class="env-stat-label">Referenced</div></div>' +
            '<div class="env-stat-card"><div class="env-stat-val" style="color:var(--cyan)">' + defined.length + '</div><div class="env-stat-label">Defined</div></div>' +
            '<div class="env-stat-card"><div class="env-stat-val" style="color:var(--orange)">' + missing.length + '</div><div class="env-stat-label">Missing</div></div>' +
          '</div>' +
          (missing.length ? '<div class="env-scan-group"><div class="env-scan-header" style="color:var(--orange)">Missing Variables</div>' +
            missing.map(function (k) { return '<div class="env-scan-item missing">' + esc(k) + '</div>'; }).join('') +
          '</div>' : '') +
          '<div class="env-scan-group"><div class="env-scan-header" style="color:var(--cyan)">Defined Variables</div>' +
            defined.map(function (k) { return '<div class="env-scan-item defined">' + esc(k) + '</div>'; }).join('') +
          '</div>';
      });
  };

  // ── History Tab ──

  function renderHistory(el) {
    if (!currentApp) { el.innerHTML = '<div class="env-section"><div class="env-empty">Select an app</div></div>'; return; }
    el.innerHTML = '<div class="env-section"><div style="color:var(--text-tertiary)">Loading...</div></div>';
    fetch('/api/envvars/' + encodeURIComponent(currentApp) + '/history')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = d.history || [];
        el.innerHTML = '<div class="env-section"><h3>Change History: ' + esc(currentApp) + '</h3>' +
          (items.length ? '<div class="env-history-list">' +
            items.reverse().map(function (h) {
              var actionColor = h.action === 'delete' ? 'var(--orange)' : h.action === 'bulk_import' ? '#a78bfa' : 'var(--cyan)';
              return '<div class="env-history-item">' +
                '<span class="env-history-action" style="color:' + actionColor + '">' + esc(h.action) + '</span>' +
                '<span class="env-history-key">' + esc(h.key || (h.count ? h.count + ' vars' : '')) + '</span>' +
                '<span class="env-history-meta">by ' + esc(h.by || 'system') + ' &middot; ' + timeAgo(h.ts) + '</span>' +
              '</div>';
            }).join('') +
          '</div>' : '<div class="env-empty">No history</div>') +
        '</div>';
      });
  }

  // ── Actions ──

  window.revealEnvVal = function (app, key) {
    var el = document.getElementById('env-val-' + key);
    if (!el) return;
    if (el.dataset.revealed === 'true') { el.textContent = '••••••••'; el.dataset.revealed = 'false'; return; }
    fetch('/api/envvars/' + encodeURIComponent(app) + '?reveal=true')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var v = (d.vars || []).find(function (x) { return x.key === key; });
        if (v) { el.textContent = v.value; el.dataset.revealed = 'true'; }
      });
  };

  window.addEnvVarEnhanced = function () {
    var appName = currentApp || 'default';
    Modal.open({
      title: 'Add Variable', size: 'sm',
      body: '<div class="form-group"><label class="form-label">App</label><input id="env-add-app" class="form-input" value="' + esc(appName) + '"></div>' +
        '<div class="form-group"><label class="form-label">Key</label><input id="env-add-key" class="form-input" placeholder="MY_VAR" style="font-family:monospace"></div>' +
        '<div class="form-group"><label class="form-label">Value</label><input id="env-add-value" class="form-input" type="password" placeholder="secret_value"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="env-add-save">Save</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('env-add-save');
      if (btn) btn.onclick = function () {
        var app = (document.getElementById('env-add-app') || {}).value || appName;
        var key = (document.getElementById('env-add-key') || {}).value;
        var value = (document.getElementById('env-add-value') || {}).value;
        if (!key) { Toast.warning('Key required'); return; }
        fetch('/api/envvars/' + encodeURIComponent(app), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key, value: value }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Saved'); Modal.close(btn.closest('.modal-overlay')); currentApp = app; loadApps();
          }).catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.editEnvVar = function (key) {
    // Reveal value first, then show edit modal
    fetch('/api/envvars/' + encodeURIComponent(currentApp) + '?reveal=true')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var v = (d.vars || []).find(function (x) { return x.key === key; });
        Modal.open({
          title: 'Edit: ' + key, size: 'sm',
          body: '<div class="form-group"><label class="form-label">Value</label><input id="env-edit-value" class="form-input" value="' + esc(v ? v.value : '') + '" style="font-family:monospace"></div>',
          footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="env-edit-save">Save</button>'
        });
        setTimeout(function () {
          var btn = document.getElementById('env-edit-save');
          if (btn) btn.onclick = function () {
            var value = (document.getElementById('env-edit-value') || {}).value;
            fetch('/api/envvars/' + encodeURIComponent(currentApp), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key, value: value }) })
              .then(function (r) { return r.json(); })
              .then(function () { Toast.success('Updated'); Modal.close(btn.closest('.modal-overlay')); renderTab(); })
              .catch(function () { Toast.error('Failed'); });
          };
        }, 50);
      });
  };

  window.deleteEnvVarEnhanced = function (key) {
    if (!currentApp) return;
    Modal.confirm({ title: 'Delete Variable', message: 'Delete "' + key + '"?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/envvars/' + encodeURIComponent(currentApp) + '/' + encodeURIComponent(key), { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadApps(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  window.bulkImportEnhanced = function () {
    var appName = currentApp || 'default';
    Modal.open({
      title: 'Import .env', size: 'lg',
      body: '<div class="form-group"><label class="form-label">App</label><input id="bulk-app" class="form-input" value="' + esc(appName) + '"></div>' +
        '<div class="form-group"><label class="form-label">Paste .env content</label><textarea id="bulk-content" class="form-input" rows="12" placeholder="# Database\nDATABASE_URL=postgres://...\n\n# API Keys\nAPI_KEY=sk-..." style="font-family:monospace;font-size:12px"></textarea></div>',
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

  window.exportEnv = function () {
    if (!currentApp) { Toast.warning('Select an app first'); return; }
    fetch('/api/envvars/' + encodeURIComponent(currentApp) + '/export')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        Modal.open({
          title: 'Export: ' + currentApp + ' (' + d.count + ' vars)', size: 'lg',
          body: '<textarea style="width:100%;height:40vh;background:var(--well);color:var(--text-secondary);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:monospace;font-size:12px;box-sizing:border-box" readonly>' + esc(d.content || '') + '</textarea>' +
            '<button class="btn btn-sm btn-cyan" style="margin-top:8px" onclick="navigator.clipboard.writeText(this.previousElementSibling.value);Toast.success(\'Copied!\')">Copy to Clipboard</button>'
        });
      });
  };

  window.envAiAnalysis = function () {
    if (!currentApp) { Toast.warning('Select an app first'); return; }
    var body = document.getElementById('env-ai-body');
    if (!body) return;
    body.innerHTML = 'Analyzing environment security...<span class="cursor-blink"></span>';
    fetch('/api/envvars/' + encodeURIComponent(currentApp) + '/ai-analysis')
      .then(function (r) { return r.json(); })
      .then(function (d) { typewriter(body, d.analysis || 'No analysis available.'); })
      .catch(function () { body.textContent = 'Analysis unavailable.'; });
  };

  // ── Helpers ──

  function categorizeKey(key) {
    var k = key.toUpperCase();
    if (/DATABASE|DB_|PG_|POSTGRES|MYSQL|REDIS|MONGO/.test(k)) return 'database';
    if (/API_KEY|SECRET_KEY|TOKEN|AUTH|BEARER|OAUTH/.test(k)) return 'api_key';
    if (/AWS|GCP|AZURE|S3_|CLOUD/.test(k)) return 'cloud';
    if (/SMTP|EMAIL|MAIL/.test(k)) return 'email';
    if (/STRIPE|PAYMENT/.test(k)) return 'payment';
    if (/PORT|HOST|URL|DOMAIN/.test(k)) return 'connection';
    if (/NODE_ENV|DEBUG|LOG/.test(k)) return 'config';
    if (/FEATURE_|FLAG_|ENABLE_/.test(k)) return 'feature_flag';
    if (/ENCRYPT|SALT|HASH/.test(k)) return 'security';
    return 'general';
  }

  function catColor(cat) {
    var colors = { api_key: '#f59e0b', database: '#22d3ee', cloud: '#818cf8', security: '#ef4444', payment: '#10b981', email: '#a78bfa', connection: '#06b6d4', config: '#6b7280', feature_flag: '#f97316', general: '#52525a' };
    return colors[cat] || '#52525a';
  }

  function typewriter(el, text) {
    el.textContent = '';
    var i = 0;
    var iv = setInterval(function () { el.textContent += text[i]; i++; if (i >= text.length) clearInterval(iv); }, 15);
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '--';
    var diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return Math.round(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
    return Math.round(diff / 86400000) + 'd ago';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
