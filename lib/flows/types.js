'use strict';

// Flow node types
const NODE_TYPES = ['start', 'end', 'llm', 'agent', 'condition', 'delay', 'http', 'notify'];

// Flow statuses
const FLOW_STATUSES = ['draft', 'active', 'paused', 'archived', 'error'];

// Flow categories
const FLOW_CATEGORIES = ['general', 'devops', 'monitoring', 'security', 'database', 'deployment'];

// Trigger types
const TRIGGER_TYPES = ['manual', 'schedule', 'webhook', 'event'];

// Error strategies
const ERROR_STRATEGIES = ['stop', 'skip', 'retry'];

// Run statuses
const RUN_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'];

// Default timeout (5 minutes)
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// Max retry count for retry error strategy
const MAX_RETRIES = 3;

module.exports = {
  NODE_TYPES,
  FLOW_STATUSES,
  FLOW_CATEGORIES,
  TRIGGER_TYPES,
  ERROR_STRATEGIES,
  RUN_STATUSES,
  DEFAULT_TIMEOUT_MS,
  MAX_RETRIES,
};
