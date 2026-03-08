/**
 * Bulwark — GitHub Hub
 * Track, categorize, research, and compare GitHub repos across multiple accounts.
 * AI-powered analysis, roadmap notes, and technology landscape.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HUB_FILE = path.join(__dirname, "..", "data", "github-hub.json");

const DEFAULT_CATEGORIES = [
  "AI/ML", "DevOps", "Frontend", "Backend", "Security",
  "Infrastructure", "Data", "Mobile", "Research", "Uncategorized"
];

const DEFAULT_HUB = {
  accounts: [],
  repos: [],
  categories: [...DEFAULT_CATEGORIES],
  settings: { syncIntervalMinutes: 60, defaultCategory: "Uncategorized" }
};

function loadHub() {
  try { return JSON.parse(fs.readFileSync(HUB_FILE, "utf8")); }
  catch { return JSON.parse(JSON.stringify(DEFAULT_HUB)); }
}

function saveHub(data) {
  const dir = path.dirname(HUB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HUB_FILE, JSON.stringify(data, null, 2));
}

// ── GitHub API client (Node 22 fetch, zero deps) ────────────────────────────

const rateLimits = {}; // per-account: { remaining, reset }

async function githubFetch(token, apiPath, opts = {}) {
  const key = token || "__public__";
  const remaining = rateLimits[key]?.remaining;
  if (remaining !== undefined && remaining <= 5) {
    const reset = rateLimits[key]?.reset;
    throw new Error(`Rate limit exhausted. Resets at ${new Date(reset * 1000).toLocaleTimeString()}`);
  }

  const url = `https://api.github.com${apiPath}${opts.params ? "?" + new URLSearchParams(opts.params) : ""}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Bulwark/2.1"
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers, signal: controller.signal });

    // Track rate limits
    const rl = {
      remaining: parseInt(res.headers.get("x-ratelimit-remaining") || "999"),
      reset: parseInt(res.headers.get("x-ratelimit-reset") || "0"),
      limit: parseInt(res.headers.get("x-ratelimit-limit") || (token ? "5000" : "60"))
    };
    rateLimits[key] = rl;

    if (res.status === 404) return { data: null, rateLimit: rl };
    if (res.status === 403 && rl.remaining === 0) {
      throw new Error(`GitHub rate limit exceeded. Resets at ${new Date(rl.reset * 1000).toLocaleTimeString()}`);
    }
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);

    const data = await res.json();
    return { data, rateLimit: rl };
  } finally {
    clearTimeout(timeout);
  }
}

async function validateToken(token) {
  try {
    const { data, rateLimit } = await githubFetch(token, "/user");
    if (!data) return { valid: false };
    return {
      valid: true,
      username: data.login,
      avatarUrl: data.avatar_url,
      name: data.name,
      rateLimit
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

async function fetchRepoInfo(token, owner, repo) {
  const { data } = await githubFetch(token, `/repos/${owner}/${repo}`);
  if (!data) return null;
  return {
    owner: data.owner?.login || owner,
    name: data.name,
    fullName: data.full_name,
    htmlUrl: data.html_url,
    description: data.description || "",
    language: data.language || "Unknown",
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    openIssues: data.open_issues_count || 0,
    defaultBranch: data.default_branch || "main",
    topics: data.topics || [],
    isPrivate: data.private || false,
    license: data.license?.spdx_id || null,
    pushedAt: data.pushed_at,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
    size: data.size || 0,
    archived: data.archived || false,
    fork: data.fork || false,
  };
}

async function fetchReadme(token, owner, repo) {
  try {
    const { data } = await githubFetch(token, `/repos/${owner}/${repo}/readme`);
    if (!data?.content) return null;
    return Buffer.from(data.content, "base64").toString("utf8").substring(0, 8000);
  } catch { return null; }
}

function parseRepoUrl(input) {
  if (!input) return null;
  input = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  // owner/repo format
  const slash = input.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (slash) return { owner: slash[1], repo: slash[2] };
  // Full URL
  const url = input.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (url) return { owner: url[1], repo: url[2] };
  return null;
}

function getAccountToken(hub, accountId, vault) {
  const acct = hub.accounts.find(a => a.id === accountId);
  if (!acct) return null;
  try {
    const cred = vault.getCredential(acct.credentialId);
    return cred?.secret || null;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════════════════

module.exports = function (app, ctx) {
  const { requireAdmin, requireRole } = ctx;

  // Lazy-load vault
  let vault;
  try { vault = require("../lib/credential-vault"); } catch { vault = null; }

  // ── Accounts ─────────────────────────────────────────────────────────────

  app.get("/api/github-hub/accounts", requireAdmin, (req, res) => {
    const hub = loadHub();
    res.json({ accounts: hub.accounts.map(a => ({ ...a })) });
  });

  app.post("/api/github-hub/accounts", requireRole("editor"), async (req, res) => {
    const { name, label, token } = req.body;
    if (!name || !token) return res.status(400).json({ error: "Name and token required" });

    try {
      const validation = await validateToken(token);
      if (!validation.valid) return res.status(400).json({ error: "Invalid token: " + (validation.error || "could not authenticate") });

      // Store token in credential vault
      let credentialId = null;
      if (vault) {
        credentialId = vault.addCredential({
          name: `GitHub: ${name}`,
          type: "api_token",
          username: validation.username,
          secret: token,
          tags: ["github-hub"]
        });
      }

      const hub = loadHub();
      const account = {
        id: crypto.randomUUID(),
        name: name.trim(),
        label: (label || "personal").trim(),
        credentialId,
        username: validation.username,
        addedAt: new Date().toISOString(),
        lastValidated: new Date().toISOString()
      };
      hub.accounts.push(account);
      saveHub(hub);

      res.json({ account, username: validation.username });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/github-hub/accounts/:id", requireRole("editor"), async (req, res) => {
    const hub = loadHub();
    const idx = hub.accounts.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Account not found" });

    const { name, label, token } = req.body;
    if (name) hub.accounts[idx].name = name.trim();
    if (label) hub.accounts[idx].label = label.trim();

    if (token && vault) {
      const validation = await validateToken(token);
      if (!validation.valid) return res.status(400).json({ error: "Invalid token" });
      hub.accounts[idx].username = validation.username;
      hub.accounts[idx].lastValidated = new Date().toISOString();
      if (hub.accounts[idx].credentialId) {
        vault.updateCredential(hub.accounts[idx].credentialId, { secret: token, username: validation.username });
      }
    }

    saveHub(hub);
    res.json({ account: hub.accounts[idx] });
  });

  app.delete("/api/github-hub/accounts/:id", requireAdmin, (req, res) => {
    const hub = loadHub();
    const idx = hub.accounts.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Account not found" });

    // Remove credential from vault
    if (vault && hub.accounts[idx].credentialId) {
      try { vault.deleteCredential(hub.accounts[idx].credentialId); } catch {}
    }

    // Remove repos for this account
    hub.repos = hub.repos.filter(r => r.accountId !== req.params.id);
    hub.accounts.splice(idx, 1);
    saveHub(hub);
    res.json({ ok: true });
  });

  app.post("/api/github-hub/accounts/:id/validate", requireRole("editor"), async (req, res) => {
    const hub = loadHub();
    const acct = hub.accounts.find(a => a.id === req.params.id);
    if (!acct) return res.status(404).json({ error: "Account not found" });

    const token = getAccountToken(hub, acct.id, vault);
    if (!token) return res.status(400).json({ error: "No token found in vault" });

    const validation = await validateToken(token);
    if (validation.valid) {
      acct.username = validation.username;
      acct.lastValidated = new Date().toISOString();
      saveHub(hub);
    }
    res.json(validation);
  });

  // ── Repos ────────────────────────────────────────────────────────────────

  app.get("/api/github-hub/repos", requireAdmin, (req, res) => {
    const hub = loadHub();
    let repos = [...hub.repos];

    // Filters
    if (req.query.category) repos = repos.filter(r => r.category === req.query.category);
    if (req.query.accountId) repos = repos.filter(r => r.accountId === req.query.accountId);
    if (req.query.source === "public") repos = repos.filter(r => !r.accountId);
    else if (req.query.source === "account") repos = repos.filter(r => !!r.accountId);
    if (req.query.language) repos = repos.filter(r => r.language === req.query.language);
    if (req.query.starred === "true") repos = repos.filter(r => r.starred);
    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      repos = repos.filter(r =>
        r.fullName?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        (r.topics || []).some(t => t.includes(q)) ||
        (r.tags || []).some(t => t.includes(q))
      );
    }

    // Sort
    const sort = req.query.sort || "stars";
    if (sort === "stars") repos.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    else if (sort === "updated") repos.sort((a, b) => new Date(b.pushedAt || 0) - new Date(a.pushedAt || 0));
    else if (sort === "name") repos.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    else if (sort === "added") repos.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));

    // Languages for filter dropdown
    const languages = [...new Set(hub.repos.map(r => r.language).filter(Boolean))].sort();

    res.json({ repos, total: hub.repos.length, languages });
  });

  app.post("/api/github-hub/repos", requireRole("editor"), async (req, res) => {
    const { url, accountId, category, tags, notes } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    const parsed = parseRepoUrl(url);
    if (!parsed) return res.status(400).json({ error: "Could not parse repo URL. Use owner/repo or full GitHub URL." });

    const hub = loadHub();
    // Check duplicate
    if (hub.repos.find(r => r.fullName?.toLowerCase() === `${parsed.owner}/${parsed.repo}`.toLowerCase())) {
      return res.status(409).json({ error: "Repo already tracked" });
    }

    // Resolve token: use account if provided, otherwise public (unauthenticated)
    let token = null;
    if (accountId) {
      token = getAccountToken(hub, accountId, vault);
      if (!token) return res.status(400).json({ error: "No valid token for this account" });
    }

    try {
      const info = await fetchRepoInfo(token, parsed.owner, parsed.repo);
      if (!info) return res.status(404).json({ error: `Repo ${parsed.owner}/${parsed.repo} not found (may be private — use an account)` });

      const repo = {
        id: crypto.randomUUID(),
        accountId: accountId || null,
        source: accountId ? "account" : "public",
        ...info,
        category: category || hub.settings.defaultCategory || "Uncategorized",
        tags: tags || [],
        notes: notes || "",
        starred: false,
        aiSummary: null,
        aiResearch: null,
        addedAt: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
        syncError: null
      };

      hub.repos.push(repo);
      saveHub(hub);
      res.json({ repo });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/github-hub/repos/bulk", requireRole("editor"), async (req, res) => {
    const { accountId, filter, category } = req.body;
    if (!accountId) return res.status(400).json({ error: "accountId required" });

    const hub = loadHub();
    const token = getAccountToken(hub, accountId, vault);
    if (!token) return res.status(400).json({ error: "No valid token for this account" });

    try {
      let allRepos = [];
      const type = filter || "owner";
      const endpoint = type === "starred" ? "/user/starred" : "/user/repos";
      const params = type === "starred" ? {} : { type, sort: "pushed", per_page: "100" };

      // Paginate up to 10 pages (1000 repos max)
      for (let page = 1; page <= 10; page++) {
        const { data } = await githubFetch(token, endpoint, { params: { ...params, page: String(page) } });
        if (!data || !data.length) break;
        allRepos = allRepos.concat(data);
        if (data.length < 100) break;
      }

      const existingNames = new Set(hub.repos.map(r => r.fullName?.toLowerCase()));
      let added = 0;

      for (const r of allRepos) {
        if (existingNames.has(r.full_name?.toLowerCase())) continue;

        hub.repos.push({
          id: crypto.randomUUID(),
          accountId,
          owner: r.owner?.login,
          name: r.name,
          fullName: r.full_name,
          htmlUrl: r.html_url,
          description: r.description || "",
          language: r.language || "Unknown",
          stars: r.stargazers_count || 0,
          forks: r.forks_count || 0,
          openIssues: r.open_issues_count || 0,
          defaultBranch: r.default_branch || "main",
          topics: r.topics || [],
          isPrivate: r.private || false,
          license: r.license?.spdx_id || null,
          pushedAt: r.pushed_at,
          updatedAt: r.updated_at,
          createdAt: r.created_at,
          size: r.size || 0,
          archived: r.archived || false,
          fork: r.fork || false,
          category: category || hub.settings.defaultCategory || "Uncategorized",
          tags: [],
          notes: "",
          starred: false,
          aiSummary: null,
          aiResearch: null,
          addedAt: new Date().toISOString(),
          lastSynced: new Date().toISOString(),
          syncError: null
        });
        added++;
      }

      saveHub(hub);
      res.json({ added, total: allRepos.length, skipped: allRepos.length - added });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/github-hub/repos/:id", requireRole("editor"), (req, res) => {
    const hub = loadHub();
    const repo = hub.repos.find(r => r.id === req.params.id);
    if (!repo) return res.status(404).json({ error: "Repo not found" });

    const { category, tags, notes, starred } = req.body;
    if (category !== undefined) repo.category = category;
    if (tags !== undefined) repo.tags = tags;
    if (notes !== undefined) repo.notes = notes;
    if (starred !== undefined) repo.starred = !!starred;

    saveHub(hub);
    res.json({ repo });
  });

  app.delete("/api/github-hub/repos/:id", requireRole("editor"), (req, res) => {
    const hub = loadHub();
    const idx = hub.repos.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Repo not found" });
    hub.repos.splice(idx, 1);
    saveHub(hub);
    res.json({ ok: true });
  });

  app.post("/api/github-hub/repos/:id/sync", requireRole("editor"), async (req, res) => {
    const hub = loadHub();
    const repo = hub.repos.find(r => r.id === req.params.id);
    if (!repo) return res.status(404).json({ error: "Repo not found" });

    // Use account token if linked, otherwise public (unauthenticated)
    const token = repo.accountId ? getAccountToken(hub, repo.accountId, vault) : null;

    try {
      const info = await fetchRepoInfo(token, repo.owner, repo.name);
      if (!info) return res.status(404).json({ error: "Repo no longer accessible" });
      Object.assign(repo, info, { lastSynced: new Date().toISOString(), syncError: null });
      saveHub(hub);
      res.json({ repo });
    } catch (e) {
      repo.syncError = e.message;
      saveHub(hub);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Categories ───────────────────────────────────────────────────────────

  app.get("/api/github-hub/categories", requireAdmin, (req, res) => {
    const hub = loadHub();
    const counts = {};
    hub.categories.forEach(c => { counts[c] = 0; });
    hub.repos.forEach(r => {
      if (r.category) counts[r.category] = (counts[r.category] || 0) + 1;
    });
    res.json({ categories: hub.categories, counts });
  });

  app.post("/api/github-hub/categories", requireRole("editor"), (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Category name required" });
    const hub = loadHub();
    if (hub.categories.includes(name.trim())) return res.status(409).json({ error: "Category already exists" });
    hub.categories.push(name.trim());
    saveHub(hub);
    res.json({ categories: hub.categories });
  });

  app.delete("/api/github-hub/categories/:name", requireAdmin, (req, res) => {
    const hub = loadHub();
    const name = decodeURIComponent(req.params.name);
    hub.categories = hub.categories.filter(c => c !== name);
    // Move repos in deleted category to Uncategorized
    hub.repos.forEach(r => { if (r.category === name) r.category = "Uncategorized"; });
    saveHub(hub);
    res.json({ ok: true });
  });

  // ── AI Research ──────────────────────────────────────────────────────────

  app.post("/api/github-hub/repos/:id/ai-summary", requireRole("editor"), async (req, res) => {
    const { askAI } = require("../lib/ai");
    const hub = loadHub();
    const repo = hub.repos.find(r => r.id === req.params.id);
    if (!repo) return res.status(404).json({ error: "Repo not found" });

    const token = repo.accountId ? getAccountToken(hub, repo.accountId, vault) : null;
    let readme = "";
    try { readme = await fetchReadme(token, repo.owner, repo.name) || ""; } catch {}

    const prompt = `Summarize this GitHub repository for a developer evaluating it for potential use or integration.

Repository: ${repo.fullName}
Description: ${repo.description}
Language: ${repo.language} | Stars: ${repo.stars} | Forks: ${repo.forks} | Issues: ${repo.openIssues}
Topics: ${(repo.topics || []).join(", ")}
License: ${repo.license || "Unknown"} | Private: ${repo.isPrivate} | Archived: ${repo.archived}
Last pushed: ${repo.pushedAt}

${readme ? "README (first 4000 chars):\n" + readme.substring(0, 4000) : "No README available."}

Provide:
1. What it does (1-2 sentences)
2. Tech stack and architecture
3. Maturity level (experimental / growing / mature / declining)
4. Community health (stars trend, issue response, maintenance activity)
5. Best use cases
6. Potential risks or concerns

Be concise — 6-8 sentences total.`;

    try {
      const summary = await askAI(prompt);
      repo.aiSummary = summary;
      saveHub(hub);
      res.json({ summary });
    } catch (e) {
      res.json({ summary: null, error: e.message });
    }
  });

  app.post("/api/github-hub/repos/:id/ai-research", requireRole("editor"), async (req, res) => {
    const { askAIJSON } = require("../lib/ai");
    const hub = loadHub();
    const repo = hub.repos.find(r => r.id === req.params.id);
    if (!repo) return res.status(404).json({ error: "Repo not found" });

    // Load user's git projects for comparison
    let gitProjects = [];
    try {
      const gpFile = path.join(__dirname, "..", "data", "git-projects.json");
      if (fs.existsSync(gpFile)) {
        const gp = JSON.parse(fs.readFileSync(gpFile, "utf8"));
        gitProjects = (gp.projects || gp || []).map(p => ({ name: p.name, description: p.description, remoteUrl: p.remoteUrl }));
      }
    } catch {}

    const prompt = `Compare this external GitHub repository to the user's own projects and provide integration research.

External Repo: ${repo.fullName}
Description: ${repo.description}
Language: ${repo.language} | Stars: ${repo.stars} | Topics: ${(repo.topics || []).join(", ")}
Category: ${repo.category}

User's Projects:
${gitProjects.length ? gitProjects.map(p => `- ${p.name}: ${p.description || p.remoteUrl || "no description"}`).join("\n") : "No projects configured."}

Return valid JSON:
{
  "relevance": <1-10 score of how relevant this repo is to the user's work>,
  "summary": "<1-2 sentence comparison>",
  "integrationIdeas": ["<idea 1>", "<idea 2>", ...],
  "techOverlap": ["<shared tech/pattern 1>", ...],
  "risks": ["<risk 1>", ...],
  "roadmapSuggestion": "<1-2 sentence suggestion for future roadmap>"
}`;

    try {
      const research = await askAIJSON(prompt);
      repo.aiResearch = research;
      saveHub(hub);
      res.json({ research });
    } catch (e) {
      res.json({ research: null, error: e.message });
    }
  });

  app.post("/api/github-hub/ai-landscape", requireAdmin, async (req, res) => {
    const { askAI } = require("../lib/ai");
    const hub = loadHub();

    if (!hub.repos.length) return res.json({ landscape: "No repos tracked yet. Add some repos to generate a landscape analysis." });

    // Build summary data
    const byCategory = {};
    const byLanguage = {};
    hub.repos.forEach(r => {
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
      byLanguage[r.language] = (byLanguage[r.language] || 0) + 1;
    });
    const totalStars = hub.repos.reduce((s, r) => s + (r.stars || 0), 0);

    const prompt = `Analyze this developer's GitHub repository collection and provide a technology landscape assessment.

${hub.repos.length} tracked repos across ${Object.keys(byCategory).length} categories:

Categories: ${Object.entries(byCategory).map(([k, v]) => `${k} (${v})`).join(", ")}
Languages: ${Object.entries(byLanguage).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(", ")}
Total stars tracked: ${totalStars.toLocaleString()}
Top repos: ${hub.repos.slice().sort((a, b) => b.stars - a.stars).slice(0, 10).map(r => `${r.fullName} (${r.stars}★)`).join(", ")}

Provide:
1. Technology focus areas and strengths
2. Blind spots — categories or technologies underrepresented
3. Emerging trends in their collection
4. 3-5 specific repos they should consider adding (name real GitHub repos)
5. Strategic recommendations for their tech stack evolution

Be concise and actionable.`;

    try {
      const landscape = await askAI(prompt);
      res.json({ landscape });
    } catch (e) {
      res.json({ landscape: null, error: e.message });
    }
  });

  // ── Rate Limit ───────────────────────────────────────────────────────────

  app.get("/api/github-hub/rate-limit", requireAdmin, async (req, res) => {
    const hub = loadHub();
    const limits = [];

    // Public API rate limit (unauthenticated — 60/hr)
    try {
      const { data } = await githubFetch(null, "/rate_limit");
      limits.push({ accountId: null, name: "Public API (no auth)", source: "public", ...data?.rate });
    } catch (e) {
      limits.push({ accountId: null, name: "Public API (no auth)", source: "public", error: e.message });
    }

    for (const acct of hub.accounts) {
      const token = getAccountToken(hub, acct.id, vault);
      if (!token) { limits.push({ accountId: acct.id, name: acct.name, source: "account", error: "No token" }); continue; }
      try {
        const { data } = await githubFetch(token, "/rate_limit");
        limits.push({ accountId: acct.id, name: acct.name, source: "account", ...data?.rate });
      } catch (e) {
        limits.push({ accountId: acct.id, name: acct.name, source: "account", error: e.message });
      }
    }
    res.json({ limits });
  });
};
