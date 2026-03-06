/**
 * Calendar Intelligence Center — AI-powered calendar + scheduling
 * ViewRegistry pattern: Views.calendar = { init, show, hide, update }
 */
(function () {
  'use strict';

  var currentMonth = new Date().getMonth();
  var currentYear = new Date().getFullYear();
  var events = [];
  var selectedDate = null;
  var activeTab = 'month';
  var typewriterTimer = null;

  var CAT_COLORS = {
    meeting: '#a78bfa', deploy: '#22d3ee', deadline: '#ff6b2b',
    reminder: '#f59e0b', general: '#8b8b92', maintenance: '#3b82f6'
  };
  var PRIORITY_ICONS = { critical: '!!', high: '!', normal: '', low: '' };

  function esc(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }
  function timeAgo(d) { if (!d) return ''; var diff = Date.now() - new Date(d).getTime(); if (diff < 3600000) return Math.round(diff / 60000) + 'm ago'; if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago'; return Math.round(diff / 86400000) + 'd ago'; }

  Views.calendar = {
    init: function () {
      var c = document.getElementById('view-calendar');
      if (!c) return;
      c.innerHTML =
        '<div class="cal-view">' +
          /* AI Briefing */
          '<div class="cal-ai-card" id="cal-ai-card">' +
            '<div class="cal-ai-header">' +
              '<span class="cal-ai-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z"/></svg> AI Schedule Briefing</span>' +
              '<button class="cal-ai-refresh" onclick="Views.calendar.loadBriefing()">Refresh</button>' +
            '</div>' +
            '<div class="cal-ai-text" id="cal-ai-text"><div class="briefing-shimmer" style="width:80%"></div><div class="briefing-shimmer" style="width:55%"></div></div>' +
          '</div>' +

          /* Tabs */
          '<div class="cal-tabs">' +
            '<button class="cal-tab-btn active" data-tab="month" onclick="Views.calendar.switchTab(\'month\')">Month</button>' +
            '<button class="cal-tab-btn" data-tab="week" onclick="Views.calendar.switchTab(\'week\')">Week</button>' +
            '<button class="cal-tab-btn" data-tab="agenda" onclick="Views.calendar.switchTab(\'agenda\')">Agenda</button>' +
            '<button class="cal-tab-btn" data-tab="ai" onclick="Views.calendar.switchTab(\'ai\')">AI Planner</button>' +
          '</div>' +

          /* Stats Banner */
          '<div class="cal-stats" id="cal-stats"></div>' +

          /* Tab Content */
          '<div class="cal-tab-content" id="cal-tab-month">' +
            '<div class="cal-nav">' +
              '<button class="cal-nav-btn" onclick="Views.calendar.prevMonth()">&larr;</button>' +
              '<span class="cal-nav-title" id="cal-month-title"></span>' +
              '<button class="cal-nav-btn" onclick="Views.calendar.nextMonth()">&rarr;</button>' +
              '<button class="cal-nav-btn cal-today-btn" onclick="Views.calendar.goToday()">Today</button>' +
            '</div>' +
            '<div class="cal-grid" id="cal-grid"></div>' +
          '</div>' +

          '<div class="cal-tab-content" id="cal-tab-week" style="display:none"></div>' +
          '<div class="cal-tab-content" id="cal-tab-agenda" style="display:none"></div>' +
          '<div class="cal-tab-content" id="cal-tab-ai" style="display:none"></div>' +

          /* Day detail sidebar */
          '<div class="cal-day-detail" id="cal-day-detail" style="display:none">' +
            '<div class="cal-day-header">' +
              '<span id="cal-day-title"></span>' +
              '<button class="cal-close-btn" onclick="Views.calendar.closeDetail()">&times;</button>' +
            '</div>' +
            '<div id="cal-day-events"></div>' +
            '<button class="cal-add-btn" onclick="Views.calendar.openAddModal()">+ Add Event</button>' +
          '</div>' +
        '</div>';
    },

    show: function () {
      this.loadEvents();
      this.loadBriefing();
    },

    hide: function () {
      if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    },
    update: function () {},

    loadEvents: function () {
      fetch('/api/calendar/events').then(function (r) { return r.json(); }).then(function (d) {
        events = d.events || [];
        Views.calendar.renderMonth();
        Views.calendar.renderStats();
      }).catch(function () {});
    },

    loadBriefing: function () {
      var el = document.getElementById('cal-ai-text');
      if (!el) return;
      el.innerHTML = '<div class="briefing-shimmer" style="width:80%"></div><div class="briefing-shimmer" style="width:55%"></div>';
      fetch('/api/calendar/ai-briefing').then(function (r) { return r.json(); }).then(function (d) {
        Views.calendar.typewriter(el, d.briefing || 'No briefing available.');
      }).catch(function () { el.textContent = 'AI briefing unavailable.'; });
    },

    typewriter: function (el, text) {
      if (typewriterTimer) clearInterval(typewriterTimer);
      el.innerHTML = '';
      var i = 0;
      typewriterTimer = setInterval(function () {
        if (i < text.length) { el.textContent += text[i]; i++; }
        else { clearInterval(typewriterTimer); typewriterTimer = null; }
      }, 12);
    },

    renderStats: function () {
      var el = document.getElementById('cal-stats');
      if (!el) return;
      var today = new Date().toISOString().slice(0, 10);
      var todayEv = events.filter(function (e) { return e.date === today; });
      var d = new Date(); d.setDate(d.getDate() + 7);
      var weekEnd = d.toISOString().slice(0, 10);
      var weekEv = events.filter(function (e) { return e.date >= today && e.date <= weekEnd; });
      var high = events.filter(function (e) { return e.priority === 'high' || e.priority === 'critical'; });
      el.innerHTML =
        '<div class="cal-stat"><span class="cal-stat-val" style="color:var(--cyan)">' + todayEv.length + '</span><span class="cal-stat-label">Today</span></div>' +
        '<div class="cal-stat"><span class="cal-stat-val">' + weekEv.length + '</span><span class="cal-stat-label">This Week</span></div>' +
        '<div class="cal-stat"><span class="cal-stat-val">' + events.length + '</span><span class="cal-stat-label">Total</span></div>' +
        '<div class="cal-stat"><span class="cal-stat-val" style="color:var(--orange)">' + high.length + '</span><span class="cal-stat-label">High Priority</span></div>';
    },

    renderMonth: function () {
      var grid = document.getElementById('cal-grid');
      var title = document.getElementById('cal-month-title');
      if (!grid || !title) return;

      var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      title.textContent = months[currentMonth] + ' ' + currentYear;

      var firstDay = new Date(currentYear, currentMonth, 1).getDay();
      var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      var today = new Date().toISOString().slice(0, 10);

      var html = '<div class="cal-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="cal-days">';

      for (var i = 0; i < firstDay; i++) html += '<div class="cal-day cal-day-empty"></div>';

      for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = currentYear + '-' + String(currentMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var dayEvents = events.filter(function (e) { return e.date === dateStr; });
        var isToday = dateStr === today;
        var isSel = dateStr === selectedDate;
        var cls = 'cal-day' + (isToday ? ' cal-day-today' : '') + (isSel ? ' cal-day-selected' : '') + (dayEvents.length ? ' cal-day-has-events' : '');

        html += '<div class="' + cls + '" onclick="Views.calendar.selectDate(\'' + dateStr + '\')">' +
          '<span class="cal-day-num">' + d + '</span>';
        if (dayEvents.length > 0) {
          html += '<div class="cal-day-dots">';
          dayEvents.slice(0, 3).forEach(function (ev) {
            html += '<span class="cal-day-dot" style="background:' + (CAT_COLORS[ev.category] || '#8b8b92') + '" title="' + esc(ev.title) + '"></span>';
          });
          if (dayEvents.length > 3) html += '<span class="cal-day-more">+' + (dayEvents.length - 3) + '</span>';
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
      grid.innerHTML = html;
    },

    prevMonth: function () { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } this.renderMonth(); },
    nextMonth: function () { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } this.renderMonth(); },
    goToday: function () { var n = new Date(); currentMonth = n.getMonth(); currentYear = n.getFullYear(); selectedDate = n.toISOString().slice(0, 10); this.renderMonth(); this.showDayDetail(selectedDate); },

    selectDate: function (dateStr) {
      selectedDate = dateStr;
      this.renderMonth();
      this.showDayDetail(dateStr);
    },

    showDayDetail: function (dateStr) {
      var panel = document.getElementById('cal-day-detail');
      var titleEl = document.getElementById('cal-day-title');
      var eventsEl = document.getElementById('cal-day-events');
      if (!panel) return;
      panel.style.display = 'block';
      titleEl.textContent = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

      var dayEvents = events.filter(function (e) { return e.date === dateStr; });
      if (!dayEvents.length) {
        eventsEl.innerHTML = '<div class="cal-no-events">No events scheduled</div>';
        return;
      }
      eventsEl.innerHTML = dayEvents.map(function (ev) {
        var pri = PRIORITY_ICONS[ev.priority] || '';
        return '<div class="cal-event-card" style="border-left:3px solid ' + (CAT_COLORS[ev.category] || '#8b8b92') + '">' +
          '<div class="cal-event-top">' +
            '<span class="cal-event-title">' + (pri ? '<span class="cal-pri">' + pri + '</span> ' : '') + esc(ev.title) + '</span>' +
            '<div class="cal-event-actions">' +
              '<button onclick="Views.calendar.editEvent(\'' + ev.id + '\')" title="Edit">&#9998;</button>' +
              '<button onclick="Views.calendar.deleteEvent(\'' + ev.id + '\')" title="Delete">&times;</button>' +
            '</div>' +
          '</div>' +
          (ev.time ? '<div class="cal-event-time">' + ev.time + (ev.endTime ? ' - ' + ev.endTime : '') + '</div>' : '') +
          (ev.description ? '<div class="cal-event-desc">' + esc(ev.description) + '</div>' : '') +
          '<div class="cal-event-meta"><span class="cal-event-cat" style="color:' + (CAT_COLORS[ev.category] || '#8b8b92') + '">' + esc(ev.category) + '</span></div>' +
        '</div>';
      }).join('');
    },

    closeDetail: function () {
      var panel = document.getElementById('cal-day-detail');
      if (panel) panel.style.display = 'none';
      selectedDate = null;
      this.renderMonth();
    },

    openAddModal: function () {
      var date = selectedDate || new Date().toISOString().slice(0, 10);
      var formHtml = '<div class="cal-modal-form">' +
        '<input id="cal-add-title" class="glass-input" placeholder="Event title" autofocus/>' +
        '<div class="cal-modal-row">' +
          '<input id="cal-add-date" class="glass-input" type="date" value="' + date + '"/>' +
          '<input id="cal-add-time" class="glass-input" type="time" placeholder="Time"/>' +
          '<input id="cal-add-endtime" class="glass-input" type="time" placeholder="End"/>' +
        '</div>' +
        '<select id="cal-add-cat" class="glass-input"><option value="general">General</option><option value="meeting">Meeting</option><option value="deploy">Deploy</option><option value="deadline">Deadline</option><option value="reminder">Reminder</option><option value="maintenance">Maintenance</option></select>' +
        '<select id="cal-add-pri" class="glass-input"><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="critical">Critical</option></select>' +
        '<textarea id="cal-add-desc" class="glass-input" rows="3" placeholder="Description (optional)"></textarea>' +
        '<div class="cal-ai-parse-row">' +
          '<input id="cal-ai-input" class="glass-input" placeholder="Or describe in natural language... e.g. Deploy review Friday 3pm"/>' +
          '<button class="cal-ai-parse-btn" onclick="Views.calendar.aiParse()">AI Parse</button>' +
        '</div>' +
      '</div>';

      var overlay = Modal.open({
        title: 'Add Event',
        body: formHtml,
        footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button><button class="btn btn-sm btn-primary" id="cal-add-submit">Add Event</button>'
      });

      // Bind submit after DOM is ready
      setTimeout(function () {
        var btn = document.getElementById('cal-add-submit');
        if (btn) btn.onclick = function () {
          var payload = {
            title: document.getElementById('cal-add-title').value,
            date: document.getElementById('cal-add-date').value,
            time: document.getElementById('cal-add-time').value,
            endTime: document.getElementById('cal-add-endtime').value,
            category: document.getElementById('cal-add-cat').value,
            priority: document.getElementById('cal-add-pri').value,
            description: document.getElementById('cal-add-desc').value
          };
          if (!payload.title) return Toast.error('Title required');
          fetch('/api/calendar/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function () { Modal.close(overlay); Views.calendar.loadEvents(); Toast.success('Event created'); });
        };
      }, 50);
    },

    aiParse: function () {
      var input = document.getElementById('cal-ai-input');
      if (!input || !input.value) return;
      Toast.info('AI parsing...');
      fetch('/api/calendar/ai-parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: input.value }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (d.events && d.events.length > 0) {
            var ev = d.events[0];
            if (ev.title) document.getElementById('cal-add-title').value = ev.title;
            if (ev.date) document.getElementById('cal-add-date').value = ev.date;
            if (ev.time) document.getElementById('cal-add-time').value = ev.time;
            if (ev.category) document.getElementById('cal-add-cat').value = ev.category;
            if (ev.priority) document.getElementById('cal-add-pri').value = ev.priority;
            if (ev.description) document.getElementById('cal-add-desc').value = ev.description;
            Toast.success('AI filled ' + d.events.length + ' event(s)');
          } else Toast.warning('Could not parse');
        }).catch(function () { Toast.error('AI parse failed'); });
    },

    editEvent: function (id) {
      var ev = events.find(function (e) { return e.id === id; });
      if (!ev) return;
      var formHtml = '<div class="cal-modal-form">' +
        '<input id="cal-edit-title" class="glass-input" value="' + esc(ev.title) + '"/>' +
        '<div class="cal-modal-row">' +
          '<input id="cal-edit-date" class="glass-input" type="date" value="' + ev.date + '"/>' +
          '<input id="cal-edit-time" class="glass-input" type="time" value="' + (ev.time || '') + '"/>' +
          '<input id="cal-edit-endtime" class="glass-input" type="time" value="' + (ev.endTime || '') + '"/>' +
        '</div>' +
        '<select id="cal-edit-cat" class="glass-input">' +
          ['general', 'meeting', 'deploy', 'deadline', 'reminder', 'maintenance'].map(function (c) { return '<option' + (c === ev.category ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
        '</select>' +
        '<select id="cal-edit-pri" class="glass-input">' +
          ['low', 'normal', 'high', 'critical'].map(function (p) { return '<option' + (p === ev.priority ? ' selected' : '') + '>' + p + '</option>'; }).join('') +
        '</select>' +
        '<textarea id="cal-edit-desc" class="glass-input" rows="3">' + esc(ev.description) + '</textarea>' +
      '</div>';

      var overlay = Modal.open({
        title: 'Edit Event',
        body: formHtml,
        footer: '<button class="btn btn-sm" onclick="Modal.close()">Cancel</button><button class="btn btn-sm btn-primary" id="cal-edit-submit">Save</button>'
      });

      setTimeout(function () {
        var btn = document.getElementById('cal-edit-submit');
        if (btn) btn.onclick = function () {
          fetch('/api/calendar/events/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            title: document.getElementById('cal-edit-title').value,
            date: document.getElementById('cal-edit-date').value,
            time: document.getElementById('cal-edit-time').value,
            endTime: document.getElementById('cal-edit-endtime').value,
            category: document.getElementById('cal-edit-cat').value,
            priority: document.getElementById('cal-edit-pri').value,
            description: document.getElementById('cal-edit-desc').value
          }) }).then(function () { Modal.close(overlay); Views.calendar.loadEvents(); Toast.success('Updated'); });
        };
      }, 50);
    },

    deleteEvent: function (id) {
      Modal.confirm({ title: 'Delete Event', message: 'Delete this event?', dangerous: true, confirmText: 'Delete' }).then(function (yes) {
        if (!yes) return;
        fetch('/api/calendar/events/' + id, { method: 'DELETE' }).then(function () {
          Views.calendar.loadEvents();
          if (selectedDate) Views.calendar.showDayDetail(selectedDate);
          Toast.success('Deleted');
        });
      });
    },

    switchTab: function (tab) {
      activeTab = tab;
      document.querySelectorAll('.cal-tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
      ['month', 'week', 'agenda', 'ai'].forEach(function (t) {
        var el = document.getElementById('cal-tab-' + t);
        if (el) el.style.display = t === tab ? 'block' : 'none';
      });
      if (tab === 'week') this.renderWeek();
      if (tab === 'agenda') this.renderAgenda();
      if (tab === 'ai') this.renderAIPlanner();
    },

    renderWeek: function () {
      var el = document.getElementById('cal-tab-week');
      if (!el) return;
      var now = new Date();
      var startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());

      var html = '<div class="cal-week-grid">';
      var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (var i = 0; i < 7; i++) {
        var d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        var dateStr = d.toISOString().slice(0, 10);
        var dayEvents = events.filter(function (e) { return e.date === dateStr; });
        var isToday = dateStr === now.toISOString().slice(0, 10);

        html += '<div class="cal-week-day' + (isToday ? ' cal-week-today' : '') + '">' +
          '<div class="cal-week-day-header"><span class="cal-week-day-name">' + days[i] + '</span><span class="cal-week-day-num">' + d.getDate() + '</span></div>' +
          '<div class="cal-week-day-events">';
        dayEvents.forEach(function (ev) {
          html += '<div class="cal-week-event" style="border-left:2px solid ' + (CAT_COLORS[ev.category] || '#8b8b92') + '" onclick="Views.calendar.selectDate(\'' + dateStr + '\')">' +
            (ev.time ? '<span class="cal-week-event-time">' + ev.time + '</span>' : '') +
            '<span>' + esc(ev.title) + '</span></div>';
        });
        if (!dayEvents.length) html += '<div class="cal-week-empty">No events</div>';
        html += '</div></div>';
      }
      html += '</div>';
      el.innerHTML = html;
    },

    renderAgenda: function () {
      var el = document.getElementById('cal-tab-agenda');
      if (!el) return;
      var today = new Date().toISOString().slice(0, 10);
      var upcoming = events.filter(function (e) { return e.date >= today; }).sort(function (a, b) { return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''); });

      if (!upcoming.length) { el.innerHTML = '<div class="cal-no-events" style="padding:40px;text-align:center">No upcoming events. Add some!</div>'; return; }

      var grouped = {};
      upcoming.forEach(function (e) { if (!grouped[e.date]) grouped[e.date] = []; grouped[e.date].push(e); });

      var html = '';
      Object.keys(grouped).slice(0, 14).forEach(function (date) {
        var d = new Date(date + 'T12:00:00');
        var isToday = date === today;
        html += '<div class="cal-agenda-group">' +
          '<div class="cal-agenda-date' + (isToday ? ' cal-agenda-today' : '') + '">' +
            d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
            (isToday ? ' <span style="color:var(--cyan);font-size:11px">TODAY</span>' : '') +
          '</div>';
        grouped[date].forEach(function (ev) {
          html += '<div class="cal-agenda-item" style="border-left:3px solid ' + (CAT_COLORS[ev.category] || '#8b8b92') + '">' +
            '<div class="cal-agenda-item-time">' + (ev.time || 'All day') + '</div>' +
            '<div class="cal-agenda-item-title">' + esc(ev.title) + '</div>' +
            '<span class="cal-agenda-item-cat">' + esc(ev.category) + '</span>' +
          '</div>';
        });
        html += '</div>';
      });
      el.innerHTML = html;
    },

    renderAIPlanner: function () {
      var el = document.getElementById('cal-tab-ai');
      if (!el) return;
      el.innerHTML =
        '<div class="cal-ai-planner">' +
          '<div class="cal-ai-planner-header">AI Schedule Assistant</div>' +
          '<p class="cal-ai-planner-desc">Describe what you need to schedule and Bulwark will suggest events.</p>' +
          '<div class="cal-ai-planner-input-row">' +
            '<input id="cal-ai-suggest-input" class="glass-input" placeholder="e.g. Plan a deployment cycle for next week with testing and review..." style="flex:1"/>' +
            '<button class="cal-ai-suggest-btn" onclick="Views.calendar.aiSuggest()">Generate Plan</button>' +
          '</div>' +
          '<div id="cal-ai-suggestions"></div>' +
        '</div>';
    },

    aiSuggest: function () {
      var input = document.getElementById('cal-ai-suggest-input');
      var output = document.getElementById('cal-ai-suggestions');
      if (!input || !input.value || !output) return;
      output.innerHTML = '<div class="briefing-shimmer" style="width:70%"></div><div class="briefing-shimmer" style="width:50%"></div>';
      fetch('/api/calendar/ai-suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: input.value }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          var sugs = d.suggestions || [];
          if (!sugs.length) { output.innerHTML = '<div class="cal-no-events">No suggestions generated.</div>'; return; }
          output.innerHTML = sugs.map(function (s) {
            return '<div class="cal-suggestion-card">' +
              '<div class="cal-suggestion-top">' +
                '<span class="cal-suggestion-title">' + esc(s.title) + '</span>' +
                '<button class="cal-suggestion-add" onclick="Views.calendar.addSuggestion(' + esc(JSON.stringify(JSON.stringify(s))) + ')">+ Add</button>' +
              '</div>' +
              '<div class="cal-suggestion-meta">' +
                '<span>' + (s.date || '') + '</span>' +
                (s.time ? '<span>' + s.time + '</span>' : '') +
                '<span style="color:' + (CAT_COLORS[s.category] || '#8b8b92') + '">' + (s.category || '') + '</span>' +
              '</div>' +
            '</div>';
          }).join('');
        }).catch(function () { output.innerHTML = '<div class="cal-no-events">AI suggestion failed.</div>'; });
    },

    addSuggestion: function (json) {
      var s = JSON.parse(json);
      fetch('/api/calendar/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
        .then(function () { Views.calendar.loadEvents(); Toast.success('Event added from AI suggestion'); });
    }
  };
})();
