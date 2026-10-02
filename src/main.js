import * as api from "./api.js";
import { createWave } from "./wave.js";
import { icons } from "./icons.js";
import { native } from "./native.js";
import { supportsKeys } from "./csr.js";
import "./style.css";

const app = document.getElementById("app");
const wave = createWave();
const sameOrigin = !native && /^https?:$/.test(location.protocol);

const s = {
  tab: "main",
  mode: "signin",
  server: "",
  account: "",
  password: "",
  confirm: "",
  profile: null,
  devices: [],
  limit: 5,
  status: "off",
  since: 0,
  rx: 0,
  down: 0,
  error: "",
  busy: false,
  sheet: null,
  reveal: false,
  created: "",
  signedIn: false,
};

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const group = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const raw = () => s.account.replace(/\s/g, "");
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (t) => new Date(t * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function clock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return t >= 3600 ? `${Math.floor(t / 3600)}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}` : `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

function bytes(n) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 2 : 1)} ${u[i]}`;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function titlebar() {
  if (!native) return "";
  return `<div class="win"><span class="drag" data-tauri-drag-region></span><button class="wbtn" data-win="min">${icons.min}</button><button class="wbtn x" data-win="close">${icons.close}</button></div>`;
}

function tabs() {
  const t = (id, label) => `<button class="tab ${s.tab === id ? "on" : ""}" data-tab="${id}">${icons[id]}<span>${label}</span></button>`;
  return `<nav class="tabs">${t("main", "Main")}${t("devices", "Devices")}${t("settings", "Settings")}</nav>`;
}

function mainView() {
  const on = s.status === "on";
  const connecting = s.status === "connecting";
  const title = on ? "Protected" : connecting ? "Connecting" : "Unprotected";
  const chip = on ? esc(api.serverHost()) : connecting ? "Securing" : "IP exposed";
  const pill = connecting
    ? `<button class="pill busy" disabled>CONNECTING…</button>`
    : on
    ? `<button class="pill off" data-act="toggle">DISABLE</button>`
    : `<button class="pill" data-act="toggle">${native ? "CONNECT" : "ADD THIS DEVICE"}</button>`;
  return `
    <section class="view main ${on ? "is-on" : ""}">
      <div class="status">
        <h1 id="title">${title}</h1>
        <span class="chip ${on ? "ok" : connecting ? "wait" : "bad"}">${chip}</span>
      </div>
      <div class="wavehost" id="wavehost"></div>
      <div class="clock" id="clock">${on ? clock(Date.now() - s.since) : "00:00"}</div>
      <div class="stats">
        <div><span class="k">Received</span><span class="v"><i class="dot">${icons.down}</i><b id="rx">${bytes(s.rx)}</b></span></div>
        <div><span class="k">Speed</span><span class="v"><i class="dot">${icons.bolt}</i><b id="speed">${bytes(s.down)}/s</b></span></div>
      </div>
      ${pill}
      <p class="hint">${on ? "Your internet is private." : native ? "Your traffic is not encrypted." : "Create an OpenVPN profile for any device."}</p>
      <p class="error" role="alert">${esc(s.error)}</p>
      <button class="server" data-tab="settings">
        <span class="flag">${esc((api.serverHost() || "?")[0].toUpperCase())}</span>
        <span class="meta"><b>${esc(api.serverHost())}</b><small>Advanced settings</small></span>
        ${icons.chevron}
      </button>
    </section>`;
}

function devicesView() {
  const own = s.profile?.deviceId;
  const rows = s.devices
    .map(
      (d) => `
      <li class="row">
        <div class="grow">
          <div class="t">${esc(d.name)}${d.id === own ? "<em>This device</em>" : ""}</div>
          <div class="muted sub"><span class="live ${d.online ? "on" : ""}"></span>${d.online ? "Online now" : "Offline"} · Added ${fmtDate(d.created)}</div>
        </div>
        <button class="ghost danger" data-revoke="${esc(d.id)}">Remove</button>
      </li>`
    )
    .join("");
  return `
    <section class="view">
      <h2>Devices</h2>
      <p class="muted">${s.devices.length} of ${s.limit} in use. Every device has its own key and can be removed at any time.</p>
      <button class="pill small" data-act="addsheet" ${s.devices.length >= s.limit ? "disabled" : ""}>ADD DEVICE</button>
      <p class="error" role="alert">${esc(s.error)}</p>
      <ul class="list">${rows || '<li class="empty">No devices yet</li>'}</ul>
    </section>`;
}

function settingsView() {
  const masked = s.reveal ? group(s.account) : `•••• •••• •••• ${raw().slice(-4)}`;
  return `
    <section class="view">
      <h2>Settings</h2>
      <ul class="list">
        <li class="row"><div><div class="t">Server</div><div class="muted mono">${esc(api.serverHost())}</div></div></li>
        <li class="row"><div><div class="t">Account number</div><div class="muted mono">${masked}</div></div><button class="ghost" data-act="reveal">${s.reveal ? "Hide" : "Show"}</button></li>
        <li class="row"><div><div class="t">Password</div><div class="muted">Used to manage your devices</div></div><button class="ghost" data-act="pwsheet">Change</button></li>
        ${native ? `<li class="row"><div><div class="t">Kill switch</div><div class="muted">Blocks traffic outside the tunnel while connected</div></div><span class="badge">On</span></li>` : ""}
        <li class="row"><div><div class="t">Logging</div><div class="muted">Nothing is logged on the server or in this app</div></div><span class="badge">None</span></li>
      </ul>
      <div class="about">
        <b>Why OpenVPN</b>
        <p>Two decades of scrutiny, open source, and it connects on almost any network, including over TCP when UDP is blocked. Per-device certificates mean you can see and remove every device that can connect.</p>
      </div>
      <button class="secondary wide" data-act="signout">${native ? "Remove this device and sign out" : "Sign out"}</button>
    </section>`;
}

function sheetView() {
  const k = s.sheet;
  if (!k) return "";
  let inner = "";
  if (k.kind === "name") {
    inner = `
      <h2>Add a device</h2>
      <p class="muted">Give it a name you will recognise.</p>
      <input id="devname" maxlength="32" placeholder="Pixel 8" spellcheck="false" autocomplete="off" value="${esc(k.value || "")}" />
      <p class="error" role="alert">${esc(s.error)}</p>
      <button class="pill small" data-act="createdevice" ${s.busy ? "disabled" : ""}>${s.busy ? "CREATING KEYS…" : "CREATE"}</button>
      <button class="ghost wide" data-act="closesheet">Cancel</button>`;
  } else if (k.kind === "config") {
    inner = `
      <h2>Device profile</h2>
      <p class="muted">Import this file into the OpenVPN app on that device. The private key is included and is shown only now.</p>
      <div class="actions"><button class="pill small" data-act="download">DOWNLOAD</button><button class="secondary" data-act="copy" id="copybtn">Copy</button></div>
      <button class="ghost wide" data-act="closesheet">Done</button>`;
  } else if (k.kind === "password") {
    inner = `
      <h2>Change password</h2>
      <input id="newpw" type="password" placeholder="New password (10+ characters)" autocomplete="new-password" />
      <p class="error" role="alert">${esc(s.error)}</p>
      <button class="pill small" data-act="savepw" ${s.busy ? "disabled" : ""}>SAVE</button>
      <button class="ghost wide" data-act="closesheet">Cancel</button>`;
  }
  return `<div class="sheet" data-act="closesheet"><div class="card" data-stop>${inner}</div></div>`;
}

function setupView() {
  if (s.created) {
    return `
      <main class="screen center setup">
        ${titlebar()}
        <div class="brand">veyl</div>
        <h1>Account created</h1>
        <p class="muted">This is your account number. Write it down: there is no email and no recovery.</p>
        <div class="bignum mono">${group(s.created)}</div>
        <button class="pill" data-act="continuecreated">CONTINUE</button>
      </main>`;
  }
  const needServer = !sameOrigin;
  const creating = s.mode === "create";
  return `
    <main class="screen center setup">
      ${titlebar()}
      <div class="brand">veyl</div>
      <div class="wavehost small" id="wavehost"></div>
      <h1>Private by design</h1>
      <div class="seg"><button class="${creating ? "" : "on"}" data-mode="signin">Sign in</button><button class="${creating ? "on" : ""}" data-mode="create">Create account</button></div>
      <form class="stack" autocomplete="off">
        ${needServer ? '<input id="server" placeholder="vpn.yourdomain.com" spellcheck="false" autocapitalize="off" autocomplete="off" />' : ""}
        <input id="acct" inputmode="numeric" placeholder="${creating ? "Account number (optional)" : "0000 0000 0000 0000"}" maxlength="19" spellcheck="false" autocomplete="off" />
        <input id="pw" type="password" placeholder="${creating ? "Choose a password (10+ characters)" : "Password"}" autocomplete="${creating ? "new-password" : "current-password"}" />
        ${creating ? '<input id="pw2" type="password" placeholder="Repeat password" autocomplete="new-password" />' : ""}
        <button class="pill" type="submit" ${s.busy ? "disabled" : ""}>${s.busy ? "PLEASE WAIT…" : creating ? "CREATE ACCOUNT" : "SIGN IN"}</button>
        <p class="error" role="alert">${esc(s.error)}</p>
      </form>
    </main>`;
}

function shell() {
  const body = s.tab === "devices" ? devicesView() : s.tab === "settings" ? settingsView() : mainView();
  return `<main class="screen shell">${titlebar()}${body}${tabs()}${sheetView()}</main>`;
}

function mountWave() {
  const host = document.getElementById("wavehost");
  if (host) host.appendChild(wave.el);
  wave.set(s.status === "on");
}

function render() {
  const node = el(s.signedIn ? shell() : setupView());
  app.replaceChildren(node);
  mountWave();
  bind(node);
}

function bind(node) {
  node.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      s.tab = b.dataset.tab;
      s.error = "";
      render();
      if (s.tab === "devices") refreshDevices();
    })
  );
  node.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      s.mode = b.dataset.mode;
      s.error = "";
      render();
    })
  );
  node.querySelectorAll("[data-win]").forEach((b) => b.addEventListener("click", () => native.windowControl(b.dataset.win)));
  node.querySelectorAll("[data-act]").forEach((b) =>
    b.addEventListener("click", (e) => {
      if (b.classList.contains("sheet") && e.target.closest("[data-stop]")) return;
      actions[b.dataset.act]?.();
    })
  );
  node.querySelectorAll("[data-revoke]").forEach((b) => b.addEventListener("click", () => removeDevice(b.dataset.revoke)));
  const form = node.querySelector("form");
  if (form) {
    const acct = form.querySelector("#acct");
    const server = form.querySelector("#server");
    const pw = form.querySelector("#pw");
    const pw2 = form.querySelector("#pw2");
    acct.value = s.account;
    if (server) server.value = s.server;
    pw.value = s.password;
    if (pw2) pw2.value = s.confirm;
    acct.addEventListener("input", () => {
      s.account = group(acct.value);
      acct.value = s.account;
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      s.server = server ? server.value.trim() : "";
      s.password = pw.value;
      s.confirm = pw2 ? pw2.value : "";
      if (s.mode === "create") await createAccount();
      else await signIn();
    });
  }
}

