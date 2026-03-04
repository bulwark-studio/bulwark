const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const AGENTS_FILE = path.join(__dirname, "..", "data", "agents.json");

function loadAgents() {
  try { if (fs.existsSync(AGENTS_FILE)) return JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8")); } catch {}
  return { agents: [] };
}

function saveAgents(data) {
  fs.mkdirSync(path.dirname(AGENTS_FILE), { recursive: true });
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(data, null, 2), "utf8");
}

module.exports = function (app, ctx) {
  app.get("/api/multi-server/agents", ctx.requireAdmin, (req, res) => {
    const data = loadAgents();
    res.json({ agents: data.agents.map(a => ({ ...a, authKey: "••••" + (a.authKey || "").slice(-4) })) });
  });

  app.post("/api/multi-server/agents", ctx.requireAdmin, (req, res) => {
    const { name, host, authKey } = req.body;
    if (!name || !host) return res.status(400).json({ error: "name and host required" });
    const data = loadAgents();
    const agent = { id: crypto.randomUUID(), name, host, authKey: authKey || "", status: "unknown", created: new Date().toISOString() };
    data.agents.push(agent);
    saveAgents(data);
    res.json({ success: true, agent: { ...agent, authKey: "••••" } });
  });

  app.delete("/api/multi-server/agents/:id", ctx.requireAdmin, (req, res) => {
    const data = loadAgents();
    data.agents = data.agents.filter(a => a.id !== req.params.id);
    saveAgents(data);
    res.json({ success: true });
  });

  app.get("/api/multi-server/agents/:id/health", ctx.requireAdmin, async (req, res) => {
    const data = loadAgents();
    const agent = data.agents.find(a => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(`${agent.host}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const body = await r.json();
      agent.status = r.ok ? "healthy" : "unhealthy";
      agent.lastCheck = new Date().toISOString();
      agent.latency = Date.now() - start;
      saveAgents(data);
      res.json({ status: agent.status, latency: agent.latency, data: body });
    } catch (e) {
      agent.status = "unreachable";
      agent.lastCheck = new Date().toISOString();
      saveAgents(data);
      res.json({ status: "unreachable", error: e.message });
    }
  });

  app.get("/api/multi-server/overview", ctx.requireAdmin, async (req, res) => {
    const data = loadAgents();
    const results = [];
    for (const agent of data.agents) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const start = Date.now();
        const r = await fetch(`${agent.host}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        results.push({ ...agent, authKey: undefined, status: r.ok ? "healthy" : "unhealthy", latency: Date.now() - start });
      } catch {
        results.push({ ...agent, authKey: undefined, status: "unreachable", latency: -1 });
      }
    }
    res.json({ agents: results });
  });
};
