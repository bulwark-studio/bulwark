/**
 * Bulwark v2.1 — Tickets View (Kanban Board)
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
              '<button class="btn btn-sm btn-ghost" onclick="Views.tickets.show()">Refresh</button>' +
            '</div>' +
          '</div>' +
          '<div id="ticket-status-bar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap"></div>' +
          '<div id="ticket-kanban" class="kanban-board"></div>';
      }
    },

    show: function () {
      fetch('/api/tickets').then(function (r) { return r.json(); }).then(function (d) {
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
    }
  };

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
        (ticket.fix_branch ? ' <span style="color:var(--cyan);font-size:10px">' + escapeHtml(ticket.fix_branch) + '</span>' : '') +
      '</div>' +
      '<div class="kanban-card-description">' + escapeHtml(ticket.issue_description || '') + '</div>';

    var actions = document.createElement('div');
    actions.className = 'kanban-card-actions';
    actions.style.cssText = 'display:flex;gap:4px;margin-top:8px;align-items:center';

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
    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-ghost';
    delBtn.style.cssText = 'margin-left:auto;color:var(--text-tertiary);font-size:10px';
    delBtn.textContent = 'Del';
    delBtn.onclick = function (e) { e.stopPropagation(); deleteTicket(ticket.id); };
    actions.appendChild(delBtn);
    card.appendChild(actions);

    card.addEventListener('click', function () { card.classList.toggle('expanded'); });
    card.addEventListener('dragstart', function (e) { dragTicketId = ticket.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragend', function () { card.classList.remove('dragging'); dragTicketId = null; });
    return card;
  }

  function moveTicket(id, newStatus) {
    fetch('/api/tickets/' + id + '/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fix_status: newStatus })
    }).then(function (r) { return r.json(); }).then(function () {
      Toast.success('Ticket moved to ' + newStatus);
      Views.tickets.show();
    }).catch(function () { Toast.error('Failed to move ticket'); });
  }

  function approveTicket(id) {
    fetch('/api/tickets/' + id + '/approve', { method: 'POST' })
      .then(function (r) { return r.json(); })
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