function fail(msg) {
  s.error = msg;
  s.busy = false;
  render();
}

function checkServer() {
  if (!sameOrigin && !s.server) return "Enter your server address";
  return "";
}

async function createAccount() {
  const bad = checkServer() || (s.password.length < 10 ? "Password must be at least 10 characters" : "") || (s.password !== s.confirm ? "Passwords do not match" : "") || (raw() && raw().length !== 16 ? "Account number must be 16 digits" : "");
  if (bad) return fail(bad);
  s.busy = true;
  s.error = "";
  render();
  try {
    api.setServer(s.server);
    const number = await api.register(raw(), s.password);
    s.account = group(number);
    s.busy = false;
    if (raw().length === 16 && !s.created) s.created = number;
    render();
  } catch (err) {
    fail(err.message);
  }
}

async function signIn() {
  const bad = checkServer() || (raw().length !== 16 ? "Account number must be 16 digits" : "") || (!s.password ? "Enter your password" : "");
  if (bad) return fail(bad);
  s.busy = true;
  s.error = "";
  render();
  try {
    api.setServer(s.server);
    const r = await api.login(raw(), s.password);
    s.devices = r.devices;
    s.limit = r.limit;
    if (native) {
      const p = await api.provision(raw(), s.password, "Windows PC");
      s.profile = { server: p.server, account: p.account, deviceId: p.device_id };
      const l = await api.listDevices();
      s.devices = l.devices;
      s.limit = l.limit;
    }
    s.password = "";
    s.confirm = "";
    s.signedIn = true;
    s.busy = false;
    s.tab = "main";
    render();
  } catch (err) {
    fail(err.message);
  }
}

