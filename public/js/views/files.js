/**
 * Chester Dev Monitor — File Intelligence Center
 * AI file analysis, search, git-aware browsing, stats, syntax preview
 */
(function () {
  'use strict';

  var currentPath = '.';
  var activeTab = 'browse';

  Views.files = {
    init: function () {
      var c = document.getElementById('view-files');
      if (!c) return;
      c.innerHTML =
        '<div class="files-dashboard">' +
          // AI Analysis
          '<div class="files-ai-card" id="files-ai-card">' +
            '<div class="files-ai-header"><div class="ai-dot"></div><span>Chester File Analysis</span></div>' +
            '<div class="files-ai-body" id="files-ai-body">Click analyze for AI insights on your project structure...</div>' +
            '<button class="files-ai-btn" onclick="filesAiAnalysis()">Analyze Project Structure</button>' +
          '</div>' +
          // Tabs
          '<div class="files-tabs">' +
            '<button class="files-tab-btn active" data-tab="browse" onclick="filesTab(\'browse\')">Browse</button>' +
            '<button class="files-tab-btn" data-tab="search" onclick="filesTab(\'search\')">Search</button>' +
            '<button class="files-tab-btn" data-tab="stats" onclick="filesTab(\'stats\')">Stats</button>' +
            '<button class="files-tab-btn" data-tab="recent" onclick="filesTab(\'recent\')">Recent</button>' +
          '</div>' +
          // Content
          '<div id="files-tab-content"></div>' +
        '</div>';
    },
    show: function () { renderTab(); },
    hide: function () {},
    update: function () {}
  };

  window.filesTab = function (tab) {
    activeTab = tab;
    document.querySelectorAll('.files-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderTab();
  };

  function renderTab() {
    var el = document.getElementById('files-tab-content');
    if (!el) return;
    if (activeTab === 'browse') renderBrowse(el);
    else if (activeTab === 'search') renderSearch(el);
    else if (activeTab === 'stats') renderStats(el);
    else if (activeTab === 'recent') renderRecent(el);
  }

  // ── Browse Tab ──

  function renderBrowse(el) {
    el.innerHTML =
      '<div class="files-section">' +
        '<div class="files-toolbar">' +
          '<div id="files-breadcrumb" class="files-breadcrumb"></div>' +
          '<div class="files-toolbar-actions">' +
            '<button class="btn btn-sm btn-cyan" onclick="newFileOrFolder(\'file\')">New File</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="newFileOrFolder(\'dir\')">New Folder</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="browseDir(currentFilePath || \'.\')">Refresh</button>' +
          '</div>' +
        '</div>' +
        '<div id="files-listing" style="color:var(--text-tertiary)">Loading...</div>' +
      '</div>';
    browseDir(currentPath);
  }

  window.browseDir = function (p) {
    currentPath = p;
    window.currentFilePath = p;
    var listing = document.getElementById('files-listing');
    if (!listing) return;
    listing.innerHTML = '<div style="color:var(--text-tertiary)">Loading...</div>';
    fetch('/api/files/browse?path=' + encodeURIComponent(p))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { listing.innerHTML = '<div style="color:var(--orange)">' + esc(d.error) + '</div>'; return; }
        currentPath = d.path || '.';
        renderBreadcrumb();
        var entries = d.entries || [];
        if (!entries.length) { listing.innerHTML = '<div class="files-empty">Empty directory</div>'; return; }
        listing.innerHTML = '<div class="files-grid">' +
          entries.map(function (e) {
            var icon = getFileIcon(e.name, e.type);
            var size = e.type === 'dir' ? '--' : formatSize(e.size || 0);
            var clickPath = currentPath === '.' ? e.name : currentPath + '/' + e.name;
            var ext = e.name.split('.').pop().toLowerCase();
            return '<div class="files-row" data-type="' + e.type + '">' +
              '<div class="files-row-icon">' + icon + '</div>' +
              '<div class="files-row-name" onclick="' + (e.type === 'dir' ? 'browseDir(\'' + escAttr(clickPath) + '\')' : 'openFileEnhanced(\'' + escAttr(clickPath) + '\')') + '">' +
                esc(e.name) +
              '</div>' +
              '<div class="files-row-size">' + size + '</div>' +
              '<div class="files-row-modified">' + (e.modified ? timeAgo(e.modified) : '--') + '</div>' +
              '<div class="files-row-actions">' +
                (e.type === 'file' ? '<button class="files-action-btn" onclick="aiSummarize(\'' + escAttr(clickPath) + '\')" title="AI Summarize">AI</button>' : '') +
                '<button class="files-action-btn" onclick="fileGitInfo(\'' + escAttr(clickPath) + '\')" title="Git History">Git</button>' +
                '<button class="files-action-btn danger" onclick="deleteFileEnhanced(\'' + escAttr(clickPath) + '\')" title="Delete">Del</button>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>';
      })
      .catch(function (e) { listing.innerHTML = '<div style="color:var(--orange)">' + esc(e.message) + '</div>'; });
  };

  function renderBreadcrumb() {
    var el = document.getElementById('files-breadcrumb');
    if (!el) return;
    var parts = currentPath === '.' ? [] : currentPath.split('/').filter(Boolean);
    var crumbs = ['<span class="files-crumb" onclick="browseDir(\'.\')">root</span>'];
    var accumulated = '';
    parts.forEach(function (p) {
      accumulated += (accumulated ? '/' : '') + p;
      var path = accumulated;
      crumbs.push('<span class="files-crumb-sep">/</span><span class="files-crumb" onclick="browseDir(\'' + escAttr(path) + '\')">' + esc(p) + '</span>');
    });
    el.innerHTML = crumbs.join('');
  }

  function getFileIcon(name, type) {
    if (type === 'dir') return '<span class="files-icon dir">&#128193;</span>';
    var ext = name.split('.').pop().toLowerCase();
    var colors = { js: '#f7df1e', ts: '#3178c6', json: '#292929', css: '#264de4', html: '#e34c26', md: '#083fa1', py: '#3572A5', sh: '#89e051', yml: '#cb171e', sql: '#e38c00' };
    var color = colors[ext] || 'var(--text-tertiary)';
    return '<span class="files-icon file" style="color:' + color + '">&#128196;</span>';
  }

  // ── Search Tab ──

  function renderSearch(el) {
    el.innerHTML =
      '<div class="files-section">' +
        '<div class="files-search-bar">' +
          '<input id="files-search-input" class="form-input" placeholder="Search files by name or content..." style="flex:1" onkeydown="if(event.key===\'Enter\')runFileSearch()">' +
          '<select id="files-search-mode" class="form-input" style="width:120px"><option value="name">File Name</option><option value="content">Content</option></select>' +
          '<button class="btn btn-sm btn-cyan" onclick="runFileSearch()">Search</button>' +
        '</div>' +
        '<div id="files-search-results"></div>' +
      '</div>';
  }

  window.runFileSearch = function () {
    var q = (document.getElementById('files-search-input') || {}).value;
    var mode = (document.getElementById('files-search-mode') || {}).value || 'name';
    var results = document.getElementById('files-search-results');
    if (!q || !results) return;
    results.innerHTML = '<div style="color:var(--text-tertiary)">Searching...</div>';
    fetch('/api/files/search?q=' + encodeURIComponent(q) + '&mode=' + mode)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = d.results || [];
        if (!items.length) { results.innerHTML = '<div class="files-empty">No results found</div>'; return; }
        results.innerHTML = '<div class="files-search-list">' +
          items.map(function (r) {
            return '<div class="files-search-item" onclick="openFileEnhanced(\'' + escAttr(r.file) + '\')">' +
              '<div class="files-search-file">' + esc(r.file) + (r.line ? ':' + r.line : '') + '</div>' +
              (r.match ? '<div class="files-search-match">' + esc(r.match) + '</div>' : '') +
            '</div>';
          }).join('') +
        '</div>';
      });
  };

  // ── Stats Tab ──

  function renderStats(el) {
    el.innerHTML = '<div class="files-section"><div style="color:var(--text-tertiary)">Loading stats...</div></div>';
    Promise.all([
      fetch('/api/files/stats').then(function (r) { return r.json(); }),
      fetch('/api/files/large').then(function (r) { return r.json(); }),
    ]).then(function (results) {
      var stats = results[0];
      var large = results[1];
      var maxExt = stats.extensions && stats.extensions.length ? stats.extensions[0].count : 1;

      el.innerHTML =
        '<div class="files-stats-grid">' +
          // Overview cards
          '<div class="files-stat-card"><div class="files-stat-val">' + (stats.totalFiles || 0) + '</div><div class="files-stat-label">Total Files</div></div>' +
          '<div class="files-stat-card"><div class="files-stat-val">' + formatSize(stats.totalSize || 0) + '</div><div class="files-stat-label">Total Size</div></div>' +
          '<div class="files-stat-card"><div class="files-stat-val">' + (stats.repoSize || '--') + '</div><div class="files-stat-label">Repo Size</div></div>' +
          '<div class="files-stat-card"><div class="files-stat-val">' + ((stats.extensions || []).length) + '</div><div class="files-stat-label">File Types</div></div>' +
        '</div>' +
        '<div class="files-stats-detail">' +
          // Extensions
          '<div class="files-section"><h3>File Types</h3>' +
            '<div class="files-ext-list">' +
              (stats.extensions || []).slice(0, 15).map(function (e) {
                var pct = Math.round((e.count / maxExt) * 100);
                return '<div class="files-ext-row">' +
                  '<span class="files-ext-name">' + esc(e.ext) + '</span>' +
                  '<div class="files-ext-bar-wrap"><div class="files-ext-bar" style="width:' + pct + '%"></div></div>' +
                  '<span class="files-ext-count">' + e.count + '</span>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>' +
          // Top directories
          '<div class="files-section"><h3>Top Directories</h3>' +
            '<div class="files-ext-list">' +
              (stats.directories || []).slice(0, 10).map(function (d) {
                var maxDir = (stats.directories || [])[0]?.count || 1;
                var pct = Math.round((d.count / maxDir) * 100);
                return '<div class="files-ext-row">' +
                  '<span class="files-ext-name" style="cursor:pointer;color:var(--cyan)" onclick="browseDir(\'' + escAttr(d.dir) + '\');filesTab(\'browse\')">' + esc(d.dir) + '/</span>' +
                  '<div class="files-ext-bar-wrap"><div class="files-ext-bar" style="width:' + pct + '%;background:rgba(167,139,250,0.5)"></div></div>' +
                  '<span class="files-ext-count">' + d.count + '</span>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +
        // Large files
        '<div class="files-section"><h3>Largest Files</h3>' +
          '<div class="files-large-list">' +
            (large.files || []).slice(0, 10).map(function (f) {
              return '<div class="files-large-item">' +
                '<span class="files-large-name" onclick="openFileEnhanced(\'' + escAttr(f.name) + '\')">' + esc(f.name) + '</span>' +
                '<span class="files-large-size">' + formatSize(f.size) + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
    });
  }

  // ── Recent Tab ──

  function renderRecent(el) {
    el.innerHTML = '<div class="files-section"><div style="color:var(--text-tertiary)">Loading...</div></div>';
    fetch('/api/files/recent').then(function (r) { return r.json(); }).then(function (d) {
      var files = d.files || [];
      el.innerHTML = '<div class="files-section"><h3>Recently Modified Files</h3>' +
        (files.length ? '<div class="files-recent-list">' +
          files.map(function (f) {
            return '<div class="files-recent-item" onclick="openFileEnhanced(\'' + escAttr(f) + '\')">' +
              '<span class="files-recent-icon">' + getFileIcon(f, 'file') + '</span>' +
              '<span class="files-recent-name">' + esc(f) + '</span>' +
            '</div>';
          }).join('') +
        '</div>' : '<div class="files-empty">No recent files</div>') +
      '</div>';
    });
  }

  // ── Actions ──

  window.openFileEnhanced = function (filePath) {
    fetch('/api/files/read?path=' + encodeURIComponent(filePath))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Modal.open({
          title: filePath, size: 'xl',
          body: '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
              '<span style="font-size:11px;color:var(--text-tertiary)">' + formatSize(d.size || 0) + '</span>' +
              '<button class="btn btn-sm" onclick="aiSummarize(\'' + escAttr(filePath) + '\')">AI Summarize</button>' +
            '</div>' +
            '<textarea id="file-editor" style="width:100%;height:50vh;background:var(--well);color:var(--text-secondary);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:\'JetBrains Mono\',monospace;font-size:12px;resize:vertical;box-sizing:border-box">' +
            esc(d.content || '') + '</textarea>',
          footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
            '<button class="btn btn-sm btn-primary" id="file-save-btn">Save</button>'
        });
        setTimeout(function () {
          var btn = document.getElementById('file-save-btn');
          if (btn) btn.onclick = function () {
            var content = (document.getElementById('file-editor') || {}).value;
            fetch('/api/files/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: filePath, content: content }) })
              .then(function (r) { return r.json(); })
              .then(function (d2) {
                if (d2.error) { Toast.error(d2.error); return; }
                Toast.success('Saved'); Modal.close(btn.closest('.modal-overlay'));
              }).catch(function () { Toast.error('Save failed'); });
          };
        }, 50);
      }).catch(function (e) { Toast.error(e.message); });
  };

  window.aiSummarize = function (filePath) {
    Toast.info('Summarizing...');
    fetch('/api/files/ai-summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: filePath }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        Modal.open({ title: 'AI Summary: ' + filePath, size: 'md',
          body: '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6">' + esc(d.summary || 'No summary available') + '</div>' +
            (d.cached ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:8px">Cached result</div>' : '')
        });
      }).catch(function () { Toast.error('Summary failed'); });
  };

  window.fileGitInfo = function (filePath) {
    fetch('/api/files/git-info?path=' + encodeURIComponent(filePath))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var commits = d.commits || [];
        Modal.open({ title: 'Git History: ' + filePath, size: 'md',
          body: (d.lastAuthor ? '<div style="margin-bottom:12px;font-size:12px">Last modified by: <strong style="color:var(--cyan)">' + esc(d.lastAuthor) + '</strong></div>' : '') +
            (commits.length ? commits.map(function (c) {
              return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">' +
                '<span style="color:var(--cyan);font-family:monospace">' + esc(c.hash || '') + '</span> ' +
                '<span style="color:var(--text-primary)">' + esc(c.message || '') + '</span><br>' +
                '<span style="color:var(--text-tertiary)">' + esc(c.author || '') + ' &middot; ' + timeAgo(c.date) + '</span>' +
              '</div>';
            }).join('') : '<div style="text-align:center;color:var(--text-tertiary);padding:24px">No git history</div>')
        });
      }).catch(function () { Toast.error('Failed to load git info'); });
  };

  window.newFileOrFolder = function (type) {
    var label = type === 'dir' ? 'Folder' : 'File';
    Modal.open({
      title: 'New ' + label, size: 'sm',
      body: '<div class="form-group"><label class="form-label">Name</label><input id="new-file-name" class="form-input" placeholder="filename.js"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="new-file-btn">Create</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('new-file-btn');
      if (btn) btn.onclick = function () {
        var name = (document.getElementById('new-file-name') || {}).value;
        if (!name) return;
        var path = currentPath === '.' ? name : currentPath + '/' + name;
        fetch('/api/files/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: path, type: type }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success(label + ' created'); Modal.close(btn.closest('.modal-overlay')); browseDir(currentPath);
          }).catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.deleteFileEnhanced = function (path) {
    Modal.confirm({ title: 'Delete', message: 'Delete "' + path + '"?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/files/delete?path=' + encodeURIComponent(path), { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) { Toast.error(d.error); return; }
          Toast.success('Deleted'); browseDir(currentPath);
        }).catch(function () { Toast.error('Failed'); });
    });
  };

  window.filesAiAnalysis = function () {
    var body = document.getElementById('files-ai-body');
    if (!body) return;
    body.innerHTML = 'Analyzing project structure...<span class="cursor-blink"></span>';
    fetch('/api/files/ai-analysis').then(function (r) { return r.json(); }).then(function (d) {
      typewriter(body, d.analysis || 'No analysis available.');
    }).catch(function () { body.textContent = 'Analysis unavailable.'; });
  };

  function typewriter(el, text) {
    el.textContent = '';
    var i = 0;
    var iv = setInterval(function () { el.textContent += text[i]; i++; if (i >= text.length) clearInterval(iv); }, 15);
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    var k = 1024; var s = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '--';
    var diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return Math.round(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
    return Math.round(diff / 86400000) + 'd ago';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
  function escAttr(str) { return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
})();
