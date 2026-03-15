/**
 * Bulwark — Brain Chat View
 * AI-powered DevOps assistant with context-aware knowledge base,
 * user profiling, and conversation memory.
 */
(function () {
  'use strict';

  var conversationHistory = [];
  var currentSection = 'brain';

  Views.brain = {
    init: function () {
      var container = document.getElementById('view-brain');
      if (!container) return;

      container.innerHTML =
        '<div class="brain-layout" style="display:flex;gap:16px;height:calc(100vh - 120px)">' +
          // Chat panel (main)
          '<div style="flex:1;display:flex;flex-direction:column;min-width:0">' +
            '<div class="card" style="flex:1;display:flex;flex-direction:column;overflow:hidden">' +
              '<div class="card-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">' +
                '<div style="display:flex;align-items:center;gap:10px">' +
                  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--cyan)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 10h0M16 10h0M9 15c1.5 1.5 4.5 1.5 6 0"/></svg>' +
                  '<span style="font-weight:600;color:var(--text-primary)">Bulwark Brain</span>' +
                  '<span id="brain-profile-badge" class="badge" style="font-size:10px"></span>' +
                '</div>' +
                '<div style="display:flex;gap:8px">' +
                  '<button class="btn btn-sm" onclick="Views.brain.clearChat()" title="Clear conversation">Clear</button>' +
                  '<button class="btn btn-sm" onclick="Views.brain.showStats()" title="Brain stats">Stats</button>' +
                '</div>' +
              '</div>' +
              // Messages area
              '<div id="brain-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px">' +
                '<div class="brain-welcome" style="text-align:center;padding:40px 20px;color:var(--text-secondary)">' +
                  '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="var(--cyan)" stroke-width="1" style="margin-bottom:12px"><circle cx="24" cy="24" r="20"/><path d="M16 20h0M32 20h0M18 30c3 3 9 3 12 0"/><path d="M24 4v4M24 40v4M4 24h4M40 24h4" stroke-opacity="0.3"/></svg>' +
                  '<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Bulwark Brain</div>' +
                  '<div style="max-width:400px;margin:0 auto;line-height:1.6">Senior DevOps & Cloud Engineer at your service. Ask about AWS, Docker, PostgreSQL, Kubernetes, CI/CD, monitoring, security hardening, and more.</div>' +
                  '<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center">' +
                    '<button class="btn btn-sm" onclick="Views.brain.askQuestion(\'How do I optimize my Dockerfile for production?\')">Dockerfile optimization</button>' +
                    '<button class="btn btn-sm" onclick="Views.brain.askQuestion(\'What PostgreSQL settings should I tune for 16GB RAM?\')">PostgreSQL tuning</button>' +
                    '<button class="btn btn-sm" onclick="Views.brain.askQuestion(\'Design a CI/CD pipeline for a Node.js app\')">CI/CD pipeline</button>' +
                    '<button class="btn btn-sm" onclick="Views.brain.askQuestion(\'How do I harden SSH on Ubuntu?\')">SSH hardening</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              // Input area
              '<div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px">' +
                '<input id="brain-input" type="text" class="form-input" style="flex:1" placeholder="Ask Bulwark Brain anything about DevOps, Cloud, or SysAdmin..." onkeydown="if(event.key===\'Enter\')Views.brain.send()">' +
                '<button class="btn btn-cyan" onclick="Views.brain.send()" id="brain-send-btn">Send</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          // Side panel (discovery + memory)
          '<div id="brain-sidebar" style="width:280px;display:flex;flex-direction:column;gap:12px;flex-shrink:0">' +
            // Profile completion
            '<div class="card" style="padding:16px">' +
              '<div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:8px">Profile</div>' +
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
                '<div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">' +
                  '<div id="brain-profile-bar" style="height:100%;background:var(--cyan);border-radius:3px;transition:width 0.3s"></div>' +
                '</div>' +
                '<span id="brain-profile-pct" style="font-size:12px;color:var(--text-secondary)">0%</span>' +
              '</div>' +
              '<div id="brain-discovery" style="font-size:12px;color:var(--text-secondary)"></div>' +
            '</div>' +
            // Provider status
            '<div class="card" style="padding:16px">' +
              '<div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:8px">AI Providers</div>' +
              '<div id="brain-providers" style="font-size:12px"></div>' +
            '</div>' +
            // Memory summary
            '<div class="card" style="padding:16px;flex:1;overflow-y:auto">' +
              '<div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:8px">Memory</div>' +
              '<div id="brain-memory-summary" style="font-size:12px;color:var(--text-secondary)">No memories yet</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      this.loadProfile();
      this.loadProviders();
      this.loadMemoryStats();
    },

    hide: function () {},

    send: function () {
      var input = document.getElementById('brain-input');
      if (!input) return;
      var msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      this.askQuestion(msg);
    },

    askQuestion: function (msg) {
      var messagesDiv = document.getElementById('brain-messages');
      if (!messagesDiv) return;

      // Remove welcome screen
      var welcome = messagesDiv.querySelector('.brain-welcome');
      if (welcome) welcome.remove();

      // Add user message
      messagesDiv.innerHTML += '<div style="display:flex;justify-content:flex-end"><div style="background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.2);border-radius:12px 12px 4px 12px;padding:10px 14px;max-width:70%;color:var(--text-primary);font-size:13px;line-height:1.5">' + escapeHtml(msg) + '</div></div>';

      // Add loading indicator
      var loadingId = 'brain-loading-' + Date.now();
      messagesDiv.innerHTML += '<div id="' + loadingId + '" style="display:flex"><div style="background:var(--surface);border:1px solid var(--border);border-radius:12px 12px 12px 4px;padding:10px 14px;color:var(--text-secondary);font-size:13px"><span class="loading-dots">Thinking</span></div></div>';
      messagesDiv.scrollTop = messagesDiv.scrollHeight;

      // Track conversation
      conversationHistory.push({ role: 'user', content: msg });

      var self = this;
      fetch('/api/brain/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          sectionContext: currentSection,
          conversationHistory: conversationHistory.slice(-10),
        }),
      })
        .then(safeJson)
        .then(function (data) {
          var loading = document.getElementById(loadingId);
          if (loading) loading.remove();

          if (data.error) {
            messagesDiv.innerHTML += '<div style="display:flex"><div style="background:rgba(255,107,43,0.1);border:1px solid rgba(255,107,43,0.2);border-radius:12px;padding:10px 14px;color:var(--orange);font-size:13px">' + escapeHtml(data.error) + '</div></div>';
            return;
          }

          // Format response with markdown
          var responseHtml = typeof marked !== 'undefined' ? marked.parse(data.response) : escapeHtml(data.response).replace(/\n/g, '<br>');

          var responseDiv = '<div style="display:flex;gap:8px"><div style="background:var(--surface);border:1px solid var(--border);border-radius:12px 12px 12px 4px;padding:12px 16px;max-width:80%;font-size:13px;line-height:1.6;color:var(--text-primary)">' + responseHtml;

          // KB sources
          if (data.sources && data.sources.length) {
            responseDiv += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-tertiary)">Sources: ' + data.sources.map(function (s) { return '[' + s.id + '] ' + s.title; }).join(', ') + '</div>';
          }

          // Suggested actions
          if (data.suggestedActions && data.suggestedActions.length) {
            responseDiv += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">';
            data.suggestedActions.forEach(function (a) {
              responseDiv += '<button class="btn btn-sm" style="font-size:10px" onclick="navigateTo(\'' + a.targetSection + '\')">' + escapeHtml(a.name) + '</button>';
            });
            responseDiv += '</div>';
          }

          responseDiv += '</div></div>';
          messagesDiv.innerHTML += responseDiv;
          messagesDiv.scrollTop = messagesDiv.scrollHeight;

          conversationHistory.push({ role: 'assistant', content: data.response });

          // Update profile
          if (data.profileCompletion !== null && data.profileCompletion !== undefined) {
            self.updateProfileBar(data.profileCompletion);
          }
          if (data.discoveryQuestion) {
            var disc = document.getElementById('brain-discovery');
            if (disc) disc.innerHTML = '<div style="margin-top:4px;padding:8px;background:rgba(34,211,238,0.05);border-radius:6px;border:1px solid rgba(34,211,238,0.1)"><div style="font-size:11px;color:var(--cyan);margin-bottom:4px">Suggested question:</div>' + escapeHtml(data.discoveryQuestion) + '</div>';
          }
        })
        .catch(function (err) {
          var loading = document.getElementById(loadingId);
          if (loading) loading.remove();
          messagesDiv.innerHTML += '<div style="display:flex"><div style="background:rgba(255,107,43,0.1);border:1px solid rgba(255,107,43,0.2);border-radius:12px;padding:10px 14px;color:var(--orange);font-size:13px">Error: ' + escapeHtml(err.message) + '</div></div>';
        });
    },

    clearChat: function () {
      conversationHistory = [];
      var messagesDiv = document.getElementById('brain-messages');
      if (messagesDiv) {
        messagesDiv.innerHTML =
          '<div class="brain-welcome" style="text-align:center;padding:40px 20px;color:var(--text-secondary)">' +
            '<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Conversation cleared</div>' +
            '<div>Start a new conversation by typing below.</div>' +
          '</div>';
      }
    },

    loadProfile: function () {
      var self = this;
      fetch('/api/brain/profile').then(safeJson).then(function (data) {
        if (data.completion !== undefined) self.updateProfileBar(data.completion);
        if (data.nextQuestion) {
          var disc = document.getElementById('brain-discovery');
          if (disc) disc.innerHTML = '<div style="padding:8px;background:rgba(34,211,238,0.05);border-radius:6px;border:1px solid rgba(34,211,238,0.1)"><div style="font-size:11px;color:var(--cyan);margin-bottom:4px">Help me learn about you:</div>' + escapeHtml(data.nextQuestion) + '</div>';
        }
      }).catch(function () {});
    },

    updateProfileBar: function (pct) {
      var bar = document.getElementById('brain-profile-bar');
      var label = document.getElementById('brain-profile-pct');
      var badge = document.getElementById('brain-profile-badge');
      if (bar) bar.style.width = pct + '%';
      if (label) label.textContent = pct + '%';
      if (badge) {
        badge.textContent = pct < 30 ? 'learning' : pct < 85 ? 'adapting' : 'ready';
        badge.style.background = pct < 30 ? 'rgba(255,107,43,0.15)' : pct < 85 ? 'rgba(34,211,238,0.1)' : 'rgba(34,211,238,0.2)';
        badge.style.color = pct < 30 ? 'var(--orange)' : 'var(--cyan)';
      }
    },

    loadProviders: function () {
      var div = document.getElementById('brain-providers');
      if (!div) return;
      fetch('/api/brain/providers').then(safeJson).then(function (data) {
        if (!data.providers) return;
        div.innerHTML = data.providers.map(function (p) {
          var dot = p.available ? '<span style="color:var(--cyan)">●</span>' : '<span style="color:var(--text-tertiary)">○</span>';
          var def = p.isDefault ? ' <span style="color:var(--cyan);font-size:10px">(default)</span>' : '';
          return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0">' + dot + ' <span>' + p.id + '</span>' + def + '</div>';
        }).join('');
      }).catch(function () { div.innerHTML = '<span style="color:var(--text-tertiary)">Unable to check</span>'; });
    },

    loadMemoryStats: function () {
      var div = document.getElementById('brain-memory-summary');
      if (!div) return;
      fetch('/api/brain/memories?limit=5').then(safeJson).then(function (data) {
        if (!data.stats || data.stats.total === 0) {
          div.innerHTML = '<span style="color:var(--text-tertiary)">No memories stored yet. Chat with Brain to build memory.</span>';
          return;
        }
        var html = '<div style="margin-bottom:6px">' + data.stats.total + ' memories</div>';
        if (data.memories && data.memories.length) {
          html += data.memories.map(function (m) {
            return '<div style="padding:4px 0;border-bottom:1px solid var(--border);color:var(--text-secondary);font-size:11px"><span style="color:var(--cyan)">[' + m.type + ']</span> ' + escapeHtml(m.content.substring(0, 60)) + '</div>';
          }).join('');
        }
        div.innerHTML = html;
      }).catch(function () {});
    },

    showStats: function () {
      fetch('/api/brain/stats').then(safeJson).then(function (data) {
        Modal.open({
          title: 'Brain Stats',
          body: '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div class="card" style="padding:12px"><div style="font-size:11px;color:var(--text-secondary)">KB Entries</div><div style="font-size:24px;color:var(--cyan)">' + (data.kb ? data.kb.totalEntries : 0) + '</div></div>' +
            '<div class="card" style="padding:12px"><div style="font-size:11px;color:var(--text-secondary)">Profile</div><div style="font-size:24px;color:var(--cyan)">' + (data.profile ? data.profile.completion : 0) + '%</div></div>' +
            '<div class="card" style="padding:12px"><div style="font-size:11px;color:var(--text-secondary)">Memories</div><div style="font-size:24px;color:var(--cyan)">' + (data.memory ? data.memory.total : 0) + '</div></div>' +
            '<div class="card" style="padding:12px"><div style="font-size:11px;color:var(--text-secondary)">Infrastructure</div><div style="font-size:14px;color:var(--text-primary)">' + (data.profile && data.profile.industry ? data.profile.industry : 'Not set') + '</div></div>' +
          '</div>',
          size: 'md',
        });
      }).catch(function (err) { Toast.error('Failed to load stats: ' + err.message); });
    },
  };
})();
