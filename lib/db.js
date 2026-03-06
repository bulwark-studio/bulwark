const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const DB_URL = process.env.DATABASE_URL || "";
const VPS_DB_URL = process.env.VPS_DATABASE_URL || "";

const PROJECTS_FILE = path.join(__dirname, "..", "data", "db-projects.json");

// ── Static pools (legacy) ─────────────────────────────────────────────────────

let pool = null;
if (DB_URL) {
  const dbSSL = DB_URL.includes("supabase.com") || DB_URL.includes("supabase.co") || process.env.DB_SSL === "true";
  pool = new Pool({ connectionString: DB_URL, ssl: dbSSL ? { rejectUnauthorized: false } : false });
}

let vpsPool = null;
if (VPS_DB_URL) {
  const vpsSSL = VPS_DB_URL.includes("supabase.com") || VPS_DB_URL.includes("supabase.co") || process.env.VPS_DB_SSL === "true";
  vpsPool = new Pool({ connectionString: VPS_DB_URL, ssl: vpsSSL ? { rejectUnauthorized: false } : false });
}

async function dbQuery(sql, params = []) {
  if (!pool) return [];
  try {
    const res = await pool.query(sql, params);
    return res.rows;
  } catch (e) {
    console.error("[DB]", e.message);
    return [];
  }
}

async function vpsQuery(sql, params = []) {
  if (!vpsPool) return [];
  try {
    const res = await vpsPool.query(sql, params);
    return res.rows;
  } catch (e) {
    console.error("[VPS-DB]", e.message);
    return [];
  }
}

// ── Project Pool Manager ──────────────────────────────────────────────────────

const projectPools = new Map(); // id → Pool

function readProjects() {
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf8")).projects || [];
  } catch {
    return [];
  }
}

function writeProjects(projects) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects }, null, 2));
}

function makePool(project) {
  const ssl = project.ssl || project.url.includes("supabase.com") || project.url.includes("supabase.co");
  return new Pool({
    connectionString: project.url,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
  });
}

function getProjectPool(id) {
  if (!id) return null;
  if (projectPools.has(id)) return projectPools.get(id);
  // Not cached — load from file and create
  const projects = readProjects();
  const project = projects.find(p => p.id === id);
  if (!project) return null;
  const p = makePool(project);
  projectPools.set(id, p);
  return p;
}

function invalidateProjectPool(id) {
  const p = projectPools.get(id);
  if (p) { p.end().catch(() => {}); projectPools.delete(id); }
}

// Pre-warm pools for all saved projects on startup
setTimeout(() => {
  readProjects().forEach(proj => {
    try { getProjectPool(proj.id); } catch {}
  });
}, 500);

module.exports = {
  pool, vpsPool, dbQuery, vpsQuery,
  // Project manager
  readProjects, writeProjects, makePool,
  getProjectPool, invalidateProjectPool,
};
