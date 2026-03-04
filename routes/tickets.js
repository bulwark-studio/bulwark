module.exports = function (app, ctx) {
  const { dbQuery, vpsQuery, vpsPool, io, execCommand, REPO_DIR } = ctx;

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

  app.patch("/api/tickets/:id/status", async (req, res) => {
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

  app.delete("/api/tickets/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await updateTicket(id, `DELETE FROM support_tickets WHERE id = $1`, [id]);
      io.emit("tickets", await getTicketSummary());
      res.json({ success: true, db: result.db, deleted: result.rowCount > 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/tickets/:id/approve", async (req, res) => {
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

  app.post("/api/tickets/:id/reject", async (req, res) => {
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
};
