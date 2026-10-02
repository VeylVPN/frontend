import qrcode from "qrcode-generator";
import { generateKeypair, supportsX25519 } from "./keys.js";
import { enroll, devices, revoke, buildConfig } from "./api.js";
import "./style.css";

const app = document.getElementById("app");
const state = { account: "", devices: [], config: null, busy: false, error: "", view: "login" };

const fmtAccount = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const rawAccount = () => state.account.replace(/\s/g, "");

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

function orb(active) {
  return `<div class="orb ${active ? "on" : ""}"><span class="ring r1"></span><span class="ring r2"></span><span class="core"></span></div>`;
}

function renderLogin() {
  state.view = "login";
  const node = el(`
    <main class="screen center">
      <div class="brand">veyl</div>
      ${orb(false)}
      <h1>Private by design</h1>
      <p class="muted">No email. No logs. Enter your account number.</p>
      <form class="stack" autocomplete="off">
        <input id="acct" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19" spellcheck="false" autocomplete="off" />
        <button class="primary" type="submit">Continue</button>
        <p class="error" role="alert">${state.error}</p>
      </form>
    </main>`);
  const input = node.querySelector("#acct");
  input.value = state.account;
  input.addEventListener("input", () => {
    state.account = fmtAccount(input.value);
    input.value = state.account;
  });
  node.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (rawAccount().length !== 16) return fail("Account number must be 16 digits");
    await load();
  });
  mount(node);
}

function renderHome() {
  state.view = "home";
  const protectedNow = state.devices.length > 0;
  const rows = state.devices
    .map(
      (d, i) => `
      <li class="row">
        <div><div class="t">Device ${i + 1}</div><div class="muted mono">${d.address4}</div></div>
        <button class="ghost danger" data-key="${d.public_key}">Remove</button>
      </li>`
    )
    .join("");
  const node = el(`
    <main class="screen">
      <header class="top"><div class="brand">veyl</div><button class="ghost" id="out">Sign out</button></header>
      <section class="hero">
        ${orb(protectedNow)}
        <h1>${protectedNow ? "Protected" : "Not set up"}</h1>
        <p class="muted">${state.devices.length} of 5 devices</p>
      </section>
      <button class="primary wide" id="add" ${state.busy || state.devices.length >= 5 ? "disabled" : ""}>
        ${state.busy ? "Generating keys…" : "Add this device"}
      </button>
      <p class="error" role="alert">${state.error}</p>
      <ul class="list">${rows}</ul>
    </main>`);
  node.querySelector("#out").addEventListener("click", signOut);
  node.querySelector("#add").addEventListener("click", addDevice);
  node.querySelectorAll("[data-key]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await revoke(rawAccount(), b.dataset.key);
        await load();
      } catch (err) {
        fail(err.message);
      }
    })
  );
  mount(node);
}

function renderConfig() {
  const { text, name } = state.config;
  const node = el(`
    <main class="screen">
      <header class="top"><button class="ghost" id="back">Back</button><div class="brand">veyl</div><span></span></header>
      <h1 class="left">Your configuration</h1>
      <p class="muted">Scan with the WireGuard app, or download the file. Your private key exists only here and will not be shown again.</p>
      <div class="qr">${qrSvg(text)}</div>
      <div class="actions">
        <button class="primary" id="dl">Download</button>
        <button class="secondary" id="copy">Copy</button>
      </div>
    </main>`);
  node.querySelector("#back").addEventListener("click", () => {
    state.config = null;
    renderHome();
  });
  node.querySelector("#dl").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  node.querySelector("#copy").addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(text);
    e.target.textContent = "Copied";
  });
  mount(node);
}

function mount(node) {
  app.replaceChildren(node);
}

function fail(msg) {
  state.error = msg;
  state.view === "home" ? renderHome() : renderLogin();
}

async function load() {
  try {
    state.error = "";
    state.devices = await devices(rawAccount());
    renderHome();
  } catch (err) {
    state.error = err.message;
    renderLogin();
  }
}

async function addDevice() {
  if (!supportsX25519()) return fail("This browser cannot generate WireGuard keys");
  state.busy = true;
  state.error = "";
  renderHome();
  try {
    const kp = await generateKeypair();
    const res = await enroll(rawAccount(), kp.publicKey);
    state.config = { text: buildConfig(kp.privateKey, res), name: "veyl.conf" };
    state.devices = await devices(rawAccount());
    state.busy = false;
    renderConfig();
  } catch (err) {
    state.busy = false;
    state.error = err.message;
    renderHome();
  }
}

function signOut() {
  state.account = "";
  state.devices = [];
  state.config = null;
  state.error = "";
  renderLogin();
}

renderLogin();
