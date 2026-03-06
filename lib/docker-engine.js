/**
 * Docker Engine Client — Direct API via Unix socket or TCP
 * Zero npm deps — raw HTTP to Docker Engine REST API
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const neuralCache = require('./neural-cache');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'docker-connections.json');
const DEFAULT_SOCKET = process.platform === 'win32'
  ? '//./pipe/docker_engine'
  : '/var/run/docker.sock';

// Migrate old single-config format to multi-connection
const OLD_CONFIG_PATH = path.join(__dirname, '..', 'data', 'docker-config.json');
(function migrateOldConfig() {
  try {
    if (fs.existsSync(OLD_CONFIG_PATH) && !fs.existsSync(CONFIG_PATH)) {
      const old = JSON.parse(fs.readFileSync(OLD_CONFIG_PATH, 'utf8'));
      if (old && (old.socketPath || old.host)) {
        const conn = {
          id: Date.now().toString(36),
          name: old.host ? 'Remote ' + old.host : 'Local Docker',
          type: old.host ? 'remote' : 'local',
          socketPath: old.socketPath || null,
          host: old.host || null,
          port: old.port || null,
          active: true,
          added: new Date().toISOString()
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify([conn], null, 2));
      }
      fs.unlinkSync(OLD_CONFIG_PATH);
    }
  } catch {}
})();

function loadConnections() {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function saveConnections(connections) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(connections, null, 2));
}

function getActiveConnection() {
  const conns = loadConnections();
  return conns.find(c => c.active) || null;
}

// Legacy compat — loadConfig returns active connection or defaults
function loadConfig() {
  const active = getActiveConnection();
  if (active) return { socketPath: active.socketPath, host: active.host, port: active.port };
  return { socketPath: DEFAULT_SOCKET, host: null, port: null };
}

// Legacy compat — saveConfig adds/updates a connection
function saveConfig(cfg) {
  const conns = loadConnections();
  // Deactivate all, add new as active
  conns.forEach(c => { c.active = false; });
  conns.push({
    id: Date.now().toString(36),
    name: cfg.name || (cfg.host ? 'Remote ' + cfg.host : 'Local Docker'),
    type: cfg.host ? 'remote' : 'local',
    socketPath: cfg.socketPath || null,
    host: cfg.host || null,
    port: cfg.port || null,
    active: true,
    added: new Date().toISOString()
  });
  saveConnections(conns);
}

// ── Raw HTTP to Docker socket/TCP ────────────────────────────────────────
function dockerRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const cfg = loadConfig();
    const opts = {
      method,
      path: apiPath,
      headers: { 'Content-Type': 'application/json' },
    };

    if (cfg.host && cfg.port) {
      opts.hostname = cfg.host;
      opts.port = cfg.port;
    } else {
      opts.socketPath = cfg.socketPath || DEFAULT_SOCKET;
    }

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Docker API timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Container Operations ─────────────────────────────────────────────────
async function listContainers(all) {
  const cacheKey = 'docker:containers:' + (all ? 'all' : 'running');
  const cached = neuralCache.get(cacheKey);
  if (cached) return cached;

  const { data } = await dockerRequest('GET', '/containers/json?all=' + (all ? '1' : '0'));
  const containers = (Array.isArray(data) ? data : []).map(c => ({
    id: c.Id,
    shortId: (c.Id || '').slice(0, 12),
    names: (c.Names || []).map(n => n.replace(/^\//, '')),
    name: ((c.Names || [])[0] || '').replace(/^\//, ''),
    image: c.Image,
    imageId: (c.ImageID || '').slice(0, 19),
    state: c.State,
    status: c.Status,
    created: c.Created,
    ports: (c.Ports || []).map(p => ({
      ip: p.IP, privatePort: p.PrivatePort, publicPort: p.PublicPort, type: p.Type,
    })),
    mounts: (c.Mounts || []).map(m => ({
      type: m.Type, source: m.Source, destination: m.Destination, mode: m.Mode,
    })),
    networks: Object.keys(c.NetworkSettings?.Networks || {}),
    sizeRw: c.SizeRw,
    sizeRootFs: c.SizeRootFs,
  }));

  neuralCache.set(cacheKey, containers, 10000);
  return containers;
}

async function inspectContainer(id) {
  const cacheKey = 'docker:inspect:' + id;
  const cached = neuralCache.get(cacheKey);
  if (cached) return cached;

  const { data } = await dockerRequest('GET', '/containers/' + id + '/json');
  neuralCache.set(cacheKey, data, 15000);
  return data;
}

async function containerStats(id) {
  const cacheKey = 'docker:stats:' + id;
  const cached = neuralCache.get(cacheKey);
  if (cached) return cached;

  const { data } = await dockerRequest('GET', '/containers/' + id + '/stats?stream=false');
  if (!data || typeof data === 'string') return null;

  // Parse stats into usable format
  const cpuDelta = (data.cpu_stats?.cpu_usage?.total_usage || 0) - (data.precpu_stats?.cpu_usage?.total_usage || 0);
  const sysDelta = (data.cpu_stats?.system_cpu_usage || 0) - (data.precpu_stats?.system_cpu_usage || 0);
  const cpuCount = data.cpu_stats?.online_cpus || data.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
  const cpuPct = sysDelta > 0 ? ((cpuDelta / sysDelta) * cpuCount * 100).toFixed(2) : '0.00';

  const memUsage = data.memory_stats?.usage || 0;
  const memLimit = data.memory_stats?.limit || 1;
  const memPct = ((memUsage / memLimit) * 100).toFixed(1);

  const netRx = Object.values(data.networks || {}).reduce((s, n) => s + (n.rx_bytes || 0), 0);
  const netTx = Object.values(data.networks || {}).reduce((s, n) => s + (n.tx_bytes || 0), 0);

  const parsed = {
    cpuPct: parseFloat(cpuPct),
    memUsage, memLimit,
    memPct: parseFloat(memPct),
    memUsageMB: (memUsage / 1048576).toFixed(1),
    memLimitMB: (memLimit / 1048576).toFixed(0),
    netRx, netTx,
    netRxFormatted: formatBytes(netRx),
    netTxFormatted: formatBytes(netTx),
    blockRead: data.blkio_stats?.io_service_bytes_recursive?.find(s => s.op === 'read')?.value || 0,
    blockWrite: data.blkio_stats?.io_service_bytes_recursive?.find(s => s.op === 'write')?.value || 0,
    pids: data.pids_stats?.current || 0,
  };

  neuralCache.set(cacheKey, parsed, 5000);
  return parsed;
}

async function containerLogs(id, tail, since) {
  const { data } = await dockerRequest('GET',
    '/containers/' + id + '/logs?stdout=1&stderr=1&timestamps=1&tail=' + (tail || 200) +
    (since ? '&since=' + since : ''));
  // Docker logs have 8-byte header per line — strip it for display
  if (typeof data === 'string') {
    return data.split('\n').map(line => {
      // Strip Docker stream header (first 8 bytes if binary)
      if (line.length > 8 && line.charCodeAt(0) <= 2) return line.slice(8);
      return line;
    }).join('\n');
  }
  return typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
}

async function containerAction(id, action) {
  const { status, data } = await dockerRequest('POST', '/containers/' + id + '/' + action);
  // Invalidate container caches
  neuralCache.invalidatePrefix('docker:containers');
  neuralCache.invalidatePrefix('docker:inspect:' + id);
  neuralCache.invalidatePrefix('docker:stats:' + id);
  return { status, data };
}

async function removeContainer(id, force) {
  const { status, data } = await dockerRequest('DELETE', '/containers/' + id + '?force=' + (force ? '1' : '0'));
  neuralCache.invalidatePrefix('docker:');
  return { status, data };
}

// ── Image Operations ─────────────────────────────────────────────────────
async function listImages() {
  const cached = neuralCache.get('docker:images');
  if (cached) return cached;

  const { data } = await dockerRequest('GET', '/images/json');
  const images = (Array.isArray(data) ? data : []).map(i => ({
    id: (i.Id || '').replace('sha256:', '').slice(0, 12),
    fullId: i.Id,
    repoTags: i.RepoTags || ['<none>:<none>'],
    repo: ((i.RepoTags || [])[0] || '<none>:<none>').split(':')[0],
    tag: ((i.RepoTags || [])[0] || '<none>:<none>').split(':')[1] || 'latest',
    size: i.Size,
    sizeFormatted: formatBytes(i.Size),
    created: i.Created,
    containers: i.Containers || 0,
  }));

  neuralCache.set('docker:images', images, 60000);
  return images;
}

async function pullImage(name, tag) {
  tag = tag || 'latest';
  const { status, data } = await dockerRequest('POST', '/images/create?fromImage=' + encodeURIComponent(name) + '&tag=' + encodeURIComponent(tag));
  neuralCache.invalidate('docker:images');
  return { status, data };
}

async function removeImage(id, force) {
  const { status, data } = await dockerRequest('DELETE', '/images/' + id + '?force=' + (force ? '1' : '0'));
  neuralCache.invalidate('docker:images');
  return { status, data };
}

// ── Network & Volume Operations ──────────────────────────────────────────
async function listNetworks() {
  const cached = neuralCache.get('docker:networks');
  if (cached) return cached;
  const { data } = await dockerRequest('GET', '/networks');
  const nets = (Array.isArray(data) ? data : []).map(n => ({
    id: (n.Id || '').slice(0, 12),
    name: n.Name,
    driver: n.Driver,
    scope: n.Scope,
    subnet: (n.IPAM?.Config || [])[0]?.Subnet || '',
    gateway: (n.IPAM?.Config || [])[0]?.Gateway || '',
    containers: Object.keys(n.Containers || {}).length,
  }));
  neuralCache.set('docker:networks', nets, 120000);
  return nets;
}

async function listVolumes() {
  const cached = neuralCache.get('docker:volumes');
  if (cached) return cached;
  const { data } = await dockerRequest('GET', '/volumes');
  const vols = ((data?.Volumes) || []).map(v => ({
    name: v.Name,
    driver: v.Driver,
    mountpoint: v.Mountpoint,
    scope: v.Scope,
    created: v.CreatedAt,
    labels: v.Labels || {},
  }));
  neuralCache.set('docker:volumes', vols, 120000);
  return vols;
}

// ── Deploy (Create + Start) ──────────────────────────────────────────────
async function createContainer(config) {
  const name = config.name ? '?name=' + encodeURIComponent(config.name) : '';
  const body = {
    Image: config.image,
    Env: (config.env || []),
    ExposedPorts: {},
    HostConfig: {
      PortBindings: {},
      Binds: config.volumes || [],
      RestartPolicy: { Name: config.restart || 'unless-stopped' },
    },
  };
  // Parse port mappings: "8080:80" → { "80/tcp": [{ HostPort: "8080" }] }
  (config.ports || []).forEach(p => {
    const [host, container] = p.split(':');
    if (host && container) {
      body.ExposedPorts[container + '/tcp'] = {};
      body.HostConfig.PortBindings[container + '/tcp'] = [{ HostPort: host }];
    }
  });

  const { status, data } = await dockerRequest('POST', '/containers/create' + name, body);
  if (status === 201 && data?.Id) {
    await dockerRequest('POST', '/containers/' + data.Id + '/start');
    neuralCache.invalidatePrefix('docker:');
  }
  return { status, data };
}

// ── System Operations ────────────────────────────────────────────────────

// Docker system df — disk usage breakdown
async function systemDf() {
  const { data } = await dockerRequest('GET', '/system/df');
  if (!data || typeof data === 'string') return null;
  const imgSize = (data.Images || []).reduce((s, i) => s + (i.Size || 0), 0);
  const imgReclaimable = (data.Images || []).filter(i => i.Containers === 0).reduce((s, i) => s + (i.Size || 0), 0);
  const ctrSize = (data.Containers || []).reduce((s, c) => s + (c.SizeRw || 0), 0);
  const volSize = (data.Volumes || []).reduce((s, v) => s + (v.UsageData?.Size || 0), 0);
  const volReclaimable = (data.Volumes || []).filter(v => v.UsageData?.RefCount === 0).reduce((s, v) => s + (v.UsageData?.Size || 0), 0);
  const cacheSize = (data.BuildCache || []).reduce((s, c) => s + (c.Size || 0), 0);
  const cacheReclaimable = (data.BuildCache || []).filter(c => !c.InUse).reduce((s, c) => s + (c.Size || 0), 0);
  return {
    images: { count: (data.Images || []).length, size: imgSize, sizeFormatted: formatBytes(imgSize), reclaimable: imgReclaimable, reclaimableFormatted: formatBytes(imgReclaimable) },
    containers: { count: (data.Containers || []).length, size: ctrSize, sizeFormatted: formatBytes(ctrSize) },
    volumes: { count: (data.Volumes || []).length, size: volSize, sizeFormatted: formatBytes(volSize), reclaimable: volReclaimable, reclaimableFormatted: formatBytes(volReclaimable) },
    buildCache: { count: (data.BuildCache || []).length, size: cacheSize, sizeFormatted: formatBytes(cacheSize), reclaimable: cacheReclaimable, reclaimableFormatted: formatBytes(cacheReclaimable) },
    totalSize: imgSize + ctrSize + volSize + cacheSize,
    totalFormatted: formatBytes(imgSize + ctrSize + volSize + cacheSize),
    totalReclaimable: imgReclaimable + volReclaimable + cacheReclaimable,
    totalReclaimableFormatted: formatBytes(imgReclaimable + volReclaimable + cacheReclaimable),
  };
}

// Prune operations
async function pruneContainers() {
  const { data } = await dockerRequest('POST', '/containers/prune');
  neuralCache.invalidatePrefix('docker:');
  return { deleted: data?.ContainersDeleted || [], spaceReclaimed: data?.SpaceReclaimed || 0, spaceFormatted: formatBytes(data?.SpaceReclaimed || 0) };
}

async function pruneImages(dangling) {
  const filter = dangling !== false ? '?filters=' + encodeURIComponent('{"dangling":["true"]}') : '';
  const { data } = await dockerRequest('POST', '/images/prune' + filter);
  neuralCache.invalidatePrefix('docker:');
  return { deleted: (data?.ImagesDeleted || []).length, spaceReclaimed: data?.SpaceReclaimed || 0, spaceFormatted: formatBytes(data?.SpaceReclaimed || 0) };
}

async function pruneVolumes() {
  const { data } = await dockerRequest('POST', '/volumes/prune');
  neuralCache.invalidatePrefix('docker:');
  return { deleted: data?.VolumesDeleted || [], spaceReclaimed: data?.SpaceReclaimed || 0, spaceFormatted: formatBytes(data?.SpaceReclaimed || 0) };
}

async function pruneNetworks() {
  const { data } = await dockerRequest('POST', '/networks/prune');
  neuralCache.invalidatePrefix('docker:');
  return { deleted: data?.NetworksDeleted || [] };
}

async function pruneBuildCache() {
  const { data } = await dockerRequest('POST', '/build/prune');
  neuralCache.invalidatePrefix('docker:');
  return { count: data?.CachesDeleted?.length || 0, spaceReclaimed: data?.SpaceReclaimed || 0, spaceFormatted: formatBytes(data?.SpaceReclaimed || 0) };
}

// Full system prune — everything
async function systemPrune(includeVolumes) {
  const results = await Promise.allSettled([
    pruneContainers(),
    pruneImages(false),
    pruneNetworks(),
    pruneBuildCache(),
    ...(includeVolumes ? [pruneVolumes()] : []),
  ]);
  const total = results.reduce((s, r) => s + (r.value?.spaceReclaimed || 0), 0);
  neuralCache.invalidatePrefix('docker:');
  return {
    containers: results[0]?.value || {},
    images: results[1]?.value || {},
    networks: results[2]?.value || {},
    buildCache: results[3]?.value || {},
    volumes: includeVolumes ? (results[4]?.value || {}) : null,
    totalReclaimed: total,
    totalFormatted: formatBytes(total),
  };
}

// Container top — running processes inside container
async function containerTop(id, psArgs) {
  const qs = psArgs ? '?ps_args=' + encodeURIComponent(psArgs) : '';
  const { data } = await dockerRequest('GET', '/containers/' + id + '/top' + qs);
  return data;
}

// Container changes — filesystem diff
async function containerChanges(id) {
  const { data } = await dockerRequest('GET', '/containers/' + id + '/changes');
  return Array.isArray(data) ? data.map(c => ({
    path: c.Path,
    kind: c.Kind === 0 ? 'Modified' : c.Kind === 1 ? 'Added' : 'Deleted',
  })) : [];
}

// Docker version + info
async function systemInfo() {
  const [version, info] = await Promise.allSettled([
    dockerRequest('GET', '/version'),
    dockerRequest('GET', '/info'),
  ]);
  const v = version.value?.data || {};
  const i = info.value?.data || {};
  return {
    version: v.Version || 'unknown',
    apiVersion: v.ApiVersion || 'unknown',
    os: v.Os + '/' + v.Arch,
    kernelVersion: v.KernelVersion || '',
    goVersion: v.GoVersion || '',
    buildTime: v.BuildTime || '',
    containers: i.Containers || 0,
    containersRunning: i.ContainersRunning || 0,
    containersStopped: i.ContainersStopped || 0,
    containersPaused: i.ContainersPaused || 0,
    images: i.Images || 0,
    driver: i.Driver || '',
    memTotal: i.MemTotal || 0,
    memTotalFormatted: formatBytes(i.MemTotal || 0),
    cpus: i.NCPU || 0,
    serverVersion: i.ServerVersion || '',
    operatingSystem: i.OperatingSystem || '',
    architecture: i.Architecture || '',
    name: i.Name || '',
  };
}

// Rename container
async function renameContainer(id, newName) {
  const { status } = await dockerRequest('POST', '/containers/' + id + '/rename?name=' + encodeURIComponent(newName));
  neuralCache.invalidatePrefix('docker:');
  return status === 204;
}

// Export container (returns tar stream info — we just trigger it)
async function exportContainer(id) {
  // Note: actual export is binary stream; we return the endpoint for download
  return { endpoint: '/containers/' + id + '/export', note: 'Binary tar stream' };
}

// ── Health Check ─────────────────────────────────────────────────────────
async function isAvailable() {
  try {
    const { status } = await dockerRequest('GET', '/_ping');
    return status === 200;
  } catch { return false; }
}

// ── Helpers ──────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

module.exports = {
  loadConfig, saveConfig, loadConnections, saveConnections, getActiveConnection, isAvailable,
  listContainers, inspectContainer, containerStats, containerLogs,
  containerAction, removeContainer, containerTop, containerChanges,
  renameContainer, exportContainer,
  listImages, pullImage, removeImage,
  listNetworks, listVolumes,
  createContainer,
  systemDf, systemInfo, systemPrune,
  pruneContainers, pruneImages, pruneVolumes, pruneNetworks, pruneBuildCache,
};
