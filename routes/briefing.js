/**
 * AI Briefing — Aggregates all system data + Claude CLI for intelligent summary
 */
const { askAI } = require("../lib/ai");
const { getProjectPool, readProjects } = require("../lib/db");

module.exports = function (app, ctx) {
  const { pool, requireAuth } = ctx;

  // Get best available DB pool (main pool or active project)
  function resolvePool() {
    if (pool) return pool;
    const projects = readProjects();
    if (projects.length > 0) {
      const p = getProjectPool(projects[0].id);
      if (p) return p;
    }
    return null;
  }

  let cachedBriefing = null;
  let cacheTime = 0;
  const CACHE_TTL = 60000;

  // Safe data fetcher
  function safe(fn) {
    return Promise.resolve()
      .then(fn)
      .catch(() => null);
  }

  app.get("/api/briefing", requireAuth, async (req, res) => {
    if (
      cachedBriefing &&
      Date.now() - cacheTime < CACHE_TTL &&
      !req.query.refresh
    ) {
      return res.json(cachedBriefing);
    }

    try {
      // Gather everything in parallel
      const [system, processes, activity, servers, tickets, dbInfo, dbDiag] =
        await Promise.allSettled([
          safe(() => ctx.getSystemInfo()),
          safe(() => ctx.getProcessList()),
          safe(() => ctx.getRecentActivity()),
          safe(() =>
            ctx.getServerHealth ? ctx.getServerHealth() : Promise.resolve([])
          ),
          safe(() =>
            ctx.getTicketSummary
              ? ctx.getTicketSummary()
              : Promise.resolve({ summary: [], tickets: [] })
          ),
          safe(() => {
            const p = resolvePool();
            return p
              ? p
                  .query(
                    "SELECT current_database() as name, pg_size_pretty(pg_database_size(current_database())) as size, (SELECT count(*) FROM pg_tables WHERE schemaname='public') as tables, (SELECT count(*) FROM pg_stat_activity) as connections"
                  )
                  .then((r) => r.rows[0])
              : null;
          }),
          safe(() => {
            const p = resolvePool();
            return p
              ? p
                  .query(
                    "SELECT COALESCE(sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 1) as cache_ratio FROM pg_statio_user_tables"
                  )
                  .then((r) => r.rows[0])
              : null;
          }),
        ]);

      const v = (r) =>
        r.status === "fulfilled" ? r.value : null;

      const data = {
        system: v(system),
        processes: v(processes) || [],
        activity: v(activity) || [],
        servers: v(servers) || [],
        tickets: v(tickets) || { summary: [], tickets: [] },
        dbInfo: v(dbInfo),
        dbDiag: v(dbDiag),
      };

      // Compute unified health score
      const subscores = {};
      const sys = data.system;
      if (sys) {
        const cpuHealth = Math.max(0, 100 - (sys.cpuPct || 0));
        const memHealth = Math.max(0, 100 - (sys.usedMemPct || 0));
        subscores.system = Math.round(cpuHealth * 0.5 + memHealth * 0.5);
      } else {
        subscores.system = null; // no data
      }

      if (data.dbDiag && data.dbDiag.cache_ratio) {
        subscores.database = Math.round(
          parseFloat(data.dbDiag.cache_ratio) * 100
        );
      } else if (data.dbInfo) {
        subscores.database = 75; // connected but no stats
      } else {
        subscores.database = null; // not connected
      }

      const srvList = Array.isArray(data.servers) ? data.servers : [];
      if (srvList.length > 0) {
        const healthy = srvList.filter(
          (s) => s.status === "healthy" || s.status === "up"
        ).length;
        subscores.servers = Math.round((healthy / srvList.length) * 100);
      } else {
        subscores.servers = null; // no servers
      }

      const procList = Array.isArray(data.processes) ? data.processes : [];
      if (procList.length > 0) {
        const online = procList.filter(
          (p) => p.status === "online"
        ).length;
        subscores.pm2 = Math.round((online / procList.length) * 100);
      } else {
        subscores.pm2 = null; // no PM2
      }

      const tix = data.tickets;
      const openTickets = Array.isArray(tix.tickets) ? tix.tickets.length : 0;
      subscores.tickets = openTickets > 10 ? 30 : openTickets > 5 ? 60 : openTickets > 0 ? 80 : 100;

      // Weighted average of available subscores only (skip nulls)
      const weights = { system: 0.3, database: 0.25, servers: 0.2, pm2: 0.15, tickets: 0.1 };
      let totalWeight = 0, weightedSum = 0;
      for (const [k, w] of Object.entries(weights)) {
        if (subscores[k] !== null && subscores[k] !== undefined) {
          weightedSum += subscores[k] * w;
          totalWeight += w;
        }
      }
      const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

      // Build Claude context
      const context = [
        "System state for a developer ops dashboard briefing:",
        sys
          ? `CPU: ${sys.cpuPct || 0}%, Memory: ${sys.usedMemPct || 0}% (${sys.usedMemMB || 0}MB/${sys.totalMemMB || 0}MB), Uptime: ${(sys.uptimeHours || 0).toFixed(1)}h, Node ${sys.nodeVersion || "?"}, ${sys.cpuCount || 0} cores`
          : "System metrics unavailable",
        data.dbInfo
          ? `Database: ${data.dbInfo.name}, ${data.dbInfo.tables} tables, ${data.dbInfo.size}, ${data.dbInfo.connections} connections, cache hit: ${subscores.database}%`
          : "Database not connected",
        procList.length
          ? `PM2: ${procList.length} processes (${procList.filter((p) => p.status === "online").length} online)`
          : "No PM2 processes",
        srvList.length
          ? `Servers: ${srvList.length} monitored (${srvList.filter((s) => s.status === "healthy" || s.status === "up").length} healthy)`
          : "No servers configured",
        `Tickets: ${openTickets} open`,
        `Activity: ${(data.activity || []).length} recent events`,
        `Health score: ${score}/100`,
      ].join("\n");

      const prompt = `${context}\n\nWrite a 2-3 sentence developer morning briefing summarizing this infrastructure state. Be concise and direct. Mention anything critical. No markdown, no bullet points, just flowing sentences.`;

      // Call Claude CLI
      let briefingText;
      try {
        briefingText = await askAI(prompt, { timeout: 15000 });
      } catch {
        briefingText = fallbackBriefing(data, score, subscores);
      }

      cachedBriefing = {
        briefing: briefingText,
        score,
        subscores,
        data: {
          cpu: sys ? sys.cpuPct || 0 : 0,
          mem: sys ? sys.usedMemPct || 0 : 0,
          memUsed: sys ? sys.usedMemMB || 0 : 0,
          memTotal: sys ? sys.totalMemMB || 0 : 0,
          disk: sys ? sys.diskPct || 0 : 0,
          uptime: sys ? sys.uptimeHours || 0 : 0,
          nodeVersion: sys ? sys.nodeVersion || "" : "",
          cpuCount: sys ? sys.cpuCount || 0 : 0,
          dbName: data.dbInfo ? data.dbInfo.name : null,
          dbSize: data.dbInfo ? data.dbInfo.size : null,
          dbTables: data.dbInfo ? +data.dbInfo.tables : 0,
          dbConnections: data.dbInfo ? +data.dbInfo.connections : 0,
          processCount: procList.length,
          processOnline: procList.filter((p) => p.status === "online").length,
          serverCount: srvList.length,
          serverHealthy: srvList.filter(
            (s) => s.status === "healthy" || s.status === "up"
          ).length,
          ticketCount: openTickets,
          activityCount: (data.activity || []).length,
          processes: procList.slice(0, 10).map((p) => ({
            name: p.name,
            status: p.status,
            cpu: p.cpu || 0,
            memory: p.memory || 0,
          })),
          servers: srvList.slice(0, 10).map((s) => ({
            name: s.name,
            status: s.status,
            host: s.host || "",
            latency: s.latency || null,
            provider: s.provider || "local",
          })),
        },
      };
      cacheTime = Date.now();
      res.json(cachedBriefing);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  function fallbackBriefing(data, score, sub) {
    const sys = data.system;
    const parts = [];
    if (score >= 80) parts.push(`Infrastructure is healthy at ${score}/100.`);
    else if (score >= 50)
      parts.push(
        `Infrastructure needs attention — health score is ${score}/100.`
      );
    else parts.push(`Infrastructure alert — health score is ${score}/100.`);

    if (sys)
      parts.push(
        `CPU at ${sys.cpuPct || 0}%, memory at ${sys.usedMemPct || 0}% (${sys.usedMemMB || 0}MB used).`
      );

    if (data.dbInfo)
      parts.push(
        `Database "${data.dbInfo.name}" has ${data.dbInfo.tables} tables, cache hit ${sub.database}%.`
      );
    else parts.push("Database is not connected.");

    const openTix = Array.isArray(data.tickets.tickets)
      ? data.tickets.tickets.length
      : 0;
    if (openTix > 0) parts.push(`${openTix} open tickets need attention.`);

    return parts.join(" ");
  }
};
