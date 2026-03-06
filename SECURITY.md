# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Bulwark, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

Email **hello@bulwark.studio** with:

- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Impact assessment (if known)

### What to Expect

- **Acknowledgment** within 48 hours
- **Assessment** within 7 days
- **Fix or mitigation** as soon as possible, depending on severity
- Credit in the release notes (unless you prefer anonymity)

### Scope

The following are in scope:

- Authentication bypass or privilege escalation
- SQL injection, XSS, or command injection
- Credential vault (AES-256-GCM) weaknesses
- Session management flaws
- Path traversal in file manager or backup endpoints
- Docker Engine API abuse vectors

### Out of Scope

- Self-hosted misconfiguration (weak passwords, open ports)
- Denial of service on single-user instances
- Social engineering
- Issues in third-party dependencies (report upstream)

## Security Architecture

- **Auth:** PBKDF2 password hashing + optional TOTP 2FA
- **Sessions:** Cryptographically random tokens, cookie-based
- **Credentials:** AES-256-GCM encrypted vault
- **SQL Safety:** DDL blocked by default, all queries logged
- **RBAC:** Admin/editor/viewer roles on all API routes
- **AI:** BYOK model — no data sent to Bulwark servers
