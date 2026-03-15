'use strict';

module.exports = [
  {
    id: 'SECOPS-001',
    title: 'Disable SSH Root Login',
    content: 'Set "PermitRootLogin no" in /etc/ssh/sshd_config to prevent direct root access over SSH. This forces attackers to compromise a regular user account first, adding a layer of defense. Always use a named admin account and escalate with sudo when needed.',
    domain: 'security-ops',
    tags: ['ssh', 'hardening', 'root', 'linux'],
    bestPractice: 'Disable root login and enforce named accounts with sudo for auditability and reduced attack surface.'
  },
  {
    id: 'SECOPS-002',
    title: 'SSH Key-Only Authentication',
    content: 'Set "PasswordAuthentication no" and "PubkeyAuthentication yes" in sshd_config to require SSH keys instead of passwords. Key-based auth is resistant to brute-force and credential stuffing attacks. Distribute public keys via configuration management tools like Ansible or cloud-init.',
    domain: 'security-ops',
    tags: ['ssh', 'keys', 'authentication', 'hardening'],
    bestPractice: 'Use Ed25519 or RSA-4096 keys and protect private keys with strong passphrases.'
  },
  {
    id: 'SECOPS-003',
    title: 'Fail2Ban for SSH Brute-Force Protection',
    content: 'Fail2ban monitors log files for repeated failed authentication attempts and temporarily bans offending IPs via iptables or nftables rules. Configure the sshd jail with appropriate maxretry (3-5), findtime, and bantime values. This dramatically reduces the effectiveness of automated brute-force attacks.',
    domain: 'security-ops',
    tags: ['ssh', 'fail2ban', 'brute-force', 'intrusion-prevention'],
    fix: 'Install fail2ban, enable the sshd jail in /etc/fail2ban/jail.local, and set maxretry=3 with a bantime of at least 1 hour.'
  },
  {
    id: 'SECOPS-004',
    title: 'SSH Non-Standard Port and AllowUsers',
    content: 'Changing the SSH port from 22 to a non-standard port reduces noise from automated scanners, though it is not a security boundary on its own. The AllowUsers or AllowGroups directive in sshd_config restricts SSH access to explicitly named users or groups. Combine both for defense in depth.',
    domain: 'security-ops',
    tags: ['ssh', 'port', 'allowusers', 'hardening'],
    bestPractice: 'Use AllowUsers to whitelist specific accounts and change the port to reduce log noise from bots.'
  },
  {
    id: 'SECOPS-005',
    title: 'Iptables Firewall Basics',
    content: 'Iptables is the traditional Linux packet filtering framework that uses chains (INPUT, OUTPUT, FORWARD) and tables (filter, nat, mangle) to control network traffic. A secure baseline sets the default INPUT policy to DROP and explicitly allows only required ports. Rules are evaluated top-to-bottom, so ordering matters for both security and performance.',
    domain: 'security-ops',
    tags: ['firewall', 'iptables', 'networking', 'linux'],
    bestPractice: 'Set default policies to DROP, allow established/related connections first, then whitelist specific ports.'
  },
  {
    id: 'SECOPS-006',
    title: 'UFW Firewall Configuration',
    content: 'UFW (Uncomplicated Firewall) is a user-friendly frontend to iptables available on Debian/Ubuntu systems. Enable it with "ufw enable" and add rules like "ufw allow 443/tcp" for HTTPS. It supports application profiles, rate limiting with "ufw limit ssh", and logging levels for audit purposes.',
    domain: 'security-ops',
    tags: ['firewall', 'ufw', 'ubuntu', 'linux'],
    fix: 'Run "ufw default deny incoming", "ufw default allow outgoing", add specific allow rules, then "ufw enable".'
  },
  {
    id: 'SECOPS-007',
    title: 'Firewalld Zones and Services',
    content: 'Firewalld uses zones (public, internal, dmz, trusted) to assign trust levels to network interfaces and connections. Services are predefined port/protocol combinations that can be added to zones declaratively. It supports runtime and permanent configurations, allowing changes without full firewall restarts.',
    domain: 'security-ops',
    tags: ['firewall', 'firewalld', 'rhel', 'centos', 'zones'],
    bestPractice: 'Assign interfaces to appropriate zones and use service definitions rather than raw port rules for maintainability.'
  },
  {
    id: 'SECOPS-008',
    title: 'TLS Cipher Suite Selection',
    content: 'Configure your TLS termination to prefer strong cipher suites that provide forward secrecy, such as ECDHE-based ciphers with AES-GCM or ChaCha20. Disable weak ciphers like RC4, DES, and 3DES, and disable TLS 1.0/1.1 to prevent downgrade attacks. Use the Mozilla SSL Configuration Generator to produce secure configs for nginx, Apache, or HAProxy.',
    domain: 'security-ops',
    tags: ['tls', 'ssl', 'ciphers', 'encryption', 'https'],
    bestPractice: 'Enforce TLS 1.2+ with ECDHE key exchange and AEAD ciphers; test with SSL Labs or testssl.sh.'
  },
  {
    id: 'SECOPS-009',
    title: 'HSTS (HTTP Strict Transport Security)',
    content: 'HSTS tells browsers to only connect to your site over HTTPS by sending the Strict-Transport-Security header with a max-age value. Include "includeSubDomains" to cover all subdomains and "preload" to submit to browser preload lists. This prevents SSL stripping attacks and accidental HTTP connections.',
    domain: 'security-ops',
    tags: ['tls', 'hsts', 'https', 'headers', 'browser-security'],
    fix: 'Add the header "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload" to your web server config.'
  },
  {
    id: 'SECOPS-010',
    title: 'OCSP Stapling',
    content: 'OCSP stapling allows your web server to fetch and cache the certificate revocation status from the CA and serve it directly to clients during the TLS handshake. This eliminates the client-side OCSP lookup, improving performance and privacy. Enable it in nginx with "ssl_stapling on" and "ssl_stapling_verify on" directives.',
    domain: 'security-ops',
    tags: ['tls', 'ocsp', 'certificates', 'performance'],
    bestPractice: 'Enable OCSP stapling and verify it works with "openssl s_client -status" to ensure timely revocation checks.'
  },
  {
    id: 'SECOPS-011',
    title: 'Let\'s Encrypt Certificate Automation',
    content: 'Let\'s Encrypt provides free, automated TLS certificates via the ACME protocol using tools like Certbot or acme.sh. Certificates are valid for 90 days and should be auto-renewed via cron or systemd timers. Use the DNS-01 challenge for wildcard certificates or when port 80 is unavailable.',
    domain: 'security-ops',
    tags: ['tls', 'letsencrypt', 'certificates', 'automation', 'certbot'],
    fix: 'Install certbot, run "certbot --nginx -d example.com", and verify the systemd timer for auto-renewal is active.'
  },
  {
    id: 'SECOPS-012',
    title: 'TLS Certificate Chain Validation',
    content: 'A complete certificate chain includes the server certificate, intermediate certificates, and the root CA certificate. Missing intermediates cause trust errors in clients that do not have them cached. Always concatenate your cert and intermediates in the correct order and verify with "openssl verify -untrusted chain.pem cert.pem".',
    domain: 'security-ops',
    tags: ['tls', 'certificates', 'chain', 'validation'],
    fix: 'Concatenate certificates in order: server cert first, then intermediates, and test with SSL Labs or openssl s_client.'
  },
  {
    id: 'SECOPS-013',
    title: 'HashiCorp Vault for Secrets Management',
    content: 'HashiCorp Vault provides centralized secrets management with dynamic secrets, encryption as a service, and fine-grained access control via policies. It supports multiple auth methods (AppRole, Kubernetes, OIDC) and secrets engines (KV, database, PKI). Vault automatically rotates dynamic credentials and provides a full audit log of all secret access.',
    domain: 'security-ops',
    tags: ['secrets', 'vault', 'hashicorp', 'encryption', 'dynamic-secrets'],
    bestPractice: 'Use dynamic secrets with short TTLs wherever possible to limit the blast radius of credential compromise.'
  },
  {
    id: 'SECOPS-014',
    title: 'AWS Secrets Manager',
    content: 'AWS Secrets Manager stores and automatically rotates secrets like database credentials, API keys, and OAuth tokens. It integrates natively with RDS, Redshift, and DocumentDB for automatic credential rotation via Lambda functions. Access is controlled through IAM policies and resource-based policies, with all access logged in CloudTrail.',
    domain: 'security-ops',
    tags: ['secrets', 'aws', 'cloud', 'rotation', 'iam'],
    bestPractice: 'Enable automatic rotation and use IAM roles instead of static credentials for application access to secrets.'
  },
  {
    id: 'SECOPS-015',
    title: 'Kubernetes Sealed Secrets',
    content: 'Sealed Secrets by Bitnami allows you to encrypt Kubernetes secrets so they can be safely stored in Git repositories. The SealedSecret custom resource is encrypted with a public key and can only be decrypted by the sealed-secrets controller running in the cluster. This enables GitOps workflows where secret manifests are version-controlled alongside application code.',
    domain: 'security-ops',
    tags: ['secrets', 'kubernetes', 'gitops', 'sealed-secrets', 'encryption'],
    bestPractice: 'Rotate the sealing key periodically and never commit plain Kubernetes Secret manifests to Git.'
  },
  {
    id: 'SECOPS-016',
    title: 'Securing .env Files',
    content: 'Environment files (.env) store configuration and secrets for local development but must never be committed to version control. Add .env to .gitignore and provide a .env.example with placeholder values for documentation. In production, use a proper secrets manager instead of .env files to avoid exposure through container images or file system access.',
    domain: 'security-ops',
    tags: ['secrets', 'dotenv', 'environment', 'git'],
    fix: 'Add ".env*" to .gitignore, audit Git history for accidentally committed secrets with tools like truffleHog or git-secrets.'
  },
  {
    id: 'SECOPS-017',
    title: 'RBAC Patterns and Implementation',
    content: 'Role-Based Access Control assigns permissions to roles rather than individual users, simplifying access management at scale. Define roles that map to job functions (viewer, editor, admin) and assign the minimum permissions each role needs. In Kubernetes, use Role/ClusterRole and RoleBinding/ClusterRoleBinding resources to enforce RBAC at the API server level.',
    domain: 'security-ops',
    tags: ['rbac', 'access-control', 'authorization', 'least-privilege'],
    bestPractice: 'Audit role assignments quarterly and remove unused roles to prevent privilege creep.'
  },
  {
    id: 'SECOPS-018',
    title: 'Principle of Least Privilege',
    content: 'Every user, process, and service should operate with the minimum set of privileges required to perform its function. This limits the blast radius when an account or service is compromised. Apply this principle across IAM policies, file permissions, database grants, and network access rules.',
    domain: 'security-ops',
    tags: ['least-privilege', 'access-control', 'security-principles', 'iam'],
    bestPractice: 'Start with zero permissions and add only what is explicitly needed; use deny-by-default policies everywhere.'
  },
  {
    id: 'SECOPS-019',
    title: 'Linux Audit Logging with auditd',
    content: 'The Linux audit daemon (auditd) records security-relevant events including file access, system calls, and authentication attempts. Configure audit rules in /etc/audit/rules.d/ to monitor critical files like /etc/passwd, /etc/shadow, and sudo usage. Centralize audit logs to a SIEM for correlation and alerting on suspicious activity.',
    domain: 'security-ops',
    tags: ['audit', 'auditd', 'logging', 'linux', 'compliance'],
    fix: 'Install auditd, add rules for sensitive file watches and syscall monitoring, and forward logs to a centralized system.'
  },
  {
    id: 'SECOPS-020',
    title: 'Centralized Logging with Rsyslog',
    content: 'Rsyslog is a high-performance log processing system that can collect, filter, and forward logs from multiple sources to centralized storage. Configure remote logging to prevent attackers from tampering with local logs after a compromise. Use TLS encryption for log transport and structured logging formats like JSON for easier parsing.',
    domain: 'security-ops',
    tags: ['logging', 'rsyslog', 'centralized', 'siem', 'linux'],
    bestPractice: 'Forward all security logs to a remote, append-only log server and retain them for at least 90 days.'
  },
  {
    id: 'SECOPS-021',
    title: 'CIS Benchmarks for Linux Hardening',
    content: 'CIS (Center for Internet Security) benchmarks provide prescriptive hardening guidelines for operating systems, covering filesystem configuration, boot settings, network parameters, and service configurations. Use tools like CIS-CAT, OpenSCAP, or Lynis to automate compliance scanning against these benchmarks. Apply the Level 1 profile as a baseline and Level 2 for high-security environments.',
    domain: 'security-ops',
    tags: ['cis', 'hardening', 'compliance', 'benchmarks', 'linux'],
    bestPractice: 'Integrate CIS benchmark scanning into your CI/CD pipeline for infrastructure images and remediate findings before deployment.'
  },
  {
    id: 'SECOPS-022',
    title: 'Container Image Scanning with Trivy',
    content: 'Trivy is an open-source vulnerability scanner that detects CVEs in container images, filesystem dependencies, and IaC misconfigurations. Integrate it into CI pipelines to block deployments with critical or high vulnerabilities. It supports scanning OS packages, language-specific dependencies, and can output results in SARIF format for GitHub Security integration.',
    domain: 'security-ops',
    tags: ['containers', 'trivy', 'scanning', 'vulnerabilities', 'docker'],
    fix: 'Add "trivy image --severity HIGH,CRITICAL --exit-code 1 your-image:tag" to your CI pipeline to gate deployments.'
  },
  {
    id: 'SECOPS-023',
    title: 'Rootless Containers',
    content: 'Running containers as a non-root user prevents container escape exploits from gaining root on the host. Use the USER directive in Dockerfiles, set runAsNonRoot in Kubernetes securityContext, or use rootless container runtimes like Podman. This is one of the most impactful container security controls available.',
    domain: 'security-ops',
    tags: ['containers', 'rootless', 'docker', 'kubernetes', 'hardening'],
    bestPractice: 'Always specify a non-root USER in Dockerfiles and enforce runAsNonRoot: true in Kubernetes pod security policies.'
  },
  {
    id: 'SECOPS-024',
    title: 'Read-Only Container Filesystems',
    content: 'Setting a container filesystem to read-only prevents attackers from writing malicious scripts or modifying binaries inside a running container. Use "docker run --read-only" or set readOnlyRootFilesystem in Kubernetes securityContext. Mount tmpfs volumes for directories that legitimately need write access, such as /tmp or application cache directories.',
    domain: 'security-ops',
    tags: ['containers', 'read-only', 'immutable', 'kubernetes', 'hardening'],
    fix: 'Set readOnlyRootFilesystem: true in the container securityContext and add emptyDir volumes for writable paths.'
  },
  {
    id: 'SECOPS-025',
    title: 'No-New-Privileges Container Flag',
    content: 'The no-new-privileges security flag prevents container processes from gaining additional privileges through setuid/setgid binaries or capability escalation. Enable it with "--security-opt=no-new-privileges:true" in Docker or allowPrivilegeEscalation: false in Kubernetes. This blocks common privilege escalation techniques inside containers.',
    domain: 'security-ops',
    tags: ['containers', 'privileges', 'security-context', 'kubernetes'],
    bestPractice: 'Set allowPrivilegeEscalation: false and drop all capabilities, then add back only what is explicitly required.'
  },
  {
    id: 'SECOPS-026',
    title: 'Unattended Upgrades for OS Patching',
    content: 'Unattended-upgrades on Debian/Ubuntu automatically installs security patches without manual intervention, reducing the window of exposure to known vulnerabilities. Configure it in /etc/apt/apt.conf.d/50unattended-upgrades to target security repositories and set up email notifications. Schedule patch windows during low-traffic periods and enable automatic reboot if required.',
    domain: 'security-ops',
    tags: ['patching', 'unattended-upgrades', 'ubuntu', 'debian', 'automation'],
    fix: 'Install unattended-upgrades, run "dpkg-reconfigure -plow unattended-upgrades", and verify /var/log/unattended-upgrades/.'
  },
  {
    id: 'SECOPS-027',
    title: 'Patch Management Windows',
    content: 'Define scheduled maintenance windows for applying patches to production systems to balance security urgency with availability requirements. Critical CVEs (CVSS 9+) should be patched within 24-48 hours, while lower-severity patches can follow a weekly or monthly cadence. Test patches in staging first, maintain rollback plans, and communicate windows to stakeholders.',
    domain: 'security-ops',
    tags: ['patching', 'maintenance', 'change-management', 'sla'],
    bestPractice: 'Establish a tiered patching SLA based on CVSS severity and automate patch deployment with configuration management tools.'
  },
  {
    id: 'SECOPS-028',
    title: 'Nginx Rate Limiting',
    content: 'Nginx rate limiting uses the limit_req module to throttle incoming requests per client IP or other keys, protecting against brute-force and application-layer DDoS attacks. Define a limit_req_zone in the http block and apply limit_req in location blocks with burst and nodelay parameters. Log rate-limited requests for monitoring and tuning thresholds.',
    domain: 'security-ops',
    tags: ['rate-limiting', 'nginx', 'ddos', 'brute-force', 'waf'],
    fix: 'Add "limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;" and apply "limit_req zone=api burst=20 nodelay;" to location blocks.'
  },
  {
    id: 'SECOPS-029',
    title: 'WAF and DDoS Protection with Cloudflare',
    content: 'Cloudflare provides a reverse proxy with built-in WAF rules, DDoS mitigation, and bot management that can be deployed without infrastructure changes. Its managed rulesets cover OWASP Top 10 threats, and rate limiting rules can be customized per endpoint. Enable "Under Attack" mode during active DDoS events for additional JavaScript challenge protection.',
    domain: 'security-ops',
    tags: ['waf', 'ddos', 'cloudflare', 'cdn', 'bot-protection'],
    bestPractice: 'Layer Cloudflare WAF with application-level input validation; never rely solely on edge protection.'
  },
  {
    id: 'SECOPS-030',
    title: 'Network Segmentation',
    content: 'Network segmentation divides a network into isolated zones (DMZ, application tier, database tier) to contain lateral movement after a breach. Use VLANs, subnets, security groups, or Kubernetes NetworkPolicies to enforce boundaries between segments. Only allow explicitly required traffic flows between segments with deny-all default rules.',
    domain: 'security-ops',
    tags: ['networking', 'segmentation', 'vlans', 'microsegmentation', 'zero-trust'],
    bestPractice: 'Map data flows before segmenting, implement deny-all defaults, and monitor inter-segment traffic for anomalies.'
  },
  {
    id: 'SECOPS-031',
    title: 'Zero Trust Architecture',
    content: 'Zero trust assumes no implicit trust based on network location and requires verification of every access request regardless of source. Implement identity-aware proxies (BeyondCorp, Zscaler), mutual TLS between services, and continuous authentication and authorization checks. Every request should be authenticated, authorized, and encrypted.',
    domain: 'security-ops',
    tags: ['zero-trust', 'identity', 'beyondcorp', 'mtls', 'architecture'],
    bestPractice: 'Start by inventorying all access flows, then incrementally enforce identity verification and least-privilege access at every boundary.'
  },
  {
    id: 'SECOPS-032',
    title: 'Password Policies and Enforcement',
    content: 'Modern password policies follow NIST SP 800-63B guidelines: require a minimum of 12 characters, check against breached password databases, and avoid forced periodic rotation unless compromise is suspected. Use PAM modules like pam_pwquality on Linux to enforce complexity and length requirements. Ban commonly used passwords and dictionary words.',
    domain: 'security-ops',
    tags: ['passwords', 'authentication', 'nist', 'pam', 'policy'],
    bestPractice: 'Follow NIST 800-63B: prioritize length over complexity, screen against breach databases, and eliminate forced rotation.'
  },
  {
    id: 'SECOPS-033',
    title: 'Multi-Factor Authentication (MFA)',
    content: 'MFA requires users to provide two or more verification factors (something they know, have, or are) before granting access. Prefer hardware security keys (FIDO2/WebAuthn) or authenticator apps (TOTP) over SMS-based OTP which is vulnerable to SIM swapping. Enforce MFA for all privileged accounts, VPN access, and cloud console logins.',
    domain: 'security-ops',
    tags: ['mfa', '2fa', 'authentication', 'fido2', 'totp'],
    bestPractice: 'Mandate FIDO2 hardware keys for admin accounts and TOTP-based MFA for all users; disable SMS-based OTP.'
  },
  {
    id: 'SECOPS-034',
    title: 'File Integrity Monitoring with AIDE',
    content: 'AIDE (Advanced Intrusion Detection Environment) creates a baseline database of file checksums and attributes, then detects unauthorized changes by comparing the current state against the baseline. Initialize with "aide --init", then run "aide --check" on a schedule via cron. Store the baseline database on separate, read-only media to prevent tampering.',
    domain: 'security-ops',
    tags: ['fim', 'aide', 'integrity', 'intrusion-detection', 'linux'],
    fix: 'Install AIDE, configure /etc/aide/aide.conf for critical paths, initialize the database, and schedule daily checks via cron.'
  },
  {
    id: 'SECOPS-035',
    title: 'File Integrity Monitoring with Tripwire',
    content: 'Tripwire monitors file system changes by comparing files against a signed baseline database, alerting on unauthorized modifications to system binaries, configuration files, and sensitive data. It uses cryptographic hashes and can send email alerts or integrate with SIEM systems. The policy file defines which files and directories to monitor and what attributes to track.',
    domain: 'security-ops',
    tags: ['fim', 'tripwire', 'integrity', 'intrusion-detection', 'compliance'],
    bestPractice: 'Monitor /etc, /usr/bin, /usr/sbin, and application directories; update the baseline after legitimate changes.'
  }
];
