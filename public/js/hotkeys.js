/**
 * Bulwark v3.0 — Centralized Hotkey System
 * All keyboard shortcuts registered and managed from one place.
 * Shift+? opens the cheatsheet overlay.
 */
(function () {
  'use strict';

  var _bindings = [];  // { keys, description, group, handler, allowInInput }
  var _helpOverlay = null;
  var _enabled = true;

  // ── Helpers ───────────────────────────────────────────────────────────

  function isInputFocused() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    // CodeMirror editors
    if (el.classList && el.classList.contains('CodeMirror-code')) return true;
    if (el.closest && el.closest('.CodeMirror')) return true;
    return false;
  }

  function isTerminalFocused() {
    var el = document.activeElement;
    if (!el) return false;
    if (el.closest && el.closest('.xterm')) return true;
    if (el.classList && (el.classList.contains('xterm-helper-textarea') || el.classList.contains('xterm'))) return true;
    return false;
  }

  function matchKey(e, keys) {
    // keys format: "ctrl+k", "shift+?", "g then d", "escape"
    // Only support single combos (no sequences yet)
    var parts = keys.toLowerCase().split('+').map(function (p) { return p.trim(); });
    var needCtrl = parts.indexOf('ctrl') !== -1 || parts.indexOf('mod') !== -1;
    var needShift = parts.indexOf('shift') !== -1;
    var needAlt = parts.indexOf('alt') !== -1;
    var needMeta = parts.indexOf('meta') !== -1 || parts.indexOf('mod') !== -1;
    var key = parts.filter(function (p) {
      return p !== 'ctrl' && p !== 'shift' && p !== 'alt' && p !== 'meta' && p !== 'mod';
    })[0] || '';

    // Normalize key names
    if (key === 'escape' || key === 'esc') key = 'escape';
    if (key === 'enter' || key === 'return') key = 'enter';
    if (key === 'space') key = ' ';
    if (key === 'backquote' || key === 'backtick') key = '`';
    if (key === 'slash') key = '/';
    if (key === 'questionmark' || key === '?') key = '?';

    var eKey = e.key.toLowerCase();
    // Handle special cases
    if (eKey === 'escape') eKey = 'escape';
    // Some browsers send 'dead' for backtick with modifiers — use e.code fallback
    if ((eKey === 'dead' || eKey === 'unidentified') && e.code === 'Backquote') eKey = '`';
    if (eKey === 'dead' || eKey === 'unidentified') {
      // Map common e.code values
      var codeMap = { 'Backquote': '`', 'Slash': '/', 'Period': '.', 'Comma': ',' };
      if (codeMap[e.code]) eKey = codeMap[e.code];
    }

    var ctrlOk = needCtrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
    var shiftOk = needShift ? e.shiftKey : !e.shiftKey;
    var altOk = needAlt ? e.altKey : !e.altKey;

    // For mod key: accept either ctrl or meta
    if (parts.indexOf('mod') !== -1) {
      ctrlOk = e.ctrlKey || e.metaKey;
      // Don't require neither
      if (!e.ctrlKey && !e.metaKey) ctrlOk = false;
      // shift/alt still checked normally
      shiftOk = needShift ? e.shiftKey : true; // don't require no-shift for mod combos
    }

    // Special: shift+? means shift is expected AND key is '?'
    // But '?' is already shift+/ on most keyboards, so e.shiftKey will be true
    if (key === '?' && e.key === '?') {
      return needShift ? e.shiftKey : true;
    }

    return ctrlOk && shiftOk && altOk && eKey === key;
  }

  function formatKeys(keys) {
    var isMac = navigator.platform && navigator.platform.indexOf('Mac') !== -1;
    return keys
      .replace(/mod/gi, isMac ? '⌘' : 'Ctrl')
      .replace(/ctrl/gi, isMac ? '⌃' : 'Ctrl')
      .replace(/shift/gi, isMac ? '⇧' : 'Shift')
      .replace(/alt/gi, isMac ? '⌥' : 'Alt')
      .replace(/meta/gi, isMac ? '⌘' : 'Win')
      .replace(/\+/g, ' + ')
      .replace(/escape/gi, 'Esc')
      .replace(/backquote/gi, '`');
  }

  // ── Core API ──────────────────────────────────────────────────────────

  var Hotkeys = {};

  /**
   * Register a hotkey binding
   * @param {string} keys - Key combination (e.g. "ctrl+k", "shift+?", "escape")
   * @param {string} description - Human-readable description
   * @param {Function} handler - Callback (receives event)
   * @param {Object} [opts] - Options
   * @param {string} [opts.group] - Category group for cheatsheet
   * @param {boolean} [opts.allowInInput] - Fire even when input is focused
   * @param {boolean} [opts.allowInTerminal] - Fire even when terminal has focus
   */
  Hotkeys.register = function (keys, description, handler, opts) {
    opts = opts || {};
    _bindings.push({
      keys: keys,
      description: description,
      handler: handler,
      group: opts.group || 'General',
      allowInInput: opts.allowInInput || false,
      allowInTerminal: opts.allowInTerminal || false,
    });
  };

  /**
   * Remove a hotkey binding by keys string
   */
  Hotkeys.unregister = function (keys) {
    _bindings = _bindings.filter(function (b) { return b.keys !== keys; });
  };

  /**
   * Enable/disable all hotkeys
   */
  Hotkeys.enable = function () { _enabled = true; };
  Hotkeys.disable = function () { _enabled = false; };

  /**
   * Get all registered bindings (for cheatsheet)
   */
  Hotkeys.getBindings = function () {
    return _bindings.map(function (b) {
      return { keys: b.keys, formatted: formatKeys(b.keys), description: b.description, group: b.group };
    });
  };

  /**
   * Show the hotkey cheatsheet overlay
   */
  Hotkeys.showHelp = function () {
    if (_helpOverlay) { Hotkeys.hideHelp(); return; }

    var groups = {};
    _bindings.forEach(function (b) {
      if (!groups[b.group]) groups[b.group] = [];
      groups[b.group].push(b);
    });

    var html = '<div style="display:grid;gap:20px;max-height:70vh;overflow-y:auto;padding:4px 0;">';
    Object.keys(groups).forEach(function (g) {
      html += '<div>';
      html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--cyan,#22d3ee);margin-bottom:8px;font-weight:600;">' + g + '</div>';
      groups[g].forEach(function (b) {
        var kbdParts = formatKeys(b.keys).split(' + ');
        var kbdHtml = kbdParts.map(function (p) {
          return '<kbd style="display:inline-block;padding:2px 7px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:4px;font-size:11px;font-family:\'JetBrains Mono\',monospace;color:var(--text-primary,#e4e4e7);min-width:20px;text-align:center;">' + p + '</kbd>';
        }).join('<span style="color:var(--text-tertiary,#52525a);margin:0 2px;">+</span>');
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">';
        html += '<span style="font-size:12px;color:var(--text-secondary,#8b8b92);">' + b.description + '</span>';
        html += '<span style="white-space:nowrap;margin-left:16px;">' + kbdHtml + '</span>';
        html += '</div>';
      });
      html += '</div>';
    });
    html += '</div>';

    _helpOverlay = document.createElement('div');
    _helpOverlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;animation:modalFadeIn 0.12s ease-out;';
    _helpOverlay.innerHTML =
      '<div style="width:520px;max-width:90vw;max-height:85vh;background:var(--surface-solid,#0e0e12);border:1px solid var(--border,rgba(255,255,255,0.08));border-top:1px solid rgba(255,255,255,0.14);border-radius:12px;box-shadow:0 24px 48px rgba(0,0,0,0.5);overflow:hidden;">' +
        '<div style="padding:16px 20px;border-bottom:1px solid var(--border,rgba(255,255,255,0.08));display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-size:14px;font-weight:600;color:var(--text-primary,#e4e4e7);">Keyboard Shortcuts</span>' +
          '<span style="font-size:11px;color:var(--text-tertiary,#52525a);">Press Esc to close</span>' +
        '</div>' +
        '<div style="padding:16px 20px;">' + html + '</div>' +
      '</div>';

    _helpOverlay.addEventListener('click', function (e) {
      if (e.target === _helpOverlay) Hotkeys.hideHelp();
    });

    document.body.appendChild(_helpOverlay);
  };

  Hotkeys.hideHelp = function () {
    if (_helpOverlay && _helpOverlay.parentNode) {
      _helpOverlay.parentNode.removeChild(_helpOverlay);
    }
    _helpOverlay = null;
  };

  // ── Global Keydown Listener ───────────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (!_enabled) return;

    // Help overlay: Escape closes it
    if (_helpOverlay && e.key === 'Escape') {
      e.preventDefault();
      Hotkeys.hideHelp();
      return;
    }

    var inInput = isInputFocused();
    var inTerminal = isTerminalFocused();

    for (var i = 0; i < _bindings.length; i++) {
      var b = _bindings[i];
      if (matchKey(e, b.keys)) {
        // Skip if in input and binding doesn't allow it
        if (inInput && !b.allowInInput) continue;
        // Skip if terminal focused and binding doesn't allow it
        if (inTerminal && !b.allowInTerminal) continue;

        e.preventDefault();
        try { b.handler(e); } catch (err) { console.error('[Hotkeys]', b.keys, err); }
        return;
      }
    }
  }, true); // capture phase to fire before other listeners

  // ── Register Default Hotkeys ──────────────────────────────────────────

  // Help
  Hotkeys.register('shift+?', 'Show keyboard shortcuts', function () {
    Hotkeys.showHelp();
  }, { group: 'General', allowInInput: false });

  // Navigation
  Hotkeys.register('alt+1', 'Go to Dashboard', function () {
    if (window.switchView) window.switchView('dashboard');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+2', 'Go to Metrics', function () {
    if (window.switchView) window.switchView('metrics');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+3', 'Go to Docker', function () {
    if (window.switchView) window.switchView('docker');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+4', 'Go to Tickets', function () {
    if (window.switchView) window.switchView('tickets');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+5', 'Go to Git', function () {
    if (window.switchView) window.switchView('git');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+6', 'Go to SQL Editor', function () {
    if (window.switchView) window.switchView('sql-editor');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+7', 'Go to Security', function () {
    if (window.switchView) window.switchView('security');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+8', 'Go to Deploy', function () {
    if (window.switchView) window.switchView('deploy');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+9', 'Go to GitHub Hub', function () {
    if (window.switchView) window.switchView('github-hub');
  }, { group: 'Navigation' });

  // Terminal
  Hotkeys.register('ctrl+`', 'Toggle terminal drawer', function () {
    if (window.Views && window.Views.terminal) window.Views.terminal.toggleDrawer();
  }, { group: 'Terminal', allowInInput: true, allowInTerminal: true });

  Hotkeys.register('ctrl+shift+`', 'Cycle terminal size', function () {
    if (window.Views && window.Views.terminal) window.Views.terminal.cycleSize();
  }, { group: 'Terminal', allowInInput: true, allowInTerminal: true });

  // Actions
  Hotkeys.register('ctrl+k', 'Command palette', function () {
    if (typeof Toast !== 'undefined') Toast.info('Command palette coming soon');
  }, { group: 'Actions', allowInInput: false });

  Hotkeys.register('ctrl+shift+r', 'Refresh current view', function () {
    if (window.refreshCurrentView) window.refreshCurrentView();
  }, { group: 'Actions' });

  // Note: Escape is handled by modal.js for modals and by the help overlay above.
  // Not registered as a hotkey to avoid double-firing with modal system.

  Hotkeys.register('alt+s', 'Go to Settings', function () {
    if (window.switchView) window.switchView('settings');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+u', 'Go to Uptime', function () {
    if (window.switchView) window.switchView('uptime');
  }, { group: 'Navigation' });

  Hotkeys.register('alt+n', 'Go to Notifications', function () {
    if (window.switchView) window.switchView('notification-center');
  }, { group: 'Navigation' });

  // ── Expose Globally ───────────────────────────────────────────────────
  window.Hotkeys = Hotkeys;

})();
