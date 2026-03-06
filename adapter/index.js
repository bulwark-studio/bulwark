import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.ADAPTER_PORT || 4001;
const SERVERKIT_URL = process.env.SERVERKIT_URL || "http://localhost:5000";
const SERVERKIT_USER = process.env.SERVERKIT_USER;
const SERVERKIT_PASS = process.env.SERVERKIT_PASS;

if (!SERVERKIT_USER || !SERVERKIT_PASS) {
  console.error("SERVERKIT_USER and SERVERKIT_PASS must be set before launching the adapter.");
  process.exit(1);
}

const app = express();
app.use(express.json());

let cachedToken = null;
let tokenExpiresAt = 0;

async function obtainServerKitToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60 * 1000) {
    return cachedToken;
  }
  const res = await fetch(`${SERVERKIT_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SERVERKIT_USER, password: SERVERKIT_PASS }),
  });
  if (!res.ok) {
    throw new Error(`ServerKit auth failed: ${res.statusText}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}

async function proxyRequest(path, options = {}) {
  const token = await obtainServerKitToken();
  const res = await fetch(`${SERVERKIT_URL}${path}`, {
    ...(options || {}),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || res.statusText);
  return payload;
}

function sanitizeJson(body) {
  try {
    return JSON.parse(JSON.stringify(body));
  } catch {
    return body;
  }
}

app.get("/health", (req, res) => res.json({ status: "ok", source: "adapter" }));

app.get("/docker/containers", async (req, res) => {
  try {
    const payload = await proxyRequest("/api/v1/docker/containers");
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/docker/containers/:id/:action", async (req, res) => {
  const { id, action } = req.params;
  if (!["start", "stop", "restart"].includes(action)) {
    return res.status(400).json({ error: "Unsupported action" });
  }
  try {
    const payload = await proxyRequest(`/api/v1/docker/containers/${id}/${action}`, {
      method: "POST",
    });
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/databases", async (req, res) => {
  try {
    const payload = await proxyRequest("/api/v1/databases", {
      method: "POST",
      body: JSON.stringify(sanitizeJson(req.body)),
    });
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/databases", async (req, res) => {
  try {
    const payload = await proxyRequest("/api/v1/databases");
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/ssl/issue", async (req, res) => {
  try {
    const payload = await proxyRequest("/api/v1/ssl/issue", {
      method: "POST",
      body: JSON.stringify(sanitizeJson(req.body)),
    });
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Adapter listening on port ${PORT} proxying ${SERVERKIT_URL}`);
});
