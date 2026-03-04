const { spawn } = require("child_process");
const os = require("os");
const path = require("path");

const REPO_DIR = process.env.REPO_DIR || path.resolve(__dirname, "../../admin");

function execCommand(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const shell = os.platform() === "win32" ? "cmd" : "bash";
    const shellFlag = os.platform() === "win32" ? "/c" : "-c";
    const child = spawn(shell, [shellFlag, cmd], {
      cwd: opts.cwd || REPO_DIR,
      timeout: opts.timeout || 15000,
      env: { ...process.env },
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    child.on("error", reject);
  });
}

module.exports = { execCommand, REPO_DIR };
