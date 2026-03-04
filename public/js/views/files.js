/**
 * Chester Dev Monitor v2.0 — File Manager View
 * Breadcrumb navigation, file listing, code editor modal, create/delete
 */
(function () {
  'use strict';

  var currentPath = '.';

  Views.files = {
    init: function () {
      var container = document.getElementById('view-files');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div id="file-breadcrumb" style="display:flex;align-items:center;gap:4px;font-size:13px">' +
              '<span style="color:var(--cyan)">root</span>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
              '<button class="btn btn-sm btn-cyan" onclick="newFileOrFolder(\'file\')">New File</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="newFileOrFolder(\'dir\')">New Folder</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.files.show()">Refresh</button>' +
            '</div>' +
          '</div>' +
          '<div id="file-content">' +
            '<div style="color:var(--text-tertiary)">Loading...</div>' +
          '</div>';
      }
    },
    show: function () { browsePath('.'); },
    hide: function () {},
    update: function () {}
  };

  function browsePath(p) {
    currentPath = p;
    var el = document.getElementById('file-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading...</div>';
    fetch('/api/files/browse?path=' + encodeURIComponent(p))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { el.innerHTML = '<div style="color:var(--orange)">' + esc(d.error) + '</div>'; return; }
        currentPath = d.path || '.';
        renderBreadcrumb();
        var entries = d.entries || [];
        if (!entries.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">Empty directory</div></div>'; return; }
        el.innerHTML = '<div class="table-wrap"><table><thead><tr><th></th><th>Name</th><th>Size</th><th>Modified</th><th>Actions</th></tr></thead><tbody>' +
          entries.map(function (e) {
            var icon = e.type === 'dir' ? '&#128193;' : '&#128196;';
            var size = e.type === 'dir' ? '--' : formatSize(e.size || 0);
            var mod = e.modified ? new Date(e.modified).toLocaleString() : '--';
            var clickPath = currentPath === '.' ? e.name : currentPath + '/' + e.name;
            var clickAttr = e.type === 'dir'
              ? 'onclick="browseDir(\'' + escAttr(clickPath) + '\')" style="cursor:pointer;color:var(--cyan)"'
              : 'onclick="openFile(\'' + escAttr(clickPath) + '\')" style="cursor:pointer"';
            return '<tr><td>' + icon + '</td><td ' + clickAttr + '>' + esc(e.name) + '</td><td style="color:var(--text-tertiary)">' + size + '</td>' +
              '<td style="color:var(--text-tertiary);font-size:11px">' + mod + '</td>' +
              '<td><button class="btn btn-sm btn-danger" onclick="deleteFile(\'' + escAttr(clickPath) + '\')">Del</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function (e) { el.innerHTML = '<div style="color:var(--orange)">' + esc(e.message) + '</div>'; });
  }

  function renderBreadcrumb() {
    var el = document.getElementById('file-breadcrumb');
    if (!el) return;
    var parts = currentPath.split('/').filter(Boolean);
    var crumbs = ['<span style="cursor:pointer;color:var(--cyan)" onclick="browseDir(\'.\')">root</span>'];
    var accumulated = '';
    parts.forEach(function (p) {
      accumulated += (accumulated ? '/' : '') + p;
      var path = accumulated;
      crumbs.push('<span style="cursor:pointer;color:var(--cyan)" onclick="browseDir(\'' + escAttr(path) + '\')">' + esc(p) + '</span>');
    });
    el.innerHTML = crumbs.join(' <span style="color:var(--text-tertiary)">/</span> ');
  }

  window.browseDir = function (path) { browsePath(path); };

  window.openFile = function (filePath) {
    fetch('/api/files/read?path=' + encodeURIComponent(filePath))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Modal.open({
          title: d.path || filePath, size: 'xl',
          body: '<textarea id="file-editor" style="width:100%;height:50vh;background:#000;color:var(--text-secondary);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:monospace;font-size:12px;resize:vertical">' +
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
                Toast.success('File saved'); Modal.close(btn.closest('.modal-overlay'));
              })
              .catch(function () { Toast.error('Save failed'); });
          };
        }, 50);
      })
      .catch(function (e) { Toast.error(e.message); });
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
            Toast.success(label + ' created'); Modal.close(btn.closest('.modal-overlay')); browsePath(currentPath);
          })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.deleteFile = function (path) {
    Modal.confirm({ title: 'Delete', message: 'Delete "' + path + '"?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/api/files/delete?path=' + encodeURIComponent(path), { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) { Toast.error(d.error); return; }
          Toast.success('Deleted'); browsePath(currentPath);
        })
        .catch(function () { Toast.error('Failed'); });
    });
  };

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    var k = 1024; var s = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
  function escAttr(str) { return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
})();
