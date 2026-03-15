/**
 * Bulwark — Cron Intelligence Center
 * AI natural language scheduling, analytics, execution history, job management
 */
(function () {
  'use strict';

  var jobs = [];
  var analytics = null;
  var activeTab = 'jobs';

  Views.cron = {
    init: function () {
      var c = document.getElementById('view-cron');
      if (!c) return;
      c.innerHTML =
        '<div class="cron-dashboard">' +
          // AI Analysis
          '<div class="cron-ai-card" id="cron-ai-card">' +
            '<div class="cron-ai-header"><div class="ai-dot"></div><span>Bulwark Cron Analysis <span id="cron-ai-freshness"></span></span></div>' +
            '<div class="cron-ai-body" id="cron-ai-body">Click analyze to get AI insights on your scheduled tasks...</div>' +
            '<button class="cron-ai-btn" onclick="cronAiAnalysis(true)">Analyze Schedule Health</button>' +
          '</div>' +
          // Tabs
          '<div class="cron-tabs">' +
            '<button class="cron-tab-btn active" data-tab="jobs" onclick="cronTab(\'jobs\')">Jobs</button>' +
            '<button class="cron-tab-btn" data-tab="history" onclick="cronTab(\'history\')">History</button>' +
            '<button class="cron-tab-btn" data-tab="analytics" onclick="cronTab(\'analytics\')">Analytics</button>' +
          '</div>' +
          // Stats banner
          '<div class="cron-banner" id="cron-banner"></div>' +
          // Content
          '<div id="cron-tab-content"></div>' +
        '</div>';
    },
    show: function () { loadCronData(); cronAiAnalysis(false); },
    hide: function () {},
    update: function () {}
  };

  function loadCronData() {
    Promise.all([
      fetch('/api/cron/jobs').then(safeJson),
      fetch('/api/cron/analytics').then(safeJson),
    ]).then(function (results) {
      jobs = results[0].jobs || [];
      analytics = results[1];
      renderBanner();
      renderTab();
    }).catch(function () { renderTab(); });
  }

  function renderBanner() {
    var el = document.getElementById('cron-banner');
    if (!el || !analytics) return;
    el.innerHTML =
      '<div class="cron-banner-grid">' +
        '<div class="cron-banner-item"><label>Total Jobs</label><span>' + (analytics.totalJobs || 0) + '</span></div>' +
        '<div class="cron-banner-item"><label>Active</label><span style="color:var(--cyan)">' + (analytics.activeJobs || 0) + '</span></div>' +
        '<div class="cron-banner-item"><label>Total Runs</label><span>' + (analytics.totalRuns || 0) + '</span></div>' +
        '<div class="cron-banner-item"><label>Success Rate</label><span style="color:' + (analytics.successRate >= 90 ? 'var(--cyan)' : 'var(--orange)') + '">' + (analytics.successRate || 0) + '%</span></div>' +
        '<div class="cron-banner-item"><label>Failed</label><span style="color:' + (analytics.failedRuns ? 'var(--orange)' : 'var(--text-tertiary)') + '">' + (analytics.failedRuns || 0) + '</span></div>' +
      '</div>' +
      '<div class="cron-banner-actions">' +
        '<button onclick="createCronJobEnhanced()">+ Add Job</button>' +
        '<button onclick="loadCronData()">Refresh</button>' +
      '</div>';
  }

  window.cronTab = function (tab) {
    activeTab = tab;
    document.querySelectorAll('.cron-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderTab();
  };

  function renderTab() {
    var el = document.getElementById('cron-tab-content');
    if (!el) return;
    if (activeTab === 'jobs') renderJobs(el);
    else if (activeTab === 'history') renderHistory(el);
    else if (activeTab === 'analytics') renderAnalytics(el);
  }

  function renderJobs(el) {
    if (!jobs.length) {
      el.innerHTML = '<div class="cron-section"><div class="cron-empty">No cron jobs configured. Click "+ Add Job" to create your first scheduled task.</div></div>';
      return;
    }
    el.innerHTML = '<div class="cron-job-grid">' +
      jobs.map(function (j) {
        var statusColor = j.enabled !== false ? 'var(--cyan)' : 'var(--text-tertiary)';
        var lastStatusDot = j.lastStatus === 'success' ? 'success' : j.lastStatus === 'failed' ? 'failed' : '';
        return '<div class="cron-job-card' + (j.enabled === false ? ' disabled' : '') + '">' +
          '<div class="cron-job-header">' +
            '<div class="cron-job-name">' + esc(j.name || j.command) + '</div>' +
            '<span class="cron-job-status" style="color:' + statusColor + '">' + (j.enabled !== false ? 'Active' : 'Paused') + '</span>' +
          '</div>' +
          '<div class="cron-job-schedule">' +
            '<span class="cron-job-expr">' + esc(j.schedule) + '</span>' +
            '<span class="cron-job-human">' + esc(j.human || j.schedule) + '</span>' +
          '</div>' +
          '<div class="cron-job-command">' + esc(j.command) + '</div>' +
          (j.description ? '<div class="cron-job-desc">' + esc(j.description) + '</div>' : '') +
          '<div class="cron-job-meta">' +
            (j.category && j.category !== 'general' ? '<span class="cron-job-tag">' + esc(j.category) + '</span>' : '') +
            (j.nextRun ? '<span>Next: ' + timeAgo(j.nextRun) + '</span>' : '') +
            (j.lastRun ? '<span>Last: ' + timeAgo(j.lastRun) + (lastStatusDot ? ' <span class="cron-dot ' + lastStatusDot + '"></span>' : '') + '</span>' : '') +
            (j.stats && j.stats.total > 0 ? '<span>' + j.stats.success + '/' + j.stats.total + ' runs</span>' : '') +
            (j.stats && j.stats.avgDuration > 0 ? '<span>~' + j.stats.avgDuration + 'ms</span>' : '') +
          '</div>' +
          '<div class="cron-job-actions">' +
            '<button onclick="runCronJob(\'' + esc(j.id) + '\')">Run Now</button>' +
            '<button onclick="toggleCronJob(\'' + esc(j.id) + '\')">' + (j.enabled !== false ? 'Pause' : 'Resume') + '</button>' +
            '<button onclick="cronJobHistory(\'' + esc(j.id) + '\')">History</button>' +
            '<button class="danger" onclick="deleteCronJob(\'' + esc(j.id) + '\')">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function renderHistory(el) {
    el.innerHTML = '<div class="cron-section"><h3>Execution History</h3><div id="cron-history-list" style="color:var(--text-tertiary)">Loading...</div></div>';
    fetch('/api/cron/history').then(safeJson).then(function (d) {
      var runs = d.runs || [];
      var list = document.getElementById('cron-history-list');
      if (!list) return;
      if (!runs.length) { list.innerHTML = '<div class="cron-empty">No execution history yet. Run a job to see results here.</div>'; return; }
      list.innerHTML = '<div class="cron-history-items">' +
        runs.slice(0, 50).map(function (r) {
          return '<div class="cron-history-item">' +
            '<div class="cron-history-dot ' + (r.status || '') + '"></div>' +
            '<div class="cron-history-info">' +
              '<div class="cron-history-name">' + esc(r.jobName || r.jobId) + '</div>' +
              '<div class="cron-history-time">' + (r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '--') +
                (r.duration ? ' &middot; ' + r.duration + 'ms' : '') + '</div>' +
            '</div>' +
            '<div class="cron-history-status">' +
              '<span class="deploy-stage-badge ' + (r.status || '') + '">' + (r.status || 'unknown') + '</span>' +
            '</div>' +
            (r.output ? '<div class="cron-history-output" onclick="this.classList.toggle(\'expanded\')" title="Click to expand">' + esc(r.output.substring(0, 200)) + '</div>' : '') +
          '</div>';
        }).join('') +
      '</div>';
    });
  }

  function renderAnalytics(el) {
    if (!analytics) { el.innerHTML = '<div class="cron-section"><div class="cron-empty">Loading analytics...</div></div>'; return; }
    // Daily chart
    var daily = analytics.daily || {};
    var days = Object.keys(daily);
    var maxVal = Math.max(1, ...days.map(function (d) { return (daily[d].success || 0) + (daily[d].failed || 0); }));

    var chartBars = days.map(function (d) {
      var s = daily[d].success || 0;
      var f = daily[d].failed || 0;
      var total = s + f;
      var pct = Math.round((total / maxVal) * 100);
      return '<div class="cron-chart-col">' +
        '<div class="cron-chart-bar-wrap">' +
          (f > 0 ? '<div class="cron-chart-bar fail" style="height:' + Math.round((f / maxVal) * 100) + '%"></div>' : '') +
          (s > 0 ? '<div class="cron-chart-bar success" style="height:' + Math.round((s / maxVal) * 100) + '%"></div>' : '') +
        '</div>' +
        '<div class="cron-chart-label">' + d.slice(5) + '</div>' +
      '</div>';
    }).join('');

    // Categories
    var cats = analytics.categories || {};
    var catHtml = Object.entries(cats).map(function (e) {
      return '<div class="cron-cat-item"><span class="cron-cat-name">' + esc(e[0]) + '</span><span class="cron-cat-count">' + e[1] + '</span></div>';
    }).join('');

    el.innerHTML =
      '<div class="cron-analytics-grid">' +
        '<div class="cron-section">' +
          '<h3>Runs (Last 7 Days)</h3>' +
          '<div class="cron-chart">' + chartBars + '</div>' +
          '<div class="cron-chart-legend"><span class="cron-dot success"></span> Success <span class="cron-dot failed"></span> Failed</div>' +
        '</div>' +
        '<div class="cron-section">' +
          '<h3>Categories</h3>' +
          (catHtml || '<div class="cron-empty">No categories</div>') +
        '</div>' +
      '</div>';
  }

  // ── Actions ──

  window.createCronJobEnhanced = function () {
    Modal.open({
      title: 'Create Cron Job', size: 'lg',
      body:
        '<div class="cron-create-form">' +
          '<div class="form-group"><label class="form-label">Name</label><input id="cj-name" class="form-input" placeholder="Backup database"></div>' +
          // Natural language input
          '<div class="form-group">' +
            '<label class="form-label">Schedule (natural language)</label>' +
            '<div style="display:flex;gap:8px">' +
              '<input id="cj-natural" class="form-input" placeholder="Every weekday at 9am" style="flex:1">' +
              '<button class="btn btn-sm btn-cyan" id="cj-parse-btn" onclick="parseCronNatural()">AI Parse</button>' +
            '</div>' +
          '</div>' +
          // Manual cron expression
          '<div class="form-group">' +
            '<label class="form-label">Cron Expression</label>' +
            '<input id="cj-schedule" class="form-input" placeholder="0 9 * * 1-5" style="font-family:monospace">' +
            '<div id="cj-human" style="font-size:11px;color:var(--cyan);margin-top:4px"></div>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">Command</label><input id="cj-command" class="form-input" placeholder="/usr/bin/my-script.sh" style="font-family:monospace"></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<div class="form-group"><label class="form-label">Category</label>' +
              '<select id="cj-category" class="form-input"><option value="general">General</option><option value="backup">Backup</option><option value="cleanup">Cleanup</option><option value="monitoring">Monitoring</option><option value="sync">Sync</option><option value="deploy">Deploy</option><option value="report">Report</option></select>' +
            '</div>' +
            '<div class="form-group"><label class="form-label">Description</label><input id="cj-desc" class="form-input" placeholder="Optional description"></div>' +
          '</div>' +
          // Quick presets
          '<div style="margin-top:8px"><label class="form-label">Quick Presets</label>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
              '<button class="btn btn-sm" onclick="setCronPreset(\'*/5 * * * *\',\'Every 5 min\')">Every 5min</button>' +
              '<button class="btn btn-sm" onclick="setCronPreset(\'0 * * * *\',\'Every hour\')">Hourly</button>' +
              '<button class="btn btn-sm" onclick="setCronPreset(\'0 0 * * *\',\'Daily midnight\')">Daily</button>' +
              '<button class="btn btn-sm" onclick="setCronPreset(\'0 9 * * 1-5\',\'Weekdays 9am\')">Weekdays 9am</button>' +
              '<button class="btn btn-sm" onclick="setCronPreset(\'0 0 * * 0\',\'Weekly Sunday\')">Weekly</button>' +
              '<button class="btn btn-sm" onclick="setCronPreset(\'0 0 1 * *\',\'Monthly 1st\')">Monthly</button>' +
            '</div>' +
          '</div>' +
        '</div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" id="cj-save">Create Job</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('cj-save');
      if (btn) btn.onclick = function () {
        var schedule = (document.getElementById('cj-schedule') || {}).value;
        var command = (document.getElementById('cj-command') || {}).value;
        var name = (document.getElementById('cj-name') || {}).value;
        var category = (document.getElementById('cj-category') || {}).value;
        var description = (document.getElementById('cj-desc') || {}).value;
        if (!schedule || !command) { Toast.warning('Schedule and command required'); return; }
        fetch('/api/cron/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, schedule: schedule, command: command, category: category, description: description }) })
          .then(safeJson)
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Job created'); Modal.close(btn.closest('.modal-overlay')); loadCronData();
          }).catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.setCronPreset = function (expr, label) {
    var el = document.getElementById('cj-schedule');
    var human = document.getElementById('cj-human');
    if (el) el.value = expr;
    if (human) human.textContent = label;
  };

  window.parseCronNatural = function () {
    var input = document.getElementById('cj-natural');
    var schedEl = document.getElementById('cj-schedule');
    var humanEl = document.getElementById('cj-human');
    if (!input || !input.value) return;
    humanEl.textContent = 'Parsing...';
    fetch('/api/cron/ai-parse', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.value }) })
      .then(safeJson)
      .then(function (d) {
        if (d.schedule) {
          schedEl.value = d.schedule;
          humanEl.textContent = d.human || d.schedule;
          humanEl.style.color = 'var(--cyan)';
        } else {
          humanEl.textContent = d.error || 'Could not parse';
          humanEl.style.color = 'var(--orange)';
        }
      }).catch(function () { humanEl.textContent = 'Parse failed'; humanEl.style.color = 'var(--orange)'; });
  };

  window.runCronJob = function (id) {
    Toast.info('Running job...');
    fetch('/api/cron/jobs/' + id + '/run', { method: 'POST' })
      .then(safeJson)
      .then(function (d) {
        if (d.status === 'success') Toast.success('Job completed in ' + d.duration + 'ms');
        else Toast.error('Job failed: ' + (d.output || '').substring(0, 100));
        loadCronData();
      }).catch(function () { Toast.error('Run failed'); });
  };

  window.toggleCronJob = function (id) {
    fetch('/api/cron/jobs/' + id + '/toggle', { method: 'POST' })
      .then(safeJson)
      .then(function () { Toast.success('Toggled'); loadCronData(); })
      .catch(function () { Toast.error('Failed'); });
  };

  window.deleteCronJob = function (id) {
    Modal.confirm({ title: 'Delete Job', message: 'Delete this cron job?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/cron/jobs/' + id, { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadCronData(); })
        .catch(function () { Toast.error('Failed'); });
    });
  };

  window.cronJobHistory = function (jobId) {
    fetch('/api/cron/history?jobId=' + jobId).then(safeJson).then(function (d) {
      var runs = d.runs || [];
      Modal.open({
        title: 'Job History', size: 'lg',
        body: runs.length ? runs.slice(0, 20).map(function (r) {
          return '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;display:flex;align-items:center;gap:10px">' +
            '<span class="deploy-stage-badge ' + (r.status || '') + '">' + (r.status || '?') + '</span>' +
            '<span style="color:var(--text-primary)">' + new Date(r.finishedAt || r.startedAt).toLocaleString() + '</span>' +
            '<span style="color:var(--text-tertiary);font-family:monospace">' + (r.duration || 0) + 'ms</span>' +
            (r.output ? '<span style="color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + esc(r.output.substring(0, 80)) + '</span>' : '') +
          '</div>';
        }).join('') : '<div style="text-align:center;color:var(--text-tertiary);padding:24px">No runs yet</div>'
      });
    });
  };

  window.cronAiAnalysis = function (force) {
    var body = document.getElementById('cron-ai-body');
    if (!body) return;
    if (!force && window.AICache) {
      var restored = window.AICache.restore('cron');
      if (restored) {
        body.textContent = restored.response;
        var fb = document.getElementById('cron-ai-freshness');
        if (fb) fb.innerHTML = window.AICache.freshnessBadge('cron');
        return;
      }
    }
    body.innerHTML = 'Analyzing schedule health...<span class="cursor-blink"></span>';
    fetch('/api/cron/ai-analysis').then(safeJson).then(function (d) {
      var text = d.analysis || 'No analysis available.';
      typewriter(body, text);
      if (window.AICache) {
        window.AICache.set('cron', {}, text);
        var fb = document.getElementById('cron-ai-freshness');
        if (fb) fb.innerHTML = window.AICache.freshnessBadge('cron');
      }
    }).catch(function () { body.textContent = 'Analysis unavailable.'; });
  };

  function typewriter(el, text) {
    el.textContent = '';
    var i = 0;
    var interval = setInterval(function () {
      el.textContent += text[i];
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 15);
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '--';
    var diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 0) {
      diff = -diff;
      if (diff < 60000) return 'in ' + Math.round(diff / 1000) + 's';
      if (diff < 3600000) return 'in ' + Math.round(diff / 60000) + 'm';
      if (diff < 86400000) return 'in ' + Math.round(diff / 3600000) + 'h';
      return 'in ' + Math.round(diff / 86400000) + 'd';
    }
    if (diff < 60000) return Math.round(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
    return Math.round(diff / 86400000) + 'd ago';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
