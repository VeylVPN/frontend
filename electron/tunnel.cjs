const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const NAME = "veyl";
const MSI_VERSION = "1.1.1";
const MSI_URL = `https://download.wireguard.com/windows-client/wireguard-amd64-${MSI_VERSION}.msi`;

const programFiles = () => process.env.ProgramFiles || "C:\\Program Files";
const wgDir = () => path.join(programFiles(), "WireGuard");
const wireguardExe = () => path.join(wgDir(), "wireguard.exe");
const wgExe = () => path.join(wgDir(), "wg.exe");

function run(file, args, timeout = 30000) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout }, (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout || ""), stderr: String(stderr || "") }));
  });
}

async function ensureInstalled(resourcesDir) {
  if (fs.existsSync(wireguardExe())) return { ok: true };
  const msi = path.join(os.tmpdir(), `wireguard-${MSI_VERSION}.msi`);
  const res = await fetch(MSI_URL);
  if (!res.ok) return { ok: false, error: "Could not download WireGuard" };
  fs.writeFileSync(msi, Buffer.from(await res.arrayBuffer()));
  const sig = await run("powershell.exe", ["-NoProfile", "-Command", `(Get-AuthenticodeSignature '${msi}').Status`]);
  if (sig.stdout.trim() !== "Valid") {
    fs.rmSync(msi, { force: true });
    return { ok: false, error: "WireGuard installer signature check failed" };
  }
  const r = await run("msiexec.exe", ["/i", msi, "/qn", "/norestart"], 180000);
  fs.rmSync(msi, { force: true });
  return fs.existsSync(wireguardExe()) ? { ok: true } : { ok: false, error: "WireGuard installation failed" };
}

function confPath(dir) {
  return path.join(dir, `${NAME}.conf`);
}

async function connect(dir, conf, resourcesDir) {
  if (process.platform !== "win32") return { ok: false, error: "Windows only" };
  const inst = await ensureInstalled(resourcesDir);
  if (!inst.ok) return inst;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const p = confPath(dir);
  await run(wireguardExe(), ["/uninstalltunnelservice", NAME]);
  fs.writeFileSync(p, conf, { mode: 0o600 });
  const r = await run(wireguardExe(), ["/installtunnelservice", p], 20000);
  if (!r.ok) {
    fs.rmSync(p, { force: true });
    return { ok: false, error: "Could not start the tunnel. Run Veyl as administrator." };
  }
  for (let i = 0; i < 20; i++) {
    const s = await status();
    if (s.up) return { ok: true };
    await new Promise((res) => setTimeout(res, 500));
  }
  return { ok: true };
}

async function disconnect(dir) {
  if (process.platform !== "win32") return { ok: true };
  if (fs.existsSync(wireguardExe())) await run(wireguardExe(), ["/uninstalltunnelservice", NAME]);
  fs.rmSync(confPath(dir), { force: true });
  return { ok: true };
}

async function status() {
  if (process.platform !== "win32" || !fs.existsSync(wgExe())) return { up: false, rx: 0, tx: 0 };
  const r = await run(wgExe(), ["show", NAME, "transfer"], 5000);
  if (!r.ok) return { up: false, rx: 0, tx: 0 };
  const f = r.stdout.trim().split(/\s+/);
  const hs = await run(wgExe(), ["show", NAME, "latest-handshakes"], 5000);
  const ts = Number((hs.stdout.trim().split(/\s+/)[1]) || 0);
  const fresh = ts > 0 && Date.now() / 1000 - ts < 180;
  return { up: r.ok && (fresh || ts === 0), rx: Number(f[1]) || 0, tx: Number(f[2]) || 0 };
}

module.exports = { connect, disconnect, status };
