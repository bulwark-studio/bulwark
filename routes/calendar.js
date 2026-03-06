/**
 * Calendar + Notes API — JSON-based storage with AI features
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CAL_FILE = path.join(__dirname, '..', 'data', 'calendar.json');
const NOTES_FILE = path.join(__dirname, '..', 'data', 'notes.json');

function loadJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function saveJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function askClaude(prompt) {
  return new Promise(function (resolve) {
    var env = Object.assign({}, process.env);
    delete env.CLAUDECODE;
    var proc = spawn('claude', ['--print'], { env: env, shell: true });
    var out = '';
    proc.stdin.write(prompt);
    proc.stdin.end();
    proc.stdout.on('data', function (d) { out += d; });
    proc.on('close', function () { resolve(out.trim()); });
    proc.on('error', function () { resolve('AI unavailable'); });
    setTimeout(function () { try { proc.kill(); } catch {} resolve(out.trim() || 'AI timeout'); }, 30000);
  });
}

module.exports = function (app, ctx) {
  // ── Calendar Events ──────────────────────────────────────────────────
  app.get('/api/calendar/events', function (req, res) {
    var events = loadJSON(CAL_FILE);
    var start = req.query.start;
    var end = req.query.end;
    if (start && end) {
      events = events.filter(function (e) {
        return e.date >= start && e.date <= end;
      });
    }
    res.json({ events: events });
  });

  app.post('/api/calendar/events', function (req, res) {
    var events = loadJSON(CAL_FILE);
    var ev = {
      id: genId(),
      title: req.body.title || 'Untitled',
      date: req.body.date || new Date().toISOString().slice(0, 10),
      time: req.body.time || '',
      endTime: req.body.endTime || '',
      category: req.body.category || 'general',
      description: req.body.description || '',
      priority: req.body.priority || 'normal',
      recurring: req.body.recurring || null,
      reminders: req.body.reminders || [],
      linkedNotes: req.body.linkedNotes || [],
      status: 'scheduled',
      created: new Date().toISOString()
    };
    events.push(ev);
    saveJSON(CAL_FILE, events);
    res.json({ ok: true, event: ev });
  });

  app.put('/api/calendar/events/:id', function (req, res) {
    var events = loadJSON(CAL_FILE);
    var idx = events.findIndex(function (e) { return e.id === req.params.id; });
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    Object.assign(events[idx], req.body, { updated: new Date().toISOString() });
    saveJSON(CAL_FILE, events);
    res.json({ ok: true, event: events[idx] });
  });

  app.delete('/api/calendar/events/:id', function (req, res) {
    var events = loadJSON(CAL_FILE);
    events = events.filter(function (e) { return e.id !== req.params.id; });
    saveJSON(CAL_FILE, events);
    res.json({ ok: true });
  });

  // AI: Generate schedule from natural language
  app.post('/api/calendar/ai-parse', function (req, res) {
    var text = req.body.text || '';
    askClaude(
      'Parse this into calendar events. Return JSON array with fields: title, date (YYYY-MM-DD), time (HH:MM or empty), category (meeting/deploy/deadline/reminder/general), priority (low/normal/high/critical), description. Today is ' + new Date().toISOString().slice(0, 10) + '. Text: "' + text + '". Return ONLY valid JSON array, no explanation.'
    ).then(function (r) {
      try {
        var match = r.match(/\[[\s\S]*\]/);
        res.json({ events: JSON.parse(match[0]) });
      } catch { res.json({ events: [], raw: r }); }
    });
  });

  // AI: Daily planner briefing
  app.get('/api/calendar/ai-briefing', function (req, res) {
    var events = loadJSON(CAL_FILE);
    var notes = loadJSON(NOTES_FILE);
    var today = new Date().toISOString().slice(0, 10);
    var upcoming = events.filter(function (e) { return e.date >= today && e.date <= nextDays(7); }).slice(0, 15);
    var recentNotes = notes.filter(function (n) { return !n.archived; }).slice(0, 10);
    var prompt = 'You are Chester, an AI DevOps assistant. Analyze this developer\'s schedule and notes. Give a concise daily briefing: what\'s today, upcoming deadlines, priorities, and any suggestions. Be direct, use bullet points.\n\nToday: ' + today + '\nUpcoming events: ' + JSON.stringify(upcoming) + '\nRecent notes: ' + JSON.stringify(recentNotes.map(function (n) { return { title: n.title, tags: n.tags, pinned: n.pinned }; })) + '\n\nKeep response under 200 words.';
    askClaude(prompt).then(function (r) { res.json({ briefing: r }); });
  });

  // AI: Smart suggestions for scheduling
  app.post('/api/calendar/ai-suggest', function (req, res) {
    var events = loadJSON(CAL_FILE);
    var context = req.body.context || 'weekly planning';
    askClaude(
      'As Chester DevOps AI, suggest 3-5 calendar events a developer should schedule based on context: "' + context + '". Current events: ' + JSON.stringify(events.slice(-10)) + '. Return JSON array with title, date (YYYY-MM-DD), time, category, priority. Today is ' + new Date().toISOString().slice(0, 10) + '. Return ONLY valid JSON array.'
    ).then(function (r) {
      try {
        var match = r.match(/\[[\s\S]*\]/);
        res.json({ suggestions: JSON.parse(match[0]) });
      } catch { res.json({ suggestions: [], raw: r }); }
    });
  });

  // ── Notes ────────────────────────────────────────────────────────────
  app.get('/api/notes', function (req, res) {
    var notes = loadJSON(NOTES_FILE);
    if (req.query.tag) {
      notes = notes.filter(function (n) { return n.tags && n.tags.indexOf(req.query.tag) >= 0; });
    }
    if (req.query.search) {
      var q = req.query.search.toLowerCase();
      notes = notes.filter(function (n) {
        return (n.title || '').toLowerCase().indexOf(q) >= 0 || (n.content || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    notes.sort(function (a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updated || b.created) - new Date(a.updated || a.created);
    });
    res.json({ notes: notes.filter(function (n) { return !n.archived; }), archived: notes.filter(function (n) { return n.archived; }) });
  });

  app.post('/api/notes', function (req, res) {
    var notes = loadJSON(NOTES_FILE);
    var note = {
      id: genId(),
      title: req.body.title || 'Untitled',
      content: req.body.content || '',
      tags: req.body.tags || [],
      color: req.body.color || 'default',
      pinned: req.body.pinned || false,
      archived: false,
      linkedEvents: req.body.linkedEvents || [],
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    notes.push(note);
    saveJSON(NOTES_FILE, notes);
    res.json({ ok: true, note: note });
  });

  app.put('/api/notes/:id', function (req, res) {
    var notes = loadJSON(NOTES_FILE);
    var idx = notes.findIndex(function (n) { return n.id === req.params.id; });
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    Object.assign(notes[idx], req.body, { updated: new Date().toISOString() });
    saveJSON(NOTES_FILE, notes);
    res.json({ ok: true, note: notes[idx] });
  });

  app.delete('/api/notes/:id', function (req, res) {
    var notes = loadJSON(NOTES_FILE);
    notes = notes.filter(function (n) { return n.id !== req.params.id; });
    saveJSON(NOTES_FILE, notes);
    res.json({ ok: true });
  });

  // AI: Generate note from prompt
  app.post('/api/notes/ai-generate', function (req, res) {
    var prompt = req.body.prompt || '';
    askClaude(
      'Generate a developer note about: "' + prompt + '". Return JSON with fields: title (concise), content (markdown, 100-300 words), tags (array of 2-4 relevant tags). Return ONLY valid JSON object.'
    ).then(function (r) {
      try {
        var match = r.match(/\{[\s\S]*\}/);
        res.json({ note: JSON.parse(match[0]) });
      } catch { res.json({ note: null, raw: r }); }
    });
  });

  // AI: Summarize all notes
  app.get('/api/notes/ai-summary', function (req, res) {
    var notes = loadJSON(NOTES_FILE).filter(function (n) { return !n.archived; });
    if (notes.length === 0) return res.json({ summary: 'No notes yet. Start capturing ideas, meeting notes, and decisions.' });
    askClaude(
      'As Chester DevOps AI, analyze these developer notes and give a brief knowledge summary: themes, action items, patterns. Under 150 words.\n\nNotes: ' + JSON.stringify(notes.map(function (n) { return { title: n.title, tags: n.tags, content: (n.content || '').substring(0, 200) }; }))
    ).then(function (r) { res.json({ summary: r }); });
  });

  // AI: Analyze calendar + notes together
  app.get('/api/workspace/ai-analysis', function (req, res) {
    var events = loadJSON(CAL_FILE);
    var notes = loadJSON(NOTES_FILE).filter(function (n) { return !n.archived; });
    var today = new Date().toISOString().slice(0, 10);
    askClaude(
      'As Chester DevOps AI, analyze this developer workspace (calendar + notes). Provide: workload assessment, upcoming priorities, knowledge gaps, productivity insights. Be concise, use bullet points, under 200 words.\n\nToday: ' + today + '\nEvents (' + events.length + '): ' + JSON.stringify(events.slice(-20).map(function (e) { return { title: e.title, date: e.date, category: e.category, priority: e.priority }; })) + '\nNotes (' + notes.length + '): ' + JSON.stringify(notes.slice(0, 10).map(function (n) { return { title: n.title, tags: n.tags }; }))
    ).then(function (r) { res.json({ analysis: r }); });
  });

  // Stats for overview widget
  app.get('/api/calendar/stats', function (req, res) {
    var events = loadJSON(CAL_FILE);
    var notes = loadJSON(NOTES_FILE);
    var today = new Date().toISOString().slice(0, 10);
    var todayEvents = events.filter(function (e) { return e.date === today; });
    var weekEnd = nextDays(7);
    var weekEvents = events.filter(function (e) { return e.date >= today && e.date <= weekEnd; });
    var activeNotes = notes.filter(function (n) { return !n.archived; });
    var pinnedNotes = activeNotes.filter(function (n) { return n.pinned; });
    res.json({
      todayCount: todayEvents.length,
      weekCount: weekEvents.length,
      totalEvents: events.length,
      todayEvents: todayEvents.slice(0, 5),
      activeNotes: activeNotes.length,
      pinnedNotes: pinnedNotes.length,
      recentNotes: activeNotes.slice(0, 3).map(function (n) { return { id: n.id, title: n.title, tags: n.tags, updated: n.updated }; }),
      tags: getUniqueTags(activeNotes)
    });
  });

  function getUniqueTags(notes) {
    var tags = {};
    notes.forEach(function (n) { (n.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    return Object.keys(tags).map(function (t) { return { tag: t, count: tags[t] }; }).sort(function (a, b) { return b.count - a.count; });
  }

  function nextDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
};
