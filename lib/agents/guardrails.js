'use strict';

// Destructive command patterns to block
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /mkfs\b/i,
  /dd\s+if=.*of=\/dev/i,
  /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/,  // fork bomb
  /format\s+c:/i,
  /drop\s+(database|table|schema)\b/i,
  /truncate\s+table\b/i,
  /delete\s+from\s+\w+\s*(;|$)/i,  // DELETE without WHERE
  /shutdown\s+(now|-h|-r)/i,
  /init\s+0\b/i,
  />\s*\/dev\/sd[a-z]/i,
  /chmod\s+-R\s+777\s+\//i,
  /curl.*\|\s*(bash|sh)\b/i,  // piped shell execution
];

// Prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?prior/i,
  /you\s+are\s+now\s+/i,
  /forget\s+(everything|all|your)\s+(instructions|rules|training)/i,
  /reveal\s+(your\s+)?system\s+prompt/i,
  /jailbreak/i,
  /\bDAN\b.*mode/i,
];

// Secret patterns to redact
const SECRET_PATTERNS = [
  { pattern: /\b(AKIA[A-Z0-9]{16})\b/g, replacement: '[AWS_KEY_REDACTED]' },
  { pattern: /\b(sk-[a-zA-Z0-9]{32,})\b/g, replacement: '[API_KEY_REDACTED]' },
  { pattern: /\b(ghp_[a-zA-Z0-9]{36})\b/g, replacement: '[GITHUB_TOKEN_REDACTED]' },
  { pattern: /\b(glpat-[a-zA-Z0-9]{20,})\b/g, replacement: '[GITLAB_TOKEN_REDACTED]' },
  { pattern: /\b(xox[bpsar]-[a-zA-Z0-9-]{10,})\b/g, replacement: '[SLACK_TOKEN_REDACTED]' },
  { pattern: /(password|passwd|pwd)\s*[=:]\s*['"]?([^\s'"]{8,})/gi, replacement: '$1=[REDACTED]' },
  { pattern: /\b([a-zA-Z0-9+/]{40,}={0,2})\b/g, replacement: function(match) {
    // Only redact if it looks like a base64 key (high entropy)
    if (match.length > 60 && /[A-Z]/.test(match) && /[a-z]/.test(match) && /[0-9]/.test(match)) return '[POSSIBLE_KEY_REDACTED]';
    return match;
  }},
];

/**
 * Evaluate input against guardrails
 * @returns {{ blocked: boolean, reason: string|null, warnings: string[], sanitizedInput: string }}
 */
function evaluateGuardrails(input, agent = {}) {
  const result = {
    blocked: false,
    reason: null,
    warnings: [],
    sanitizedInput: input,
  };

  if (!input) return result;

  // 1. Check for destructive commands
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(input)) {
      result.blocked = true;
      result.reason = 'Input contains potentially destructive command pattern: ' + pattern.source.slice(0, 30);
      return result;
    }
  }

  // 2. Check for prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      result.blocked = true;
      result.reason = 'Input contains potential prompt injection pattern';
      return result;
    }
  }

  // 3. Redact secrets
  let sanitized = input;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    const before = sanitized;
    sanitized = sanitized.replace(pattern, replacement);
    if (sanitized !== before) {
      result.warnings.push('Secrets detected and redacted from input');
    }
  }
  result.sanitizedInput = sanitized;

  // 4. Input length check
  if (input.length > 50000) {
    result.warnings.push('Input is very large (' + input.length + ' chars). Consider splitting into smaller chunks.');
  }

  return result;
}

module.exports = { evaluateGuardrails, BLOCKED_PATTERNS, INJECTION_PATTERNS, SECRET_PATTERNS };
