/**
 * Bulwark v2.1 — Toast Notification System
 * Global Toast object for success, error, warning, info messages
 */

(function () {
  'use strict';

  var Toast = {};

  // Max visible toasts
  var MAX_VISIBLE = 5;

  // Container element (lazy-created)
  var container = null;

  // Style injected flag
  var stylesInjected = false;

  /**
   * Get or create the toast container
   */
  function getContainer() {
    if (container && container.parentNode) return container;

    container = document.createElement('div');
    container.className = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:32px;right:20px;z-index:9500;' +
      'display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:380px;';
    document.body.appendChild(container);

    ensureStyles();
    return container;
  }

  /**
   * Inject toast CSS animations and styles
   */
  function ensureStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    var style = document.createElement('style');
    style.textContent =
      '@keyframes toastSlideIn { from { opacity:0; transform:translateX(100%); } ' +
      'to { opacity:1; transform:translateX(0); } }' +
      '@keyframes toastFadeOut { from { opacity:1; transform:translateX(0); } ' +
      'to { opacity:0; transform:translateX(100%); } }' +
      '.toast-item { pointer-events:auto; display:flex; align-items:flex-start; gap:10px; ' +
      'padding:12px 16px; border-radius:8px; font-size:12px; font-family:inherit; ' +
      'background:var(--surface-solid, #1a1d27); border:1px solid var(--border, #2a2d37); ' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.05); ' +
      'animation:toastSlideIn 0.2s ease-out; cursor:pointer; max-width:380px; ' +
      'color:var(--text-primary, #e2e8f0); line-height:1.4; position:relative; overflow:hidden; }' +
      '.toast-item.removing { animation:toastFadeOut 0.2s ease-in forwards; }' +
      '.toast-icon { flex-shrink:0; width:16px; height:16px; margin-top:1px; }' +
      '.toast-message { flex:1; word-break:break-word; }' +
      '.toast-close { flex-shrink:0; background:none; border:none; color:var(--text-tertiary, #64748b); ' +
      'cursor:pointer; font-size:14px; padding:0 2px; line-height:1; transition:color 0.15s; }' +
      '.toast-close:hover { color:var(--text-primary, #e2e8f0); }' +
      '.toast-progress { position:absolute; bottom:0; left:0; height:2px; ' +
      'background:currentColor; opacity:0.3; border-radius:0 0 8px 8px; ' +
      'transition:none; }';
    document.head.appendChild(style);
  }

  // Type configuration: color, icon SVG, border accent color
  var typeConfig = {
    success: {
      color: '#22d3ee',
      borderColor: 'rgba(34,211,238,0.3)',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" class="toast-icon">' +
        '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    },
    error: {
      color: '#ff6b2b',
      borderColor: 'rgba(255,107,43,0.3)',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff6b2b" stroke-width="2" class="toast-icon">' +
        '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>' +
        '<line x1="9" y1="9" x2="15" y2="15"/></svg>'
    },
    warning: {
      color: '#eab308',
      borderColor: 'rgba(234,179,8,0.3)',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" class="toast-icon">' +
        '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>' +
        '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    },
    info: {
      color: '#3b82f6',
      borderColor: 'rgba(59,130,246,0.3)',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" class="toast-icon">' +
        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>' +
        '<line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    }
  };

  /**
   * Show a toast notification
   * @param {Object} options
   * @param {string} options.message - Toast message text
   * @param {string} [options.type='info'] - 'success', 'error', 'warning', 'info'
   * @param {number} [options.duration=3000] - Auto-dismiss in ms (0 = no auto-dismiss)
   */
  Toast.show = function (options) {
    options = options || {};
    var message = options.message || '';
    var type = options.type || 'info';
    var duration = typeof options.duration === 'number' ? options.duration : 3000;

    var cfg = typeConfig[type] || typeConfig.info;
    var cont = getContainer();

    // Enforce max visible — remove oldest if at limit
    var existing = cont.querySelectorAll('.toast-item:not(.removing)');
    if (existing.length >= MAX_VISIBLE) {
      removeToast(existing[0]);
    }

    // Create toast element
    var toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.style.borderLeftColor = cfg.borderColor;
    toast.style.borderLeft = '3px solid ' + cfg.color;

    toast.innerHTML = cfg.icon +
      '<span class="toast-message">' + escapeHtml(message) + '</span>' +
      '<button class="toast-close" aria-label="Close">&times;</button>';

    // Add progress bar if auto-dismiss is enabled
    if (duration > 0) {
      var progressBar = document.createElement('div');
      progressBar.className = 'toast-progress';
      progressBar.style.width = '100%';
      progressBar.style.color = cfg.color;
      progressBar.style.background = cfg.color;
      toast.appendChild(progressBar);

      // Animate the progress bar drain after a frame
      requestAnimationFrame(function () {
        progressBar.style.transition = 'width ' + duration + 'ms linear';
        progressBar.style.width = '0%';
      });
    }

    // Close on click
    toast.querySelector('.toast-close').onclick = function (e) {
      e.stopPropagation();
      removeToast(toast);
    };
    toast.onclick = function () {
      removeToast(toast);
    };

    cont.appendChild(toast);

    // Auto-remove after duration
    if (duration > 0) {
      toast._timeout = setTimeout(function () {
        removeToast(toast);
      }, duration);
    }

    return toast;
  };

  /**
   * Remove a toast with fade animation
   */
  function removeToast(toast) {
    if (!toast || toast.classList.contains('removing')) return;

    if (toast._timeout) {
      clearTimeout(toast._timeout);
    }

    toast.classList.add('removing');
    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }

  /**
   * Escape HTML for safe insertion
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Shorthand Methods ──

  Toast.success = function (msg) {
    return Toast.show({ message: msg, type: 'success' });
  };

  Toast.error = function (msg) {
    return Toast.show({ message: msg, type: 'error', duration: 5000 });
  };

  Toast.warning = function (msg) {
    return Toast.show({ message: msg, type: 'warning', duration: 4000 });
  };

  Toast.info = function (msg) {
    return Toast.show({ message: msg, type: 'info' });
  };

  // ── Expose Globally ──
  window.Toast = Toast;

})();
