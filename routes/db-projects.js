const { v4: uuidv4 } = require("crypto").webcrypto ?
  { v4: () => require("crypto").randomUUID() } :
  { v4: () => require("crypto").randomUUID() };

const { readProjects, writeProjects, makePool, invalidateProjectPool } = require("../lib/db");

module.exports = function (app, ctx) {
  const { requireAdmin } = ctx;

  // GET /api/db/projects — list all projects (url masked)
  app.get("/api/db/projects", requireAdmin, (req, res) => {
    const projects = readProjects().map(p => ({
      ...p,
      url: maskUrl(p.url),
    }));
    res.json({ projects });
  });

  // POST /api/db/projects — create project
  app.post("/api/db/projects", requireAdmin, (req, res) => {
    const { name, url, color, description, ssl } = req.body;
    if (!name || !url) return res.status(400).json({ error: "name and url required" });

    const projects = readProjects();
    // Check for duplicate name
    if (projects.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: "Project name already exists" });
    }
    // Warn on duplicate URL (same DB connection)
    const normalizedUrl = url.trim().replace(/\/+$/, "");
    const dupeUrl = projects.find(p => p.url.replace(/\/+$/, "") === normalizedUrl);
    if (dupeUrl && !req.query.force) {
      return res.status(409).json({ error: "Same database URL as project '" + dupeUrl.name + "'. Add ?force=true to create anyway.", duplicate: dupeUrl.name });
    }

    const project = {
      id: require("crypto").randomUUID(),
      name: name.trim(),
      url: url.trim(),
      color: color || "#22d3ee",
      description: description || "",
      ssl: ssl === true || ssl === "true",
      createdAt: new Date().toISOString(),
    };

    projects.push(project);
    writeProjects(projects);

    // Return with url masked
    res.json({ project: { ...project, url: maskUrl(project.url) } });
  });

  // PUT /api/db/projects/:id — update project
  app.put("/api/db/projects/:id", requireAdmin, (req, res) => {
    const projects = readProjects();
    const idx = projects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Project not found" });

    const { name, url, color, description, ssl } = req.body;
    if (name) projects[idx].name = name.trim();
    if (url) projects[idx].url = url.trim();
    if (color) projects[idx].color = color;
    if (description !== undefined) projects[idx].description = description;
    if (ssl !== undefined) projects[idx].ssl = ssl === true || ssl === "true";

    writeProjects(projects);
    // Invalidate cached pool so it reconnects with new URL
    invalidateProjectPool(req.params.id);

    res.json({ project: { ...projects[idx], url: maskUrl(projects[idx].url) } });
  });

  // DELETE /api/db/projects/:id — delete project
  app.delete("/api/db/projects/:id", requireAdmin, (req, res) => {
    const projects = readProjects();
    const idx = projects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Project not found" });

    invalidateProjectPool(req.params.id);
    projects.splice(idx, 1);
    writeProjects(projects);
    res.json({ ok: true });
  });

  // POST /api/db/projects/:id/test — test connection
  app.post("/api/db/projects/:id/test", requireAdmin, async (req, res) => {
    const projects = readProjects();
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    try {
      const p = makePool(project);
      const result = await p.query("SELECT current_database() as db, version() as ver");
      await p.end();
      res.json({
        ok: true,
        database: result.rows[0].db,
        version: result.rows[0].ver.split(" ").slice(0, 2).join(" "),
      });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });
};

function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return url.replace(/:([^:@/]+)@/, ":****@");
  }
}
