/**
 * Anthropic Provider — Direct Messages API via fetch
 * Requires ANTHROPIC_API_KEY env var or settings.json
 */
const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;

function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const file = path.join(__dirname, '..', '..', '..', 'data', 'settings.json');
    if (fs.existsSync(file)) {
      const s = JSON.parse(fs.readFileSync(file, 'utf8'));
      return s.anthropicApiKey || null;
    }
  } catch {}
  return null;
}

async function chat(prompt, opts = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No Anthropic API key configured');

  const model = opts.model || DEFAULT_MODEL;
  const messages = [{ role: 'user', content: prompt }];

  const body = {
    model,
    max_tokens: opts.maxTokens || DEFAULT_MAX_TOKENS,
    messages,
  };
  if (opts.systemPrompt) {
    body.system = opts.systemPrompt;
  }
  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 120000);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.content.map(c => c.text).join('');

    return {
      text,
      model: data.model,
      provider: 'claude-api',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function chatStream(prompt, onChunk, opts = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No Anthropic API key configured');

  const model = opts.model || DEFAULT_MODEL;
  const messages = [{ role: 'user', content: prompt }];

  const body = {
    model,
    max_tokens: opts.maxTokens || DEFAULT_MAX_TOKENS,
    messages,
    stream: true,
  };
  if (opts.systemPrompt) body.system = opts.systemPrompt;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 120000);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`);
    }

    let fullText = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullText += event.delta.text;
            if (onChunk) onChunk(event.delta.text);
          }
        } catch {}
      }
    }

    return { text: fullText, model, provider: 'claude-api' };
  } finally {
    clearTimeout(timer);
  }
}

async function isAvailable() {
  return !!getApiKey();
}

module.exports = { chat, chatStream, isAvailable, getApiKey };
