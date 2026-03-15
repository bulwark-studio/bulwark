/**
 * Bulwark -- Flow / DAG Orchestration View
 * Visual flow builder, execution, and run history.
 */
(function () {
  'use strict';

  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function safeJson(r) { if (!r.ok) return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error('HTTP ' + r.status + ': ' + (t || '').substring(0, 100)); } }); return r.json(); }

  var currentFlow = null;
  var currentTab = 'all';
  var detailTab = 'config';

  var NODE_TYPE_META = {
    start:     { icon: '\u25B6', color: 'var(--cyan)',   label: 'Start' },
    end:       { icon: '\u25A0', color: 'var(--text-tertiary)', label: 'End' },
    llm:       { icon: '\u2728', color: '#a78bfa',       label: 'LLM' },
    agent:     { icon: '\u2699', color: '#60a5fa',       label: 'Agent' },
    condition: { icon: '\u2666', color: '#fbbf24',       label: 'Condition' },
    delay:     { icon: '\u23F1', color: '#f472b6',       label: 'Delay' },
    http:      { icon: '\u21C4', color: '#34d399',       label: 'HTTP' },
    notify:    { icon: '\u2709', color: 'var(--orange)',  label: 'Notify' },
  };

  function statusBadge(status) {
    var colors = {
      draft: 'rgba(139,139,146,0.15);color:var(--text-secondary)',
      active: 'rgba(34,211,238,0.15);color:var(--cyan)',
      paused: 'rgba(251,191,36,0.15);color:#fbbf24',
      archived: 'rgba(139,139,146,0.1);color:var(--text-tertiary)',
      error: 'rgba(255,107,43,0.15);color:var(--orange)',
      completed: 'rgba(34,211,153,0.15);color:#34d399',
      failed: 'rgba(255,107,43,0.15);color:var(--orange)',
      running: 'rgba(34,211,238,0.15);color:var(--cyan)',
      pending: 'rgba(139,139,146,0.15);color:var(--text-secondary)',
      cancelled: 'rgba(139,139,146,0.1);color:var(--text-tertiary)',
    };
    return '<span class="badge" style="font-size:9px;background:' + (colors[status] || colors.draft) + '">' + status + '</span>';
  }

  function categoryBadge(cat) {
    var colors = {
      general: 'rgba(139,139,146,0.15);color:var(--text-secondary)',
      devops: 'rgba(34,211,238,0.1);color:var(--cyan)',
      monitoring: 'rgba(251,191,36,0.15);color:#fbbf24',
      security: 'rgba(255,107,43,0.1);color:var(--orange)',
      database: 'rgba(167,139,250,0.15);color:#a78bfa',
      deployment: 'rgba(52,211,153,0.15);color:#34d399',
    };
    return '<span class="badge" style="font-size:9px;background:' + (colors[cat] || colors.general) + '">' + cat + '</span>';
  }

  function timeAgo(iso) {
    if (!iso) return 'never';
    var diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  Views.flows = {
    init: function () {
      var container = document.getElementById('view-flows');
      if (!container) return;

      container.innerHTML =
        // Stats row
        '<div id="flow-stats-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px"></div>' +
        // Tabs + actions row
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
          '<div id="flow-tabs" style="display:flex;gap:4px">' +
            '<button class="btn btn-sm flow-tab active" data-tab="all" onclick="Views.flows.switchTab(\'all\')">All</button>' +
            '<button class="btn btn-sm flow-tab" data-tab="active" onclick="Views.flows.switchTab(\'active\')">Active</button>' +
            '<button class="btn btn-sm flow-tab" data-tab="draft" onclick="Views.flows.switchTab(\'draft\')">Drafts</button>' +
            '<button class="btn btn-sm flow-tab" data-tab="templates" onclick="Views.flows.switchTab(\'templates\')">Templates</button>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<select id="flow-category-filter" class="form-input" style="font-size:12px;width:auto;padding:4px 8px" onchange="Views.flows.loadFlows()">' +
              '<option value="">All Categories</option>' +
              '<option value="general">General</option>' +
              '<option value="devops">DevOps</option>' +
              '<option value="monitoring">Monitoring</option>' +
              '<option value="security">Security</option>' +
              '<option value="database">Database</option>' +
              '<option value="deployment">Deployment</option>' +
            '</select>' +
            '<button class="btn btn-sm btn-cyan" onclick="Views.flows.showCreateFlow()">+ New Flow</button>' +
          '</div>' +
        '</div>' +
        // Content area: card grid or detail
        '<div id="flow-content"></div>' +
        // Detail panel (hidden by default)
        '<div id="flow-detail-panel" style="display:none"></div>';
    },

    show: function () {
      this.loadStats();
      this.loadFlows();
    },

    hide: function () {},

    // ── Stats ─────────────────────────────────────────────────────
    loadStats: function () {
      var row = document.getElementById('flow-stats-row');
      if (!row) return;

      fetch('/api/flows/stats').then(safeJson).then(function (data) {
        row.innerHTML =
          statCard('Total Flows', data.total, 'var(--cyan)') +
          statCard('Active', data.active, '#34d399') +
          statCard('Drafts', data.drafts, 'var(--text-secondary)') +
          statCard('Total Runs', data.totalRuns, '#a78bfa');
      }).catch(function () {
        row.innerHTML = statCard('Total Flows', 0, 'var(--cyan)') +
          statCard('Active', 0, '#34d399') +
          statCard('Drafts', 0, 'var(--text-secondary)') +
          statCard('Total Runs', 0, '#a78bfa');
      });
    },

    // ── Tabs ──────────────────────────────────────────────────────
    switchTab: function (tab) {
      currentTab = tab;
      var tabs = document.querySelectorAll('.flow-tab');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
        tabs[i].style.background = tabs[i].getAttribute('data-tab') === tab ? 'var(--cyan)' : '';
        tabs[i].style.color = tabs[i].getAttribute('data-tab') === tab ? '#000' : '';
      }
      if (tab === 'templates') {
        this.loadTemplates();
      } else {
        this.loadFlows();
      }
    },

    // ── Load Flows ────────────────────────────────────────────────
    loadFlows: function () {
      var content = document.getElementById('flow-content');
      var detail = document.getElementById('flow-detail-panel');
      if (!content) return;
      if (detail) detail.style.display = 'none';

      var catFilter = document.getElementById('flow-category-filter');
      var category = catFilter ? catFilter.value : '';
      var statusFilter = '';
      if (currentTab === 'active') statusFilter = 'active';
      else if (currentTab === 'draft') statusFilter = 'draft';

      var url = '/api/flows?';
      if (category) url += 'category=' + category + '&';
      if (statusFilter) url += 'status=' + statusFilter + '&';

      fetch(url).then(safeJson).then(function (data) {
        if (!data.flows || !data.flows.length) {
          // Show templates instead of empty state
          Views.flows._loadTemplatesInline(content);
          return;
        }

        content.innerHTML =
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">' +
            data.flows.map(function (f) {
              return '<div class="card" style="cursor:pointer;transition:border-color 0.15s" onclick="Views.flows.selectFlow(\'' + f.id + '\')" onmouseover="this.style.borderColor=\'var(--cyan)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                '<div style="padding:16px">' +
                  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
                    '<span style="font-weight:600;font-size:14px;color:var(--text-primary)">' + escapeHtml(f.name) + '</span>' +
                    statusBadge(f.status) +
                  '</div>' +
                  '<div style="font-size:11px;color:var(--text-secondary);line-height:1.4;margin-bottom:10px;min-height:30px">' + escapeHtml(f.description || 'No description').substring(0, 120) + '</div>' +
                  '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
                    categoryBadge(f.category) +
                    '<span class="badge" style="font-size:9px">' + f.node_count + ' nodes</span>' +
                    '<span class="badge" style="font-size:9px">' + f.trigger_type + '</span>' +
                  '</div>' +
                  '<div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--text-tertiary)">' +
                    '<span>v' + f.version + ' &middot; ' + (f.run_count || 0) + ' runs</span>' +
                    '<span>' + timeAgo(f.updated_at) + '</span>' +
                  '</div>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>';
      }).catch(function (err) {
        content.innerHTML = '<div style="padding:20px;color:var(--orange)">' + escapeHtml(err.message) + '</div>';
      });
    },

    // ── Load Templates Inline (when 0 user flows) ─────────────────
    _loadTemplatesInline: function (container) {
      fetch('/api/flows/templates').then(safeJson).then(function (data) {
        if (!data.templates || !data.templates.length) {
          container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">' +
            '<div style="font-size:14px;margin-bottom:8px">No flows found</div>' +
            '<div style="font-size:12px">Create a new flow to get started.</div>' +
          '</div>';
          return;
        }

        container.innerHTML =
          '<div style="padding:20px 0">' +
            '<div style="text-align:center;margin-bottom:20px">' +
              '<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:4px">Get started with a template</div>' +
              '<div style="font-size:12px;color:var(--text-tertiary)">Choose a template below to create your first flow, or click "New Flow" to start from scratch.</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">' +
              data.templates.map(function (t) {
                return '<div class="card" style="cursor:pointer;transition:border-color 0.15s" onclick="Views.flows.createFromTemplate(\'' + t.id + '\',\'' + escapeHtml(t.name) + '\')" onmouseover="this.style.borderColor=\'var(--cyan)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                  '<div style="padding:16px">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
                      '<span style="font-weight:600;font-size:14px;color:var(--text-primary)">' + escapeHtml(t.name) + '</span>' +
                      '<span class="badge" style="font-size:9px;background:rgba(34,211,238,0.1);color:var(--cyan)">template</span>' +
                    '</div>' +
                    '<div style="font-size:11px;color:var(--text-secondary);line-height:1.4;margin-bottom:10px;min-height:30px">' + escapeHtml(t.description).substring(0, 140) + '</div>' +
                    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' +
                      categoryBadge(t.category) +
                      '<span class="badge" style="font-size:9px">' + t.node_count + ' nodes</span>' +
                      '<span class="badge" style="font-size:9px">' + t.trigger_type + '</span>' +
                    '</div>' +
                    '<button class="btn btn-sm btn-cyan" style="width:100%" onclick="event.stopPropagation();Views.flows.createFromTemplate(\'' + t.id + '\',\'' + escapeHtml(t.name) + '\')">Use Template</button>' +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>';
      }).catch(function () {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">' +
          '<div style="font-size:14px;margin-bottom:8px">No flows found</div>' +
          '<div style="font-size:12px">Create a new flow to get started.</div>' +
        '</div>';
      });
    },

    // ── Load Templates ────────────────────────────────────────────
    loadTemplates: function () {
      var content = document.getElementById('flow-content');
      if (!content) return;

      fetch('/api/flows/templates').then(safeJson).then(function (data) {
        if (!data.templates || !data.templates.length) {
          content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">No templates available</div>';
          return;
        }

        content.innerHTML =
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">' +
            data.templates.map(function (t) {
              return '<div class="card" style="cursor:pointer;transition:border-color 0.15s" onclick="Views.flows.createFromTemplate(\'' + t.id + '\',\'' + escapeHtml(t.name) + '\')" onmouseover="this.style.borderColor=\'var(--cyan)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                '<div style="padding:16px">' +
                  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
                    '<span style="font-weight:600;font-size:14px;color:var(--text-primary)">' + escapeHtml(t.name) + '</span>' +
                    '<span class="badge" style="font-size:9px;background:rgba(34,211,238,0.1);color:var(--cyan)">template</span>' +
                  '</div>' +
                  '<div style="font-size:11px;color:var(--text-secondary);line-height:1.4;margin-bottom:10px;min-height:30px">' + escapeHtml(t.description).substring(0, 140) + '</div>' +
                  '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' +
                    categoryBadge(t.category) +
                    '<span class="badge" style="font-size:9px">' + t.node_count + ' nodes</span>' +
                    '<span class="badge" style="font-size:9px">' + t.trigger_type + '</span>' +
                  '</div>' +
                  '<button class="btn btn-sm btn-cyan" style="width:100%" onclick="event.stopPropagation();Views.flows.createFromTemplate(\'' + t.id + '\',\'' + escapeHtml(t.name) + '\')">Use Template</button>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>';
      }).catch(function (err) {
        content.innerHTML = '<div style="padding:20px;color:var(--orange)">' + escapeHtml(err.message) + '</div>';
      });
    },

    // ── Select Flow (Detail View) ─────────────────────────────────
    selectFlow: function (id) {
      var content = document.getElementById('flow-content');
      var detail = document.getElementById('flow-detail-panel');
      if (!content || !detail) return;

      fetch('/api/flows/' + id).then(safeJson).then(function (data) {
        if (!data.flow) return;
        currentFlow = data.flow;
        content.style.display = 'none';
        detail.style.display = 'block';
        detailTab = 'config';
        renderDetailPanel();
      }).catch(function (err) {
        Toast.error('Failed to load flow: ' + err.message);
      });
    },

    // ── Back to List ──────────────────────────────────────────────
    backToList: function () {
      var content = document.getElementById('flow-content');
      var detail = document.getElementById('flow-detail-panel');
      if (content) content.style.display = '';
      if (detail) detail.style.display = 'none';
      currentFlow = null;
      this.loadStats();
      this.loadFlows();
    },

    // ── Detail Tabs ───────────────────────────────────────────────
    switchDetailTab: function (tab) {
      detailTab = tab;
      renderDetailPanel();
    },

    // ── Create Flow ───────────────────────────────────────────────
    showCreateFlow: function () {
      Modal.open({
        title: 'Create New Flow',
        body:
          '<div style="display:flex;flex-direction:column;gap:12px">' +
            '<div><label class="form-label">Name</label><input id="new-flow-name" class="form-input" placeholder="My Workflow"></div>' +
            '<div><label class="form-label">Description</label><textarea id="new-flow-desc" class="form-input" rows="3" placeholder="What does this flow do?"></textarea></div>' +
            '<div style="display:flex;gap:12px">' +
              '<div style="flex:1"><label class="form-label">Category</label><select id="new-flow-cat" class="form-input">' +
                '<option value="general">General</option><option value="devops">DevOps</option><option value="monitoring">Monitoring</option>' +
                '<option value="security">Security</option><option value="database">Database</option><option value="deployment">Deployment</option>' +
              '</select></div>' +
              '<div style="flex:1"><label class="form-label">Trigger</label><select id="new-flow-trigger" class="form-input">' +
                '<option value="manual">Manual</option><option value="schedule">Schedule</option><option value="webhook">Webhook</option><option value="event">Event</option>' +
              '</select></div>' +
            '</div>' +
            '<div><label class="form-label">Error Strategy</label><select id="new-flow-err" class="form-input">' +
              '<option value="stop">Stop on Error</option><option value="skip">Skip Failed Nodes</option><option value="retry">Retry Failed Nodes</option>' +
            '</select></div>' +
            // LLM Assignment section
            '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">' +
              '<label class="form-label" style="color:#22c55e">LLM Assignment</label>' +
              '<div><label class="form-label" style="font-size:11px">Mode</label><select id="new-flow-llm-mode" class="form-input" onchange="Views.flows._toggleCreateLlmFields()">' +
                '<option value="inherit">Inherit global default</option>' +
                '<option value="provider_default">Use provider default</option>' +
                '<option value="pin">Pin provider + model</option>' +
              '</select></div>' +
              '<div id="new-flow-llm-provider-wrap" style="display:none;margin-top:8px"><label class="form-label" style="font-size:11px">Provider</label><select id="new-flow-llm-provider" class="form-input">' +
                '<option value="ollama">Ollama</option><option value="claude_api">Claude API</option><option value="claude_cli">Claude CLI</option><option value="codex_cli">Codex CLI</option><option value="gemini_cli">Gemini CLI</option>' +
              '</select></div>' +
              '<div id="new-flow-llm-model-wrap" style="display:none;margin-top:8px"><label class="form-label" style="font-size:11px">Model</label><input id="new-flow-llm-model" class="form-input" placeholder="e.g., qwen3:8b"></div>' +
            '</div>' +
          '</div>',
        footer:
          '<button class="btn" onclick="Modal.close()">Cancel</button>' +
          '<button class="btn btn-cyan" onclick="Views.flows.createFlow()">Create</button>',
        size: 'lg',
      });
    },

    _toggleEditLlmFields: function () {
      var mode = document.getElementById('flow-edit-llm-mode');
      var provWrap = document.getElementById('flow-edit-llm-provider-wrap');
      var modelWrap = document.getElementById('flow-edit-llm-model-wrap');
      if (!mode) return;
      var show = mode.value === 'provider_default' || mode.value === 'pin';
      if (provWrap) provWrap.style.display = show ? '' : 'none';
      if (modelWrap) modelWrap.style.display = mode.value === 'pin' ? '' : 'none';
    },

    _toggleCreateLlmFields: function () {
      var mode = document.getElementById('new-flow-llm-mode');
      var provWrap = document.getElementById('new-flow-llm-provider-wrap');
      var modelWrap = document.getElementById('new-flow-llm-model-wrap');
      if (!mode) return;
      var show = mode.value === 'provider_default' || mode.value === 'pin';
      if (provWrap) provWrap.style.display = show ? '' : 'none';
      if (modelWrap) modelWrap.style.display = mode.value === 'pin' ? '' : 'none';
    },

    createFlow: function () {
      var name = document.getElementById('new-flow-name');
      var desc = document.getElementById('new-flow-desc');
      var cat = document.getElementById('new-flow-cat');
      var trigger = document.getElementById('new-flow-trigger');
      var err = document.getElementById('new-flow-err');

      // Read LLM assignment
      var llmMode = document.getElementById('new-flow-llm-mode');
      var llmProvider = document.getElementById('new-flow-llm-provider');
      var llmModel = document.getElementById('new-flow-llm-model');
      var aiMeta = {
        mode: llmMode ? llmMode.value : 'inherit',
        provider: llmProvider ? llmProvider.value : '',
        model: llmModel ? llmModel.value.trim() : '',
      };

      if (!name || !name.value.trim()) { Toast.warning('Flow name is required'); return; }

      fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.value.trim(),
          description: desc ? desc.value.trim() : '',
          category: cat ? cat.value : 'general',
          trigger_type: trigger ? trigger.value : 'manual',
          error_strategy: err ? err.value : 'stop',
          metadata: { ai: aiMeta },
          nodes: [
            { id: generateId(), type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {} },
            { id: generateId(), type: 'end', label: 'End', position: { x: 0, y: 1 }, config: {} },
          ],
          edges: [],
        }),
      })
        .then(safeJson)
        .then(function (data) {
          Modal.close();
          Toast.success('Flow created: ' + data.flow.name);
          Views.flows.loadStats();
          Views.flows.selectFlow(data.flow.id);
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    },

    // ── Create from Template ──────────────────────────────────────
    createFromTemplate: function (templateId, templateName) {
      fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templateId }),
      })
        .then(safeJson)
        .then(function (data) {
          if (data.flow && data.flow.id) {
            Toast.success('Flow created from template: ' + templateName);
            Views.flows.loadStats();
            Views.flows.selectFlow(data.flow.id);
          } else {
            Toast.error('Failed to create flow');
            Views.flows.switchTab('all');
          }
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    },

    // ── Execute Flow ──────────────────────────────────────────────
    executeFlow: function () {
      if (!currentFlow) return;

      fetch('/api/flows/' + currentFlow.id + '/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then(safeJson)
        .then(function (data) {
          Toast.success('Flow execution started');
          if (data.run) {
            // Switch to history tab to show progress
            detailTab = 'history';
            renderDetailPanel();
          }
        })
        .catch(function (err) { Toast.error('Execution error: ' + err.message); });
    },

    // ── Clone Flow ────────────────────────────────────────────────
    cloneFlow: function () {
      if (!currentFlow) return;

      fetch('/api/flows/' + currentFlow.id + '/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then(safeJson)
        .then(function (data) {
          Toast.success('Flow cloned');
          Views.flows.selectFlow(data.flow.id);
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    },

    // ── Delete Flow ───────────────────────────────────────────────
    deleteFlow: function () {
      if (!currentFlow) return;

      Modal.confirm({
        title: 'Delete Flow',
        message: 'Are you sure you want to delete "' + escapeHtml(currentFlow.name) + '"? This cannot be undone.',
        confirmText: 'Delete',
        dangerous: true,
      }).then(function (confirmed) {
        if (!confirmed) return;
        fetch('/api/flows/' + currentFlow.id, { method: 'DELETE' })
          .then(safeJson)
          .then(function () {
            Toast.success('Flow deleted');
            Views.flows.backToList();
          })
          .catch(function (err) { Toast.error('Error: ' + err.message); });
      });
    },

    // ── Save Flow Config ──────────────────────────────────────────
    saveFlowConfig: function () {
      if (!currentFlow) return;

      var name = document.getElementById('flow-edit-name');
      var desc = document.getElementById('flow-edit-desc');
      var cat = document.getElementById('flow-edit-cat');
      var status = document.getElementById('flow-edit-status');
      var trigger = document.getElementById('flow-edit-trigger');
      var errStrategy = document.getElementById('flow-edit-err');
      var timeout = document.getElementById('flow-edit-timeout');

      var llmMode = document.getElementById('flow-edit-llm-mode');
      var llmProvider = document.getElementById('flow-edit-llm-provider');
      var llmModel = document.getElementById('flow-edit-llm-model');

      var patch = {};
      if (name) patch.name = name.value.trim();
      if (desc) patch.description = desc.value.trim();
      if (cat) patch.category = cat.value;
      if (status) patch.status = status.value;
      if (trigger) patch.trigger_type = trigger.value;
      if (errStrategy) patch.error_strategy = errStrategy.value;
      if (timeout) patch.timeout_ms = parseInt(timeout.value) || 300000;
      patch.metadata = { ai: {
        mode: llmMode ? llmMode.value : 'inherit',
        provider: llmProvider ? llmProvider.value : '',
        model: llmModel ? llmModel.value.trim() : '',
      } };

      fetch('/api/flows/' + currentFlow.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
        .then(safeJson)
        .then(function (data) {
          currentFlow = data.flow;
          Toast.success('Flow saved');
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    },

    // ── Add Node ──────────────────────────────────────────────────
    addNode: function () {
      if (!currentFlow) return;

      Modal.open({
        title: 'Add Node',
        body:
          '<div style="display:flex;flex-direction:column;gap:12px">' +
            '<div><label class="form-label">Type</label><select id="add-node-type" class="form-input" onchange="Views.flows.updateNodeConfigFields()">' +
              '<option value="llm">LLM</option><option value="agent">Agent</option><option value="condition">Condition</option>' +
              '<option value="delay">Delay</option><option value="http">HTTP</option><option value="notify">Notify</option>' +
            '</select></div>' +
            '<div><label class="form-label">Label</label><input id="add-node-label" class="form-input" placeholder="Node name"></div>' +
            '<div id="add-node-config-fields"></div>' +
            '<div><label class="form-label">Connect after node</label><select id="add-node-after" class="form-input">' +
              currentFlow.nodes.filter(function (n) { return n.type !== 'end'; }).map(function (n) {
                return '<option value="' + n.id + '">' + escapeHtml(n.label || n.type) + ' (' + n.type + ')</option>';
              }).join('') +
            '</select></div>' +
          '</div>',
        footer:
          '<button class="btn" onclick="Modal.close()">Cancel</button>' +
          '<button class="btn btn-cyan" onclick="Views.flows.doAddNode()">Add</button>',
        size: 'lg',
      });
      this.updateNodeConfigFields();
    },

    updateNodeConfigFields: function () {
      var type = document.getElementById('add-node-type');
      var container = document.getElementById('add-node-config-fields');
      if (!type || !container) return;

      var fields = '';
      switch (type.value) {
        case 'llm':
          fields = '<div><label class="form-label">Prompt</label><textarea id="add-node-prompt" class="form-input" rows="3" placeholder="Analyze the data and provide insights..."></textarea></div>' +
                   '<div><label class="form-label">System Prompt (optional)</label><input id="add-node-sys" class="form-input" placeholder="You are a helpful assistant..."></div>';
          break;
        case 'agent':
          fields = '<div><label class="form-label">Agent Slug</label><input id="add-node-agent" class="form-input" placeholder="e.g. server-hardener"></div>' +
                   '<div><label class="form-label">Input (optional)</label><textarea id="add-node-input" class="form-input" rows="2" placeholder="Custom input for the agent"></textarea></div>';
          break;
        case 'condition':
          fields = '<div><label class="form-label">Expression</label><input id="add-node-expr" class="form-input" placeholder="nodeId.status === \'ok\'"></div>' +
                   '<div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">Supported: path == value, path != value, path > num, path < num, exists(path), true, false</div>';
          break;
        case 'delay':
          fields = '<div><label class="form-label">Delay (ms)</label><input id="add-node-delay" class="form-input" type="number" value="5000" min="100" max="300000"></div>';
          break;
        case 'http':
          fields = '<div><label class="form-label">URL</label><input id="add-node-url" class="form-input" placeholder="https://api.example.com/endpoint"></div>' +
                   '<div style="display:flex;gap:8px"><div style="flex:1"><label class="form-label">Method</label><select id="add-node-method" class="form-input"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select></div>' +
                   '<div style="flex:1"><label class="form-label">Timeout (ms)</label><input id="add-node-timeout" class="form-input" type="number" value="30000"></div></div>';
          break;
        case 'notify':
          fields = '<div><label class="form-label">Message</label><textarea id="add-node-msg" class="form-input" rows="2" placeholder="Notification message. Use {{nodeId.field}} for variables."></textarea></div>' +
                   '<div><label class="form-label">Channel</label><select id="add-node-channel" class="form-input"><option value="internal">Internal</option><option value="email">Email</option><option value="webhook">Webhook</option></select></div>';
          break;
      }
      container.innerHTML = fields;
    },

    doAddNode: function () {
      if (!currentFlow) return;
      var type = document.getElementById('add-node-type');
      var label = document.getElementById('add-node-label');
      var afterNode = document.getElementById('add-node-after');
      if (!type) return;

      var nodeId = generateId();
      var config = {};

      switch (type.value) {
        case 'llm':
          var p = document.getElementById('add-node-prompt');
          var s = document.getElementById('add-node-sys');
          config.prompt = p ? p.value : '';
          config.systemPrompt = s ? s.value : '';
          break;
        case 'agent':
          var ag = document.getElementById('add-node-agent');
          var inp = document.getElementById('add-node-input');
          config.agentSlug = ag ? ag.value : '';
          config.input = inp ? inp.value : '';
          break;
        case 'condition':
          var ex = document.getElementById('add-node-expr');
          config.expression = ex ? ex.value : 'true';
          break;
        case 'delay':
          var dl = document.getElementById('add-node-delay');
          config.delayMs = dl ? parseInt(dl.value) || 5000 : 5000;
          break;
        case 'http':
          var u = document.getElementById('add-node-url');
          var m = document.getElementById('add-node-method');
          var t = document.getElementById('add-node-timeout');
          config.url = u ? u.value : '';
          config.method = m ? m.value : 'GET';
          config.timeout = t ? parseInt(t.value) || 30000 : 30000;
          break;
        case 'notify':
          var msg = document.getElementById('add-node-msg');
          var ch = document.getElementById('add-node-channel');
          config.message = msg ? msg.value : '';
          config.channel = ch ? ch.value : 'internal';
          break;
      }

      var node = {
        id: nodeId,
        type: type.value,
        label: label && label.value.trim() ? label.value.trim() : NODE_TYPE_META[type.value].label,
        position: { x: 0, y: currentFlow.nodes.length },
        config: config,
      };

      var nodes = currentFlow.nodes.slice();
      var edges = currentFlow.edges.slice();

      // Insert before end node if possible
      var endIdx = -1;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].type === 'end') { endIdx = i; break; }
      }
      if (endIdx !== -1) {
        nodes.splice(endIdx, 0, node);
      } else {
        nodes.push(node);
      }

      // Add edge from selected "after" node
      if (afterNode && afterNode.value) {
        // Remove existing edge from afterNode to any target that the new node should precede
        var afterId = afterNode.value;
        edges.push({ source: afterId, target: nodeId, label: '' });

        // If there's an end node and afterNode pointed to end, re-route
        if (endIdx !== -1) {
          var endNode = currentFlow.nodes[endIdx];
          // Check if afterNode -> end edge exists
          var endEdgeIdx = -1;
          for (var j = 0; j < edges.length; j++) {
            if (edges[j].source === afterId && edges[j].target === endNode.id) {
              endEdgeIdx = j;
              break;
            }
          }
          if (endEdgeIdx !== -1) {
            edges.splice(endEdgeIdx, 1);
          }
          // Connect new node to end
          edges.push({ source: nodeId, target: endNode.id, label: '' });
        }
      }

      // Save
      fetch('/api/flows/' + currentFlow.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: nodes, edges: edges }),
      })
        .then(safeJson)
        .then(function (data) {
          currentFlow = data.flow;
          Modal.close();
          Toast.success('Node added');
          renderDetailPanel();
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    },

    // ── Remove Node ───────────────────────────────────────────────
    removeNode: function (nodeId) {
      if (!currentFlow) return;
      var node = currentFlow.nodes.find(function (n) { return n.id === nodeId; });
      if (!node) return;
      if (node.type === 'start' || node.type === 'end') {
        Toast.warning('Cannot remove start or end nodes');
        return;
      }

      var nodes = currentFlow.nodes.filter(function (n) { return n.id !== nodeId; });
      // Remove all edges involving this node and reconnect
      var inEdges = currentFlow.edges.filter(function (e) { return e.target === nodeId; });
      var outEdges = currentFlow.edges.filter(function (e) { return e.source === nodeId; });
      var otherEdges = currentFlow.edges.filter(function (e) { return e.source !== nodeId && e.target !== nodeId; });

      // Reconnect: each source -> each target
      var newEdges = otherEdges.slice();
      for (var i = 0; i < inEdges.length; i++) {
        for (var j = 0; j < outEdges.length; j++) {
          newEdges.push({ source: inEdges[i].source, target: outEdges[j].target, label: '' });
        }
      }

      fetch('/api/flows/' + currentFlow.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: nodes, edges: newEdges }),
      })
        .then(safeJson)
        .then(function (data) {
          currentFlow = data.flow;
          Toast.success('Node removed');
          renderDetailPanel();
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    },

    // ── Edit Node (agent/llm) ────────────────────────────────────
    editNode: function (nodeId) {
      if (!currentFlow) return;
      var node = currentFlow.nodes.find(function (n) { return n.id === nodeId; });
      if (!node) return;

      var ai = (node.config && node.config.ai) || {};
      var curMode = ai.mode || 'inherit';
      var curProvider = ai.provider || 'ollama';
      var curModel = ai.model || '';
      var showProv = curMode === 'provider_default' || curMode === 'pin';
      var showModel = curMode === 'pin';

      Modal.open({
        title: 'Edit Node: ' + escapeHtml(node.label || node.type),
        body:
          '<div style="display:flex;flex-direction:column;gap:12px">' +
            '<div><label class="form-label">Label</label><input id="edit-node-label" class="form-input" value="' + escapeHtml(node.label || '') + '"></div>' +
            '<details style="border:1px solid var(--border);border-radius:6px;padding:8px 12px">' +
              '<summary style="cursor:pointer;font-size:12px;font-weight:600;color:#22c55e">LLM Override</summary>' +
              '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">' +
                '<div><label class="form-label" style="font-size:11px">Mode</label><select id="edit-node-llm-mode" class="form-input" onchange="Views.flows._toggleNodeLlmFields()">' +
                  '<option value="inherit"' + (curMode === 'inherit' ? ' selected' : '') + '>Inherit flow default</option>' +
                  '<option value="provider_default"' + (curMode === 'provider_default' ? ' selected' : '') + '>Use provider default</option>' +
                  '<option value="pin"' + (curMode === 'pin' ? ' selected' : '') + '>Pin provider + model</option>' +
                '</select></div>' +
                '<div id="edit-node-llm-provider-wrap" style="' + (showProv ? '' : 'display:none') + '"><label class="form-label" style="font-size:11px">Provider</label><select id="edit-node-llm-provider" class="form-input">' +
                  '<option value="ollama"' + (curProvider === 'ollama' ? ' selected' : '') + '>Ollama</option>' +
                  '<option value="claude_api"' + (curProvider === 'claude_api' ? ' selected' : '') + '>Claude API</option>' +
                  '<option value="claude_cli"' + (curProvider === 'claude_cli' ? ' selected' : '') + '>Claude CLI</option>' +
                  '<option value="codex_cli"' + (curProvider === 'codex_cli' ? ' selected' : '') + '>Codex CLI</option>' +
                  '<option value="gemini_cli"' + (curProvider === 'gemini_cli' ? ' selected' : '') + '>Gemini CLI</option>' +
                '</select></div>' +
                '<div id="edit-node-llm-model-wrap" style="' + (showModel ? '' : 'display:none') + '"><label class="form-label" style="font-size:11px">Model</label><input id="edit-node-llm-model" class="form-input" placeholder="e.g., qwen3:8b" value="' + escapeHtml(curModel) + '"></div>' +
              '</div>' +
            '</details>' +
          '</div>',
        footer:
          '<button class="btn" onclick="Modal.close()">Cancel</button>' +
          '<button class="btn btn-cyan" onclick="Views.flows.saveNodeEdit(\'' + nodeId + '\')">Save</button>',
        size: 'lg',
      });
    },

    _toggleNodeLlmFields: function () {
      var mode = document.getElementById('edit-node-llm-mode');
      var provWrap = document.getElementById('edit-node-llm-provider-wrap');
      var modelWrap = document.getElementById('edit-node-llm-model-wrap');
      if (!mode) return;
      var show = mode.value === 'provider_default' || mode.value === 'pin';
      if (provWrap) provWrap.style.display = show ? '' : 'none';
      if (modelWrap) modelWrap.style.display = mode.value === 'pin' ? '' : 'none';
    },

    saveNodeEdit: function (nodeId) {
      if (!currentFlow) return;
      var nodes = currentFlow.nodes.slice();
      var nodeIdx = -1;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nodeId) { nodeIdx = i; break; }
      }
      if (nodeIdx === -1) return;

      var node = JSON.parse(JSON.stringify(nodes[nodeIdx]));
      var label = document.getElementById('edit-node-label');
      if (label && label.value.trim()) node.label = label.value.trim();

      var llmMode = document.getElementById('edit-node-llm-mode');
      var llmProvider = document.getElementById('edit-node-llm-provider');
      var llmModel = document.getElementById('edit-node-llm-model');

      node.config = node.config || {};
      node.config.ai = {
        mode: llmMode ? llmMode.value : 'inherit',
        provider: llmProvider ? llmProvider.value : '',
        model: llmModel ? llmModel.value.trim() : '',
      };

      nodes[nodeIdx] = node;

      fetch('/api/flows/' + currentFlow.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: nodes, edges: currentFlow.edges }),
      })
        .then(safeJson)
        .then(function (data) {
          currentFlow = data.flow;
          Modal.close();
          Toast.success('Node updated');
          renderDetailPanel();
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    },

    // ── Load Runs (History) ───────────────────────────────────────
    loadRuns: function () {
      if (!currentFlow) return;
      var container = document.getElementById('flow-history-content');
      if (!container) return;

      fetch('/api/flows/' + currentFlow.id + '/runs?limit=20')
        .then(safeJson)
        .then(function (data) {
          if (!data.runs || !data.runs.length) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No runs yet. Execute the flow to see history.</div>';
            return;
          }

          container.innerHTML =
            '<table style="width:100%;font-size:12px;border-collapse:collapse">' +
              '<thead><tr style="color:var(--text-secondary);border-bottom:1px solid var(--border)">' +
                '<th style="padding:8px;text-align:left">Status</th>' +
                '<th style="padding:8px;text-align:left">Trigger</th>' +
                '<th style="padding:8px;text-align:left">User</th>' +
                '<th style="padding:8px;text-align:left">Progress</th>' +
                '<th style="padding:8px;text-align:left">Started</th>' +
                '<th style="padding:8px;text-align:left">Duration</th>' +
                '<th style="padding:8px;text-align:left">Error</th>' +
              '</tr></thead>' +
              '<tbody>' +
                data.runs.map(function (r) {
                  var duration = '';
                  if (r.started_at && r.completed_at) {
                    var ms = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime();
                    duration = ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
                  } else if (r.status === 'running') {
                    duration = 'running...';
                  }
                  return '<tr style="border-bottom:1px solid var(--border)">' +
                    '<td style="padding:8px">' + statusBadge(r.status) + '</td>' +
                    '<td style="padding:8px;color:var(--text-secondary)">' + (r.trigger || 'manual') + '</td>' +
                    '<td style="padding:8px;color:var(--text-secondary)">' + escapeHtml(r.user_id || '') + '</td>' +
                    '<td style="padding:8px;color:var(--text-secondary)">' + (r.completed_nodes || 0) + '/' + (r.total_nodes || 0) + '</td>' +
                    '<td style="padding:8px;color:var(--text-secondary)">' + timeAgo(r.started_at) + '</td>' +
                    '<td style="padding:8px;color:var(--text-secondary)">' + duration + '</td>' +
                    '<td style="padding:8px;color:var(--orange);font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(r.error || '') + '</td>' +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>';
        })
        .catch(function (err) {
          container.innerHTML = '<div style="color:var(--orange)">' + escapeHtml(err.message) + '</div>';
        });
    },
  };

  // ── Render Detail Panel ────────────────────────────────────────────
  function renderDetailPanel() {
    var panel = document.getElementById('flow-detail-panel');
    if (!panel || !currentFlow) return;

    var f = currentFlow;
    var tabBtnStyle = function (t) {
      return 'style="padding:6px 16px;font-size:12px;border:none;cursor:pointer;border-bottom:2px solid ' +
        (detailTab === t ? 'var(--cyan)' : 'transparent') + ';color:' +
        (detailTab === t ? 'var(--cyan)' : 'var(--text-secondary)') + ';background:transparent"';
    };

    var headerHtml =
      '<div class="card" style="margin-bottom:12px">' +
        '<div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.flows.backToList()" title="Back">&larr; Back</button>' +
            '<div>' +
              '<div style="font-weight:600;font-size:16px;color:var(--text-primary)">' + escapeHtml(f.name) + '</div>' +
              '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' +
                statusBadge(f.status) + ' ' + categoryBadge(f.category) +
                ' <span style="margin-left:8px">v' + f.version + ' &middot; ' + f.nodes.length + ' nodes &middot; ' + (f.run_count || 0) + ' runs</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-sm" onclick="Views.flows.cloneFlow()">Clone</button>' +
            '<button class="btn btn-sm btn-cyan" onclick="Views.flows.executeFlow()">Execute</button>' +
            '<button class="btn btn-sm" style="color:var(--orange)" onclick="Views.flows.deleteFlow()">Delete</button>' +
          '</div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border);display:flex">' +
          '<button ' + tabBtnStyle('config') + ' onclick="Views.flows.switchDetailTab(\'config\')">Config</button>' +
          '<button ' + tabBtnStyle('builder') + ' onclick="Views.flows.switchDetailTab(\'builder\')">Builder</button>' +
          '<button ' + tabBtnStyle('history') + ' onclick="Views.flows.switchDetailTab(\'history\')">History</button>' +
        '</div>' +
      '</div>';

    var bodyHtml = '';
    if (detailTab === 'config') {
      bodyHtml = renderConfigTab(f);
    } else if (detailTab === 'builder') {
      bodyHtml = renderBuilderTab(f);
    } else if (detailTab === 'history') {
      bodyHtml = '<div class="card"><div style="padding:16px"><div id="flow-history-content"><div style="text-align:center;color:var(--text-tertiary);padding:20px">Loading runs...</div></div></div></div>';
    }

    panel.innerHTML = headerHtml + bodyHtml;

    if (detailTab === 'history') {
      Views.flows.loadRuns();
    }
  }

  function renderConfigTab(f) {
    var selectOpt = function (options, current) {
      return options.map(function (o) {
        var val = typeof o === 'string' ? o : o.value;
        var lbl = typeof o === 'string' ? o.charAt(0).toUpperCase() + o.slice(1) : o.label;
        return '<option value="' + val + '"' + (val === current ? ' selected' : '') + '>' + lbl + '</option>';
      }).join('');
    };

    return '<div class="card"><div style="padding:16px;display:flex;flex-direction:column;gap:12px">' +
      '<div><label class="form-label">Name</label><input id="flow-edit-name" class="form-input" value="' + escapeHtml(f.name) + '"></div>' +
      '<div><label class="form-label">Description</label><textarea id="flow-edit-desc" class="form-input" rows="3">' + escapeHtml(f.description || '') + '</textarea></div>' +
      '<div style="display:flex;gap:12px">' +
        '<div style="flex:1"><label class="form-label">Category</label><select id="flow-edit-cat" class="form-input">' +
          selectOpt(['general', 'devops', 'monitoring', 'security', 'database', 'deployment'], f.category) +
        '</select></div>' +
        '<div style="flex:1"><label class="form-label">Status</label><select id="flow-edit-status" class="form-input">' +
          selectOpt(['draft', 'active', 'paused', 'archived'], f.status) +
        '</select></div>' +
      '</div>' +
      '<div style="display:flex;gap:12px">' +
        '<div style="flex:1"><label class="form-label">Trigger Type</label><select id="flow-edit-trigger" class="form-input">' +
          selectOpt(['manual', 'schedule', 'webhook', 'event'], f.trigger_type) +
        '</select></div>' +
        '<div style="flex:1"><label class="form-label">Error Strategy</label><select id="flow-edit-err" class="form-input">' +
          selectOpt([{ value: 'stop', label: 'Stop on Error' }, { value: 'skip', label: 'Skip Failed' }, { value: 'retry', label: 'Retry (3x)' }], f.error_strategy) +
        '</select></div>' +
      '</div>' +
      '<div><label class="form-label">Timeout (ms)</label><input id="flow-edit-timeout" class="form-input" type="number" value="' + (f.timeout_ms || 300000) + '"></div>' +
      // LLM Assignment section
      (function () {
        var ai = (f.metadata && f.metadata.ai) || {};
        var curMode = ai.mode || 'inherit';
        var curProvider = ai.provider || 'ollama';
        var curModel = ai.model || '';
        var showProv = curMode === 'provider_default' || curMode === 'pin';
        var showModel = curMode === 'pin';
        return '<div style="border-left:3px solid #22c55e;padding-left:12px;margin-top:4px">' +
          '<label class="form-label" style="color:#22c55e">LLM Assignment</label>' +
          '<div><label class="form-label" style="font-size:11px">Mode</label><select id="flow-edit-llm-mode" class="form-input" onchange="Views.flows._toggleEditLlmFields()">' +
            '<option value="inherit"' + (curMode === 'inherit' ? ' selected' : '') + '>Inherit global default</option>' +
            '<option value="provider_default"' + (curMode === 'provider_default' ? ' selected' : '') + '>Use provider default</option>' +
            '<option value="pin"' + (curMode === 'pin' ? ' selected' : '') + '>Pin provider + model</option>' +
          '</select></div>' +
          '<div id="flow-edit-llm-provider-wrap" style="' + (showProv ? '' : 'display:none;') + 'margin-top:8px"><label class="form-label" style="font-size:11px">Provider</label><select id="flow-edit-llm-provider" class="form-input">' +
            '<option value="ollama"' + (curProvider === 'ollama' ? ' selected' : '') + '>Ollama</option>' +
            '<option value="claude_api"' + (curProvider === 'claude_api' ? ' selected' : '') + '>Claude API</option>' +
            '<option value="claude_cli"' + (curProvider === 'claude_cli' ? ' selected' : '') + '>Claude CLI</option>' +
            '<option value="codex_cli"' + (curProvider === 'codex_cli' ? ' selected' : '') + '>Codex CLI</option>' +
            '<option value="gemini_cli"' + (curProvider === 'gemini_cli' ? ' selected' : '') + '>Gemini CLI</option>' +
          '</select></div>' +
          '<div id="flow-edit-llm-model-wrap" style="' + (showModel ? '' : 'display:none;') + 'margin-top:8px"><label class="form-label" style="font-size:11px">Model</label><input id="flow-edit-llm-model" class="form-input" placeholder="e.g., qwen3:8b" value="' + escapeHtml(curModel) + '"></div>' +
        '</div>';
      })() +
      '<div style="display:flex;justify-content:flex-end;gap:8px;padding-top:8px;border-top:1px solid var(--border)">' +
        '<button class="btn btn-cyan" onclick="Views.flows.saveFlowConfig()">Save Changes</button>' +
      '</div>' +
    '</div></div>';
  }

  function renderBuilderTab(f) {
    var nodesHtml = f.nodes.map(function (node, idx) {
      var meta = NODE_TYPE_META[node.type] || { icon: '?', color: 'var(--text-secondary)', label: node.type };

      // Find outgoing edges
      var outgoing = f.edges.filter(function (e) { return e.source === node.id; });
      var outLabels = outgoing.map(function (e) {
        var targetNode = f.nodes.find(function (n) { return n.id === e.target; });
        var targetLabel = targetNode ? (targetNode.label || targetNode.type) : e.target;
        var edgeLabel = e.label ? ' [' + e.label + ']' : '';
        return escapeHtml(targetLabel) + edgeLabel;
      });

      var canRemove = node.type !== 'start' && node.type !== 'end';
      var configSummary = getNodeConfigSummary(node);

      return '<div style="display:flex;align-items:stretch;gap:0;margin-bottom:0">' +
        // Node card
        '<div style="flex:1;border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface);display:flex;align-items:center;gap:12px">' +
          '<div style="width:36px;height:36px;border-radius:8px;background:' + meta.color + '22;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;color:' + meta.color + '">' + meta.icon + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<span style="font-weight:600;font-size:13px;color:var(--text-primary)">' + escapeHtml(node.label || meta.label) + '</span>' +
              '<span class="badge" style="font-size:9px;background:' + meta.color + '22;color:' + meta.color + '">' + node.type + '</span>' +
            '</div>' +
            (configSummary ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(configSummary) + '</div>' : '') +
            (outLabels.length > 0 ? '<div style="font-size:10px;color:var(--text-secondary);margin-top:3px">\u2192 ' + outLabels.join(', ') + '</div>' : '') +
          '</div>' +
          ((node.type === 'agent' || node.type === 'llm') ? '<button class="btn btn-sm" style="flex-shrink:0;margin-right:4px" onclick="event.stopPropagation();Views.flows.editNode(\'' + node.id + '\')" title="Edit node">&#9998;</button>' : '') +
          (canRemove ? '<button class="btn btn-sm" style="color:var(--orange);flex-shrink:0" onclick="event.stopPropagation();Views.flows.removeNode(\'' + node.id + '\')" title="Remove node">\u2715</button>' : '') +
        '</div>' +
      '</div>' +
      // Connector line (unless last node)
      (idx < f.nodes.length - 1 ? '<div style="display:flex;justify-content:center;padding:2px 0"><div style="width:2px;height:16px;background:var(--border)"></div></div>' : '');
    }).join('');

    return '<div class="card"><div style="padding:16px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
        '<span style="font-weight:600;font-size:13px;color:var(--text-primary)">Flow DAG</span>' +
        '<button class="btn btn-sm btn-cyan" onclick="Views.flows.addNode()">+ Add Node</button>' +
      '</div>' +
      '<div style="max-height:500px;overflow-y:auto">' +
        nodesHtml +
      '</div>' +
    '</div></div>';
  }

  function getNodeConfigSummary(node) {
    var c = node.config || {};
    switch (node.type) {
      case 'llm': return c.prompt ? c.prompt.substring(0, 80) : '';
      case 'agent': return c.agentSlug || c.agent_slug || '';
      case 'condition': return c.expression || c.condition || '';
      case 'delay': return (c.delayMs || c.delay_ms || 0) + 'ms';
      case 'http': return (c.method || 'GET') + ' ' + (c.url || '');
      case 'notify': return c.message ? c.message.substring(0, 80) : '';
      default: return '';
    }
  }

  // ── Stat Card Helper ──────────────────────────────────────────────
  function statCard(label, value, color) {
    return '<div class="card" style="padding:16px;text-align:center">' +
      '<div style="font-size:24px;font-weight:700;color:' + color + '">' + (value || 0) + '</div>' +
      '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">' + label + '</div>' +
    '</div>';
  }

  function generateId() {
    return Math.random().toString(36).substring(2, 10);
  }
})();
