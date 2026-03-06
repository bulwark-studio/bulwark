/**
 * Cloudflare API Client — GraphQL Analytics + REST Management
 * Zero npm deps — raw fetch to api.cloudflare.com
 */

const fs = require('fs');
const path = require('path');
const neuralCache = require('./neural-cache');

const CF_API = 'https://api.cloudflare.com/client/v4';
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'cloudflare-config.json');

// ── Config persistence ────────────────────────────────────────────────────
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return { apiToken: '', accountId: '', zones: [] }; }
}

function saveConfig(cfg) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ── HTTP helpers ──────────────────────────────────────────────────────────
async function cfFetch(endpoint, token, opts = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${CF_API}${endpoint}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

async function cfGraphQL(token, query, variables = {}) {
  const res = await fetch(`${CF_API}/graphql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  return res.json();
}

// ── Zone Management ───────────────────────────────────────────────────────
async function fetchZones(token) {
  const cached = neuralCache.get('cf:zones');
  if (cached) return cached;

  const data = await cfFetch('/zones?per_page=50', token);
  if (!data.result) return [];
  const zones = data.result.map(z => ({
    id: z.id,
    domain: z.name,
    status: z.status,
    plan: z.plan?.name || 'Free',
    nameServers: z.name_servers,
    paused: z.paused,
    type: z.type,
    createdOn: z.created_on,
  }));
  neuralCache.set('cf:zones', zones, 300000); // 5min
  return zones;
}

// ── Analytics (GraphQL) ──────────────────────────────────────────────────
async function fetchAnalytics(token, zoneId, range) {
  const cacheKey = `cf:analytics:${zoneId}:${range}`;
  const cached = neuralCache.get(cacheKey);
  if (cached) return cached;

  const ranges = {
    '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '30d': 2592000,
  };
  const seconds = ranges[range] || 86400;
  const since = new Date(Date.now() - seconds * 1000).toISOString();
  const until = new Date().toISOString();

  const query = `query {
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequestsAdaptiveGroups(
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
          limit: 5000
          orderBy: [datetime_ASC]
        ) {
          count
          sum {
            edgeResponseBytes
            visits
            threats
            pageViews
          }
          dimensions {
            datetime
          }
        }
        httpRequestsAdaptive(
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
          limit: 1
        ) {
          __typename
        }
        httpRequests1hGroups(
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
          limit: 100
          orderBy: [datetime_ASC]
        ) {
          sum {
            requests
            cachedRequests
            bytes
            cachedBytes
            threats
            pageViews
            countryMap {
              clientCountryName
              requests
              threats
            }
            responseStatusMap {
              edgeResponseStatus
              requests
            }
          }
          dimensions {
            datetime
          }
          uniq {
            uniques
          }
        }
      }
    }
  }`;

  const data = await cfGraphQL(token, query);
  const zones = data?.data?.viewer?.zones || [];
  const zone = zones[0] || {};

  // Aggregate from httpRequests1hGroups
  const groups = zone.httpRequests1hGroups || [];
  let totalRequests = 0, cachedRequests = 0, totalBytes = 0, cachedBytes = 0;
  let totalThreats = 0, totalPageViews = 0, totalUniques = 0;
  const countries = {};
  const statusCodes = {};
  const timeline = [];

  groups.forEach(g => {
    const s = g.sum || {};
    totalRequests += s.requests || 0;
    cachedRequests += s.cachedRequests || 0;
    totalBytes += s.bytes || 0;
    cachedBytes += s.cachedBytes || 0;
    totalThreats += s.threats || 0;
    totalPageViews += s.pageViews || 0;
    totalUniques += (g.uniq?.uniques || 0);

    timeline.push({
      time: g.dimensions?.datetime,
      requests: s.requests || 0,
      cached: s.cachedRequests || 0,
      bytes: s.bytes || 0,
      threats: s.threats || 0,
    });

    (s.countryMap || []).forEach(c => {
      countries[c.clientCountryName] = (countries[c.clientCountryName] || 0) + c.requests;
    });
    (s.responseStatusMap || []).forEach(r => {
      statusCodes[r.edgeResponseStatus] = (statusCodes[r.edgeResponseStatus] || 0) + r.requests;
    });
  });

  const cacheRatio = totalRequests > 0 ? ((cachedRequests / totalRequests) * 100).toFixed(1) : '0.0';

  const result = {
    zoneId, range,
    totalRequests, cachedRequests, uncachedRequests: totalRequests - cachedRequests,
    totalBytes, cachedBytes, bandwidthSaved: cachedBytes,
    totalThreats, totalPageViews, totalUniques,
    cacheRatio: parseFloat(cacheRatio),
    countries: Object.entries(countries)
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 20),
    statusCodes: Object.entries(statusCodes)
      .map(([code, count]) => ({ code: parseInt(code), count }))
      .sort((a, b) => b.count - a.count),
    timeline,
  };

  neuralCache.set(cacheKey, result, 60000); // 60s
  return result;
}

// ── Overview (all zones aggregated) ──────────────────────────────────────
async function fetchOverview(token, range) {
  const cached = neuralCache.get(`cf:overview:${range}`);
  if (cached) return cached;

  const zones = await fetchZones(token);
  const results = await Promise.allSettled(
    zones.map(z => fetchAnalytics(token, z.id, range))
  );

  const overview = {
    zoneCount: zones.length,
    totalRequests: 0, cachedRequests: 0, totalBytes: 0, cachedBytes: 0,
    totalThreats: 0, totalPageViews: 0, totalUniques: 0,
    zones: [],
  };

  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      const v = r.value;
      overview.totalRequests += v.totalRequests;
      overview.cachedRequests += v.cachedRequests;
      overview.totalBytes += v.totalBytes;
      overview.cachedBytes += v.cachedBytes;
      overview.totalThreats += v.totalThreats;
      overview.totalPageViews += v.totalPageViews;
      overview.totalUniques += v.totalUniques;
      overview.zones.push({ domain: zones[i].domain, ...v });
    }
  });

  overview.cacheRatio = overview.totalRequests > 0
    ? parseFloat(((overview.cachedRequests / overview.totalRequests) * 100).toFixed(1))
    : 0;

  neuralCache.set(`cf:overview:${range}`, overview, 60000);
  return overview;
}

// ── DNS Records ──────────────────────────────────────────────────────────
async function fetchDNS(token, zoneId) {
  const cached = neuralCache.get(`cf:dns:${zoneId}`);
  if (cached) return cached;

  const data = await cfFetch(`/zones/${zoneId}/dns_records?per_page=100`, token);
  const records = (data.result || []).map(r => ({
    id: r.id, type: r.type, name: r.name, content: r.content,
    proxied: r.proxied, ttl: r.ttl, priority: r.priority,
  }));
  neuralCache.set(`cf:dns:${zoneId}`, records, 120000);
  return records;
}

// ── SSL Status ───────────────────────────────────────────────────────────
async function fetchSSLStatus(token, zoneId) {
  const cached = neuralCache.get(`cf:ssl:${zoneId}`);
  if (cached) return cached;

  const [settings, verification] = await Promise.allSettled([
    cfFetch(`/zones/${zoneId}/ssl/settings`, token),
    cfFetch(`/zones/${zoneId}/ssl/verification`, token),
  ]);

  const result = {
    mode: settings.status === 'fulfilled' ? settings.value?.result?.value : 'unknown',
    certificates: (verification.status === 'fulfilled' ? verification.value?.result : []) || [],
  };
  neuralCache.set(`cf:ssl:${zoneId}`, result, 300000);
  return result;
}

// ── Cache Purge ──────────────────────────────────────────────────────────
async function purgeCache(token, zoneId, urls) {
  const body = urls && urls.length > 0 ? { files: urls } : { purge_everything: true };
  const result = await cfFetch(`/zones/${zoneId}/purge_cache`, token, {
    method: 'POST', body,
  });
  // Invalidate our local cache for this zone too
  neuralCache.invalidatePrefix(`cf:analytics:${zoneId}`);
  return result;
}

// ── Exports ──────────────────────────────────────────────────────────────
module.exports = {
  loadConfig, saveConfig,
  fetchZones, fetchAnalytics, fetchOverview,
  fetchDNS, fetchSSLStatus, purgeCache,
};
