/**
 * DB Assistant — AI-powered database intelligence
 * Claude chat with full schema context, diagnostics engine, deploy readiness
 */
const fs = require("fs");
const path = require("path");
const { getProjectPool, readProjects } = require("../lib/db");
const { execCommand } = require("../lib/exec");

const DATA_DIR = path.join(__dirname, "..", "data");

module.exports = function (app, ctx) {
  const { pool, vpsPool, requireAdmin, REPO_DIR } = ctx;

  function getPool(req) {
    if (req.query.project) {
      const p = getProjectPool(req.query.project);
      if (p) return p;
    }
    if (req.query.pool === "vps" && vpsPool) return vpsPool;
    return pool;
  }

  async function q(p, sql, params = []) {
    if (!p) throw new Error("Database not connected");
    const res = await p.query(sql, params);
    return res.rows;
  }

  // ── Schema Context (injected into every AI prompt) ──────────────────────────

  async function getSchemaContext(p) {
    const tables = await q(p, `
      SELECT t.tablename as name, c.reltuples::bigint as rows,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))) as size
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
      WHERE t.schemaname = 'public' ORDER BY t.tablename
    `);

    const columns = await q(p, `
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
        EXISTS(
          SELECT 1 FROM information_schema.key_column_usage kcu
          JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY' AND kcu.table_name = c.table_name
            AND kcu.column_name = c.column_name AND kcu.table_schema = 'public'
        ) as is_pk
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' ORDER BY table_name, ordinal_position
    `);

    const indexes = await q(p, `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`);

    const fks = await q(p, `
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    `);

    // Build concise schema text
    const colsByTable = {};
    columns.forEach(c => {
      if (!colsByTable[c.table_name]) colsByTable[c.table_name] = [];
      colsByTable[c.table_name].push(c);
    });

    let schemaText = "";
    tables.forEach(t => {
      schemaText += `\n-- ${t.name} (${t.rows} rows, ${t.size})\n`;
      (colsByTable[t.name] || []).forEach(c => {
        let line = `  ${c.column_name} ${c.udt_name || c.data_type}`;
        if (c.is_pk) line += " PK";
        if (c.is_nullable === "NO") line += " NOT NULL";
        if (c.column_default) line += ` DEFAULT ${c.column_default}`;
        schemaText += line + "\n";
      });
    });

    return { tables, columns, indexes, fks, schemaText };
  }

  // ── Diagnostics Engine (10 checks) ──────────────────────────────────────────

  async function runDiagnostics(p) {
    const checks = [];

    // 1. Cache hit ratio
    try {
      const [r] = await q(p, `SELECT COALESCE(sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 1) as ratio FROM pg_statio_user_tables`);
      const v = (parseFloat(r.ratio) * 100);
      checks.push({ id: "cache_hit", name: "Cache Hit Ratio", value: v.toFixed(1) + "%", status: v > 95 ? "good" : v > 80 ? "warn" : "bad", detail: v > 95 ? "Excellent — most reads served from memory" : "Low cache hits — consider increasing shared_buffers" });
    } catch (e) { checks.push({ id: "cache_hit", name: "Cache Hit Ratio", value: "?", status: "error", detail: e.message }); }

    // 2. Index usage ratio
    try {
      const [r] = await q(p, `SELECT COALESCE(sum(idx_scan)::numeric / NULLIF(sum(idx_scan) + sum(seq_scan), 0), 0) as ratio FROM pg_stat_user_tables`);
      const v = (parseFloat(r.ratio) * 100);
      checks.push({ id: "idx_usage", name: "Index Usage", value: v.toFixed(1) + "%", status: v > 80 ? "good" : v > 50 ? "warn" : "bad", detail: v > 80 ? "Queries use indexes effectively" : "Too many sequential scans — add indexes on queried columns" });
    } catch (e) { checks.push({ id: "idx_usage", name: "Index Usage", value: "?", status: "error", detail: e.message }); }

    // 3. Missing FK indexes
    try {
      const rows = await q(p, `
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        AND NOT EXISTS (
          SELECT 1 FROM pg_indexes pi
          WHERE pi.tablename = kcu.table_name AND pi.schemaname = 'public'
          AND pi.indexdef LIKE '%' || kcu.column_name || '%'
        )
      `);
      checks.push({ id: "fk_indexes", name: "FK Indexes", value: rows.length === 0 ? "All covered" : rows.length + " missing", status: rows.length === 0 ? "good" : "warn", detail: rows.length ? rows.slice(0, 8).map(r => r.table_name + "." + r.column_name).join(", ") + (rows.length > 8 ? "..." : "") : "Every foreign key column has an index", items: rows, fixable: rows.length > 0 });
    } catch (e) { checks.push({ id: "fk_indexes", name: "FK Indexes", value: "?", status: "error", detail: e.message }); }

    // 4. Tables without primary keys
    try {
      const rows = await q(p, `
        SELECT t.tablename FROM pg_tables t WHERE t.schemaname = 'public'
        AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc WHERE tc.table_name = t.tablename AND tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public')
      `);
      checks.push({ id: "no_pk", name: "Primary Keys", value: rows.length === 0 ? "All present" : rows.length + " missing", status: rows.length === 0 ? "good" : "warn", detail: rows.length ? "No PK: " + rows.slice(0, 5).map(r => r.tablename).join(", ") : "Every table has a primary key" });
    } catch (e) { checks.push({ id: "no_pk", name: "Primary Keys", value: "?", status: "error", detail: e.message }); }

    // 5. Table bloat (dead tuples)
    try {
      const rows = await q(p, `
        SELECT relname, n_dead_tup, n_live_tup, ROUND(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 1) as dead_pct
        FROM pg_stat_user_tables WHERE n_dead_tup > 100 ORDER BY n_dead_tup DESC LIMIT 10
      `);
      const bloated = rows.filter(r => parseFloat(r.dead_pct || 0) > 10);
      checks.push({ id: "bloat", name: "Table Bloat", value: bloated.length === 0 ? "Clean" : bloated.length + " bloated", status: bloated.length === 0 ? "good" : "warn", detail: bloated.length ? bloated.slice(0, 4).map(r => r.relname + " (" + r.dead_pct + "% dead)").join(", ") : "No significant dead tuple buildup", fixable: bloated.length > 0 });
    } catch (e) { checks.push({ id: "bloat", name: "Table Bloat", value: "?", status: "error", detail: e.message }); }

    // 6. Unused indexes (wasting disk + slowing writes)
    try {
      const rows = await q(p, `
        SELECT s.relname as "table", s.indexrelname as "index", pg_size_pretty(pg_relation_size(s.indexrelid)) as size
        FROM pg_stat_user_indexes s JOIN pg_index i ON s.indexrelid = i.indexrelid
        WHERE s.idx_scan = 0 AND NOT i.indisunique AND s.schemaname = 'public'
        ORDER BY pg_relation_size(s.indexrelid) DESC LIMIT 15
      `);
      checks.push({ id: "unused_idx", name: "Unused Indexes", value: rows.length === 0 ? "None" : rows.length + " unused", status: rows.length === 0 ? "good" : rows.length > 5 ? "warn" : "info", detail: rows.length ? rows.slice(0, 4).map(r => r.index + " (" + r.size + ")").join(", ") : "All indexes are being used", items: rows, fixable: rows.length > 0 });
    } catch (e) { checks.push({ id: "unused_idx", name: "Unused Indexes", value: "?", status: "error", detail: e.message }); }

    // 7. Connection pressure
    try {
      const [r] = await q(p, `
        SELECT count(*) as total, count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_conn
        FROM pg_stat_activity
      `);
      const pct = parseInt(r.total) / parseInt(r.max_conn) * 100;
      checks.push({ id: "connections", name: "Connections", value: r.total + "/" + r.max_conn + " (" + pct.toFixed(0) + "%)", status: pct < 70 ? "good" : pct < 90 ? "warn" : "bad", detail: r.active + " active, " + r.idle + " idle" });
    } catch (e) { checks.push({ id: "connections", name: "Connections", value: "?", status: "error", detail: e.message }); }

    // 8. Long-running queries (> 30s)
    try {
      const rows = await q(p, `
        SELECT pid, EXTRACT(EPOCH FROM now() - query_start)::int as seconds, LEFT(query, 100) as query
        FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '30 seconds' ORDER BY query_start LIMIT 5
      `);
      checks.push({ id: "long_queries", name: "Long Queries", value: rows.length === 0 ? "None" : rows.length + " running >30s", status: rows.length === 0 ? "good" : "warn", detail: rows.length ? rows.map(r => "PID " + r.pid + " (" + r.seconds + "s)").join(", ") : "No long-running queries detected" });
    } catch (e) { checks.push({ id: "long_queries", name: "Long Queries", value: "?", status: "error", detail: e.message }); }

    // 9. Sequence scans on large tables
    try {
      const rows = await q(p, `
        SELECT relname, seq_scan, idx_scan, pg_size_pretty(pg_relation_size(relid)) as size
        FROM pg_stat_user_tables WHERE seq_scan > 50 AND pg_relation_size(relid) > 5242880
        ORDER BY seq_scan DESC LIMIT 8
      `);
      const bad = rows.filter(r => parseInt(r.seq_scan) > parseInt(r.idx_scan || 0) * 2);
      checks.push({ id: "seq_scans", name: "Seq Scans", value: bad.length === 0 ? "OK" : bad.length + " heavy", status: bad.length === 0 ? "good" : "warn", detail: bad.length ? bad.slice(0, 3).map(r => r.relname + " (" + r.seq_scan + " scans, " + r.size + ")").join(", ") : "No large tables being sequentially scanned" });
    } catch (e) { checks.push({ id: "seq_scans", name: "Seq Scans", value: "?", status: "error", detail: e.message }); }

    // 10. Database size + table count
    try {
      const [r] = await q(p, `SELECT pg_size_pretty(pg_database_size(current_database())) as size, current_database() as name`);
      const [tc] = await q(p, `SELECT count(*) as c FROM pg_tables WHERE schemaname = 'public'`);
      checks.push({ id: "overview", name: "Overview", value: tc.c + " tables, " + r.size, status: "info", detail: "Database: " + r.name });
    } catch (e) { checks.push({ id: "overview", name: "Overview", value: "?", status: "error", detail: e.message }); }

    // Score: percentage of scoreable checks that are "good"
    const scoreable = checks.filter(c => c.status !== "info" && c.status !== "error");
    const good = scoreable.filter(c => c.status === "good").length;
    const score = scoreable.length > 0 ? Math.round((good / scoreable.length) * 100) : 0;

    return { checks, score };
  }

  // ── AI Chat ─────────────────────────────────────────────────────────────────

  app.post("/api/db/assistant/chat", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection" });
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    try {
      const schema = await getSchemaContext(p);
      const diag = await runDiagnostics(p);
      const [dbInfo] = await q(p, "SELECT current_database() as name, version() as ver");

      // Project info
      let projectName = "unknown";
      if (req.query.project) {
        const proj = readProjects().find(pr => pr.id === req.query.project);
        if (proj) projectName = proj.name;
      }

      const systemPrompt = `You are an expert PostgreSQL DBA and AI database assistant built into Bulwark's DB Studio.
You are connected to project "${projectName}", database "${dbInfo.name}" running ${dbInfo.ver.split(" ").slice(0, 2).join(" ")}.

FULL SCHEMA (${schema.tables.length} tables):
${schema.schemaText}

FOREIGN KEYS:
${schema.fks.map(f => f.table_name + "." + f.column_name + " -> " + f.foreign_table + "." + f.foreign_column).join("\n")}

INDEX COUNT: ${schema.indexes.length}

CURRENT HEALTH (score ${diag.score}/100):
${diag.checks.map(c => "- " + c.name + ": " + (c.value || c.status) + (c.status === "warn" || c.status === "bad" ? " [NEEDS ATTENTION]" : "")).join("\n")}

INSTRUCTIONS:
- When suggesting SQL, ALWAYS wrap in \`\`\`sql code blocks so the user can execute with one click
- When generating migrations, include both UP and DOWN (rollback) sections clearly labeled
- When generating deployment scripts, include error handling, backups, and rollback steps
- For destructive operations (DROP, TRUNCATE, DELETE), ALWAYS warn and suggest backup first
- Be concise but thorough. Lead with the answer, then explain.
- You can reference specific tables/columns from the schema above
- For performance questions, reference the health checks above
- When asked to compare environments, explain what schema drift means and how to fix it`;

      const conversationCtx = (history || []).slice(-6).map(h =>
        (h.role === "user" ? "User: " : "Assistant: ") + h.content
      ).join("\n\n");

      const fullPrompt = systemPrompt + "\n\n" +
        (conversationCtx ? "Recent conversation:\n" + conversationCtx + "\n\n" : "") +
        "User: " + message;

      const { askAI } = require("../lib/ai");
      const response = await askAI(fullPrompt, { timeout: 120000 });

      if (!response || response === 'No response from AI') {
        return res.json({ error: "AI unavailable or returned no response" });
      }

      // Extract SQL blocks for one-click execution
      const sqlBlocks = [];
      const re = /```sql\n([\s\S]*?)```/g;
      let m;
      while ((m = re.exec(response)) !== null) sqlBlocks.push(m[1].trim());

      res.json({
        response,
        sqlBlocks,
        meta: { tables: schema.tables.length, indexes: schema.indexes.length, healthScore: diag.score },
      });
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  // ── Diagnostics ─────────────────────────────────────────────────────────────

  app.get("/api/db/assistant/diagnostics", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection" });
    try {
      const diag = await runDiagnostics(p);
      res.json(diag);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Generate Fix SQL ────────────────────────────────────────────────────────

  app.post("/api/db/assistant/fix", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection" });
    const { checkId } = req.body;

    try {
      const diag = await runDiagnostics(p);
      const check = diag.checks.find(c => c.id === checkId);
      if (!check) return res.status(404).json({ error: "Check not found" });

      let fixSql = "", warning = null;

      if (checkId === "fk_indexes" && check.items) {
        fixSql = "-- Add missing FK indexes\n" +
          check.items.map(r =>
            `CREATE INDEX IF NOT EXISTS idx_${r.table_name}_${r.column_name} ON ${r.table_name} (${r.column_name});`
          ).join("\n");
      } else if (checkId === "bloat") {
        fixSql = "-- Reclaim dead tuple space\nVACUUM ANALYZE;";
      } else if (checkId === "unused_idx" && check.items) {
        warning = "Verify these indexes are truly unused before dropping. Stats reset on server restart.";
        fixSql = "-- Drop unused indexes (verify first!)\n" +
          check.items.map(r => `-- ${r.table} (${r.size})\nDROP INDEX IF EXISTS ${r.index};`).join("\n");
      }

      res.json({ checkId, fixSql, warning });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Deploy Readiness ────────────────────────────────────────────────────────

  app.get("/api/db/assistant/deploy-check", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection" });

    try {
      const checks = [];

      // 1. Connection
      try {
        const [r] = await q(p, "SELECT current_database() as db, version() as ver");
        checks.push({ name: "Connection", status: "pass", detail: r.db + " — " + r.ver.split(" ").slice(0, 2).join(" ") });
      } catch (e) {
        checks.push({ name: "Connection", status: "fail", detail: e.message });
      }

      // 2. Pending migrations
      try {
        let applied = [];
        try { applied = await q(p, "SELECT name FROM schema_migrations"); } catch {}
        const appliedSet = new Set(applied.map(a => a.name));
        const migDir = path.join(REPO_DIR, "supabase", "migrations");
        let pending = 0;
        if (fs.existsSync(migDir)) {
          pending = fs.readdirSync(migDir).filter(f => f.endsWith(".sql") && !appliedSet.has(f)).length;
        }
        checks.push({ name: "Migrations", status: pending === 0 ? "pass" : "fail", detail: pending === 0 ? "All migrations applied" : pending + " pending migrations need to be run", count: pending });
      } catch (e) {
        checks.push({ name: "Migrations", status: "warn", detail: "Could not check: " + e.message });
      }

      // 3. Health score
      const diag = await runDiagnostics(p);
      checks.push({ name: "Health Score", status: diag.score >= 70 ? "pass" : diag.score >= 40 ? "warn" : "fail", detail: "Score: " + diag.score + "/100", score: diag.score });

      // 4. FK indexes
      const fkCheck = diag.checks.find(c => c.id === "fk_indexes");
      if (fkCheck) checks.push({ name: "FK Indexes", status: fkCheck.status === "good" ? "pass" : "warn", detail: fkCheck.value });

      // 5. Connection headroom
      const connCheck = diag.checks.find(c => c.id === "connections");
      if (connCheck) checks.push({ name: "Connection Headroom", status: connCheck.status === "good" ? "pass" : connCheck.status === "warn" ? "warn" : "fail", detail: connCheck.value });

      // 6. Long-running queries
      const lqCheck = diag.checks.find(c => c.id === "long_queries");
      if (lqCheck) checks.push({ name: "Long Queries", status: lqCheck.status === "good" ? "pass" : "warn", detail: lqCheck.value });

      // 7. Table bloat
      const bloatCheck = diag.checks.find(c => c.id === "bloat");
      if (bloatCheck) checks.push({ name: "Table Bloat", status: bloatCheck.status === "good" ? "pass" : "warn", detail: bloatCheck.value });

      // 8. Duplicate project URLs
      const projects = readProjects();
      const urlMap = {};
      projects.forEach(pr => {
        const norm = pr.url.replace(/\/+$/, "");
        if (!urlMap[norm]) urlMap[norm] = [];
        urlMap[norm].push(pr.name);
      });
      const dupes = Object.values(urlMap).filter(names => names.length > 1);
      checks.push({ name: "Unique Project URLs", status: dupes.length === 0 ? "pass" : "warn", detail: dupes.length === 0 ? "All projects point to different databases" : "Duplicate URLs: " + dupes.map(n => n.join(" & ")).join("; ") });

      const passed = checks.filter(c => c.status === "pass").length;
      res.json({ checks, passed, total: checks.length, ready: checks.every(c => c.status !== "fail") });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Cross-Project Schema Comparison ─────────────────────────────────────────

  app.post("/api/db/assistant/compare", requireAdmin, async (req, res) => {
    const { projectA, projectB } = req.body;
    if (!projectA || !projectB) return res.status(400).json({ error: "Two project IDs required" });

    const poolA = getProjectPool(projectA);
    const poolB = getProjectPool(projectB);
    if (!poolA || !poolB) return res.status(400).json({ error: "Could not connect to one or both projects" });

    try {
      const tablesA = await q(poolA, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
      const tablesB = await q(poolB, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);

      const setA = new Set(tablesA.map(t => t.table_name));
      const setB = new Set(tablesB.map(t => t.table_name));

      const onlyA = [...setA].filter(t => !setB.has(t));
      const onlyB = [...setB].filter(t => !setA.has(t));
      const both = [...setA].filter(t => setB.has(t));

      // Column-level diff on shared tables (sample up to 20)
      const columnDiffs = [];
      for (const table of both.slice(0, 20)) {
        const colsA = await q(poolA, `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' ORDER BY ordinal_position`, [table]);
        const colsB = await q(poolB, `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' ORDER BY ordinal_position`, [table]);

        const mapA = Object.fromEntries(colsA.map(c => [c.column_name, c]));
        const mapB = Object.fromEntries(colsB.map(c => [c.column_name, c]));

        const onlyInA = colsA.filter(c => !mapB[c.column_name]).map(c => c.column_name);
        const onlyInB = colsB.filter(c => !mapA[c.column_name]).map(c => c.column_name);
        const typeDiff = colsA.filter(c => mapB[c.column_name] && (c.data_type !== mapB[c.column_name].data_type)).map(c => c.column_name + " (" + c.data_type + " vs " + mapB[c.column_name].data_type + ")");

        if (onlyInA.length || onlyInB.length || typeDiff.length) {
          columnDiffs.push({ table, onlyInA, onlyInB, typeDiff });
        }
      }

      const projA = readProjects().find(pr => pr.id === projectA);
      const projB = readProjects().find(pr => pr.id === projectB);

      res.json({
        projectA: projA ? projA.name : projectA,
        projectB: projB ? projB.name : projectB,
        tablesA: setA.size,
        tablesB: setB.size,
        onlyInA: onlyA,
        onlyInB: onlyB,
        shared: both.length,
        columnDiffs,
        identical: onlyA.length === 0 && onlyB.length === 0 && columnDiffs.length === 0,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Schema Summary ──────────────────────────────────────────────────────────

  app.get("/api/db/assistant/schema-summary", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection" });
    try {
      const [dbInfo] = await q(p, "SELECT current_database() as name, pg_size_pretty(pg_database_size(current_database())) as size");
      const [tc] = await q(p, "SELECT count(*) as c FROM pg_tables WHERE schemaname = 'public'");
      const [ic] = await q(p, "SELECT count(*) as c FROM pg_indexes WHERE schemaname = 'public'");
      const [fc] = await q(p, "SELECT count(*) as c FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'");
      const [fn] = await q(p, "SELECT count(*) as c FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public'");
      const topTables = await q(p, `
        SELECT t.tablename as name, pg_size_pretty(pg_total_relation_size(quote_ident('public')||'.'||quote_ident(t.tablename))) as size, c.reltuples::bigint as rows
        FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE t.schemaname = 'public' ORDER BY pg_total_relation_size(quote_ident('public')||'.'||quote_ident(t.tablename)) DESC LIMIT 8
      `);
      res.json({ database: dbInfo.name, size: dbInfo.size, tables: +tc.c, indexes: +ic.c, foreignKeys: +fc.c, functions: +fn.c, topTables });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};
