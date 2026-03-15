/**
 * Bulwark — AI Agents Command Center
 * Vigil-style agent catalog with stats, category filters, agent cards, and detail panel.
 */
(function () {
  'use strict';

  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function safeFetch(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { try { return JSON.parse(t); } catch(e) { throw new Error('HTTP ' + r.status + ': ' + (t || '').substring(0, 100)); } });
      return r.json();
    });
  }

  var currentAgent = null;
  var allAgents = [];
  var allCategories = [];
  var activeCategory = 'all';
  var activeDetailTab = 'config';
  var runHistory = [];
  var stats = { totalAgents: 0, totalRuns: 0, byCategory: {} };
  var editMode = false;

  // ── Icons ─────────────────────────────────────────────────────
  var IC = {
    agent: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
    run: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    scanner: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    devops: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    sysadmin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    cloud: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    database: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    security: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    monitoring: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    networking: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    git: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><line x1="12" y1="12" x2="12" y2="15"/></svg>',
    custom: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  };

  var CATEGORY_COLORS = {
    devops: { bg: 'rgba(34,211,238,0.1)', fg: 'var(--cyan)' },
    sysadmin: { bg: 'rgba(139,139,146,0.15)', fg: 'var(--text-secondary)' },
    cloud: { bg: 'rgba(96,165,250,0.15)', fg: '#60a5fa' },
    database: { bg: 'rgba(167,139,250,0.15)', fg: '#a78bfa' },
    security: { bg: 'rgba(255,107,43,0.1)', fg: 'var(--orange)' },
    git: { bg: 'rgba(52,211,153,0.15)', fg: '#34d399' },
    monitoring: { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24' },
    networking: { bg: 'rgba(244,114,182,0.15)', fg: '#f472b6' },
    custom: { bg: 'rgba(34,211,238,0.08)', fg: 'var(--cyan)' },
  };

  var CATEGORY_TABS = ['all', 'devops', 'sysadmin', 'cloud', 'database', 'security', 'monitoring', 'networking', 'custom'];

  // ── View Entry Points ─────────────────────────────────────────
  Views.agents = {
    init: function () {
      var el = document.getElementById('view-agents');
      if (!el) return;
      el.innerHTML = buildLayout();
    },

    show: function () {
      this.init();
      loadStats();
      loadAgents();
    },

    hide: function () {
      currentAgent = null;
    },

    update: function () {},
  };

  // ── Layout ────────────────────────────────────────────────────
  function buildLayout() {
    return '' +
      // Stats grid
      '<div id="agents-stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' +
        statCard('stat-total-agents', 'Total Agents', IC.agent, '--cyan') +
        statCard('stat-categories', 'Categories', IC.scanner, '--text-secondary') +
        statCard('stat-total-runs', 'Total Runs', IC.run, '--orange') +
        statCard('stat-recent', 'Recent (24h)', IC.clock, '#34d399') +
      '</div>' +
      // Tab bar
      '<div style="display:flex;align-items:center;gap:0;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:0">' +
        '<div id="agents-tab-bar" style="display:flex;gap:0;flex:1;overflow-x:auto">' +
          CATEGORY_TABS.map(function (t) {
            return '<button class="agents-cat-tab' + (t === 'all' ? ' active' : '') + '" data-cat="' + t + '" onclick="Views.agents.filterCategory(\'' + t + '\')" style="padding:8px 14px;font-size:12px;font-weight:500;background:none;border:none;border-bottom:2px solid transparent;color:var(--text-tertiary);cursor:pointer;white-space:nowrap;transition:all 0.15s">' +
              capitalize(t) +
            '</button>';
          }).join('') +
        '</div>' +
        '<button class="btn btn-sm btn-cyan" onclick="Views.agents.showCreateAgent()" style="margin-left:12px;flex-shrink:0">' + IC.plus + ' New Agent</button>' +
      '</div>' +
      // Main content: card grid + detail panel
      '<div style="display:flex;gap:16px;min-height:0">' +
        // Agent cards grid
        '<div id="agents-card-grid" style="flex:1;min-width:0">' +
          '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">Loading agents...</div>' +
        '</div>' +
        // Detail panel (hidden by default)
        '<div id="agents-detail-panel" style="width:420px;flex-shrink:0;display:none">' +
        '</div>' +
      '</div>';
  }

  function statCard(id, label, icon, color) {
    return '<div class="card" style="padding:16px;text-align:center">' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;color:var(' + color + ')">' +
        icon +
        '<span style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px">' + label + '</span>' +
      '</div>' +
      '<div id="' + id + '" style="font-size:24px;font-weight:700;color:var(--text-primary)">0</div>' +
    '</div>';
  }

  // ── Stats ─────────────────────────────────────────────────────
  function loadStats() {
    safeFetch('/api/agents/stats').then(function (data) {
      stats = data;
      animateStat('stat-total-agents', data.totalAgents || 0);
      animateStat('stat-categories', data.categoryCount || 0);
      animateStat('stat-total-runs', data.totalRuns || 0);
      animateStat('stat-recent', data.recentActivity || 0);
    }).catch(function () {});
  }

  function animateStat(id, val) {
    var el = document.getElementById(id);
    if (el && window.animateValue) window.animateValue(el, val, 600);
    else if (el) el.textContent = val;
  }

  // ── Load & Render Agents ──────────────────────────────────────
  function loadAgents() {
    safeFetch('/api/agents').then(function (data) {
      allAgents = data.agents || [];
      allCategories = data.categories || [];
      renderCards();
    }).catch(function (err) {
      var grid = document.getElementById('agents-card-grid');
      if (grid) grid.innerHTML = '<div class="card" style="padding:24px;color:var(--orange)">' + escapeHtml(err.message) + '</div>';
    });
  }

  Views.agents.filterCategory = function (cat) {
    activeCategory = cat;
    // Update tab styles
    document.querySelectorAll('.agents-cat-tab').forEach(function (btn) {
      var isActive = btn.getAttribute('data-cat') === cat;
      btn.classList.toggle('active', isActive);
      btn.style.color = isActive ? 'var(--cyan)' : 'var(--text-tertiary)';
      btn.style.borderBottomColor = isActive ? 'var(--cyan)' : 'transparent';
    });
    renderCards();
  };

  function renderCards() {
    var grid = document.getElementById('agents-card-grid');
    if (!grid) return;

    var filtered = allAgents;
    if (activeCategory === 'custom') {
      filtered = allAgents.filter(function (a) { return a.custom; });
    } else if (activeCategory !== 'all') {
      filtered = allAgents.filter(function (a) { return a.category === activeCategory; });
    }

    if (!filtered.length) {
      grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">' +
        '<div style="font-size:14px;margin-bottom:4px">No agents in this category</div>' +
        '<div style="font-size:12px">Try selecting a different filter or create a custom agent.</div>' +
      '</div>';
      return;
    }

    grid.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">' +
      filtered.map(function (a) { return buildAgentCard(a); }).join('') +
    '</div>';
  }

  function buildAgentCard(a) {
    var cc = CATEGORY_COLORS[a.category] || CATEGORY_COLORS.custom;
    var catIcon = IC[a.category] || IC.agent;
    var riskColors = { low: 'rgba(52,211,153,0.15);color:#34d399', medium: 'rgba(251,191,36,0.15);color:#fbbf24', high: 'rgba(255,107,43,0.15);color:var(--orange)' };
    var riskStyle = riskColors[a.risk_level] || riskColors.low;
    var desc = escapeHtml(a.description || '');
    if (desc.length > 100) desc = desc.substring(0, 100) + '...';
    var isSelected = currentAgent && currentAgent.slug === a.slug;

    return '<div class="card agent-card" onclick="Views.agents.selectAgent(\'' + escapeHtml(a.slug) + '\')" ' +
      'style="padding:16px;cursor:pointer;transition:all 0.15s;border:1px solid ' + (isSelected ? 'var(--cyan)' : 'var(--border)') + ';' +
      (isSelected ? 'box-shadow:0 0 12px rgba(34,211,238,0.1);' : '') + '" ' +
      'onmouseover="this.style.borderColor=\'var(--cyan)\';this.style.transform=\'translateY(-1px)\'" ' +
      'onmouseout="this.style.borderColor=\'' + (isSelected ? 'var(--cyan)' : 'var(--border)') + '\';this.style.transform=\'none\'">' +
      // Header: icon + name + badges
      '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">' +
        '<div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:' + cc.bg + ';color:' + cc.fg + ';flex-shrink:0">' +
          catIcon +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(a.name) + '</div>' +
          '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">' +
            '<span class="badge" style="font-size:9px;background:' + cc.bg + ';color:' + cc.fg + '">' + escapeHtml(a.category) + '</span>' +
            '<span class="badge" style="font-size:9px;background:' + riskStyle + '">' + escapeHtml(a.risk_level) + '</span>' +
            (a.custom ? '<span class="badge" style="font-size:9px;background:rgba(255,107,43,0.1);color:var(--orange)">custom</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      // Description
      '<div style="font-size:11px;color:var(--text-secondary);line-height:1.5;margin-bottom:12px;min-height:32px">' + desc + '</div>' +
      // Footer: run button
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<span style="font-size:10px;color:var(--text-tertiary)">' + IC.run + '</span>' +
        '<button class="btn btn-sm btn-cyan" onclick="event.stopPropagation();Views.agents.quickRun(\'' + escapeHtml(a.slug) + '\')" style="font-size:11px;padding:4px 10px">' +
          IC.run + ' Run Agent' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  // ── Quick Run (opens detail panel on Run tab) ─────────────────
  Views.agents.quickRun = function (slug) {
    Views.agents.selectAgent(slug, 'run');
  };

  // ── Select Agent & Show Detail Panel ──────────────────────────
  Views.agents.selectAgent = function (slug, openTab) {
    safeFetch('/api/agents/' + slug).then(function (data) {
      if (!data.agent) return;
      currentAgent = data.agent;
      activeDetailTab = openTab || 'config';
      renderCards(); // Re-render to show selection highlight
      renderDetailPanel();
      // Load history for this agent
      loadAgentHistory(currentAgent.id);
    }).catch(function (err) {
      Toast.error('Failed to load agent: ' + err.message);
    });
  };

  function renderDetailPanel() {
    var panel = document.getElementById('agents-detail-panel');
    if (!panel || !currentAgent) return;
    var a = currentAgent;
    var cc = CATEGORY_COLORS[a.category] || CATEGORY_COLORS.custom;
    var catIcon = IC[a.category] || IC.agent;

    panel.style.display = '';
    panel.innerHTML = '<div class="card" style="display:flex;flex-direction:column;height:calc(100vh - 260px);overflow:hidden">' +
      // Header
      '<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">' +
        '<div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:' + cc.bg + ';color:' + cc.fg + ';flex-shrink:0">' +
          catIcon +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:14px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(a.name) + '</div>' +
          '<div style="font-size:11px;color:var(--text-tertiary)">' + escapeHtml(a.category) + ' &middot; ' + escapeHtml(a.risk_level) + ' risk</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px">' +
          (editMode ?
            '<button class="btn btn-sm btn-cyan" style="padding:4px 10px;font-size:11px" onclick="Views.agents.saveAgent()">Save</button>' +
            '<button class="btn btn-sm" style="padding:4px 10px;font-size:11px" onclick="Views.agents.discardEdit()">Discard</button>'
          :
            '<button class="btn btn-sm" style="padding:4px 6px;color:var(--cyan)" onclick="Views.agents.enterEditMode()" title="Edit agent">' + IC.edit + '</button>'
          ) +
          (a.custom && !editMode ? '<button class="btn btn-sm" style="color:var(--orange);padding:4px 6px" onclick="Views.agents.deleteAgent(\'' + a.id + '\')" title="Delete agent">' + IC.trash + '</button>' : '') +
          '<button class="btn btn-sm" style="padding:4px 6px" onclick="Views.agents.closeDetail()" title="Close">' + IC.close + '</button>' +
        '</div>' +
      '</div>' +
      // Tabs
      '<div style="display:flex;border-bottom:1px solid var(--border)">' +
        detailTabBtn('config', 'Config') +
        detailTabBtn('run', 'Run') +
        detailTabBtn('history', 'History') +
      '</div>' +
      // Tab content
      '<div id="agent-detail-content" style="flex:1;overflow-y:auto;padding:0"></div>' +
    '</div>';

    renderDetailTab();
  }

  function detailTabBtn(id, label) {
    var isActive = id === activeDetailTab;
    return '<button class="agent-detail-tab" data-dtab="' + id + '" onclick="Views.agents.switchDetailTab(\'' + id + '\')" ' +
      'style="flex:1;padding:8px 12px;font-size:12px;font-weight:500;background:none;border:none;border-bottom:2px solid ' + (isActive ? 'var(--cyan)' : 'transparent') + ';color:' + (isActive ? 'var(--cyan)' : 'var(--text-tertiary)') + ';cursor:pointer;transition:all 0.15s">' +
      label +
    '</button>';
  }

  Views.agents.switchDetailTab = function (tab) {
    activeDetailTab = tab;
    document.querySelectorAll('.agent-detail-tab').forEach(function (btn) {
      var isActive = btn.getAttribute('data-dtab') === tab;
      btn.style.color = isActive ? 'var(--cyan)' : 'var(--text-tertiary)';
      btn.style.borderBottomColor = isActive ? 'var(--cyan)' : 'transparent';
    });
    renderDetailTab();
  };

  Views.agents.closeDetail = function () {
    currentAgent = null;
    editMode = false;
    var panel = document.getElementById('agents-detail-panel');
    if (panel) panel.style.display = 'none';
    renderCards();
  };

  function renderDetailTab() {
    var content = document.getElementById('agent-detail-content');
    if (!content || !currentAgent) return;

    if (activeDetailTab === 'config') renderConfigTab(content);
    else if (activeDetailTab === 'run') renderRunTab(content);
    else if (activeDetailTab === 'history') renderHistoryTab(content);
  }

  // ── Config Tab ────────────────────────────────────────────────
  function renderConfigTab(el) {
    var a = currentAgent;
    if (editMode) {
      renderConfigTabEdit(el, a);
    } else {
      renderConfigTabReadOnly(el, a);
    }
  }

  function renderConfigTabReadOnly(el, a) {
    el.innerHTML = '<div style="padding:16px;display:flex;flex-direction:column;gap:14px">' +
      // Identity section
      configSection('Identity', '' +
        configRow('Name', escapeHtml(a.name)) +
        configRow('Slug', '<code style="font-size:11px;color:var(--cyan);background:rgba(34,211,238,0.08);padding:2px 6px;border-radius:4px">' + escapeHtml(a.slug) + '</code>') +
        configRow('Category', escapeHtml(a.category)) +
        configRow('Risk Level', escapeHtml(a.risk_level)) +
        configRow('Type', a.custom ? '<span style="color:var(--orange)">Custom</span>' : '<span style="color:var(--text-secondary)">Built-in</span>')
      ) +
      // Description
      configSection('Description', '<div style="font-size:12px;color:var(--text-secondary);line-height:1.5">' + escapeHtml(a.description || 'No description') + '</div>') +
      // System Prompt
      configSection('System Prompt', '<pre style="font-size:11px;color:var(--text-secondary);line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;background:rgba(0,0,0,0.2);padding:10px;border-radius:6px;border:1px solid var(--border);margin:0">' + escapeHtml(a.system_prompt || 'Default system prompt') + '</pre>') +
      // Task Prompt
      configSection('Task Prompt', '<pre style="font-size:11px;color:var(--text-secondary);line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow-y:auto;background:rgba(0,0,0,0.2);padding:10px;border-radius:6px;border:1px solid var(--border);margin:0">' + escapeHtml(a.task_prompt || '{{input}}') + '</pre>') +
      // Behavior
      configSection('Behavior', '' +
        configRow('Model Profile', escapeHtml(a.model_profile || 'auto')) +
        configRow('ID', '<code style="font-size:10px;color:var(--text-tertiary)">' + escapeHtml(a.id) + '</code>')
      ) +
      // LLM Assignment
      (function () {
        var ai = (a.config && a.config.ai) || {};
        var mode = ai.mode || 'inherit';
        var modeLabel = mode === 'pinned' ? 'Pin provider + model' : mode === 'provider' ? 'Use provider default' : 'Inherit global default';
        var rows = '<div style="border-left:3px solid #22c55e;padding-left:10px">' +
          configRow('Mode', '<span style="color:#22c55e">' + escapeHtml(modeLabel) + '</span>');
        if (mode === 'provider' || mode === 'pinned') {
          rows += configRow('Provider', escapeHtml(ai.provider || 'ollama'));
        }
        if (mode === 'pinned') {
          rows += configRow('Model', escapeHtml(ai.model || '(not set)'));
        }
        rows += '</div>';
        return '<div>' +
          '<div style="font-size:11px;font-weight:600;color:#22c55e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">LLM Assignment</div>' +
          rows +
        '</div>';
      })() +
    '</div>';
  }

  function renderConfigTabEdit(el, a) {
    var ai = (a.config && a.config.ai) || {};
    var curMode = ai.mode || 'inherit';
    var curProvider = ai.provider || 'ollama';
    var curModel = ai.model || '';
    var showProv = curMode === 'provider' || curMode === 'pinned';
    var showModel = curMode === 'pinned';

    var selectOpt = function (options, current) {
      return options.map(function (o) {
        var val = typeof o === 'string' ? o : o.value;
        var lbl = typeof o === 'string' ? o.charAt(0).toUpperCase() + o.slice(1) : o.label;
        return '<option value="' + val + '"' + (val === current ? ' selected' : '') + '>' + lbl + '</option>';
      }).join('');
    };

    el.innerHTML = '<div style="padding:16px;display:flex;flex-direction:column;gap:14px">' +
      (!a.custom ? '<div style="padding:8px 12px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);border-radius:6px;font-size:11px;color:#fbbf24">This is a built-in agent. Saving will create an editable clone.</div>' : '') +
      // Identity
      configSection('Identity', '' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<div><label class="form-label" style="font-size:11px">Name</label><input id="agent-edit-name" class="form-input" value="' + escapeHtml(a.name) + '"></div>' +
          '<div style="display:flex;gap:8px">' +
            '<div style="flex:1"><label class="form-label" style="font-size:11px">Category</label><select id="agent-edit-category" class="form-input">' +
              selectOpt(['devops', 'sysadmin', 'cloud', 'database', 'security', 'monitoring', 'networking'], a.category) +
            '</select></div>' +
            '<div style="flex:1"><label class="form-label" style="font-size:11px">Risk Level</label><select id="agent-edit-risk" class="form-input">' +
              selectOpt(['low', 'medium', 'high'], a.risk_level) +
            '</select></div>' +
          '</div>' +
        '</div>'
      ) +
      // Description
      configSection('Description', '<textarea id="agent-edit-desc" class="form-input" rows="3" style="font-size:12px">' + escapeHtml(a.description || '') + '</textarea>') +
      // System Prompt
      configSection('System Prompt', '<textarea id="agent-edit-sys" class="form-input" rows="6" style="font-size:11px;font-family:monospace">' + escapeHtml(a.system_prompt || '') + '</textarea>') +
      // Task Prompt
      configSection('Task Prompt', '<textarea id="agent-edit-task" class="form-input" rows="3" style="font-size:11px;font-family:monospace">' + escapeHtml(a.task_prompt || '{{input}}') + '</textarea>') +
      // LLM Assignment
      '<div>' +
        '<div style="font-size:11px;font-weight:600;color:#22c55e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">LLM Assignment</div>' +
        '<div style="border-left:3px solid #22c55e;padding-left:10px;display:flex;flex-direction:column;gap:8px">' +
          '<div><label class="form-label" style="font-size:11px">Mode</label><select id="agent-edit-llm-mode" class="form-input" onchange="Views.agents._toggleEditLlmFields()">' +
            '<option value="inherit"' + (curMode === 'inherit' ? ' selected' : '') + '>Inherit global default</option>' +
            '<option value="provider"' + (curMode === 'provider' ? ' selected' : '') + '>Use provider default</option>' +
            '<option value="pinned"' + (curMode === 'pinned' ? ' selected' : '') + '>Pin provider + model</option>' +
          '</select></div>' +
          '<div id="agent-edit-llm-provider-wrap" style="' + (showProv ? '' : 'display:none') + '"><label class="form-label" style="font-size:11px">Provider</label><select id="agent-edit-llm-provider" class="form-input">' +
            '<option value="ollama"' + (curProvider === 'ollama' ? ' selected' : '') + '>Ollama</option>' +
            '<option value="claude-api"' + (curProvider === 'claude-api' ? ' selected' : '') + '>Claude API</option>' +
            '<option value="claude-cli"' + (curProvider === 'claude-cli' ? ' selected' : '') + '>Claude CLI</option>' +
            '<option value="codex-cli"' + (curProvider === 'codex-cli' ? ' selected' : '') + '>Codex CLI</option>' +
            '<option value="gemini-cli"' + (curProvider === 'gemini-cli' ? ' selected' : '') + '>Gemini CLI</option>' +
          '</select></div>' +
          '<div id="agent-edit-llm-model-wrap" style="' + (showModel ? '' : 'display:none') + '"><label class="form-label" style="font-size:11px">Model</label><input id="agent-edit-llm-model" class="form-input" placeholder="e.g., qwen3:8b" value="' + escapeHtml(curModel) + '"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function configSection(title, body) {
    return '<div>' +
      '<div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">' + title + '</div>' +
      body +
    '</div>';
  }

  function configRow(label, value) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px">' +
      '<span style="color:var(--text-tertiary)">' + label + '</span>' +
      '<span style="color:var(--text-primary)">' + value + '</span>' +
    '</div>';
  }

  // ── Run Tab ───────────────────────────────────────────────────
  function renderRunTab(el) {
    el.innerHTML = '<div style="padding:16px;display:flex;flex-direction:column;gap:12px;height:100%">' +
      '<label style="font-size:12px;font-weight:500;color:var(--text-secondary)">Input for agent</label>' +
      '<textarea id="agent-run-input" class="form-input" rows="6" style="width:100%;font-size:12px;resize:vertical;flex-shrink:0" placeholder="Paste your Dockerfile, server config, database settings, or describe what you need..."></textarea>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<button id="agent-run-btn" class="btn btn-cyan" onclick="Views.agents.runAgent()" style="flex-shrink:0">' + IC.run + ' Run Agent</button>' +
        '<span style="font-size:11px;color:var(--text-tertiary)">Agent will analyze your input</span>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;min-height:100px">' +
        '<div id="agent-run-output" style="font-size:13px;color:var(--text-secondary)">Output will appear here after running.</div>' +
      '</div>' +
    '</div>';
  }

  Views.agents.runAgent = function () {
    if (!currentAgent) return;
    var input = document.getElementById('agent-run-input');
    var output = document.getElementById('agent-run-output');
    var btn = document.getElementById('agent-run-btn');
    if (!input || !output) return;

    var text = input.value.trim();
    if (!text) { Toast.warning('Please provide input for the agent'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading-dots">Running</span>';
    output.innerHTML = '<div style="color:var(--cyan);font-size:12px"><span class="loading-dots">Analyzing input</span></div>';

    fetch('/api/agents/' + currentAgent.slug + '/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text }),
    })
      .then(function (r) { if (!r.ok) return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error('HTTP ' + r.status); } }); return r.json(); })
      .then(function (data) {
        btn.disabled = false;
        btn.innerHTML = IC.run + ' Run Agent';

        if (data.blocked) {
          output.innerHTML = '<div style="padding:12px;background:rgba(255,107,43,0.1);border:1px solid rgba(255,107,43,0.2);border-radius:8px;color:var(--orange)">' +
            '<div style="font-weight:600;margin-bottom:4px">Blocked by Guardrails</div>' +
            '<div style="font-size:12px">' + escapeHtml(data.output) + '</div>' +
          '</div>';
          return;
        }

        if (data.error) {
          output.innerHTML = '<div style="padding:12px;background:rgba(255,107,43,0.05);border:1px solid rgba(255,107,43,0.15);border-radius:8px;color:var(--orange)">' +
            escapeHtml(data.error) +
          '</div>';
          return;
        }

        var html = typeof marked !== 'undefined' ? marked.parse(data.output) : '<pre style="white-space:pre-wrap;font-size:12px">' + escapeHtml(data.output) + '</pre>';

        output.innerHTML =
          '<div class="agent-output-content" style="margin-bottom:12px;line-height:1.6">' + html + '</div>' +
          '<div style="display:flex;gap:12px;font-size:10px;color:var(--text-tertiary);padding-top:8px;border-top:1px solid var(--border);flex-wrap:wrap">' +
            '<span>Provider: <span style="color:var(--cyan)">' + escapeHtml(data.provider || 'unknown') + '</span></span>' +
            '<span>Model: <span style="color:var(--cyan)">' + escapeHtml(data.model || 'unknown') + '</span></span>' +
            '<span>Duration: <span style="color:var(--cyan)">' + (data.durationMs ? (data.durationMs / 1000).toFixed(1) + 's' : 'n/a') + '</span></span>' +
          '</div>';

        // Refresh stats and history
        loadStats();
        if (currentAgent) loadAgentHistory(currentAgent.id);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = IC.run + ' Run Agent';
        output.innerHTML = '<div style="padding:12px;color:var(--orange)">Error: ' + escapeHtml(err.message) + '</div>';
      });
  };

  // ── History Tab ───────────────────────────────────────────────
  function loadAgentHistory(agentId) {
    fetch('/api/agents/runs/history?agentId=' + encodeURIComponent(agentId) + '&limit=20')
      .then(function (r) { if (!r.ok) return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error('HTTP ' + r.status); } }); return r.json(); })
      .then(function (data) {
        runHistory = data.runs || [];
        if (activeDetailTab === 'history') {
          var content = document.getElementById('agent-detail-content');
          if (content) renderHistoryTab(content);
        }
      })
      .catch(function () { runHistory = []; });
  }

  function renderHistoryTab(el) {
    if (!runHistory.length) {
      el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-tertiary)">' +
        '<div style="font-size:13px;margin-bottom:4px">No runs yet</div>' +
        '<div style="font-size:11px">Run this agent to see history here.</div>' +
      '</div>';
      return;
    }

    el.innerHTML = '<div style="padding:12px">' +
      '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
        '<thead><tr style="border-bottom:1px solid var(--border)">' +
          '<th style="text-align:left;padding:6px 8px;color:var(--text-tertiary);font-weight:500">Time</th>' +
          '<th style="text-align:left;padding:6px 8px;color:var(--text-tertiary);font-weight:500">Status</th>' +
          '<th style="text-align:right;padding:6px 8px;color:var(--text-tertiary);font-weight:500">Duration</th>' +
          '<th style="text-align:left;padding:6px 8px;color:var(--text-tertiary);font-weight:500">Input</th>' +
        '</tr></thead>' +
        '<tbody>' +
          runHistory.map(function (r) {
            var statusColor = r.status === 'completed' ? '#34d399' : 'var(--orange)';
            var statusBg = r.status === 'completed' ? 'rgba(52,211,153,0.1)' : 'rgba(255,107,43,0.1)';
            var dur = r.duration_ms ? (r.duration_ms / 1000).toFixed(1) + 's' : '-';
            var inputPreview = escapeHtml((r.input || '').substring(0, 40));
            if ((r.input || '').length > 40) inputPreview += '...';
            var timeStr = r.created_at ? formatTimeAgo(r.created_at) : '-';

            return '<tr style="border-bottom:1px solid var(--border);cursor:pointer" ' +
              'onmouseover="this.style.background=\'rgba(255,255,255,0.02)\'" onmouseout="this.style.background=\'transparent\'" ' +
              'onclick="Views.agents.viewRun(\'' + r.id + '\')">' +
              '<td style="padding:8px;color:var(--text-secondary);white-space:nowrap">' + timeStr + '</td>' +
              '<td style="padding:8px"><span class="badge" style="font-size:9px;background:' + statusBg + ';color:' + statusColor + '">' + escapeHtml(r.status) + '</span></td>' +
              '<td style="padding:8px;text-align:right;color:var(--text-secondary)">' + dur + '</td>' +
              '<td style="padding:8px;color:var(--text-tertiary);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + inputPreview + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table>' +
    '</div>';
  }

  Views.agents.viewRun = function (runId) {
    safeFetch('/api/agents/runs/' + runId).then(function (data) {
      if (!data.run) return;
      var r = data.run;
      var statusColor = r.status === 'completed' ? '#34d399' : 'var(--orange)';
      var html = '';
      if (r.output) {
        html = typeof marked !== 'undefined' ? marked.parse(r.output) : '<pre style="white-space:pre-wrap;font-size:12px">' + escapeHtml(r.output) + '</pre>';
      }

      Modal.open({
        title: 'Run Details — ' + escapeHtml(r.agent_name || 'Agent'),
        body:
          '<div style="display:flex;flex-direction:column;gap:12px">' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px">' +
              '<span>Status: <span style="color:' + statusColor + '">' + escapeHtml(r.status) + '</span></span>' +
              '<span>Duration: <span style="color:var(--cyan)">' + (r.duration_ms ? (r.duration_ms / 1000).toFixed(1) + 's' : '-') + '</span></span>' +
              '<span>Provider: <span style="color:var(--cyan)">' + escapeHtml(r.provider || '-') + '</span></span>' +
              '<span>Model: <span style="color:var(--cyan)">' + escapeHtml(r.model || '-') + '</span></span>' +
            '</div>' +
            '<div><label class="form-label">Input</label><pre style="font-size:11px;background:rgba(0,0,0,0.2);padding:10px;border-radius:6px;border:1px solid var(--border);white-space:pre-wrap;max-height:120px;overflow-y:auto;margin:0">' + escapeHtml(r.input || '') + '</pre></div>' +
            '<div><label class="form-label">Output</label><div class="agent-output-content" style="max-height:300px;overflow-y:auto;background:rgba(0,0,0,0.2);padding:12px;border-radius:6px;border:1px solid var(--border);font-size:12px;line-height:1.5">' + (html || '<span class="text-tertiary">No output</span>') + '</div></div>' +
          '</div>',
        footer: '<button class="btn" onclick="Modal.close()">Close</button>',
        size: 'lg',
      });
    }).catch(function (err) {
      Toast.error('Failed to load run: ' + err.message);
    });
  };

  // ── Create Agent ──────────────────────────────────────────────
  Views.agents.showCreateAgent = function () {
    Modal.open({
      title: 'Create Custom Agent',
      body:
        '<div style="display:flex;flex-direction:column;gap:12px">' +
          '<div><label class="form-label">Name</label><input id="new-agent-name" class="form-input" placeholder="My Custom Agent"></div>' +
          '<div><label class="form-label">Description</label><input id="new-agent-desc" class="form-input" placeholder="What does this agent do?"></div>' +
          '<div style="display:flex;gap:12px">' +
            '<div style="flex:1"><label class="form-label">Category</label><select id="new-agent-cat" class="form-input"><option value="devops">DevOps</option><option value="sysadmin">SysAdmin</option><option value="cloud">Cloud</option><option value="database">Database</option><option value="security">Security</option><option value="monitoring">Monitoring</option><option value="networking">Networking</option></select></div>' +
            '<div style="flex:1"><label class="form-label">Risk Level</label><select id="new-agent-risk" class="form-input"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>' +
          '</div>' +
          '<div><label class="form-label">System Prompt (agent personality)</label><textarea id="new-agent-sys" class="form-input" rows="4" placeholder="You are a specialist in..."></textarea></div>' +
          '<div><label class="form-label">Task Prompt (use {{input}} for user input)</label><textarea id="new-agent-task" class="form-input" rows="3" placeholder="Analyze the following:\n\n{{input}}"></textarea></div>' +
          // LLM Assignment section
          '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">' +
            '<div style="font-size:11px;font-weight:600;color:#22c55e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">LLM Assignment</div>' +
            '<div><label class="form-label">Mode</label><select id="new-agent-llm-mode" class="form-input" onchange="Views.agents._toggleLlmFields()">' +
              '<option value="inherit">Inherit global default</option>' +
              '<option value="provider">Use provider default</option>' +
              '<option value="pinned">Pin provider + model</option>' +
            '</select></div>' +
            '<div id="new-agent-llm-provider-wrap" style="display:none;margin-top:8px"><label class="form-label">Provider</label><select id="new-agent-llm-provider" class="form-input">' +
              '<option value="ollama">Ollama</option>' +
              '<option value="claude-api">Claude API</option>' +
              '<option value="claude-cli">Claude CLI</option>' +
              '<option value="codex-cli">Codex CLI</option>' +
              '<option value="gemini-cli">Gemini CLI</option>' +
            '</select></div>' +
            '<div id="new-agent-llm-model-wrap" style="display:none;margin-top:8px"><label class="form-label">Model</label><input id="new-agent-llm-model" class="form-input" placeholder="e.g., qwen3:8b"></div>' +
          '</div>' +
        '</div>',
      footer:
        '<button class="btn" onclick="Modal.close()">Cancel</button>' +
        '<button class="btn btn-cyan" onclick="Views.agents.createAgent()">Create Agent</button>',
      size: 'lg',
    });
  };

  Views.agents._toggleLlmFields = function () {
    var mode = document.getElementById('new-agent-llm-mode');
    var provWrap = document.getElementById('new-agent-llm-provider-wrap');
    var modelWrap = document.getElementById('new-agent-llm-model-wrap');
    if (!mode || !provWrap || !modelWrap) return;
    var v = mode.value;
    provWrap.style.display = (v === 'provider' || v === 'pinned') ? '' : 'none';
    modelWrap.style.display = (v === 'pinned') ? '' : 'none';
  };

  Views.agents.createAgent = function () {
    var name = document.getElementById('new-agent-name');
    var desc = document.getElementById('new-agent-desc');
    var cat = document.getElementById('new-agent-cat');
    var risk = document.getElementById('new-agent-risk');
    var sys = document.getElementById('new-agent-sys');
    var task = document.getElementById('new-agent-task');

    if (!name || !name.value.trim()) { Toast.warning('Name is required'); return; }
    if (!sys || !sys.value.trim()) { Toast.warning('System prompt is required'); return; }

    var llmMode = document.getElementById('new-agent-llm-mode');
    var llmProvider = document.getElementById('new-agent-llm-provider');
    var llmModel = document.getElementById('new-agent-llm-model');
    var aiConfig = { mode: llmMode ? llmMode.value : 'inherit' };
    if (aiConfig.mode === 'provider' || aiConfig.mode === 'pinned') {
      aiConfig.provider = llmProvider ? llmProvider.value : 'ollama';
    }
    if (aiConfig.mode === 'pinned') {
      aiConfig.model = llmModel ? llmModel.value.trim() : '';
    }

    fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(),
        description: desc ? desc.value.trim() : '',
        category: cat ? cat.value : 'devops',
        risk_level: risk ? risk.value : 'low',
        system_prompt: sys.value.trim(),
        task_prompt: task && task.value.trim() ? task.value.trim() : '{{input}}',
        config: { ai: aiConfig },
      }),
    })
      .then(function (r) { if (!r.ok) return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error('HTTP ' + r.status); } }); return r.json(); })
      .then(function (data) {
        Modal.close();
        Toast.success('Agent created: ' + data.agent.name);
        loadAgents();
        loadStats();
      })
      .catch(function (err) {
        Toast.error('Error: ' + err.message);
      });
  };

  // ── Edit Mode ───────────────────────────────────────────────
  Views.agents.enterEditMode = function () {
    if (!currentAgent) return;
    editMode = true;
    activeDetailTab = 'config';
    renderDetailPanel();
  };

  Views.agents.discardEdit = function () {
    editMode = false;
    renderDetailPanel();
  };

  Views.agents._toggleEditLlmFields = function () {
    var mode = document.getElementById('agent-edit-llm-mode');
    var provWrap = document.getElementById('agent-edit-llm-provider-wrap');
    var modelWrap = document.getElementById('agent-edit-llm-model-wrap');
    if (!mode || !provWrap || !modelWrap) return;
    var v = mode.value;
    provWrap.style.display = (v === 'provider' || v === 'pinned') ? '' : 'none';
    modelWrap.style.display = (v === 'pinned') ? '' : 'none';
  };

  Views.agents.saveAgent = function () {
    if (!currentAgent) return;

    var name = document.getElementById('agent-edit-name');
    var desc = document.getElementById('agent-edit-desc');
    var cat = document.getElementById('agent-edit-category');
    var risk = document.getElementById('agent-edit-risk');
    var sys = document.getElementById('agent-edit-sys');
    var task = document.getElementById('agent-edit-task');
    var llmMode = document.getElementById('agent-edit-llm-mode');
    var llmProvider = document.getElementById('agent-edit-llm-provider');
    var llmModel = document.getElementById('agent-edit-llm-model');

    var aiConfig = { mode: llmMode ? llmMode.value : 'inherit' };
    if (aiConfig.mode === 'provider' || aiConfig.mode === 'pinned') {
      aiConfig.provider = llmProvider ? llmProvider.value : 'ollama';
    }
    if (aiConfig.mode === 'pinned') {
      aiConfig.model = llmModel ? llmModel.value.trim() : '';
    }

    var payload = {
      name: name ? name.value.trim() : currentAgent.name,
      description: desc ? desc.value.trim() : '',
      category: cat ? cat.value : currentAgent.category,
      risk_level: risk ? risk.value : currentAgent.risk_level,
      system_prompt: sys ? sys.value.trim() : currentAgent.system_prompt,
      task_prompt: task ? task.value.trim() : currentAgent.task_prompt,
      config: { ai: aiConfig },
    };

    if (currentAgent.custom) {
      // PATCH existing custom agent
      fetch('/api/agents/' + currentAgent.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { if (!r.ok) return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error('HTTP ' + r.status); } }); return r.json(); })
        .then(function (data) {
          if (data.error) { Toast.error(data.error); return; }
          currentAgent = data.agent;
          editMode = false;
          Toast.success('Agent saved');
          renderDetailPanel();
          loadAgents();
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    } else {
      // Clone built-in agent as custom
      payload.system_prompt = payload.system_prompt || currentAgent.system_prompt;
      payload.task_prompt = payload.task_prompt || currentAgent.task_prompt || '{{input}}';
      fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { if (!r.ok) return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error('HTTP ' + r.status); } }); return r.json(); })
        .then(function (data) {
          if (data.error) { Toast.error(data.error); return; }
          currentAgent = data.agent;
          editMode = false;
          Toast.success('Custom clone created: ' + data.agent.name);
          renderDetailPanel();
          loadAgents();
          loadStats();
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    }
  };

  // ── Delete Agent ──────────────────────────────────────────────
  Views.agents.deleteAgent = function (id) {
    Modal.confirm({
      title: 'Delete Agent',
      message: 'Are you sure you want to delete this custom agent? This action cannot be undone.',
      confirmText: 'Delete',
      dangerous: true,
    }).then(function (confirmed) {
      if (!confirmed) return;
      fetch('/api/agents/' + id, { method: 'DELETE' })
        .then(function (r) { if (!r.ok) return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error('HTTP ' + r.status); } }); return r.json(); })
        .then(function () {
          Toast.success('Agent deleted');
          currentAgent = null;
          var panel = document.getElementById('agents-detail-panel');
          if (panel) panel.style.display = 'none';
          loadAgents();
          loadStats();
        })
        .catch(function (err) { Toast.error('Error: ' + err.message); });
    });
  };

  // ── Utilities ─────────────────────────────────────────────────
  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTimeAgo(iso) {
    try {
      var d = new Date(iso);
      var now = Date.now();
      var diff = Math.floor((now - d.getTime()) / 1000);
      if (diff < 60) return diff + 's ago';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    } catch (e) {
      return '-';
    }
  }
})();
