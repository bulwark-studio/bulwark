/**
 * Bulwark — AI Database Assistant
 * Claude-powered chat with full schema context, diagnostics, deploy readiness
 */
(function () {
  'use strict';

  var chatHistory = [];
  var activeTab = 'chat';
  var isLoading = false;

  // Reset on project switch
  if (window.DbProjects) window.DbProjects.onProjectChange(function () {
    chatHistory = [];
    var msgs = document.getElementById('ai-chat-messages');
    if (msgs) msgs.innerHTML = '';
    var health = document.getElementById('ai-health-content');
    if (health) health.innerHTML = '';
    var deploy = document.getElementById('ai-deploy-content');
    if (deploy) deploy.innerHTML = '';
  });

  Views['db-assistant'] = {
    init: function () {
      var el = document.getElementById('view-db-assistant');
      if (!el) return;
      el.innerHTML =
        '<div class="ai-layout">' +
          '<div class="ai-tabs">' +
            '<div class="ai-tab active" data-tab="chat" onclick="aiSetTab(\'chat\')">AI Chat</div>' +
            '<div class="ai-tab" data-tab="health" onclick="aiSetTab(\'health\')">Health</div>' +
            '<div class="ai-tab" data-tab="deploy" onclick="aiSetTab(\'deploy\')">Deploy Check</div>' +
            '<div style="flex:1"></div>' +
            '<div id="ai-schema-chip" class="ai-schema-chip"></div>' +
          '</div>' +

          // Chat tab
          '<div id="ai-tab-chat" class="ai-tab-body">' +
            '<div id="ai-chat-messages" class="ai-chat-messages"></div>' +
            '<div class="ai-input-area">' +
              '<div class="ai-quick-row">' +
                '<button class="ai-quick-btn" onclick="aiQuick(\'Run a full diagnostic on this database and tell me what needs fixing.\')">Diagnose</button>' +
                '<button class="ai-quick-btn" onclick="aiQuick(\'Analyze performance: find slow queries, missing indexes, and optimization opportunities.\')">Optimize</button>' +
                '<button class="ai-quick-btn" onclick="aiQuick(\'Generate a deployment script for this database to a fresh Ubuntu server with PostgreSQL 17. Include migrations, seeds, health checks, and rollback.\')">Deploy Script</button>' +
                '<button class="ai-quick-btn" onclick="aiQuick(\'Generate a migration to add audit columns (created_at, updated_at, created_by) to all tables that don\\\'t have them.\')">Migration</button>' +
                '<button class="ai-quick-btn" onclick="aiQuick(\'Show me the top 10 largest tables and suggest which ones need maintenance.\')">Table Report</button>' +
              '</div>' +
              '<div class="ai-input-row">' +
                '<textarea id="ai-input" class="ai-input" placeholder="Ask anything about your database..." rows="1" onkeydown="aiInputKey(event)"></textarea>' +
                '<button id="ai-send-btn" class="btn btn-primary ai-send-btn" onclick="aiSend()">Send</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          // Health tab
          '<div id="ai-tab-health" class="ai-tab-body" style="display:none">' +
            '<div id="ai-health-content" class="ai-health-content"></div>' +
          '</div>' +

          // Deploy tab
          '<div id="ai-tab-deploy" class="ai-tab-body" style="display:none">' +
            '<div id="ai-deploy-content" class="ai-deploy-content"></div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      if (!window.DbHeader || !window.DbHeader.require()) return;
      loadSchemaSummary();
      if (!chatHistory.length) showWelcome();
      if (activeTab === 'health') loadHealth();
      if (activeTab === 'deploy') loadDeploy();
    },

    hide: function () {},
    update: function () {}
  };

  // ── Tab switching ───────────────────────────────────────────────────────────

  window.aiSetTab = function (tab) {
    activeTab = tab;
    document.querySelectorAll('.ai-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.ai-tab-body').forEach(function (b) { b.style.display = 'none'; });
    var target = document.getElementById('ai-tab-' + tab);
    if (target) target.style.display = '';
    if (tab === 'health') loadHealth();
    if (tab === 'deploy') loadDeploy();
  };

  // ── Schema chip ─────────────────────────────────────────────────────────────

  function loadSchemaSummary() {
    fetch('/api/db/assistant/schema-summary?' + dbParam())
      .then(safeJson)
      .then(function (d) {
        var el = document.getElementById('ai-schema-chip');
        if (!el || d.error) return;
        el.innerHTML =
          '<span class="ai-chip-item">' + d.database + '</span>' +
          '<span class="ai-chip-item">' + d.tables + ' tables</span>' +
          '<span class="ai-chip-item">' + d.indexes + ' indexes</span>' +
          '<span class="ai-chip-item">' + d.size + '</span>';
      }).catch(function () {});
  }

  // ── Chat ────────────────────────────────────────────────────────────────────

  function showWelcome() {
    var msgs = document.getElementById('ai-chat-messages');
    if (!msgs) return;
    var active = window.DbProjects ? window.DbProjects.active() : null;
    msgs.innerHTML =
      '<div class="ai-msg ai-msg-system">' +
        '<div class="ai-welcome">' +
          '<div class="ai-welcome-title">AI Database Assistant</div>' +
          '<div class="ai-welcome-sub">Connected to <strong>' + esc(active ? active.name : 'database') + '</strong>. I have full knowledge of your schema, indexes, constraints, and health metrics. Ask me anything.</div>' +
          '<div class="ai-welcome-examples">' +
            '<div class="ai-welcome-ex" onclick="aiQuick(\'What tables have the most rows and what are their relationships?\')">What tables have the most rows?</div>' +
            '<div class="ai-welcome-ex" onclick="aiQuick(\'Find all tables missing created_at or updated_at columns.\')">Find tables missing timestamps</div>' +
            '<div class="ai-welcome-ex" onclick="aiQuick(\'Generate a backup and restore script for this database.\')">Generate backup script</div>' +
            '<div class="ai-welcome-ex" onclick="aiQuick(\'What foreign key relationships exist and are there any circular dependencies?\')">Map FK relationships</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  window.aiQuick = function (prompt) {
    var input = document.getElementById('ai-input');
    if (input) input.value = prompt;
    aiSend();
  };

  window.aiInputKey = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(); }
    // Auto-resize
    var t = e.target;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 120) + 'px';
  };

  window.aiSend = function () {
    if (isLoading) return;
    var input = document.getElementById('ai-input');
    if (!input) return;
    var message = input.value.trim();
    if (!message) return;
    input.value = '';
    input.style.height = 'auto';

    appendMsg('user', message);
    chatHistory.push({ role: 'user', content: message });

    isLoading = true;
    updateSendBtn();
    appendThinking();

    fetch('/api/db/assistant/chat?' + dbParam(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, history: chatHistory.slice(-6) })
    })
    .then(function (r) {
      var ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Server returned HTML — restart the dev-monitor server to load AI Assistant routes');
      return r.json();
    })
    .then(function (d) {
      removeThinking();
      isLoading = false;
      updateSendBtn();
      if (d.error) {
        appendMsg('error', d.error);
        return;
      }
      appendMsg('ai', d.response, d.sqlBlocks);
      chatHistory.push({ role: 'assistant', content: d.response });
    })
    .catch(function (e) {
      removeThinking();
      isLoading = false;
      updateSendBtn();
      appendMsg('error', 'Request failed: ' + e.message);
    });
  };

  function updateSendBtn() {
    var btn = document.getElementById('ai-send-btn');
    if (btn) {
      btn.textContent = isLoading ? 'Thinking...' : 'Send';
      btn.disabled = isLoading;
    }
  }

  function appendThinking() {
    var msgs = document.getElementById('ai-chat-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'ai-msg ai-msg-ai ai-thinking';
    div.id = 'ai-thinking';
    div.innerHTML = '<div class="ai-msg-bubble"><div class="ai-thinking-dots"><span></span><span></span><span></span></div><span style="margin-left:8px;color:var(--text-tertiary);font-size:11px">Analyzing schema and generating response...</span></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function removeThinking() {
    var el = document.getElementById('ai-thinking');
    if (el) el.remove();
  }

  function appendMsg(type, content, sqlBlocks) {
    var msgs = document.getElementById('ai-chat-messages');
    if (!msgs) return;

    // Remove welcome on first real message
    var welcome = msgs.querySelector('.ai-msg-system');
    if (welcome && type !== 'system') welcome.remove();

    var div = document.createElement('div');
    div.className = 'ai-msg ai-msg-' + type;

    if (type === 'user') {
      div.innerHTML = '<div class="ai-msg-bubble ai-msg-user-bubble">' + esc(content) + '</div>';
    } else if (type === 'ai') {
      var html = renderMarkdown(content);
      div.innerHTML = '<div class="ai-msg-bubble ai-msg-ai-bubble">' + html + '</div>';
    } else if (type === 'error') {
      div.innerHTML = '<div class="ai-msg-bubble ai-msg-error-bubble">' + esc(content) + '</div>';
    } else if (type === 'result') {
      div.innerHTML = '<div class="ai-msg-bubble ai-msg-result-bubble">' + content + '</div>';
    }

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ── Markdown-lite renderer ──────────────────────────────────────────────────

  function renderMarkdown(text) {
    // Split on SQL code blocks first
    var parts = text.split(/(```sql\n[\s\S]*?```)/g);
    var html = '';

    parts.forEach(function (part) {
      if (part.startsWith('```sql\n')) {
        var sql = part.replace(/^```sql\n/, '').replace(/\n?```$/, '').trim();
        var id = 'sql-' + Math.random().toString(36).substr(2, 8);
        html += '<div class="ai-sql-block" id="' + id + '">' +
          '<div class="ai-sql-header">' +
            '<span>SQL</span>' +
            '<div class="ai-sql-actions">' +
              '<button class="ai-sql-btn" onclick="aiCopySql(\'' + id + '\')">Copy</button>' +
              '<button class="ai-sql-btn ai-sql-run" onclick="aiRunSql(\'' + id + '\')">Run</button>' +
            '</div>' +
          '</div>' +
          '<pre class="ai-sql-code">' + escSql(sql) + '</pre>' +
          '<div class="ai-sql-result" id="' + id + '-result" style="display:none"></div>' +
        '</div>';
      } else if (part.startsWith('```')) {
        var code = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
        html += '<pre class="ai-code-block">' + esc(code) + '</pre>';
      } else {
        // Process inline markdown
        var lines = esc(part).split('\n');
        var processed = lines.map(function (line) {
          // Bold
          line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          // Inline code
          line = line.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
          // Bullet lists
          if (/^- /.test(line)) line = '<div class="ai-bullet">' + line.substring(2) + '</div>';
          else if (/^\d+\. /.test(line)) line = '<div class="ai-bullet">' + line + '</div>';
          return line;
        }).join('<br>');
        html += processed;
      }
    });

    return html;
  }

  function escSql(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── SQL execution from chat ─────────────────────────────────────────────────

  window.aiRunSql = function (id) {
    var block = document.getElementById(id);
    if (!block) return;
    var sql = block.querySelector('.ai-sql-code').textContent;
    var resultEl = document.getElementById(id + '-result');
    if (!resultEl) return;
    resultEl.style.display = '';
    resultEl.innerHTML = '<div style="padding:8px;color:var(--text-tertiary);font-size:11px">Running...</div>';

    var isDDL = /^\s*(DROP|TRUNCATE|ALTER|CREATE)\s/i.test(sql);
    var url = '/api/db/query?' + dbParam();
    if (isDDL) {
      if (!confirm('This is a DDL statement. Execute?')) { resultEl.style.display = 'none'; return; }
      url += '&allow_ddl=true';
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sql })
    })
    .then(safeJson)
    .then(function (d) {
      if (d.error) {
        resultEl.innerHTML = '<div class="ai-sql-error">' + esc(d.error) + '</div>';
        return;
      }
      if (d.rows && d.rows.length) {
        var cols = Object.keys(d.rows[0]);
        var table = '<table class="ai-result-table"><thead><tr>' +
          cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          d.rows.slice(0, 50).map(function (row) {
            return '<tr>' + cols.map(function (c) {
              var v = row[c];
              if (v == null) return '<td class="null-val">NULL</td>';
              return '<td>' + esc(String(v).substring(0, 100)) + '</td>';
            }).join('') + '</tr>';
          }).join('') +
          '</tbody></table>';
        resultEl.innerHTML =
          '<div class="ai-result-meta">' + d.rows.length + ' rows · ' + d.duration + 'ms</div>' +
          '<div class="ai-result-table-wrap">' + table + '</div>';
      } else {
        resultEl.innerHTML = '<div class="ai-result-meta">' + (d.rowCount || 0) + ' rows affected · ' + d.duration + 'ms</div>';
      }
    })
    .catch(function (e) {
      resultEl.innerHTML = '<div class="ai-sql-error">' + esc(e.message) + '</div>';
    });
  };

  window.aiCopySql = function (id) {
    var block = document.getElementById(id);
    if (!block) return;
    var sql = block.querySelector('.ai-sql-code').textContent;
    navigator.clipboard.writeText(sql).then(function () {
      Toast.success('SQL copied');
    });
  };

  // ── Health tab ──────────────────────────────────────────────────────────────

  function loadHealth() {
    var el = document.getElementById('ai-health-content');
    if (!el) return;
    el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-tertiary)"><div class="ai-thinking-dots" style="display:inline-flex"><span></span><span></span><span></span></div><br>Running 10 diagnostic checks...</div>';

    fetch('/api/db/assistant/diagnostics?' + dbParam())
      .then(function (r) { if (!(r.headers.get('content-type')||'').includes('json')) throw new Error('Restart server'); return r.json(); })
      .then(function (d) {
        if (d.error) { el.innerHTML = '<div style="padding:24px;color:var(--orange)">' + esc(d.error) + '</div>'; return; }
        renderHealth(d);
      })
      .catch(function (e) {
        el.innerHTML = '<div style="padding:24px;color:var(--orange)">' + esc(e.message) + '</div>';
      });
  }

  function renderHealth(d) {
    var el = document.getElementById('ai-health-content');
    if (!el) return;

    var scoreColor = d.score >= 80 ? 'var(--cyan)' : d.score >= 50 ? '#facc15' : 'var(--orange)';
    var scoreLabel = d.score >= 80 ? 'Healthy' : d.score >= 50 ? 'Needs Attention' : 'Critical';

    var html =
      '<div class="ai-health-header">' +
        '<div class="ai-health-score-ring" style="--score-color:' + scoreColor + '">' +
          '<div class="ai-health-score-num">' + d.score + '</div>' +
          '<div class="ai-health-score-label">' + scoreLabel + '</div>' +
        '</div>' +
        '<div class="ai-health-summary">' +
          '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Database Health Report</div>' +
          '<div style="font-size:12px;color:var(--text-secondary)">' +
            d.checks.filter(function (c) { return c.status === 'good'; }).length + ' passed, ' +
            d.checks.filter(function (c) { return c.status === 'warn'; }).length + ' warnings, ' +
            d.checks.filter(function (c) { return c.status === 'bad'; }).length + ' critical' +
          '</div>' +
          '<button class="btn btn-sm" style="margin-top:12px" onclick="loadHealth()">Re-run Diagnostics</button>' +
        '</div>' +
      '</div>' +
      '<div class="ai-health-grid">';

    d.checks.forEach(function (c) {
      var icon = c.status === 'good' ? '&#10003;' : c.status === 'warn' ? '!' : c.status === 'bad' ? '&#10007;' : c.status === 'info' ? 'i' : '?';
      var statusClass = 'ai-status-' + c.status;
      html += '<div class="ai-health-card">' +
        '<div class="ai-health-card-top">' +
          '<span class="ai-health-icon ' + statusClass + '">' + icon + '</span>' +
          '<span class="ai-health-card-name">' + esc(c.name) + '</span>' +
        '</div>' +
        '<div class="ai-health-card-value">' + esc(c.value || '--') + '</div>' +
        '<div class="ai-health-card-detail">' + esc(c.detail) + '</div>' +
        (c.fixable ? '<button class="ai-fix-btn" onclick="aiAutoFix(\'' + c.id + '\')">Auto-Fix</button>' : '') +
      '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  window.aiAutoFix = function (checkId) {
    fetch('/api/db/assistant/fix?' + dbParam(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkId: checkId })
    })
    .then(safeJson)
    .then(function (d) {
      if (d.error) { Toast.error(d.error); return; }
      if (!d.fixSql) { Toast.info('No automatic fix available'); return; }
      // Switch to chat tab and show the fix
      aiSetTab('chat');
      appendMsg('ai', (d.warning ? '**Warning:** ' + d.warning + '\n\n' : '') + 'Here is the fix SQL for **' + checkId + '**:\n\n```sql\n' + d.fixSql + '\n```\n\nReview the SQL above and click **Run** to apply.');
    })
    .catch(function (e) { Toast.error(e.message); });
  };

  // ── Deploy tab ──────────────────────────────────────────────────────────────

  function loadDeploy() {
    var el = document.getElementById('ai-deploy-content');
    if (!el) return;
    el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-tertiary)"><div class="ai-thinking-dots" style="display:inline-flex"><span></span><span></span><span></span></div><br>Running pre-deploy checks...</div>';

    fetch('/api/db/assistant/deploy-check?' + dbParam())
      .then(function (r) { if (!(r.headers.get('content-type')||'').includes('json')) throw new Error('Restart server'); return r.json(); })
      .then(function (d) {
        if (d.error) { el.innerHTML = '<div style="padding:24px;color:var(--orange)">' + esc(d.error) + '</div>'; return; }
        renderDeploy(d);
      })
      .catch(function (e) {
        el.innerHTML = '<div style="padding:24px;color:var(--orange)">' + esc(e.message) + '</div>';
      });
  }

  function renderDeploy(d) {
    var el = document.getElementById('ai-deploy-content');
    if (!el) return;

    var bannerClass = d.ready ? 'ai-deploy-ready' : 'ai-deploy-blocked';
    var bannerText = d.ready ? 'READY TO DEPLOY' : 'DEPLOYMENT BLOCKED';
    var bannerSub = d.passed + '/' + d.total + ' checks passed';

    var html =
      '<div class="ai-deploy-banner ' + bannerClass + '">' +
        '<div class="ai-deploy-banner-icon">' + (d.ready ? '&#10003;' : '&#10007;') + '</div>' +
        '<div>' +
          '<div class="ai-deploy-banner-title">' + bannerText + '</div>' +
          '<div class="ai-deploy-banner-sub">' + bannerSub + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ai-deploy-list">';

    d.checks.forEach(function (c) {
      var icon = c.status === 'pass' ? '&#10003;' : c.status === 'warn' ? '!' : '&#10007;';
      var cls = 'ai-deploy-item ai-deploy-' + c.status;
      html += '<div class="' + cls + '">' +
        '<span class="ai-deploy-icon">' + icon + '</span>' +
        '<span class="ai-deploy-name">' + esc(c.name) + '</span>' +
        '<span class="ai-deploy-detail">' + esc(c.detail) + '</span>' +
      '</div>';
    });

    html += '</div>' +
      '<div class="ai-deploy-actions">' +
        '<button class="btn btn-sm" onclick="loadDeploy()">Re-check</button>' +
        '<button class="btn btn-sm btn-primary" onclick="aiQuick(\'Generate a complete deployment script for this database. Target: Ubuntu 22.04 with PostgreSQL 17. Include: SSH setup, git pull, run pending migrations in order, run seeds, health check, rollback on failure.\');aiSetTab(\'chat\')">Generate Deploy Script</button>' +
      '</div>';

    el.innerHTML = html;
  }

  function esc(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }
})();
