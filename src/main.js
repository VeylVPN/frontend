import qrcode from "qrcode-generator";
import { generateKeypair, supportsX25519 } from "./keys.js";
import * as api from "./api.js";
import { createWave } from "./wave.js";
import { icons } from "./icons.js";
import "./style.css";

const native = window.veyl || null;
const app = document.getElementById("app");
const wave = createWave();

const s = {
  tab: "main",
  server: "",
  account: "",
  profile: null,
  devices: [],
  status: "off",
  since: 0,
  rx: 0,
  tx: 0,
  down: 0,
  up: 0,
  error: "",
  busy: false,
  sheet: null,
  reveal: false,
};

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const group = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const raw = () => s.account.replace(/\s/g, "");
const pad = (n) => String(n).padStart(2, "0");

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

function qrSvg(text) {
  const qr = qrcode(0, "L");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

function titlebar() {
  if (!native) return "";
  return `<div class="win"><span class="drag"></span><button class="wbtn" data-win="min">${icons.min}</button><button class="wbtn x" data-win="close">${icons.close}</button></div>`;
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
      <p class="hint">${on ? "Your internet is private." : native ? "Your traffic is not encrypted." : "Browser mode creates a config for the WireGuard app."}</p>
      <p class="error" role="alert">${esc(s.error)}</p>
      <button class="server" data-tab="settings">
        <span class="flag">${esc((api.serverHost() || "?")[0].toUpperCase())}</span>
        <span class="meta"><b>${esc(api.serverHost())}</b><small>Advanced settings</small></span>
        ${icons.chevron}
      </button>
    </section>`;
}

function devicesView() {
  const own = s.profile?.publicKey;
  const rows = s.devices
    .map(
      (d, i) => `
      <li class="row">
        <div><div class="t">Device ${i + 1}${d.public_key === own ? '<em>This device</em>' : ""}</div><div class="muted mono">${esc(d.address4)}</div></div>
        <button class="ghost danger" data-revoke="${esc(d.public_key)}">Remove</button>
      </li>`
    )
    .join("");
  return `
    <section class="view">
      <h2>Devices</h2>
      <p class="muted">${s.devices.length} of 5 in use. Add a phone or another computer with a QR code.</p>
      <button class="pill small" data-act="add" ${s.busy || s.devices.length >= 5 ? "disabled" : ""}>${s.busy ? "GENERATING KEYS…" : "ADD DEVICE"}</button>
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
        <li class="row"><div><div class="t">Account number</div><div class="muted mono" id="acct">${masked}</div></div><button class="ghost" data-act="reveal">${s.reveal ? "Hide" : "Show"}</button></li>
        <li class="row"><div><div class="t">Kill switch</div><div class="muted">Blocks all traffic outside the tunnel while connected</div></div><span class="badge">On</span></li>
        <li class="row"><div><div class="t">Logging</div><div class="muted">Nothing is logged on the server or in this app</div></div><span class="badge">None</span></li>
      </ul>
      <div class="about">
        <b>Why WireGuard</b>
        <p>Around 4,000 lines of audited code, modern cryptography (ChaCha20-Poly1305, Curve25519), built into the Linux kernel and fast on cheap hardware. Small enough to trust, with no legacy protocol baggage.</p>
      </div>
      <button class="secondary wide" data-act="signout">${native ? "Remove this device and sign out" : "Sign out"}</button>
    </section>`;
}

function sheetView() {
  if (!s.sheet) return "";
  return `
    <div class="sheet" data-act="closesheet">
      <div class="card" data-stop>
        <h2>Device configuration</h2>
        <p class="muted">Scan with the WireGuard app or download the file. The private key is shown only now.</p>
        <div class="qr">${qrSvg(s.sheet.text)}</div>
        <div class="actions"><button class="pill small" data-act="download">DOWNLOAD</button><button class="secondary" data-act="copy">Copy</button></div>
        <button class="ghost wide" data-act="closesheet">Done</button>
      </div>
    </div>`;
}

function setupView() {
  const needServer = Boolean(native) || !/^https?:$/.test(location.protocol);
  return `
    <main class="screen center setup">
      ${titlebar()}
      <div class="brand">veyl</div>
      <div class="wavehost small" id="wavehost"></div>
      <h1>Private by design</h1>
      <p class="muted">No email. No logs. Your server, your rules.</p>
      <form class="stack" autocomplete="off">
        ${needServer ? '<input id="server" placeholder="vpn.yourdomain.com" spellcheck="false" autocapitalize="off" autocomplete="off" />' : ""}
        <input id="acct" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19" spellcheck="false" autocomplete="off" />
        <button class="pill" type="submit">${s.busy ? "CHECKING…" : "CONTINUE"}</button>
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
  const node = el(s.profile || s.account ? shell() : setupView());
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
    acct.value = s.account;
    if (server) server.value = s.server;
    acct.addEventListener("input", () => {
      s.account = group(acct.value);
      acct.value = s.account;
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      s.server = server ? server.value.trim() : "";
      await signIn();
    });
  }
}

