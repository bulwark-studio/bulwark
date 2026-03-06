module.exports = function (app, ctx) {
  const adapterRoute = (method, adapterPath) => async (req, res) => {
    try {
      const opts = { method: method.toUpperCase() };
      if (["POST", "PUT"].includes(opts.method) && req.body) opts.body = JSON.stringify(req.body);
      const resolved = adapterPath.replace(/:(\w+)/g, (_, k) => req.params[k]);
      res.json(await ctx.callAdapter(resolved, opts));
    } catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  };

  app.get("/adapter/ftp/status", ctx.requireAdmin, adapterRoute("GET", "/ftp/status"));
  app.post("/adapter/ftp/toggle", ctx.requireAdmin, adapterRoute("POST", "/ftp/toggle"));
  app.get("/adapter/ftp/users", ctx.requireAdmin, adapterRoute("GET", "/ftp/users"));
  app.post("/adapter/ftp/users", ctx.requireAdmin, adapterRoute("POST", "/ftp/users"));
  app.delete("/adapter/ftp/users/:name", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/ftp/users/${req.params.name}`, { method: "DELETE" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });
  app.get("/adapter/ftp/sessions", ctx.requireAdmin, adapterRoute("GET", "/ftp/sessions"));
};
