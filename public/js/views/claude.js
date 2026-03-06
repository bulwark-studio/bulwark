/**
 * Chester Dev Monitor — Claude CLI View
 * Now redirects to the floating Command Center's Chester AI tab.
 * Legacy claude_output/claude_done socket events still handled for backwards compat.
 */
(function () {
  'use strict';

  Views.claude = {
    init: function () {
      var container = document.getElementById('view-claude');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px">' +
            '<svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="var(--cyan)" stroke-width="1"><circle cx="24" cy="24" r="20"/><path d="M16 20h0M32 20h0M18 30c3 3 9 3 12 0"/><path d="M24 4v4M24 40v4M4 24h4M40 24h4" stroke-opacity="0.2"/></svg>' +
            '<div style="color:var(--text-primary);font-size:18px;font-weight:600">Chester AI</div>' +
            '<div class="text-secondary" style="max-width:320px;text-align:center;line-height:1.5">Chester AI lives in the floating Command Center now. Open the terminal drawer and switch to the Chester AI tab.</div>' +
            '<button class="btn btn-cyan" onclick="Views.terminal.toggleDrawer();setTimeout(function(){Views.terminal.switchTab(\'chester\')},200)">Open Chester AI</button>' +
            '<div class="text-tertiary" style="font-size:11px;margin-top:4px">Keyboard: <kbd style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:3px;font-size:10px">Ctrl + `</kbd> then click Chester AI tab</div>' +
          '</div>';
      }
    },
    show: function () {
      // Auto-open the command center Chester tab
      if (Views.terminal && Views.terminal.openDrawer) {
        Views.terminal.openDrawer();
        setTimeout(function () { Views.terminal.switchTab('chester'); }, 200);
      }
    },
    hide: function () {},
    update: function (data) {
      // Legacy: handle claude_output and claude_done socket events
      // These still fire from routes/claude.js for backwards compat
    }
  };

  // Legacy globals for any old callers
  window.runClaude = function () {
    if (Views.terminal && Views.terminal.openDrawer) {
      Views.terminal.openDrawer();
      setTimeout(function () { Views.terminal.switchTab('chester'); }, 200);
    }
  };
  window.stopClaude = function () {
    fetch('/api/claude/stop', { method: 'POST' }).catch(function () {});
  };
})();