async function refreshDevices() {
  try {
    const l = await api.listDevices();
    s.devices = l.devices;
    s.limit = l.limit;
    if (s.tab === "devices" && !s.sheet) render();
  } catch {}
}

async function createDevice() {
  const input = document.getElementById("devname");
  const name = input.value.trim();
  if (!name) return fail("Enter a name");
  if (!native && !supportsKeys()) return fail("This browser cannot generate keys");
  s.sheet.value = name;
  s.busy = true;
  s.error = "";
  render();
  try {
    const text = await api.addDevice(name);
    s.sheet = { kind: "config", text };
    s.busy = false;
    const l = await api.listDevices();
    s.devices = l.devices;
    render();
  } catch (err) {
    fail(err.message);
  }
}

async function removeDevice(id) {
  try {
    await api.revokeDevice(id);
    if (s.profile && id === s.profile.deviceId) return signOut(false);
    await refreshDevices();
    s.error = "";
    render();
  } catch (err) {
    fail(err.message);
  }
}

async function signOut(revokeOwn = true) {
  if (native) await native.signOut(revokeOwn).catch(() => {});
  api.clearCreds();
  Object.assign(s, { profile: null, account: "", password: "", confirm: "", devices: [], status: "off", error: "", tab: "main", sheet: null, reveal: false, signedIn: false, mode: "signin", created: "" });
  render();
}

