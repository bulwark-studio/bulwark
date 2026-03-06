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
    show: function () { this.init(); loadAll(); Views.git.runAI(false); },
    hide: function () {},
    update: function () {}
  };

  function buildTemplate() {
    return '<div class="git-dashboard">' +
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
        gTab('commit', 'AI Commit') + gTab('stash', 'Stash') + gTab('stats', 'Stats') + gTab('heatmap', 'Heatmap') +
      '</div>' +
      // Panels
      '<div class="git-panel" id="git-panel-timeline"></div>' +
      '<div class="git-panel" id="git-panel-branches" style="display:none"></div>' +
      '<div class="git-panel" id="git-panel-changes" style="display:none"></div>' +
      '<div class="git-panel" id="git-panel-commit" style="display:none"></div>' +
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
    ['timeline', 'branches', 'changes', 'commit', 'stash', 'stats', 'heatmap'].forEach(function (t) {
      var p = document.getElementById('git-panel-' + t);
      if (p) p.style.display = t === tab ? '' : 'none';
    });
    if (tab === 'branches' && branches.length === 0) loadBranches();
    if (tab === 'changes') loadChanges();
    if (tab === 'commit') loadCommitAssistant();
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
      var html = '<div class="git-branch-grid">';
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
