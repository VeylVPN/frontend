const { app, BrowserWindow, ipcMain, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const tunnel = require("./tunnel.cjs");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

const dataDir = () => app.getPath("userData");
const profileFile = () => path.join(dataDir(), "profile.bin");
const tunnelDir = () => path.join(dataDir(), "tunnel");

let win;
let profile = null;

function loadProfile() {
  try {
    const b = fs.readFileSync(profileFile());
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString("utf8");
    profile = JSON.parse(text);
  } catch {
    profile = null;
  }
  return profile;
}

function saveProfile(p) {
  profile = p;
  const text = JSON.stringify(p);
  const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, "utf8");
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(profileFile(), buf, { mode: 0o600 });
}

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 760,
    minWidth: 360,
    minHeight: 640,
    frame: false,
    backgroundColor: "#0b0b0c",
    title: "Veyl",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  const dev = process.env.VEYL_DEV_URL;
  if (dev) win.loadURL(dev);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  ipcMain.handle("profile:get", () => {
    const p = loadProfile();
    return p ? { server: p.server, account: p.account, publicKey: p.publicKey } : null;
  });
  ipcMain.handle("profile:save", (_e, p) => {
    saveProfile(p);
    return true;
  });
  ipcMain.handle("profile:clear", async () => {
    await tunnel.disconnect(tunnelDir());
    profile = null;
    fs.rmSync(profileFile(), { force: true });
    return true;
  });
  ipcMain.handle("tunnel:connect", () => {
    const p = profile || loadProfile();
    if (!p) return { ok: false, error: "Not signed in" };
    return tunnel.connect(tunnelDir(), p.conf, process.resourcesPath);
  });
  ipcMain.handle("tunnel:disconnect", () => tunnel.disconnect(tunnelDir()));
  ipcMain.handle("tunnel:status", () => tunnel.status());
  ipcMain.on("window:control", (_e, a) => {
    if (!win) return;
    if (a === "min") win.minimize();
    if (a === "close") win.close();
  });
  createWindow();
});

app.on("window-all-closed", async () => {
  await tunnel.disconnect(tunnelDir());
  app.quit();
});
