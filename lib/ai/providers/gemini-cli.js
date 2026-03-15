/**
 * Gemini CLI Provider — spawns `gemini`
 * Requires Gemini CLI installed
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

    // gemini -p "prompt"
    const safePrompt = fullPrompt.replace(/"/g, '\\"');
    const proc = spawn('gemini', ['-p', safePrompt], { env, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', function(d) { out += d; });
    proc.stderr.on('data', function(d) { /* ignore stderr */ });
    proc.stdin.on('error', function() {});
    proc.on('close', function() {
      // Try parse JSON output from gemini
      let text = out.trim();
      try {
        const parsed = JSON.parse(text);
        if (parsed.response) text = parsed.response;
      } catch {}
      resolve({ text: text || 'No response', model: opts.model || 'gemini-2.5-pro', provider: 'gemini-cli' });
    });
    proc.on('error', function(err) {
      reject(new Error('Gemini CLI not available: ' + err.message));
    });
    setTimeout(function() { try { proc.kill(); } catch {} resolve({ text: out.trim() || 'AI timeout', model: 'gemini-2.5-pro', provider: 'gemini-cli' }); }, timeout);
  });
}

async function isAvailable() {
  return new Promise(function(resolve) {
    const proc = spawn('gemini', ['--version'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', function(d) { out += d; });
    proc.on('close', function(code) { resolve(code === 0 && out.trim().length > 0); });
    proc.on('error', function() { resolve(false); });
    setTimeout(function() { try { proc.kill(); } catch {} resolve(false); }, 5000);
  });
}

module.exports = { chat, isAvailable };
