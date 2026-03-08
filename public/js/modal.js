/**
 * Bulwark v2.1 — Glass Modal System
 * Global Modal object for dialogs, confirms, alerts
 */

(function () {
  'use strict';

  var Modal = {};

  // Track active modals
  Modal._active = [];

  // Size class map
  var sizeClasses = {
    sm: 'modal-sm',
    lg: 'modal-lg',
    xl: 'modal-xl'
  };

  /**
   * Open a modal dialog
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.body - HTML content for the body
   * @param {string} [options.footer] - HTML content for the footer
   * @param {string} [options.size] - 'sm', 'lg', 'xl' (default: medium)
   * @param {Function} [options.onClose] - Callback when modal closes
   * @param {string} [options.className] - Additional CSS class
   * @returns {HTMLElement} overlay element
   */
  Modal.open = function (options) {
    options = options || {};

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9000;' +
      'background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;' +
      'justify-content:center;animation:modalFadeIn 0.15s ease-out;';

    var sizeClass = options.size ? (sizeClasses[options.size] || '') : '';
    var extraClass = options.className ? ' ' + options.className : '';

    // Determine width based on size
    var widthStyle = 'width:480px;max-width:90vw;';
    if (options.size === 'sm') {
      widthStyle = 'width:360px;max-width:90vw;';
    } else if (options.size === 'lg') {
      widthStyle = 'width:640px;max-width:90vw;';
    } else if (options.size === 'xl') {
      widthStyle = 'width:860px;max-width:95vw;';
    }

    var panel = document.createElement('div');
    panel.className = 'modal-panel ' + sizeClass + extraClass;
    panel.style.cssText = widthStyle + 'max-height:85vh;background:var(--surface-solid, #1a1d27);' +
      'border:1px solid var(--border, #2a2d37);border-radius:12px;display:flex;flex-direction:column;' +
      'box-shadow:0 24px 48px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.05);' +
      'animation:modalSlideIn 0.15s ease-out;';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;' +
      'padding:16px 20px;border-bottom:1px solid var(--border, #2a2d37);flex-shrink:0;';

    var titleEl = document.createElement('h3');
    titleEl.style.cssText = 'font-size:14px;font-weight:600;color:var(--text-primary, #e2e8f0);margin:0;';
    titleEl.textContent = options.title || '';

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:var(--text-tertiary, #64748b);cursor:pointer;' +
      'font-size:18px;padding:0 4px;line-height:1;transition:color 0.15s;';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.onmouseover = function () { closeBtn.style.color = 'var(--text-primary, #e2e8f0)'; };
    closeBtn.onmouseout = function () { closeBtn.style.color = 'var(--text-tertiary, #64748b)'; };
    closeBtn.onclick = function () { Modal.close(overlay); };

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    // Body
    var body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = 'padding:20px;overflow-y:auto;flex:1;font-size:13px;color:var(--text-secondary, #94a3b8);';
    if (options.body) {
      body.innerHTML = options.body;
    }

    panel.appendChild(header);
    panel.appendChild(body);

    // Footer (optional)
    if (options.footer) {
      var footer = document.createElement('div');
      footer.className = 'modal-footer';
      footer.style.cssText = 'padding:12px 20px;border-top:1px solid var(--border, #2a2d37);' +
        'display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;';
      footer.innerHTML = options.footer;
      panel.appendChild(footer);
    }

    overlay.appendChild(panel);

    // Store onClose callback and reference
    overlay._onClose = options.onClose || null;
    overlay._panel = panel;

    // Backdrop click closes
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        Modal.close(overlay);
      }
    });

    // Escape key closes
    overlay._keyHandler = function (e) {
      if (e.key === 'Escape') {
        // Close topmost modal
        if (Modal._active.length > 0 && Modal._active[Modal._active.length - 1] === overlay) {
          Modal.close(overlay);
        }
      }
    };
    document.addEventListener('keydown', overlay._keyHandler);

    // Inject animation keyframes if not already present
    ensureAnimationStyles();

    document.body.appendChild(overlay);
    Modal._active.push(overlay);

    return overlay;
  };

  /**
   * Close a modal with exit animation
   * @param {HTMLElement} overlay
   */
  Modal.close = function (overlay) {
    // If no overlay specified, close the topmost modal
    if (!overlay && Modal._active.length > 0) {
      overlay = Modal._active[Modal._active.length - 1];
    }
    if (!overlay || !overlay.parentNode) return;

    // Remove from active list
    var idx = Modal._active.indexOf(overlay);
    if (idx !== -1) {
      Modal._active.splice(idx, 1);
    }

    // Remove key handler
    if (overlay._keyHandler) {
      document.removeEventListener('keydown', overlay._keyHandler);
    }

    // Play exit animation
    overlay.style.animation = 'modalFadeOut 0.15s ease-in forwards';
    if (overlay._panel) {
      overlay._panel.style.animation = 'modalSlideOut 0.15s ease-in forwards';
    }

    setTimeout(function () {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (typeof overlay._onClose === 'function') {
        overlay._onClose();
      }
    }, 150);
  };

  /**
   * Show a confirmation dialog
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.confirmText='Confirm']
   * @param {boolean} [options.dangerous=false] - Makes confirm button orange
   * @returns {Promise<boolean>}
   */
  Modal.confirm = function (options) {
    options = options || {};

    return new Promise(function (resolve) {
      var confirmText = options.confirmText || 'Confirm';
      var dangerousStyle = options.dangerous
        ? 'background:var(--orange, #ff6b2b);border-color:var(--orange, #ff6b2b);color:#fff;'
        : 'background:var(--cyan, #22d3ee);border-color:var(--cyan, #22d3ee);color:#000;';

      var bodyHtml = '<p style="margin:0;line-height:1.5;">' + escapeHtml(options.message || '') + '</p>';

      var overlay = Modal.open({
        title: options.title || 'Confirm',
        body: bodyHtml,
        size: 'sm',
        onClose: function () {
          resolve(false);
        }
      });

      // Replace onClose to prevent double-resolve
      var resolved = false;

      // Add footer buttons manually
      var footer = document.createElement('div');
      footer.style.cssText = 'padding:12px 20px;border-top:1px solid var(--border, #2a2d37);' +
        'display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-sm';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = function () {
        if (!resolved) {
          resolved = true;
          overlay._onClose = null;
          Modal.close(overlay);
          resolve(false);
        }
      };

      var confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-sm';
      confirmBtn.style.cssText = dangerousStyle + 'font-weight:600;';
      confirmBtn.textContent = confirmText;
      confirmBtn.onclick = function () {
        if (!resolved) {
          resolved = true;
          overlay._onClose = null;
          Modal.close(overlay);
          resolve(true);
        }
      };

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
      overlay._panel.appendChild(footer);

      // Update onClose to respect resolved state
      overlay._onClose = function () {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };
    });
  };

  /**
   * Show loading state on the current (topmost) modal
   * Replaces body with spinner and hides footer
   * @param {string} [message='Loading...']
   */
  Modal.loading = function (message) {
    var overlay = Modal._active.length > 0 ? Modal._active[Modal._active.length - 1] : null;
    if (!overlay) return;
    Modal.showLoading(overlay, message);
    // Hide footer while loading
    var footer = overlay.querySelector('.modal-footer');
    if (footer) footer.style.display = 'none';
  };

  /**
   * Replace modal body with a loading spinner
   * @param {HTMLElement} overlay
   * @param {string} [message='Loading...']
   */
  Modal.showLoading = function (overlay, message) {
    if (!overlay) return;
    var body = overlay.querySelector('.modal-body');
    if (!body) return;

    message = message || 'Loading...';
    body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;padding:32px 0;gap:12px;">' +
      '<div style="width:28px;height:28px;border:2px solid var(--border, #2a2d37);' +
      'border-top-color:var(--cyan, #22d3ee);border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
      '<div style="font-size:13px;color:var(--text-secondary, #94a3b8);">' + escapeHtml(message) + '</div>' +
      '</div>';
  };

  /**
   * Show a simple alert dialog
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @returns {Promise<void>}
   */
  Modal.alert = function (options) {
    options = options || {};

    return new Promise(function (resolve) {
      var bodyHtml = '<p style="margin:0;line-height:1.5;">' + escapeHtml(options.message || '') + '</p>';

      var overlay = Modal.open({
        title: options.title || 'Alert',
        body: bodyHtml,
        size: 'sm',
        onClose: function () {
          resolve();
        }
      });

      // Add OK button footer
      var footer = document.createElement('div');
      footer.style.cssText = 'padding:12px 20px;border-top:1px solid var(--border, #2a2d37);' +
        'display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;';

      var okBtn = document.createElement('button');
      okBtn.className = 'btn btn-sm btn-primary';
      okBtn.textContent = 'OK';
      okBtn.onclick = function () {
        overlay._onClose = null;
        Modal.close(overlay);
        resolve();
      };

      footer.appendChild(okBtn);
      overlay._panel.appendChild(footer);
    });
  };

  // ── Helpers ──

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  var animationStylesInjected = false;
  function ensureAnimationStyles() {
    if (animationStylesInjected) return;
    animationStylesInjected = true;

    var style = document.createElement('style');
    style.textContent =
      '@keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }' +
      '@keyframes modalFadeOut { from { opacity: 1; } to { opacity: 0; } }' +
      '@keyframes modalSlideIn { from { opacity: 0; transform: scale(0.95) translateY(-10px); } ' +
      'to { opacity: 1; transform: scale(1) translateY(0); } }' +
      '@keyframes modalSlideOut { from { opacity: 1; transform: scale(1) translateY(0); } ' +
      'to { opacity: 0; transform: scale(0.95) translateY(-10px); } }';
    document.head.appendChild(style);
  }

  // ── Expose Globally ──
  window.Modal = Modal;

})();
