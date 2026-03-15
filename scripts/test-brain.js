#!/usr/bin/env node
/**
 * Test: Brain System
 * Tests KB search, memory store/recall, profile CRUD, prompt building
 */

const path = require('path');
process.chdir(path.join(__dirname, '..'));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  \x1b[32m✓\x1b[0m ' + message);
    passed++;
  } else {
    console.log('  \x1b[31m✗\x1b[0m ' + message);
    failed++;
  }
}

console.log('\n\x1b[36m=== Brain System Tests ===\x1b[0m\n');

// Test 1: Brain module loads
console.log('Module Loading:');
try {
  const brain = require('../lib/brain');
  assert(typeof brain.brainChat === 'function', 'Brain has brainChat()');
  assert(typeof brain.getBrainStats === 'function', 'Brain has getBrainStats()');
  assert(typeof brain.searchKB === 'function', 'Brain has searchKB()');
} catch (e) {
  assert(false, 'Brain module loads: ' + e.message);
}

// Test 2: KB search
console.log('\nKnowledge Base:');
try {
  const kb = require('../lib/brain/kb');
  assert(typeof kb.searchKB === 'function', 'KB has searchKB()');
  assert(typeof kb.lookupByPort === 'function', 'KB has lookupByPort()');
  assert(typeof kb.lookupByHttpCode === 'function', 'KB has lookupByHttpCode()');
  assert(typeof kb.lookupByService === 'function', 'KB has lookupByService()');

  const stats = kb.getStats();
  assert(stats.totalEntries > 0, 'KB has ' + stats.totalEntries + ' entries loaded');
  assert(typeof stats.byDomain === 'object', 'KB stats has byDomain');

  // Test search
  const results = kb.searchKB('docker optimization', { maxResults: 5 });
  assert(Array.isArray(results), 'searchKB returns array');
  assert(results.length > 0, 'searchKB finds results for "docker optimization"');
  if (results.length > 0) {
    assert(results[0].id !== undefined, 'KB entry has id');
    assert(results[0].title !== undefined, 'KB entry has title');
    assert(results[0].content !== undefined, 'KB entry has content');
  }
} catch (e) {
  assert(false, 'KB search: ' + e.message);
}

// Test 3: Brain profile
console.log('\nBrain Profile:');
try {
  const profile = require('../lib/brain/brain-profile');
  assert(profile.DISCOVERY_QUESTIONS.length === 15, 'Has 15 discovery questions');

  const testUserId = 'test-user-' + Date.now();
  const p = profile.getOrCreateProfile(testUserId);
  assert(p.user_id === testUserId, 'Profile created with correct user_id');
  assert(p.completion_score === 0, 'New profile has 0% completion');
  assert(p.infrastructure !== undefined, 'Profile has infrastructure section');

  // Update profile
  const updated = profile.updateProfile(testUserId, {
    infrastructure: { cloud_providers: ['aws', 'gcp'] }
  });
  assert(updated.infrastructure.cloud_providers.length === 2, 'Profile updated with cloud providers');
  assert(updated.completion_score > 0, 'Completion score increased after update: ' + updated.completion_score + '%');

  // Get next question
  const nextQ = profile.getNextDiscoveryQuestion(updated);
  assert(nextQ !== null, 'Next discovery question returned');
  assert(nextQ.field !== 'infrastructure.cloud_providers', 'Next question is not already answered');

  // Profile summary
  const summary = profile.getProfileSummary(updated);
  assert(summary.includes('aws'), 'Summary includes cloud providers');

  // Extract profile from natural language
  const extracted = profile.extractProfileUpdates('We use AWS and Docker with PostgreSQL');
  assert(extracted !== null, 'Profile updates extracted from natural language');
  assert(extracted.infrastructure.cloud_providers.includes('aws'), 'Extracted AWS from text');

  // Cleanup
  const fs = require('fs');
  const profilesFile = path.join(__dirname, '..', 'data', 'brain-profiles.json');
  if (fs.existsSync(profilesFile)) {
    const all = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
    delete all[testUserId];
    fs.writeFileSync(profilesFile, JSON.stringify(all, null, 2));
  }
} catch (e) {
  assert(false, 'Brain profile: ' + e.message);
}

