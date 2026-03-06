// Helper: generates ecosystem.config.js from env vars
// Usage on AWS:
//   export MP=chester2026
//   export DP=your_db_password
//   export VP=your_vps_db_password (optional, for VPS DB access)
//   node write-config.js

const fs = require('fs');

const mp = process.env.MP || 'changeme';
const dp = process.env.DP || '';
const vp = process.env.VP || '';

// For local Docker: connect to bulwark-db container
// For AWS/remote: connect via direct hostname
const dbHost = process.env.DB_HOST || 'bulwark-db';
const dbPort = process.env.DB_PORT || '5432';
const dbName = process.env.DB_NAME || 'chester';
const dbUser = process.env.DB_USER || 'chester_admin';

// VPS DB (optional — for syncing VPS tickets to dev monitor)
const vpsDbHost = process.env.VPS_DB_HOST || '';

const config = `module.exports = {
  apps: [{
    name: 'dev-monitor',
    script: 'server.js',
    env: {
      MONITOR_PASS: '${mp}',
      DATABASE_URL: 'postgresql://${dbUser}:${dp}@${dbHost}:${dbPort}/${dbName}'${vpsDbHost ? `,
      VPS_DATABASE_URL: 'postgresql://${dbUser}:${vp}@${vpsDbHost}:${dbPort}/${dbName}'` : ''}
    }
  }]
};
`;

fs.writeFileSync('ecosystem.config.js', config);
console.log('Created ecosystem.config.js');
console.log('  MONITOR_PASS:', mp);
console.log('  DATABASE_URL: set' + (dp ? ' ✓' : ' ✗ (missing DP)'));
console.log('  VPS_DATABASE_URL: ' + (vpsDbHost ? 'set ✓' : 'not configured'));
