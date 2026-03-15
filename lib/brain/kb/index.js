'use strict';

// Lazy-loaded KB data
let allEntries = null;
let indexById = null;
let indexByPort = null;
let indexByHttpCode = null;
let indexByService = null;

function ensureLoaded() {
  if (allEntries) return;

  allEntries = [];
  indexById = {};
  indexByPort = {};
  indexByHttpCode = {};
  indexByService = {};

  // Load all KB data files
  const dataFiles = [
    './devops-patterns',
    './cloud-aws',
    './cloud-gcp',
    './cloud-azure',
    './sysadmin',
    './database-ops',
    './security-ops',
    './cicd-patterns',
  ];

  for (const file of dataFiles) {
    try {
      const entries = require(file);
      for (const entry of entries) {
        allEntries.push(entry);
        if (entry.id) indexById[entry.id] = entry;
        if (entry.port) indexByPort[entry.port] = entry;
        if (entry.httpCode) indexByHttpCode[entry.httpCode] = entry;
        if (entry.service) indexByService[entry.service.toLowerCase()] = entry;
        // Index aliases
        if (entry.aliases) {
          for (const alias of entry.aliases) {
            indexByService[alias.toLowerCase()] = entry;
          }
        }
      }
    } catch (err) {
      console.log('[KB] Failed to load ' + file + ': ' + err.message);
    }
  }
}

function searchKB(query, options = {}) {
  ensureLoaded();
  const { maxResults = 5, domains } = options;
  if (!query || !allEntries.length) return [];

  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scored = [];

  for (const entry of allEntries) {
    if (domains && domains.length && !domains.includes(entry.domain)) continue;

    let score = 0;
    const haystack = [entry.title, entry.content, ...(entry.tags || [])].join(' ').toLowerCase();

    for (const term of terms) {
      if (entry.title.toLowerCase().includes(term)) score += 10;
      if (haystack.includes(term)) score += 3;
    }

    // Exact ID match
    if (entry.id && query.toUpperCase().includes(entry.id.toUpperCase())) score += 50;

    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(s => s.entry);
}

function lookupByPort(port) {
  ensureLoaded();
  return indexByPort[port] || null;
}

function lookupByHttpCode(code) {
  ensureLoaded();
  return indexByHttpCode[code] || null;
}

function lookupByService(service) {
  ensureLoaded();
  return indexByService[service.toLowerCase()] || null;
}

function lookupById(id) {
  ensureLoaded();
  return indexById[id] || null;
}

function getStats() {
  ensureLoaded();
  const byDomain = {};
  for (const e of allEntries) {
    byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  }
  return { totalEntries: allEntries.length, byDomain };
}

module.exports = { searchKB, lookupByPort, lookupByHttpCode, lookupByService, lookupById, getStats };
