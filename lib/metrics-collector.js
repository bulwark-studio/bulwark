const os = require("os");
const { execCommand } = require("./exec");

// Rolling history — 600 entries = 30 min at 3s interval
const MAX_HISTORY = 600;
const history = { cpu: [], memory: [], network: [], disk: [] };

let prevNetCounters = null;
let prevCpuTimes = null;
let lastAggregateCpu = 0;

function getPerCoreCPU() {
  const cpus = os.cpus();
  const now = cpus.map(c => {
    const total = Object.values(c.times).reduce((a, b) => a + b, 0);
    return { idle: c.times.idle, total };
  });

  if (!prevCpuTimes) {
    prevCpuTimes = now;
    return cpus.map(() => 0);
  }

  const usage = now.map((cur, i) => {
    const prev = prevCpuTimes[i];
    const idleDiff = cur.idle - prev.idle;
    const totalDiff = cur.total - prev.total;
    return totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
  });

  prevCpuTimes = now;
  // Track aggregate CPU from per-core deltas (much more accurate than cumulative)
  const total = usage.reduce((a, b) => a + b, 0);
  lastAggregateCpu = usage.length ? Math.round(total / usage.length) : 0;
  return usage;
}

function getSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  return {
    hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
    cpuCount: cpus.length, cpuModel: cpus[0]?.model || "unknown",
    cpuPct: lastAggregateCpu || Math.round(100 - (totalIdle / totalTick) * 100),
    totalMemMB: Math.round(totalMem / 1024 / 1024),
    freeMemMB: Math.round(freeMem / 1024 / 1024),
    usedMemMB: Math.round((totalMem - freeMem) / 1024 / 1024),
    usedMemPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
    uptimeHours: +(os.uptime() / 3600).toFixed(1),
    uptimeSecs: Math.round(os.uptime()),
    loadAvg: os.loadavg().map((l) => l.toFixed(2)),
    nodeVersion: process.version,
  };
}

function getNetworkIO() {
  const ifaces = os.networkInterfaces();
  let rxBytes = 0, txBytes = 0;
  // On most systems we can't get byte counters from os.networkInterfaces()
  // This returns interface info; actual byte counters need /proc/net/dev on Linux
  const interfaces = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (name === "lo" || name.startsWith("vEthernet")) continue;
    const ipv4 = addrs.find(a => a.family === "IPv4" && !a.internal);
    if (ipv4) interfaces.push({ name, address: ipv4.address });
  }
  return { interfaces, rxBytes, txBytes };
}

async function getDiskUsage() {
  try {
    if (os.platform() === "win32") {
      const r = await execCommand("wmic logicaldisk get size,freespace,caption /format:csv", { timeout: 5000 });
      const lines = r.stdout.trim().split("\n").filter(l => l.includes(",")).slice(1);
      return lines.map(l => {
        const parts = l.trim().split(",");
        const caption = parts[1] || "?";
        const free = parseInt(parts[2]) || 0;
        const size = parseInt(parts[3]) || 0;
        return { mount: caption, size: Math.round(size / 1024 / 1024 / 1024), free: Math.round(free / 1024 / 1024 / 1024), usedPct: size ? Math.round((1 - free / size) * 100) : 0 };
      }).filter(d => d.size > 0);
    } else {
      const r = await execCommand("df -BG --output=target,size,avail,pcent 2>/dev/null | tail -n +2", { timeout: 5000 });
      return r.stdout.trim().split("\n").filter(Boolean).map(l => {
        const parts = l.trim().split(/\s+/);
        return { mount: parts[0], size: parseInt(parts[1]) || 0, free: parseInt(parts[2]) || 0, usedPct: parseInt(parts[3]) || 0 };
      }).filter(d => d.size > 0 && !d.mount.startsWith("/snap"));
    }
  } catch { return []; }
}

function collectMetrics() {
  const ts = Date.now();
  const perCore = getPerCoreCPU();
  const sys = getSystemInfo();
  const net = getNetworkIO();

  const entry = { ts, cpuPct: sys.cpuPct, perCore, memPct: sys.usedMemPct, memUsedMB: sys.usedMemMB, memTotalMB: sys.totalMemMB, net };

  history.cpu.push({ ts, value: sys.cpuPct, perCore });
  history.memory.push({ ts, used: sys.usedMemMB, total: sys.totalMemMB, pct: sys.usedMemPct });

  // Trim histories
  for (const key of Object.keys(history)) {
    if (history[key].length > MAX_HISTORY) history[key] = history[key].slice(-MAX_HISTORY);
  }

  return entry;
}

function getHistory(type, count = 60) {
  return (history[type] || []).slice(-count);
}

module.exports = { getSystemInfo, getPerCoreCPU, getNetworkIO, getDiskUsage, collectMetrics, getHistory };
