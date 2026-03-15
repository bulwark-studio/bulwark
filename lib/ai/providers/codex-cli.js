/**
 * Codex CLI Provider — spawns `codex`
 * Requires Codex CLI installed (npm i -g @openai/codex)
 */
const { spawn } = require('child_process');

async function chat(prompt, opts = {}) {
  const timeout = opts.timeout || 120000;

  return new Promise(function(resolve, reject) {
    const env = Object.assign({}, process.env);

    let fullPrompt = prompt;
    if (opts.systemPrompt) {
      fullPrompt = '[SYSTEM PROMPT]\n' + opts.systemPrompt + '\n---\n\n' + prompt;
    }

    const proc = spawn('codex', [], { env, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', function(d) { out += d; });
    proc.stderr.on('data', function(d) { out += d; });
    proc.stdin.on('error', function() {});
    proc.stdin.write(fullPrompt);
    proc.stdin.end();
    proc.on('close', function() {
      resolve({ text: out.trim() || 'No response', model: opts.model || 'codex', provider: 'codex-cli' });
    });
    proc.on('error', function(err) {
      reject(new Error('Codex CLI not available: ' + err.message));
    });
    setTimeout(function() { try { proc.kill(); } catch {} resolve({ text: out.trim() || 'AI timeout', model: 'codex', provider: 'codex-cli' }); }, timeout);
  });
}

async function isAvailable() {
  return new Promise(function(resolve) {
    const proc = spawn('codex', ['--version'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', function(d) { out += d; });
    proc.on('close', function(code) { resolve(code === 0 && out.trim().length > 0); });
    proc.on('error', function() { resolve(false); });
    setTimeout(function() { try { proc.kill(); } catch {} resolve(false); }, 5000);
  });
}

module.exports = { chat, isAvailable };
