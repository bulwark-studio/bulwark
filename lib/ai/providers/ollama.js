/**
 * Ollama Provider — Uses ollama npm SDK v0.6.3
 * Default local LLM provider for Bulwark
 */
const { Ollama } = require('ollama');

// Singleton client with lazy init
let client = null;
let clientHost = null;

function getSettings() {
  // Read from data/settings.json
  try {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(__dirname, '..', '..', '..', 'data', 'settings.json');
    if (fs.existsSync(file)) {
      const s = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        baseUrl: s.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: s.ollamaModel || process.env.OLLAMA_MODEL || 'qwen3:8b',
        temperature: s.ollamaTemperature || 0.3,
      };
    }
  } catch {}
  return {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen3:8b',
    temperature: 0.3,
  };
}

function getClient() {
  const settings = getSettings();
  if (!client || clientHost !== settings.baseUrl) {
    client = new Ollama({ host: settings.baseUrl });
    clientHost = settings.baseUrl;
  }
  return client;
}

async function chat(prompt, opts = {}) {
  const settings = getSettings();
  const ollama = getClient();
  const model = opts.model || settings.model;

  const messages = [];
  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await ollama.chat({
    model,
    messages,
    stream: false,
    options: {
      temperature: opts.temperature || settings.temperature,
      num_predict: opts.maxTokens || 4096,
      num_ctx: opts.numCtx || 8192,
    },
  });

  return {
    text: response.message.content,
    model: model,
    provider: 'ollama',
    usage: {
      promptTokens: response.prompt_eval_count || 0,
      completionTokens: response.eval_count || 0,
    },
  };
}

async function chatStream(prompt, onChunk, opts = {}) {
  const settings = getSettings();
  const ollama = getClient();
  const model = opts.model || settings.model;

  const messages = [];
  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const stream = await ollama.chat({
    model,
    messages,
    stream: true,
    options: {
      temperature: opts.temperature || settings.temperature,
      num_predict: opts.maxTokens || 4096,
      num_ctx: opts.numCtx || 8192,
    },
  });

  let fullText = '';
  for await (const chunk of stream) {
    const text = chunk.message.content;
    fullText += text;
    if (onChunk) onChunk(text);
  }

  return { text: fullText, model, provider: 'ollama' };
}

async function isAvailable() {
  try {
    const ollama = getClient();
    await ollama.list();
    return true;
  } catch {
    return false;
  }
}

async function listModels() {
  try {
    const ollama = getClient();
    const list = await ollama.list();
    return list.models.map(m => m.name);
  } catch {
    return [];
  }
}

async function pullModel(model) {
  const ollama = getClient();
  await ollama.pull({ model });
}

module.exports = { chat, chatStream, isAvailable, listModels, pullModel, getSettings };
