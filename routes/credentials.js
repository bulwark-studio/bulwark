/**
 * Credential Vault Routes — Encrypted credential CRUD
 */
const vault = require('../lib/credential-vault');

module.exports = function (app, ctx) {
  const { requireAdmin } = ctx;

  // List all credentials (metadata only)
  app.get('/api/credentials', requireAdmin, (req, res) => {
    try {
      res.json({ credentials: vault.listCredentials() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get decrypted credential (secret returned)
  app.get('/api/credentials/:id', requireAdmin, (req, res) => {
    try {
      const cred = vault.getCredential(req.params.id);
      if (!cred) return res.status(404).json({ error: 'Credential not found' });
      res.json(cred);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Add new credential
  app.post('/api/credentials', requireAdmin, (req, res) => {
    try {
      const { name, type, host, port, username, secret, tags } = req.body;
      if (!name || !type || !secret) return res.status(400).json({ error: 'name, type, and secret are required' });
      const id = vault.addCredential({ name, type, host, port, username, secret, tags });
      res.json({ success: true, id });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update credential
  app.put('/api/credentials/:id', requireAdmin, (req, res) => {
    try {
      const ok = vault.updateCredential(req.params.id, req.body);
      if (!ok) return res.status(404).json({ error: 'Credential not found' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete credential
  app.delete('/api/credentials/:id', requireAdmin, (req, res) => {
    try {
      const ok = vault.deleteCredential(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Credential not found' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Inject credential into terminal session (returns command to execute)
  app.post('/api/credentials/:id/inject', requireAdmin, (req, res) => {
    try {
      const cred = vault.getCredential(req.params.id);
      if (!cred) return res.status(404).json({ error: 'Credential not found' });

      let command = '';
      switch (cred.type) {
        case 'ssh_key': {
          // Write temp key, return SSH command
          const tmpKey = require('path').join(require('os').tmpdir(), `chester-ssh-${cred.id}.pem`);
          require('fs').writeFileSync(tmpKey, cred.secret, { mode: 0o600 });
          const port = cred.port ? `-p ${cred.port} ` : '';
          const user = cred.username ? `${cred.username}@` : '';
          command = `ssh -i "${tmpKey}" ${port}${user}${cred.host || 'localhost'}`;
          // Schedule cleanup after 60s
          setTimeout(() => { try { require('fs').unlinkSync(tmpKey); } catch {} }, 60000);
          break;
        }
        case 'api_token':
          command = `export ${cred.name.replace(/[^A-Z0-9_]/gi, '_').toUpperCase()}="${cred.secret}"`;
          break;
        case 'connection_string':
          command = `export DATABASE_URL="${cred.secret}"`;
          break;
        case 'password':
          // For SSH with password, suggest sshpass if available
          if (cred.host) {
            const port = cred.port ? `-p ${cred.port} ` : '';
            const user = cred.username ? `${cred.username}@` : '';
            command = `sshpass -p '${cred.secret.replace(/'/g, "\\'")}' ssh ${port}${user}${cred.host}`;
          } else {
            command = `# Password for: ${cred.name}`;
          }
          break;
        default:
          command = `# ${cred.name}: ${cred.secret}`;
      }

      res.json({ command, type: cred.type, name: cred.name });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
};
