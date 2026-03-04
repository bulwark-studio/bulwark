const { Pool } = require("pg");

const DB_URL = process.env.DATABASE_URL || "";
const VPS_DB_URL = process.env.VPS_DATABASE_URL || "";

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

module.exports = { pool, vpsPool, dbQuery, vpsQuery };
