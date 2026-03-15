/**
 * Bulwark v3.0 — Uptime Intelligence Center
 * Real-time server monitoring, latency tracking, content-aware web monitoring, AI incident analysis
 */
(function () {
  'use strict';

  var refreshTimer = null;
  var serverData = [];
  var uptimeData = [];
  var latencyHistory = {}; // { serverId: [{ts, latency}] }

  var IC = {
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    brain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z"/><path d="M9 21h6"/></svg>',
    refresh: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    server: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    cloud: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    monitor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    zap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    activity: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    hash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    edit: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
  };

  Views.uptime = {
    init: function () {
      var c = document.getElementById('view-uptime');
      if (!c) return;
      c.innerHTML =
        '<div class="overview-grid">' +

        /* ── AI Incident Analysis ── */
        '<div class="briefing-card" id="uptime-ai-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-label">' + IC.brain + ' AI Uptime Analysis <span id="uptime-ai-freshness"></span></div>' +
            '<button class="briefing-refresh" onclick="Views.uptime.aiAnalysis(true)">' + IC.zap + ' Analyze</button>' +
          '</div>' +
          '<div class="briefing-text" id="uptime-ai-text">' +
            '<span style="color:var(--text-secondary)">Click Analyze for AI-powered uptime and reliability insights</span>' +
          '</div>' +
        '</div>' +

        /* ── Global Status Banner ── */
        '<div class="uptime-status-banner" id="uptime-banner">' +
          '<div class="uptime-banner-left">' +
            '<div class="uptime-banner-icon" id="uptime-banner-icon"></div>' +
            '<div><div class="uptime-banner-title" id="uptime-banner-title">Checking...</div>' +
            '<div class="uptime-banner-sub" id="uptime-banner-sub">Loading server status</div></div>' +
          '</div>' +
          '<div class="uptime-banner-stats" id="uptime-banner-stats"></div>' +
        '</div>' +

        /* ── Server Cards ── */
        '<div class="uptime-section-title">' + IC.server + ' Connected Servers <span class="uptime-badge" id="srv-count">0</span></div>' +
        '<div id="uptime-servers" class="uptime-servers-grid"></div>' +

        /* ── Latency Chart ── */
        '<div class="metrics-panel">' +
          '<div class="metrics-panel-header"><span>' + IC.activity + ' Response Time History</span><span class="metrics-live-dot"></span></div>' +
          '<div class="metrics-chart-wrap"><canvas id="uptime-latency-chart" height="200"></canvas></div>' +
        '</div>' +

        /* ── Monitored Endpoints ── */
        '<div class="uptime-section-title">' + IC.globe + ' Monitored Endpoints ' +
          '<button class="uptime-add-btn" onclick="Views.uptime.addEndpoint()">' + IC.plus + ' Add</button>' +
        '</div>' +
        '<div id="uptime-endpoints"></div>' +

        '</div>'; // end grid
    },

    show: function () {
      loadAll();
      Views.uptime.aiAnalysis(false);
      // Auto-refresh every 30s
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(loadAll, 30000);
    },

    hide: function () {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    },

    update: function (data) {
      if (data && data.servers) {
        serverData = data.servers;
        renderServers();
        updateBanner();
      }
    },

    // ── AI Analysis ──────────────────────────────────────────────────
    aiAnalysis: function (force) {
      var el = document.getElementById('uptime-ai-text');
      if (!el) return;
      if (!force && window.AICache) {
        var restored = window.AICache.restore('uptime');
        if (restored) {
          el.textContent = restored.response;
          var fb = document.getElementById('uptime-ai-freshness');
          if (fb) fb.innerHTML = window.AICache.freshnessBadge('uptime');
          return;
        }
        // No cache and not forced — don't auto-fetch, wait for user click
        return;
      }
      if (!force) return;
      el.innerHTML = '<div class="briefing-shimmer" style="width:90%"></div><div class="briefing-shimmer" style="width:65%"></div>';

      var ctx = serverData.map(function (s) {
        return s.name + ': ' + s.status + ', latency ' + (s.latency || 0) + 'ms' +
          (s.system ? ', CPU ' + (s.system.cpuPct || 0) + '%, Mem ' + (s.system.usedMemPct || 0) + '%, uptime ' + ((s.system.uptimeHours || 0).toFixed(1)) + 'h' : '') +
          (s.error ? ' ERROR: ' + s.error : '');
      }).join('. ');

      var epCtx = uptimeData.map(function (ep) {
        var pct24 = ep.uptime24h !== null ? ep.uptime24h + '%' : 'no data';
        var avgLat = calcAvgLatency(ep.recentChecks || []);
        var downs = (ep.recentChecks || []).filter(function (c) { return !c.ok; }).length;
        var contentInfo = ep.contentMonitor && ep.contentMonitor.enabled ? ', content changes: ' + (ep.contentChanges || 0) : '';
        return ep.name + ': 24h uptime ' + pct24 + ', avg latency ' + avgLat + 'ms, ' + downs + ' failures in last 90 checks' + contentInfo;
      }).join('. ');

      var prompt = 'Analyze this infrastructure uptime data. Servers: ' + (ctx || 'none') +
        '. Endpoints: ' + (epCtx || 'none') +
        '. Give 2-3 sentences about reliability, latency trends, potential risks, and recommendations. Be specific with numbers. No markdown.';

      fetch('/api/db/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      }).then(safeJson).then(function (d) {
        var text = d.response || d.error || 'Analysis unavailable';
        typeWriter(el, text);
        if (window.AICache) {
          window.AICache.set('uptime', {}, text);
          var fb = document.getElementById('uptime-ai-freshness');
          if (fb) fb.innerHTML = window.AICache.freshnessBadge('uptime');
        }
      }).catch(function () {
        el.textContent = 'AI analysis unavailable';
      });
    },

    // ── Add Endpoint ─────────────────────────────────────────────────
    addEndpoint: function () {
      Modal.open({
        title: 'Add Monitored Endpoint', size: 'md',
        body:
          '<div class="form-group"><label class="form-label">Name</label><input id="up-name" class="form-input" placeholder="My API"></div>' +
          '<div class="form-group"><label class="form-label">URL</label><input id="up-url" class="form-input" placeholder="https://api.example.com/health"></div>' +
          '<div class="form-row-2">' +
            '<div class="form-group"><label class="form-label">Check Interval (seconds)</label><input id="up-interval" class="form-input" type="number" value="60"></div>' +
            '<div class="form-group"><label class="form-label">Expected Status Code</label><input id="up-status" class="form-input" type="number" value="200"></div>' +
          '</div>' +
          '<div class="cm-divider"></div>' +
          '<div class="cm-toggle-row">' +
            '<label class="form-label" style="margin:0">' + IC.eye + ' Content Monitoring</label>' +
            '<label class="cm-switch"><input type="checkbox" id="up-cm-enabled"><span class="cm-slider"></span></label>' +
          '</div>' +
          '<div id="up-cm-options" class="cm-options" style="display:none">' +
            '<div class="form-group"><label class="form-label">Monitor Mode</label>' +
              '<select id="up-cm-mode" class="form-input"><option value="text">Text content (ignore HTML structure)</option><option value="full">Full HTML (detect any change)</option><option value="selector">CSS Selector (monitor specific element)</option></select></div>' +
            '<div class="form-group" id="up-cm-selector-group" style="display:none"><label class="form-label">CSS Selector</label><input id="up-cm-selector" class="form-input" placeholder="#main-content, .price, h1"></div>' +
            '<div class="form-group"><label class="form-label">Required Keywords <span style="color:var(--text-tertiary);font-weight:400">(comma-separated)</span></label><input id="up-cm-keywords" class="form-input" placeholder="OK, healthy, running"></div>' +
            '<div class="form-group"><label class="form-label">Forbidden Keywords <span style="color:var(--text-tertiary);font-weight:400">(comma-separated)</span></label><input id="up-cm-forbidden" class="form-input" placeholder="error, maintenance, 503"></div>' +
          '</div>',
        footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="up-save">Add Endpoint</button>'
      });
      setTimeout(function () {
        var toggle = document.getElementById('up-cm-enabled');
        var opts = document.getElementById('up-cm-options');
        var modeSelect = document.getElementById('up-cm-mode');
        var selectorGroup = document.getElementById('up-cm-selector-group');
        if (toggle) toggle.onchange = function () { opts.style.display = toggle.checked ? '' : 'none'; };
        if (modeSelect) modeSelect.onchange = function () { selectorGroup.style.display = modeSelect.value === 'selector' ? '' : 'none'; };

        var btn = document.getElementById('up-save');
        if (btn) btn.onclick = function () {
          var name = (document.getElementById('up-name') || {}).value;
          var url = (document.getElementById('up-url') || {}).value;
          var interval = parseInt((document.getElementById('up-interval') || {}).value) || 60;
          var expectedStatus = parseInt((document.getElementById('up-status') || {}).value) || 200;
          if (!name || !url) { Toast.warning('Name and URL required'); return; }

          var payload = { name: name, url: url, interval: interval, expectedStatus: expectedStatus };

          if (toggle && toggle.checked) {
            var mode = (document.getElementById('up-cm-mode') || {}).value || 'text';
            var selector = (document.getElementById('up-cm-selector') || {}).value || '';
            var keywords = parseCommaSep((document.getElementById('up-cm-keywords') || {}).value);
            var forbidden = parseCommaSep((document.getElementById('up-cm-forbidden') || {}).value);
            payload.contentMonitor = {
              enabled: true,
              mode: mode,
              selector: mode === 'selector' ? selector : '',
              keywords: keywords,
              forbidden: forbidden
            };
          }

          fetch('/api/uptime/endpoints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(safeJson).then(function (d) {
              if (d.error) { Toast.error(d.error); return; }
              Toast.success('Endpoint added');
              Modal.close(btn.closest('.modal-overlay'));
              loadEndpoints();
            }).catch(function () { Toast.error('Failed'); });
        };
      }, 50);
    },

    // ── Edit Endpoint (toggle content monitoring) ─────────────────────
    editEndpoint: function (id) {
      var ep = uptimeData.find(function (e) { return e.id === id; });
      if (!ep) return;
      var cm = ep.contentMonitor || {};

      Modal.open({
        title: 'Edit: ' + esc(ep.name), size: 'md',
        body:
          '<div class="form-group"><label class="form-label">Name</label><input id="ep-name" class="form-input" value="' + esc(ep.name) + '"></div>' +
          '<div class="form-group"><label class="form-label">URL</label><input id="ep-url" class="form-input" value="' + esc(ep.url) + '"></div>' +
          '<div class="form-row-2">' +
            '<div class="form-group"><label class="form-label">Interval (s)</label><input id="ep-interval" class="form-input" type="number" value="' + (ep.interval || 60) + '"></div>' +
            '<div class="form-group"><label class="form-label">Expected Status</label><input id="ep-status" class="form-input" type="number" value="' + (ep.expectedStatus || 200) + '"></div>' +
          '</div>' +
          '<div class="cm-divider"></div>' +
          '<div class="cm-toggle-row">' +
            '<label class="form-label" style="margin:0">' + IC.eye + ' Content Monitoring</label>' +
            '<label class="cm-switch"><input type="checkbox" id="ep-cm-enabled"' + (cm.enabled ? ' checked' : '') + '><span class="cm-slider"></span></label>' +
          '</div>' +
          '<div id="ep-cm-options" class="cm-options"' + (cm.enabled ? '' : ' style="display:none"') + '>' +
            '<div class="form-group"><label class="form-label">Monitor Mode</label>' +
              '<select id="ep-cm-mode" class="form-input"><option value="text"' + (cm.mode === 'text' || !cm.mode ? ' selected' : '') + '>Text content</option><option value="full"' + (cm.mode === 'full' ? ' selected' : '') + '>Full HTML</option><option value="selector"' + (cm.mode === 'selector' ? ' selected' : '') + '>CSS Selector</option></select></div>' +
            '<div class="form-group" id="ep-cm-selector-group"' + (cm.mode === 'selector' ? '' : ' style="display:none"') + '><label class="form-label">CSS Selector</label><input id="ep-cm-selector" class="form-input" value="' + esc(cm.selector || '') + '"></div>' +
            '<div class="form-group"><label class="form-label">Required Keywords</label><input id="ep-cm-keywords" class="form-input" value="' + esc((cm.keywords || []).join(', ')) + '"></div>' +
            '<div class="form-group"><label class="form-label">Forbidden Keywords</label><input id="ep-cm-forbidden" class="form-input" value="' + esc((cm.forbidden || []).join(', ')) + '"></div>' +
          '</div>',
        footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="ep-save">Save</button>'
      });
      setTimeout(function () {
        var toggle = document.getElementById('ep-cm-enabled');
        var opts = document.getElementById('ep-cm-options');
        var modeSelect = document.getElementById('ep-cm-mode');
        var selectorGroup = document.getElementById('ep-cm-selector-group');
        if (toggle) toggle.onchange = function () { opts.style.display = toggle.checked ? '' : 'none'; };
        if (modeSelect) modeSelect.onchange = function () { selectorGroup.style.display = modeSelect.value === 'selector' ? '' : 'none'; };

        var btn = document.getElementById('ep-save');
        if (btn) btn.onclick = function () {
          var payload = {
            name: (document.getElementById('ep-name') || {}).value || ep.name,
            url: (document.getElementById('ep-url') || {}).value || ep.url,
            interval: parseInt((document.getElementById('ep-interval') || {}).value) || 60,
            expectedStatus: parseInt((document.getElementById('ep-status') || {}).value) || 200
          };

          if (toggle && toggle.checked) {
            var mode = (document.getElementById('ep-cm-mode') || {}).value || 'text';
            payload.contentMonitor = {
              enabled: true,
              mode: mode,
              selector: mode === 'selector' ? (document.getElementById('ep-cm-selector') || {}).value || '' : '',
              keywords: parseCommaSep((document.getElementById('ep-cm-keywords') || {}).value),
              forbidden: parseCommaSep((document.getElementById('ep-cm-forbidden') || {}).value)
            };
          } else {
            payload.contentMonitor = { enabled: false };
          }

          fetch('/api/uptime/endpoints/' + encodeURIComponent(id), {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          }).then(safeJson).then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Endpoint updated');
            Modal.close(btn.closest('.modal-overlay'));
            loadEndpoints();
          }).catch(function () { Toast.error('Failed'); });
        };
      }, 50);
    },

    // ── Content History Modal ─────────────────────────────────────────
    contentHistory: function (id) {
      var ep = uptimeData.find(function (e) { return e.id === id; });
      if (!ep) return;

      Modal.open({
        title: IC.hash + ' Content History: ' + esc(ep.name), size: 'lg',
        body: '<div id="cm-history-body"><div class="briefing-shimmer" style="width:80%"></div></div>',
        footer: '<button class="btn btn-sm btn-cyan" id="cm-check-now">Check Now</button>' +
          '<button class="btn btn-sm btn-cyan" id="cm-ai-analyze" style="margin-left:8px">AI Analyze</button>' +
          '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))" style="margin-left:auto">Close</button>'
      });

      fetch('/api/uptime/content/' + encodeURIComponent(id))
        .then(safeJson)
        .then(function (d) {
          var body = document.getElementById('cm-history-body');
          if (!body) return;
          var history = d.history || [];

          if (!history.length) {
            body.innerHTML = '<div class="cm-empty">No content changes detected yet. Content is being monitored every 60 seconds.</div>';
          } else {
            body.innerHTML =
              '<div class="cm-stats-row">' +
                '<div class="cm-stat"><span class="cm-stat-val" style="color:#22d3ee">' + history.length + '</span><span class="cm-stat-label">Changes</span></div>' +
                '<div class="cm-stat"><span class="cm-stat-val" style="color:#f59e0b">' + timeAgo(history[history.length - 1].ts) + '</span><span class="cm-stat-label">Last Change</span></div>' +
                '<div class="cm-stat"><span class="cm-stat-val">' + formatBytes(history[history.length - 1].size) + '</span><span class="cm-stat-label">Current Size</span></div>' +
              '</div>' +
              '<div class="cm-timeline">' +
              history.slice().reverse().slice(0, 50).map(function (h) {
                return '<div class="cm-timeline-item">' +
                  '<div class="cm-timeline-dot"></div>' +
                  '<div class="cm-timeline-content">' +
                    '<div class="cm-timeline-header">' +
                      '<span class="cm-timeline-time">' + new Date(h.ts).toLocaleString() + '</span>' +
                      '<span class="cm-timeline-hash" title="' + esc(h.hash) + '">' + (h.prevHash ? h.prevHash.substring(0, 8) + ' &rarr; ' : '') + h.hash.substring(0, 8) + '</span>' +
                      '<span class="cm-timeline-size">' + formatBytes(h.size) + '</span>' +
                    '</div>' +
                    (h.snippet ? '<div class="cm-timeline-snippet">' + esc(h.snippet.substring(0, 200)) + '</div>' : '') +
                  '</div>' +
                '</div>';
              }).join('') +
              '</div>';
          }
        })
        .catch(function () {
          var body = document.getElementById('cm-history-body');
          if (body) body.innerHTML = '<div class="cm-empty">Failed to load content history</div>';
        });

      // Check Now button
      setTimeout(function () {
        var checkBtn = document.getElementById('cm-check-now');
        if (checkBtn) checkBtn.onclick = function () {
          checkBtn.disabled = true;
          checkBtn.textContent = 'Checking...';
          fetch('/api/uptime/content/' + encodeURIComponent(id) + '/check', { method: 'POST' })
            .then(safeJson)
            .then(function (d) {
              if (d.error) { Toast.error(d.error); checkBtn.disabled = false; checkBtn.textContent = 'Check Now'; return; }
              var check = d.check || {};
              if (check.contentChanged) {
                Toast.warning('Content has changed!');
              } else {
                Toast.success('No content change detected');
              }
              checkBtn.disabled = false;
              checkBtn.textContent = 'Check Now';
              // Reload the history
              Views.uptime.contentHistory(id);
              loadEndpoints();
            }).catch(function () { Toast.error('Check failed'); checkBtn.disabled = false; checkBtn.textContent = 'Check Now'; });
        };

        // AI Analyze button
        var aiBtn = document.getElementById('cm-ai-analyze');
        if (aiBtn) aiBtn.onclick = function () {
          aiBtn.disabled = true;
          aiBtn.textContent = 'Analyzing...';
          fetch('/api/uptime/content/ai-analyze', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpointId: id })
          }).then(safeJson).then(function (d) {
            aiBtn.disabled = false;
            aiBtn.textContent = 'AI Analyze';
            var analysis = d.analysis || d.error || 'Analysis unavailable';
            // Append AI analysis to the modal
            var body = document.getElementById('cm-history-body');
            if (body) {
              var existing = body.querySelector('.cm-ai-result');
              if (existing) existing.remove();
              var div = document.createElement('div');
              div.className = 'cm-ai-result';
              div.innerHTML = '<div class="cm-ai-header">' + IC.brain + ' AI Analysis</div><div class="cm-ai-text"></div>';
              body.insertBefore(div, body.firstChild);
              typeWriter(div.querySelector('.cm-ai-text'), analysis);
            }
          }).catch(function () {
            aiBtn.disabled = false;
            aiBtn.textContent = 'AI Analyze';
            Toast.error('Analysis failed');
          });
        };
      }, 50);
    },

    // ── Quick Scrape (one-off URL analysis) ───────────────────────────
    quickScrape: function () {
      Modal.open({
        title: IC.globe + ' Quick Web Scrape', size: 'md',
        body:
          '<div class="form-group"><label class="form-label">URL</label><input id="qs-url" class="form-input" placeholder="https://example.com"></div>' +
          '<div class="form-group"><label class="form-label">CSS Selector <span style="color:var(--text-tertiary);font-weight:400">(optional)</span></label><input id="qs-selector" class="form-input" placeholder="#content, .main, h1"></div>' +
          '<div id="qs-result" style="display:none"></div>',
        footer: '<button class="btn btn-sm btn-cyan" id="qs-go">Scrape</button><button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))" style="margin-left:8px">Close</button>'
      });
      setTimeout(function () {
        var btn = document.getElementById('qs-go');
        if (btn) btn.onclick = function () {
          var url = (document.getElementById('qs-url') || {}).value;
          var selector = (document.getElementById('qs-selector') || {}).value;
          if (!url) { Toast.warning('URL required'); return; }
          btn.disabled = true;
          btn.textContent = 'Scraping...';
          var resultEl = document.getElementById('qs-result');
          if (resultEl) { resultEl.style.display = ''; resultEl.innerHTML = '<div class="briefing-shimmer" style="width:90%"></div>'; }

          fetch('/api/uptime/scrape', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url, selector: selector })
          }).then(safeJson).then(function (d) {
            btn.disabled = false;
            btn.textContent = 'Scrape';
            if (d.error) { resultEl.innerHTML = '<div class="cm-empty" style="color:#ff6b2b">' + esc(d.error) + '</div>'; return; }

            resultEl.innerHTML =
              '<div class="cm-divider"></div>' +
              '<div class="qs-meta">' +
                '<div class="qs-meta-row"><span class="qs-meta-label">Status</span><span style="color:' + (d.status === 200 ? '#22d3ee' : '#ff6b2b') + '">' + d.status + '</span></div>' +
                '<div class="qs-meta-row"><span class="qs-meta-label">Title</span><span>' + esc(d.title || '—') + '</span></div>' +
                '<div class="qs-meta-row"><span class="qs-meta-label">Size</span><span>' + formatBytes(d.contentLength) + '</span></div>' +
                '<div class="qs-meta-row"><span class="qs-meta-label">Hash</span><span class="qs-hash">' + esc(d.contentHash) + '</span></div>' +
                '<div class="qs-meta-row"><span class="qs-meta-label">Server</span><span>' + esc(d.headers.server || '—') + '</span></div>' +
                '<div class="qs-meta-row"><span class="qs-meta-label">Type</span><span>' + esc(d.headers.contentType || '—') + '</span></div>' +
                (d.metaDescription ? '<div class="qs-meta-row"><span class="qs-meta-label">Description</span><span>' + esc(d.metaDescription) + '</span></div>' : '') +
              '</div>' +
              '<div class="form-group" style="margin-top:12px"><label class="form-label">Extracted Text</label>' +
                '<div class="qs-content">' + esc(d.textContent.substring(0, 2000)) + '</div>' +
              '</div>' +
              (d.links.length ? '<div class="form-group"><label class="form-label">Links (' + d.links.length + ')</label>' +
                '<div class="qs-links">' + d.links.slice(0, 20).map(function (l) { return '<div class="qs-link">' + esc(l) + '</div>'; }).join('') + '</div></div>' : '');
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = 'Scrape';
            resultEl.innerHTML = '<div class="cm-empty" style="color:#ff6b2b">Scrape failed</div>';
          });
        };
      }, 50);
    }
  };

  // ── Load Everything ────────────────────────────────────────────────
  function loadAll() {
    loadServers();
    loadEndpoints();
  }

  function loadServers() {
    fetch('/api/servers').then(safeJson).then(function (d) {
      serverData = d.servers || [];
      renderServers();
      updateBanner();
      updateLatencyChart();
    }).catch(function () {});
  }

  function loadEndpoints() {
    fetch('/api/uptime').then(safeJson).then(function (d) {
      uptimeData = d.endpoints || [];
      renderEndpoints();
    }).catch(function () {});
  }

  // ── Global Status Banner ───────────────────────────────────────────
  function updateBanner() {
    var iconEl = document.getElementById('uptime-banner-icon');
    var titleEl = document.getElementById('uptime-banner-title');
    var subEl = document.getElementById('uptime-banner-sub');
    var statsEl = document.getElementById('uptime-banner-stats');
    var banner = document.getElementById('uptime-banner');
    if (!banner) return;

    var total = serverData.length;
    var healthy = serverData.filter(function (s) { return s.status === 'healthy' || s.status === 'up'; }).length;
    var unreachable = serverData.filter(function (s) { return s.status === 'unreachable'; }).length;
    var allGood = healthy === total && total > 0;

    banner.className = 'uptime-status-banner ' + (allGood ? 'status-healthy' : unreachable > 0 ? 'status-down' : 'status-degraded');
    if (iconEl) iconEl.innerHTML = allGood ? IC.check : IC.x;
    if (titleEl) titleEl.textContent = allGood ? 'All Systems Operational' : unreachable > 0 ? 'Service Disruption Detected' : 'Degraded Performance';
    if (subEl) subEl.textContent = healthy + ' of ' + total + ' servers healthy \u00b7 Last checked ' + new Date().toLocaleTimeString();

    if (statsEl) {
      var avgLatency = 0;
      var latCount = 0;
      serverData.forEach(function (s) { if (s.latency > 0) { avgLatency += s.latency; latCount++; } });
      avgLatency = latCount ? Math.round(avgLatency / latCount) : 0;

      // Count content-monitored endpoints with recent changes
      var contentAlerts = uptimeData.filter(function (ep) {
        return ep.contentMonitor && ep.contentMonitor.enabled && ep.lastContentChange &&
          (Date.now() - ep.lastContentChange) < 3600000;
      }).length;

      statsEl.innerHTML =
        bannerStat(healthy, 'Healthy', '#22d3ee') +
        bannerStat(total - healthy, 'Down', total - healthy > 0 ? '#ff6b2b' : 'var(--text-secondary)') +
        bannerStat(avgLatency + 'ms', 'Avg Latency', avgLatency > 500 ? '#ff6b2b' : '#22d3ee') +
        (contentAlerts > 0 ? bannerStat(contentAlerts, 'Content Alerts', '#f59e0b') : '');
    }
  }

  function bannerStat(val, label, color) {
    return '<div class="uptime-banner-stat">' +
      '<div class="uptime-banner-stat-val" style="color:' + color + '">' + val + '</div>' +
      '<div class="uptime-banner-stat-label">' + label + '</div>' +
    '</div>';
  }

  // ── Server Cards ───────────────────────────────────────────────────
  function renderServers() {
    var el = document.getElementById('uptime-servers');
    var countEl = document.getElementById('srv-count');
    if (!el) return;
    if (countEl) countEl.textContent = serverData.length;

    if (!serverData.length) {
      el.innerHTML = '<div class="db-unavailable">No servers connected</div>';
      return;
    }

    el.innerHTML = serverData.map(function (s) {
      var isUp = s.status === 'healthy' || s.status === 'up';
      var statusColor = isUp ? '#22d3ee' : s.status === 'unreachable' ? '#ff6b2b' : '#f59e0b';
      var statusText = isUp ? 'OPERATIONAL' : s.status === 'unreachable' ? 'UNREACHABLE' : 'DEGRADED';
      var icon = s.provider === 'aws' ? IC.cloud : s.provider === 'local' ? IC.monitor : IC.server;
      var sys = s.system || {};

      // Track latency
      var key = s.name.replace(/\s/g, '_');
      if (!latencyHistory[key]) latencyHistory[key] = [];
      if (s.latency >= 0) {
        latencyHistory[key].push({ ts: Date.now(), v: s.latency });
        if (latencyHistory[key].length > 60) latencyHistory[key].shift();
      }

      // Mini latency sparkline SVG
      var sparkSvg = '';
      var hist = latencyHistory[key];
      if (hist.length > 2) {
        var maxLat = Math.max.apply(null, hist.map(function (h) { return h.v; })) || 1;
        var points = hist.map(function (h, i) { return i * (120 / hist.length) + ',' + (28 - (h.v / maxLat) * 24); }).join(' ');
        sparkSvg = '<svg class="srv-latency-spark" viewBox="0 0 120 30" preserveAspectRatio="none">' +
          '<polyline points="' + points + '" fill="none" stroke="' + statusColor + '" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/></svg>';
      }

      return '<div class="srv-card ' + (isUp ? '' : 'srv-down') + '">' +
        '<div class="srv-card-header">' +
          '<div class="srv-card-icon" style="color:' + statusColor + '">' + icon + '</div>' +
          '<div class="srv-card-info">' +
            '<div class="srv-card-name">' + esc(s.name) + '</div>' +
            '<div class="srv-card-host">' + esc(s.host || '') + '</div>' +
          '</div>' +
          '<div class="srv-card-status" style="color:' + statusColor + ';border-color:' + statusColor + '">' +
            '<span class="srv-status-dot" style="background:' + statusColor + '"></span>' + statusText +
          '</div>' +
        '</div>' +
        '<div class="srv-card-metrics">' +
          (s.latency >= 0 ? srvMetric(s.latency + 'ms', 'Latency', s.latency > 500 ? '#ff6b2b' : s.latency > 200 ? '#f59e0b' : '#22d3ee') : srvMetric('--', 'Latency', 'var(--text-secondary)')) +
          (sys.cpuPct !== undefined ? srvMetric(sys.cpuPct + '%', 'CPU', sys.cpuPct > 80 ? '#ff6b2b' : '#22d3ee') : srvMetric('--', 'CPU', 'var(--text-secondary)')) +
          (sys.usedMemPct !== undefined ? srvMetric(sys.usedMemPct + '%', 'Memory', sys.usedMemPct > 80 ? '#ff6b2b' : '#a78bfa') : srvMetric('--', 'Memory', 'var(--text-secondary)')) +
          (sys.uptimeHours !== undefined ? srvMetric(formatUptime(sys.uptimeHours), 'Uptime', '#22d3ee') : srvMetric('--', 'Uptime', 'var(--text-secondary)')) +
          (sys.cpuCount ? srvMetric(sys.cpuCount, 'Cores', '#3b82f6') : '') +
          (sys.nodeVersion ? srvMetric(sys.nodeVersion, 'Node', 'var(--text-secondary)') : '') +
        '</div>' +
        (sparkSvg ? '<div class="srv-card-spark">' + sparkSvg + '</div>' : '') +
        (s.error ? '<div class="srv-card-error">' + esc(s.error) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function srvMetric(val, label, color) {
    return '<div class="srv-metric">' +
      '<div class="srv-metric-val" style="color:' + color + '">' + val + '</div>' +
      '<div class="srv-metric-label">' + label + '</div>' +
    '</div>';
  }

  // ── Latency Chart ──────────────────────────────────────────────────
  function updateLatencyChart() {
    var datasets = [];
    var colors = ['#22d3ee', '#ff6b2b', '#a78bfa', '#f59e0b', '#3b82f6'];
    var maxLen = 0;
    var ci = 0;
    var labels = [];

    serverData.forEach(function (s) {
      var key = s.name.replace(/\s/g, '_');
      var hist = latencyHistory[key] || [];
      if (hist.length > maxLen) {
        maxLen = hist.length;
        labels = hist.map(function (h) { return new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); });
      }
      if (s.latency >= 0) {
        var color = colors[ci % colors.length];
        datasets.push(Object.assign({ data: hist.map(function (h) { return h.v; }), label: s.name },
          Charts.defaultLineConfig ? Charts.defaultLineConfig(color) : { borderColor: color, fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }));
        ci++;
      }
    });

    if (Charts.instances['uptime-latency-chart']) {
      Charts.update('uptime-latency-chart', labels, datasets);
    } else if (datasets.length) {
      Charts.create('uptime-latency-chart', 'line', {
        data: { labels: labels, datasets: datasets },
        options: {
          scales: { y: { min: 0, title: { display: true, text: 'ms', color: '#8b8b92', font: { size: 10 } } } },
          plugins: { legend: { display: true, labels: { color: '#a1a1aa', font: { size: 10 } } } }
        }
      });
    }
  }

  // ── Endpoint Cards ─────────────────────────────────────────────────
  function renderEndpoints() {
    var el = document.getElementById('uptime-endpoints');
    if (!el) return;

    if (!uptimeData.length) {
      el.innerHTML = '<div class="uptime-empty">' +
        '<div class="uptime-empty-icon">' + IC.globe + '</div>' +
        '<div>No endpoints monitored yet</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Add URLs to monitor availability, response times, and content changes</div>' +
        '<button class="btn btn-sm btn-cyan" onclick="Views.uptime.quickScrape()" style="margin-top:10px">' + IC.globe + ' Quick Scrape</button>' +
      '</div>';
      return;
    }

    el.innerHTML = '<div style="margin-bottom:12px;text-align:right"><button class="btn btn-sm" onclick="Views.uptime.quickScrape()" style="gap:4px">' + IC.globe + ' Quick Scrape</button></div>' +
      uptimeData.map(function (ep) {
      var pct24 = ep.uptime24h;
      var pct7d = ep.uptime7d;
      var pct30d = ep.uptime30d;
      var checks = ep.recentChecks || [];
      var avgLat = calcAvgLatency(checks);
      var lastCheck = checks.length ? checks[checks.length - 1] : null;
      var isUp = lastCheck ? lastCheck.ok : null;
      var hasCM = ep.contentMonitor && ep.contentMonitor.enabled;

      // Content monitoring status
      var cmBadge = '';
      if (hasCM) {
        var lastChange = ep.lastContentChange;
        var changeCount = ep.contentChanges || 0;
        var recentChange = lastChange && (Date.now() - lastChange) < 3600000;

        // Check latest keyword status
        var kwIssue = false;
        if (lastCheck) {
          if (lastCheck.keywordHits) kwIssue = lastCheck.keywordHits.some(function (k) { return !k.found; });
          if (lastCheck.forbiddenHits) kwIssue = kwIssue || lastCheck.forbiddenHits.some(function (k) { return k.found; });
        }

        var cmColor = kwIssue ? '#ff6b2b' : recentChange ? '#f59e0b' : '#22d3ee';
        var cmLabel = kwIssue ? 'Keyword Alert' : recentChange ? 'Changed ' + timeAgo(lastChange) : changeCount > 0 ? changeCount + ' changes' : 'Monitoring';
        cmBadge = '<div class="ep-cm-badge" style="border-color:' + cmColor + ';color:' + cmColor + '" onclick="event.stopPropagation();Views.uptime.contentHistory(\'' + esc(ep.id) + '\')">' +
          '<span class="ep-cm-dot" style="background:' + cmColor + '"></span>' +
          IC.eye + ' ' + cmLabel +
        '</div>';
      }

      return '<div class="ep-card">' +
        '<div class="ep-card-header">' +
          '<div class="ep-card-status" style="color:' + (isUp === null ? 'var(--text-secondary)' : isUp ? '#22d3ee' : '#ff6b2b') + '">' +
            (isUp === null ? IC.clock : isUp ? IC.check : IC.x) +
          '</div>' +
          '<div class="ep-card-info">' +
            '<div class="ep-card-name">' + esc(ep.name) + '</div>' +
            '<div class="ep-card-url">' + esc(ep.url) + '</div>' +
          '</div>' +
          '<div class="ep-card-actions">' +
            '<button class="ep-action-btn" onclick="Views.uptime.editEndpoint(\'' + esc(ep.id) + '\')" title="Edit">' + IC.edit + '</button>' +
            '<button class="ep-action-btn ep-action-delete" onclick="Views.uptime.deleteEp(\'' + esc(ep.id) + '\')" title="Delete">' + IC.trash + '</button>' +
          '</div>' +
        '</div>' +
        cmBadge +
        '<div class="ep-metrics">' +
          epMetric(fmtPct(pct24), '24h', pctColor(pct24)) +
          epMetric(fmtPct(pct7d), '7d', pctColor(pct7d)) +
          epMetric(fmtPct(pct30d), '30d', pctColor(pct30d)) +
          epMetric(avgLat + 'ms', 'Latency', avgLat > 500 ? '#ff6b2b' : '#22d3ee') +
          (hasCM && lastCheck && lastCheck.contentHash ?
            epMetric(lastCheck.contentHash.substring(0, 8), 'Hash', lastCheck.contentChanged ? '#f59e0b' : '#22d3ee') : '') +
          (hasCM && lastCheck && lastCheck.contentSize ?
            epMetric(formatBytes(lastCheck.contentSize), 'Size', 'var(--text-secondary)') : '') +
        '</div>' +
        '<div class="ep-bar-wrap">' +
          '<div class="ep-bar-label">Last 90 checks</div>' +
          '<div class="ep-bar">' + renderBar(checks) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  Views.uptime.deleteEp = function (id) {
    Modal.confirm({ title: 'Delete Endpoint', message: 'Remove this monitored endpoint?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/uptime/endpoints/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadEndpoints(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  // ── Bar renderer ───────────────────────────────────────────────────
  function renderBar(checks) {
    if (!checks || !checks.length) return '<span style="color:var(--text-secondary);font-size:10px">No data yet</span>';
    var recent = checks.slice(-90);
    return recent.map(function (c) {
      var up = c.ok;
      var hasContentChange = c.contentChanged;
      var color = !up ? '#ff6b2b' : hasContentChange ? '#f59e0b' : '#22d3ee';
      var opacity = up && !hasContentChange ? '0.7' : '1';
      var title = (c.latency || 0) + 'ms' + (up ? ' OK' : ' FAIL') + (hasContentChange ? ' [content changed]' : '');
      return '<div class="ep-bar-tick" style="background:' + color + ';opacity:' + opacity + '" title="' + title + '"></div>';
    }).join('');
  }

  function epMetric(val, label, color) {
    return '<div class="ep-metric">' +
      '<div class="ep-metric-val" style="color:' + color + '">' + val + '</div>' +
      '<div class="ep-metric-label">' + label + '</div>' +
    '</div>';
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function calcAvgLatency(checks) {
    var sum = 0, count = 0;
    (checks || []).forEach(function (c) { if (c.latency > 0) { sum += c.latency; count++; } });
    return count ? Math.round(sum / count) : 0;
  }

  function pctColor(pct) {
    if (pct === null || pct === undefined) return 'var(--text-secondary)';
    if (pct >= 99) return '#22d3ee';
    if (pct >= 95) return '#f59e0b';
    return '#ff6b2b';
  }

  function fmtPct(pct) { return typeof pct === 'number' ? pct.toFixed(2) + '%' : '--'; }

  function formatUptime(hours) {
    if (hours >= 24) return Math.floor(hours / 24) + 'd ' + Math.floor(hours % 24) + 'h';
    if (hours >= 1) return hours.toFixed(1) + 'h';
    return Math.round(hours * 60) + 'm';
  }

  function formatBytes(bytes) {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function timeAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    if (diff < 60000) return Math.round(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
    return Math.round(diff / 86400000) + 'd ago';
  }

  function parseCommaSep(str) {
    if (!str) return [];
    return str.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }

  function typeWriter(el, text, speed) {
    speed = speed || 18;
    el.innerHTML = '';
    var i = 0;
    var cursor = document.createElement('span');
    cursor.className = 'briefing-cursor';
    var timer = setInterval(function () {
      if (i < text.length) {
        el.textContent = text.substring(0, i + 1);
        el.appendChild(cursor);
        i++;
      } else {
        clearInterval(timer);
        setTimeout(function () { if (cursor.parentNode) cursor.remove(); }, 2000);
      }
    }, speed);
  }
})();