// Test 4: Memory system
console.log('\nMemory System:');
try {
  const memory = require('../lib/brain/memory');
  assert(memory.MEMORY_TYPES.length >= 5, 'Has ' + memory.MEMORY_TYPES.length + ' memory types');

  const testUserId = 'test-mem-' + Date.now();

  // Store memory
  const stored = memory.storeMemory({
    userId: testUserId,
    type: 'infrastructure_context',
    content: 'Test server runs Ubuntu 22.04 with PostgreSQL 16',
    confidence: 0.9,
    tags: ['linux', 'postgresql'],
  });
  assert(stored !== null, 'Memory stored successfully');
  assert(stored.hash !== undefined, 'Memory has hash for deduplication');

  // Store duplicate — should update, not create new
  const dup = memory.storeMemory({
    userId: testUserId,
    type: 'infrastructure_context',
    content: 'Test server runs Ubuntu 22.04 with PostgreSQL 16',
    confidence: 0.95,
  });
  assert(dup.confidence === 0.95, 'Duplicate updated confidence');

  // Recall memories
  const recalled = memory.recallMemories(testUserId, 'ubuntu postgresql server', { maxResults: 3 });
  assert(recalled.length > 0, 'recallMemories returns matching memories');
  assert(recalled[0].content.includes('PostgreSQL'), 'Recalled memory matches query');

  // Get memories
  const all = memory.getMemories(testUserId);
  assert(all.length === 1, 'One memory stored (dedup worked)');

  // Memory stats
  const stats = memory.getMemoryStats(testUserId);
  assert(stats.total === 1, 'Stats show 1 total memory');

  // Delete memory
  const deleted = memory.deleteMemory(testUserId, stored.id);
  assert(deleted === true, 'Memory deleted successfully');

  // Cleanup
  const fs = require('fs');
  const memFile = path.join(__dirname, '..', 'data', 'brain-memories.json');
  if (fs.existsSync(memFile)) {
    const allMem = JSON.parse(fs.readFileSync(memFile, 'utf8'));
    delete allMem[testUserId];
    fs.writeFileSync(memFile, JSON.stringify(allMem, null, 2));
  }
} catch (e) {
  assert(false, 'Memory system: ' + e.message);
}

// Test 5: Action catalog
console.log('\nAction Catalog:');
try {
  const catalog = require('../lib/brain/action-catalog');
  assert(catalog.ACTIONS.length >= 10, 'Has ' + catalog.ACTIONS.length + ' actions');

  const matches = catalog.matchIntent('optimize my docker containers');
  assert(matches.length > 0, 'matchIntent finds matches for "docker containers"');
  assert(matches[0].targetSection === 'docker', 'Top match targets docker section');

  const actions = catalog.getSuggestedActions('terminal');
  assert(Array.isArray(actions), 'getSuggestedActions returns array');
} catch (e) {
  assert(false, 'Action catalog: ' + e.message);
}

// Test 6: Section context
console.log('\nSection Context:');
try {
  const ctx = require('../lib/brain/section-context');
  assert(Object.keys(ctx.SECTIONS).length >= 15, 'Has ' + Object.keys(ctx.SECTIONS).length + ' section contexts');

  const docker = ctx.getSectionContext('docker');
  assert(docker !== null, 'Docker section context exists');
  assert(docker.name === 'Docker', 'Docker section has correct name');
  assert(docker.capabilities.length > 0, 'Docker section has capabilities');

  const brain = ctx.getSectionContext('brain');
  assert(brain !== null, 'Brain section context exists');
} catch (e) {
  assert(false, 'Section context: ' + e.message);
}

