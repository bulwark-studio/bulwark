/**
 * Bulwark v2.1 — Tickets View (Kanban Board + AI Triage)
 * 7-column drag-drop kanban: Pending, Analyzing, Fixing, Testing, Awaiting Approval, Approved, Deployed
 */
(function () {
  'use strict';

  var COLUMNS = [
    { key: 'pending', label: 'Pending', color: 'var(--text-tertiary)' },
    { key: 'analyzing', label: 'Analyzing', color: 'var(--blue)' },
    { key: 'fixing', label: 'Fixing', color: 'var(--cyan)' },
    { key: 'testing', label: 'Testing', color: 'var(--yellow)' },
    { key: 'awaiting_approval', label: 'Awaiting Approval', color: 'var(--purple)' },
    { key: 'approved', label: 'Approved', color: 'var(--cyan)' },
    { key: 'deployed', label: 'Deployed', color: 'var(--cyan)' }
  ];

  var dragTicketId = null;

  Views.tickets = {
    init: function () {
      var container = document.getElementById('view-tickets');
      if (container) {
        container.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div style="display:flex;align-items:center;gap:12px">' +
              '<span style="font-weight:600;color:var(--text-primary)">Kanban Board</span>' +
              '<span class="badge" id="ticket-total-count" style="color:var(--text-tertiary)">0 tickets</span>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.tickets.aiTriage()" id="ticket-ai-triage-btn">AI Triage</button>' +
              '<button class="btn btn-sm btn-primary" onclick="Views.tickets.openCreateModal()">+ New Ticket</button>' +
              '<button class="btn btn-sm btn-ghost" onclick="Views.tickets.show()">Refresh</button>' +
            '</div>' +
          '</div>' +
          '<div id="ticket-ai-banner" style="display:none"></div>' +
          '<div id="ticket-status-bar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap"></div>' +
          '<div id="ticket-kanban" class="kanban-board"></div>';
      }
    },

    show: function () {
      fetch('/api/tickets').then(safeJson).then(function (d) {
        var tickets = d.tickets || [];
        state.tickets = tickets;
        state.ticketSummary = d.summary || [];
        renderStatusBar(d.summary || [], tickets.length);
        renderKanban(tickets);
      }).catch(function () {
        renderStatusBar([], 0);
        renderKanban([]);
      });
    },

    hide: function () {},

    update: function (data) {
      if (data && data.tickets) {
        var tickets = Array.isArray(data.tickets) ? data.tickets : (data.tickets.tickets || []);
        var summary = data.summary || [];
        renderStatusBar(summary, tickets.length);
        renderKanban(tickets);
      }
    },

    openCreateModal: function () {
      Modal.open({
        title: 'New Ticket',
        body:
          '<div class="form-group"><label class="form-label">Subject</label>' +
          '<input type="text" id="new-ticket-subject" class="form-input" placeholder="Brief summary of the issue"></div>' +
          '<div class="form-group"><label class="form-label">Description</label>' +
          '<textarea id="new-ticket-desc" class="form-input" rows="4" placeholder="Detailed description..."></textarea></div>' +
          '<div style="display:flex;gap:12px">' +
            '<div class="form-group" style="flex:1"><label class="form-label">Type</label>' +
            '<select id="new-ticket-type" class="form-input"><option value="bug">Bug</option><option value="feature">Feature</option><option value="task">Task</option><option value="improvement">Improvement</option></select></div>' +
            '<div class="form-group" style="flex:1"><label class="form-label">Priority</label>' +
            '<select id="new-ticket-priority" class="form-input"><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">Environment</label>' +
          '<select id="new-ticket-env" class="form-input"><option value="dev">Dev</option><option value="staging">Staging</option><option value="production">Production</option></select></div>',
        footer:
          '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
          '<button class="btn btn-sm btn-primary" id="create-ticket-btn">Create Ticket</button>',
        size: 'md'
      });
      setTimeout(function () {
        var btn = document.getElementById('create-ticket-btn');
        if (btn) btn.onclick = function () { createTicket(btn); };
      }, 50);
    },

    aiTriage: function () {
      var btn = document.getElementById('ticket-ai-triage-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Triaging...'; }
      var banner = document.getElementById('ticket-ai-banner');
      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = '<div class="card" style="margin-bottom:16px;padding:16px;border-left:3px solid var(--cyan)">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
          '<span style="color:var(--cyan);font-weight:600">AI Triage</span>' +
          '<span class="badge" style="background:rgba(34,211,238,0.1);color:var(--cyan)">analyzing...</span></div>' +
          '<div style="color:var(--text-secondary)">Claude is analyzing pending tickets...</div></div>';
      }
      fetch('/api/tickets/ai/triage', { method: 'POST' })
        .then(safeJson)
        .then(function (d) {
          if (btn) { btn.disabled = false; btn.textContent = 'AI Triage'; }
          renderTriageResults(d);
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'AI Triage'; }
          if (banner) {
            banner.innerHTML = '<div class="card" style="margin-bottom:16px;padding:16px;border-left:3px solid var(--orange)">' +
              '<span style="color:var(--orange)">AI triage failed. Check that Claude CLI is authenticated.</span></div>';
          }
        });
    }
  };

  function createTicket(btn) {
    var subject = (document.getElementById('new-ticket-subject') || {}).value || '';
    var desc = (document.getElementById('new-ticket-desc') || {}).value || '';
    var type = (document.getElementById('new-ticket-type') || {}).value || 'task';
    var priority = (document.getElementById('new-ticket-priority') || {}).value || 'normal';
    var env = (document.getElementById('new-ticket-env') || {}).value || 'dev';
    if (!subject.trim() || !desc.trim()) { Toast.error('Subject and description required'); return; }
    btn.disabled = true;
    btn.textContent = 'Creating...';
    fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject, issue_type: type, issue_description: desc, priority: priority, target_env: env })
    }).then(safeJson).then(function (d) {
      if (d.error) { Toast.error(d.error); btn.disabled = false; btn.textContent = 'Create Ticket'; return; }
      Toast.success('Ticket created');
      Modal.close(btn.closest('.modal-overlay'));
      Views.tickets.show();
    }).catch(function () {
      Toast.error('Failed to create ticket');
      btn.disabled = false;
      btn.textContent = 'Create Ticket';
    });
  }

  function renderTriageResults(data) {
    var banner = document.getElementById('ticket-ai-banner');
    if (!banner) return;
    var results = data.results || [];
    if (!results.length) {
      banner.innerHTML = '<div class="card" style="margin-bottom:16px;padding:16px;border-left:3px solid var(--cyan)">' +
        '<span style="color:var(--cyan)">' + escapeHtml(data.message || 'No pending tickets to triage') + '</span></div>';
      return;
    }
    var html = '<div class="card" style="margin-bottom:16px;padding:16px;border-left:3px solid var(--cyan)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<span style="color:var(--cyan);font-weight:600">AI Triage Results</span>' +
      '<button class="btn btn-sm btn-ghost" onclick="document.getElementById(\'ticket-ai-banner\').style.display=\'none\'">Dismiss</button></div>' +
      '<table style="width:100%;font-size:12px"><thead><tr>' +
      '<th style="text-align:left;padding:4px 8px;color:var(--text-secondary)">Ticket</th>' +
      '<th style="text-align:left;padding:4px 8px;color:var(--text-secondary)">Category</th>' +
      '<th style="text-align:left;padding:4px 8px;color:var(--text-secondary)">Priority</th>' +
      '<th style="text-align:left;padding:4px 8px;color:var(--text-secondary)">Status</th>' +
      '<th style="text-align:left;padding:4px 8px;color:var(--text-secondary)">Summary</th>' +
      '</tr></thead><tbody>';
    results.forEach(function (r) {
      var prioColor = r.recommended_priority === 'critical' ? 'var(--orange)' :
        r.recommended_priority === 'high' ? 'var(--yellow)' : 'var(--text-secondary)';
      html += '<tr>' +
        '<td style="padding:4px 8px;color:var(--text-primary)">' + escapeHtml(r.subject || '') + '</td>' +
        '<td style="padding:4px 8px"><span class="badge" style="font-size:10px">' + escapeHtml(r.category || '') + '</span></td>' +
        '<td style="padding:4px 8px;color:' + prioColor + '">' + escapeHtml(r.recommended_priority || '') + '</td>' +
        '<td style="padding:4px 8px;color:var(--cyan)">' + escapeHtml(r.recommended_status || '') + '</td>' +
        '<td style="padding:4px 8px;color:var(--text-secondary)">' + escapeHtml(r.summary || '') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    banner.innerHTML = html;
  }

  function renderStatusBar(summary, totalCount) {
    var bar = document.getElementById('ticket-status-bar');
    var totalEl = document.getElementById('ticket-total-count');
    if (totalEl) totalEl.textContent = (totalCount || 0) + ' ticket' + (totalCount !== 1 ? 's' : '');
    if (!bar) return;

    var countMap = {};
    (summary || []).forEach(function (s) { countMap[s.fix_status] = s.count; });

    var html = '';
    COLUMNS.forEach(function (col) {
      var count = countMap[col.key] || 0;
      html += '<span class="badge" style="background:rgba(255,255,255,0.04);color:' + col.color + ';border:1px solid rgba(255,255,255,0.06)">' +
        '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + col.color + ';margin-right:4px"></span>' +
        col.label + ' <strong>' + count + '</strong></span>';
    });
    bar.innerHTML = html;
  }

  function renderKanban(tickets) {
    var el = document.getElementById('ticket-kanban');
    if (!el) return;
    var grouped = {};
    COLUMNS.forEach(function (c) { grouped[c.key] = []; });
    (tickets || []).forEach(function (t) {
      var s = t.fix_status || 'pending';
      if (grouped[s]) grouped[s].push(t);
      else grouped.pending.push(t);
    });

    el.innerHTML = '';
    el.className = 'kanban-board';
    COLUMNS.forEach(function (col) {
      var colEl = document.createElement('div');
      colEl.className = 'kanban-col';
      colEl.dataset.status = col.key;
      colEl.innerHTML = '<div class="kanban-col-header">' +
        '<span class="kanban-col-title"><span class="kanban-col-dot" style="background:' + col.color + '"></span>' +
        col.label + '</span>' +
        '<span class="kanban-col-count">' + grouped[col.key].length + '</span></div>';
      var body = document.createElement('div');
      body.className = 'kanban-col-body';
      grouped[col.key].forEach(function (t) {
        body.appendChild(createCard(t, col.key));
      });
      colEl.appendChild(body);
      // Drop events
      colEl.addEventListener('dragover', function (e) { e.preventDefault(); colEl.classList.add('drag-over'); });
      colEl.addEventListener('dragleave', function () { colEl.classList.remove('drag-over'); });
      colEl.addEventListener('drop', function (e) {
        e.preventDefault(); colEl.classList.remove('drag-over');
        if (dragTicketId) moveTicket(dragTicketId, col.key);
      });
      el.appendChild(colEl);
    });
  }

  function createCard(ticket, colKey) {
    var card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.id = ticket.id;
    var prioClass = ticket.priority === 'critical' ? 'priority-critical' :
      ticket.priority === 'high' ? 'priority-high' :
      ticket.priority === 'medium' ? 'priority-medium' : 'priority-low';
    card.innerHTML = '<div class="kanban-card-title">' + escapeHtml(ticket.subject || 'Untitled') + '</div>' +
      '<div class="kanban-card-meta">' +
        '<span class="priority-badge ' + prioClass + '">' + escapeHtml(ticket.priority || 'low') + '</span>' +
        (ticket.issue_type ? ' <span class="badge" style="font-size:9px;color:var(--text-tertiary)">' + escapeHtml(ticket.issue_type) + '</span>' : '') +
        (ticket.fix_branch ? ' <span style="color:var(--cyan);font-size:10px">' + escapeHtml(ticket.fix_branch) + '</span>' : '') +
      '</div>' +
      '<div class="kanban-card-description">' + escapeHtml((ticket.issue_description || '').substring(0, 120)) + '</div>';

    var actions = document.createElement('div');
    actions.className = 'kanban-card-actions';
    actions.style.cssText = 'display:flex;gap:4px;margin-top:8px;align-items:center';

    // AI Analyze button
    var aiBtn = document.createElement('button');
    aiBtn.className = 'btn btn-sm btn-ghost';
    aiBtn.style.cssText = 'font-size:10px;color:var(--cyan)';
    aiBtn.textContent = 'AI';
    aiBtn.title = 'AI Analyze';
    aiBtn.onclick = function (e) { e.stopPropagation(); analyzeTicket(ticket); };
    actions.appendChild(aiBtn);

    if (colKey === 'awaiting_approval') {
      var approveBtn = document.createElement('button');
      approveBtn.className = 'btn btn-sm btn-primary';
      approveBtn.textContent = 'Approve';
      approveBtn.onclick = function (e) { e.stopPropagation(); approveTicket(ticket.id); };
      actions.appendChild(approveBtn);
      var rejectBtn = document.createElement('button');
      rejectBtn.className = 'btn btn-sm btn-danger';
      rejectBtn.textContent = 'Reject';
      rejectBtn.onclick = function (e) { e.stopPropagation(); rejectTicket(ticket.id); };
      actions.appendChild(rejectBtn);
    }

    var viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-ghost';
    viewBtn.style.cssText = 'margin-left:auto;font-size:10px;color:var(--text-secondary)';
    viewBtn.textContent = 'View';
    viewBtn.onclick = function (e) { e.stopPropagation(); openTicketDetail(ticket); };
    actions.appendChild(viewBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-ghost';
    delBtn.style.cssText = 'color:var(--text-tertiary);font-size:10px';
    delBtn.textContent = 'Del';
    delBtn.onclick = function (e) { e.stopPropagation(); deleteTicket(ticket.id); };
    actions.appendChild(delBtn);
    card.appendChild(actions);

    card.addEventListener('click', function () { openTicketDetail(ticket); });
    card.addEventListener('dragstart', function (e) { dragTicketId = ticket.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragend', function () { card.classList.remove('dragging'); dragTicketId = null; });
    return card;
  }

  function openTicketDetail(ticket) {
    var created = ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'Unknown';
    var updated = ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : 'Unknown';
    var prioColor = ticket.priority === 'critical' ? 'var(--orange)' :
      ticket.priority === 'high' ? 'var(--yellow)' : 'var(--cyan)';

    var body =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Status</span><br>' +
        '<span class="badge" style="background:rgba(34,211,238,0.1);color:var(--cyan)">' + escapeHtml(ticket.fix_status || 'pending') + '</span></div>' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Priority</span><br>' +
        '<span style="color:' + prioColor + ';font-weight:600">' + escapeHtml(ticket.priority || 'normal') + '</span></div>' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Type</span><br>' +
        '<span style="color:var(--text-primary)">' + escapeHtml(ticket.issue_type || 'task') + '</span></div>' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Environment</span><br>' +
        '<span style="color:var(--text-primary)">' + escapeHtml(ticket.target_env || 'dev') + '</span></div>' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Created</span><br>' +
        '<span style="color:var(--text-primary);font-size:12px">' + escapeHtml(created) + '</span></div>' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Updated</span><br>' +
        '<span style="color:var(--text-primary);font-size:12px">' + escapeHtml(updated) + '</span></div>' +
      '</div>' +
      (ticket.fix_branch ? '<div style="margin-bottom:12px"><span style="color:var(--text-secondary);font-size:11px">Branch</span><br><code style="color:var(--cyan)">' + escapeHtml(ticket.fix_branch) + '</code></div>' : '') +
      '<div style="margin-bottom:16px"><span style="color:var(--text-secondary);font-size:11px">Description</span>' +
      '<div style="margin-top:4px;padding:12px;background:var(--well);border-radius:6px;color:var(--text-primary);white-space:pre-wrap;font-size:13px">' + escapeHtml(ticket.issue_description || 'No description') + '</div></div>' +
      (ticket.fix_notes ? '<div style="margin-bottom:16px"><span style="color:var(--text-secondary);font-size:11px">Fix Notes</span>' +
      '<div style="margin-top:4px;padding:12px;background:var(--well);border-radius:6px;color:var(--text-primary);white-space:pre-wrap;font-size:13px">' + escapeHtml(ticket.fix_notes) + '</div></div>' : '') +
      '<div id="ticket-detail-ai" style="display:none"></div>';

    Modal.open({
      title: escapeHtml(ticket.subject || 'Ticket Detail'),
      body: body,
      footer:
        '<button class="btn btn-sm btn-ghost" style="color:var(--cyan)" onclick="Views.tickets._analyzeInModal(\'' + ticket.id + '\')">AI Analyze</button>' +
        '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Close</button>',
      size: 'lg'
    });
  }

  // Exposed for inline onclick in modal
  Views.tickets._analyzeInModal = function (id) {
    var el = document.getElementById('ticket-detail-ai');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = '<div style="padding:12px;background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.15);border-radius:6px">' +
      '<span style="color:var(--cyan)">Analyzing with Claude...</span></div>';

    fetch('/api/tickets/' + id + '/ai/analyze', { method: 'POST' })
      .then(safeJson)
      .then(function (d) { renderAnalysisInModal(el, d); })
      .catch(function () {
        el.innerHTML = '<div style="padding:12px;background:rgba(255,107,43,0.05);border:1px solid rgba(255,107,43,0.15);border-radius:6px">' +
          '<span style="color:var(--orange)">AI analysis failed. Check Claude CLI.</span></div>';
      });
  };

  function renderAnalysisInModal(el, data) {
    if (data.error || !data.analysis) {
      el.innerHTML = '<div style="padding:12px;background:rgba(255,107,43,0.05);border:1px solid rgba(255,107,43,0.15);border-radius:6px">' +
        '<span style="color:var(--orange)">' + escapeHtml(data.error || data.analysis || 'No analysis available') + '</span></div>';
      return;
    }
    var riskColor = data.risk_level === 'high' ? 'var(--orange)' : data.risk_level === 'medium' ? 'var(--yellow)' : 'var(--cyan)';
    var html = '<div style="padding:16px;background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.15);border-radius:6px">' +
      '<div style="font-weight:600;color:var(--cyan);margin-bottom:8px">AI Analysis</div>' +
      '<div style="color:var(--text-primary);margin-bottom:12px">' + escapeHtml(data.analysis) + '</div>' +
      '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap">' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Priority</span><br><span style="color:var(--text-primary)">' + escapeHtml(data.recommended_priority || '-') + '</span></div>' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Next Status</span><br><span style="color:var(--cyan)">' + escapeHtml(data.recommended_status || '-') + '</span></div>' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Effort</span><br><span style="color:var(--text-primary)">' + escapeHtml(data.estimated_effort || '-') + '</span></div>' +
        '<div><span style="color:var(--text-secondary);font-size:11px">Risk</span><br><span style="color:' + riskColor + '">' + escapeHtml(data.risk_level || '-') + '</span></div>' +
      '</div>';
    if (data.steps && data.steps.length) {
      html += '<div style="margin-bottom:8px"><span style="color:var(--text-secondary);font-size:11px">Fix Steps</span>';
      html += '<ol style="margin:4px 0 0 16px;color:var(--text-primary);font-size:13px">';
      data.steps.forEach(function (s) { html += '<li style="margin-bottom:4px">' + escapeHtml(s) + '</li>'; });
      html += '</ol></div>';
    }
    if (data.related_areas && data.related_areas.length) {
      html += '<div><span style="color:var(--text-secondary);font-size:11px">Related Areas</span><br>';
      data.related_areas.forEach(function (a) {
        html += '<span class="badge" style="margin-right:4px;font-size:10px">' + escapeHtml(a) + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function analyzeTicket(ticket) {
    Toast.info('Analyzing ticket with AI...');
    fetch('/api/tickets/' + ticket.id + '/ai/analyze', { method: 'POST' })
      .then(safeJson)
      .then(function (d) {
        openTicketDetail(ticket);
        setTimeout(function () {
          var el = document.getElementById('ticket-detail-ai');
          if (el) { el.style.display = 'block'; renderAnalysisInModal(el, d); }
        }, 100);
      })
      .catch(function () { Toast.error('AI analysis failed'); });
  }

  function moveTicket(id, newStatus) {
    fetch('/api/tickets/' + id + '/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fix_status: newStatus })
    }).then(safeJson).then(function () {
      Toast.success('Ticket moved to ' + newStatus);
      Views.tickets.show();
    }).catch(function () { Toast.error('Failed to move ticket'); });
  }

  function approveTicket(id) {
    fetch('/api/tickets/' + id + '/approve', { method: 'POST' })
      .then(safeJson)
      .then(function () { Toast.success('Ticket approved'); Views.tickets.show(); })
      .catch(function () { Toast.error('Failed to approve'); });
  }

  function rejectTicket(id) {
    Modal.open({
      title: 'Reject Ticket', size: 'sm',
      body: '<div class="form-group"><label class="form-label">Reason</label><textarea id="reject-reason" class="form-input" rows="3" placeholder="Why is this being rejected?"></textarea></div>',
      footer: '<button class="btn btn-sm" onclick="Modal.close(this.closest(\'.modal-overlay\'))">Cancel</button>' +
        '<button class="btn btn-sm btn-danger" id="reject-confirm-btn">Reject</button>'
    });
    setTimeout(function () {
      var btn = document.getElementById('reject-confirm-btn');
      if (btn) btn.onclick = function () {
        var reason = (document.getElementById('reject-reason') || {}).value || '';
        fetch('/api/tickets/' + id + '/reject', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason })
        }).then(function () {
          Toast.success('Ticket rejected');
          Modal.close(btn.closest('.modal-overlay'));
          Views.tickets.show();
        }).catch(function () { Toast.error('Failed to reject'); });
      };
    }, 50);
  }

  function deleteTicket(id) {
    Modal.confirm({ title: 'Delete Ticket', message: 'Permanently delete this ticket?', confirmText: 'Delete', dangerous: true })
      .then(function (ok) {
        if (!ok) return;
        fetch('/api/tickets/' + id, { method: 'DELETE' })
          .then(function () { Toast.success('Ticket deleted'); Views.tickets.show(); })
          .catch(function () { Toast.error('Failed to delete'); });
      });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
