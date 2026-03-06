const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function getAIProvider() {
  try {
    const f = path.join(__dirname, "..", "data", "settings.json");
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")).aiProvider || "claude-cli";
  } catch {}
  return "claude-cli";
}

function getAICommand(provider, prompt) {
  switch (provider) {
    case "codex-cli": return { cmd: "codex", args: [prompt] };
    case "claude-cli":
    default: return { cmd: "claude", args: ["--print", prompt] };
  }
}

module.exports = function (app, ctx) {
  const { io, dbQuery, REPO_DIR } = ctx;
  let activeClaudeProc = null;

  // Expose for socket events
  ctx.activeClaudeProc = () => activeClaudeProc;

  function runClaude(prompt) {
    const provider = getAIProvider();
    if (provider === "none") { io.emit("claude_output", "\r\n[INFO] AI provider is disabled. Configure in Settings > AI Provider.\r\n"); return; }
    if (activeClaudeProc) { io.emit("claude_output", "\r\n[ERROR] AI already running.\r\n"); return; }
    const { cmd, args } = getAICommand(provider, prompt);
    io.emit("claude_output", `\r\n[STARTING] ${cmd} "${prompt.substring(0, 80)}..."\r\n\r\n`);
    const child = spawn(cmd, args, { cwd: REPO_DIR, env: { ...process.env }, shell: true });
    activeClaudeProc = child;
    let output = "";
    child.stdout.on("data", (d) => { const t = d.toString(); output += t; io.emit("claude_output", t); });
    child.stderr.on("data", (d) => { const t = d.toString(); output += t; io.emit("claude_output", t); });
    child.on("close", (code) => {
      activeClaudeProc = null;
      io.emit("claude_done", { code, output, prompt });
      dbQuery(`INSERT INTO chester_activity (type, title, description, metadata) VALUES ($1, $2, $3, $4)`,
        ["claude_cli", `Claude CLI: ${prompt.substring(0, 100)}`, output.substring(0, 500), JSON.stringify({ code, prompt, output_length: output.length })]).catch(() => {});
    });
    child.on("error", (err) => { activeClaudeProc = null; io.emit("claude_output", `\r\n[ERROR] ${err.message}\r\n`); io.emit("claude_done", { code: 1, output: err.message, prompt }); });
  }

  ctx.runClaude = runClaude;

  app.post("/api/claude/start", ctx.requireRole('editor'), (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });
    if (activeClaudeProc) return res.status(409).json({ error: "Claude already running" });
    runClaude(prompt);
    res.json({ started: true });
  });

  // Bulwark AI — conversational assistant (used by floating terminal)
  app.post("/api/bulwark/ask", ctx.requireAdmin, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });
    const provider = getAIProvider();
    if (provider === "none") return res.json({ response: "AI provider is disabled. Configure in Settings > AI Provider.", fallback: true });
    try {
      const neuralCache = require('../lib/neural-cache');
      const cached = neuralCache.semanticGet(prompt);
      if (cached) return res.json({ response: cached.response, cached: true });

      const { cmd } = getAICommand(provider, prompt);
      const cleanEnv = { ...process.env };
      delete cleanEnv.CLAUDECODE;
      const result = await new Promise((resolve, reject) => {
        const child = spawn(cmd, provider === "codex-cli" ? [] : ["--print"], { stdio: ["pipe", "pipe", "pipe"], shell: true, timeout: 30000, env: cleanEnv });
        let stdout = "", stderr = "";
        child.stdout.on("data", d => { stdout += d; });
        child.stderr.on("data", d => { stderr += d; });
        child.on("close", code => resolve({ stdout, stderr, code }));
        child.on("error", reject);
        child.stdin.on("error", () => {});
        child.stdin.write(prompt);
        child.stdin.end();
      });

      const response = result.stdout.trim() || result.stderr.trim() || "Analysis unavailable";
      if (result.code === 0 && result.stdout.trim()) {
        neuralCache.semanticSet(prompt, response);
      }
      res.json({ response, cached: false });
    } catch (e) {
      res.json({ response: "Bulwark is temporarily unavailable: " + e.message, fallback: true });
    }
  });

  app.post("/api/claude/stop", ctx.requireRole('editor'), (req, res) => {
    if (activeClaudeProc) {
      activeClaudeProc.kill("SIGTERM");
      activeClaudeProc = null;
      io.emit("claude_output", "\r\n[STOPPED]\r\n");
      res.json({ stopped: true });
    } else {
      res.json({ stopped: false });
    }
  });
};