function fail(msg) {
  s.error = msg;
  s.busy = false;
  render();
}

async function signIn() {
  if (raw().length !== 16) return fail("Account number must be 16 digits");
  if ((native || !/^https?:$/.test(location.protocol)) && !s.server) return fail("Enter your server address");
  s.busy = true;
  s.error = "";
  render();
  try {
    api.setServer(s.server);
    s.devices = await api.devices(raw());
    if (native) await provision();
    s.busy = false;
    s.tab = "main";
    render();
  } catch (err) {
    fail(err.message === "Failed to fetch" ? "Cannot reach that server" : err.message);
  }
}

async function provision() {
  if (!supportsX25519()) throw new Error("Cannot generate keys on this system");
  const kp = await generateKeypair();
  const res = await api.enroll(raw(), kp.publicKey);
  const conf = api.buildConfig(kp.privateKey, res);
  s.profile = { server: s.server, account: raw(), publicKey: kp.publicKey, conf };
  await native.saveProfile(s.profile);
  s.devices = await api.devices(raw());
}

async function addDevice() {
  if (!supportsX25519()) return fail("This browser cannot generate WireGuard keys");
  s.busy = true;
  s.error = "";
  render();
  try {
    const kp = await generateKeypair();
    const res = await api.enroll(raw(), kp.publicKey);
    s.sheet = { text: api.buildConfig(kp.privateKey, res) };
    s.devices = await api.devices(raw());
    s.busy = false;
    render();
  } catch (err) {
    fail(err.message);
  }
}

async function removeDevice(key) {
  try {
    await api.revoke(raw(), key);
    if (s.profile && key === s.profile.publicKey) return signOut(false);
    s.devices = await api.devices(raw());
    render();
  } catch (err) {
    fail(err.message);
  }
}

async function signOut(revokeOwn = true) {
  if (native) {
    await native.disconnect();
    if (revokeOwn && s.profile) await api.revoke(raw(), s.profile.publicKey).catch(() => {});
    await native.clearProfile();
  }
  Object.assign(s, { profile: null, account: "", devices: [], status: "off", error: "", tab: "main", sheet: null, reveal: false });
  render();
}

async function toggle() {
  if (!native) return addDevice();
  s.error = "";
  if (s.status === "on") {
    s.status = "connecting";
    render();
    await native.disconnect();
    s.status = "off";
    s.rx = s.tx = s.down = s.up = 0;
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

const actions = {
  toggle,
  add: addDevice,
  reveal() {
    s.reveal = !s.reveal;
    render();
  },
  signout: () => signOut(true),
  closesheet() {
    s.sheet = null;
    render();
  },
  download() {
    const url = URL.createObjectURL(new Blob([s.sheet.text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "veyl.conf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async copy() {
    await navigator.clipboard.writeText(s.sheet.text);
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
  if (!native || s.status === "connecting" || !s.profile) return;
  try {
    const r = await native.status();
    if (r.up) {
      s.down = Math.max(0, r.rx - s.rx);
      s.up = Math.max(0, r.tx - s.tx);
      s.rx = r.rx;
      s.tx = r.tx;
      if (s.status !== "on") {
        s.status = "on";
        s.since = Date.now();
        render();
      }
    } else if (s.status === "on") {
      s.status = "off";
      s.down = s.up = 0;
      render();
    }
  } catch {}
}

async function boot() {
  if (native) {
    const p = await native.getProfile();
    if (p) {
      s.profile = p;
      s.server = p.server;
      s.account = group(p.account);
      api.setServer(p.server);
      api.devices(p.account).then((d) => {
        s.devices = d;
        if (s.tab === "devices") render();
      }).catch(() => {});
    }
  }
  render();
  setInterval(tick, 500);
  setInterval(poll, 1000);
}

boot();
