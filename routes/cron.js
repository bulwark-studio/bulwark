module.exports = function (app, ctx) {
  const adapterRoute = (method, adapterPath) => async (req, res) => {
    try {
      const opts = { method: method.toUpperCase() };
      if (["POST", "PUT"].includes(opts.method) && req.body) opts.body = JSON.stringify(req.body);
      const resolved = adapterPath.replace(/:(\w+)/g, (_, k) => req.params[k]);
      res.json(await ctx.callAdapter(resolved, opts));
    } catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  };

  app.get("/adapter/cron/jobs", ctx.requireAdmin, adapterRoute("GET", "/cron"));
  app.post("/adapter/cron/jobs", ctx.requireAdmin, adapterRoute("POST", "/cron"));
  app.put("/adapter/cron/jobs/:id", ctx.requireAdmin, adapterRoute("PUT", "/cron/:id"));
  app.delete("/adapter/cron/jobs/:id", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/cron/${req.params.id}`, { method: "DELETE" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.post("/adapter/cron/jobs/:id/toggle", ctx.requireAdmin, adapterRoute("POST", "/cron/:id/toggle"));
};
