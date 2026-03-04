const { spawn } = require("child_process");

module.exports = function (app, ctx) {
  const { io, dbQuery, REPO_DIR } = ctx;
  let activeClaudeProc = null;

  // Expose for socket events
  ctx.activeClaudeProc = () => activeClaudeProc;

  function runClaude(prompt) {
    if (activeClaudeProc) { io.emit("claude_output", "\r\n[ERROR] Claude already running.\r\n"); return; }
    io.emit("claude_output", `\r\n[STARTING] claude --print "${prompt.substring(0, 80)}..."\r\n\r\n`);
    const child = spawn("claude", ["--print", prompt], { cwd: REPO_DIR, env: { ...process.env }, shell: true });
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

  app.post("/api/claude/start", (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });
    if (activeClaudeProc) return res.status(409).json({ error: "Claude already running" });
    runClaude(prompt);
    res.json({ started: true });
  });

  app.post("/api/claude/stop", (req, res) => {
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
