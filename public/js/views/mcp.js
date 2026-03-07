// =============================================================================
// MCP Server — Model Context Protocol Connection & Testing
// =============================================================================
(function() {
  'use strict';

  var mcpInfo = null;
  var testResult = null;

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  Views.mcp = {
    init: function() {
      var el = document.getElementById('view-mcp');
      if (!el) return;
      el.innerHTML = buildTemplate();
    },

    show: function() {
      this.init();
      fetchInfo();
    },

    hide: function() {},
    update: function() {}
  };

  function fetchInfo() {
    fetch('/api/mcp/info').then(function(r) { return r.json(); }).then(function(data) {
      mcpInfo = data;
      renderInfo();
    }).catch(function() {
      mcpInfo = null;
      renderInfo();
    });
  }

  function renderInfo() {
    var el = document.getElementById('mcp-connection-info');
    if (!el) return;

    if (!mcpInfo) {
      el.innerHTML = '<div class="glass-card" style="padding:24px;text-align:center"><span style="color:var(--text-secondary)">Failed to load MCP info</span></div>';
      return;
    }

    el.innerHTML =
      '<div class="glass-card" style="padding:24px">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
          '<div style="width:10px;height:10px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan)"></div>' +
          '<span style="font-size:14px;font-weight:600;color:var(--text-primary)">MCP Endpoint Active</span>' +
          '<span style="color:var(--text-tertiary);font-size:12px;margin-left:auto">v' + escapeHtml(mcpInfo.version) + '</span>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;margin-bottom:24px">' +
          statCard('Tools', mcpInfo.tools, 'Actions AI can invoke') +
          statCard('Resources', mcpInfo.resources, 'Data AI can read') +
          statCard('Prompts', mcpInfo.prompts, 'Pre-built workflows') +
        '</div>' +

        '<div style="margin-bottom:16px">' +
          '<label style="color:var(--text-secondary);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Endpoint URL</label>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
            '<code style="flex:1;background:var(--well);padding:10px 14px;border-radius:8px;font-size:13px;color:var(--cyan);border:1px solid var(--border)">' + escapeHtml(mcpInfo.url) + '</code>' +
            '<button class="btn btn-sm" onclick="copyMcpUrl()" title="Copy URL">Copy</button>' +
          '</div>' +
        '</div>' +

        '<div style="color:var(--text-secondary);font-size:12px">' +
          'Transport: <span style="color:var(--text-primary)">' + escapeHtml(mcpInfo.transport) + '</span>' +
          ' &middot; Auth: <span style="color:var(--text-primary)">Session Cookie</span>' +
        '</div>' +
      '</div>';
  }

  function statCard(label, value, subtitle) {
    return '<div style="text-align:center;padding:16px;background:var(--well);border-radius:10px;border:1px solid var(--border)">' +
      '<div style="font-size:28px;font-weight:700;color:var(--cyan)">' + value + '</div>' +
      '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-top:4px">' + label + '</div>' +
      '<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">' + subtitle + '</div>' +
    '</div>';
  }

  function renderTestResult(data) {
    var el = document.getElementById('mcp-test-result');
    if (!el) return;

    if (!data) {
      el.innerHTML = '';
      return;
    }

    var isError = !!data.error;
    var color = isError ? 'var(--orange)' : 'var(--cyan)';
    var json = JSON.stringify(data, null, 2);

    el.innerHTML =
      '<div class="glass-card" style="padding:20px;margin-top:16px;border-color:' + color + '">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + color + '"></div>' +
          '<span style="font-size:13px;font-weight:600;color:' + color + '">' + (isError ? 'Error' : 'Success') + '</span>' +
        '</div>' +
        '<pre style="background:var(--well);padding:14px;border-radius:8px;font-size:12px;color:var(--text-primary);overflow-x:auto;max-height:400px;border:1px solid var(--border);margin:0">' + escapeHtml(json) + '</pre>' +
      '</div>';
  }

  window.copyMcpUrl = function() {
    if (mcpInfo && mcpInfo.url) {
      navigator.clipboard.writeText(mcpInfo.url).then(function() {
        Toast.success('MCP URL copied');
      });
    }
  };

  function mcpTest(method, params, loadingText) {
    var el = document.getElementById('mcp-test-result');
    if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary)">' + (loadingText || 'Testing...') + '</div>';

    var body = { method: method };
    if (params) body.params = params;

    fetch('/api/mcp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json(); }).then(function(data) {
      testResult = data;
      renderTestResult(data);
    }).catch(function(err) {
      renderTestResult({ error: err.message });
    });
  }

  window.mcpTestToolsList = function() { mcpTest('tools/list'); };
  window.mcpTestResourcesList = function() { mcpTest('resources/list'); };
  window.mcpTestPromptsList = function() { mcpTest('prompts/list'); };
  window.mcpTestCallTool = function() { mcpTest('tools/call', { name: 'get_system_metrics', arguments: {} }, 'Calling get_system_metrics...'); };

  window.copyCursorConfig = function() {
    if (!mcpInfo) return;
    var config = JSON.stringify(mcpInfo.instructions.claudeDesktop.config, null, 2);
    navigator.clipboard.writeText(config).then(function() {
      Toast.success('Config copied — paste into claude_desktop_config.json');
    });
  };

  window.copyClaudeCodeCmd = function() {
    if (!mcpInfo) return;
    navigator.clipboard.writeText(mcpInfo.instructions.claudeCode).then(function() {
      Toast.success('Command copied — paste into terminal');
    });
  };

  window.copyCurlCmd = function() {
    if (!mcpInfo) return;
    navigator.clipboard.writeText(mcpInfo.instructions.curl).then(function() {
      Toast.success('curl command copied');
    });
  };

  function buildTemplate() {
    return '' +
      '<div class="view-header">' +
        '<h2>MCP Server</h2>' +
        '<p class="view-subtitle">Model Context Protocol — Connect AI agents to Bulwark</p>' +
      '</div>' +

      '<div id="mcp-connection-info" style="margin-bottom:24px">' +
        '<div class="glass-card" style="padding:24px;text-align:center"><span style="color:var(--text-secondary)">Loading...</span></div>' +
      '</div>' +

      // Test Panel
      '<div class="glass-card" style="padding:24px;margin-bottom:24px">' +
        '<h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 16px 0">Test MCP Endpoint</h3>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          '<button class="btn btn-sm" onclick="mcpTestToolsList()">List Tools</button>' +
          '<button class="btn btn-sm" onclick="mcpTestResourcesList()">List Resources</button>' +
          '<button class="btn btn-sm" onclick="mcpTestPromptsList()">List Prompts</button>' +
          '<button class="btn btn-sm btn-primary" onclick="mcpTestCallTool()">Call get_system_metrics</button>' +
        '</div>' +
        '<div id="mcp-test-result"></div>' +
      '</div>' +

      // Connect Instructions
      '<div class="glass-card" style="padding:24px;margin-bottom:24px">' +
        '<h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 16px 0">Connect Your AI Agent</h3>' +

        // Claude Desktop / Cursor
        '<div style="margin-bottom:20px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
            '<span style="font-size:13px;font-weight:600;color:var(--text-primary)">Claude Desktop / Cursor</span>' +
            '<button class="btn btn-sm" onclick="copyCursorConfig()">Copy Config</button>' +
          '</div>' +
          '<div style="background:var(--well);padding:12px;border-radius:8px;font-size:12px;color:var(--text-secondary);border:1px solid var(--border)">' +
            'Add to <code style="color:var(--cyan)">claude_desktop_config.json</code> or Cursor MCP settings.<br>' +
            'Replace <code style="color:var(--orange)">YOUR_SESSION_TOKEN</code> with your Bulwark session cookie.' +
          '</div>' +
        '</div>' +

        // Claude Code
        '<div style="margin-bottom:20px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
            '<span style="font-size:13px;font-weight:600;color:var(--text-primary)">Claude Code (CLI)</span>' +
            '<button class="btn btn-sm" onclick="copyClaudeCodeCmd()">Copy Command</button>' +
          '</div>' +
          '<div style="background:var(--well);padding:12px;border-radius:8px;font-size:12px;color:var(--text-secondary);border:1px solid var(--border)">' +
            'Run in your terminal to register Bulwark as an MCP server.' +
          '</div>' +
        '</div>' +

        // curl
        '<div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
            '<span style="font-size:13px;font-weight:600;color:var(--text-primary)">curl / HTTP</span>' +
            '<button class="btn btn-sm" onclick="copyCurlCmd()">Copy curl</button>' +
          '</div>' +
          '<div style="background:var(--well);padding:12px;border-radius:8px;font-size:12px;color:var(--text-secondary);border:1px solid var(--border)">' +
            'Direct JSON-RPC call for testing or custom integrations.' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Tools Reference
      '<div class="glass-card" style="padding:24px">' +
        '<h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 16px 0">Available Tools</h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">' +
          toolRow('get_system_metrics', 'CPU, memory, disk, uptime', 'read') +
          toolRow('get_process_list', 'Running processes', 'read') +
          toolRow('get_uptime_status', 'Endpoint monitoring status', 'read') +
          toolRow('add_uptime_endpoint', 'Add endpoint to monitor', 'write') +
          toolRow('list_docker_containers', 'Docker containers', 'read') +
          toolRow('get_container_logs', 'Container log output', 'read') +
          toolRow('manage_container', 'Start/stop/restart containers', 'destructive') +
          toolRow('list_database_tables', 'Database tables', 'read') +
          toolRow('query_database', 'Execute SQL queries', 'write') +
          toolRow('list_tickets', 'Support tickets', 'read') +
          toolRow('create_ticket', 'Create support ticket', 'write') +
          toolRow('get_deploy_history', 'Deployment history', 'read') +
          toolRow('get_deploy_preflight', 'Pre-deploy checks', 'read') +
          toolRow('get_git_log', 'Git commit history', 'read') +
          toolRow('get_git_diff', 'Git working tree diff', 'read') +
          toolRow('get_security_score', 'Security audit score', 'read') +
          toolRow('send_notification', 'Send alert notification', 'write') +
          toolRow('get_recent_alerts', 'Recent notifications', 'read') +
        '</div>' +
      '</div>';
  }

  function toolRow(name, desc, type) {
    var color = type === 'read' ? 'var(--cyan)' : type === 'destructive' ? 'var(--orange)' : 'var(--text-primary)';
    var badge = type === 'read' ? 'READ' : type === 'destructive' ? 'DESTRUCTIVE' : 'WRITE';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--well);border-radius:8px;border:1px solid var(--border)">' +
      '<code style="font-size:12px;color:var(--text-primary);flex:1">' + name + '</code>' +
      '<span style="font-size:10px;color:' + color + ';text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap">' + badge + '</span>' +
    '</div>';
  }

})();
