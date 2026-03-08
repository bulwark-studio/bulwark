/**
 * Bulwark — GitHub Hub View
 * Track, categorize, research, and compare GitHub repos across multiple accounts.
 * Supports both public repos (no auth, 60 req/hr) and account-linked repos (PAT, 5000 req/hr).
 */
(function () {
  "use strict";

  let _state = {
    tab: "repos",
    repos: [],
    accounts: [],
    categories: [],
    categoryCounts: {},
    languages: [],
    filters: { category: "", accountId: "", source: "", language: "", search: "", sort: "stars", starred: false },
    selectedRepo: null,
    loading: false,
  };

  const TABS = [
    { id: "repos",      label: "Repos",      icon: "M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z" },
    { id: "accounts",   label: "Accounts",    icon: "M8 6a3 3 0 106 0 3 3 0 00-6 0zM2 17c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" },
    { id: "categories", label: "Categories",  icon: "M3 3h6v6H3zM13 3h4v4h-4zM3 13h4v4H3zM13 11h4v6h-4z" },
    { id: "research",   label: "Research",    icon: "M10 2a6 6 0 016 6c0 2.2-1.2 4.1-3 5.2V15a1 1 0 01-1 1H8a1 1 0 01-1-1v-1.8C5.2 12.1 4 10.2 4 8a6 6 0 016-6z" },
    { id: "landscape",  label: "Landscape",   icon: "M2 16l5-7 4 5 3-4 4 6z" },
  ];

  function esc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s || "")) : String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function timeAgo(d) {
    if (!d) return "—";
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  // ── API helpers ──────────────────────────────────────────────────────────

  async function api(method, path, body) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch("/api/github-hub" + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  async function loadAll() {
    _state.loading = true;
    renderTab();
    try {
      const [repoData, acctData, catData] = await Promise.all([
        api("GET", "/repos?" + buildFilterParams().toString()),
        api("GET", "/accounts"),
        api("GET", "/categories"),
      ]);
      _state.repos = repoData.repos || [];
      _state.languages = repoData.languages || [];
      _state.accounts = acctData.accounts || [];
      _state.categories = catData.categories || [];
      _state.categoryCounts = catData.counts || {};
    } catch (e) {
      console.error("[GitHub Hub] Load error:", e);
      if (typeof Toast !== "undefined") Toast.error("GitHub Hub: " + e.message);
    }
    _state.loading = false;
    renderTab();
  }

  function buildFilterParams() {
    const params = new URLSearchParams();
    Object.entries(_state.filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    return params;
  }

  async function loadRepos() {
    try {
      const data = await api("GET", "/repos?" + buildFilterParams().toString());
      _state.repos = data.repos || [];
      _state.languages = data.languages || [];
    } catch (e) {
      if (typeof Toast !== "undefined") Toast.error(e.message);
    }
    renderTab();
  }

  // ── Tab rendering ────────────────────────────────────────────────────────

  function renderTabs() {
    return `<div class="gh-tabs" style="display:flex;gap:2px;margin-bottom:16px;border-bottom:1px solid var(--border);">
      ${TABS.map(t => `
        <button class="btn btn-sm ${_state.tab === t.id ? "btn-primary" : "btn-ghost"}" onclick="Views['github-hub']._switchTab('${t.id}')"
          style="border-radius:6px 6px 0 0;border-bottom:none;${_state.tab === t.id ? "border-bottom:2px solid var(--cyan);" : ""}">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" width="14" height="14" stroke-width="1.5"><path d="${t.icon}"/></svg>
          ${t.label}
        </button>
      `).join("")}
    </div>`;
  }

  function renderTab() {
    const el = document.getElementById("view-github-hub");
    if (!el) return;

    let content = renderTabs();

    if (_state.loading) {
      content += `<div style="text-align:center;padding:40px;color:var(--text-secondary);">Loading...</div>`;
      el.innerHTML = content;
      return;
    }

    switch (_state.tab) {
      case "repos": content += renderReposTab(); break;
      case "accounts": content += renderAccountsTab(); break;
      case "categories": content += renderCategoriesTab(); break;
      case "research": content += renderResearchTab(); break;
      case "landscape": content += renderLandscapeTab(); break;
    }

    el.innerHTML = content;
  }

  // ── Repos Tab ────────────────────────────────────────────────────────────

  function renderReposTab() {
    const f = _state.filters;
    const publicCount = _state.repos.filter(r => !r.accountId).length;
    const acctCount = _state.repos.filter(r => !!r.accountId).length;
    const selCss = "padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;";

    let html = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
      <input type="text" placeholder="Search repos..." value="${esc(f.search)}" onkeyup="Views['github-hub']._setFilter('search', this.value)"
        style="flex:1;min-width:200px;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
      <select onchange="Views['github-hub']._setFilter('source', this.value)" style="${selCss}">
        <option value="">All Sources</option>
        <option value="public" ${f.source === "public" ? "selected" : ""}>Public (no auth)</option>
        <option value="account" ${f.source === "account" ? "selected" : ""}>Account-linked</option>
      </select>
      <select onchange="Views['github-hub']._setFilter('category', this.value)" style="${selCss}">
        <option value="">All Categories</option>
        ${_state.categories.map(c => `<option value="${esc(c)}" ${f.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
      </select>
      ${_state.accounts.length ? `<select onchange="Views['github-hub']._setFilter('accountId', this.value)" style="${selCss}">
        <option value="">All Accounts</option>
        ${_state.accounts.map(a => `<option value="${esc(a.id)}" ${f.accountId === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}
      </select>` : ""}
      <select onchange="Views['github-hub']._setFilter('language', this.value)" style="${selCss}">
        <option value="">All Languages</option>
        ${_state.languages.map(l => `<option value="${esc(l)}" ${f.language === l ? "selected" : ""}>${esc(l)}</option>`).join("")}
      </select>
      <select onchange="Views['github-hub']._setFilter('sort', this.value)" style="${selCss}">
        <option value="stars" ${f.sort === "stars" ? "selected" : ""}>Stars</option>
        <option value="updated" ${f.sort === "updated" ? "selected" : ""}>Updated</option>
        <option value="name" ${f.sort === "name" ? "selected" : ""}>Name</option>
        <option value="added" ${f.sort === "added" ? "selected" : ""}>Added</option>
      </select>
      <button class="btn btn-sm ${f.starred ? "btn-primary" : "btn-ghost"}" onclick="Views['github-hub']._toggleStarred()" title="Starred only">★</button>
    </div>`;

    // Action bar — separated add public vs add via account
    html += `<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap;">
      <button class="btn btn-sm btn-primary" onclick="Views['github-hub']._addPublicRepoModal()">+ Add Public Repo</button>
      ${_state.accounts.length
        ? `<button class="btn btn-sm btn-ghost" style="border-color:var(--cyan);color:var(--cyan);" onclick="Views['github-hub']._addAccountRepoModal()">+ Add via Account</button>
           <button class="btn btn-sm btn-ghost" onclick="Views['github-hub']._bulkImportModal()">Bulk Import</button>`
        : `<span style="font-size:11px;color:var(--text-tertiary);">Add a <a href="#" onclick="event.preventDefault();Views['github-hub']._switchTab('accounts')" style="color:var(--cyan);">GitHub account</a> to access private repos &amp; bulk import</span>`
      }
      <span style="flex:1;"></span>
      <span style="font-size:11px;color:var(--text-tertiary);">${_state.repos.length} repos (${publicCount} public, ${acctCount} account)</span>
    </div>`;

    if (!_state.repos.length) {
      html += `<div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <p style="font-size:14px;margin-bottom:8px;">No repos tracked yet</p>
        <p style="font-size:12px;">Add any public repo by URL — no GitHub account needed.<br>
        Connect an account for private repos and bulk import.</p>
      </div>`;
      return html;
    }

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px;">`;
    for (const r of _state.repos) {
      const acct = r.accountId ? _state.accounts.find(a => a.id === r.accountId) : null;
      const sourceBadge = r.accountId
        ? `<span style="font-size:9px;padding:1px 5px;background:rgba(34,211,238,0.12);color:var(--cyan);border-radius:3px;" title="via ${esc(acct?.name || "account")}">${esc(acct?.name || "account")}</span>`
        : `<span style="font-size:9px;padding:1px 5px;background:rgba(255,255,255,0.06);color:var(--text-tertiary);border-radius:3px;">PUBLIC</span>`;

      html += `<div class="card" style="padding:14px;position:relative;cursor:pointer;" onclick="Views['github-hub']._selectRepo('${r.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div style="min-width:0;flex:1;">
            <div style="font-weight:600;font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(r.fullName)}">${esc(r.fullName)}</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;display:flex;gap:6px;align-items:center;">
              ${sourceBadge}
              <span>${esc(r.category || "")}</span>
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;align-items:center;">
            <span style="cursor:pointer;font-size:14px;color:${r.starred ? "var(--cyan)" : "var(--text-tertiary)"};" onclick="event.stopPropagation();Views['github-hub']._toggleStar('${r.id}')" title="Star">★</span>
            ${r.isPrivate ? '<span style="font-size:9px;padding:1px 5px;background:var(--orange);color:#fff;border-radius:3px;">PRIVATE</span>' : ""}
            <span style="cursor:pointer;font-size:13px;color:var(--text-tertiary);padding:0 2px;" onclick="event.stopPropagation();Views['github-hub']._deleteRepo('${r.id}')" title="Remove repo">×</span>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;max-height:30px;overflow:hidden;">${esc(r.description || "No description")}</div>
        <div style="display:flex;gap:10px;font-size:11px;color:var(--text-tertiary);flex-wrap:wrap;">
          <span style="color:var(--cyan);">★ ${(r.stars || 0).toLocaleString()}</span>
          <span>⑂ ${r.forks || 0}</span>
          <span>${esc(r.language || "")}</span>
          <span title="${r.pushedAt || ""}">${timeAgo(r.pushedAt)}</span>
          ${r.archived ? '<span style="color:var(--orange);">archived</span>' : ""}
        </div>
        ${(r.topics || []).length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">${r.topics.slice(0, 5).map(t => `<span style="font-size:9px;padding:1px 5px;background:rgba(34,211,238,0.1);color:var(--cyan);border-radius:3px;">${esc(t)}</span>`).join("")}</div>` : ""}
        ${r.aiSummary ? '<div style="margin-top:6px;font-size:9px;color:var(--cyan);">AI Summary available</div>' : ""}
      </div>`;
    }
    html += `</div>`;
    return html;
  }

  // ── Accounts Tab ─────────────────────────────────────────────────────────

  function renderAccountsTab() {
    const publicRepoCount = _state.repos.filter(r => !r.accountId).length;

    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:13px;color:var(--text-secondary);">${_state.accounts.length} account(s) + Public API</span>
      <button class="btn btn-sm btn-primary" onclick="Views['github-hub']._addAccountModal()">+ Add Account</button>
    </div>`;

    // Public API card — always shown
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:16px;">
      <div class="card" style="padding:14px;border-left:3px solid var(--text-tertiary);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Public API</div>
            <div style="font-size:11px;color:var(--text-tertiary);">No authentication · 60 requests/hour</div>
          </div>
          <span style="font-size:11px;padding:2px 8px;background:rgba(255,255,255,0.06);color:var(--text-secondary);border-radius:4px;">${publicRepoCount} repos</span>
        </div>
        <div style="font-size:10px;color:var(--text-tertiary);">Add any public repo by URL without connecting an account. Lower rate limit but zero setup.</div>
      </div>
    </div>`;

    if (!_state.accounts.length) {
      html += `<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);">
        <p style="font-size:13px;margin-bottom:6px;">No authenticated accounts yet</p>
        <p style="font-size:11px;">Connect a GitHub account for private repos, bulk import, and 5000 req/hr rate limit.</p>
      </div>`;
    } else {
      html += `<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Authenticated Accounts</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">`;
      for (const a of _state.accounts) {
        const repoCount = _state.repos.filter(r => r.accountId === a.id).length;
        html += `<div class="card" style="padding:14px;border-left:3px solid var(--cyan);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${esc(a.name)}</div>
              <div style="font-size:11px;color:var(--text-tertiary);">@${esc(a.username || "unknown")} · ${esc(a.label || "personal")} · 5000 req/hr</div>
            </div>
            <span style="font-size:11px;padding:2px 8px;background:rgba(34,211,238,0.1);color:var(--cyan);border-radius:4px;">${repoCount} repos</span>
          </div>
          <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:10px;">Added ${new Date(a.addedAt).toLocaleDateString()} · Validated ${timeAgo(a.lastValidated)}</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-ghost" onclick="Views['github-hub']._validateAccount('${a.id}')">Validate</button>
            <button class="btn btn-sm btn-ghost" onclick="Views['github-hub']._editAccountModal('${a.id}')">Edit</button>
            <button class="btn btn-sm btn-ghost" style="color:var(--orange);" onclick="Views['github-hub']._deleteAccount('${a.id}')">Delete</button>
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    // Rate limits
    html += `<div style="margin-top:24px;">
      <button class="btn btn-sm btn-ghost" onclick="Views['github-hub']._checkRateLimits()">Check Rate Limits</button>
      <div id="gh-rate-limits" style="margin-top:10px;"></div>
    </div>`;

    return html;
  }

  // ── Categories Tab ───────────────────────────────────────────────────────

  function renderCategoriesTab() {
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:13px;color:var(--text-secondary);">${_state.categories.length} categories</span>
      <button class="btn btn-sm btn-primary" onclick="Views['github-hub']._addCategoryModal()">+ Add Category</button>
    </div>`;

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">`;
    for (const c of _state.categories) {
      const count = _state.categoryCounts[c] || 0;
      html += `<div class="card" style="padding:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${esc(c)}</div>
          <div style="font-size:11px;color:var(--text-tertiary);">${count} repo${count !== 1 ? "s" : ""}</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-ghost" onclick="Views['github-hub']._filterByCategory('${esc(c)}')" title="Filter repos">View</button>
          ${c !== "Uncategorized" ? `<button class="btn btn-sm btn-ghost" style="color:var(--orange);" onclick="Views['github-hub']._deleteCategory('${esc(c)}')" title="Delete">×</button>` : ""}
        </div>
      </div>`;
    }
    html += `</div>`;
    return html;
  }

  // ── Research Tab ─────────────────────────────────────────────────────────

  function renderResearchTab() {
    let html = `<div style="margin-bottom:16px;">
      <select id="gh-research-repo" onchange="Views['github-hub']._selectResearchRepo(this.value)"
        style="padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;min-width:300px;">
        <option value="">Select a repo to research...</option>
        ${_state.repos.map(r => `<option value="${r.id}" ${_state.selectedRepo?.id === r.id ? "selected" : ""}>${esc(r.fullName)}${r.accountId ? "" : " (public)"}</option>`).join("")}
      </select>
    </div>`;

    const repo = _state.selectedRepo;
    if (!repo) {
      html += `<div style="text-align:center;padding:40px;color:var(--text-secondary);">Select a repo above to view AI research and analysis.</div>`;
      return html;
    }

    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">`;

    // AI Summary card
    html += `<div class="card" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-weight:600;font-size:13px;color:var(--text-primary);">AI Summary</span>
        <button class="btn btn-sm btn-primary" onclick="Views['github-hub']._runAISummary('${repo.id}')">Generate</button>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.5;" id="gh-ai-summary">
        ${repo.aiSummary ? esc(repo.aiSummary) : '<span style="color:var(--text-tertiary);">No summary yet. Click Generate to analyze this repo.</span>'}
      </div>
    </div>`;

    // AI Research card
    html += `<div class="card" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-weight:600;font-size:13px;color:var(--text-primary);">Integration Research</span>
        <button class="btn btn-sm btn-primary" onclick="Views['github-hub']._runAIResearch('${repo.id}')">Analyze</button>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;" id="gh-ai-research">
        ${repo.aiResearch ? renderResearchResult(repo.aiResearch) : '<span style="color:var(--text-tertiary);">No research yet. Click Analyze to compare with your projects.</span>'}
      </div>
    </div>`;

    html += `</div>`;

    // Notes section
    html += `<div class="card" style="padding:14px;margin-top:16px;">
      <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:8px;">Notes & Roadmap Ideas</div>
      <textarea id="gh-repo-notes" style="width:100%;min-height:80px;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;font-family:'JetBrains Mono',monospace;resize:vertical;"
        onchange="Views['github-hub']._saveNotes('${repo.id}', this.value)">${esc(repo.notes || "")}</textarea>
    </div>`;

    return html;
  }

  function renderResearchResult(r) {
    if (!r || typeof r !== "object") return esc(String(r));
    let html = "";
    if (r.relevance !== undefined) {
      const color = r.relevance >= 7 ? "var(--cyan)" : r.relevance >= 4 ? "var(--text-secondary)" : "var(--orange)";
      html += `<div style="margin-bottom:8px;">Relevance: <span style="font-weight:700;color:${color};">${r.relevance}/10</span></div>`;
    }
    if (r.summary) html += `<div style="margin-bottom:8px;">${esc(r.summary)}</div>`;
    if (r.integrationIdeas?.length) {
      html += `<div style="margin-bottom:6px;font-weight:600;font-size:11px;color:var(--text-primary);">Integration Ideas:</div><ul style="margin:0 0 8px 16px;padding:0;">`;
      r.integrationIdeas.forEach(i => { html += `<li style="margin-bottom:3px;">${esc(i)}</li>`; });
      html += `</ul>`;
    }
    if (r.techOverlap?.length) {
      html += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">`;
      r.techOverlap.forEach(t => { html += `<span style="font-size:9px;padding:1px 5px;background:rgba(34,211,238,0.1);color:var(--cyan);border-radius:3px;">${esc(t)}</span>`; });
      html += `</div>`;
    }
    if (r.roadmapSuggestion) html += `<div style="margin-top:6px;font-size:11px;color:var(--cyan);"><strong>Roadmap:</strong> ${esc(r.roadmapSuggestion)}</div>`;
    return html;
  }

  // ── Landscape Tab ────────────────────────────────────────────────────────

  function renderLandscapeTab() {
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:13px;color:var(--text-secondary);">${_state.repos.length} repos across ${_state.categories.length} categories</span>
      <button class="btn btn-sm btn-primary" onclick="Views['github-hub']._runLandscape()">Generate Landscape</button>
    </div>`;

    // Stats overview
    const totalStars = _state.repos.reduce((s, r) => s + (r.stars || 0), 0);
    const publicCount = _state.repos.filter(r => !r.accountId).length;
    const acctCount = _state.repos.filter(r => !!r.accountId).length;
    const byLang = {};
    _state.repos.forEach(r => { byLang[r.language || "Unknown"] = (byLang[r.language || "Unknown"] || 0) + 1; });
    const topLangs = Object.entries(byLang).sort((a, b) => b[1] - a[1]).slice(0, 8);

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px;">
      <div class="card" style="padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:var(--cyan);">${_state.repos.length}</div>
        <div style="font-size:10px;color:var(--text-tertiary);">Total Repos</div>
      </div>
      <div class="card" style="padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:var(--text-secondary);">${publicCount}</div>
        <div style="font-size:10px;color:var(--text-tertiary);">Public</div>
      </div>
      <div class="card" style="padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:var(--cyan);">${acctCount}</div>
        <div style="font-size:10px;color:var(--text-tertiary);">Account</div>
      </div>
      <div class="card" style="padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:var(--cyan);">${totalStars.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--text-tertiary);">Total Stars</div>
      </div>
      <div class="card" style="padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:var(--cyan);">${Object.keys(byLang).length}</div>
        <div style="font-size:10px;color:var(--text-tertiary);">Languages</div>
      </div>
    </div>`;

    // Language breakdown
    if (topLangs.length) {
      html += `<div class="card" style="padding:14px;margin-bottom:16px;">
        <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:10px;">Language Distribution</div>
        ${topLangs.map(([lang, count]) => {
          const pct = Math.round((count / _state.repos.length) * 100);
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:11px;color:var(--text-secondary);min-width:80px;">${esc(lang)}</span>
            <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:var(--cyan);border-radius:3px;"></div>
            </div>
            <span style="font-size:10px;color:var(--text-tertiary);min-width:30px;text-align:right;">${count}</span>
          </div>`;
        }).join("")}
      </div>`;
    }

    // Category breakdown
    html += `<div class="card" style="padding:14px;margin-bottom:16px;">
      <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:10px;">Category Breakdown</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${_state.categories.map(c => {
          const count = _state.categoryCounts[c] || 0;
          return count > 0 ? `<div style="padding:6px 12px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);border-radius:6px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">${esc(c)}</div>
            <div style="font-size:10px;color:var(--cyan);">${count} repos</div>
          </div>` : "";
        }).join("")}
      </div>
    </div>`;

    // AI Landscape
    html += `<div class="card" style="padding:14px;">
      <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:10px;">AI Landscape Analysis</div>
      <div id="gh-landscape-result" style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.5;">
        Click "Generate Landscape" to get AI-powered analysis of your repo collection.
      </div>
    </div>`;

    return html;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  function _switchTab(tab) {
    _state.tab = tab;
    renderTab();
  }

  function _setFilter(key, val) {
    _state.filters[key] = val;
    if (key === "search") {
      clearTimeout(_state._searchTimeout);
      _state._searchTimeout = setTimeout(() => loadRepos(), 300);
    } else {
      loadRepos();
    }
  }

  function _toggleStarred() {
    _state.filters.starred = !_state.filters.starred;
    loadRepos();
  }

  function _filterByCategory(cat) {
    _state.filters.category = cat;
    _state.tab = "repos";
    loadRepos();
  }

  async function _toggleStar(id) {
    const repo = _state.repos.find(r => r.id === id);
    if (!repo) return;
    try {
      await api("PUT", "/repos/" + id, { starred: !repo.starred });
      repo.starred = !repo.starred;
      renderTab();
    } catch (e) {
      Toast.error(e.message);
    }
  }

  function _selectRepo(id) {
    _state.selectedRepo = _state.repos.find(r => r.id === id) || null;
    _state.tab = "research";
    renderTab();
  }

  function _selectResearchRepo(id) {
    _state.selectedRepo = _state.repos.find(r => r.id === id) || null;
    renderTab();
  }

  // ── Modals ───────────────────────────────────────────────────────────────

  // PUBLIC repo — no account needed, uses unauthenticated GitHub API
  function _addPublicRepoModal() {
    Modal.open({
      title: "Add Public Repository",
      body: `
        <div style="display:grid;gap:12px;">
          <div style="font-size:11px;color:var(--text-tertiary);padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid var(--border);">
            No GitHub account required. Uses public API (60 requests/hour).<br>
            Only works for public repos — use "Add via Account" for private repos.
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Repo URL or owner/repo</label>
            <input type="text" id="gh-add-url" placeholder="e.g. vercel/next.js or https://github.com/vercel/next.js"
              style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Category</label>
            <select id="gh-add-category" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
              ${_state.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Notes (optional)</label>
            <textarea id="gh-add-notes" rows="2" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;resize:vertical;"></textarea>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-primary" onclick="Views['github-hub']._addRepo(false)">Add Public Repo</button>
               <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>`,
    });
  }

  // ACCOUNT repo — requires linked account, uses authenticated API
  function _addAccountRepoModal() {
    if (!_state.accounts.length) {
      Toast.error("Add a GitHub account first (Accounts tab)");
      return;
    }
    Modal.open({
      title: "Add Repo via Account",
      body: `
        <div style="display:grid;gap:12px;">
          <div style="font-size:11px;color:var(--cyan);padding:8px 10px;background:rgba(34,211,238,0.06);border-radius:6px;border:1px solid rgba(34,211,238,0.15);">
            Uses authenticated API (5000 req/hr). Can access private repos.
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Repo URL or owner/repo</label>
            <input type="text" id="gh-add-url" placeholder="e.g. myorg/private-repo or https://github.com/myorg/private-repo"
              style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Account</label>
            <select id="gh-add-account" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
              ${_state.accounts.map(a => `<option value="${a.id}">${esc(a.name)} (@${esc(a.username || "")})</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Category</label>
            <select id="gh-add-category" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
              ${_state.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Notes (optional)</label>
            <textarea id="gh-add-notes" rows="2" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;resize:vertical;"></textarea>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-primary" onclick="Views['github-hub']._addRepo(true)">Add via Account</button>
               <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>`,
    });
  }

  async function _addRepo(useAccount) {
    const urlEl = document.getElementById("gh-add-url");
    const url = urlEl?.value?.trim();
    const category = document.getElementById("gh-add-category")?.value || "";
    const notes = document.getElementById("gh-add-notes")?.value || "";
    const accountId = useAccount ? document.getElementById("gh-add-account")?.value : null;
    console.log("[GitHub Hub] _addRepo:", { url, category, useAccount, accountId });
    if (!url) { Toast.error("Enter a repo URL"); return; }
    Modal.loading("Fetching repo info from GitHub...");
    try {
      const body = { url, category, notes };
      if (accountId) body.accountId = accountId;
      const result = await api("POST", "/repos", body);
      Modal.close();
      Toast.success("Repo added: " + (result.repo?.fullName || url));
      loadAll();
    } catch (e) {
      console.error("[GitHub Hub] Add repo failed:", e);
      Modal.close();
      Toast.error(e.message || "Failed to add repo");
    }
  }

  function _bulkImportModal() {
    if (!_state.accounts.length) {
      Toast.error("Bulk import requires a GitHub account");
      return;
    }
    Modal.open({
      title: "Bulk Import Repos",
      body: `
        <div style="display:grid;gap:12px;">
          <div style="font-size:11px;color:var(--cyan);padding:8px 10px;background:rgba(34,211,238,0.06);border-radius:6px;border:1px solid rgba(34,211,238,0.15);">
            Requires authenticated account. Imports up to 1000 repos. Duplicates skipped.
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Account</label>
            <select id="gh-bulk-account" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
              ${_state.accounts.map(a => `<option value="${a.id}">${esc(a.name)} (@${esc(a.username || "")})</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Import Type</label>
            <select id="gh-bulk-filter" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
              <option value="owner">My repos (owner)</option>
              <option value="all">All repos (including collabs)</option>
              <option value="starred">Starred repos</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Category</label>
            <select id="gh-bulk-category" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
              ${_state.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
            </select>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-primary" onclick="Views['github-hub']._bulkImport()">Import</button>
               <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>`,
    });
  }

  async function _bulkImport() {
    const accountId = document.getElementById("gh-bulk-account")?.value;
    const filter = document.getElementById("gh-bulk-filter")?.value;
    const category = document.getElementById("gh-bulk-category")?.value;
    Modal.loading("Importing repos (this may take a moment)...");
    try {
      const data = await api("POST", "/repos/bulk", { accountId, filter, category });
      Modal.close();
      Toast.success(`Imported ${data.added} repos (${data.skipped} skipped)`);
      loadAll();
    } catch (e) {
      Modal.close();
      Toast.error(e.message);
    }
  }

  function _addAccountModal() {
    Modal.open({
      title: "Add GitHub Account",
      body: `
        <div style="display:grid;gap:12px;">
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Account Name</label>
            <input type="text" id="gh-acct-name" placeholder="e.g. Personal, Work, Client"
              style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Label</label>
            <select id="gh-acct-label" style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
              <option value="personal">Personal</option>
              <option value="work">Work</option>
              <option value="org">Organization</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Personal Access Token</label>
            <input type="password" id="gh-acct-token" placeholder="ghp_..."
              style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
            <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px;">Needs repo scope. Token is encrypted in the credential vault.</div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-primary" onclick="Views['github-hub']._addAccount()">Add Account</button>
               <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>`,
    });
  }

  async function _addAccount() {
    const name = document.getElementById("gh-acct-name")?.value;
    const label = document.getElementById("gh-acct-label")?.value;
    const token = document.getElementById("gh-acct-token")?.value;
    if (!name || !token) { Toast.error("Name and token are required"); return; }
    Modal.loading("Validating token...");
    try {
      const data = await api("POST", "/accounts", { name, label, token });
      Modal.close();
      Toast.success(`Account added: @${data.username}`);
      loadAll();
    } catch (e) {
      Modal.close();
      Toast.error(e.message);
    }
  }

  function _editAccountModal(id) {
    const acct = _state.accounts.find(a => a.id === id);
    if (!acct) return;
    Modal.open({
      title: "Edit Account: " + acct.name,
      body: `
        <div style="display:grid;gap:12px;">
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Account Name</label>
            <input type="text" id="gh-edit-name" value="${esc(acct.name)}"
              style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Label</label>
            <input type="text" id="gh-edit-label" value="${esc(acct.label || "")}"
              style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">New Token (leave blank to keep current)</label>
            <input type="password" id="gh-edit-token" placeholder="ghp_..."
              style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">
          </div>
        </div>
      `,
      footer: `<button class="btn btn-primary" onclick="Views['github-hub']._editAccount('${id}')">Save</button>
               <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>`,
    });
  }

  async function _editAccount(id) {
    const name = document.getElementById("gh-edit-name")?.value;
    const label = document.getElementById("gh-edit-label")?.value;
    const token = document.getElementById("gh-edit-token")?.value;
    Modal.loading("Saving...");
    try {
      const body = { name, label };
      if (token) body.token = token;
      await api("PUT", "/accounts/" + id, body);
      Modal.close();
      Toast.success("Account updated");
      loadAll();
    } catch (e) {
      Modal.close();
      Toast.error(e.message);
    }
  }

  async function _deleteAccount(id) {
    const acct = _state.accounts.find(a => a.id === id);
    if (!acct) return;
    const ok = await Modal.confirm({
      title: "Delete Account",
      message: `Delete "${acct.name}" and all its tracked repos?`,
      confirmText: "Delete",
      dangerous: true,
    });
    if (!ok) return;
    try {
      await api("DELETE", "/accounts/" + id);
      Toast.success("Account deleted");
      loadAll();
    } catch (e) {
      Toast.error(e.message);
    }
  }

  async function _validateAccount(id) {
    try {
      const data = await api("POST", "/accounts/" + id + "/validate");
      if (data.valid) {
        Toast.success(`Token valid: @${data.username}`);
        loadAll();
      } else {
        Toast.error("Token invalid: " + (data.error || "unknown"));
      }
    } catch (e) {
      Toast.error(e.message);
    }
  }

  async function _checkRateLimits() {
    const el = document.getElementById("gh-rate-limits");
    if (!el) return;
    el.innerHTML = '<span style="color:var(--text-tertiary);font-size:11px;">Checking...</span>';
    try {
      const data = await api("GET", "/rate-limit");
      el.innerHTML = (data.limits || []).map(l => {
        if (l.error) return `<div style="font-size:11px;margin-bottom:4px;"><span style="color:var(--text-primary);">${esc(l.name)}</span>: <span style="color:var(--orange);">${esc(l.error)}</span></div>`;
        const pct = Math.round((l.remaining / (l.limit || 5000)) * 100);
        const color = pct > 50 ? "var(--cyan)" : pct > 20 ? "var(--text-secondary)" : "var(--orange)";
        return `<div style="font-size:11px;margin-bottom:4px;">
          <span style="color:var(--text-primary);">${esc(l.name)}</span>:
          <span style="color:${color};">${l.remaining}/${l.limit}</span>
          (resets ${new Date((l.reset || 0) * 1000).toLocaleTimeString()})
        </div>`;
      }).join("");
    } catch (e) {
      el.innerHTML = `<span style="color:var(--orange);font-size:11px;">${esc(e.message)}</span>`;
    }
  }

  function _addCategoryModal() {
    Modal.open({
      title: "Add Category",
      body: `<input type="text" id="gh-cat-name" placeholder="Category name"
        style="width:100%;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;">`,
      footer: `<button class="btn btn-primary" onclick="Views['github-hub']._addCategory()">Add</button>
               <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>`,
    });
  }

  async function _addCategory() {
    const name = document.getElementById("gh-cat-name")?.value;
    if (!name) { Toast.error("Enter a name"); return; }
    try {
      await api("POST", "/categories", { name });
      Modal.close();
      Toast.success("Category added");
      loadAll();
    } catch (e) {
      Modal.close();
      Toast.error(e.message);
    }
  }

  async function _deleteCategory(name) {
    const ok = await Modal.confirm({
      title: "Delete Category",
      message: `Delete "${name}"? Repos will move to Uncategorized.`,
      confirmText: "Delete",
      dangerous: true,
    });
    if (!ok) return;
    try {
      await api("DELETE", "/categories/" + encodeURIComponent(name));
      Toast.success("Category deleted");
      loadAll();
    } catch (e) {
      Toast.error(e.message);
    }
  }

  async function _deleteRepo(id) {
    const repo = _state.repos.find(r => r.id === id);
    if (!repo) return;
    const ok = await Modal.confirm({
      title: "Remove Repository",
      message: `Remove "${repo.fullName}" from tracking?`,
      confirmText: "Remove",
      dangerous: true,
    });
    if (!ok) return;
    try {
      await api("DELETE", "/repos/" + id);
      Toast.success("Repo removed");
      loadAll();
    } catch (e) {
      Toast.error(e.message);
    }
  }

  async function _saveNotes(id, notes) {
    try {
      await api("PUT", "/repos/" + id, { notes });
      const repo = _state.repos.find(r => r.id === id);
      if (repo) repo.notes = notes;
      if (_state.selectedRepo?.id === id) _state.selectedRepo.notes = notes;
    } catch (e) {
      Toast.error(e.message);
    }
  }

  // ── AI Actions ───────────────────────────────────────────────────────────

  async function _runAISummary(id) {
    const el = document.getElementById("gh-ai-summary");
    if (el) el.innerHTML = '<span style="color:var(--cyan);">Generating AI summary...</span>';
    try {
      const data = await api("POST", "/repos/" + id + "/ai-summary");
      if (data.error) {
        if (el) el.innerHTML = `<span style="color:var(--orange);">${esc(data.error)}</span>`;
        return;
      }
      const repo = _state.repos.find(r => r.id === id);
      if (repo) repo.aiSummary = data.summary;
      if (_state.selectedRepo?.id === id) _state.selectedRepo.aiSummary = data.summary;
      if (el) el.textContent = data.summary;
      Toast.success("AI summary generated");
    } catch (e) {
      if (el) el.innerHTML = `<span style="color:var(--orange);">${esc(e.message)}</span>`;
    }
  }

  async function _runAIResearch(id) {
    const el = document.getElementById("gh-ai-research");
    if (el) el.innerHTML = '<span style="color:var(--cyan);">Analyzing and comparing to your projects...</span>';
    try {
      const data = await api("POST", "/repos/" + id + "/ai-research");
      if (data.error) {
        if (el) el.innerHTML = `<span style="color:var(--orange);">${esc(data.error)}</span>`;
        return;
      }
      const repo = _state.repos.find(r => r.id === id);
      if (repo) repo.aiResearch = data.research;
      if (_state.selectedRepo?.id === id) _state.selectedRepo.aiResearch = data.research;
      if (el) el.innerHTML = renderResearchResult(data.research);
      Toast.success("Research analysis complete");
    } catch (e) {
      if (el) el.innerHTML = `<span style="color:var(--orange);">${esc(e.message)}</span>`;
    }
  }

  async function _runLandscape() {
    const el = document.getElementById("gh-landscape-result");
    if (el) el.innerHTML = '<span style="color:var(--cyan);">Generating landscape analysis...</span>';
    try {
      const data = await api("POST", "/ai-landscape");
      if (data.error) {
        if (el) el.innerHTML = `<span style="color:var(--orange);">${esc(data.error)}</span>`;
        return;
      }
      if (el) el.textContent = data.landscape || "No analysis generated.";
      Toast.success("Landscape analysis complete");
    } catch (e) {
      if (el) el.innerHTML = `<span style="color:var(--orange);">${esc(e.message)}</span>`;
    }
  }

  // ── View Registration ────────────────────────────────────────────────────

  window.Views = window.Views || {};
  Views["github-hub"] = {
    init() {
      const el = document.getElementById("view-github-hub");
      if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">Loading GitHub Hub...</div>';
    },
    show() { loadAll(); },
    hide() {},
    update() {},

    // Expose actions for onclick handlers
    _switchTab, _setFilter, _toggleStarred, _filterByCategory, _toggleStar,
    _selectRepo, _selectResearchRepo,
    _addPublicRepoModal, _addAccountRepoModal, _addRepo, _bulkImportModal, _bulkImport, _deleteRepo,
    _addAccountModal, _addAccount, _editAccountModal, _editAccount,
    _deleteAccount, _validateAccount, _checkRateLimits,
    _addCategoryModal, _addCategory, _deleteCategory,
    _saveNotes,
    _runAISummary, _runAIResearch, _runLandscape,
  };
})();
