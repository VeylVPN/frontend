const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("veyl", {
  getProfile: () => ipcRenderer.invoke("profile:get"),
  saveProfile: (p) => ipcRenderer.invoke("profile:save", p),
  clearProfile: () => ipcRenderer.invoke("profile:clear"),
  connect: () => ipcRenderer.invoke("tunnel:connect"),
  disconnect: () => ipcRenderer.invoke("tunnel:disconnect"),
  status: () => ipcRenderer.invoke("tunnel:status"),
  windowControl: (a) => ipcRenderer.send("window:control", a),
});
