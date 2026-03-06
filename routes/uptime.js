const uptimeStore = require("../lib/uptime-store");

module.exports = function (app, ctx) {
  app.get("/api/uptime", ctx.requireAdmin, (req, res) => {
    const endpoints = uptimeStore.getEndpoints();
    const data = endpoints.map(ep => ({
      ...ep,
      uptime24h: uptimeStore.getUptimePercent(ep.id, 24),
      uptime7d: uptimeStore.getUptimePercent(ep.id, 168),
      uptime30d: uptimeStore.getUptimePercent(ep.id, 720),
      recentChecks: uptimeStore.getChecks(ep.id, 1).slice(-90), // last 90 checks for bar
    }));
    res.json({ endpoints: data });
  });

  app.get("/api/uptime/history/:id", ctx.requireAdmin, (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const checks = uptimeStore.getChecks(req.params.id, days);
    res.json({ checks });
  });

  app.post("/api/uptime/endpoints", ctx.requireAdmin, (req, res) => {
    const { name, url, interval, expectedStatus } = req.body;
    if (!name || !url) return res.status(400).json({ error: "name and url required" });
    const id = uptimeStore.addEndpoint({ name, url, interval, expectedStatus });
    res.json({ success: true, id });
  });

  app.delete("/api/uptime/endpoints/:id", ctx.requireAdmin, (req, res) => {
    uptimeStore.removeEndpoint(req.params.id);
    res.json({ success: true });
  });
};
