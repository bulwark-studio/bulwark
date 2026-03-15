/**
 * Claude CLI Provider — spawns `claude --print`
 * Requires Claude CLI installed (npm i -g @anthropic-ai/claude-code)
 */
const { spawn } = require('child_process');

async function chat(prompt, opts = {}) {
  const timeout = opts.timeout || 120000;

  return new Promise(function(resolve, reject) {
    const env = Object.assign({}, process.env);
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE;

    const args = ['--print'];
    if (opts.model) args.push('--model', opts.model);

    // If systemPrompt, prepend to prompt
    let fullPrompt = prompt;
    if (opts.systemPrompt) {
      fullPrompt = '[SYSTEM PROMPT]\n' + opts.systemPrompt + '\n---\n\n' + prompt;
    }

    const proc = spawn('claude', args, { env, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', function(d) { out += d; });
    proc.stderr.on('data', function(d) { out += d; });
    proc.stdin.on('error', function() {});
    proc.stdin.write(fullPrompt);
    proc.stdin.end();
    proc.on('close', function() {
      resolve({ text: out.trim() || 'No response', model: opts.model || 'sonnet', provider: 'claude-cli' });
    });
    proc.on('error', function(err) {
      reject(new Error('Claude CLI not available: ' + err.message));
    });
    setTimeout(function() { try { proc.kill(); } catch {} resolve({ text: out.trim() || 'AI timeout', model: 'sonnet', provider: 'claude-cli' }); }, timeout);
  });
}

async function isAvailable() {
  return new Promise(function(resolve) {
    const proc = spawn('claude', ['--version'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', function(d) { out += d; });
    proc.on('close', function(code) { resolve(code === 0 && out.trim().length > 0); });
    proc.on('error', function() { resolve(false); });
    setTimeout(function() { try { proc.kill(); } catch {} resolve(false); }, 5000);
  });
}

module.exports = { chat, isAvailable };
