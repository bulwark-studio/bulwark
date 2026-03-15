'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEMORIES_FILE = path.join(__dirname, '..', '..', 'data', 'brain-memories.json');
const MAX_MEMORIES_PER_USER = 500;

const MEMORY_TYPES = [
  'infrastructure_context',
  'deployment_context',
  'user_preference',
  'execution_evidence',
  'performance_note',
  'incident_note',
  'config_context',
];

function loadMemories() {
  try { if (fs.existsSync(MEMORIES_FILE)) return JSON.parse(fs.readFileSync(MEMORIES_FILE, 'utf8')); } catch {}
  return {};
}

function saveMemories(allMemories) {
  const dir = path.dirname(MEMORIES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = MEMORIES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(allMemories, null, 2));
  fs.renameSync(tmp, MEMORIES_FILE);
}

function storeMemory({ userId, type, content, confidence = 0.8, source = 'chat', tags = [] }) {
  if (!content || !userId) return null;
  const allMemories = loadMemories();
  if (!allMemories[userId]) allMemories[userId] = [];

  const hash = crypto.createHash('sha1').update(content.toLowerCase().trim()).digest('hex').slice(0, 16);
  const existing = allMemories[userId].find(m => m.hash === hash);
  if (existing) {
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.updated_at = new Date().toISOString();
    saveMemories(allMemories);
    return existing;
  }

  const memory = {
    id: crypto.randomUUID(), hash, user_id: userId,
    type: MEMORY_TYPES.includes(type) ? type : 'infrastructure_context',
    content: content.trim(), confidence, source, tags,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  allMemories[userId].push(memory);
  if (allMemories[userId].length > MAX_MEMORIES_PER_USER) {
    allMemories[userId].sort((a, b) => b.confidence - a.confidence);
    allMemories[userId] = allMemories[userId].slice(0, MAX_MEMORIES_PER_USER);
  }

  saveMemories(allMemories);
  return memory;
}

function recallMemories(userId, query, options = {}) {
  const { types, maxResults = 5, minConfidence = 0.3 } = options;
  const allMemories = loadMemories();
  const userMemories = allMemories[userId] || [];
  if (!userMemories.length || !query) return [];

  const now = Date.now();
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scored = [];
  for (const memory of userMemories) {
    if (memory.confidence < minConfidence) continue;
    if (types && types.length && !types.includes(memory.type)) continue;

    let score = 0;
    const haystack = [memory.content, ...(memory.tags || [])].join(' ').toLowerCase();
    for (const term of terms) { if (haystack.includes(term)) score += 3; }

    const typePriority = { infrastructure_context: 1.5, user_preference: 1.4, deployment_context: 1.3, config_context: 1.2, performance_note: 1.1, incident_note: 1.0, execution_evidence: 0.9 };
    score *= (typePriority[memory.type] || 1.0);
    score *= memory.confidence;

    const age = now - new Date(memory.created_at).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) score *= 1.5;
    else if (age < 30 * 24 * 60 * 60 * 1000) score *= 1.2;

    if (score > 0) scored.push({ memory, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(s => s.memory);
}

function extractMemories(userId, userMessage, assistantResponse, sectionContext) {
  const extracted = [];
  const combined = userMessage + ' ' + assistantResponse;

  // IPs
  const ips = combined.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  if (ips) {
    for (const ip of [...new Set(ips)]) {
      if (ip === '127.0.0.1' || ip === '0.0.0.0' || ip.startsWith('192.168.') || ip.startsWith('10.')) continue;
      extracted.push({ userId, type: 'infrastructure_context', content: 'IP address mentioned: ' + ip + ' (context: ' + (sectionContext || 'chat') + ')', confidence: 0.6, tags: ['ip', 'network'] });
    }
  }

  // Domains
  const domains = combined.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|io|dev|co|app)\b/gi);
  if (domains) {
    for (const domain of [...new Set(domains)]) {
      if (['github.com', 'google.com', 'ollama.com', 'docker.com', 'npmjs.com'].includes(domain.toLowerCase())) continue;
      extracted.push({ userId, type: 'infrastructure_context', content: 'Domain mentioned: ' + domain, confidence: 0.6, tags: ['domain', 'network'] });
    }
  }

  // User preferences from user message
  const prefPatterns = [
    { pattern: /prefer\s+(concise|detailed|brief|verbose|executive)/i, type: 'user_preference' },
    { pattern: /we\s+use\s+(aws|gcp|azure|docker|kubernetes|k8s)/i, type: 'infrastructure_context' },
    { pattern: /our\s+(?:main\s+)?(?:stack|database|db)\s+(?:is|includes|uses)\s+(.+)/i, type: 'infrastructure_context' },
    { pattern: /running\s+on\s+(ubuntu|debian|rhel|centos|alpine)/i, type: 'infrastructure_context' },
    { pattern: /deploy(?:ing)?\s+(?:to|on|with)\s+(.+)/i, type: 'deployment_context' },
  ];

  for (const { pattern, type } of prefPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      extracted.push({ userId, type, content: match[0], confidence: 0.9, source: 'user', tags: ['preference'] });
    }
  }

  for (const mem of extracted) { storeMemory(mem); }
  return extracted;
}

function getMemories(userId, options = {}) {
  const { type, limit = 50 } = options;
  const allMemories = loadMemories();
  let userMemories = allMemories[userId] || [];
  if (type) userMemories = userMemories.filter(m => m.type === type);
  userMemories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return userMemories.slice(0, limit);
}

function deleteMemory(userId, memoryId) {
  const allMemories = loadMemories();
  if (!allMemories[userId]) return false;
  const before = allMemories[userId].length;
  allMemories[userId] = allMemories[userId].filter(m => m.id !== memoryId);
  if (allMemories[userId].length < before) { saveMemories(allMemories); return true; }
  return false;
}

function getMemoryStats(userId) {
  const allMemories = loadMemories();
  const userMemories = allMemories[userId] || [];
  const byType = {};
  for (const m of userMemories) { byType[m.type] = (byType[m.type] || 0) + 1; }
  return { total: userMemories.length, byType };
}

module.exports = { MEMORY_TYPES, storeMemory, recallMemories, extractMemories, getMemories, deleteMemory, getMemoryStats };
