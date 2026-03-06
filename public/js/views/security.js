/**
 * Bulwark — Security Intelligence Center
 * AI threat analysis, posture scoring, secret scanning, dependency audit, event log
 */
(function () {
  'use strict';

  var posture = null;
  var activeTab = 'posture';

  Views.security = {
    init: function () {
      var c = document.getElementById('view-security');
      if (!c) return;
      c.innerHTML =
        '<div class="sec-dashboard">' +
          // AI Analysis
          '<div class="sec-ai-card">' +
            '<div class="sec-ai-header"><div class="ai-dot"></div><span>Bulwark Security Advisor <span id="security-ai-freshness"></span></span></div>' +
            '<div class="sec-ai-body" id="sec-ai-body">Click analyze for AI-powered security assessment...</div>' +
            '<button class="sec-ai-btn" onclick="secAiAnalysis(true)">Analyze Security Posture</button>' +
          '</div>' +
          // Tabs
          '<div class="sec-tabs">' +
            '<button class="sec-tab-btn active" data-tab="posture" onclick="secTabSwitch(\'posture\')">Posture</button>' +
            '<button class="sec-tab-btn" data-tab="secrets" onclick="secTabSwitch(\'secrets\')">Secret Scan</button>' +
            '<button class="sec-tab-btn" data-tab="deps" onclick="secTabSwitch(\'deps\')">Dependencies</button>' +
            '<button class="sec-tab-btn" data-tab="events" onclick="secTabSwitch(\'events\')">Events</button>' +
            '<button class="sec-tab-btn" data-tab="firewall" onclick="secTabSwitch(\'firewall\')">Firewall</button>' +
            '<button class="sec-tab-btn" data-tab="ssh" onclick="secTabSwitch(\'ssh\')">SSH Keys</button>' +
          '</div>' +
          '<div id="sec-tab-content"></div>' +
        '</div>';
    },
    show: function () { renderSecTab(); secAiAnalysis(false); },
    hide: function () {},
    update: function () {}
  };

  window.secTabSwitch = function (tab) {
    activeTab = tab;
    document.querySelectorAll('.sec-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderSecTab();
  };

  function renderSecTab() {
    var el = document.getElementById('sec-tab-content');
    if (!el) return;
    if (activeTab === 'posture') renderPosture(el);
    else if (activeTab === 'secrets') renderSecrets(el);
    else if (activeTab === 'deps') renderDeps(el);
    else if (activeTab === 'events') renderEvents(el);
    else if (activeTab === 'firewall') renderFirewall(el);
    else if (activeTab === 'ssh') renderSSH(el);
  }

  // ── Posture Tab ──

  function renderPosture(el) {
    el.innerHTML = '<div class="sec-section"><div style="color:var(--text-tertiary)">Running security checks...</div></div>';
    fetch('/api/security/posture').then(function (r) { return r.json(); }).then(function (d) {
      posture = d;
      var scoreColor = d.score >= 80 ? 'var(--cyan)' : d.score >= 60 ? '#f59e0b' : 'var(--orange)';
      var gradeColor = scoreColor;

      el.innerHTML =
        // Score card
        '<div class="sec-score-row">' +
          '<div class="sec-score-card">' +
            '<div class="sec-score-ring" style="--score:' + (d.score || 0) + ';--color:' + scoreColor + '">' +
              '<div class="sec-score-inner">' +
                '<div class="sec-score-grade" style="color:' + gradeColor + '">' + (d.grade || 'F') + '</div>' +
                '<div class="sec-score-num">' + (d.score || 0) + '/100</div>' +
              '</div>' +
            '</div>' +
            '<div class="sec-score-label">Security Score</div>' +
          '</div>' +
          '<div class="sec-checks-list">' +
            (d.checks || []).map(function (c) {
              var icon = c.status === 'pass' ? '&#10003;' : c.status === 'fail' ? '&#10007;' : c.status === 'warn' ? '&#9888;' : 'i';
              return '<div class="sec-check-row">' +
                '<div class="sec-check-icon ' + c.status + '">' + icon + '</div>' +
                '<div class="sec-check-info">' +
                  '<div class="sec-check-name">' + esc(c.name) + '</div>' +
                  '<div class="sec-check-detail">' + esc(c.detail) + '</div>' +
                '</div>' +
                (c.severity ? '<span class="sec-severity ' + c.severity + '">' + c.severity + '</span>' : '') +
                (c.status === 'fail' || c.status === 'warn' ? '<button class="sec-fix-btn" onclick="secAiFix(\'' + escAttr(c.name + ': ' + c.detail) + '\')">AI Fix</button>' : '') +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;margin-top:8px"><button class="sec-ai-btn" onclick="renderPosture(document.getElementById(\'sec-tab-content\'))">Re-scan</button></div>';
    });
  }

  // ── Secret Scan Tab ──

  function renderSecrets(el) {
    el.innerHTML = '<div class="sec-section"><h3>Secret Scanner</h3><p style="color:var(--text-tertiary);font-size:12px;margin-bottom:12px">Scans codebase for hardcoded secrets, API keys, tokens, and passwords.</p><button class="btn btn-sm btn-cyan" onclick="runSecretScan()">Run Scan</button><div id="sec-secret-results" style="margin-top:16px"></div></div>';
  }

  window.runSecretScan = function () {
    var results = document.getElementById('sec-secret-results');
    if (!results) return;
    results.innerHTML = '<div style="color:var(--text-tertiary)">Scanning codebase for secrets...</div>';
    fetch('/api/security/secret-scan').then(function (r) { return r.json(); }).then(function (d) {
      var findings = d.findings || [];
      if (!findings.length) {
        results.innerHTML = '<div class="sec-section" style="text-align:center;padding:24px"><div style="color:var(--cyan);font-size:24px;margin-bottom:8px">&#10003;</div><div style="color:var(--cyan);font-weight:600">No secrets found</div><div style="color:var(--text-tertiary);font-size:11px;margin-top:4px">Scanned at ' + (d.scannedAt ? new Date(d.scannedAt).toLocaleString() : 'now') + '</div></div>';
        return;
      }
      results.innerHTML =
        '<div class="sec-section"><div style="color:var(--orange);font-weight:600;margin-bottom:12px">' + findings.length + ' potential secrets found</div>' +
        '<div class="sec-findings-list">' +
          findings.map(function (f) {
            return '<div class="sec-finding-row">' +
              '<span class="sec-finding-type">' + esc(f.type) + '</span>' +
              '<span class="sec-finding-file">' + esc(f.file) + '</span>' +
              '<span class="sec-finding-line">' + esc(f.line) + '</span>' +
              '<button class="sec-fix-btn" onclick="secAiFix(\'' + escAttr(f.type + ' in ' + f.file) + '\')">AI Fix</button>' +
            '</div>';
          }).join('') +
        '</div></div>';
    });
  };

  // ── Dependencies Tab ──

  function renderDeps(el) {
    el.innerHTML = '<div class="sec-section"><div style="color:var(--text-tertiary)">Running npm audit...</div></div>';
    fetch('/api/security/dependencies').then(function (r) { return r.json(); }).then(function (d) {
      var vulns = d.vulnerabilities || [];
      var summary = d.summary || {};
      var sevCounts = '<div class="sec-dep-summary">';
      ['critical', 'high', 'moderate', 'low'].forEach(function (s) {
        var count = summary[s] || 0;
        var color = s === 'critical' ? 'var(--orange)' : s === 'high' ? '#f59e0b' : s === 'moderate' ? 'var(--text-secondary)' : 'var(--text-tertiary)';
        sevCounts += '<div class="sec-dep-stat"><span class="sec-dep-num" style="color:' + color + '">' + count + '</span><span class="sec-dep-label">' + s + '</span></div>';
      });
      sevCounts += '</div>';

      el.innerHTML =
        '<div class="sec-section"><h3>Dependency Vulnerabilities</h3>' +
        sevCounts +
        (vulns.length ? '<div class="sec-dep-list">' +
          vulns.slice(0, 30).map(function (v) {
            var sevColor = v.severity === 'critical' ? 'var(--orange)' : v.severity === 'high' ? '#f59e0b' : 'var(--text-secondary)';
            return '<div class="sec-dep-row">' +
              '<span class="sec-severity ' + v.severity + '">' + v.severity + '</span>' +
              '<span class="sec-dep-name">' + esc(v.name) + '</span>' +
              '<span class="sec-dep-via">' + esc(v.via || v.range || '') + '</span>' +
              (v.fixAvailable ? '<span class="sec-dep-fix" style="color:var(--cyan)">fix available</span>' : '') +
            '</div>';
          }).join('') +
        '</div>' : '<div style="text-align:center;padding:16px;color:var(--cyan)">No vulnerabilities found</div>') +
        '</div>';
    });
  }

  // ── Events Tab ──

  function renderEvents(el) {
    el.innerHTML = '<div class="sec-section"><div style="color:var(--text-tertiary)">Loading...</div></div>';
    fetch('/api/security/events').then(function (r) { return r.json(); }).then(function (d) {
      var events = d.events || [];
      el.innerHTML = '<div class="sec-section"><h3>Security Events</h3>' +
        '<button class="btn btn-sm btn-ghost" onclick="logSecEvent()" style="margin-bottom:12px">+ Log Event</button>' +
        (events.length ? '<div class="sec-events-list">' +
          events.slice(0, 50).map(function (e) {
            var sevColor = e.severity === 'critical' ? 'var(--orange)' : e.severity === 'warning' ? '#f59e0b' : 'var(--cyan)';
            return '<div class="sec-event-row">' +
              '<div class="sec-event-dot" style="background:' + sevColor + '"></div>' +
              '<div class="sec-event-info">' +
                '<div class="sec-event-type">' + esc(e.type) + '</div>' +
                '<div class="sec-event-msg">' + esc(e.message) + '</div>' +
              '</div>' +
              '<div class="sec-event-time">' + timeAgo(e.timestamp) + '</div>' +
            '</div>';
          }).join('') +
        '</div>' : '<div class="sec-empty">No security events logged</div>') +
      '</div>';
    });
  }

  window.logSecEvent = function () {
    Modal.open({
      title: 'Log Security Event', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Type</label><select id="se-type" class="form-input"><option>login_attempt</option><option>config_change</option><option>access_denied</option><option>scan_complete</option><option>manual</option></select></div>' +
        '<div class="form-group"><label class="form-label">Severity</label><select id="se-sev" class="form-input"><option>info</option><option>warning</option><option>critical</option></select></div>' +
        '<div class="form-group"><label class="form-label">Message</label><input id="se-msg" class="form-input" placeholder="Describe the event"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="se-save">Log</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('se-save');
      if (btn) btn.onclick = function () {
        fetch('/api/security/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: (document.getElementById('se-type') || {}).value, severity: (document.getElementById('se-sev') || {}).value, message: (document.getElementById('se-msg') || {}).value }) })
          .then(function () { Toast.success('Event logged'); Modal.close(btn.closest('.modal-overlay')); renderSecTab(); })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  // ── Firewall Tab (native — no adapter needed) ──

  function renderFirewall(el) {
    el.innerHTML = '<div class="sec-section"><div style="color:var(--text-tertiary)">Detecting firewall...</div></div>';
    fetch('/api/security/firewall').then(function (r) { return r.json(); }).then(function (d) {
      var status = d.status || 'unknown';
      var rules = d.rules || [];
      var tool = d.tool || 'none';
      var statusColor = status === 'active' ? 'var(--cyan)' : status === 'inactive' ? 'var(--orange)' : 'var(--text-tertiary)';
      var statusIcon = status === 'active' ? '&#9679;' : status === 'inactive' ? '&#9675;' : '?';

      // No firewall detected — show AI setup guide
      if (tool === 'none' || status === 'unavailable') {
        el.innerHTML =
          '<div class="sec-section" style="text-align:center;padding:32px">' +
            '<div style="font-size:32px;margin-bottom:12px">&#128737;</div>' +
            '<div style="color:var(--text-primary);font-weight:600;font-size:14px;margin-bottom:8px">No Firewall Detected</div>' +
            '<div style="color:var(--text-tertiary);font-size:12px;max-width:460px;margin:0 auto 20px;line-height:1.6">' +
              (d.platform === 'win32'
                ? 'Windows Firewall is managed through Windows Security settings. Bulwark can analyze your firewall configuration — click below for AI recommendations.'
                : 'A firewall protects your server by controlling which network traffic is allowed in and out. Most Linux servers use <b>ufw</b> (Uncomplicated Firewall).') +
            '</div>' +
            '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
              '<button class="sec-ai-btn" onclick="firewallAISetup()">&#10024; AI Setup Guide</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="firewallAIAsk()">Ask AI a Question</button>' +
            '</div>' +
          '</div>';
        return;
      }

      // Firewall detected — show status + rules
      el.innerHTML =
        '<div class="sec-section">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div><h3 style="margin:0">Firewall — ' + esc(tool.toUpperCase()) + '</h3>' +
              '<div style="margin-top:4px"><span style="color:' + statusColor + '">' + statusIcon + '</span> <span style="color:' + statusColor + ';font-size:12px">' + esc(status) + '</span></div>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
              '<button class="sec-ai-btn" onclick="firewallAIAsk()">&#10024; Ask AI</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="secTabSwitch(\'firewall\')">Refresh</button>' +
            '</div>' +
          '</div>' +
          (rules.length ?
            '<div class="sec-fw-list">' +
              '<div class="sec-fw-row" style="color:var(--text-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border:none;padding-bottom:4px">' +
                '<span class="sec-fw-port">To</span>' +
                '<span class="sec-fw-action">Action</span>' +
                '<span class="sec-fw-from">From</span>' +
              '</div>' +
              rules.map(function (r) {
                var actionColor = (r.action || '').toLowerCase().indexOf('allow') >= 0 ? 'var(--cyan)' : 'var(--orange)';
                return '<div class="sec-fw-row">' +
                  '<span class="sec-fw-port">' + esc(r.to || r.port || '') + '</span>' +
                  '<span class="sec-fw-action" style="color:' + actionColor + '">' + esc(r.action || '') + '</span>' +
                  '<span class="sec-fw-from">' + esc(r.from || 'Anywhere') + '</span>' +
                '</div>';
              }).join('') +
            '</div>' :
            '<div class="sec-empty">No rules configured</div>'
          ) +
          '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="sec-ai-btn" onclick="firewallAISetup()">&#10024; AI Recommendations</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="firewallAIAdd()">+ Add Rule (AI)</button>' +
          '</div>' +
        '</div>';
    }).catch(function () {
      el.innerHTML =
        '<div class="sec-section" style="text-align:center;padding:32px">' +
          '<div style="font-size:32px;margin-bottom:12px">&#128737;</div>' +
          '<div style="color:var(--text-primary);font-weight:600;margin-bottom:8px">Firewall Status Unknown</div>' +
          '<div style="color:var(--text-tertiary);font-size:12px;margin-bottom:16px">Could not detect firewall configuration.</div>' +
          '<button class="sec-ai-btn" onclick="firewallAISetup()">&#10024; AI Setup Guide</button>' +
        '</div>';
    });
  }

  // Firewall AI: Full setup guide
  window.firewallAISetup = function () {
    Modal.open({ title: '&#10024; AI Firewall Setup', size: 'lg',
      body: '<div id="fw-ai-result" style="color:var(--text-secondary);font-size:13px;line-height:1.7">Generating firewall recommendations...<span class="cursor-blink"></span></div>'
    });
    fetch('/api/security/firewall/ai-setup').then(function (r) { return r.json(); }).then(function (d) {
      var el = document.getElementById('fw-ai-result');
      if (el) el.innerHTML = '<pre style="white-space:pre-wrap;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-secondary);line-height:1.7">' + esc(d.guide || 'Could not generate guide.') + '</pre>';
    }).catch(function () {
      var el = document.getElementById('fw-ai-result');
      if (el) el.textContent = 'AI unavailable. Configure an AI provider in Settings > AI Provider.';
    });
  };

  // Firewall AI: Ask a question
  window.firewallAIAsk = function () {
    Modal.open({ title: '&#10024; Ask AI About Firewalls', size: 'md',
      body: '<div class="form-group"><label class="form-label">Describe what you need in plain English</label>' +
        '<textarea id="fw-ai-q" class="form-input" rows="3" placeholder="e.g., I want to allow SSH and HTTP but block everything else\ne.g., How do I open port 443 for HTTPS?\ne.g., Is my server secure without a firewall?"></textarea></div>' +
        '<div id="fw-ai-answer" style="margin-top:12px"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>' +
        '<button class="btn btn-sm btn-primary" id="fw-ai-send">&#10024; Ask AI</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('fw-ai-send');
      if (btn) btn.onclick = function () {
        var q = (document.getElementById('fw-ai-q') || {}).value;
        if (!q) return;
        var ans = document.getElementById('fw-ai-answer');
        if (ans) ans.innerHTML = '<div style="color:var(--text-tertiary);font-size:12px">Thinking...<span class="cursor-blink"></span></div>';
        btn.disabled = true;
        fetch('/api/security/firewall/ai-ask', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (ans) ans.innerHTML = '<pre style="white-space:pre-wrap;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-secondary);line-height:1.7;margin-top:8px;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px">' + esc(d.answer || 'No answer.') + '</pre>';
            btn.disabled = false;
          });
      };
    }, 50);
  };

  // Firewall AI: Add rule via natural language
  window.firewallAIAdd = function () {
    Modal.open({ title: '&#10024; Add Firewall Rule', size: 'md',
      body: '<div class="form-group"><label class="form-label">Describe the rule in plain English</label>' +
        '<input id="fw-ai-rule" class="form-input" placeholder="e.g., Allow SSH from my IP 203.0.113.5"></div>' +
        '<div id="fw-ai-cmd" style="margin-top:12px"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>' +
        '<button class="btn btn-sm btn-primary" id="fw-ai-gen">&#10024; Generate Command</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('fw-ai-gen');
      if (btn) btn.onclick = function () {
        var rule = (document.getElementById('fw-ai-rule') || {}).value;
        if (!rule) return;
        var out = document.getElementById('fw-ai-cmd');
        if (out) out.innerHTML = '<div style="color:var(--text-tertiary);font-size:12px">Generating command...<span class="cursor-blink"></span></div>';
        btn.disabled = true;
        fetch('/api/security/firewall/ai-ask', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'Generate the exact ufw or iptables command for: ' + rule + '. Show the command, explain what it does, and warn about any risks.' }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (out) out.innerHTML = '<pre style="white-space:pre-wrap;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-secondary);line-height:1.7;margin-top:8px;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px">' + esc(d.answer || 'No answer.') + '</pre>' +
              '<div style="color:var(--text-tertiary);font-size:11px;margin-top:8px">&#9888; Copy and run this command in your terminal. Bulwark generates but does not auto-execute firewall changes for safety.</div>';
            btn.disabled = false;
          });
      };
    }, 50);
  };

  // ── SSH Keys Tab (native — no adapter needed) ──

  function renderSSH(el) {
    el.innerHTML = '<div class="sec-section"><div style="color:var(--text-tertiary)">Loading SSH keys...</div></div>';
    fetch('/api/security/ssh-keys').then(function (r) { return r.json(); }).then(function (d) {
      var keys = d.keys || [];
      if (d.unavailable) {
        el.innerHTML =
          '<div class="sec-section" style="text-align:center;padding:32px">' +
            '<div style="font-size:32px;margin-bottom:12px">&#128273;</div>' +
            '<div style="color:var(--text-primary);font-weight:600;margin-bottom:8px">SSH Keys</div>' +
            '<div style="color:var(--text-tertiary);font-size:12px;margin-bottom:16px">' + esc(d.message || 'SSH not available on this platform.') + '</div>' +
            '<button class="sec-ai-btn" onclick="firewallAIAsk()">&#10024; Ask AI About SSH</button>' +
          '</div>';
        return;
      }
      el.innerHTML = '<div class="sec-section"><h3>Authorized SSH Keys</h3>' +
        '<div style="color:var(--text-tertiary);font-size:11px;margin-bottom:12px">Keys in ~/.ssh/authorized_keys that can access this server</div>' +
        (keys.length ? '<div class="sec-ssh-list">' +
          keys.map(function (k) {
            return '<div class="sec-ssh-row">' +
              '<span class="sec-ssh-fp">' + esc(k.type || '') + '</span>' +
              '<span class="sec-ssh-comment" style="flex:1">' + esc(k.comment || 'unnamed key') + '</span>' +
              '<span style="color:var(--text-tertiary);font-size:10px">' + esc((k.key || '').substring(0, 20) + '...') + '</span>' +
            '</div>';
          }).join('') +
        '</div>' : '<div class="sec-empty">No authorized keys found</div>') +
        '<div style="margin-top:12px"><button class="sec-ai-btn" onclick="firewallAIAsk()">&#10024; Ask AI About SSH Security</button></div>' +
      '</div>';
    }).catch(function () {
      el.innerHTML =
        '<div class="sec-section" style="text-align:center;padding:32px">' +
          '<div style="font-size:32px;margin-bottom:12px">&#128273;</div>' +
          '<div style="color:var(--text-primary);font-weight:600;margin-bottom:8px">SSH Keys</div>' +
          '<div style="color:var(--text-tertiary);font-size:12px;margin-bottom:16px">Could not read SSH keys.</div>' +
          '<button class="sec-ai-btn" onclick="firewallAIAsk()">&#10024; Ask AI</button>' +
        '</div>';
    });
  }

  // ── AI Actions ──

  window.secAiAnalysis = function (force) {
    var body = document.getElementById('sec-ai-body');
    if (!body) return;
    if (!force && window.AICache) {
      var restored = window.AICache.restore('security');
      if (restored) {
        body.textContent = restored.response;
        var fb = document.getElementById('security-ai-freshness');
        if (fb) fb.innerHTML = window.AICache.freshnessBadge('security');
        return;
      }
    }
    body.innerHTML = 'Analyzing security posture...<span class="cursor-blink"></span>';
    fetch('/api/security/ai-analysis').then(function (r) { return r.json(); }).then(function (d) {
      var text = d.analysis || 'No analysis available.';
      typewriter(body, text);
      if (window.AICache) {
        window.AICache.set('security', {}, text);
        var fb = document.getElementById('security-ai-freshness');
        if (fb) fb.innerHTML = window.AICache.freshnessBadge('security');
      }
    }).catch(function () { body.textContent = 'Analysis unavailable.'; });
  };

  window.secAiFix = function (finding) {
    Toast.info('Getting AI fix recommendation...');
    fetch('/api/security/ai-fix', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finding: finding }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        Modal.open({ title: 'AI Fix: ' + finding.substring(0, 50), size: 'md',
          body: '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6">' + esc(d.fix || 'No recommendation') + '</div>'
        });
      });
  };

  function degraded(section, err) {
    return '<div class="sec-section" style="text-align:center;padding:32px"><div style="color:var(--text-secondary);font-weight:600;margin-bottom:8px">' + section + '</div>' +
      '<div style="color:var(--text-tertiary);font-size:12px;margin-bottom:16px">' + esc(err || 'Feature unavailable') + '</div>' +
      '<button class="sec-ai-btn" onclick="firewallAIAsk()">&#10024; Ask AI for Help</button></div>';
  }

  function typewriter(el, text) {
    el.textContent = '';
    var i = 0;
    var iv = setInterval(function () { el.textContent += text[i]; i++; if (i >= text.length) clearInterval(iv); }, 15);
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '--';
    var diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
    return Math.round(diff / 86400000) + 'd ago';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
  function escAttr(str) { return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
})();
