const { getSystemInfo } = require("../lib/metrics-collector");

module.exports = function (app, ctx) {
  const { dbQuery } = ctx;
  const VPS_HOST = process.env.VPS_HOST || "https://admin.autopilotaitech.com";

  async function getServerHealth() {
    const servers = [{ name: "Local Dev", host: "localhost", provider: "local", status: "healthy", latency: 0, system: getSystemInfo() }];

    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${VPS_HOST}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      servers.push({ name: "AWS Production", host: VPS_HOST, provider: "aws", status: res.ok ? "healthy" : "unhealthy", latency: Date.now() - start, commit: data.commit, db: data.db });
    } catch (e) {
      servers.push({ name: "AWS Production", host: VPS_HOST, provider: "aws", status: "unreachable", latency: -1, error: e.message });
    }

    const endpoints = await dbQuery(`SELECT id, name, host, provider, metadata FROM cloud_endpoints WHERE status = 'active' AND provider NOT IN ('vps', 'aws')`);
    for (const ep of endpoints) {
      try {
        const url = ep.host.startsWith("http") ? ep.host : `https://${ep.host}`;
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${url}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        servers.push({ name: ep.name, host: ep.host, provider: ep.provider, status: res.ok ? "healthy" : "unhealthy", latency: Date.now() - start });
      } catch (e) {
        servers.push({ name: ep.name, host: ep.host, provider: ep.provider, status: "unreachable", latency: -1, error: e.message });
      }
    }
    return servers;
  }

  ctx.getServerHealth = getServerHealth;

  app.get("/api/servers", async (req, res) => res.json({ servers: await getServerHealth() }));
};
