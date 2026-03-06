/**
 * Git Intelligence Center — AI-Powered Repository Management
 * Commit timeline, branch manager, AI commit assistant, heatmap, contributors
 */
(function () {
  'use strict';

  var commits = [], branches = [], stashes = [], contributors = [];
  var repoStats = {}, heatmapData = {};
  var activeTab = 'timeline';

  Views.git = {
    init: function () {
      var el = document.getElementById('view-git');
      if (!el) return;
      el.innerHTML = buildTemplate();
    },
    show: function () { this.init(); loadProjects(); loadAll(); Views.git.runAI(false); },
    hide: function () {},
    update: function () {}
  };

  // ── Project Management ──
  var gitProjects = [];

  function loadProjects() {
    fetch('/api/git/projects').then(r2j).then(function (d) {
      gitProjects = d.projects || [];
      var sel = document.getElementById('git-project-select');
      var info = document.getElementById('git-project-info');
      if (!sel) return;
      var html = '';
      if (!gitProjects.length) {
        html = '<option value="">Default (REPO_DIR)</option>';
        if (info) info.textContent = '';
      } else {
        gitProjects.forEach(function (p) {
          html += '<option value="' + p.id + '"' + (p.active ? ' selected' : '') + '>' +
            (p.active ? '● ' : '') + esc(p.name) + '</option>';
        });
        var active = gitProjects.find(function (p) { return p.active; });
        if (info && active) {
          info.textContent = (active.localPath ? active.localPath : active.remoteUrl || '') +
            (active.credentialId ? ' (auth)' : '');
        }
      }
      sel.innerHTML = html;
    }).catch(function () {});
  }

  Views.git.switchProject = function (id) {
    if (!id) return;
    fetch('/api/git/projects/' + id + '/activate', { method: 'POST' })
      .then(r2j).then(function (d) {
        if (d.success) { Toast.success('Switched to ' + (d.name || 'repo')); Views.git.show(); }
        else Toast.error(d.error || 'Switch failed');
      }).catch(function () { Toast.error('Switch failed'); });
  };

  Views.git.openAddProject = function () {
    // Load credentials for dropdown
    fetch('/api/credentials').then(r2j).then(function (creds) {
      var credOptions = '<option value="">None (public repo)</option>';
      (creds.credentials || []).forEach(function (c) {
        credOptions += '<option value="' + c.id + '">' + esc(c.name) + ' (' + esc(c.type) + ')</option>';
      });
      showAddModal(credOptions);
    }).catch(function () { showAddModal('<option value="">None (public repo)</option>'); });
  };

  function showAddModal(credOptions) {
    Modal.open({
      title: 'Add Git Repository',
      body:
        '<div class="form-group"><label class="form-label">Name</label>' +
        '<input type="text" id="git-proj-name" class="form-input" placeholder="e.g. My App"></div>' +
        '<div class="form-group"><label class="form-label">Local Path <span class="text-tertiary">(if repo already cloned)</span></label>' +
        '<input type="text" id="git-proj-path" class="form-input" placeholder="e.g. /home/user/my-app or C:\\projects\\my-app"></div>' +
        '<div class="form-group"><label class="form-label">Remote URL <span class="text-tertiary">(will clone if no local path)</span></label>' +
        '<input type="text" id="git-proj-remote" class="form-input" placeholder="e.g. https://github.com/user/repo.git or git@github.com:user/repo.git"></div>' +
        '<div class="form-group"><label class="form-label">Authentication <span class="text-tertiary">(for private repos)</span></label>' +
        '<select id="git-proj-cred" class="form-input">' + credOptions + '</select>' +
        '<div style="margin-top:6px;font-size:11px;color:var(--text-tertiary)">' +
          'For private repos: add an SSH Key or API Token in Terminal > Vault first, then select it here.<br>' +
          '<strong>GitHub HTTPS:</strong> Use a Personal Access Token (Settings > Developer settings > Tokens).<br>' +
          '<strong>GitHub SSH:</strong> Use an SSH key added to your GitHub account.' +
        '</div></div>' +
        '<div class="form-group"><label class="form-label">Description</label>' +
        '<input type="text" id="git-proj-desc" class="form-input" placeholder="Optional description"></div>' +
        '<div id="git-proj-test-result"></div>',
      footer:
        '<button class="btn btn-sm btn-ghost" onclick="Views.git.testProjectConnection()" id="git-proj-test-btn">Test Connection</button>' +
        '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" id="git-proj-save-btn">Save & Connect</button>',
      size: 'lg'
    });
    setTimeout(function () {
      var btn = document.getElementById('git-proj-save-btn');
      if (btn) btn.onclick = function () { saveProject(btn); };
    }, 50);
  }

  Views.git.testProjectConnection = function () {
    var btn = document.getElementById('git-proj-test-btn');
    var out = document.getElementById('git-proj-test-result');
    var localPath = (document.getElementById('git-proj-path') || {}).value || '';
    var remoteUrl = (document.getElementById('git-proj-remote') || {}).value || '';
    var credentialId = (document.getElementById('git-proj-cred') || {}).value || '';
    if (!localPath && !remoteUrl) { Toast.warning('Enter a local path or remote URL'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Testing...'; }
    if (out) out.innerHTML = '<span class="text-secondary">Testing connection...</span>';
    fetch('/api/git/projects/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localPath: localPath, remoteUrl: remoteUrl, credentialId: credentialId || null })
    }).then(r2j).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; }
      if (out) {
        if (d.success) {
          out.innerHTML = '<div style="padding:8px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);border-radius:6px;color:var(--cyan);font-size:13px">' +
            '&#10003; ' + esc(d.message) + (d.branch ? ' (branch: ' + esc(d.branch) + ')' : '') + (d.refs ? ' — ' + esc(d.refs) : '') + '</div>';
        } else {
          out.innerHTML = '<div style="padding:8px;background:rgba(255,107,43,0.08);border:1px solid rgba(255,107,43,0.2);border-radius:6px;color:var(--orange);font-size:13px">' +
            '&#10007; ' + esc(d.error || 'Connection failed') + '</div>';
        }
      }
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; }
      if (out) out.innerHTML = '<span style="color:var(--orange)">Test failed</span>';
    });
  };

  function saveProject(btn) {
    var name = (document.getElementById('git-proj-name') || {}).value || '';
    var localPath = (document.getElementById('git-proj-path') || {}).value || '';
    var remoteUrl = (document.getElementById('git-proj-remote') || {}).value || '';
    var credentialId = (document.getElementById('git-proj-cred') || {}).value || '';
    var description = (document.getElementById('git-proj-desc') || {}).value || '';
    if (!name.trim()) { Toast.error('Name required'); return; }
    if (!localPath.trim() && !remoteUrl.trim()) { Toast.error('Enter a local path or remote URL'); return; }
    btn.disabled = true; btn.textContent = 'Saving...';
    fetch('/api/git/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, localPath: localPath, remoteUrl: remoteUrl, credentialId: credentialId || null, description: description })
    }).then(r2j).then(function (d) {
      if (d.error) { Toast.error(d.error); btn.disabled = false; btn.textContent = 'Save & Connect'; return; }
      Toast.success('Repository added');
      Modal.close(btn.closest('.modal-overlay'));
      Views.git.show();
    }).catch(function () {
      Toast.error('Failed to add repository');
      btn.disabled = false; btn.textContent = 'Save & Connect';
    });
  }

  Views.git.manageProjects = function () {
    var html = '<div style="max-height:400px;overflow-y:auto">';
    if (!gitProjects.length) {
      html += '<div class="text-secondary" style="padding:16px;text-align:center">No repositories configured. Using default REPO_DIR.</div>';
    } else {
      gitProjects.forEach(function (p) {
        html += '<div style="padding:12px;margin-bottom:8px;background:var(--well);border-radius:6px;border-left:3px solid ' + (p.active ? 'var(--cyan)' : 'var(--border)') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div>' +
              '<strong style="color:var(--text-primary)">' + (p.active ? '● ' : '') + esc(p.name) + '</strong>' +
              (p.credentialId ? ' <span class="badge" style="font-size:9px;color:var(--cyan)">auth</span>' : '') +
              '<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">' + esc(p.localPath || p.remoteUrl || '') + '</div>' +
              (p.description ? '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' + esc(p.description) + '</div>' : '') +
            '</div>' +
            '<div style="display:flex;gap:6px">' +
              (!p.active ? '<button class="btn btn-sm btn-ghost" style="color:var(--cyan)" onclick="Views.git.switchProject(\'' + p.id + '\');Modal.close()">Activate</button>' : '') +
              '<button class="btn btn-sm btn-ghost" onclick="Views.git.editProject(\'' + p.id + '\')">Edit</button>' +
              '<button class="btn btn-sm btn-danger" onclick="Views.git.deleteProject(\'' + p.id + '\',\'' + esc(p.name).replace(/'/g, "\\'") + '\')">Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
    }
    html += '</div>';
    Modal.open({
      title: 'Manage Git Repositories',
      body: html,
      footer: '<button class="btn btn-sm btn-primary" onclick="Modal.close(this.closest(\'.modal-overlay\'));Views.git.openAddProject()">+ Add Repo</button>' +
        '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>',
      size: 'lg'
    });
  };

  Views.git.editProject = function (id) {
    var p = gitProjects.find(function (x) { return x.id === id; });
    if (!p) return;
    Modal.close();
    setTimeout(function () {
      Modal.open({
        title: 'Edit Repository — ' + esc(p.name),
        body:
          '<div class="form-group"><label class="form-label">Name</label>' +
          '<input type="text" id="git-edit-name" class="form-input" value="' + esc(p.name) + '"></div>' +
          '<div class="form-group"><label class="form-label">Local Path</label>' +
          '<input type="text" id="git-edit-path" class="form-input" value="' + esc(p.localPath || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Remote URL</label>' +
          '<input type="text" id="git-edit-remote" class="form-input" value="' + esc(p.remoteUrl || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Description</label>' +
          '<input type="text" id="git-edit-desc" class="form-input" value="' + esc(p.description || '') + '"></div>',
        footer:
          '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
          '<button class="btn btn-sm btn-primary" id="git-edit-save-btn">Save</button>',
        size: 'md'
      });
      setTimeout(function () {
        var btn = document.getElementById('git-edit-save-btn');
        if (btn) btn.onclick = function () {
          var data = {
            name: (document.getElementById('git-edit-name') || {}).value,
            localPath: (document.getElementById('git-edit-path') || {}).value,
            remoteUrl: (document.getElementById('git-edit-remote') || {}).value,
            description: (document.getElementById('git-edit-desc') || {}).value
          };
          fetch('/api/git/projects/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            .then(r2j).then(function (d) {
              if (d.success) { Toast.success('Updated'); Modal.close(btn.closest('.modal-overlay')); Views.git.show(); }
              else Toast.error(d.error || 'Update failed');
            }).catch(function () { Toast.error('Update failed'); });
        };
      }, 50);
    }, 200);
  };

  Views.git.deleteProject = function (id, name) {
    Modal.close();
    setTimeout(function () {
      Modal.confirm({ title: 'Remove Repository', message: 'Remove "' + name + '" from Git projects? This does not delete the repo files.', confirmText: 'Remove', dangerous: true })
        .then(function (ok) {
          if (!ok) return;
          fetch('/api/git/projects/' + id, { method: 'DELETE' })
            .then(r2j).then(function (d) {
              if (d.success) { Toast.success('Removed ' + (d.removed || '')); Views.git.show(); }
              else Toast.error(d.error || 'Remove failed');
            }).catch(function () { Toast.error('Remove failed'); });
        });
    }, 200);
  };

  function buildTemplate() {
    return '<div class="git-dashboard">' +
      // Project Picker
      '<div id="git-project-bar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<select id="git-project-select" class="form-input" style="width:auto;min-width:180px;font-size:13px" onchange="Views.git.switchProject(this.value)"></select>' +
          '<span id="git-project-info" class="text-secondary" style="font-size:12px"></span>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-sm btn-primary" onclick="Views.git.openAddProject()">+ Add Repo</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="Views.git.manageProjects()">Manage</button>' +
        '</div>' +
      '</div>' +
      // AI Analysis
      '<div class="git-ai-section">' +
        '<div class="briefing-card glass-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="20" height="20"><circle cx="7" cy="5" r="2.5"/><circle cx="17" cy="12" r="2.5"/><circle cx="7" cy="19" r="2.5"/><path d="M7 7.5v9M9.5 5h5a2.5 2.5 0 010 5h-5"/></svg></div>' +
            '<div class="briefing-title">Git Intelligence <span id="git-ai-freshness"></span></div>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.git.runAI(true)" id="git-ai-btn">Analyze</button>' +
          '</div>' +
          '<div class="briefing-body" id="git-ai-body"><span class="text-secondary">Click Analyze for AI-powered repository insights.</span></div>' +
        '</div>' +
      '</div>' +
      // Status Banner
      '<div class="glass-card git-status-banner" id="git-status-banner"><div class="text-secondary" style="padding:12px">Loading...</div></div>' +
      // Tabs
      '<div class="git-tabs">' +
        gTab('timeline', 'Commits', true) + gTab('branches', 'Branches') + gTab('changes', 'Changes') +
        gTab('commit', 'AI Commit') + gTab('pr', 'AI PR') + gTab('stash', 'Stash') + gTab('stats', 'Stats') + gTab('heatmap', 'Heatmap') +
      '</div>' +
      // Panels
      '<div class="git-panel" id="git-panel-timeline"></div>' +
      '<div class="git-panel" id="git-panel-branches" style="display:none"></div>' +
      '<div class="git-panel" id="git-panel-changes" style="display:none"></div>' +
      '<div class="git-panel" id="git-panel-commit" style="display:none"></div>' +
      '<div class="git-panel" id="git-panel-pr" style="display:none"></div>' +
      '<div class="git-panel" id="git-panel-stash" style="display:none"></div>' +
      '<div class="git-panel" id="git-panel-stats" style="display:none"></div>' +
      '<div class="git-panel" id="git-panel-heatmap" style="display:none"></div>' +
    '</div>';
  }

  function gTab(id, label, active) {
    return '<button class="git-tab-btn' + (active ? ' active' : '') + '" data-tab="' + id + '" onclick="Views.git.switchTab(\'' + id + '\')">' + label + '</button>';
  }

  Views.git.switchTab = function (tab) {
    activeTab = tab;
    document.querySelectorAll('.git-tab-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
    ['timeline', 'branches', 'changes', 'commit', 'pr', 'stash', 'stats', 'heatmap'].forEach(function (t) {
      var p = document.getElementById('git-panel-' + t);
      if (p) p.style.display = t === tab ? '' : 'none';
    });
    if (tab === 'branches' && branches.length === 0) loadBranches();
    if (tab === 'changes') loadChanges();
    if (tab === 'commit') loadCommitAssistant();
    if (tab === 'pr') loadPRAssistant();
    if (tab === 'stash') loadStashes();
    if (tab === 'stats') loadStats();
    if (tab === 'heatmap') loadHeatmap();
  };

  // ── Load All ──
  function loadAll() {
    Promise.all([
      fetch('/api/git').then(r2j),
      fetch('/api/git/log?limit=50').then(r2j),
    ]).then(function (r) {
      renderBanner(r[0]);
      commits = r[1].commits || [];
      renderTimeline();
    }).catch(function () {});
  }

  // ── Status Banner ──
  function renderBanner(d) {
    var el = document.getElementById('git-status-banner');
    if (!el) return;
    var dirty = d.status && d.status.trim();
    var fileCount = dirty ? d.status.trim().split('\n').length : 0;
    el.innerHTML =
      '<div class="git-banner-grid">' +
        '<div class="git-banner-item">' +
          '<div class="git-banner-label">Branch</div>' +
          '<div class="git-banner-value" style="color:var(--cyan)">' + esc(d.branch || '--') + '</div>' +
        '</div>' +
        '<div class="git-banner-item">' +
          '<div class="git-banner-label">Status</div>' +
          '<div class="git-banner-value" style="color:' + (dirty ? 'var(--orange)' : 'var(--cyan)') + '">' + (dirty ? fileCount + ' changed' : 'Clean') + '</div>' +
        '</div>' +
        '<div class="git-banner-item">' +
          '<div class="git-banner-label">Remote</div>' +
          '<div class="git-banner-value text-secondary" style="font-size:11px">' + esc((d.remotes || '').split('\n')[0].replace(/\s+\(fetch\)/, '')) + '</div>' +
        '</div>' +
        '<div class="git-banner-actions">' +
          '<button class="btn btn-sm btn-cyan" onclick="Views.git.pull()">Pull</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="Views.git.push()">Push</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="loadAll()">Refresh</button>' +
        '</div>' +
      '</div>';
  }

  // ── Commit Timeline ──
  function renderTimeline() {
    var el = document.getElementById('git-panel-timeline');
    if (!el || commits.length === 0) { if (el) el.innerHTML = '<div class="text-secondary" style="padding:20px">No commits found</div>'; return; }
    var html = '<div class="git-timeline">';
    commits.forEach(function (c, i) {
      var changes = c.files > 0 ? '<span class="git-commit-stats"><span class="diff-add">+' + c.insertions + '</span> <span class="diff-del">-' + c.deletions + '</span> <span class="text-tertiary">(' + c.files + ')</span></span>' : '';
      html += '<div class="git-timeline-item">' +
        '<div class="git-timeline-line">' +
          '<div class="git-timeline-dot' + (i === 0 ? ' git-dot-head' : '') + '"></div>' +
          (i < commits.length - 1 ? '<div class="git-timeline-connector"></div>' : '') +
        '</div>' +
        '<div class="git-timeline-content">' +
          '<div class="git-commit-row">' +
            '<span class="git-commit-hash" onclick="Views.git.showDiff(\'' + c.hash + '\')" title="View diff">' + esc(c.shortHash) + '</span>' +
            '<span class="git-commit-msg">' + esc(c.message) + '</span>' +
            changes +
          '</div>' +
          '<div class="git-commit-meta">' +
            '<span class="git-commit-author">' + esc(c.author) + '</span>' +
            '<span class="git-commit-date">' + timeAgo(c.date) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  Views.git.showDiff = function (hash) {
    fetch('/api/git/diff/' + hash).then(r2j).then(function (d) {
      Modal.open({
        title: 'Commit ' + hash.slice(0, 7),
        body: '<div class="git-diff-modal">' +
          '<pre class="git-diff-stat">' + esc(d.stat) + '</pre>' +
          '<pre class="git-diff-content">' + renderDiff(d.diff || '') + '</pre>' +
        '</div>',
        footer: '<button class="btn btn-sm" onclick="Modal.close()">Close</button>'
      });
    }).catch(function () { Toast.error('Failed to load diff'); });
  };

  // ── Branches ──
  function loadBranches() {
    fetch('/api/git/branches').then(r2j).then(function (d) {
      branches = (d.local || []).concat(d.remote || []);
      var el = document.getElementById('git-panel-branches');
      if (!el) return;
      var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<span class="text-secondary">' + (d.local || []).length + ' local, ' + (d.remote || []).length + ' remote</span>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-sm btn-ghost" style="color:var(--cyan)" onclick="Views.git.branchCleanup()" id="git-cleanup-btn">AI Branch Cleanup</button>' +
          '<button class="btn btn-sm btn-ghost" style="color:var(--cyan)" onclick="Views.git.conflictHelp()" id="git-conflict-btn">AI Conflict Help</button>' +
        '</div></div>' +
        '<div id="git-branch-ai-result"></div>';
      html += '<div class="git-branch-grid">';
      html += '<div class="git-branch-section"><div class="git-section-title">Local Branches</div>';
      (d.local || []).forEach(function (b) {
        var isCurrent = b.name === d.current;
        html += '<div class="git-branch-card' + (isCurrent ? ' git-branch-current' : '') + '">' +
          '<div class="git-branch-name">' + (isCurrent ? '<span class="git-current-badge">HEAD</span> ' : '') + esc(b.name) + '</div>' +
          '<div class="git-branch-info">' +
            '<span class="git-branch-hash">' + esc(b.hash) + '</span>' +
            '<span class="text-tertiary">' + esc(b.message || '') + '</span>' +
            '<span class="text-tertiary">' + timeAgo(b.date) + '</span>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
      html += '<div class="git-branch-section"><div class="git-section-title">Remote Branches</div>';
      (d.remote || []).forEach(function (b) {
        html += '<div class="git-branch-card">' +
          '<div class="git-branch-name text-secondary">' + esc(b.name) + '</div>' +
          '<div class="git-branch-info"><span class="git-branch-hash">' + esc(b.hash) + '</span><span class="text-tertiary">' + timeAgo(b.date) + '</span></div>' +
        '</div>';
      });
      html += '</div></div>';
      el.innerHTML = html;
    }).catch(function () {});
  }

  Views.git.branchCleanup = function () {
    var btn = document.getElementById('git-cleanup-btn');
    var out = document.getElementById('git-branch-ai-result');
    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
    if (out) out.innerHTML = '<div class="glass-card" style="padding:12px;margin-bottom:12px"><span class="text-secondary">Analyzing branches...</span></div>';
    fetch('/api/git/ai-branch-cleanup').then(r2j).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'AI Branch Cleanup'; }
      if (!out) return;
      var html = '<div class="glass-card" style="padding:16px;margin-bottom:12px;border-left:3px solid var(--cyan)">' +
        '<div style="font-weight:600;color:var(--cyan);margin-bottom:8px">Branch Cleanup Analysis</div>' +
        '<div style="color:var(--text-primary);margin-bottom:12px">' + esc(d.summary || '') + '</div>';
      if ((d.stale || []).length) {
        html += '<div style="margin-bottom:8px"><span class="text-secondary" style="font-size:11px">Stale Branches</span><br>';
        d.stale.forEach(function (b) { html += '<span class="badge" style="margin:2px;color:var(--orange)">' + esc(b) + '</span>'; });
        html += '</div>';
      }
      if ((d.merged || []).length) {
        html += '<div style="margin-bottom:8px"><span class="text-secondary" style="font-size:11px">Likely Merged</span><br>';
        d.merged.forEach(function (b) { html += '<span class="badge" style="margin:2px;color:var(--cyan)">' + esc(b) + '</span>'; });
        html += '</div>';
      }
      if ((d.recommendations || []).length) {
        html += '<div><span class="text-secondary" style="font-size:11px">Recommendations</span><ul style="margin:4px 0 0 16px;color:var(--text-primary);font-size:13px">';
        d.recommendations.forEach(function (r) { html += '<li>' + esc(r) + '</li>'; });
        html += '</ul></div>';
      }
      html += '</div>';
      out.innerHTML = html;
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'AI Branch Cleanup'; }
      if (out) out.innerHTML = '<div class="glass-card" style="padding:12px;margin-bottom:12px;border-left:3px solid var(--orange)"><span style="color:var(--orange)">AI analysis failed.</span></div>';
    });
  };

  Views.git.conflictHelp = function () {
    var btn = document.getElementById('git-conflict-btn');
    var out = document.getElementById('git-branch-ai-result');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }
    if (out) out.innerHTML = '<div class="glass-card" style="padding:12px;margin-bottom:12px"><span class="text-secondary">Checking for conflicts...</span></div>';
    fetch('/api/git/ai-conflict-help', { method: 'POST' }).then(r2j).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'AI Conflict Help'; }
      if (!out) return;
      if (!d.conflicts || !d.conflicts.length) {
        out.innerHTML = '<div class="glass-card" style="padding:12px;margin-bottom:12px;border-left:3px solid var(--cyan)"><span style="color:var(--cyan)">' + esc(d.resolution || 'No merge conflicts detected.') + '</span></div>';
        return;
      }
      var riskColor = d.risk === 'high' ? 'var(--orange)' : d.risk === 'medium' ? 'var(--yellow)' : 'var(--cyan)';
      var html = '<div class="glass-card" style="padding:16px;margin-bottom:12px;border-left:3px solid var(--orange)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<span style="font-weight:600;color:var(--orange)">Merge Conflicts Detected</span>' +
          '<span class="badge" style="color:' + riskColor + '">Risk: ' + esc(d.risk || 'unknown') + '</span>' +
        '</div>' +
        '<div style="color:var(--text-primary);margin-bottom:12px">' + esc(d.resolution) + '</div>';
      d.conflicts.forEach(function (c) {
        html += '<div style="padding:8px;background:var(--well);border-radius:6px;margin-bottom:6px">' +
          '<div style="color:var(--cyan);font-size:12px;font-weight:600">' + esc(c.file) + '</div>' +
          '<div style="color:var(--text-secondary);font-size:12px">' + esc(c.description) + '</div>' +
          '<div style="color:var(--text-primary);font-size:12px;margin-top:4px">' + esc(c.suggestion) + '</div>' +
        '</div>';
      });
      html += '</div>';
      out.innerHTML = html;
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'AI Conflict Help'; }
      if (out) out.innerHTML = '<div class="glass-card" style="padding:12px;margin-bottom:12px;border-left:3px solid var(--orange)"><span style="color:var(--orange)">AI conflict analysis failed.</span></div>';
    });
  };

  // ── Staged Changes ──
  function loadChanges() {
    fetch('/api/git/diff').then(r2j).then(function (d) {
      var el = document.getElementById('git-panel-changes');
      if (!el) return;
      var hasStagedStat = d.stagedStat && d.stagedStat.trim();
      var hasUnstagedStat = d.unstagedStat && d.unstagedStat.trim();
      if (!hasStagedStat && !hasUnstagedStat) {
        el.innerHTML = '<div class="text-secondary" style="padding:20px;text-align:center">No changes detected. Working tree clean.</div>';
        return;
      }
      var html = '';
      if (hasStagedStat) {
        html += '<div class="glass-card" style="margin-bottom:12px"><div class="card-header" style="color:var(--cyan)">Staged Changes</div>' +
          '<pre class="git-diff-stat">' + esc(d.stagedStat) + '</pre>' +
          '<pre class="git-diff-content">' + renderDiff(d.staged) + '</pre></div>';
      }
      if (hasUnstagedStat) {
        html += '<div class="glass-card"><div class="card-header" style="color:var(--orange)">Unstaged Changes</div>' +
          '<pre class="git-diff-stat">' + esc(d.unstagedStat) + '</pre>' +
          '<pre class="git-diff-content">' + renderDiff(d.unstaged) + '</pre></div>';
      }
      el.innerHTML = html;
    }).catch(function () {});
  }

  // ── AI Commit Assistant ──
  function loadCommitAssistant() {
    var el = document.getElementById('git-panel-commit');
    if (!el) return;
    el.innerHTML =
      '<div class="glass-card git-commit-assistant">' +
        '<div class="card-header">AI Commit Assistant</div>' +
        '<div class="git-commit-form">' +
          '<div style="display:flex;gap:8px;margin-bottom:12px">' +
            '<button class="btn btn-sm btn-cyan" onclick="Views.git.generateMsg()" id="git-gen-btn">Generate Message</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.git.reviewChanges()" id="git-review-btn">Review Changes</button>' +
          '</div>' +
          '<textarea id="git-commit-msg" class="form-input" rows="3" placeholder="Commit message... (or click Generate)" style="width:100%;margin-bottom:10px"></textarea>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:4px"><input type="checkbox" id="git-add-all" checked /> Stage all changes</label>' +
            '<button class="btn btn-sm btn-cyan" onclick="Views.git.commitNow()">Commit</button>' +
          '</div>' +
        '</div>' +
        '<div id="git-review-output" style="margin-top:12px"></div>' +
      '</div>';
  }

  Views.git.generateMsg = function () {
    var btn = document.getElementById('git-gen-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    fetch('/api/git/ai-commit-msg', { method: 'POST' }).then(r2j).then(function (d) {
      var ta = document.getElementById('git-commit-msg');
      if (ta && d.message) ta.value = d.message;
      if (btn) { btn.disabled = false; btn.textContent = 'Generate Message'; }
      if (d.error) Toast.warning(d.error);
    }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Generate Message'; } });
  };

  Views.git.reviewChanges = function () {
    var btn = document.getElementById('git-review-btn');
    var out = document.getElementById('git-review-output');
    if (btn) { btn.disabled = true; btn.textContent = 'Reviewing...'; }
    if (out) out.innerHTML = '<span class="text-secondary">Bulwark is reviewing your changes...</span>';
    fetch('/api/git/ai-review', { method: 'POST' }).then(r2j).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'Review Changes'; }
      if (out) {
        out.innerHTML = '<div class="git-review-card">' +
          '<div class="card-header" style="font-size:12px">Code Review</div>' +
          '<div style="font-size:13px;line-height:1.6;color:var(--text-primary)">' + esc(d.review) + '</div>' +
        '</div>';
      }
    }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Review Changes'; } });
  };

  Views.git.commitNow = function () {
    var msg = (document.getElementById('git-commit-msg').value || '').trim();
    if (!msg) { Toast.warning('Enter a commit message'); return; }
    var addAll = document.getElementById('git-add-all').checked;
    fetch('/api/git/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, addAll: addAll }) })
      .then(r2j).then(function (d) {
        if (d.success) { Toast.success('Committed!'); loadAll(); document.getElementById('git-commit-msg').value = ''; }
        else Toast.error(d.error || 'Commit failed');
      }).catch(function () { Toast.error('Commit failed'); });
  };

  // ── AI PR Description ──
  function loadPRAssistant() {
    var el = document.getElementById('git-panel-pr');
    if (!el) return;
    el.innerHTML =
      '<div class="glass-card" style="padding:16px">' +
        '<div class="card-header">AI Pull Request Generator</div>' +
        '<p class="text-secondary" style="font-size:13px;margin-bottom:12px">Generate a PR title, summary, and test plan from your branch commits.</p>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">' +
          '<label class="text-secondary" style="font-size:12px">Base branch:</label>' +
          '<input type="text" id="git-pr-base" class="form-input" value="main" style="width:120px;font-size:12px">' +
          '<button class="btn btn-sm btn-cyan" onclick="Views.git.generatePR()" id="git-pr-btn">Generate PR</button>' +
        '</div>' +
        '<div id="git-pr-output"></div>' +
      '</div>';
  }

  Views.git.generatePR = function () {
    var btn = document.getElementById('git-pr-btn');
    var out = document.getElementById('git-pr-output');
    var base = (document.getElementById('git-pr-base') || {}).value || 'main';
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    if (out) out.innerHTML = '<span class="text-secondary">Analyzing commits against ' + esc(base) + '...</span>';
    fetch('/api/git/ai-pr-description', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base: base })
    }).then(r2j).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'Generate PR'; }
      if (!out) return;
      if (d.error) { out.innerHTML = '<span style="color:var(--orange)">' + esc(d.error) + '</span>'; return; }
      var html = '<div style="border-left:3px solid var(--cyan);padding-left:16px">' +
        '<div style="margin-bottom:12px"><span class="text-secondary" style="font-size:11px">Title</span><br>' +
        '<span style="color:var(--text-primary);font-weight:600;font-size:15px">' + esc(d.title || '') + '</span></div>';
      if (d.summary) {
        html += '<div style="margin-bottom:12px"><span class="text-secondary" style="font-size:11px">Summary</span>' +
          '<div style="margin-top:4px;color:var(--text-primary);font-size:13px;white-space:pre-wrap">' + esc(Array.isArray(d.summary) ? d.summary.join('\n') : d.summary) + '</div></div>';
      }
      if (d.test_plan) {
        html += '<div style="margin-bottom:12px"><span class="text-secondary" style="font-size:11px">Test Plan</span>' +
          '<div style="margin-top:4px;color:var(--text-primary);font-size:13px;white-space:pre-wrap">' + esc(Array.isArray(d.test_plan) ? d.test_plan.join('\n') : d.test_plan) + '</div></div>';
      }
      if (d.labels && d.labels.length) {
        html += '<div style="margin-bottom:8px"><span class="text-secondary" style="font-size:11px">Labels</span><br>';
        d.labels.forEach(function (l) { html += '<span class="badge" style="margin:2px;color:var(--cyan)">' + esc(l) + '</span>'; });
        html += '</div>';
      }
      if (d.breaking) html += '<div class="badge" style="color:var(--orange);margin-bottom:8px">Breaking Changes</div>';
      html += '<div style="margin-top:12px"><button class="btn btn-sm btn-ghost" onclick="Views.git.copyPR()">Copy to Clipboard</button></div>';
      html += '</div>';
      out.innerHTML = html;
      // Store for copy
      out.dataset.prTitle = d.title || '';
      out.dataset.prBody = (Array.isArray(d.summary) ? d.summary.join('\n- ') : (d.summary || '')) + '\n\nTest plan:\n' + (Array.isArray(d.test_plan) ? d.test_plan.join('\n- ') : (d.test_plan || ''));
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Generate PR'; }
      if (out) out.innerHTML = '<span style="color:var(--orange)">Failed to generate PR description. Check AI provider.</span>';
    });
  };

  Views.git.copyPR = function () {
    var out = document.getElementById('git-pr-output');
    if (!out) return;
    var text = '## ' + (out.dataset.prTitle || '') + '\n\n' + (out.dataset.prBody || '');
    navigator.clipboard.writeText(text).then(function () { Toast.success('PR description copied'); }).catch(function () { Toast.error('Copy failed'); });
  };

  // ── Stash ──
  function loadStashes() {
    fetch('/api/git/stash').then(r2j).then(function (d) {
      stashes = d.stashes || [];
      var el = document.getElementById('git-panel-stash');
      if (!el) return;
      var html = '<div class="glass-card">' +
        '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center">Stash <button class="btn btn-sm btn-cyan" onclick="Views.git.stashPush()">Stash Changes</button></div>';
      if (stashes.length === 0) {
        html += '<div class="text-secondary" style="padding:16px">No stashes</div>';
      } else {
        stashes.forEach(function (s) {
          html += '<div class="git-stash-item">' +
            '<div class="git-stash-ref">' + esc(s.ref) + '</div>' +
            '<div class="git-stash-msg">' + esc(s.message) + '</div>' +
            '<div class="git-stash-date text-tertiary">' + timeAgo(s.date) + '</div>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.git.stashPop()">Pop</button>' +
          '</div>';
        });
      }
      html += '</div>';
      el.innerHTML = html;
    }).catch(function () {});
  }

  Views.git.stashPush = function () {
    var msg = prompt('Stash message (optional):') || 'Quick stash';
    fetch('/api/git/stash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) })
      .then(r2j).then(function (d) { if (d.success) { Toast.success('Stashed'); loadStashes(); loadAll(); } else Toast.error(d.error); });
  };

  Views.git.stashPop = function () {
    fetch('/api/git/stash/pop', { method: 'POST' }).then(r2j).then(function (d) {
      if (d.success) { Toast.success('Stash applied'); loadStashes(); loadAll(); } else Toast.error(d.error);
    });
  };

  // ── Stats + Contributors ──
  function loadStats() {
    Promise.all([
      fetch('/api/git/repo-stats').then(r2j),
      fetch('/api/git/contributors').then(r2j),
    ]).then(function (r) {
      repoStats = r[0];
      contributors = r[1].contributors || [];
      var el = document.getElementById('git-panel-stats');
      if (!el) return;
      var html = '<div class="git-stats-grid">';
      html += '<div class="glass-card"><div class="card-header">Repository</div><div class="git-stats-list">' +
        statRow('Total Commits', repoStats.totalCommits || 0) +
        statRow('Files', repoStats.fileCount || 0) +
        statRow('Repo Size', repoStats.repoSize || '--') +
        statRow('First Commit', repoStats.firstCommit ? timeAgo(repoStats.firstCommit) : '--') +
      '</div></div>';
      html += '<div class="glass-card"><div class="card-header">Contributors (' + contributors.length + ')</div><div class="git-contributors">';
      var maxCommits = contributors.length > 0 ? contributors[0].commits : 1;
      contributors.forEach(function (c) {
        var pct = Math.round(c.commits / maxCommits * 100);
        html += '<div class="git-contributor">' +
          '<div class="git-contributor-info"><span class="git-contributor-name">' + esc(c.name) + '</span><span class="text-tertiary">' + c.commits + ' commits</span></div>' +
          '<div class="git-contributor-bar-wrap"><div class="git-contributor-bar" style="width:' + pct + '%"></div></div>' +
        '</div>';
      });
      html += '</div></div></div>';
      el.innerHTML = html;
    }).catch(function () {});
  }

  function statRow(label, val) {
    return '<div class="git-stat-row"><span class="text-secondary">' + label + '</span><span class="text-primary">' + esc(String(val)) + '</span></div>';
  }

  // ── Heatmap ──
  function loadHeatmap() {
    fetch('/api/git/heatmap').then(r2j).then(function (d) {
      heatmapData = d.heatmap || {};
      var el = document.getElementById('git-panel-heatmap');
      if (!el) return;
      var html = '<div class="glass-card"><div class="card-header">Commit Activity (Last 12 Months)</div><div class="git-heatmap">';
      var today = new Date();
      var maxVal = Math.max(1, Math.max.apply(null, Object.values(heatmapData).concat([1])));
      html += '<div class="git-heatmap-grid">';
      for (var w = 51; w >= 0; w--) {
        html += '<div class="git-heatmap-week">';
        for (var d2 = 0; d2 < 7; d2++) {
          var date = new Date(today);
          date.setDate(date.getDate() - (w * 7 + (6 - d2)));
          var key = date.toISOString().slice(0, 10);
          var count = heatmapData[key] || 0;
          var intensity = count > 0 ? Math.max(0.2, count / maxVal) : 0;
          var bg = count > 0 ? 'rgba(34,211,238,' + intensity.toFixed(2) + ')' : 'rgba(255,255,255,0.03)';
          html += '<div class="git-heatmap-cell" style="background:' + bg + '" title="' + key + ': ' + count + ' commits"></div>';
        }
        html += '</div>';
      }
      html += '</div>';
      html += '<div class="git-heatmap-legend"><span class="text-tertiary">Less</span>';
      [0, 0.2, 0.4, 0.7, 1].forEach(function (i) {
        html += '<div class="git-heatmap-cell" style="background:' + (i === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(34,211,238,' + i + ')') + '"></div>';
      });
      html += '<span class="text-tertiary">More</span></div></div></div>';
      el.innerHTML = html;
    }).catch(function () {});
  }

  // ── AI Analysis ──
  Views.git.runAI = function (force) {
    var btn = document.getElementById('git-ai-btn');
    var body = document.getElementById('git-ai-body');
    if (!force && window.AICache) {
      var restored = window.AICache.restore('git-analysis');
      if (restored) {
        if (body) body.textContent = restored.response;
        var fb = document.getElementById('git-ai-freshness');
        if (fb) fb.innerHTML = window.AICache.freshnessBadge('git-analysis');
        return;
      }
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
    if (body) body.innerHTML = '<span class="text-secondary">Analyzing repository...</span>';
    fetch('/api/git/ai-analysis').then(r2j).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = 'Analyze'; }
      if (body && d.analysis) {
        typewriter(body, d.analysis);
        if (window.AICache) {
          window.AICache.set('git-analysis', {}, d.analysis);
          var fb = document.getElementById('git-ai-freshness');
          if (fb) fb.innerHTML = window.AICache.freshnessBadge('git-analysis');
        }
      }
    }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Analyze'; } });
  };

  // ── Actions ──
  Views.git.pull = function () {
    Toast.info('Pulling from main...');
    fetch('/api/git/pull', { method: 'POST' }).then(r2j).then(function (d) {
      if (d.error) Toast.error(d.error); else { Toast.success('Pulled'); loadAll(); }
    }).catch(function () { Toast.error('Pull failed'); });
  };

  Views.git.push = function () {
    Toast.info('Pushing...');
    fetch('/api/git/push', { method: 'POST' }).then(r2j).then(function (d) {
      if (d.error) Toast.error(d.error); else Toast.success('Pushed to ' + (d.branch || 'remote'));
    }).catch(function () { Toast.error('Push failed'); });
  };

  // ── Helpers ──
  function r2j(r) { return r.json(); }
  function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s || '')) : String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function timeAgo(d) {
    if (!d) return '';
    var s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
    return Math.floor(s / 2592000) + 'mo ago';
  }
  function renderDiff(text) {
    if (!text) return '';
    return esc(text).split('\n').map(function (line) {
      if (line.startsWith('+') && !line.startsWith('+++')) return '<span class="diff-add">' + line + '</span>';
      if (line.startsWith('-') && !line.startsWith('---')) return '<span class="diff-del">' + line + '</span>';
      if (line.startsWith('@@')) return '<span class="diff-hunk">' + line + '</span>';
      return line;
    }).join('\n');
  }
  function typewriter(el, text) {
    el.innerHTML = ''; var span = document.createElement('span'); el.appendChild(span);
    var i = 0; (function tick() { if (i < text.length) { span.textContent += text[i++]; setTimeout(tick, 8 + Math.random() * 12); } })();
  }
})();
