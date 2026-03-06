/**
 * Credential Vault — AES-256-GCM Encrypted Credential Storage
 * Stores SSH keys, API tokens, connection strings securely at rest.
 * Zero npm deps — uses Node.js built-in crypto.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VAULT_PATH = path.join(__dirname, '..', 'data', 'credentials-vault.json');
const ALGO = 'aes-256-gcm';

// Derive a stable 256-bit key from the machine + a passphrase
function deriveKey(passphrase) {
  const salt = 'bulwark-vault-2026'; // static salt, combined with passphrase
  return crypto.pbkdf2Sync(passphrase || getDefaultPassphrase(), salt, 100000, 32, 'sha512');
}

function getDefaultPassphrase() {
  // Use env var if set, otherwise machine-bound fallback
  return process.env.VAULT_KEY || (require('os').hostname() + '-bulwark');
}

function encrypt(text, passphrase) {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { iv: iv.toString('hex'), tag, data: encrypted };
}

function decrypt(enc, passphrase) {
  const key = deriveKey(passphrase);
  const iv = Buffer.from(enc.iv, 'hex');
  const tag = Buffer.from(enc.tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(enc.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function loadVault() {
  try {
    if (fs.existsSync(VAULT_PATH)) {
      return JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
    }
  } catch {}
  return { credentials: [], meta: { created: new Date().toISOString(), version: 1 } };
}

function saveVault(vault) {
  fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2), 'utf8');
}

/**
 * List all credentials (metadata only — no secrets)
 */
function listCredentials() {
  const vault = loadVault();
  return (vault.credentials || []).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type, // ssh_key, api_token, connection_string, password, custom
    host: c.host || null,
    port: c.port || null,
    username: c.username || null,
    tags: c.tags || [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastUsed: c.lastUsed || null,
  }));
}

/**
 * Get a credential's decrypted secret
 */
function getCredential(id) {
  const vault = loadVault();
  const cred = (vault.credentials || []).find(c => c.id === id);
  if (!cred) return null;
  try {
    const secret = decrypt(cred.encrypted, null);
    // Update lastUsed
    cred.lastUsed = new Date().toISOString();
    saveVault(vault);
    return {
      id: cred.id,
      name: cred.name,
      type: cred.type,
      host: cred.host,
      port: cred.port,
      username: cred.username,
      tags: cred.tags,
      secret: secret,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Add a new credential
 */
function addCredential({ name, type, host, port, username, secret, tags }) {
  const vault = loadVault();
  if (!vault.credentials) vault.credentials = [];
  const id = crypto.randomUUID();
  const encrypted = encrypt(secret, null);
  vault.credentials.push({
    id, name, type,
    host: host || null,
    port: port || null,
    username: username || null,
    tags: tags || [],
    encrypted,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUsed: null,
  });
  saveVault(vault);
  return id;
}

/**
 * Update a credential
 */
function updateCredential(id, updates) {
  const vault = loadVault();
  const idx = (vault.credentials || []).findIndex(c => c.id === id);
  if (idx === -1) return false;
  const cred = vault.credentials[idx];
  if (updates.name) cred.name = updates.name;
  if (updates.type) cred.type = updates.type;
  if (updates.host !== undefined) cred.host = updates.host;
  if (updates.port !== undefined) cred.port = updates.port;
  if (updates.username !== undefined) cred.username = updates.username;
  if (updates.tags) cred.tags = updates.tags;
  if (updates.secret) cred.encrypted = encrypt(updates.secret, null);
  cred.updatedAt = new Date().toISOString();
  saveVault(vault);
  return true;
}

/**
 * Delete a credential
 */
function deleteCredential(id) {
  const vault = loadVault();
  const len = (vault.credentials || []).length;
  vault.credentials = (vault.credentials || []).filter(c => c.id !== id);
  if (vault.credentials.length < len) { saveVault(vault); return true; }
  return false;
}

module.exports = {
  listCredentials,
  getCredential,
  addCredential,
  updateCredential,
  deleteCredential,
};
