let base = "";

export function setServer(server) {
  const v = (server || "").trim().replace(/\/+$/, "");
  if (!v) {
    base = "";
    return;
  }
  base = /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function serverHost() {
  if (!base) return location.host;
  return base.replace(/^https?:\/\//i, "");
}

async function post(path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const enroll = (account, publicKey) => post("/v1/enroll", { account, public_key: publicKey });
export const devices = (account) => post("/v1/devices", { account });
export const revoke = (account, publicKey) => post("/v1/revoke", { account, public_key: publicKey });

export function buildConfig(privateKey, r) {
  return [
    "[Interface]",
    `PrivateKey = ${privateKey}`,
    `Address = ${r.address4}, ${r.address6}`,
    `DNS = ${r.dns}`,
    "",
    "[Peer]",
    `PublicKey = ${r.server_public_key}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    `Endpoint = ${r.endpoint}`,
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}
