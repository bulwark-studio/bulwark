const fs = require("fs");
const path = require("path");
const { execCommand } = require("../lib/exec");
const { getProjectPool, readProjects } = require("../lib/db");
const { askAI, askAIJSON, getAICommand } = require("../lib/ai");

const DATA_DIR = path.join(__dirname, "..", "data");
const HISTORY_FILE = path.join(DATA_DIR, "query-history.json");
const SAVED_FILE = path.join(DATA_DIR, "saved-queries.json");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");

// Ensure dirs exist
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = function (app, ctx) {
  const { pool, vpsPool, requireAdmin, requireRole, REPO_DIR } = ctx;

  // Resolve which pool to use — project takes priority over legacy pool param
  function getPool(req) {
    if (req.query.project) {
      const p = getProjectPool(req.query.project);
      if (p) return p;
    }
    if (req.query.pool === "vps" && vpsPool) return vpsPool;
    return pool;
  }

  // Resolve raw database URL for pg_dump/psql commands (not a pool)
  function resolveDbUrl(req) {
    if (req.query.project) {
      const projects = readProjects();
      const proj = projects.find(p => p.id === req.query.project);
      if (proj) return proj.url;
    }
    if (req.query.pool === "vps") return process.env.VPS_DATABASE_URL || "";
    return process.env.DATABASE_URL || "";
  }

  async function runQuery(p, sql, params = []) {
    if (!p) throw new Error("Database not connected");
    const res = await p.query(sql, params);
    return res.rows;
  }

  // ── DB Info ──────────────────────────────────────────────────────────────
  app.get("/api/db/info", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection", degraded: true });
    try {
      const [version] = await runQuery(p, "SELECT version()");
      const [size] = await runQuery(p, "SELECT pg_size_pretty(pg_database_size(current_database())) as size");
      const [uptime] = await runQuery(p, "SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime");
      const [conns] = await runQuery(p, "SELECT count(*) as count FROM pg_stat_activity");
      const [dbname] = await runQuery(p, "SELECT current_database() as name");
      res.json({
        version: version.version,
        size: size.size,
        uptime: uptime.uptime,
        connections: parseInt(conns.count),
        database: dbname.name,
        pool: req.query.pool === "vps" ? "vps" : "dev",
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Tables ───────────────────────────────────────────────────────────────
  app.get("/api/db/tables", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ tables: [], degraded: true });
    try {
      const rows = await runQuery(p, `
        SELECT t.schemaname, t.tablename as name,
          pg_size_pretty(pg_total_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))) as size,
          pg_total_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename)) as size_bytes,
          c.reltuples::bigint as row_estimate,
          (SELECT count(*) FROM pg_indexes i WHERE i.tablename = t.tablename) as index_count
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
      `);
      res.json({ tables: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Table Detail ─────────────────────────────────────────────────────────
  app.get("/api/db/tables/:name", requireAdmin, async (req, res) => {
    const p = getPool(req);
    const table = req.params.name;
    if (!p) return res.json({ error: "No database connection", degraded: true });
    try {
      // Columns
      const columns = await runQuery(p, `
        SELECT c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default,
          c.character_maximum_length, c.numeric_precision,
          EXISTS(
            SELECT 1 FROM information_schema.key_column_usage kcu
            JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY' AND kcu.table_name = $1
              AND kcu.column_name = c.column_name AND kcu.table_schema = 'public'
          ) as is_pk
        FROM information_schema.columns c
        WHERE c.table_name = $1 AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `, [table]);

      // Constraints
      const constraints = await runQuery(p, `
        SELECT tc.constraint_name, tc.constraint_type,
          string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 AND tc.table_schema = 'public'
        GROUP BY tc.constraint_name, tc.constraint_type
      `, [table]);

      // Foreign keys
      const foreignKeys = await runQuery(p, `
        SELECT tc.constraint_name, kcu.column_name,
          ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      `, [table]);

      // Indexes
      const indexes = await runQuery(p, `
        SELECT indexname, indexdef,
          pg_size_pretty(pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(indexname))) as size
        FROM pg_indexes
        WHERE tablename = $1 AND schemaname = 'public'
      `, [table]);

      // Row count + size
      const [info] = await runQuery(p, `
        SELECT pg_size_pretty(pg_total_relation_size(quote_ident('public')||'.'||quote_ident($1))) as size,
          (SELECT reltuples::bigint FROM pg_class WHERE relname = $1) as row_estimate
      `, [table]);

      res.json({ table, columns, constraints, foreignKeys, indexes, info });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Table Rows ───────────────────────────────────────────────────────────
  app.get("/api/db/tables/:name/rows", requireAdmin, async (req, res) => {
    const p = getPool(req);
    const table = req.params.name;
    if (!p) return res.json({ error: "No database connection", degraded: true });
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const sort = (req.query.sort || "").replace(/[^a-zA-Z0-9_]/g, "");
    const order = req.query.order === "desc" ? "DESC" : "ASC";

    // Validate table name (prevent injection)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      return res.status(400).json({ error: "Invalid table name" });
    }

    try {
      const orderClause = sort ? ` ORDER BY "${sort}" ${order}` : "";
      const rows = await runQuery(p, `SELECT * FROM "${table}"${orderClause} LIMIT ${limit} OFFSET ${offset}`);
      const [countResult] = await runQuery(p, `SELECT count(*) as total FROM "${table}"`);
      res.json({ rows, total: parseInt(countResult.total), limit, offset });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Execute SQL ──────────────────────────────────────────────────────────
  app.post("/api/db/query", requireRole('editor'), async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection", degraded: true });
    const { sql } = req.body;
    if (!sql?.trim()) return res.status(400).json({ error: "SQL required" });

    const normalized = sql.trim().toUpperCase();
    const isDDL = /^(DROP|TRUNCATE|ALTER|CREATE)\s/i.test(sql.trim());
    const isDML = /^(INSERT|UPDATE|DELETE)\s/i.test(sql.trim());

    if (isDDL) {
      // DDL requires admin role
      const userLevel = require('../lib/rbac').getRoleLevel(req.user?.role);
      if (userLevel < 3) return res.status(403).json({ error: "DDL requires admin role", type: "ddl_blocked" });
      if (req.query.allow_ddl !== "true") return res.status(403).json({ error: "DDL requires ?allow_ddl=true confirmation", type: "ddl_blocked" });
    }

    const start = Date.now();
    try {
      const result = await p.query(sql);
      const duration = Date.now() - start;
      const rows = result.rows || [];
      const rowCount = result.rowCount;

      // Log to history
      const history = readJSON(HISTORY_FILE, []);
      history.unshift({
        sql: sql.substring(0, 2000),
        duration,
        rows: rows.length,
        rowCount,
        type: isDDL ? "DDL" : isDML ? "DML" : "SELECT",
        ts: new Date().toISOString(),
        user: req.user?.username || "admin",
        pool: req.query.pool === "vps" ? "vps" : "dev",
      });
      if (history.length > 100) history.length = 100;
      writeJSON(HISTORY_FILE, history);

      res.json({
        rows: rows.slice(0, 1000),
        rowCount,
        fields: result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })) || [],
        duration,
        type: isDDL ? "DDL" : isDML ? "DML" : "SELECT",
        truncated: rows.length > 1000,
      });
    } catch (e) {
      // Log failed query too
      const history = readJSON(HISTORY_FILE, []);
      history.unshift({
        sql: sql.substring(0, 2000),
        duration: Date.now() - start,
        error: e.message,
        type: "ERROR",
        ts: new Date().toISOString(),
        user: req.user?.username || "admin",
      });
      if (history.length > 100) history.length = 100;
      writeJSON(HISTORY_FILE, history);

      res.status(400).json({ error: e.message, position: e.position });
    }
  });

  // ── Functions ────────────────────────────────────────────────────────────
  app.get("/api/db/functions", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ functions: [], degraded: true });
    try {
      const rows = await runQuery(p, `
        SELECT p.proname as name,
          pg_get_function_arguments(p.oid) as args,
          pg_get_function_result(p.oid) as return_type,
          l.lanname as language,
          pg_get_functiondef(p.oid) as source,
          p.provolatile as volatility
        FROM pg_proc p
        JOIN pg_language l ON p.prolang = l.oid
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname
      `);
      res.json({ functions: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Triggers ─────────────────────────────────────────────────────────────
  app.get("/api/db/triggers", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ triggers: [], degraded: true });
    try {
      const rows = await runQuery(p, `
        SELECT trigger_name, event_manipulation as event,
          event_object_table as table_name,
          action_timing as timing,
          action_statement
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
      `);
      res.json({ triggers: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Extensions ───────────────────────────────────────────────────────────
  app.get("/api/db/extensions", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ extensions: [], degraded: true });
    try {
      const rows = await runQuery(p, `
        SELECT e.extname as name, e.extversion as version,
          n.nspname as schema, c.description
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        LEFT JOIN pg_description c ON c.objoid = e.oid
        ORDER BY e.extname
      `);
      res.json({ extensions: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Indexes ──────────────────────────────────────────────────────────────
  app.get("/api/db/indexes", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ indexes: [], degraded: true });
    try {
      const rows = await runQuery(p, `
        SELECT tablename as table_name, indexname as name, indexdef as definition,
          pg_size_pretty(pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(indexname))) as size,
          (SELECT indisunique FROM pg_index i JOIN pg_class c ON i.indexrelid = c.oid WHERE c.relname = indexname LIMIT 1) as is_unique
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);
      res.json({ indexes: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Roles ────────────────────────────────────────────────────────────────
  app.get("/api/db/roles", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ roles: [], degraded: true });
    try {
      const rows = await runQuery(p, `
        SELECT r.rolname as name, r.rolsuper as is_super, r.rolcanlogin as can_login,
          r.rolconnlimit as connection_limit, r.rolcreatedb as can_create_db,
          r.rolcreaterole as can_create_role, r.rolvaliduntil as valid_until,
          (SELECT count(*) FROM pg_stat_activity WHERE usename = r.rolname) as active_connections,
          ARRAY(SELECT b.rolname FROM pg_auth_members m JOIN pg_roles b ON m.roleid = b.oid WHERE m.member = r.oid) as member_of
        FROM pg_roles r
        WHERE r.rolname NOT LIKE 'pg_%'
        ORDER BY r.rolname
      `);
      res.json({ roles: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Role Permissions ─────────────────────────────────────────────────────
  app.get("/api/db/roles/:name/permissions", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ permissions: [], degraded: true });
    try {
      const rows = await runQuery(p, `
        SELECT table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE grantee = $1 AND table_schema = 'public'
        ORDER BY table_name, privilege_type
      `, [req.params.name]);
      // Group by table
      const grouped = {};
      rows.forEach(r => {
        if (!grouped[r.table_name]) grouped[r.table_name] = [];
        grouped[r.table_name].push(r.privilege_type);
      });
      res.json({ permissions: grouped });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Migrations ───────────────────────────────────────────────────────────
  const MIGRATIONS_DIR = path.join(REPO_DIR, "supabase", "migrations");
  const SCHEMA_FILE = path.join(REPO_DIR, "supabase", "schema.sql");

  app.get("/api/db/migrations", requireAdmin, async (req, res) => {
    const p = getPool(req);
    try {
      // Get applied migrations from DB
      let applied = [];
      if (p) {
        try {
          applied = await runQuery(p, `
            SELECT name, applied_at FROM schema_migrations ORDER BY applied_at DESC
          `);
        } catch { /* table may not exist */ }
      }

      // Get filesystem migrations
      let files = [];
      try {
        if (fs.existsSync(MIGRATIONS_DIR)) {
          files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith(".sql"))
            .sort();
        }
      } catch {}

      const appliedSet = new Set(applied.map(a => a.name));
      const migrations = files.map(f => ({
        name: f,
        applied: appliedSet.has(f),
        applied_at: applied.find(a => a.name === f)?.applied_at || null,
      }));

      const pending = migrations.filter(m => !m.applied).length;
      res.json({ migrations, total: files.length, applied: applied.length, pending });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/db/migrations/pending", requireAdmin, async (req, res) => {
    const p = getPool(req);
    try {
      let applied = [];
      if (p) {
        try { applied = await runQuery(p, "SELECT name FROM schema_migrations"); } catch {}
      }
      const appliedSet = new Set(applied.map(a => a.name));
      let files = [];
      try {
        if (fs.existsSync(MIGRATIONS_DIR)) {
          files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
        }
      } catch {}
      const pending = files.filter(f => !appliedSet.has(f));
      res.json({ pending });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Preview migration SQL
  app.get("/api/db/migrations/:name/preview", requireAdmin, (req, res) => {
    const filePath = path.join(MIGRATIONS_DIR, req.params.name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Migration not found" });
    try {
      const sql = fs.readFileSync(filePath, "utf8");
      res.json({ name: req.params.name, sql });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Run a migration
  app.post("/api/db/migrations/run", requireRole('admin'), async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection", degraded: true });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Migration name required" });

    const filePath = path.join(MIGRATIONS_DIR, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Migration file not found" });

    try {
      const sql = fs.readFileSync(filePath, "utf8");
      await p.query(sql);
      // Record in schema_migrations
      try {
        await p.query(
          "INSERT INTO schema_migrations (name, applied_at) VALUES ($1, NOW()) ON CONFLICT (name) DO NOTHING",
          [name]
        );
      } catch { /* table may not exist */ }
      res.json({ success: true, name });
    } catch (e) {
      res.status(500).json({ error: e.message, name });
    }
  });

  // Docker test-run a migration
  app.post("/api/db/migrations/test", requireRole('editor'), async (req, res) => {
    const { name, sql: rawSql } = req.body;
    let migrationSql = rawSql;

    if (name && !migrationSql) {
      const filePath = path.join(MIGRATIONS_DIR, name);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Migration file not found" });
      migrationSql = fs.readFileSync(filePath, "utf8");
    }
    if (!migrationSql) return res.status(400).json({ error: "Migration SQL required" });

    const containerName = "bulwark-migration-test-" + Date.now();
    const containerPort = 54320 + Math.floor(Math.random() * 100);

    try {
      // 1. Start container
      const startResult = await execCommand(
        `docker run -d --name ${containerName} -p ${containerPort}:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=testdb postgres:17`,
        { timeout: 60000 }
      );
      if (startResult.code !== 0) throw new Error("Failed to start container: " + startResult.stderr);

      // 2. Wait for PG to be ready
      let ready = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const check = await execCommand(
          `docker exec ${containerName} pg_isready -U postgres`,
          { timeout: 5000 }
        );
        if (check.code === 0) { ready = true; break; }
      }
      if (!ready) throw new Error("PostgreSQL container did not become ready");

      // 3. Load base schema if exists
      let schemaResult = { success: true };
      if (fs.existsSync(SCHEMA_FILE)) {
        const schemaLoad = await execCommand(
          `docker exec -i ${containerName} psql -U postgres -d testdb`,
          { timeout: 120000, stdin: fs.readFileSync(SCHEMA_FILE, "utf8") }
        );
        // Use a simpler approach: copy file into container
        const tmpSchema = path.join(DATA_DIR, "tmp-schema.sql");
        fs.copyFileSync(SCHEMA_FILE, tmpSchema);
        const copyResult = await execCommand(
          `docker cp "${tmpSchema}" ${containerName}:/tmp/schema.sql`,
          { timeout: 30000 }
        );
        const loadResult = await execCommand(
          `docker exec ${containerName} psql -U postgres -d testdb -f /tmp/schema.sql`,
          { timeout: 120000 }
        );
        schemaResult = { success: loadResult.code === 0, output: loadResult.stdout + loadResult.stderr };
        try { fs.unlinkSync(tmpSchema); } catch {}
      }

      // 4. Apply migration
      const tmpMigration = path.join(DATA_DIR, "tmp-migration.sql");
      fs.writeFileSync(tmpMigration, migrationSql);
      const copyMig = await execCommand(
        `docker cp "${tmpMigration}" ${containerName}:/tmp/migration.sql`,
        { timeout: 10000 }
      );
      const migResult = await execCommand(
        `docker exec ${containerName} psql -U postgres -d testdb -f /tmp/migration.sql`,
        { timeout: 60000 }
      );
      try { fs.unlinkSync(tmpMigration); } catch {}

      // 5. Verify - count tables
      const verifyResult = await execCommand(
        `docker exec ${containerName} psql -U postgres -d testdb -t -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"`,
        { timeout: 10000 }
      );

      // 6. Cleanup
      await execCommand(`docker rm -f ${containerName}`, { timeout: 15000 });

      const migSuccess = migResult.code === 0;
      res.json({
        success: migSuccess,
        schema_loaded: schemaResult.success,
        migration_output: (migResult.stdout + migResult.stderr).substring(0, 5000),
        table_count: verifyResult.stdout?.trim() || "unknown",
        container: containerName,
      });
    } catch (e) {
      // Cleanup on error
      await execCommand(`docker rm -f ${containerName}`, { timeout: 10000 }).catch(() => {});
      res.status(500).json({ error: e.message, container: containerName });
    }
  });

  // Schema diff
  app.post("/api/db/migrations/diff", requireRole('editor'), async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection", degraded: true });

    try {
      // Get live tables
      const liveTables = await runQuery(p, `
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      const liveTableNames = new Set(liveTables.map(t => t.table_name));

      // Get live columns
      const liveCols = await runQuery(p, `
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);
      const liveColMap = {};
      liveCols.forEach(c => {
        if (!liveColMap[c.table_name]) liveColMap[c.table_name] = [];
        liveColMap[c.table_name].push(c);
      });

      // Parse schema.sql for CREATE TABLE statements
      let schemaTables = new Set();
      let schemaColMap = {};
      if (fs.existsSync(SCHEMA_FILE)) {
        const schemaSql = fs.readFileSync(SCHEMA_FILE, "utf8");
        const tableRegex = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?(\w+)\s*\(/gi;
        let match;
        while ((match = tableRegex.exec(schemaSql)) !== null) {
          schemaTables.add(match[1]);
        }
      }

      const missingInLive = [...schemaTables].filter(t => !liveTableNames.has(t));
      const extraInLive = [...liveTableNames].filter(t => !schemaTables.has(t));

      res.json({
        live_tables: liveTableNames.size,
        schema_tables: schemaTables.size,
        missing_in_live: missingInLive,
        extra_in_live: extraInLive,
        match: missingInLive.length === 0 && extraInLive.length === 0,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Backups ──────────────────────────────────────────────────────────────
  app.get("/api/db/backups", requireAdmin, (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) return res.json({ backups: [] });
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.endsWith(".sql") || f.endsWith(".sql.gz") || f.endsWith(".dump"))
        .map(f => {
          const stat = fs.statSync(path.join(BACKUPS_DIR, f));
          return {
            name: f,
            size: stat.size,
            size_pretty: stat.size > 1048576 ? (stat.size / 1048576).toFixed(1) + " MB" : (stat.size / 1024).toFixed(0) + " KB",
            created: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      res.json({ backups: files });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Check if pg_dump is available
  let hasPgDump = null;
  async function checkPgDump() {
    if (hasPgDump !== null) return hasPgDump;
    try {
      const r = await execCommand(process.platform === 'win32' ? 'where pg_dump' : 'which pg_dump', { timeout: 5000 });
      hasPgDump = r.code === 0;
    } catch { hasPgDump = false; }
    return hasPgDump;
  }

  // SQL-based backup fallback (when pg_dump not installed)
  async function sqlBackup(p, filepath) {
    const tables = await runQuery(p, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    let sql = '-- SQL Backup (generated by Bulwark)\n-- Date: ' + new Date().toISOString() + '\n\n';

    for (const t of tables) {
      const name = t.tablename;
      // Get CREATE TABLE via pg_dump equivalent
      const cols = await runQuery(p, `SELECT column_name, data_type, column_default, is_nullable, character_maximum_length
        FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [name]);

      sql += `-- Table: ${name}\n`;
      sql += `CREATE TABLE IF NOT EXISTS "${name}" (\n`;
      sql += cols.map(c => {
        let typ = c.data_type === 'character varying' ? `varchar(${c.character_maximum_length || 255})` : c.data_type;
        let line = `  "${c.column_name}" ${typ}`;
        if (c.is_nullable === 'NO') line += ' NOT NULL';
        if (c.column_default) line += ` DEFAULT ${c.column_default}`;
        return line;
      }).join(',\n');
      sql += '\n);\n\n';

      // Dump data
      const rows = await runQuery(p, `SELECT * FROM "${name}"`);
      if (rows.length) {
        const colNames = Object.keys(rows[0]);
        for (const row of rows) {
          const vals = colNames.map(c => {
            const v = row[c];
            if (v === null) return 'NULL';
            if (typeof v === 'number' || typeof v === 'boolean') return String(v);
            return "'" + String(v).replace(/'/g, "''") + "'";
          });
          sql += `INSERT INTO "${name}" (${colNames.map(c => '"' + c + '"').join(', ')}) VALUES (${vals.join(', ')});\n`;
        }
        sql += '\n';
      }
    }

    fs.writeFileSync(filepath, sql, 'utf8');
  }

  app.post("/api/db/backup", requireRole('editor'), async (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace("T", "_").substring(0, 15);
    const filename = `backup_${timestamp}.sql`;
    const filepath = path.join(BACKUPS_DIR, filename);

    try {
      const pgDumpAvailable = await checkPgDump();

      if (pgDumpAvailable) {
        const dbUrl = resolveDbUrl(req);
        if (!dbUrl) return res.status(400).json({ error: "No database URL configured" });
        const result = await execCommand(
          `pg_dump "${dbUrl}" --no-owner --no-acl --file="${filepath.replace(/\\/g, '/')}"`,
          { timeout: 300000 }
        );
        if (result.code !== 0 && result.stderr && !result.stderr.includes("WARNING")) {
          throw new Error(result.stderr);
        }
        if (!fs.existsSync(filepath)) throw new Error("pg_dump did not create output file");
      } else {
        // Fallback: SQL-based backup via PG queries
        const p = getPool(req);
        await sqlBackup(p, filepath);
      }

      const stat = fs.statSync(filepath);
      res.json({
        success: true, filename,
        method: pgDumpAvailable ? 'pg_dump' : 'sql_export',
        size: stat.size,
        size_pretty: stat.size > 1048576 ? (stat.size / 1048576).toFixed(1) + " MB" : (stat.size / 1024).toFixed(0) + " KB",
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/db/backup/restore", requireRole('admin'), async (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: "Filename required" });
    const filepath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Backup file not found" });

    const dbUrl = resolveDbUrl(req);
    if (!dbUrl) return res.status(400).json({ error: "No database URL configured for this project" });

    try {
      const result = await execCommand(
        `psql "${dbUrl}" --file="${filepath.replace(/\\/g, '/')}"`,
        { timeout: 600000 }
      );
      res.json({
        success: result.code === 0,
        output: (result.stdout + result.stderr).substring(0, 5000),
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Backup delete
  app.delete("/api/db/backups/:name", requireRole('admin'), (req, res) => {
    const filepath = path.join(BACKUPS_DIR, req.params.name);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "File not found" });
    try {
      fs.unlinkSync(filepath);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Backup download
  app.get("/api/db/backups/:name/download", requireAdmin, (req, res) => {
    const filepath = path.join(BACKUPS_DIR, req.params.name);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "File not found" });
    res.download(filepath);
  });

  // ── Query History & Saved ────────────────────────────────────────────────
  app.get("/api/db/query/history", requireAdmin, (req, res) => {
    res.json({ history: readJSON(HISTORY_FILE, []) });
  });

  app.get("/api/db/query/saved", requireAdmin, (req, res) => {
    res.json({ queries: readJSON(SAVED_FILE, []) });
  });

  app.post("/api/db/query/save", requireRole('editor'), (req, res) => {
    const { name, sql } = req.body;
    if (!name || !sql) return res.status(400).json({ error: "Name and SQL required" });
    const saved = readJSON(SAVED_FILE, []);
    saved.push({ name, sql, created: new Date().toISOString() });
    writeJSON(SAVED_FILE, saved);
    res.json({ success: true });
  });

  app.delete("/api/db/query/saved/:index", requireRole('editor'), (req, res) => {
    const idx = parseInt(req.params.index);
    const saved = readJSON(SAVED_FILE, []);
    if (idx >= 0 && idx < saved.length) {
      saved.splice(idx, 1);
      writeJSON(SAVED_FILE, saved);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Query not found" });
    }
  });

  // ── AI Role Security Audit ───────────────────────────────────────────────
  app.get("/api/db/roles/ai/audit", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection", degraded: true });
    try {
      // Gather role data
      const roles = await runQuery(p, `
        SELECT r.rolname, r.rolsuper, r.rolcanlogin, r.rolcreatedb, r.rolcreaterole,
          r.rolconnlimit, r.rolvaliduntil,
          (SELECT count(*) FROM pg_stat_activity WHERE usename = r.rolname) as active_connections,
          ARRAY(SELECT b.rolname FROM pg_auth_members m JOIN pg_roles b ON m.roleid = b.oid WHERE m.member = r.oid) as member_of
        FROM pg_roles r WHERE r.rolname NOT LIKE 'pg_%' ORDER BY r.rolname
      `);
      // Permission summary
      const perms = await runQuery(p, `
        SELECT grantee, count(DISTINCT table_name) as table_count,
          array_agg(DISTINCT privilege_type) as privileges
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND grantee NOT LIKE 'pg_%'
        GROUP BY grantee
      `);
      const permMap = {};
      perms.forEach(p => { permMap[p.grantee] = { table_count: parseInt(p.table_count), privileges: p.privileges }; });

      // Build analysis prompt
      const roleData = roles.map(r => {
        const p = permMap[r.rolname] || { table_count: 0, privileges: [] };
        return `${r.rolname}: super=${r.rolsuper}, login=${r.rolcanlogin}, createdb=${r.rolcreatedb}, ` +
          `createrole=${r.rolcreaterole}, conn_limit=${r.rolconnlimit}, active=${r.active_connections}, ` +
          `tables=${p.table_count}, privs=[${(p.privileges || []).join(',')}], member_of=[${(r.member_of || []).join(',')}]` +
          (r.rolvaliduntil ? `, expires=${r.rolvaliduntil}` : '');
      }).join('\n');

      const prompt = `You are a PostgreSQL security auditor. Analyze these database roles and return a JSON object (no markdown, ONLY valid JSON):

${roleData}

Return this exact JSON structure:
{
  "score": <0-100 security score>,
  "grade": "<A/B/C/D/F>",
  "summary": "<2-3 sentence overall assessment>",
  "findings": [
    {"severity": "critical|warning|info", "role": "<rolename>", "issue": "<description>", "fix": "<SQL fix command>"}
  ],
  "recommendations": ["<actionable recommendation>"],
  "stats": {
    "total_roles": <n>,
    "superusers": <n>,
    "login_roles": <n>,
    "no_password_expiry": <n>,
    "excessive_privileges": <n>,
    "dormant_roles": <n>
  }
}

Check for: superuser proliferation, roles with all privileges, no password expiry, dormant roles (0 connections + login), excessive CREATE DB/ROLE grants, missing connection limits on login roles.`;

      const result = await askClaudeJSON(prompt);
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── AI Backup Strategy ──────────────────────────────────────────────────
  app.get("/api/db/backups/ai/strategy", requireAdmin, async (req, res) => {
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection", degraded: true });
    try {
      // Gather DB stats
      const [dbSize] = await runQuery(p, "SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes");
      const [tableCount] = await runQuery(p, "SELECT count(*) as count FROM pg_tables WHERE schemaname = 'public'");
      const [uptime] = await runQuery(p, "SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime");
      const [conns] = await runQuery(p, "SELECT count(*) as count FROM pg_stat_activity");
      const [txns] = await runQuery(p, "SELECT xact_commit + xact_rollback as total FROM pg_stat_database WHERE datname = current_database()");

      // Largest tables
      const largeTables = await runQuery(p, `
        SELECT tablename, pg_size_pretty(pg_total_relation_size('public.' || quote_ident(tablename))) as size,
          pg_total_relation_size('public.' || quote_ident(tablename)) as bytes
        FROM pg_tables WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size('public.' || quote_ident(tablename)) DESC LIMIT 10
      `);

      // Existing backups
      let backups = [];
      try {
        if (fs.existsSync(BACKUPS_DIR)) {
          backups = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.endsWith(".sql") || f.endsWith(".sql.gz") || f.endsWith(".dump"))
            .map(f => {
              const stat = fs.statSync(path.join(BACKUPS_DIR, f));
              return { name: f, size: stat.size, created: stat.mtime.toISOString() };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));
        }
      } catch {}

      const prompt = `You are a PostgreSQL backup strategist. Analyze this database and return a JSON object (no markdown, ONLY valid JSON):

Database: size=${dbSize.size} (${dbSize.bytes} bytes), tables=${tableCount.count}, uptime=${uptime.uptime}, connections=${conns.count}, total_txns=${txns?.total || 'unknown'}

Top 10 tables by size:
${largeTables.map(t => `  ${t.tablename}: ${t.size}`).join('\n')}

Existing backups (${backups.length}):
${backups.slice(0, 10).map(b => `  ${b.name}: ${(b.size / 1024 / 1024).toFixed(1)}MB, created=${b.created}`).join('\n') || '  None'}

Return this exact JSON structure:
{
  "health_score": <0-100>,
  "summary": "<2-3 sentence backup health assessment>",
  "strategy": {
    "recommended_frequency": "<e.g. daily, every 6 hours>",
    "retention_policy": "<e.g. keep 7 daily, 4 weekly, 3 monthly>",
    "estimated_backup_size": "<human readable>",
    "backup_window": "<recommended time>"
  },
  "risks": [
    {"level": "critical|warning|info", "issue": "<description>", "mitigation": "<action>"}
  ],
  "disaster_recovery": {
    "rto_estimate": "<recovery time objective>",
    "rpo_current": "<recovery point objective based on backup frequency>",
    "recommendations": ["<specific DR recommendation>"]
  },
  "storage_analysis": {
    "current_usage": "<total backup storage>",
    "projected_30d": "<projected storage in 30 days>",
    "cleanup_candidates": ["<old backup files that could be removed>"]
  }
}`;

      const result = await askClaudeJSON(prompt);
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── AI Generate Role SQL ────────────────────────────────────────────────
  app.post("/api/db/roles/ai/generate", requireRole('editor'), async (req, res) => {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: "Description required" });
    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection", degraded: true });

    try {
      const tables = await runQuery(p, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
      const tableList = tables.map(t => t.tablename).join(', ');
      const prompt = `Generate PostgreSQL SQL to create a role based on this description: "${description}"

Available tables: ${tableList}

Return ONLY the SQL commands (CREATE ROLE, GRANT, etc.), no markdown, no explanation. Follow least-privilege principle.`;

      const raw = await askAI(prompt, { timeout: 30000 });
      const sql = raw.replace(/^```sql\n?/i, "").replace(/\n?```$/i, "").trim();
      res.json({ sql, description });
    } catch (e) { res.json({ error: "AI unavailable: " + e.message }); }
  });

  // Use shared AI wrapper (supports Claude CLI, Codex CLI, or none)
  var askClaudeJSON = askAIJSON;

  // ── Claude SQL Assistant ─────────────────────────────────────────────────
  app.post("/api/db/claude/generate", requireRole('editor'), async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    const p = getPool(req);
    if (!p) return res.json({ error: "No database connection", degraded: true });

    // Get table list for context
    let tableContext = "";
    try {
      const tables = await runQuery(p, `
        SELECT t.tablename, string_agg(c.column_name || ' ' || c.data_type, ', ' ORDER BY c.ordinal_position) as columns
        FROM pg_tables t
        JOIN information_schema.columns c ON c.table_name = t.tablename AND c.table_schema = 'public'
        WHERE t.schemaname = 'public'
        GROUP BY t.tablename
        ORDER BY t.tablename
      `);
      tableContext = tables.map(t => `${t.tablename}: ${t.columns}`).join("\n");
    } catch {}

    const fullPrompt = `You are a PostgreSQL expert. Generate ONLY the SQL query (no explanation, no markdown) for this request:\n\n"${prompt}"\n\nAvailable tables and columns:\n${tableContext}\n\nReturn ONLY the SQL query.`;

    try {
      const raw = await askAI(fullPrompt, { timeout: 30000 });
      const sql = raw.replace(/^```sql\n?/i, "").replace(/\n?```$/i, "").trim();
      res.json({ sql, prompt });
    } catch (e) {
      res.json({ error: "AI CLI not available: " + e.message, prompt });
    }
  });
};
