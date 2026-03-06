module.exports = function (app, ctx) {
  const { dbQuery, vpsQuery, vpsPool, io, execCommand, REPO_DIR, requireRole } = ctx;
  const { askAI, askAIJSON } = require('../lib/ai');

  async function getTicketSummary() {
    const localTickets = await dbQuery(`
      SELECT id, subject, issue_type, issue_description, priority, fix_status,
             fix_branch, fix_notes, source, created_at, updated_at, target_env, status
      FROM support_tickets WHERE target_env = 'dev' OR fix_status IS NOT NULL
      ORDER BY updated_at DESC LIMIT 50`);

    const vpsTickets = await vpsQuery(`
      SELECT id, subject, issue_type, issue_description, priority, fix_status,
             fix_branch, fix_notes, source, created_at, updated_at, target_env, status
      FROM support_tickets ORDER BY created_at DESC LIMIT 50`);

    for (const t of vpsTickets) t._source = "vps";

    const localIds = new Set(localTickets.map(t => t.id));
    const merged = [...localTickets];
    for (const vt of vpsTickets) { if (!localIds.has(vt.id)) merged.push(vt); }

    for (const t of merged) {
      if (!t.fix_status) {
        if (t.status === "resolved") t.fix_status = "deployed";
        else t.fix_status = "pending";
      }
      if (!t.subject || t.subject === t.issue_type) {
        t.subject = t.issue_description?.substring(0, 120) || t.issue_type || "Untitled";
      }
    }

    const statusOrder = { pending: 1, analyzing: 2, fixing: 3, testing: 4, awaiting_approval: 5, approved: 6, deployed: 7 };
    merged.sort((a, b) => {
      const sa = statusOrder[a.fix_status] || 8;
      const sb = statusOrder[b.fix_status] || 8;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    const counts = {};
    for (const t of merged) counts[t.fix_status] = (counts[t.fix_status] || 0) + 1;
    const summary = Object.entries(counts).map(([fix_status, count]) => ({ fix_status, count }));
    return { summary, tickets: merged.slice(0, 50) };
  }

  async function updateTicket(id, sql, params) {
    if (vpsPool) {
      try { const r = await vpsPool.query(sql, params); if (r.rowCount > 0) return { db: "vps", rowCount: r.rowCount }; }
      catch (e) { console.error("[VPS-DB] update:", e.message); }
    }
    if (ctx.pool) {
      try { const r = await ctx.pool.query(sql, params); if (r.rowCount > 0) return { db: "dev", rowCount: r.rowCount }; }
      catch (e) { console.error("[DB] update:", e.message); }
    }
    return { db: null, rowCount: 0 };
  }

  // Expose getTicketSummary for broadcasts
  ctx.getTicketSummary = getTicketSummary;

  app.get("/api/tickets", async (req, res) => res.json(await getTicketSummary()));

  app.patch("/api/tickets/:id/status", requireRole('editor'), async (req, res) => {
    const { id } = req.params;
    const { fix_status, notes } = req.body;
    const valid = ["pending", "analyzing", "fixing", "testing", "awaiting_approval", "approved", "deployed"];
    if (!valid.includes(fix_status)) return res.status(400).json({ error: "Invalid status" });
    try {
      const notesSql = notes ? `, fix_notes = COALESCE(fix_notes, '') || E'\\n' || $3` : '';
      const params = notes ? [fix_status, id, notes] : [fix_status, id];
      const result = await updateTicket(id, `UPDATE support_tickets SET fix_status = $1, updated_at = NOW()${notesSql} WHERE id = $2`, params);
      io.emit("tickets", await getTicketSummary());
      res.json({ success: true, db: result.db });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/tickets/:id", requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await updateTicket(id, `DELETE FROM support_tickets WHERE id = $1`, [id]);
      io.emit("tickets", await getTicketSummary());
      res.json({ success: true, db: result.db, deleted: result.rowCount > 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/tickets/:id/approve", requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    try {
      await updateTicket(id, `UPDATE support_tickets SET fix_status = 'approved', approved_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
      const rows = await dbQuery(`SELECT fix_branch FROM support_tickets WHERE id = $1`, [id]);
      if (!rows.length && vpsPool) {
        const vr = await vpsPool.query(`SELECT fix_branch FROM support_tickets WHERE id = $1`, [id]);
        if (vr.rows[0]?.fix_branch) rows.push(vr.rows[0]);
      }
      if (rows[0]?.fix_branch) {
        await execCommand(`git -C ${REPO_DIR} push origin ${rows[0].fix_branch}`, { timeout: 30000 });
        io.emit("claude_output", `\r\n[DEPLOY] Pushed ${rows[0].fix_branch}\r\n`);
      }
      await dbQuery(`INSERT INTO chester_activity (type, title, description, metadata) VALUES ('ticket_approved', $1, $2, $3)`,
        [`Ticket ${id.substring(0, 8)} approved`, `Approved for merge`, JSON.stringify({ ticket_id: id })]);
      io.emit("tickets", await getTicketSummary());
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/tickets/:id/reject", requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
      await updateTicket(id, `UPDATE support_tickets SET fix_status = 'fixing', fix_notes = COALESCE(fix_notes, '') || E'\\n[REJECTED] ' || $2, updated_at = NOW() WHERE id = $1`, [id, reason || "Rejected"]);
      await dbQuery(`INSERT INTO chester_activity (type, title, description, metadata) VALUES ('ticket_rejected', $1, $2, $3)`,
        [`Ticket ${id.substring(0, 8)} rejected`, reason || 'Rejected', JSON.stringify({ ticket_id: id, reason })]);
      io.emit("tickets", await getTicketSummary());
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Create ticket ─────────────────────────────────────────────────────────
  app.post("/api/tickets", requireRole('editor'), async (req, res) => {
    const { subject, issue_type, issue_description, priority, target_env } = req.body;
    if (!subject || !issue_description) return res.status(400).json({ error: "Subject and description required" });
    try {
      const sql = `INSERT INTO support_tickets (subject, issue_type, issue_description, priority, fix_status, target_env, name, email, source)
        VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, 'manual') RETURNING id`;
      const user = req.user?.username || 'admin';
      const params = [subject, issue_type || 'task', issue_description, priority || 'normal', target_env || 'dev', user, user + '@bulwark'];
      let row;
      if (ctx.pool) {
        const r = await ctx.pool.query(sql, params);
        row = r.rows[0];
      } else if (vpsPool) {
        const r = await vpsPool.query(sql, params);
        row = r.rows[0];
      }
      if (!row) return res.status(500).json({ error: "No database available" });
      io.emit("tickets", await getTicketSummary());
      res.json({ success: true, id: row.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── AI: Triage all pending tickets ────────────────────────────────────────
  app.post("/api/tickets/ai/triage", requireRole('editor'), async (req, res) => {
    try {
      const data = await getTicketSummary();
      const pending = data.tickets.filter(t => t.fix_status === 'pending' || t.fix_status === 'analyzing');
      if (!pending.length) return res.json({ message: "No pending tickets to triage", results: [] });

      const ticketList = pending.map(t => `- [${t.priority}] ${t.subject}: ${(t.issue_description || '').substring(0, 200)}`).join('\n');
      const prompt = `You are a DevOps ticket triage assistant. Analyze these ${pending.length} support tickets and return JSON.

Tickets:
${ticketList}

Return a JSON array where each element has:
- "subject": the ticket subject (exact match)
- "recommended_priority": "critical" | "high" | "normal" | "low"
- "recommended_status": "analyzing" | "fixing" | "pending"
- "category": a short category label (e.g. "frontend", "backend", "infrastructure", "security", "performance")
- "summary": one-sentence analysis
- "suggested_fix": one-sentence fix suggestion

Return ONLY the JSON array, no markdown.`;

      const result = await askAIJSON(prompt, { timeout: 45000 });
      if (result.error) return res.json({ message: result.error, results: [] });
      const results = Array.isArray(result) ? result : [];
      res.json({ message: `Triaged ${results.length} tickets`, results });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── AI: Analyze single ticket ─────────────────────────────────────────────
  app.post("/api/tickets/:id/ai/analyze", requireRole('editor'), async (req, res) => {
    const { id } = req.params;
    try {
      let ticket;
      const rows = await dbQuery(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
      ticket = rows[0];
      if (!ticket && vpsPool) {
        const vr = await vpsPool.query(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
        ticket = vr.rows[0];
      }
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const prompt = `You are a senior DevOps engineer. Analyze this support ticket and provide actionable guidance. Return JSON.

Ticket:
- Subject: ${ticket.subject || ticket.issue_type}
- Type: ${ticket.issue_type}
- Priority: ${ticket.priority}
- Status: ${ticket.fix_status || ticket.status}
- Description: ${ticket.issue_description}
${ticket.fix_notes ? '- Fix Notes: ' + ticket.fix_notes : ''}
${ticket.fix_branch ? '- Branch: ' + ticket.fix_branch : ''}

Return JSON with:
- "analysis": 2-3 sentence root cause analysis
- "recommended_priority": "critical" | "high" | "normal" | "low"
- "recommended_status": next status this ticket should move to
- "steps": array of 3-5 actionable fix steps (strings)
- "estimated_effort": "trivial" | "small" | "medium" | "large"
- "related_areas": array of system areas affected (e.g. ["frontend", "socket.io", "metrics"])
- "risk_level": "low" | "medium" | "high"

Return ONLY the JSON object, no markdown.`;

      const result = await askAIJSON(prompt, { timeout: 45000 });
      if (result.error) return res.json({ analysis: result.error });
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};
