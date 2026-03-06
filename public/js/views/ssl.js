// =============================================================================
// SSL & Domain Intelligence — Certificate Management + Domain Grid
// =============================================================================
(function () {
  'use strict';

  var certs = [];
  var vhosts = [];
  var refreshTimer = null;

  Views.ssl = {
    init: function () {
      var el = document.getElementById('view-ssl');
      if (!el) return;
      el.innerHTML = buildTemplate();
    },
    show: function () {
      this.init();
      loadData();
      refreshTimer = setInterval(loadData, 60000);
    },
    hide: function () {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    },
    update: function () {}
  };

  function buildTemplate() {
    return '<div class="ssl-dashboard">' +
      // AI Analysis
      '<div class="ssl-ai-section">' +
        '<div class="briefing-card glass-card">' +
          '<div class="briefing-header">' +
            '<div class="briefing-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" width="22" height="22"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/><circle cx="12" cy="16" r="1.5" fill="var(--cyan)"/></svg></div>' +
            '<div class="briefing-title">SSL Intelligence</div>' +
            '<button class="btn btn-sm btn-ghost" onclick="Views.ssl.runAI()" id="ssl-ai-btn">Analyze</button>' +
          '</div>' +
          '<div class="briefing-body" id="ssl-ai-body"><span class="text-secondary">Click Analyze for AI-powered SSL and domain security assessment.</span></div>' +
        '</div>' +
      '</div>' +
      // Certificate Cards
      '<div class="ssl-section-header"><span>Certificates</span><button class="btn btn-sm btn-primary" onclick="Views.ssl.issueCert()">Issue New</button></div>' +
      '<div class="ssl-cert-grid" id="ssl-cert-grid"></div>' +
      // Domain Grid
      '<div class="ssl-section-header"><span>Domains</span></div>' +
      '<div class="ssl-domain-grid" id="ssl-domain-grid"></div>' +
      // Vhosts
      '<div class="glass-card ssl-vhosts-card">' +
        '<div class="card-header"><span>Virtual Hosts</span><button class="btn btn-sm btn-ghost" onclick="Views.ssl.addVhost()">Add Vhost</button></div>' +
        '<div id="ssl-vhosts-table"></div>' +
      '</div>' +
      // Timeline
      '<div class="glass-card ssl-timeline-card"><div class="card-header">SSL Events</div><div id="ssl-timeline" class="ssl-timeline"></div></div>' +
    '</div>';
  }

  function loadData() {
    fetch('/adapter/ssl/certificates').then(function (r) { return r.json(); }).then(function (d) {
      if (d.degraded) { renderDegraded(); return; }
      certs = Array.isArray(d) ? d : (d.certificates || []);
      renderCerts();
      renderDomainGrid();
      renderTimeline();
    }).catch(function () { renderDegraded(); });

    fetch('/adapter/ssl/vhosts').then(function (r) { return r.json(); }).then(function (d) {
      if (d.degraded) return;
      vhosts = Array.isArray(d) ? d : (d.vhosts || []);
      renderVhosts();
    }).catch(function () {});
  }

  function renderDegraded() {
    var el = document.getElementById('ssl-cert-grid');
    if (el) el.innerHTML = '<div class="glass-card" style="text-align:center;padding:32px"><span style="color:var(--orange)">SSL adapter not connected</span><br><span class="text-tertiary" style="font-size:11px">Start the adapter service to manage certificates</span></div>';
  }

  function renderCerts() {
    var el = document.getElementById('ssl-cert-grid');
    if (!el) return;
    if (certs.length === 0) { el.innerHTML = '<div class="text-secondary" style="padding:20px">No certificates found</div>'; return; }

    el.innerHTML = certs.map(function (c) {
      var domain = c.domain || c.name || '--';
      var expiry = c.expiry ? new Date(c.expiry) : null;
      var daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
      var expired = daysLeft !== null && daysLeft <= 0;
      var expiring = daysLeft !== null && daysLeft <= 30;
      var color = expired ? 'var(--orange)' : expiring ? '#eab308' : 'var(--cyan)';

      return '<div class="ssl-cert-card glass-card">' +
        '<div class="ssl-cert-header">' +
          '<span class="dot ' + (expired ? 'dot-unhealthy' : 'dot-healthy') + '"></span>' +
          '<span class="ssl-cert-domain">' + esc(domain) + '</span>' +
        '</div>' +
        // Countdown ring
        (daysLeft !== null ? '<div class="ssl-countdown-ring">' + countdownRing(daysLeft, color) + '</div>' : '') +
        '<div class="ssl-cert-details">' +
          (c.issuer ? '<div><span class="text-tertiary">Issuer</span><span>' + esc(c.issuer) + '</span></div>' : '') +
          (expiry ? '<div><span class="text-tertiary">Expires</span><span style="color:' + color + '">' + expiry.toLocaleDateString() + '</span></div>' : '') +
          (c.protocol ? '<div><span class="text-tertiary">Protocol</span><span>' + esc(c.protocol) + '</span></div>' : '') +
          '<div><span class="text-tertiary">Auto-Renew</span><span style="color:' + (c.autoRenew ? 'var(--cyan)' : 'var(--text-tertiary)') + '">' + (c.autoRenew ? 'Enabled' : 'Disabled') + '</span></div>' +
        '</div>' +
        '<div class="ssl-cert-actions">' +
          '<button class="btn btn-sm" onclick="Views.ssl.renewCert(\'' + esc(domain) + '\')">Renew</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="Views.ssl.certDetails(\'' + esc(domain) + '\')">Details</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function countdownRing(daysLeft, color) {
    var maxDays = 90;
    var pct = Math.max(0, Math.min(100, (daysLeft / maxDays) * 100));
    var r = 28, circ = 2 * Math.PI * r, offset = circ - (circ * pct / 100);
    return '<svg viewBox="0 0 68 68" width="68" height="68">' +
      '<circle cx="34" cy="34" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5"/>' +
      '<circle cx="34" cy="34" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="5" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" transform="rotate(-90 34 34)" style="transition:stroke-dashoffset 0.6s"/>' +
      '<text x="34" y="31" text-anchor="middle" fill="var(--text-primary)" font-size="14" font-weight="700">' + Math.max(0, daysLeft) + '</text>' +
      '<text x="34" y="43" text-anchor="middle" fill="var(--text-secondary)" font-size="7">DAYS</text>' +
    '</svg>';
  }

  function renderDomainGrid() {
    var el = document.getElementById('ssl-domain-grid');
    if (!el) return;
    var domains = certs.map(function (c) { return c.domain || c.name; }).filter(Boolean);
    if (domains.length === 0) { el.innerHTML = ''; return; }

    el.innerHTML = '<div class="ssl-domains">' + domains.map(function (d) {
      var cert = certs.find(function (c) { return c.domain === d || c.name === d; });
      var expiry = cert && cert.expiry ? new Date(cert.expiry) : null;
      var daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
      var valid = daysLeft === null || daysLeft > 0;

      return '<div class="ssl-domain-card glass-card">' +
        '<div class="ssl-domain-name">' + esc(d) + '</div>' +
        '<div class="ssl-domain-checks">' +
          '<div class="ssl-check"><span class="dot ' + (valid ? 'dot-healthy' : 'dot-unhealthy') + '" style="width:6px;height:6px"></span> SSL ' + (valid ? 'Valid' : 'Expired') + '</div>' +
          '<div class="ssl-check"><span class="dot dot-healthy" style="width:6px;height:6px"></span> DNS Active</div>' +
          (daysLeft !== null ? '<div class="ssl-check-days" style="color:' + (daysLeft > 30 ? 'var(--text-secondary)' : daysLeft > 0 ? '#eab308' : 'var(--orange)') + '">' + daysLeft + 'd left</div>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderVhosts() {
    var el = document.getElementById('ssl-vhosts-table');
    if (!el) return;
    if (vhosts.length === 0) { el.innerHTML = '<div class="text-secondary" style="padding:12px">No virtual hosts</div>'; return; }
    el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Domain</th><th>Upstream</th><th>SSL</th><th></th></tr></thead><tbody>' +
      vhosts.map(function (v) {
        return '<tr><td>' + esc(v.domain || v.server_name || '--') + '</td>' +
          '<td class="text-tertiary">' + esc(v.upstream || v.proxy_pass || '--') + '</td>' +
          '<td><span class="dot ' + (v.ssl ? 'dot-healthy' : 'dot-unhealthy') + '" style="width:6px;height:6px"></span> ' + (v.ssl ? 'Active' : 'No') + '</td>' +
          '<td><button class="btn btn-sm btn-ghost" onclick="Views.ssl.deleteVhost(\'' + esc(v.domain || v.server_name) + '\')">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderTimeline() {
    var el = document.getElementById('ssl-timeline');
    if (!el) return;
    if (certs.length === 0) { el.innerHTML = '<span class="text-secondary">No SSL events</span>'; return; }
    el.innerHTML = certs.map(function (c) {
      var expiry = c.expiry ? new Date(c.expiry) : null;
      var daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
      var type = daysLeft !== null && daysLeft <= 0 ? 'expired' : daysLeft !== null && daysLeft <= 30 ? 'expiring' : 'valid';
      return '<div class="ssl-tl-event ssl-tl-' + type + '">' +
        '<span class="dot ' + (type === 'valid' ? 'dot-healthy' : 'dot-unhealthy') + '" style="width:6px;height:6px"></span>' +
        '<span>' + esc(c.domain || c.name) + ' — ' + (type === 'expired' ? 'EXPIRED' : type === 'expiring' ? daysLeft + 'd until expiry' : 'Valid') + '</span>' +
      '</div>';
    }).join('');
  }

  // ── Actions ──
  Views.ssl.renewCert = function (domain) {
    Toast.info('Renewing certificate for ' + domain + '...');
    fetch('/adapter/ssl/certificates/renew/' + encodeURIComponent(domain), { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Certificate renewed');
        setTimeout(loadData, 2000);
      }).catch(function () { Toast.error('Renewal failed'); });
  };

  Views.ssl.issueCert = function () {
    Modal.open({
      title: 'Issue SSL Certificate',
      size: 'md',
      body: '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<input type="text" id="ssl-issue-domain" class="input" placeholder="Domain (e.g. example.com)">' +
        '<input type="email" id="ssl-issue-email" class="input" placeholder="Email for Let\'s Encrypt">' +
        '<button class="btn btn-primary" onclick="Views.ssl.doIssue()">Issue Certificate</button></div>'
    });
  };

  Views.ssl.doIssue = function () {
    var domain = document.getElementById('ssl-issue-domain');
    var email = document.getElementById('ssl-issue-email');
    if (!domain || !domain.value.trim()) return;
    Toast.info('Issuing certificate...');
    fetch('/adapter/ssl/certificates/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain.value.trim(), email: email ? email.value.trim() : '' }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { Toast.error(d.error); return; }
      Toast.success('Certificate issued');
      Modal.close();
      setTimeout(loadData, 2000);
    }).catch(function () { Toast.error('Issue failed'); });
  };

  Views.ssl.certDetails = function (domain) {
    var cert = certs.find(function (c) { return c.domain === domain || c.name === domain; });
    if (!cert) return;
    Modal.open({
      title: 'Certificate: ' + domain,
      size: 'lg',
      body: '<div class="ssl-detail-grid">' +
        detailRow('Domain', cert.domain || cert.name) +
        detailRow('Issuer', cert.issuer || 'Unknown') +
        detailRow('Expires', cert.expiry ? new Date(cert.expiry).toLocaleString() : '--') +
        detailRow('Protocol', cert.protocol || '--') +
        detailRow('Subject', cert.subject || '--') +
        detailRow('Serial', cert.serial || '--') +
        detailRow('Fingerprint', cert.fingerprint || '--') +
        detailRow('SANs', (cert.sans || []).join(', ') || '--') +
        detailRow('Auto-Renew', cert.autoRenew ? 'Enabled' : 'Disabled') +
      '</div>'
    });
  };

  function detailRow(label, value) {
    return '<div class="ssl-detail-row"><span class="text-tertiary">' + label + '</span><span style="word-break:break-all">' + esc(value || '--') + '</span></div>';
  }

  Views.ssl.addVhost = function () {
    Modal.open({
      title: 'Add Virtual Host',
      size: 'md',
      body: '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<input type="text" id="ssl-vhost-domain" class="input" placeholder="Domain">' +
        '<input type="text" id="ssl-vhost-upstream" class="input" placeholder="Upstream (e.g. http://localhost:3000)">' +
        '<button class="btn btn-primary" onclick="Views.ssl.doAddVhost()">Create</button></div>'
    });
  };

  Views.ssl.doAddVhost = function () {
    var domain = document.getElementById('ssl-vhost-domain');
    var upstream = document.getElementById('ssl-vhost-upstream');
    if (!domain || !domain.value.trim()) return;
    fetch('/adapter/ssl/vhosts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain.value.trim(), upstream: upstream ? upstream.value.trim() : '' }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { Toast.error(d.error); return; }
      Toast.success('Vhost created');
      Modal.close();
      setTimeout(loadData, 1000);
    }).catch(function () { Toast.error('Failed'); });
  };

  Views.ssl.deleteVhost = function (domain) {
    if (!confirm('Delete vhost ' + domain + '?')) return;
    fetch('/adapter/ssl/vhosts/' + encodeURIComponent(domain), { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { Toast.error(d.error); return; }
        Toast.success('Vhost deleted');
        setTimeout(loadData, 1000);
      }).catch(function () { Toast.error('Failed'); });
  };

  Views.ssl.runAI = function () {
    var btn = document.getElementById('ssl-ai-btn');
    var body = document.getElementById('ssl-ai-body');
    if (!btn || !body) return;
    btn.disabled = true; btn.textContent = 'Analyzing...';
    body.innerHTML = '<span class="text-secondary">Analyzing SSL certificates...</span>';
    fetch('/api/briefing').then(function (r) { return r.json(); }).then(function (d) {
      btn.disabled = false; btn.textContent = 'Analyze';
      if (d.briefing) { typewriter(body, d.briefing); } else if (d.fallback) { typewriter(body, d.fallback); }
      else { body.innerHTML = '<span class="text-secondary">Analysis unavailable</span>'; }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Analyze'; });
  };

  function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s || '')) : String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function typewriter(el, text) { el.innerHTML = ''; var span = document.createElement('span'); span.className = 'typewriter-text'; el.appendChild(span); var i = 0; (function tick() { if (i < text.length) { span.textContent += text[i++]; setTimeout(tick, 8 + Math.random() * 12); } })(); }
})();