async function toggle() {
  if (!native) {
    s.sheet = { kind: "name", value: "Browser device" };
    return render();
  }
  s.error = "";
  if (s.status === "on") {
    s.status = "connecting";
    render();
    await native.disconnect();
    s.status = "off";
    s.rx = s.down = 0;
    return render();
  }
  s.status = "connecting";
  render();
  const r = await native.connect();
  if (r.ok) {
    s.status = "on";
    s.since = Date.now();
  } else {
    s.status = "off";
    s.error = r.error || "Could not connect";
  }
  render();
}

async function savePassword() {
  const v = document.getElementById("newpw").value;
  if (v.length < 10) return fail("Password must be at least 10 characters");
  s.busy = true;
  s.error = "";
  render();
  try {
    await api.changePassword(v);
    s.sheet = null;
    s.busy = false;
    render();
  } catch (err) {
    fail(err.message);
  }
}

const actions = {
  toggle,
  reveal() {
    s.reveal = !s.reveal;
    render();
  },
  signout: () => signOut(true),
  addsheet() {
    s.sheet = { kind: "name", value: "" };
    s.error = "";
    render();
  },
  pwsheet() {
    s.sheet = { kind: "password" };
    s.error = "";
    render();
  },
  createdevice: createDevice,
  savepw: savePassword,
  closesheet() {
    s.sheet = null;
    s.error = "";
    s.busy = false;
    render();
  },
  continuecreated() {
    s.created = "";
    s.mode = "signin";
    render();
  },
  download() {
    const url = URL.createObjectURL(new Blob([s.sheet.text], { type: "application/x-openvpn-profile" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "veyl.ovpn";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async copy() {
    await navigator.clipboard.writeText(s.sheet.text);
    const b = document.getElementById("copybtn");
    if (b) b.textContent = "Copied";
  },
};

function tick() {
  const set = (id, v) => {
    const n = document.getElementById(id);
    if (n && n.textContent !== v) n.textContent = v;
  };
  if (s.status === "on") {
    set("clock", clock(Date.now() - s.since));
    set("rx", bytes(s.rx));
    set("speed", `${bytes(s.down)}/s`);
  }
}

async function poll() {
  if (!native || !s.signedIn || s.status === "connecting") return;
  try {
    const r = await native.status();
    if (r.state === "connected") {
      s.down = Math.max(0, r.rx - s.rx);
      s.rx = r.rx;
      if (s.status !== "on") {
        s.status = "on";
        s.since = Date.now();
        render();
      }
    } else if (s.status === "on") {
      s.status = "off";
      s.down = 0;
      render();
    }
  } catch {}
}

async function boot() {
  if (native) {
    const p = await native.getProfile().catch(() => null);
    if (p) {
      s.profile = { server: p.server, account: p.account, deviceId: p.device_id };
      s.server = p.server;
      s.account = group(p.account);
      s.signedIn = true;
      api.setServer(p.server);
      refreshDevices();
    }
  }
  render();
  setInterval(tick, 500);
  setInterval(poll, 1000);
  setInterval(() => {
    if (s.signedIn && s.tab === "devices") refreshDevices();
  }, 10000);
}

boot();
