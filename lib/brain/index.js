'use strict';
const { buildSystemPrompt } = require('./system-prompt-builder');
const { searchKB, lookupByPort, lookupByHttpCode, lookupByService } = require('./kb');
const { extractMemories } = require('./memory');
const { extractProfileUpdates, updateProfile, getOrCreateProfile } = require('./brain-profile');
const { matchIntent } = require('./action-catalog');
const { askAI } = require('../ai');

async function brainChat(message, options = {}) {
  const { userId = 'default', sectionContext, conversationHistory = [] } = options;

  // 1. Direct KB lookup
  const directAnswer = tryDirectKBAnswer(message);
  if (directAnswer) {
    setImmediate(() => { try { extractMemories(userId, message, directAnswer.response, sectionContext); } catch (e) { console.error('[BRAIN] Memory extraction failed:', e.message); } });
    return directAnswer;
  }

  // 2. Build enriched system prompt
  const promptCtx = await buildSystemPrompt({ userId, currentSection: sectionContext, userQuery: message });

  // 3. Build conversation with history
  const fullPrompt = buildConversationPrompt(message, conversationHistory, promptCtx.systemPrompt);

  // 4. Call AI provider
  let response;
  try {
    response = await askAI(fullPrompt, { includeSystemPrompt: false, systemPrompt: promptCtx.systemPrompt, timeout: 60000, routeKey: 'brain' });
  } catch { response = null; }

  // 5. KB fallback if LLM failed
  if (!response && promptCtx.kbHits.length) {
    response = 'Here is what I found in the Bulwark Knowledge Base:\n';
    for (const entry of promptCtx.kbHits.slice(0, 5)) {
      response += '\n**[' + entry.id + '] ' + entry.title + '**\n' + entry.content + '\n';
      if (entry.fix) response += '\n_Fix:_ ' + entry.fix + '\n';
    }
  } else if (!response) {
    response = 'No AI provider is configured. Go to **Settings** to set up Ollama or an API key.\n\nMeanwhile, try asking about specific topics — I can answer from my built-in knowledge base.\nExamples: "port 443", "HTTP 502", "Docker layer caching", "PostgreSQL vacuum"';
  }

  // 6. Extract profile updates
  const profileUpdates = extractProfileUpdates(message);
  if (profileUpdates) updateProfile(userId, profileUpdates);

  // 7. Extract memories async
  setImmediate(() => { try { extractMemories(userId, message, response || '', sectionContext); } catch (e) { console.error('[BRAIN] Memory extraction failed:', e.message); } });

  return {
    response: response || 'I was unable to generate a response. Please try rephrasing.',
    sources: promptCtx.kbHits,
    suggestedActions: promptCtx.suggestedActions,
    memories: promptCtx.memoriesUsed,
    discoveryQuestion: promptCtx.discoveryQuestion,
    profileCompletion: promptCtx.profileCompletion,
  };
}

function tryDirectKBAnswer(message) {
  if (!message) return null;

  // Port lookup: "port 443", "what runs on port 22"
  const portMatch = message.match(/\bport\s+(\d+)\b/i);
  if (portMatch) {
    const entry = lookupByPort(parseInt(portMatch[1]));
    if (entry) return formatKBDirectAnswer(entry);
  }

  // HTTP code: "HTTP 502", "what is 404", "error 503"
  const httpMatch = message.match(/\b(?:http\s*|error\s*|status\s*)?([45]\d{2})\b/i);
  if (httpMatch) {
    const entry = lookupByHttpCode(parseInt(httpMatch[1]));
    if (entry) return formatKBDirectAnswer(entry);
  }

  // Service lookup: "what is nginx", "explain redis"
  const serviceMatch = message.match(/\b(?:what is|explain|about)\s+(\w+)\b/i);
  if (serviceMatch) {
    const entry = lookupByService(serviceMatch[1].toLowerCase());
    if (entry) return formatKBDirectAnswer(entry);
  }

  return null;
}

function formatKBDirectAnswer(entry) {
  let response = '**[KB: ' + entry.id + '] ' + entry.title + '**\n\n' + entry.content;
  if (entry.fix) response += '\n\n**Fix:** ' + entry.fix;
  if (entry.bestPractice) response += '\n\n**Best Practice:** ' + entry.bestPractice;
  if (entry.tags && entry.tags.length) response += '\n\n**Tags:** ' + entry.tags.join(', ');

  const actions = matchIntent(entry.title + ' ' + (entry.tags || []).join(' '));
  return {
    response,
    sources: [entry],
    suggestedActions: actions.slice(0, 3),
    memories: [],
    discoveryQuestion: null,
    profileCompletion: null,
    fromKB: true,
  };
}

function buildConversationPrompt(message, history, systemPrompt) {
  const recentHistory = history.slice(-6);
  if (!recentHistory.length) return message;
  const historyText = recentHistory.map(m => (m.role === 'user' ? 'User' : 'Assistant') + ': ' + m.content).join('\n\n');
  return 'Previous conversation:\n' + historyText + '\n\nUser: ' + message;
}

function getBrainStats(userId) {
  const profile = getOrCreateProfile(userId);
  const { getStats: getKBStats } = require('./kb');
  const { getMemoryStats } = require('./memory');
  return {
    kb: getKBStats(),
    profile: { completion: profile.completion_score, industry: profile.infrastructure?.cloud_providers?.join(', ') || null },
    memory: getMemoryStats(userId),
  };
}

module.exports = { brainChat, getBrainStats, tryDirectKBAnswer, searchKB };
