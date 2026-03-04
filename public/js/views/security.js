/**
 * Chester Dev Monitor v2.0 — Security View
 * Tabbed: Malware Scan, File Integrity, Firewall, Fail2Ban, SSH Keys, Alerts
 */
(function () {
  'use strict';

  var activeTab = 'scan';
  var TABS = [
    { key: 'scan', label: 'Malware Scan' },
    { key: 'integrity', label: 'File Integrity' },
    { key: 'firewall', label: 'Firewall' },
    { key: 'fail2ban', label: 'Fail2Ban' },
    { key: 'ssh', label: 'SSH Keys' },
    { key: 'alerts', label: 'Alerts' }
  ];

  Views.security = {
    init: function () {
      var container = document.getElementById('view-security');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div>' +
              '<h3 style="margin:0;color:var(--text-primary);font-size:16px;font-weight:600">Security Center</h3>' +
              '<p style="margin:4px 0 0;color:var(--text-tertiary);font-size:12px">Malware scanning, firewall, intrusion detection & SSH key management</p>' +
            '</div>' +
          '</div>' +
          '<div id="sec-tabs" style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap"></div>' +
          '<div id="sec-content"></div>';
      }
    },
    show: function () { render(); },
    hide: function () {},
    update: function () {}
  };

  function render() {
    var tabsEl = document.getElementById('sec-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = TABS.map(function (t) {
        return '<button class="btn btn-sm ' + (t.key === activeTab ? 'btn-primary' : '') + '" onclick="secTab(\'' + t.key + '\')">' + t.label + '</button>';
      }).join('');
    }
    var el = document.getElementById('sec-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading...</div>';
    if (activeTab === 'scan') loadScan(el);
    else if (activeTab === 'integrity') loadIntegrity(el);
    else if (activeTab === 'firewall') loadFirewall(el);
    else if (activeTab === 'fail2ban') loadFail2ban(el);
    else if (activeTab === 'ssh') loadSSH(el);
    else if (activeTab === 'alerts') loadAlerts(el);
  }

  window.secTab = function (tab) { activeTab = tab; render(); };

  function loadScan(el) {
    fetch('/adapter/security/scan').then(function (r) { return r.json(); }).then(function (d) {
      if (d.degraded) { el.innerHTML = degraded(d.error); return; }
      el.innerHTML = '<div class="card" style="margin-bottom:12px"><div class="card-title">Last Scan</div><pre style="margin-top:8px;font-size:11px;color:var(--text-secondary);white-space:pre-wrap">' + esc(JSON.stringify(d, null, 2)) + '</pre></div>' +
        '<button class="btn btn-primary" onclick="runScan()">Scan Now</button>';
    }).catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  window.runScan = function () {
    var overlay = Modal.open({ title: 'Malware Scan', body: '<div style="text-align:center;padding:20px"><div class="spinner spinner-lg"></div><div style="margin-top:12px;color:var(--text-tertiary)">Scanning...</div></div>' });
    fetch('/adapter/security/scan', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
      var body = overlay.querySelector('.modal-body');
      if (body) body.innerHTML = '<pre style="font-size:11px;white-space:pre-wrap;color:var(--text-secondary)">' + esc(JSON.stringify(d, null, 2)) + '</pre>';
    }).catch(function (e) { var b = overlay.querySelector('.modal-body'); if (b) b.innerHTML = '<div style="color:var(--orange)">' + esc(e.message) + '</div>'; });
  };

  function loadIntegrity(el) {
    fetch('/adapter/security/integrity').then(function (r) { return r.json(); }).then(function (d) {
      if (d.degraded) { el.innerHTML = degraded(d.error); return; }
      el.innerHTML = '<div class="card"><pre style="font-size:11px;white-space:pre-wrap;color:var(--text-secondary)">' + esc(JSON.stringify(d, null, 2)) + '</pre></div>';
    }).catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  function loadFirewall(el) {
    fetch('/adapter/security/firewall/rules').then(function (r) { return r.json(); }).then(function (d) {
      if (d.degraded) { el.innerHTML = degraded(d.error); return; }
      var rules = Array.isArray(d) ? d : d.rules || [];
      el.innerHTML = '<button class="btn btn-sm btn-primary" style="margin-bottom:12px" onclick="addFirewallRule()">Add Rule</button>' +
        '<div class="table-wrap"><table><thead><tr><th>Port</th><th>Protocol</th><th>Action</th><th>From</th><th>Delete</th></tr></thead><tbody>' +
        rules.map(function (r) {
          return '<tr><td>' + esc(r.port || '') + '</td><td>' + esc(r.protocol || 'tcp') + '</td><td>' + esc(r.action || 'allow') + '</td><td>' + esc(r.from || 'any') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteFirewallRule(\'' + esc(r.id || r.port) + '\')">Del</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  window.addFirewallRule = function () {
    Modal.open({
      title: 'Add Firewall Rule', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Port</label><input id="fw-port" class="form-input" placeholder="443"></div>' +
        '<div class="form-group"><label class="form-label">Protocol</label><select id="fw-proto" class="form-input"><option>tcp</option><option>udp</option></select></div>' +
        '<div class="form-group"><label class="form-label">Action</label><select id="fw-action" class="form-input"><option>allow</option><option>deny</option></select></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="fw-save">Save</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('fw-save');
      if (btn) btn.onclick = function () {
        var port = (document.getElementById('fw-port') || {}).value;
        var protocol = (document.getElementById('fw-proto') || {}).value;
        var action = (document.getElementById('fw-action') || {}).value;
        fetch('/adapter/security/firewall/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ port: port, protocol: protocol, action: action }) })
          .then(function () { Toast.success('Rule added'); Modal.close(btn.closest('.modal-overlay')); render(); })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.deleteFirewallRule = function (id) {
    Modal.confirm({ title: 'Delete Rule', message: 'Delete this firewall rule?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/adapter/security/firewall/rules/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () { Toast.success('Rule deleted'); render(); }).catch(function () { Toast.error('Failed'); });
    });
  };

  function loadFail2ban(el) {
    fetch('/adapter/security/fail2ban/status').then(function (r) { return r.json(); }).then(function (d) {
      if (d.degraded) { el.innerHTML = degraded(d.error); return; }
      el.innerHTML = '<div class="card"><pre style="font-size:11px;white-space:pre-wrap;color:var(--text-secondary)">' + esc(JSON.stringify(d, null, 2)) + '</pre></div>';
    }).catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  function loadSSH(el) {
    fetch('/adapter/security/ssh-keys').then(function (r) { return r.json(); }).then(function (d) {
      if (d.degraded) { el.innerHTML = degraded(d.error); return; }
      var keys = Array.isArray(d) ? d : d.keys || [];
      el.innerHTML = '<button class="btn btn-sm btn-primary" style="margin-bottom:12px" onclick="addSSHKey()">Add Key</button>' +
        '<div class="table-wrap"><table><thead><tr><th>Fingerprint</th><th>Comment</th><th>Delete</th></tr></thead><tbody>' +
        keys.map(function (k) {
          return '<tr><td style="font-family:monospace;font-size:10px">' + esc(k.fingerprint || k.fp || '') + '</td><td>' + esc(k.comment || '') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteSSHKey(\'' + esc(k.fingerprint || k.fp || '') + '\')">Del</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  window.addSSHKey = function () {
    Modal.open({
      title: 'Add SSH Key', size: 'lg',
      body: '<div class="form-group"><label class="form-label">Public Key</label><textarea id="ssh-key-input" class="form-input" rows="4" placeholder="ssh-rsa AAAA..."></textarea></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="ssh-save">Add</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('ssh-save');
      if (btn) btn.onclick = function () {
        var key = (document.getElementById('ssh-key-input') || {}).value;
        fetch('/adapter/security/ssh-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) })
          .then(function () { Toast.success('Key added'); Modal.close(btn.closest('.modal-overlay')); render(); })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  window.deleteSSHKey = function (fp) {
    fetch('/adapter/security/ssh-keys/' + encodeURIComponent(fp), { method: 'DELETE' })
      .then(function () { Toast.success('Key removed'); render(); }).catch(function () { Toast.error('Failed'); });
  };

  function loadAlerts(el) {
    fetch('/adapter/security/alerts').then(function (r) { return r.json(); }).then(function (d) {
      if (d.degraded) { el.innerHTML = degraded(d.error); return; }
      var alerts = Array.isArray(d) ? d : d.alerts || [];
      if (!alerts.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No security alerts</div></div>'; return; }
      el.innerHTML = alerts.map(function (a) {
        return '<div class="card" style="margin-bottom:8px"><strong>' + esc(a.title || a.type || '') + '</strong><div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">' + esc(a.message || '') + '</div></div>';
      }).join('');
    }).catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  function degraded(err) {
    return '<div class="card" style="text-align:center;padding:32px"><div style="color:var(--orange);font-weight:600;margin-bottom:4px">Adapter Not Connected</div>' +
      '<div style="color:var(--text-tertiary);font-size:11px">' + esc(err || 'Security adapter unavailable') + '</div></div>';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
