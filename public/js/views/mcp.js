// =============================================================================
// MCP Server — Interactive Tool Playground + Slash Commands + Prompt Actions
// =============================================================================
(function() {
  'use strict';

  var mcpInfo = null;
  var toolCache = null;      // { tools: [...] } from tools/list
  var resourceCache = null;
  var promptCache = null;
  var selectedTool = null;   // currently selected tool in playground
  var requestLog = [];       // session history
  var dropdownIdx = -1;      // keyboard nav index
  var dropdownItems = [];    // filtered items for command bar

  function esc(s) { return String(s || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  // ── Tool category mapping ──────────────────────────────────────────────────
  var CATEGORIES = {
    get_system_metrics: 'System', get_process_list: 'System',
    get_uptime_status: 'Uptime', add_uptime_endpoint: 'Uptime',
    list_docker_containers: 'Docker', get_container_logs: 'Docker', manage_container: 'Docker',
    list_database_tables: 'Database', query_database: 'Database',
    list_tickets: 'Tickets', create_ticket: 'Tickets',
    get_deploy_history: 'Deploy', get_deploy_preflight: 'Deploy',
    get_git_log: 'Git', get_git_diff: 'Git',
    get_security_score: 'Security',
    send_notification: 'Alerts', get_recent_alerts: 'Alerts'
  };

  function toolCategory(name) { return CATEGORIES[name] || 'Other'; }
  function toolSafety(schema) {
    var ann = schema && schema.annotations;
    if (ann && ann.destructiveHint) return 'destructive';
    if (ann && ann.readOnlyHint) return 'read';
    // Infer from name
    if (/^get_|^list_/.test(schema.name)) return 'read';
    if (/manage_|create_|send_|add_/.test(schema.name)) return 'write';
    return 'read';
  }

  // ── View registration ──────────────────────────────────────────────────────
  Views.mcp = {
    init: function() {
      var el = document.getElementById('view-mcp');
      if (!el) return;
      el.innerHTML = buildTemplate();
      bindCommandBar();
    },
    show: function() {
      this.init();
      fetchInfo();
      fetchTools();
      fetchResources();
      fetchPrompts();
    },
    hide: function() {
      dropdownIdx = -1;
      dropdownItems = [];
    },
    update: function() {}
  };

  // ── Data fetching ──────────────────────────────────────────────────────────
  function fetchInfo() {
    fetch('/api/mcp/info').then(function(r) { return r.json(); }).then(function(d) {
      mcpInfo = d; renderInfo();
    }).catch(function() { mcpInfo = null; renderInfo(); });
  }

  function fetchTools() {
    mcpCall('tools/list').then(function(d) {
      toolCache = d; renderToolGrid();
    });
  }

  function fetchResources() {
    mcpCall('resources/list').then(function(d) { resourceCache = d; });
  }

  function fetchPrompts() {
    mcpCall('prompts/list').then(function(d) { promptCache = d; renderPromptCards(); });
  }

  function mcpCall(method, params) {
    var body = { method: method };
    if (params) body.params = params;
    var t0 = Date.now();
    return fetch('/api/mcp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json(); }).then(function(data) {
      var ms = Date.now() - t0;
      addLogEntry(method, params, data, ms);
      return data;
    });
  }

  // ── Request log ────────────────────────────────────────────────────────────
  function addLogEntry(method, params, result, ms) {
    var entry = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      method: method,
      params: params || null,
      ok: !result.error,
      ms: ms
    };
    requestLog.unshift(entry);
    if (requestLog.length > 50) requestLog.pop();
    renderLog();
  }

  // ── Connection info panel ──────────────────────────────────────────────────
  function renderInfo() {
    var el = document.getElementById('mcp-info-panel');
    if (!el) return;
    if (!mcpInfo) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary)">Failed to load MCP info. Is the server running?</div>';
      return;
    }
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
        '<div style="width:10px;height:10px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan)"></div>' +
        '<span style="font-size:14px;font-weight:600;color:var(--text-primary)">MCP Endpoint Active</span>' +
        '<span style="color:var(--text-tertiary);font-size:12px;margin-left:auto">v' + esc(mcpInfo.version) + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<code style="flex:1;background:var(--well);padding:8px 12px;border-radius:8px;font-size:12px;color:var(--cyan);border:1px solid var(--border)">' + esc(mcpInfo.url) + '</code>' +
        '<button class="btn btn-sm" onclick="mcpCopy(\'url\')">Copy</button>' +
      '</div>' +
      '<div style="display:flex;gap:16px;font-size:12px;color:var(--text-secondary)">' +
        '<span>' + esc(mcpInfo.transport) + '</span>' +
        '<span style="color:var(--border)">|</span>' +
        '<button class="btn btn-sm" onclick="mcpCopy(\'desktop\')">Claude Desktop Config</button>' +
        '<button class="btn btn-sm" onclick="mcpCopy(\'code\')">Claude Code CMD</button>' +
        '<button class="btn btn-sm" onclick="mcpCopy(\'curl\')">curl</button>' +
      '</div>';
  }

  window.mcpCopy = function(type) {
    if (!mcpInfo) return;
    var text = '';
    if (type === 'url') text = mcpInfo.url;
    else if (type === 'desktop') text = JSON.stringify(mcpInfo.instructions.claudeDesktop.config, null, 2);
    else if (type === 'code') text = mcpInfo.instructions.claudeCode;
    else if (type === 'curl') text = mcpInfo.instructions.curl;
    navigator.clipboard.writeText(text).then(function() { Toast.success('Copied to clipboard'); });
  };

  // ── Prompt action cards ────────────────────────────────────────────────────
  function renderPromptCards() {
    var el = document.getElementById('mcp-prompt-cards');
    if (!el || !promptCache || !promptCache.prompts) return;
    var icons = { diagnose_server: '\u2764', incident_report: '\u26A0', security_audit: '\u1F6E1', daily_briefing: '\u2600' };
    var colors = { diagnose_server: 'var(--cyan)', incident_report: 'var(--orange)', security_audit: 'var(--cyan)', daily_briefing: 'var(--text-primary)' };
    var html = '';
    promptCache.prompts.forEach(function(p) {
      var hasArgs = p.arguments && p.arguments.length > 0;
      html += '<div class="glass-card" style="padding:16px;cursor:pointer;transition:border-color 0.2s" onclick="mcpRunPrompt(\'' + esc(p.name) + '\')" onmouseenter="this.style.borderColor=\'var(--cyan)\'" onmouseleave="this.style.borderColor=\'var(--border)\'">' +
        '<div style="font-size:13px;font-weight:600;color:' + (colors[p.name] || 'var(--text-primary)') + ';margin-bottom:4px">' + esc(p.name.replace(/_/g, ' ')) + '</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary);line-height:1.4">' + esc(p.description) + '</div>' +
        (hasArgs ? '<div style="font-size:10px;color:var(--orange);margin-top:6px">Requires: ' + p.arguments.map(function(a) { return a.name; }).join(', ') + '</div>' : '') +
      '</div>';
    });
    el.innerHTML = html;
  }

  window.mcpRunPrompt = function(name) {
    if (!promptCache) return;
    var prompt = promptCache.prompts.find(function(p) { return p.name === name; });
    if (!prompt) return;
    var hasArgs = prompt.arguments && prompt.arguments.length > 0;
    if (hasArgs) {
      // Show a modal for required args
      var fields = prompt.arguments.map(function(a) {
        return '<label style="display:block;margin-bottom:12px">' +
          '<span style="font-size:12px;color:var(--text-secondary)">' + esc(a.name) + (a.required ? ' *' : '') + '</span>' +
          '<input id="mcp-prompt-arg-' + esc(a.name) + '" style="display:block;width:100%;margin-top:4px;padding:8px 12px;background:var(--well);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px" placeholder="' + esc(a.description || a.name) + '">' +
        '</label>';
      }).join('');
      Modal.open({
        title: prompt.name.replace(/_/g, ' '),
        body: '<p style="color:var(--text-secondary);font-size:12px;margin-bottom:16px">' + esc(prompt.description) + '</p>' + fields,
        footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button> <button class="btn btn-sm btn-primary" onclick="mcpExecutePrompt(\'' + esc(name) + '\')">Run Prompt</button>'
      });
    } else {
      mcpCall('prompts/get', { name: name }).then(function(d) {
        showPlaygroundResult(d, 'prompts/get ' + name);
      });
    }
  };

  window.mcpExecutePrompt = function(name) {
    if (!promptCache) return;
    var prompt = promptCache.prompts.find(function(p) { return p.name === name; });
    if (!prompt) return;
    var args = {};
    (prompt.arguments || []).forEach(function(a) {
      var input = document.getElementById('mcp-prompt-arg-' + a.name);
      if (input) args[a.name] = input.value;
    });
    Modal.close();
    mcpCall('prompts/get', { name: name, arguments: args }).then(function(d) {
      showPlaygroundResult(d, 'prompts/get ' + name);
    });
  };

  // ── Tool grid (dynamic from tools/list) ────────────────────────────────────
  function renderToolGrid() {
    var el = document.getElementById('mcp-tool-grid');
    if (!el || !toolCache || !toolCache.tools) return;
    var groups = {};
    toolCache.tools.forEach(function(t) {
      var cat = toolCategory(t.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    var html = '';
    Object.keys(groups).forEach(function(cat) {
      html += '<div style="margin-bottom:16px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-tertiary);margin-bottom:8px;padding-left:4px">' + esc(cat) + '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px">';
      groups[cat].forEach(function(t) {
        var safety = toolSafety(t);
        var color = safety === 'read' ? 'var(--cyan)' : safety === 'destructive' ? 'var(--orange)' : 'var(--text-primary)';
        var badge = safety.toUpperCase();
        var paramCount = t.inputSchema && t.inputSchema.properties ? Object.keys(t.inputSchema.properties).length : 0;
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--well);border-radius:8px;border:1px solid var(--border);cursor:pointer;transition:border-color 0.15s" ' +
          'onclick="mcpSelectTool(\'' + esc(t.name) + '\')" ' +
          'onmouseenter="this.style.borderColor=\'rgba(34,211,238,0.3)\'" onmouseleave="this.style.borderColor=\'var(--border)\'">' +
          '<code style="font-size:12px;color:var(--text-primary);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(t.description) + '">' + esc(t.name) + '</code>' +
          (paramCount > 0 ? '<span style="font-size:10px;color:var(--text-tertiary)">' + paramCount + 'p</span>' : '') +
          '<span style="font-size:9px;color:' + color + ';text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap">' + badge + '</span>' +
        '</div>';
      });
      html += '</div></div>';
    });
    el.innerHTML = html;
  }

  // ── Tool playground (schema-driven param form) ─────────────────────────────
  window.mcpSelectTool = function(name) {
    if (!toolCache) return;
    selectedTool = toolCache.tools.find(function(t) { return t.name === name; });
    if (!selectedTool) return;
    renderPlayground();
    // Scroll to playground
    var pg = document.getElementById('mcp-playground');
    if (pg) pg.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Close dropdown
    hideDropdown();
    // Focus first input
    setTimeout(function() {
      var first = document.querySelector('#mcp-playground-form input, #mcp-playground-form select, #mcp-playground-form textarea');
      if (first) first.focus();
    }, 100);
  };

  function renderPlayground() {
    var el = document.getElementById('mcp-playground');
    if (!el || !selectedTool) { if (el) el.innerHTML = ''; return; }
    var t = selectedTool;
    var safety = toolSafety(t);
    var safetyColor = safety === 'read' ? 'var(--cyan)' : safety === 'destructive' ? 'var(--orange)' : 'var(--text-primary)';
    var props = (t.inputSchema && t.inputSchema.properties) || {};
    var required = (t.inputSchema && t.inputSchema.required) || [];
    var paramKeys = Object.keys(props);

    var formHtml = '';
    if (paramKeys.length === 0) {
      formHtml = '<div style="color:var(--text-tertiary);font-size:12px;padding:8px 0">No parameters — click Run to execute</div>';
    } else {
      paramKeys.forEach(function(key) {
        var p = props[key];
        var isRequired = required.indexOf(key) >= 0;
        var label = '<label style="display:block;margin-bottom:12px">' +
          '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px">' +
            '<code style="color:var(--text-primary)">' + esc(key) + '</code>' +
            (isRequired ? ' <span style="color:var(--orange)">*</span>' : '') +
            '<span style="color:var(--text-tertiary);margin-left:8px">' + esc(p.type || '') + '</span>' +
          '</div>';

        if (p.enum) {
          label += '<select id="mcp-param-' + esc(key) + '" style="width:100%;padding:8px 12px;background:var(--well);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px">';
          p.enum.forEach(function(v) {
            var sel = (p.default !== undefined && p.default === v) ? ' selected' : '';
            label += '<option value="' + esc(v) + '"' + sel + '>' + esc(v) + '</option>';
          });
          label += '</select>';
        } else if (p.type === 'number' || p.type === 'integer') {
          label += '<input type="number" id="mcp-param-' + esc(key) + '" value="' + (p.default !== undefined ? p.default : '') + '" style="width:100%;padding:8px 12px;background:var(--well);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px" placeholder="' + esc(p.describe || p.description || key) + '">';
        } else if (p.type === 'boolean') {
          var checked = p.default ? ' checked' : '';
          label += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="mcp-param-' + esc(key) + '"' + checked + '> <span style="font-size:12px;color:var(--text-primary)">' + esc(p.describe || p.description || 'enabled') + '</span></label>';
        } else {
          // string or unknown
          var isLong = key === 'sql' || key === 'query' || key === 'prompt' || key === 'body' || key === 'message';
          if (isLong) {
            label += '<textarea id="mcp-param-' + esc(key) + '" rows="3" style="width:100%;padding:8px 12px;background:var(--well);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;resize:vertical" placeholder="' + esc(p.describe || p.description || key) + '">' + esc(p.default || '') + '</textarea>';
          } else {
            label += '<input type="text" id="mcp-param-' + esc(key) + '" value="' + esc(p.default || '') + '" style="width:100%;padding:8px 12px;background:var(--well);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px" placeholder="' + esc(p.describe || p.description || key) + '">';
          }
        }
        label += '</label>';
        formHtml += label;
      });
    }

    el.innerHTML =
      '<div class="glass-card" style="padding:20px">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">' +
          '<code style="font-size:15px;font-weight:600;color:var(--text-primary)">' + esc(t.name) + '</code>' +
          '<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:' + safetyColor + '20;color:' + safetyColor + ';text-transform:uppercase;letter-spacing:0.5px">' + safety.toUpperCase() + '</span>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">' + esc(t.description) + '</div>' +
        '<div id="mcp-playground-form">' + formHtml + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
          '<button class="btn btn-sm btn-primary" onclick="mcpRunTool()" id="mcp-run-btn">Run Tool <span style="color:var(--text-tertiary);font-size:10px;margin-left:4px">Ctrl+Enter</span></button>' +
          '<button class="btn btn-sm" onclick="mcpCopyJsonRpc()">Copy JSON-RPC</button>' +
          '<button class="btn btn-sm" onclick="mcpCopyCurl()">Copy curl</button>' +
        '</div>' +
        '<div id="mcp-playground-result"></div>' +
      '</div>';
  }

  function gatherToolArgs() {
    if (!selectedTool) return {};
    var props = (selectedTool.inputSchema && selectedTool.inputSchema.properties) || {};
    var args = {};
    Object.keys(props).forEach(function(key) {
      var el = document.getElementById('mcp-param-' + key);
      if (!el) return;
      var p = props[key];
      if (p.type === 'boolean') {
        args[key] = el.checked;
      } else if (p.type === 'number' || p.type === 'integer') {
        if (el.value !== '') args[key] = Number(el.value);
      } else {
        if (el.value !== '') args[key] = el.value;
      }
    });
    return args;
  }

  window.mcpRunTool = function() {
    if (!selectedTool) return;
    var args = gatherToolArgs();
    var btn = document.getElementById('mcp-run-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Running...'; }
    mcpCall('tools/call', { name: selectedTool.name, arguments: args }).then(function(data) {
      showPlaygroundResult(data, selectedTool.name);
      if (btn) { btn.disabled = false; btn.innerHTML = 'Run Tool <span style="color:var(--text-tertiary);font-size:10px;margin-left:4px">Ctrl+Enter</span>'; }
    }).catch(function(err) {
      showPlaygroundResult({ error: err.message }, selectedTool.name);
      if (btn) { btn.disabled = false; btn.innerHTML = 'Run Tool <span style="color:var(--text-tertiary);font-size:10px;margin-left:4px">Ctrl+Enter</span>'; }
    });
  };

  function showPlaygroundResult(data, label) {
    var el = document.getElementById('mcp-playground-result');
    if (!el) return;
    var isErr = !!data.error;
    var color = isErr ? 'var(--orange)' : 'var(--cyan)';
    // Try to pretty-print content text if it's JSON
    var display = data;
    if (data.content && data.content[0] && data.content[0].text) {
      try { display = { content: [{ type: 'text', text: JSON.parse(data.content[0].text) }] }; } catch(e) { /* keep raw */ }
    }
    el.innerHTML =
      '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + color + '"></div>' +
          '<span style="font-size:12px;font-weight:600;color:' + color + '">' + (isErr ? 'Error' : 'Result') + '</span>' +
          '<span style="font-size:11px;color:var(--text-tertiary);margin-left:auto">' + esc(label) + '</span>' +
        '</div>' +
        '<pre style="background:var(--well);padding:14px;border-radius:8px;font-size:12px;color:var(--text-primary);overflow-x:auto;max-height:400px;border:1px solid var(--border);margin:0;white-space:pre-wrap">' + esc(JSON.stringify(display, null, 2)) + '</pre>' +
      '</div>';
  }

  window.mcpCopyJsonRpc = function() {
    if (!selectedTool) return;
    var rpc = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: selectedTool.name, arguments: gatherToolArgs() } };
    navigator.clipboard.writeText(JSON.stringify(rpc, null, 2)).then(function() { Toast.success('JSON-RPC copied'); });
  };

  window.mcpCopyCurl = function() {
    if (!selectedTool || !mcpInfo) return;
    var rpc = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: selectedTool.name, arguments: gatherToolArgs() } };
    var cmd = 'curl -X POST ' + mcpInfo.url + ' \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -b "monitor_session=TOKEN" \\\n  -d \'' + JSON.stringify(rpc) + "'";
    navigator.clipboard.writeText(cmd).then(function() { Toast.success('curl command copied'); });
  };

  // ── Command bar with / slash commands + fuzzy search ───────────────────────
  function bindCommandBar() {
    var input = document.getElementById('mcp-command-input');
    if (!input) return;

    input.addEventListener('input', function() {
      var val = input.value;
      if (val.length === 0) { hideDropdown(); return; }
      showDropdown(val);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { hideDropdown(); input.value = ''; return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); navDropdown(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); navDropdown(-1); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (dropdownIdx >= 0 && dropdownItems[dropdownIdx]) {
          selectDropdownItem(dropdownItems[dropdownIdx]);
        } else if (input.value.length > 0) {
          // Direct tool name match
          var match = findToolByName(input.value.replace(/^\//, ''));
          if (match) { window.mcpSelectTool(match.name); input.value = ''; }
        }
        return;
      }
      if (e.key === 'Tab' && dropdownItems.length > 0) {
        e.preventDefault();
        if (dropdownIdx < 0) dropdownIdx = 0;
        selectDropdownItem(dropdownItems[dropdownIdx]);
      }
    });

    input.addEventListener('focus', function() {
      if (input.value.length > 0) showDropdown(input.value);
    });

    input.addEventListener('blur', function() {
      setTimeout(hideDropdown, 200);
    });

    // Ctrl+Enter to run tool
    document.getElementById('view-mcp').addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (selectedTool) window.mcpRunTool();
      }
    });
  }

  function findToolByName(q) {
    if (!toolCache || !toolCache.tools) return null;
    q = q.toLowerCase();
    return toolCache.tools.find(function(t) { return t.name.toLowerCase() === q; });
  }

  function showDropdown(query) {
    var dd = document.getElementById('mcp-command-dropdown');
    if (!dd || !toolCache || !toolCache.tools) return;
    var q = query.replace(/^\//, '').toLowerCase();
    var allItems = [];

    // Tools
    toolCache.tools.forEach(function(t) {
      var score = fuzzyScore(q, t.name + ' ' + (t.description || '') + ' ' + toolCategory(t.name));
      if (score > 0 || q.length === 0) {
        allItems.push({ type: 'tool', name: t.name, desc: t.description, category: toolCategory(t.name), score: score, data: t });
      }
    });

    // Resources
    if (resourceCache && resourceCache.resources) {
      resourceCache.resources.forEach(function(r) {
        var score = fuzzyScore(q, r.name + ' ' + (r.description || '') + ' resource');
        if (score > 0 || q.length === 0) {
          allItems.push({ type: 'resource', name: r.name, desc: r.description, category: 'Resource', score: score, data: r });
        }
      });
    }

    // Prompts
    if (promptCache && promptCache.prompts) {
      promptCache.prompts.forEach(function(p) {
        var score = fuzzyScore(q, p.name + ' ' + (p.description || '') + ' prompt');
        if (score > 0 || q.length === 0) {
          allItems.push({ type: 'prompt', name: p.name, desc: p.description, category: 'Prompt', score: score, data: p });
        }
      });
    }

    allItems.sort(function(a, b) { return b.score - a.score; });
    dropdownItems = allItems.slice(0, 12);
    dropdownIdx = -1;

    if (dropdownItems.length === 0) {
      dd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:12px">No matches</div>';
      dd.style.display = 'block';
      return;
    }

    var html = '';
    var lastCat = '';
    dropdownItems.forEach(function(item, i) {
      if (item.category !== lastCat) {
        lastCat = item.category;
        html += '<div style="padding:4px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-tertiary)">' + esc(lastCat) + '</div>';
      }
      var typeColor = item.type === 'tool' ? 'var(--cyan)' : item.type === 'prompt' ? 'var(--orange)' : 'var(--text-secondary)';
      var typeBadge = item.type === 'tool' ? 'TOOL' : item.type === 'prompt' ? 'PROMPT' : 'RES';
      html += '<div class="mcp-dd-item" data-idx="' + i + '" style="display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;transition:background 0.1s" ' +
        'onmouseenter="mcpDdHover(' + i + ')" onclick="mcpDdClick(' + i + ')">' +
        '<code style="font-size:12px;color:var(--text-primary);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.name) + '</code>' +
        '<span style="font-size:11px;color:var(--text-tertiary);flex:2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.desc || '') + '</span>' +
        '<span style="font-size:9px;color:' + typeColor + ';text-transform:uppercase;letter-spacing:0.3px">' + typeBadge + '</span>' +
      '</div>';
    });
    dd.innerHTML = html;
    dd.style.display = 'block';
  }

  function hideDropdown() {
    var dd = document.getElementById('mcp-command-dropdown');
    if (dd) dd.style.display = 'none';
    dropdownIdx = -1;
  }

  function navDropdown(dir) {
    if (dropdownItems.length === 0) return;
    dropdownIdx += dir;
    if (dropdownIdx < 0) dropdownIdx = dropdownItems.length - 1;
    if (dropdownIdx >= dropdownItems.length) dropdownIdx = 0;
    highlightDropdown();
  }

  function highlightDropdown() {
    var items = document.querySelectorAll('.mcp-dd-item');
    items.forEach(function(el, i) {
      el.style.background = (i === dropdownIdx) ? 'rgba(34,211,238,0.08)' : 'transparent';
      el.style.borderLeft = (i === dropdownIdx) ? '2px solid var(--cyan)' : '2px solid transparent';
    });
    // Scroll into view
    if (items[dropdownIdx]) items[dropdownIdx].scrollIntoView({ block: 'nearest' });
  }

  window.mcpDdHover = function(i) { dropdownIdx = i; highlightDropdown(); };
  window.mcpDdClick = function(i) {
    if (dropdownItems[i]) selectDropdownItem(dropdownItems[i]);
  };

  function selectDropdownItem(item) {
    var input = document.getElementById('mcp-command-input');
    if (input) input.value = '';
    hideDropdown();

    if (item.type === 'tool') {
      window.mcpSelectTool(item.name);
    } else if (item.type === 'prompt') {
      window.mcpRunPrompt(item.name);
    } else if (item.type === 'resource') {
      mcpCall('resources/read', { uri: item.data.uri }).then(function(d) {
        showPlaygroundResult(d, 'resource: ' + item.name);
      });
    }
  }

  function fuzzyScore(query, text) {
    if (!query) return 1; // show all when empty
    text = text.toLowerCase();
    query = query.toLowerCase();
    // Exact substring
    if (text.indexOf(query) >= 0) return 10 + (query.length / text.length * 5);
    // All chars in order
    var qi = 0;
    for (var i = 0; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) qi++;
    }
    return qi === query.length ? qi : 0;
  }

  // ── Request log panel ──────────────────────────────────────────────────────
  function renderLog() {
    var el = document.getElementById('mcp-log-body');
    if (!el) return;
    if (requestLog.length === 0) {
      el.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-tertiary);padding:16px">Run a tool to see request history</td></tr>';
      return;
    }
    el.innerHTML = requestLog.slice(0, 20).map(function(e) {
      var statusColor = e.ok ? 'var(--cyan)' : 'var(--orange)';
      var statusDot = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + statusColor + '"></span>';
      var paramsStr = e.params ? JSON.stringify(e.params).slice(0, 40) : '-';
      return '<tr style="font-size:11px;border-bottom:1px solid var(--border)">' +
        '<td style="padding:5px 8px;color:var(--text-tertiary);white-space:nowrap">' + esc(e.time) + '</td>' +
        '<td style="padding:5px 8px;color:var(--text-primary)">' + esc(e.method) + '</td>' +
        '<td style="padding:5px 8px;color:var(--text-tertiary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(paramsStr) + '</td>' +
        '<td style="padding:5px 8px;text-align:right;white-space:nowrap">' + statusDot + ' <span style="color:var(--text-tertiary)">' + e.ms + 'ms</span></td>' +
      '</tr>';
    }).join('');
  }

  // ── Template ───────────────────────────────────────────────────────────────
  function buildTemplate() {
    return '' +
      '<div class="view-header">' +
        '<h2>MCP Server</h2>' +
        '<p class="view-subtitle">Model Context Protocol — Interactive Tool Playground</p>' +
      '</div>' +

      // Connection info (compact)
      '<div class="glass-card" style="padding:16px;margin-bottom:16px" id="mcp-info-panel">' +
        '<div style="text-align:center;color:var(--text-secondary)">Loading...</div>' +
      '</div>' +

      // Command bar
      '<div style="position:relative;margin-bottom:16px">' +
        '<div style="position:relative">' +
          '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);font-size:14px;pointer-events:none">/</span>' +
          '<input id="mcp-command-input" type="text" placeholder="Search tools, resources, prompts... or type a tool name" ' +
            'style="width:100%;padding:12px 14px 12px 30px;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--text-primary);font-size:13px;font-family:\'JetBrains Mono\',monospace;outline:none;transition:border-color 0.2s" ' +
            'onfocus="this.style.borderColor=\'var(--cyan)\'" onblur="this.style.borderColor=\'var(--border)\'">' +
          '<span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);font-size:10px;pointer-events:none">Esc to clear</span>' +
        '</div>' +
        '<div id="mcp-command-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;margin-top:4px;background:var(--surface-solid);border:1px solid var(--border);border-radius:12px;max-height:320px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);backdrop-filter:blur(20px)"></div>' +
      '</div>' +

      // Prompt action cards
      '<div id="mcp-prompt-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:16px"></div>' +

      // Tool playground (populated when tool selected)
      '<div id="mcp-playground" style="margin-bottom:16px"></div>' +

      // Tool grid (dynamic)
      '<div class="glass-card" style="padding:20px;margin-bottom:16px">' +
        '<h3 style="font-size:13px;font-weight:600;color:var(--text-primary);margin:0 0 12px 0">Available Tools <span id="mcp-tool-count" style="color:var(--text-tertiary);font-weight:400"></span></h3>' +
        '<div id="mcp-tool-grid"><div style="text-align:center;color:var(--text-secondary);padding:16px">Loading tools...</div></div>' +
      '</div>' +

      // Request log
      '<div class="glass-card" style="padding:16px">' +
        '<h3 style="font-size:13px;font-weight:600;color:var(--text-primary);margin:0 0 12px 0">Request Log</h3>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
          '<thead><tr style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-tertiary);border-bottom:1px solid var(--border)">' +
            '<th style="padding:5px 8px;text-align:left">Time</th>' +
            '<th style="padding:5px 8px;text-align:left">Method</th>' +
            '<th style="padding:5px 8px;text-align:left">Params</th>' +
            '<th style="padding:5px 8px;text-align:right">Status</th>' +
          '</tr></thead>' +
          '<tbody id="mcp-log-body">' +
            '<tr><td colspan="4" style="text-align:center;color:var(--text-tertiary);padding:16px">Run a tool to see request history</td></tr>' +
          '</tbody>' +
        '</table></div>' +
      '</div>';
  }

})();
