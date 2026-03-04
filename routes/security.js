module.exports = function (app, ctx) {
  const adapterRoute = (method, path) => async (req, res) => {
    try {
      const opts = { method: method.toUpperCase() };
      if (["POST", "PUT", "PATCH"].includes(opts.method) && req.body) opts.body = JSON.stringify(req.body);
      res.json(await ctx.callAdapter(path.replace(/:(\w+)/g, (_, k) => req.params[k]), opts));
    } catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  };

  // ClamAV malware scanning
  app.get("/adapter/security/scan", ctx.requireAdmin, adapterRoute("GET", "/security/scan"));
  app.post("/adapter/security/scan", ctx.requireAdmin, adapterRoute("POST", "/security/scan"));

  // File integrity
  app.get("/adapter/security/integrity", ctx.requireAdmin, adapterRoute("GET", "/security/integrity"));
  app.post("/adapter/security/integrity/baseline", ctx.requireAdmin, adapterRoute("POST", "/security/integrity/baseline"));

  // Fail2ban
  app.get("/adapter/security/fail2ban/status", ctx.requireAdmin, adapterRoute("GET", "/security/fail2ban"));
  app.post("/adapter/security/fail2ban/unban", ctx.requireAdmin, adapterRoute("POST", "/security/fail2ban/unban"));

  // UFW Firewall
  app.get("/adapter/security/firewall/rules", ctx.requireAdmin, adapterRoute("GET", "/security/firewall"));
  app.post("/adapter/security/firewall/rules", ctx.requireAdmin, adapterRoute("POST", "/security/firewall"));
  app.delete("/adapter/security/firewall/rules/:id", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/security/firewall/${req.params.id}`, { method: "DELETE" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });

  // SSH Keys
  app.get("/adapter/security/ssh-keys", ctx.requireAdmin, adapterRoute("GET", "/security/ssh-keys"));
  app.post("/adapter/security/ssh-keys", ctx.requireAdmin, adapterRoute("POST", "/security/ssh-keys"));
  app.delete("/adapter/security/ssh-keys/:fp", ctx.requireAdmin, async (req, res) => {
    try { res.json(await ctx.callAdapter(`/security/ssh-keys/${req.params.fp}`, { method: "DELETE" })); }
    catch (e) { res.status(502).json({ error: e.message, degraded: true }); }
  });

  // Security alerts
  app.get("/adapter/security/alerts", ctx.requireAdmin, adapterRoute("GET", "/security/alerts"));
};
