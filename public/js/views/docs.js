/**
 * Bulwark v2.1 — Docs / FAQ View
 * Renders getting-started.md as styled markdown
 */
(function () {
  'use strict';

  Views.docs = {
    init: function () {
      var c = document.getElementById('view-docs');
      if (!c) return;
      c.innerHTML =
        '<div class="docs-container">' +
          '<div class="docs-sidebar" id="docs-toc"></div>' +
          '<div class="docs-content" id="docs-body">' +
            '<div style="color:var(--text-tertiary);padding:40px">Loading documentation...</div>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      fetch('/api/docs/getting-started').then(function (r) { return r.json(); }).then(function (d) {
        var body = document.getElementById('docs-body');
        var toc = document.getElementById('docs-toc');
        if (!body || !d.content) return;

        // Fix image paths (docs are in docs/, images in media/)
        var content = d.content.replace(/\.\.\//g, '/');

        // Render markdown
        if (window.marked) {
          marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: true
          });
          body.innerHTML = '<div class="docs-rendered">' + marked.parse(content) + '</div>';
        } else {
          body.innerHTML = '<pre style="white-space:pre-wrap;color:var(--text-primary);font-size:13px">' + escapeHtml(d.content) + '</pre>';
        }

        // Build TOC from rendered headings
        if (toc) {
          var headings = body.querySelectorAll('h1, h2, h3');
          var tocHtml = '<div class="docs-toc-title">Contents</div>';
          for (var i = 0; i < headings.length; i++) {
            var h = headings[i];
            var level = parseInt(h.tagName.charAt(1));
            var id = h.id || h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            h.id = id;
            var indent = level === 1 ? 0 : level === 2 ? 12 : 24;
            var cls = level === 1 ? 'docs-toc-h1' : level === 2 ? 'docs-toc-h2' : 'docs-toc-h3';
            tocHtml += '<a class="docs-toc-link ' + cls + '" href="#' + id + '" style="padding-left:' + indent + 'px" onclick="Views.docs.scrollTo(\'' + id + '\');return false;">' + h.textContent + '</a>';
          }
          toc.innerHTML = tocHtml;
        }

        // Style images to fit
        var imgs = body.querySelectorAll('img');
        for (var j = 0; j < imgs.length; j++) {
          imgs[j].style.maxWidth = '100%';
          imgs[j].style.borderRadius = '8px';
          imgs[j].style.border = '1px solid var(--border)';
          imgs[j].style.marginTop = '8px';
          imgs[j].style.marginBottom = '8px';
        }

        // Style code blocks
        var codes = body.querySelectorAll('pre code, pre');
        for (var k = 0; k < codes.length; k++) {
          codes[k].style.background = 'rgba(0,0,0,0.3)';
          codes[k].style.borderRadius = '6px';
          codes[k].style.padding = '12px 16px';
          codes[k].style.fontSize = '12px';
          codes[k].style.overflowX = 'auto';
        }

        // Style tables
        var tables = body.querySelectorAll('table');
        for (var t = 0; t < tables.length; t++) {
          tables[t].classList.add('docs-table');
        }

      }).catch(function () {
        var body = document.getElementById('docs-body');
        if (body) body.innerHTML = '<div style="color:var(--orange);padding:40px">Failed to load documentation.</div>';
      });
    },

    scrollTo: function (id) {
      var el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    hide: function () {},
    update: function () {}
  };

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }
})();
