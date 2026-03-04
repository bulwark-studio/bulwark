/**
 * Chester Dev Monitor v2.0 — Claude CLI View
 * Prompt input, streaming output, run/stop controls
 */
(function () {
  'use strict';

  Views.claude = {
    init: function () {
      var container = document.getElementById('view-claude');
      if (container) {
        container.innerHTML =
          '<div class="card" style="margin-bottom:16px;padding:16px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
              '<div style="display:flex;align-items:center;gap:8px">' +
                '<span style="font-weight:600;color:var(--text-primary)">Claude CLI</span>' +
                '<span id="claude-status" style="font-size:12px;color:var(--text-tertiary)">Idle -- ready for prompts</span>' +
              '</div>' +
              '<div style="display:flex;gap:8px">' +
                '<button class="btn btn-sm btn-cyan" id="claude-run-btn" onclick="runClaude()">Run</button>' +
                '<button class="btn btn-sm btn-orange" id="claude-stop-btn" onclick="stopClaude()" style="display:none">Stop</button>' +
              '</div>' +
            '</div>' +
            '<textarea id="claude-prompt" class="form-input" rows="4" placeholder="Enter your prompt for Claude..." style="width:100%;margin-bottom:12px;background:var(--surface-solid);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:monospace;font-size:13px;resize:vertical"></textarea>' +
          '</div>' +
          '<div class="card" style="padding:0">' +
            '<div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:12px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px">Output</div>' +
            '<pre id="claude-output" style="margin:0;padding:16px;background:var(--canvas);color:var(--text-secondary);font-family:\'JetBrains Mono\',monospace;font-size:12px;line-height:1.6;min-height:300px;max-height:60vh;overflow:auto;white-space:pre-wrap;word-break:break-word">Waiting for input...\n</pre>' +
          '</div>';
      }
    },

    show: function () {
      var statusEl = document.getElementById('claude-status');
      if (statusEl && state.claudeRunning) {
        statusEl.innerHTML = '<div class="spinner spinner-sm"></div> <span style="color:var(--cyan)">Running...</span>';
      } else if (statusEl) {
        statusEl.innerHTML = '<span style="color:var(--text-tertiary)">Idle -- ready for prompts</span>';
      }
    },

    hide: function () {},

    update: function (data) {
      if (!data) return;
      var outputEl = document.getElementById('claude-output');
      var statusEl = document.getElementById('claude-status');
      var runBtn = document.getElementById('claude-run-btn');
      var stopBtn = document.getElementById('claude-stop-btn');

      if (data.type === 'output' && outputEl) {
        if (outputEl.textContent === 'Waiting for input...\n') outputEl.textContent = '';
        outputEl.textContent += data.data;
        outputEl.scrollTop = outputEl.scrollHeight;
        if (statusEl) statusEl.innerHTML = '<div class="spinner spinner-sm"></div> <span style="color:var(--cyan)">Running...</span>';
        if (runBtn) runBtn.disabled = true;
        if (stopBtn) stopBtn.style.display = '';
      }

      if (data.type === 'done') {
        state.claudeRunning = false;
        if (statusEl) {
          var code = data.data ? data.data.code : null;
          var color = code === 0 ? 'var(--cyan)' : 'var(--orange)';
          statusEl.innerHTML = '<span style="color:' + color + '">Done (exit ' + code + ')</span>';
        }
        if (runBtn) runBtn.disabled = false;
        if (stopBtn) stopBtn.style.display = 'none';
      }
    }
  };

  window.runClaude = function () {
    var promptEl = document.getElementById('claude-prompt');
    if (!promptEl || !promptEl.value.trim()) { Toast.warning('Enter a prompt first'); return; }
    var outputEl = document.getElementById('claude-output');
    if (outputEl) outputEl.textContent = '';
    state.claudeRunning = true;

    fetch('/api/claude/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptEl.value.trim() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { Toast.error(d.error); state.claudeRunning = false; }
    }).catch(function (e) { Toast.error('Failed to start Claude: ' + e.message); state.claudeRunning = false; });
  };

  window.stopClaude = function () {
    fetch('/api/claude/stop', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function () { Toast.info('Claude stopped'); })
      .catch(function () { Toast.error('Failed to stop Claude'); });
  };
})();
