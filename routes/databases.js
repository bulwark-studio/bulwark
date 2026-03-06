module.exports = function (app, ctx) {
  app.get("/adapter/databases", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/databases")); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/databases", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/databases", { method: "POST", body: JSON.stringify(req.body) })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.delete("/adapter/databases/:name", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/databases/${req.params.name}`, { method: "DELETE" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.get("/adapter/databases/:name/tables", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/databases/${req.params.name}/tables`)); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.get("/adapter/databases/users", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/databases/users")); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/databases/users", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/databases/users", { method: "POST", body: JSON.stringify(req.body) })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/databases/query", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/databases/query", { method: "POST", body: JSON.stringify(req.body) })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/databases/backup", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/databases/backup", { method: "POST", body: JSON.stringify(req.body) })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.get("/adapter/databases/backups", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/databases/backups")); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
};
