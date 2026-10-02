import { native } from "./native.js";
import { generateDeviceKey, fillProfile } from "./csr.js";

let base = "";
let rawServer = "";
let creds = null;

export function setServer(server) {
  rawServer = (server || "").trim();
  const v = rawServer.replace(/\/+$/, "");
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
  }).catch(() => {
    throw new Error("Cannot reach that server");
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const msg = (err) => new Error(typeof err === "string" ? err : err?.message || "Request failed");

export async function register(account, password) {
  if (native) return native.register(rawServer, account || null, password).catch((e) => Promise.reject(msg(e)));
  const r = await post("/v1/register", account ? { account, password } : { password });
  return r.account;
}

export async function login(account, password) {
  if (native) return native.loginCheck(rawServer, account, password).catch((e) => Promise.reject(msg(e)));
  const r = await post("/v1/devices", { account, password });
  creds = { account, password };
  return r;
}

export async function provision(account, password, name) {
  return native.provision(rawServer, account, password, name).catch((e) => Promise.reject(msg(e)));
}

export async function listDevices() {
  if (native) return native.listDevices().catch((e) => Promise.reject(msg(e)));
  return post("/v1/devices", creds);
}

export async function addDevice(name) {
  if (native) return native.addDeviceConfig(name).catch((e) => Promise.reject(msg(e)));
  const k = await generateDeviceKey();
  const r = await post("/v1/enroll", { ...creds, name, csr: k.csr });
  return fillProfile(r.profile, k.privateKey);
}

export async function revokeDevice(id) {
  if (native) return native.revokeDevice(id).catch((e) => Promise.reject(msg(e)));
  return post("/v1/revoke", { ...creds, id });
}

export async function changePassword(newPassword) {
  if (native) return native.changePassword(newPassword).catch((e) => Promise.reject(msg(e)));
  await post("/v1/password", { ...creds, new_password: newPassword });
  creds = { ...creds, password: newPassword };
}

export function clearCreds() {
  creds = null;
}
