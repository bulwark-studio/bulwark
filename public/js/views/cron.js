/**
 * Chester Dev Monitor v2.0 — Cron Jobs View
 * Job table, create/edit/toggle/delete cron jobs
 */
(function () {
  'use strict';

  Views.cron = {
    init: function () {
      var container = document.getElementById('view-cron');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<span style="font-weight:600;color:var(--text-primary)">Cron Jobs</span>' +
            '<div style="display:flex;gap:8px">' +
              '<button class="btn btn-sm btn-cyan" onclick="createCronJob()">Add Job</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.cron.show()">Refresh</button>' +
            '</div>' +
          '</div>' +
          '<div id="cron-content">' +
            '<div style="color:var(--text-tertiary)">Loading cron jobs...</div>' +
          '</div>';
      }
    },
    show: function () { loadJobs(); },
    hide: function () {},
    update: function () {}
  };

  function loadJobs() {
    var el = document.getElementById('cron-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-tertiary)">Loading cron jobs...</div>';
    fetch('/adapter/cron/jobs')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.degraded) { el.innerHTML = degraded(d.error); return; }
        var jobs = Array.isArray(d) ? d : d.jobs || [];
        if (!jobs.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No cron jobs configured</div></div>'; return; }
        el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Schedule</th><th>Command</th><th>Status</th><th>Last Run</th><th>Next Run</th><th>Actions</th></tr></thead><tbody>' +
          jobs.map(function (j) {
            var enabled = j.enabled !== false;
            var statusColor = enabled ? 'var(--cyan)' : 'var(--text-tertiary)';
            return '<tr><td style="font-family:monospace;font-size:11px">' + esc(j.schedule || j.expression || '') + '</td>' +
              '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">' + esc(j.command || '') + '</td>' +
              '<td><span style="color:' + statusColor + '">' + (enabled ? 'Active' : 'Paused') + '</span></td>' +
              '<td style="color:var(--text-tertiary);font-size:11px">' + (j.lastRun ? new Date(j.lastRun).toLocaleString() : '--') + '</td>' +
              '<td style="color:var(--text-tertiary);font-size:11px">' + (j.nextRun ? new Date(j.nextRun).toLocaleString() : '--') + '</td>' +
              '<td><div style="display:flex;gap:4px">' +
                '<button class="btn btn-sm" onclick="toggleCron(\'' + esc(j.id) + '\')">' + (enabled ? 'Pause' : 'Resume') + '</button>' +
                '<button class="btn btn-sm btn-danger" onclick="deleteCron(\'' + esc(j.id) + '\')">Del</button>' +
              '</div></td></tr>';
          }).join('') + '</tbody></table></div>';
      })
      .catch(function (e) { el.innerHTML = degraded(e.message); });
  }

  window.createCronJob = function () {
    var mins = buildSelect('cron-min', 60, '*'); var hrs = buildSelect('cron-hr', 24, '*');
    var dom = buildSelect('cron-dom', 31, '*', 1); var mon = buildSelect('cron-mon', 12, '*', 1);
    var dow = buildSelect('cron-dow', 7, '*');
    Modal.open({
      title: 'Create Cron Job', size: 'lg',
      body: '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
        '<div class="form-group" style="flex:1;min-width:80px"><label class="form-label">Minute</label>' + mins + '</div>' +
        '<div class="form-group" style="flex:1;min-width:80px"><label class="form-label">Hour</label>' + hrs + '</div>' +
        '<div class="form-group" style="flex:1;min-width:80px"><label class="form-label">Day</label>' + dom + '</div>' +
        '<div class="form-group" style="flex:1;min-width:80px"><label class="form-label">Month</label>' + mon + '</div>' +
        '<div class="form-group" style="flex:1;min-width:80px"><label class="form-label">Weekday</label>' + dow + '</div></div>' +
        '<div style="margin-bottom:12px;font-family:monospace;font-size:12px;color:var(--cyan)" id="cron-preview">* * * * *</div>' +
        '<div class="form-group"><label class="form-label">Command</label><input id="cron-cmd" class="form-input" placeholder="/usr/bin/my-script.sh"></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button><button class="btn btn-sm btn-primary" id="cron-save">Create</button>'
    });
    setTimeout(function () {
      ['cron-min', 'cron-hr', 'cron-dom', 'cron-mon', 'cron-dow'].forEach(function (id) {
        var sel = document.getElementById(id);
        if (sel) sel.onchange = updateCronPreview;
      });
      var btn = document.getElementById('cron-save');
      if (btn) btn.onclick = function () {
        var schedule = getCronExpression();
        var command = (document.getElementById('cron-cmd') || {}).value;
        if (!command) { Toast.warning('Command required'); return; }
        fetch('/adapter/cron/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedule: schedule, command: command }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { Toast.error(d.error); return; }
            Toast.success('Job created'); Modal.close(btn.closest('.modal-overlay')); loadJobs();
          })
          .catch(function () { Toast.error('Failed'); });
      };
    }, 50);
  };

  function updateCronPreview() {
    var el = document.getElementById('cron-preview');
    if (el) el.textContent = getCronExpression();
  }

  function getCronExpression() {
    var parts = ['cron-min', 'cron-hr', 'cron-dom', 'cron-mon', 'cron-dow'].map(function (id) {
      return (document.getElementById(id) || {}).value || '*';
    });
    return parts.join(' ');
  }

  window.toggleCron = function (id) {
    fetch('/adapter/cron/jobs/' + encodeURIComponent(id) + '/toggle', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function () { Toast.success('Toggled'); loadJobs(); })
      .catch(function () { Toast.error('Failed'); });
  };

  window.deleteCron = function (id) {
    Modal.confirm({ title: 'Delete Cron Job', message: 'Delete this cron job?', dangerous: true, confirmText: 'Delete' }).then(function (ok) {
      if (!ok) return;
      fetch('/adapter/cron/jobs/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () { Toast.success('Deleted'); loadJobs(); })
        .catch(function () { Toast.error('Failed'); });
    });
  };

  function buildSelect(id, count, defaultVal, startFrom) {
    startFrom = startFrom || 0;
    var opts = '<option value="*">*</option>';
    for (var i = startFrom; i < count + (startFrom || 0); i++) {
      opts += '<option value="' + i + '">' + i + '</option>';
    }
    return '<select id="' + id + '" class="form-input">' + opts + '</select>';
  }

  function degraded(err) {
    return '<div class="card" style="text-align:center;padding:32px"><div style="color:var(--orange);font-weight:600;margin-bottom:4px">Adapter Not Connected</div>' +
      '<div style="color:var(--text-tertiary);font-size:11px">' + esc(err || 'Cron adapter unavailable') + '</div></div>';
  }

  function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str || '')); return d.innerHTML; }
})();