// Test 7: GCP KB coverage (v3.0)
console.log('\nGCP Knowledge Base (v3.0):');
try {
  const kb = require('../lib/brain/kb');
  const gcpIds = ['GCP-028', 'GCP-029', 'GCP-030', 'GCP-031', 'GCP-032', 'GCP-033', 'GCP-034', 'GCP-035', 'GCP-036', 'GCP-037', 'GCP-038', 'GCP-039', 'GCP-040', 'GCP-041', 'GCP-042'];
  const gcpQ = ['dataflow', 'dataproc', 'cloud tasks', 'cloud scheduler', 'bigtable', 'vertex ai', 'kms', 'security command center', 'app engine', 'gcloud', 'alloydb', 'vpc service controls', 'cloud interconnect', 'multi-region', 'quota'];
  let gcpFound = 0;
  for (let i = 0; i < gcpIds.length; i++) {
    const results = kb.searchKB(gcpQ[i], { maxResults: 3 });
    if (results.find(r => r.id === gcpIds[i])) gcpFound++;
  }
  assert(gcpFound === gcpIds.length, 'GCP KB: ' + gcpFound + '/' + gcpIds.length + ' v3.0 entries searchable');
} catch (e) {
  assert(false, 'GCP KB coverage: ' + e.message);
}

// Test 8: Full sidebar wiring (v3.0)
console.log('\nSidebar Wiring (v3.0):');
try {
  const catalog = require('../lib/brain/action-catalog');
  const ctx = require('../lib/brain/section-context');
  const sections = ['dashboard', 'metrics', 'uptime', 'agents', 'flows', 'mcp', 'servers', 'docker', 'databases', 'pm2', 'ssl', 'cloudflare', 'db-projects', 'sql-editor', 'tables', 'schema', 'migrations', 'roles', 'db-backups', 'db-assistant', 'terminal', 'tickets', 'git', 'github-hub', 'deploy', 'cron', 'files', 'envvars', 'calendar', 'notes', 'security', 'ftp', 'notifications', 'cache', 'logs', 'multi-server', 'settings', 'docs'];
  let wired = 0;
  for (const s of sections) {
    const hasCtx = ctx.getSectionContext(s) !== null;
    const hasAction = catalog.ACTIONS.some(a => a.targetSection === s);
    if (hasCtx && hasAction) wired++;
  }
  assert(wired === sections.length, 'All ' + sections.length + ' sidebar sections wired (' + wired + '/' + sections.length + ')');
} catch (e) {
  assert(false, 'Sidebar wiring: ' + e.message);
}

// Test 9: System prompt builder
console.log('\nSystem Prompt Builder:');
(async function () {
  try {
    const builder = require('../lib/brain/system-prompt-builder');
    const result = await builder.buildSystemPrompt({
      userId: 'test-builder',
      currentSection: 'docker',
      userQuery: 'how to optimize multi-stage builds',
    });
    assert(typeof result.systemPrompt === 'string', 'buildSystemPrompt returns systemPrompt string');
    assert(result.systemPrompt.includes('Bulwark Brain'), 'System prompt includes identity');
    assert(result.systemPrompt.includes('Docker'), 'System prompt includes Docker expertise');
    assert(result.systemPrompt.includes('Cloud Run'), 'System prompt includes GCP services (v3.0)');
    assert(result.tokenEstimate > 0, 'Token estimate is positive: ' + result.tokenEstimate);
    assert(Array.isArray(result.kbHits), 'Returns kbHits array');
    assert(Array.isArray(result.suggestedActions), 'Returns suggestedActions array');
  } catch (e) {
    assert(false, 'System prompt builder: ' + e.message);
  }

  console.log('\n\x1b[36m=== Results ===\x1b[0m');
  console.log('  Passed: \x1b[32m' + passed + '\x1b[0m');
  console.log('  Failed: \x1b[31m' + failed + '\x1b[0m');
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
})();
