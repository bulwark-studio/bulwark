const { getSystemInfo } = require("../lib/metrics-collector");

module.exports = function (app, ctx) {
  const { dbQuery } = ctx;

  async function getServerHealth() {
    const servers = [{ name: "Local Dev", host: "localhost", provider: "local", status: "healthy", latency: 0, system: getSystemInfo() }];

    // VPS_HOST — only add if explicitly configured via env
    const vpsHost = process.env.VPS_HOST;
    if (vpsHost) {
      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${vpsHost}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        servers.push({ name: process.env.VPS_NAME || "Remote Server", host: vpsHost, provider: "remote", status: res.ok ? "healthy" : "unhealthy", latency: Date.now() - start, commit: data.commit, db: data.db });
      } catch (e) {
        servers.push({ name: process.env.VPS_NAME || "Remote Server", host: vpsHost, provider: "remote", status: "unreachable", latency: -1, error: e.message });
      }
    }

    // Dynamic servers from DB
    const endpoints = await dbQuery(`SELECT id, name, host, provider, metadata FROM cloud_endpoints WHERE status = 'active'`);
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
