const ADAPTER_URL = process.env.ADAPTER_URL || "http://127.0.0.1:4001";

async function callAdapter(path, opts = {}) {
  if (!ADAPTER_URL) throw new Error("Adapter URL not configured");
  const response = await fetch(`${ADAPTER_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || response.statusText);
  return payload;
}

module.exports = { callAdapter, ADAPTER_URL };
