const fs = require("fs");
const path = require("path");

module.exports = function (app, ctx) {
  const REPO_DIR = ctx.REPO_DIR;
  const REPO_ROOT = path.resolve(REPO_DIR);

  function isWithinRepo(resolved) {
    const relative = path.relative(REPO_ROOT, resolved);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  }

  function safePath(reqPath) {
    const resolved = path.resolve(REPO_DIR, reqPath || ".");
    if (!isWithinRepo(resolved)) return null;
    // Block sensitive files
    const blocked = [".env.local", "users.json", ".git/config"];
    const relative = path.relative(REPO_ROOT, resolved).replace(/\\/g, "/");
    if (blocked.includes(relative)) return null;
    return resolved;
  }

  app.get("/api/files/browse", ctx.requireAdmin, (req, res) => {
    const dir = safePath(req.query.path || ".");
    if (!dir) return res.status(403).json({ error: "Access denied" });
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true }).map(e => ({
        name: e.name, type: e.isDirectory() ? "dir" : "file",
        size: e.isDirectory() ? null : fs.statSync(path.join(dir, e.name)).size,
        modified: fs.statSync(path.join(dir, e.name)).mtime.toISOString(),
      })).sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      res.json({ path: path.relative(REPO_DIR, dir) || ".", entries });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/files/read", ctx.requireAdmin, (req, res) => {
    const file = safePath(req.query.path);
    if (!file) return res.status(403).json({ error: "Access denied" });
    try {
      const stat = fs.statSync(file);
      if (stat.size > 2 * 1024 * 1024) return res.status(413).json({ error: "File too large (max 2MB)" });
      const content = fs.readFileSync(file, "utf8");
      res.json({ path: path.relative(REPO_DIR, file), content, size: stat.size });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/files/write", ctx.requireAdmin, (req, res) => {
    const { filePath, content } = req.body;
    const file = safePath(filePath);
    if (!file) return res.status(403).json({ error: "Access denied" });
    try {
      fs.writeFileSync(file, content, "utf8");
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/files/create", ctx.requireAdmin, (req, res) => {
    const { filePath, type } = req.body;
    const target = safePath(filePath);
    if (!target) return res.status(403).json({ error: "Access denied" });
    try {
      if (type === "dir") fs.mkdirSync(target, { recursive: true });
      else fs.writeFileSync(target, "", "utf8");
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/files/delete", ctx.requireAdmin, (req, res) => {
    const target = safePath(req.query.path);
    if (!target) return res.status(403).json({ error: "Access denied" });
    try {
      fs.rmSync(target, { recursive: true, force: true });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/files/rename", ctx.requireAdmin, (req, res) => {
    const { oldPath, newPath } = req.body;
    const src = safePath(oldPath);
    const dest = safePath(newPath);
    if (!src || !dest) return res.status(403).json({ error: "Access denied" });
    try {
      fs.renameSync(src, dest);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};
