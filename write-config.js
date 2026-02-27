// Helper: generates ecosystem.config.js from env vars
// Usage on AWS:
//   export MP=chester2026
//   export DP=5q9ra4lLpViYvKZ5
//   export VP=dnlBcmk5wzO7Hins
//   node write-config.js

const fs = require('fs');

const mp = process.env.MP || 'changeme';
const dp = process.env.DP || '';
const vp = process.env.VP || '';

// Direct connections (port 5432) — bypasses pooler, avoids
// "Tenant or user not found" errors from Supavisor
const devHost = 'db.flzccsvxzmpqglijrcxq.supabase.co';
const vpsHost = 'db.qoobpabjcpshnhpwlztx.supabase.co';

const config = `module.exports = {
  apps: [{
    name: 'dev-monitor',
    script: 'server.js',
    env: {
      MONITOR_PASS: '${mp}',
      DATABASE_URL: 'postgresql://postgres:${dp}@${devHost}:5432/postgres',
      VPS_DATABASE_URL: 'postgresql://postgres:${vp}@${vpsHost}:5432/postgres'
    }
  }]
};
`;

fs.writeFileSync('ecosystem.config.js', config);
console.log('Created ecosystem.config.js');
console.log('  MONITOR_PASS:', mp);
console.log('  DATABASE_URL: set' + (dp ? ' ✓' : ' ✗ (missing DP)'));
console.log('  VPS_DATABASE_URL: set' + (vp ? ' ✓' : ' ✗ (missing VP)'));
