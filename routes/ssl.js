module.exports = function (app, ctx) {
  app.get("/adapter/ssl/certificates", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/ssl/certificates")); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/ssl/certificates/issue", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/ssl/issue", { method: "POST", body: JSON.stringify(req.body) })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/ssl/certificates/renew/:domain", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/ssl/renew/${req.params.domain}`, { method: "POST" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.delete("/adapter/ssl/certificates/:domain", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/ssl/certificates/${req.params.domain}`, { method: "DELETE" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });

  // Nginx vhosts
  app.get("/adapter/ssl/vhosts", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/ssl/vhosts")); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/ssl/vhosts", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter("/ssl/vhosts", { method: "POST", body: JSON.stringify(req.body) })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.put("/adapter/ssl/vhosts/:domain", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/ssl/vhosts/${req.params.domain}`, { method: "PUT", body: JSON.stringify(req.body) })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.delete("/adapter/ssl/vhosts/:domain", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/ssl/vhosts/${req.params.domain}`, { method: "DELETE" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
};
