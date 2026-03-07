/**
 * FTP Routes — Native detection of vsftpd/proftpd, AI-powered setup
 * Works without adapter — uses system commands
 */
const { askAI } = require('../lib/ai');

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole, execCommand } = ctx;

  // Detect FTP server status, users, sessions
  app.get('/api/ftp/status', requireAdmin, async (req, res) => {
    try {
      const platform = process.platform;

      if (platform === 'win32') {
        return res.json({ installed: false, tool: 'none', platform, running: false, users: [], sessions: [] });
      }

      // Detect which FTP server is installed
      let tool = 'none';
      let running = false;

      // Check vsftpd
      try {
        const vsftpd = await execCommand('which vsftpd 2>/dev/null && systemctl is-active vsftpd 2>/dev/null', { timeout: 5000 });
        if (vsftpd.stdout.includes('vsftpd')) {
          tool = 'vsftpd';
          running = vsftpd.stdout.includes('active');
        }
      } catch {}

      // Check proftpd
      if (tool === 'none') {
        try {
          const proftpd = await execCommand('which proftpd 2>/dev/null && systemctl is-active proftpd 2>/dev/null', { timeout: 5000 });
          if (proftpd.stdout.includes('proftpd')) {
            tool = 'proftpd';
            running = proftpd.stdout.includes('active');
          }
        } catch {}
      }

      // Check pure-ftpd
      if (tool === 'none') {
        try {
          const pureftpd = await execCommand('which pure-ftpd 2>/dev/null && systemctl is-active pure-ftpd 2>/dev/null', { timeout: 5000 });
          if (pureftpd.stdout.includes('pure-ftpd')) {
            tool = 'pure-ftpd';
            running = pureftpd.stdout.includes('active');
          }
        } catch {}
      }

      if (tool === 'none') {
        return res.json({ installed: false, tool: 'none', platform, running: false, users: [], sessions: [] });
      }

      // Get FTP users (users with /home dirs that aren't system accounts)
      const users = [];
      try {
        const passwd = await execCommand('awk -F: \'$3 >= 1000 && $3 < 65534 { print $1":"$6":"$7 }\' /etc/passwd 2>/dev/null', { timeout: 3000 });
        passwd.stdout.trim().split('\n').filter(Boolean).forEach(line => {
          const [name, home, shell] = line.split(':');
          users.push({ name, home, shell });
        });
      } catch {}

      // Get active sessions
      const sessions = [];
      try {
        const ftpwho = await execCommand('ftpwho 2>/dev/null || pure-ftpwho 2>/dev/null || echo ""', { timeout: 3000 });
        const lines = ftpwho.stdout.trim().split('\n').filter(l => l && !l.startsWith('Service') && !l.startsWith('--') && !l.includes('standalone'));
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            sessions.push({ user: parts[0], ip: parts[1] || '', since: parts.slice(2).join(' ') });
          }
        }
      } catch {}

      res.json({ installed: true, tool, platform, running, users, sessions });
    } catch (e) { res.json({ installed: false, tool: 'none', error: e.message, users: [], sessions: [] }); }
  });

  // AI: FTP setup guide
  app.get('/api/ftp/ai-setup', requireAdmin, async (req, res) => {
    try {
      const platform = process.platform;
      let context = `Platform: ${platform}, Node.js ${process.version}`;

      const prompt = `You are a server admin expert helping a non-technical user set up an FTP server. They may not know Linux commands.

${context}

Give a complete, beginner-friendly FTP setup guide:
1. Explain briefly: FTP vs SFTP — recommend SFTP if they just need file transfers (it's built into SSH, more secure, no extra setup)
2. If they still need FTP, recommend vsftpd (most secure, lightweight)
3. Give exact copy-paste commands to:
   - Install vsftpd
   - Create an FTP user with a home directory
   - Configure vsftpd for security (chroot users, disable anonymous, local_enable)
   - Open firewall ports (20, 21, passive range)
   - Start and enable the service
4. Show how to test the connection
5. Warn about: plaintext passwords on FTP (use FTPS if possible), anonymous access risks

Keep it simple. Number every step. Show exact commands. No markdown formatting.`;

      const result = await askAI(prompt, { timeout: 30000 });
      res.json({ guide: result.trim() || 'Could not generate guide. Make sure an AI provider is configured in Settings.' });
    } catch (e) { res.json({ guide: 'AI unavailable: ' + e.message + '\n\nConfigure an AI provider in Settings > AI Provider.' }); }
  });

  // AI: FTP Q&A
  app.post('/api/ftp/ai-ask', requireRole('editor'), async (req, res) => {
    try {
      const { question } = req.body;

      const prompt = `You are a server admin expert. The user is asking about FTP server management. They may not be technical — explain clearly with exact commands they can copy-paste.

Platform: ${process.platform}
Question: ${question}

Give a clear, direct answer. If providing commands, explain what each does. Warn about any security risks. No markdown formatting.`;

      const result = await askAI(prompt, { timeout: 20000 });
      res.json({ answer: result.trim() || 'No answer available.' });
    } catch (e) { res.json({ answer: 'AI unavailable: ' + e.message }); }
  });
};
