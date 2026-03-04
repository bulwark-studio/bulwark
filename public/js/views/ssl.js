/**
 * Chester Dev Monitor v2.0 — SSL/Domain View
 * Certificate cards, vhost table, issue/renew certificates
 */
(function () {
  'use strict';

  Views.ssl = {
    init: function () {
      var el = document.getElementById('view-ssl');
      if (!el) return;
      el.innerHTML =
        '<div class="section-header">' +
          '<div class="section-title">SSL / Domains</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-sm btn-primary" onclick="issueCert()">Issue Certificate</button>' +
          '</div>' +
        '</div>' +
        '<div id="ssl-certs">' +
          '<div class="empty-state"><div class="empty-state-text">Loading certificates...</div></div>' +
        '</div>' +
        '<div id="ssl-vhosts"></div>';
    },
    show: function () { loadCerts(); loadVhosts(); },
    hide: function () {},
    update: function () {}
  };

  function loadCerts() {
    var el = document.getElementById('ssl-certs');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading certificates...</div>';
    fetch('/adapter/ssl/certificates')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded) { el.innerHTML = degraded(d.error); return; }
        var certs = Array.isArray(d) ? d : d.certificates || [];
        if (!certs.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No certificates found</div></div>'; return; }
        el.innerHTML = '<div class="card-grid">' + certs.map(function (c) {
          var domain = c.domain || c.name || '--';
          var expiry = c.expiry || c.expires || c.notAfter;
          var daysLeft = expiry ? Math.ceil((new Date(expiry) - new Date()) / 86400000) : -1;
          var expiryColor = daysLeft > 30 ? 'var(--cyan)' : 'var(--orange)';
          var autoRenew = c.autoRenew !== false ? 'Yes' : 'No';
          return '<div class="card"><div style="font-weight:600;margin-bottom:6px">' + esc(domain) + '</div>' +
            '<div style="font-size:11px;color:var(--text-tertiary)">Expires: <span style="color:' + expiryColor + '">' + (expiry ? new Date(expiry).toLocaleDateString() : '--') + ' (' + daysLeft + 'd)</span></div>' +
            '<div style="font-size:11px;color:var(--text-tertiary)">Auto-renew: ' + autoRenew + '</div>' +
            '<button class="btn btn-sm" style="margin-top:8px" onclick="renewCert(\'' + esc(domain) + '\')">Renew</button></div>';
        }).join('') + '</div>';
      })
      .catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  function loadVhosts() {
    var el = document.getElementById('ssl-vhosts');
    if (!el) return;
    fetch('/adapter/ssl/vhosts')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded) { el.innerHTML = ''; return; }
        var vhosts = Array.isArray(d) ? d : d.vhosts || [];
        if (!vhosts.length) { el.innerHTML = ''; return; }
        el.innerHTML = '<div class="section-title" style="margin-top:20px">Virtual Hosts</div>' +
          '<button class="btn btn-sm btn-primary" style="margin-bottom:12px" onclick="createVhost()">Create Vhost</button>' +
          '<div class="table-wrap"><table><thead><tr><th>Domain</th><th>Upstream</th><th>SSL</th><th>Actions</th></tr></thead><tbody>' +
          vhosts.map(function (v) {
            return '<tr><td>' + esc(v.domain || '') + '</td><td>' + esc(v.upstream || v.proxy_pass || '') + '</td>' +
              '<td>' + (v.ssl ? '<span style="color:var(--cyan)">Active</span>' : '<span style="color:var(--text-tertiary)">No</span>') + '</td>' +
              '<td><button class="btn btn-sm btn-danger" onclick="deleteVhost(\'' + esc(v.domain) + '\')">Delete</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function () { el.innerHTML = ''; });
  }

  window.issueCert = function () {
    Modal.open({
      title: 'Issue Certificate', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Domain</label><input id="issue-domain" class="form-input" placeholder="example.com"></div>' +
        '<div class="form-group"><label class="form-label">Email</label><input id="issue-email" class="form-input" placeholder="admin@example.com"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="issue-btn">Issue</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('issue-btn');
      if (btn) btn.onclick = function () {
        var domain = (document.getElementById('issue-domain') || {}).value;
        var email = (document.getElementById('issue-email') || {}).value;
        if (!domain) { Toast.warning('Domain required'); return; }
        Modal.showLoading(btn.closest('.modal-overlay'), 'Issuing certificate...');
        fetch('/adapter/ssl/certificates/issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: domain, email: email }) })
          .then(function (r) { return r.json(); })
          .then(function (d) { Toast.success(d.error ? d.error : 'Certificate issued'); Modal.close(btn.closest('.modal-overlay')); loadCerts(); })
          .catch(function () { Toast.error('Failed to issue certificate'); });
      };
    }, 50);
  };

  window.renewCert = function (domain) {
    Toast.info('Renewing ' + domain + '...');
    fetch('/adapter/ssl/certificates/renew/' + encodeURIComponent(domain), { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function () { Toast.success('Certificate renewed'); loadCerts(); })
      .catch(function () { Toast.error('Renewal failed'); });
  };

  window.createVhost = function () {
    Modal.open({
      title: 'Create Virtual Host', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Domain</label><input id="vh-domain" class="form-input" placeholder="app.example.com"></div>' +
        '<div class="form-group"><label class="form-label">Upstream</label><input id="vh-upstream" class="form-input" placeholder="http://localhost:3000"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="vh-save">Create</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('vh-save');
      if (btn) btn.onclick = function () {
        var domain = (document.getElementById('vh-domain') || {}).value;
        var upstream = (document.getElementById('vh-upstream') || {}).value;
        fetch('/adapter/ssl/vhosts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: domain, upstream: upstream }) })
          .then(function () { Toast.success('Vhost created'); Modal.close(btn.closest('.modal-overlay')); loadVhosts(); })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.deleteVhost = function (domain) {
    Modal.confirm({ title: 'Delete Vhost', message: 'Delete virtual host for ' + domain + '?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/adapter/ssl/vhosts/' + encodeURIComponent(domain), { method: 'DELETE' })
        .then(function () { Toast.success('Vhost deleted'); loadVhosts(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  function degraded(err) {
    return '<div class="card" style="text-align:center;padding:32px"><div style="color:var(--orange);font-weight:600;margin-bottom:4px">Adapter Not Connected</div>' +
      '<div style="color:var(--text-tertiary);font-size:11px">' + esc(err || 'SSL adapter unavailable') + '</div></div>';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
