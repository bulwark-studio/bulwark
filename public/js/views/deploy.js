/**
 * Deploy Command Center — AI-Powered Deployment Pipeline
 * Environment targets, pipeline visualization, deploy history, build profiles
 */
(function () {
  'use strict';

  var targets = [], history = [], profiles = [];
  var activeTab = 'pipeline';

  Views.deploy = {
    init: function () {
      var el = document.getElementById('view-deploy');
      if (!el) return;
      el.innerHTML = buildTemplate();
    },
    show: function () { this.init(); loadAll(); Views.deploy.runAI(false); },
    hide: function () {},
    update: function () {}
  };

  function buildTemplate() {
    return '<div class="deploy-dashboard">' +
      // AI Analysis
      '<div class="deploy-ai-section">' +
        '<div class="briefing-card glass-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="20" height="20"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/></svg></div>' +
            '<div class="briefing-title">Deploy Intelligence <span id="deploy-ai-freshness"></span></div>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.deploy.runAI(true)" id="deploy-ai-btn">Assess</button>' +
          '</div>' +
          '<div class="briefing-body" id="deploy-ai-body"><span class="text-secondary">Click Assess for AI-powered deployment readiness analysis.</span></div>' +
        '</div>' +
      '</div>' +
      // Tabs
      '<div class="deploy-tabs">' +
        dTab('pipeline', 'Pipeline', true) + dTab('targets', 'Environments') +
        dTab('history', 'History') + dTab('profiles', 'Build Profiles') +
      '</div>' +
      '<div class="deploy-panel" id="deploy-panel-pipeline"></div>' +
      '<div class="deploy-panel" id="deploy-panel-targets" style="display:none"></div>' +
      '<div class="deploy-panel" id="deploy-panel-history" style="display:none"></div>' +
      '<div class="deploy-panel" id="deploy-panel-profiles" style="display:none"></div>' +
    '</div>';
  }

  function dTab(id, label, active) {
    return '<button class="deploy-tab-btn' + (active ? ' active' : '') + '" data-tab="' + id + '" onclick="Views.deploy.switchTab(\'' + id + '\')">' + label + '</button>';
  }

  Views.deploy.switchTab = function (tab) {
    activeTab = tab;
    document.querySelectorAll('.deploy-tab-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
    ['pipeline', 'targets', 'history', 'profiles'].forEach(function (t) {
      var p = document.getElementById('deploy-panel-' + t);
      if (p) p.style.display = t === tab ? '' : 'none';
    });
    if (tab === 'pipeline') loadPipeline();
    if (tab === 'targets') loadTargets();
    if (tab === 'history') loadHistory();
    if (tab === 'profiles') loadProfiles();
  };

  function loadAll() {
    Promise.all([
      fetch('/api/deploy/targets').then(r2j),
      fetch('/api/deploy/history').then(r2j),
    ]).then(function (r) {
      targets = r[0].targets || [];
      history = r[1].deploys || [];
      loadPipeline();
    }).catch(function () {});
  }

  // ── Pipeline View ──
  function loadPipeline() {
    var el = document.getElementById('deploy-panel-pipeline');
    if (!el) return;

    // Pre-flight check
    fetch('/api/deploy/preflight').then(r2j).then(function (pf) {
      var lastDeploy = history.length > 0 ? history[0] : null;
      var html = '';

      // Status banner
      html += '<div class="glass-card deploy-status-banner">' +
        '<div class="deploy-banner-grid">' +
          '<div class="deploy-banner-item"><div class="deploy-banner-label">Last Deploy</div><div class="deploy-banner-value">' + (lastDeploy ? timeAgo(lastDeploy.startedAt) : 'Never') + '</div></div>' +
          '<div class="deploy-banner-item"><div class="deploy-banner-label">Status</div><div class="deploy-banner-value" style="color:' + (lastDeploy && lastDeploy.status === 'success' ? 'var(--cyan)' : 'var(--orange)') + '">' + (lastDeploy ? lastDeploy.status : '--') + '</div></div>' +
          '<div class="deploy-banner-item"><div class="deploy-banner-label">Target</div><div class="deploy-banner-value text-secondary">' + (lastDeploy ? esc(lastDeploy.targetName) : '--') + '</div></div>' +
          '<div class="deploy-banner-item"><div class="deploy-banner-label">Readiness</div><div class="deploy-banner-value" style="color:' + (pf.allPass ? 'var(--cyan)' : 'var(--orange)') + '">' + (pf.allPass ? 'Ready' : 'Issues') + '</div></div>' +
        '</div>' +
      '</div>';

      // Pre-flight checks
      html += '<div class="glass-card"><div class="card-header">Pre-flight Checks</div><div class="deploy-checks">';
      (pf.checks || []).forEach(function (c) {
        html += '<div class="deploy-check">' +
          '<span class="deploy-check-icon" style="color:' + (c.pass ? 'var(--cyan)' : 'var(--orange)') + '">' +
            (c.pass ? '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="2,6 5,9 10,3"/></svg>' :
                      '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l6 6M9 3l-6 6"/></svg>') +
          '</span>' +
          '<span class="deploy-check-name">' + esc(c.name) + '</span>' +
          '<span class="deploy-check-detail text-tertiary">' + esc(c.detail) + '</span>' +
        '</div>';
      });
      html += '</div></div>';

      // Deploy targets as pipeline cards
      if (targets.length > 0) {
        html += '<div class="card-header" style="margin-top:16px;padding:0 0 8px">Deploy Targets</div>';
        html += '<div class="deploy-targets-grid">';
        targets.forEach(function (t) {
          var statusColor = t.lastStatus === 'success' ? 'var(--cyan)' : t.lastStatus === 'failed' ? 'var(--orange)' : 'var(--text-tertiary)';
          html += '<div class="glass-card deploy-target-card">' +
            '<div class="deploy-target-header">' +
              '<div class="deploy-target-name">' + esc(t.name) + '</div>' +
              '<div class="deploy-target-status" style="color:' + statusColor + '">' + (t.lastStatus || 'never deployed') + '</div>' +
            '</div>' +
            '<div class="deploy-target-info">' +
              '<span class="text-tertiary">' + esc(t.method) + '</span>' +
              (t.host ? '<span class="text-tertiary">' + esc(t.host) + '</span>' : '') +
              '<span class="text-tertiary">branch: ' + esc(t.branch) + '</span>' +
            '</div>' +
            '<div class="deploy-target-actions">' +
              '<button class="btn btn-sm btn-cyan" onclick="Views.deploy.execute(\'' + t.id + '\', \'' + esc(t.name).replace(/'/g, '') + '\')">Deploy</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.deploy.editTarget(\'' + t.id + '\')">Edit</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.deploy.deleteTarget(\'' + t.id + '\')">Delete</button>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="glass-card" style="text-align:center;padding:30px;margin-top:12px">' +
          '<div class="text-secondary">No deploy targets configured</div>' +
          '<button class="btn btn-sm btn-cyan" onclick="Views.deploy.switchTab(\'targets\')" style="margin-top:8px">Add Environment</button>' +
        '</div>';
      }

      el.innerHTML = html;
    }).catch(function () {
      el.innerHTML = '<div class="text-secondary" style="padding:20px">Failed to load pipeline</div>';
    });
  }

  // ── Targets Management ──
  function loadTargets() {
    fetch('/api/deploy/targets').then(r2j).then(function (d) {
      targets = d.targets || [];
      var el = document.getElementById('deploy-panel-targets');
      if (!el) return;
      var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<span class="text-primary" style="font-weight:600">Environments</span>' +
        '<button class="btn btn-sm btn-cyan" onclick="Views.deploy.addTarget()">+ Add Target</button>' +
      '</div>';
      if (targets.length === 0) {
        html += '<div class="glass-card" style="text-align:center;padding:30px"><div class="text-secondary">No environments configured yet.</div></div>';
      } else {
        targets.forEach(function (t) {
          html += '<div class="glass-card deploy-target-detail">' +
            '<div class="deploy-target-header"><div class="deploy-target-name">' + esc(t.name) + '</div></div>' +
            '<div class="deploy-detail-grid">' +
              detailRow('Method', t.method) +
              detailRow('Host', t.host || '--') +
              detailRow('Branch', t.branch) +
              detailRow('Build', t.buildCmd || '--') +
              detailRow('Deploy', t.deployCmd || '--') +
              detailRow('Verify', t.verifyUrl || '--') +
              detailRow('Last Deploy', t.lastDeploy ? timeAgo(t.lastDeploy) : 'Never') +
            '</div>' +
            '<div class="deploy-target-actions" style="margin-top:8px">' +
              '<button class="btn btn-sm btn-cyan" onclick="Views.deploy.execute(\'' + t.id + '\', \'' + esc(t.name).replace(/'/g, '') + '\')">Deploy</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.deploy.editTarget(\'' + t.id + '\')">Edit</button>' +
              '<button class="btn btn-sm btn-ghost" style="color:var(--orange)" onclick="Views.deploy.deleteTarget(\'' + t.id + '\')">Delete</button>' +
            '</div>' +
          '</div>';
        });
      }
      el.innerHTML = html;
    }).catch(function () {});
  }

  function detailRow(label, val) {
    return '<div class="deploy-detail-row"><span class="text-secondary">' + label + '</span><span class="text-primary" style="font-size:12px;font-family:\'JetBrains Mono\',monospace">' + esc(String(val || '')) + '</span></div>';
  }

  Views.deploy.addTarget = function () {
    Modal.open({ title: 'Add Deploy Target', body: targetForm(),
      footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button><button class="btn btn-sm btn-primary" onclick="saveTarget()">Save</button>'
    });
  };

  Views.deploy.editTarget = function (id) {
    var t = targets.find(function (x) { return x.id === id; });
    if (!t) return;
    Modal.open({ title: 'Edit: ' + t.name, body: targetForm(t),
      footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button><button class="btn btn-sm btn-primary" onclick="saveTarget(\'' + id + '\')">Update</button>'
    });
  };

  Views.deploy.deleteTarget = function (id) {
    if (!confirm('Delete this deploy target?')) return;
    fetch('/api/deploy/targets/' + id, { method: 'DELETE' }).then(r2j).then(function () {
      Toast.success('Deleted'); loadTargets(); loadAll();
    });
  };

  function targetForm(t) {
    t = t || {};
    return '<div class="cred-form">' +
      fRow('Name', '<input type="text" id="dt-name" class="form-input" value="' + esc(t.name || '') + '" placeholder="My Server" />') +
      fRow('Method', '<select id="dt-method" class="form-input">' +
        opt('ssh_git', 'SSH + Git Pull', t.method) + opt('docker', 'Docker Deploy', t.method) +
        opt('rsync', 'Rsync', t.method) + opt('custom', 'Custom Command', t.method) +
      '</select>') +
      fRow('Host', '<input type="text" id="dt-host" class="form-input" value="' + esc(t.host || '') + '" placeholder="192.168.1.100" />') +
      fRow('Branch', '<input type="text" id="dt-branch" class="form-input" value="' + esc(t.branch || 'main') + '" placeholder="main" />') +
      fRow('Credential (from Vault)', '<select id="dt-cred" class="form-input"><option value="">None</option></select>') +
      fRow('Build Command', '<input type="text" id="dt-build" class="form-input" value="' + esc(t.buildCmd || '') + '" placeholder="npm install && npm run build" />') +
      fRow('Deploy Command', '<input type="text" id="dt-deploy" class="form-input" value="' + esc(t.deployCmd || '') + '" placeholder="cd /opt/app && git pull && pm2 restart all" />') +
      fRow('Health Check URL', '<input type="text" id="dt-verify" class="form-input" value="' + esc(t.verifyUrl || '') + '" placeholder="https://myapp.com/api/health" />') +
    '</div>';
  }

  function fRow(label, input) { return '<div class="cred-form-row"><label>' + label + '</label>' + input + '</div>'; }
  function opt(val, label, sel) { return '<option value="' + val + '"' + (sel === val ? ' selected' : '') + '>' + label + '</option>'; }

  function saveTarget(id) {
    var data = {
      id: id || undefined,
      name: gv('dt-name'), method: gv('dt-method'), host: gv('dt-host'),
      branch: gv('dt-branch') || 'main', credentialId: gv('dt-cred') || null,
      buildCmd: gv('dt-build') || null, deployCmd: gv('dt-deploy') || null,
      verifyUrl: gv('dt-verify') || null,
    };
    if (!data.name) { Toast.warning('Name required'); return; }
    fetch('/api/deploy/targets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(r2j).then(function (d) {
        if (d.success) { Toast.success('Saved'); Modal.close(); loadTargets(); loadAll(); }
        else Toast.error(d.error || 'Failed');
      });
  }

  // ── Execute Deploy ──
  Views.deploy.execute = function (id, name) {
    if (!confirm('Deploy to "' + name + '"? This will execute the pipeline.')) return;
    Toast.info('Deploying to ' + name + '...');
    fetch('/api/deploy/execute/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(r2j).then(function (d) {
        if (d.status === 'success') {
          Toast.success('Deploy successful! (' + (d.duration / 1000).toFixed(1) + 's)');
        } else {
          Toast.error('Deploy failed: ' + (d.error || 'Unknown error'));
        }
        loadAll();
        // Show deploy result in modal
        var stagesHtml = (d.stages || []).map(function (s) {
          var icon = s.status === 'pass' ? '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="var(--cyan)" stroke-width="2"><polyline points="2,6 5,9 10,3"/></svg>' :
                     '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="var(--orange)" stroke-width="2"><path d="M3 3l6 6M9 3l-6 6"/></svg>';
          return '<div class="deploy-stage-result">' + icon + ' <strong>' + esc(s.name) + '</strong>' +
            (s.duration ? ' (' + (s.duration / 1000).toFixed(1) + 's)' : '') +
            '<pre class="deploy-stage-log">' + esc(s.log || '').substring(0, 500) + '</pre></div>';
        }).join('');
        Modal.open({ title: 'Deploy Result: ' + name, body: stagesHtml,
          footer: '<button class="btn btn-sm" onclick="Modal.close()">Close</button>'
        });
      }).catch(function () { Toast.error('Deploy failed'); });
  };

  // ── History ──
  function loadHistory() {
    fetch('/api/deploy/history').then(r2j).then(function (d) {
      history = d.deploys || [];
      var el = document.getElementById('deploy-panel-history');
      if (!el) return;
      if (history.length === 0) {
        el.innerHTML = '<div class="glass-card" style="text-align:center;padding:30px"><div class="text-secondary">No deploy history yet.</div></div>';
        return;
      }
      var html = '<div class="deploy-history-list">';
      history.forEach(function (h) {
        var color = h.status === 'success' ? 'var(--cyan)' : 'var(--orange)';
        html += '<div class="glass-card deploy-history-item">' +
          '<div class="deploy-history-header">' +
            '<span class="deploy-history-dot" style="background:' + color + '"></span>' +
            '<span class="deploy-history-name">' + esc(h.targetName) + '</span>' +
            '<span class="deploy-history-status" style="color:' + color + '">' + esc(h.status) + '</span>' +
            '<span class="deploy-history-time text-tertiary">' + timeAgo(h.startedAt) + '</span>' +
            (h.duration ? '<span class="text-tertiary">' + (h.duration / 1000).toFixed(1) + 's</span>' : '') +
          '</div>' +
          '<div class="deploy-history-stages">' +
            (h.stages || []).map(function (s) {
              return '<span class="deploy-stage-badge deploy-stage-' + s.status + '">' + esc(s.name) + '</span>';
            }).join('') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
      el.innerHTML = html;
    }).catch(function () {});
  }

  // ── Build Profiles ──
  function loadProfiles() {
    fetch('/api/deploy/profiles').then(r2j).then(function (d) {
      profiles = d.profiles || [];
      var el = document.getElementById('deploy-panel-profiles');
      if (!el) return;
      var icons = {
        next: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 3l10 5-10 5z"/></svg>',
        docker: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="7" width="4" height="4"/><rect x="6" y="7" width="4" height="4"/><rect x="11" y="7" width="4" height="4"/><rect x="3.5" y="2" width="4" height="4"/><rect x="8.5" y="2" width="4" height="4"/></svg>',
        static: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M2 6h12"/></svg>',
        node: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M8 2v12M2 8h12"/></svg>',
      };
      var html = '<div class="deploy-profiles-grid">';
      profiles.forEach(function (p) {
        html += '<div class="glass-card deploy-profile-card">' +
          '<div class="deploy-profile-icon">' + (icons[p.icon] || icons.node) + '</div>' +
          '<div class="deploy-profile-name">' + esc(p.name) + '</div>' +
          '<div class="deploy-profile-cmds">' +
            '<div class="deploy-profile-cmd"><span class="text-tertiary">Build:</span> ' + esc(p.buildCmd || '--') + '</div>' +
            '<div class="deploy-profile-cmd"><span class="text-tertiary">Deploy:</span> ' + esc(p.deployCmd || '--') + '</div>' +
          '</div>' +
          '<button class="btn btn-sm btn-ghost" onclick="Views.deploy.useProfile(\'' + esc(p.buildCmd || '').replace(/'/g, "\\'") + '\', \'' + esc(p.deployCmd || '').replace(/'/g, "\\'") + '\')">Use as Template</button>' +
        '</div>';
      });
      html += '</div>';
      el.innerHTML = html;
    }).catch(function () {});
  }

  Views.deploy.useProfile = function (buildCmd, deployCmd) {
    Toast.info('Profile loaded — open Add Target to use');
    Views.deploy.switchTab('targets');
    setTimeout(function () { Views.deploy.addTarget(); }, 200);
    setTimeout(function () {
      var b = document.getElementById('dt-build');
      var d = document.getElementById('dt-deploy');
      if (b) b.value = buildCmd;
      if (d) d.value = deployCmd;
    }, 500);
  };

  // ── AI Analysis ──
  Views.deploy.runAI = function (force) {
    var btn = document.getElementById('deploy-ai-btn');
    var body = document.getElementById('deploy-ai-body');
    if (!force && window.AICache) {
      var restored = window.AICache.restore('deploy');
      if (restored) {
        if (body) body.textContent = restored.response;
        var fb = document.getElementById('deploy-ai-freshness');
        if (fb) fb.innerHTML = window.AICache.freshnessBadge('deploy');
        return;
      }
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Assessing...'; }
    if (body) body.innerHTML = '<span class="text-secondary">Analyzing deploy readiness...</span>';
    fetch('/api/deploy/ai-review', { method: 'POST' }).then(r2j).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'Assess'; }
      if (body && d.review) {
        typewriter(body, d.review);
        if (window.AICache) {
          window.AICache.set('deploy', {}, d.review);
          var fb = document.getElementById('deploy-ai-freshness');
          if (fb) fb.innerHTML = window.AICache.freshnessBadge('deploy');
        }
      }
    }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Assess'; } });
  };

  // ── Helpers ──
  function r2j(r) { return r.json(); }
  function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s || '')) : String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function gv(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function timeAgo(d) {
    if (!d) return '';
    var s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
    return Math.floor(s / 2592000) + 'mo ago';
  }
  function typewriter(el, text) {
    el.innerHTML = ''; var span = document.createElement('span'); el.appendChild(span);
    var i = 0; (function tick() { if (i < text.length) { span.textContent += text[i++]; setTimeout(tick, 8 + Math.random() * 12); } })();
  }
})();
