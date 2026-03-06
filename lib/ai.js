/**
 * AI Provider Wrapper — Routes to configured CLI (Claude/Codex/None)
 * Reads provider from data/settings.json
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

function getProvider() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')).aiProvider || 'claude-cli';
  } catch {}
  return 'claude-cli';
}

/**
 * Ask AI a question and get raw text back
 * @param {string} prompt
 * @param {object} opts - { timeout: ms }
 * @returns {Promise<string>}
 */
function askAI(prompt, opts = {}) {
  const provider = getProvider();
  if (provider === 'none') return Promise.resolve('AI provider is disabled. Configure in Settings > AI Provider.');

  const timeout = opts.timeout || 30000;

  return new Promise(function (resolve) {
    var env = Object.assign({}, process.env);
    delete env.CLAUDECODE;

    var cmd, args;
    if (provider === 'codex-cli') {
      cmd = 'codex';
      args = [];
    } else {
      cmd = 'claude';
      args = ['--print'];
    }

    var proc = spawn(cmd, args, { env: env, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    var out = '';
    proc.stdout.on('data', function (d) { out += d; });
    proc.stderr.on('data', function (d) { out += d; });
    proc.stdin.on('error', function () {});
    proc.stdin.write(prompt);
    proc.stdin.end();
    proc.on('close', function () { resolve(out.trim() || 'No response from AI'); });
    proc.on('error', function () { resolve('AI CLI not available. Install ' + cmd + ' and try again.'); });
    setTimeout(function () { try { proc.kill(); } catch {} resolve(out.trim() || 'AI timeout'); }, timeout);
  });
}

/**
 * Ask AI and parse JSON response with fallback extraction
 * @param {string} prompt
 * @param {object} opts - { timeout: ms }
 * @returns {Promise<object>}
 */
async function askAIJSON(prompt, opts = {}) {
  const provider = getProvider();
  if (provider === 'none') return { error: 'AI provider is disabled' };

  try {
    const raw = await askAI(prompt, { timeout: opts.timeout || 45000 });
    const jsonStr = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
    try {
      return JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrMatch) return JSON.parse(arrMatch[0]);
      return { error: 'Could not parse AI response', raw: raw.substring(0, 500) };
    }
  } catch (e) {
    return { error: 'AI unavailable: ' + e.message };
  }
}

/**
 * Ask AI via execCommand (for routes that use the exec pattern)
 * Returns the CLI command string to execute
 */
function getAICommand(prompt) {
  const provider = getProvider();
  if (provider === 'codex-cli') return `codex "${prompt}"`;
  return `claude --print "${prompt}"`;
}

module.exports = { getProvider, askAI, askAIJSON, getAICommand };
