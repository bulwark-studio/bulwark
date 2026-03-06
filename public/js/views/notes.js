/**
 * Notes Intelligence Center — AI-powered knowledge capture
 * ViewRegistry pattern: Views.notes = { init, show, hide, update }
 */
(function () {
  'use strict';

  var notes = [];
  var archived = [];
  var activeTab = 'all';
  var searchQuery = '';
  var editingId = null;

  var TAG_COLORS = ['#22d3ee', '#a78bfa', '#f59e0b', '#ff6b2b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'];
  var NOTE_COLORS = {
    default: 'rgba(14,14,18,0.65)', cyan: 'rgba(34,211,238,0.08)', purple: 'rgba(167,139,250,0.08)',
    orange: 'rgba(255,107,43,0.08)', blue: 'rgba(59,130,246,0.08)', amber: 'rgba(245,158,11,0.08)'
  };

  function esc(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }
  function tagColor(tag) { var h = 0; for (var i = 0; i < tag.length; i++) h = ((h << 5) - h) + tag.charCodeAt(i); return TAG_COLORS[Math.abs(h) % TAG_COLORS.length]; }

  Views.notes = {
    init: function () {
      var c = document.getElementById('view-notes');
      if (!c) return;
      c.innerHTML =
        '<div class="notes-view">' +
          /* AI Summary */
          '<div class="notes-ai-card" id="notes-ai-card">' +
            '<div class="notes-ai-header">' +
              '<span class="notes-ai-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z"/></svg> AI Knowledge Summary</span>' +
              '<button class="notes-ai-refresh" onclick="Views.notes.loadSummary()">Refresh</button>' +
            '</div>' +
            '<div class="notes-ai-text" id="notes-ai-text"><div class="briefing-shimmer" style="width:80%"></div></div>' +
          '</div>' +

          /* Tabs */
          '<div class="notes-tabs">' +
            '<button class="notes-tab-btn active" data-tab="all" onclick="Views.notes.switchTab(\'all\')">All Notes</button>' +
            '<button class="notes-tab-btn" data-tab="pinned" onclick="Views.notes.switchTab(\'pinned\')">Pinned</button>' +
            '<button class="notes-tab-btn" data-tab="tags" onclick="Views.notes.switchTab(\'tags\')">By Tags</button>' +
            '<button class="notes-tab-btn" data-tab="archived" onclick="Views.notes.switchTab(\'archived\')">Archived</button>' +
            '<button class="notes-tab-btn" data-tab="ai" onclick="Views.notes.switchTab(\'ai\')">AI Generate</button>' +
          '</div>' +

          /* Toolbar */
          '<div class="notes-toolbar">' +
            '<div class="notes-search-wrap">' +
              '<input class="notes-search glass-input" id="notes-search" placeholder="Search notes..." oninput="Views.notes.search(this.value)"/>' +
            '</div>' +
            '<button class="notes-add-btn" onclick="Views.notes.openEditor()">+ New Note</button>' +
          '</div>' +

          /* Stats */
          '<div class="notes-stats" id="notes-stats"></div>' +

          /* Content */
          '<div class="notes-content" id="notes-content"></div>' +

          /* Editor Overlay */
          '<div class="notes-editor-overlay" id="notes-editor" style="display:none">' +
            '<div class="notes-editor-panel">' +
              '<div class="notes-editor-header">' +
                '<span id="notes-editor-title">New Note</span>' +
                '<button class="cal-close-btn" onclick="Views.notes.closeEditor()">&times;</button>' +
              '</div>' +
              '<input id="note-edit-title" class="glass-input" placeholder="Note title"/>' +
              '<textarea id="note-edit-content" class="glass-input notes-editor-textarea" placeholder="Write your note... (Markdown supported)"></textarea>' +
              '<div class="notes-editor-row">' +
                '<input id="note-edit-tags" class="glass-input" placeholder="Tags (comma-separated)"/>' +
                '<select id="note-edit-color" class="glass-input">' +
                  '<option value="default">Default</option><option value="cyan">Cyan</option><option value="purple">Purple</option>' +
                  '<option value="orange">Orange</option><option value="blue">Blue</option><option value="amber">Amber</option>' +
                '</select>' +
              '</div>' +
              '<div class="notes-editor-actions">' +
                '<button class="btn btn-ghost" onclick="Views.notes.closeEditor()">Cancel</button>' +
                '<button class="btn btn-primary" onclick="Views.notes.saveNote()">Save</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      this.loadNotes();
      this.loadSummary();
    },

    hide: function () {},
    update: function () {},

    loadNotes: function () {
      var q = searchQuery ? '?search=' + encodeURIComponent(searchQuery) : '';
      fetch('/api/notes' + q).then(function (r) { return r.json(); }).then(function (d) {
        notes = d.notes || [];
        archived = d.archived || [];
        Views.notes.renderStats();
        Views.notes.renderContent();
      }).catch(function () {});
    },

    loadSummary: function () {
      var el = document.getElementById('notes-ai-text');
      if (!el) return;
      el.innerHTML = '<div class="briefing-shimmer" style="width:80%"></div>';
      fetch('/api/notes/ai-summary').then(function (r) { return r.json(); }).then(function (d) {
        Views.notes.typewriter(el, d.summary || 'No summary available.');
      }).catch(function () { el.textContent = 'AI summary unavailable.'; });
    },

    typewriter: function (el, text) {
      el.innerHTML = '';
      var i = 0;
      var interval = setInterval(function () {
        if (i < text.length) { el.textContent += text[i]; i++; } else clearInterval(interval);
      }, 12);
    },

    renderStats: function () {
      var el = document.getElementById('notes-stats');
      if (!el) return;
      var pinned = notes.filter(function (n) { return n.pinned; });
      var allTags = {};
      notes.forEach(function (n) { (n.tags || []).forEach(function (t) { allTags[t] = (allTags[t] || 0) + 1; }); });
      var tagCount = Object.keys(allTags).length;
      el.innerHTML =
        '<div class="notes-stat"><span class="notes-stat-val" style="color:var(--cyan)">' + notes.length + '</span><span class="notes-stat-label">Notes</span></div>' +
        '<div class="notes-stat"><span class="notes-stat-val">' + pinned.length + '</span><span class="notes-stat-label">Pinned</span></div>' +
        '<div class="notes-stat"><span class="notes-stat-val">' + tagCount + '</span><span class="notes-stat-label">Tags</span></div>' +
        '<div class="notes-stat"><span class="notes-stat-val" style="color:var(--text-tertiary)">' + archived.length + '</span><span class="notes-stat-label">Archived</span></div>';
    },

    renderContent: function () {
      var el = document.getElementById('notes-content');
      if (!el) return;

      var list = notes;
      if (activeTab === 'pinned') list = notes.filter(function (n) { return n.pinned; });
      if (activeTab === 'archived') list = archived;

      if (activeTab === 'tags') { this.renderTagsView(el); return; }
      if (activeTab === 'ai') { this.renderAIView(el); return; }

      if (!list.length) {
        el.innerHTML = '<div class="notes-empty">' + (activeTab === 'pinned' ? 'No pinned notes' : activeTab === 'archived' ? 'No archived notes' : 'No notes yet. Create your first note!') + '</div>';
        return;
      }

      el.innerHTML = '<div class="notes-grid">' + list.map(function (n) {
        var bg = NOTE_COLORS[n.color] || NOTE_COLORS.default;
        return '<div class="notes-card" style="background:' + bg + '">' +
          '<div class="notes-card-header">' +
            '<span class="notes-card-title">' + esc(n.title) + '</span>' +
            '<div class="notes-card-actions">' +
              '<button onclick="Views.notes.togglePin(\'' + n.id + '\')" title="' + (n.pinned ? 'Unpin' : 'Pin') + '">' + (n.pinned ? '<span style="color:var(--cyan)">&#128204;</span>' : '&#128204;') + '</button>' +
              '<button onclick="Views.notes.openEditor(\'' + n.id + '\')" title="Edit">&#9998;</button>' +
              '<button onclick="Views.notes.archiveNote(\'' + n.id + '\')" title="Archive">&#128230;</button>' +
              '<button onclick="Views.notes.deleteNote(\'' + n.id + '\')" title="Delete">&times;</button>' +
            '</div>' +
          '</div>' +
          '<div class="notes-card-content">' + esc((n.content || '').substring(0, 200)) + (n.content && n.content.length > 200 ? '...' : '') + '</div>' +
          (n.tags && n.tags.length ? '<div class="notes-card-tags">' + n.tags.map(function (t) { return '<span class="notes-tag" style="color:' + tagColor(t) + '">#' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="notes-card-footer">' + new Date(n.updated || n.created).toLocaleDateString() + '</div>' +
        '</div>';
      }).join('') + '</div>';
    },

    renderTagsView: function (el) {
      var allTags = {};
      notes.forEach(function (n) { (n.tags || []).forEach(function (t) { if (!allTags[t]) allTags[t] = []; allTags[t].push(n); }); });
      var tagKeys = Object.keys(allTags).sort(function (a, b) { return allTags[b].length - allTags[a].length; });

      if (!tagKeys.length) { el.innerHTML = '<div class="notes-empty">No tags yet. Add tags to your notes!</div>'; return; }

      el.innerHTML = tagKeys.map(function (tag) {
        return '<div class="notes-tag-group">' +
          '<div class="notes-tag-group-header"><span class="notes-tag" style="color:' + tagColor(tag) + ';font-size:14px">#' + esc(tag) + '</span><span class="notes-tag-count">' + allTags[tag].length + '</span></div>' +
          '<div class="notes-tag-group-items">' + allTags[tag].map(function (n) {
            return '<div class="notes-tag-item" onclick="Views.notes.openEditor(\'' + n.id + '\')">' + esc(n.title) + '</div>';
          }).join('') + '</div>' +
        '</div>';
      }).join('');
    },

    renderAIView: function (el) {
      el.innerHTML =
        '<div class="notes-ai-gen">' +
          '<div class="notes-ai-gen-header">AI Note Generator</div>' +
          '<p class="notes-ai-gen-desc">Describe what you want to document and Chester will generate a structured note.</p>' +
          '<div class="notes-ai-gen-row">' +
            '<input id="notes-ai-prompt" class="glass-input" placeholder="e.g. Document our API authentication flow and security measures..." style="flex:1"/>' +
            '<button class="notes-ai-gen-btn" onclick="Views.notes.aiGenerate()">Generate</button>' +
          '</div>' +
          '<div id="notes-ai-result"></div>' +
        '</div>';
    },

    search: function (q) {
      searchQuery = q;
      this.loadNotes();
    },

    switchTab: function (tab) {
      activeTab = tab;
      document.querySelectorAll('.notes-tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
      this.renderContent();
    },

    openEditor: function (id) {
      editingId = id || null;
      var panel = document.getElementById('notes-editor');
      var titleEl = document.getElementById('notes-editor-title');
      if (!panel) return;

      if (id) {
        var n = notes.find(function (x) { return x.id === id; }) || archived.find(function (x) { return x.id === id; });
        if (n) {
          titleEl.textContent = 'Edit Note';
          document.getElementById('note-edit-title').value = n.title;
          document.getElementById('note-edit-content').value = n.content || '';
          document.getElementById('note-edit-tags').value = (n.tags || []).join(', ');
          document.getElementById('note-edit-color').value = n.color || 'default';
        }
      } else {
        titleEl.textContent = 'New Note';
        document.getElementById('note-edit-title').value = '';
        document.getElementById('note-edit-content').value = '';
        document.getElementById('note-edit-tags').value = '';
        document.getElementById('note-edit-color').value = 'default';
      }
      panel.style.display = 'flex';
    },

    closeEditor: function () {
      editingId = null;
      var panel = document.getElementById('notes-editor');
      if (panel) panel.style.display = 'none';
    },

    saveNote: function () {
      var title = document.getElementById('note-edit-title').value;
      var content = document.getElementById('note-edit-content').value;
      var tags = document.getElementById('note-edit-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      var color = document.getElementById('note-edit-color').value;

      if (!title) return Toast.error('Title required');

      var body = { title: title, content: content, tags: tags, color: color };
      var url = editingId ? '/api/notes/' + editingId : '/api/notes';
      var method = editingId ? 'PUT' : 'POST';

      fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function () { Views.notes.closeEditor(); Views.notes.loadNotes(); Toast.success(editingId ? 'Note updated' : 'Note created'); });
    },

    togglePin: function (id) {
      var n = notes.find(function (x) { return x.id === id; });
      if (!n) return;
      fetch('/api/notes/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: !n.pinned }) })
        .then(function () { Views.notes.loadNotes(); });
    },

    archiveNote: function (id) {
      fetch('/api/notes/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }) })
        .then(function () { Views.notes.loadNotes(); Toast.info('Note archived'); });
    },

    deleteNote: function (id) {
      Modal.confirm({ title: 'Delete Note', message: 'Delete this note permanently?', dangerous: true, confirmText: 'Delete' }).then(function (yes) {
        if (!yes) return;
        fetch('/api/notes/' + id, { method: 'DELETE' }).then(function () { Views.notes.loadNotes(); Toast.success('Deleted'); });
      });
    },

    aiGenerate: function () {
      var input = document.getElementById('notes-ai-prompt');
      var output = document.getElementById('notes-ai-result');
      if (!input || !input.value || !output) return;
      output.innerHTML = '<div class="briefing-shimmer" style="width:70%"></div><div class="briefing-shimmer" style="width:50%"></div>';
      fetch('/api/notes/ai-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: input.value }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (d.note) {
            output.innerHTML = '<div class="notes-ai-preview">' +
              '<div class="notes-ai-preview-title">' + esc(d.note.title) + '</div>' +
              '<div class="notes-ai-preview-content">' + esc(d.note.content) + '</div>' +
              (d.note.tags ? '<div class="notes-ai-preview-tags">' + d.note.tags.map(function (t) { return '<span class="notes-tag" style="color:' + tagColor(t) + '">#' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
              '<button class="notes-ai-save-btn" onclick="Views.notes.saveAINote()">Save as Note</button>' +
            '</div>';
            output._aiNote = d.note;
          } else output.innerHTML = '<div class="notes-empty">Could not generate note.</div>';
        }).catch(function () { output.innerHTML = '<div class="notes-empty">AI generation failed.</div>'; });
    },

    saveAINote: function () {
      var output = document.getElementById('notes-ai-result');
      if (!output || !output._aiNote) return;
      var n = output._aiNote;
      fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: n.title, content: n.content, tags: n.tags || [] }) })
        .then(function () { Views.notes.loadNotes(); Toast.success('AI note saved'); output.innerHTML = '<div class="notes-empty">Note saved! Generate another?</div>'; });
    }
  };
})();
