module.exports = function (app, ctx) {
  const proxy = (path) => async (req, res) => {
    try { res.json(await ctx.callAdapter(path)); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  };

  const proxyAction = (pathFn) => async (req, res) => {
    try { res.json(await ctx.callAdapter(pathFn(req.params), { method: "POST", body: JSON.stringify(req.body) })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  };

  app.get("/adapter/docker/containers", ctx.requireAdmin, proxy("/docker/containers"));
  app.get("/adapter/docker/containers/:id", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/docker/containers/${req.params.id}`)); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/docker/containers/:id/:action", ctx.requireAdmin, async (req, res) => {
    const { id, action } = req.params;
    if (!["start", "stop", "restart", "remove"].includes(action)) return res.status(400).json({ error: "Invalid action" });
    try { res.json(await ctx.callAdapter(`/docker/containers/${id}/${action}`, { method: "POST" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.get("/adapter/docker/containers/:id/logs", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/docker/containers/${req.params.id}/logs?tail=${req.query.tail || 100}`)); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.get("/adapter/docker/containers/:id/stats", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/docker/containers/${req.params.id}/stats`)); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.get("/adapter/docker/images", ctx.requireAdmin, proxy("/docker/images"));
  app.delete("/adapter/docker/images/:id", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/docker/images/${req.params.id}`, { method: "DELETE" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.get("/adapter/docker/networks", ctx.requireAdmin, proxy("/docker/networks"));
  app.get("/adapter/docker/volumes", ctx.requireAdmin, proxy("/docker/volumes"));
};
