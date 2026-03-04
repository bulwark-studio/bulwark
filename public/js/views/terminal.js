/**
 * Chester Dev Monitor v2.0 — Terminal View
 * xterm.js v5 PTY terminal with FitAddon + Socket.IO
 */
(function () {
  'use strict';

  var term = null;
  var fitAddon = null;
  var termStarted = false;
  var resizeHandler = null;

  /**
   * Detect session-ended marker from server output.
   * The server emits terminal_output with "[Session ended]" when the PTY exits.
   * There is no separate terminal_exit event.
   */
  function handleOutput(data) {
    if (!term) return;
    term.write(data);
    if (typeof data === 'string' && data.indexOf('[Session ended]') !== -1) {
      onSessionEnded();
    }
  }

  function onSessionEnded() {
    termStarted = false;
    var btn = document.getElementById('term-start-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Restart Session';
    }
    updateStatusIndicator(false);
  }

  function updateStatusIndicator(running) {
    var dot = document.getElementById('term-status-dot');
    var label = document.getElementById('term-status-label');
    if (dot) {
      dot.style.background = running ? '#22d3ee' : 'var(--text-disabled, #4a5568)';
    }
    if (label) {
      label.textContent = running ? 'Connected' : 'Disconnected';
      label.style.color = running ? '#22d3ee' : 'var(--text-tertiary, #64748b)';
    }
  }

  /**
   * Emit terminal_resize to the server so node-pty resizes the PTY.
   */
  function emitResize() {
    if (term && termStarted) {
      socket.emit('terminal_resize', { cols: term.cols, rows: term.rows });
    }
  }

  /**
   * Safely call fitAddon.fit() then notify the server of the new dimensions.
   */
  function fitTerminal() {
    if (!fitAddon) return;
    try {
      fitAddon.fit();
      emitResize();
    } catch (e) {
      // FitAddon can throw if the container is hidden or has zero size
    }
  }

  Views.terminal = {
    init: function () {
      var container = document.getElementById('view-terminal');
      if (!container) return;

      container.innerHTML =
        // Terminal header bar (macOS-style dots + status)
        '<div class="terminal-header">' +
          '<div class="terminal-header-left">' +
            '<div class="terminal-dots">' +
              '<span class="terminal-dot red"></span>' +
              '<span class="terminal-dot yellow"></span>' +
              '<span class="terminal-dot green"></span>' +
            '</div>' +
            '<span class="terminal-title">PTY Shell</span>' +
          '</div>' +
          '<div class="terminal-header-right">' +
            '<button class="btn btn-sm btn-cyan" id="term-start-btn">Start Session</button>' +
          '</div>' +
        '</div>' +
        // Terminal body
        '<div id="terminal-container" class="terminal-container" style="height:calc(100vh - 200px)"></div>' +
        // Status bar
        '<div class="terminal-status-bar">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<span id="term-status-dot" style="width:6px;height:6px;border-radius:50%;background:var(--text-disabled, #4a5568)"></span>' +
            '<span id="term-status-label" style="color:var(--text-tertiary, #64748b)">Disconnected</span>' +
          '</div>' +
          '<span id="term-size-label" style="color:var(--text-tertiary, #64748b)"></span>' +
        '</div>';

      // Bind start button
      var btn = document.getElementById('term-start-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          startTerminalSession();
        });
      }

      // Socket event: receive PTY output
      socket.on('terminal_output', handleOutput);

      // Socket reconnect: previous PTY was killed on disconnect, so reset state
      socket.on('connect', function () {
        if (termStarted) {
          // The server killed the PTY on socket disconnect. Reset client state.
          termStarted = false;
          updateStatusIndicator(false);
          if (term) {
            term.write('\r\n\x1b[33m[Reconnected — previous session ended]\x1b[0m\r\n');
          }
          var rbtn = document.getElementById('term-start-btn');
          if (rbtn) {
            rbtn.disabled = false;
            rbtn.textContent = 'Restart Session';
          }
        }
      });
    },

    show: function () {
      ensureTerminalCreated();
      // Refit after the view becomes visible (display:none -> display:block)
      setTimeout(function () {
        fitTerminal();
        updateSizeLabel();
      }, 50);
      // Auto-start if not already running
      if (!termStarted) {
        // Small delay so the terminal container is visible and fit has run
        setTimeout(function () {
          startTerminalSession();
        }, 150);
      }
    },

    hide: function () {
      // Keep session alive — don't destroy term or kill PTY
    },

    update: function () {}
  };

  /**
   * Create the xterm.js Terminal instance if it doesn't exist yet.
   */
  function ensureTerminalCreated() {
    if (term) return;

    var container = document.getElementById('terminal-container');
    if (!container) return;

    // Verify CDN globals are available
    if (typeof Terminal === 'undefined') {
      container.innerHTML =
        '<div style="padding:24px;color:#ff6b2b;font-family:monospace">' +
        '[ERROR] xterm.js not loaded. Check CDN script in index.html.</div>';
      return;
    }
    if (typeof FitAddon === 'undefined') {
      container.innerHTML =
        '<div style="padding:24px;color:#ff6b2b;font-family:monospace">' +
        '[ERROR] xterm-addon-fit not loaded. Check CDN script in index.html.</div>';
      return;
    }

    term = new Terminal({
      theme: {
        background: '#0a0b10',
        foreground: '#e2e8f0',
        cursor: '#22d3ee',
        cursorAccent: '#0a0b10',
        selectionBackground: 'rgba(34,211,238,0.15)',
        selectionForeground: '#e2e8f0',
        black: '#0f1117',
        brightBlack: '#2a2d37',
        red: '#ff6b2b',
        brightRed: '#ff8a57',
        green: '#22d3ee',
        brightGreen: '#67e8f9',
        yellow: '#eab308',
        brightYellow: '#fde047',
        blue: '#3b82f6',
        brightBlue: '#60a5fa',
        magenta: '#a855f7',
        brightMagenta: '#c084fc',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#e2e8f0',
        brightWhite: '#f8fafc'
      },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Fira Code', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
      scrollback: 5000,
      convertEol: true
    });

    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitTerminal();

    // Send keystrokes to the server PTY
    term.onData(function (data) {
      if (termStarted) {
        socket.emit('terminal_input', data);
      }
    });

    // Handle window resize: refit terminal to container
    resizeHandler = function () {
      if (state.currentView === 'terminal') {
        fitTerminal();
        updateSizeLabel();
      }
    };
    window.addEventListener('resize', resizeHandler);

    // Welcome message
    term.write('\x1b[36mChester Dev Monitor\x1b[0m — PTY Terminal\r\n');
    term.write('\x1b[90mStarting session...\x1b[0m\r\n\r\n');
  }

  /**
   * Start (or restart) a PTY session on the server.
   */
  function startTerminalSession() {
    if (termStarted) return;
    ensureTerminalCreated();
    if (!term) return;

    termStarted = true;

    var btn = document.getElementById('term-start-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Session Active';
    }

    updateStatusIndicator(true);
    term.clear();
    term.focus();

    var cols = term.cols || 80;
    var rows = term.rows || 24;
    socket.emit('terminal_start', { cols: cols, rows: rows });

    updateSizeLabel();
    Toast.info('Terminal session started');
  }

  /**
   * Display current terminal dimensions in the status bar.
   */
  function updateSizeLabel() {
    var label = document.getElementById('term-size-label');
    if (label && term) {
      label.textContent = term.cols + ' x ' + term.rows;
    }
  }

  // Expose for any external callers (backwards compat)
  window.startTerminal = startTerminalSession;

})();
