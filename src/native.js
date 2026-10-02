import { invoke } from "@tauri-apps/api/core";

const inTauri = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

const wrap = async (cmd, args) => {
  try {
    await invoke(cmd, args);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
};

export const native = inTauri
  ? {
      getProfile: () => invoke("get_profile"),
      register: (server, account, password) => invoke("register", { server, account, password }),
      loginCheck: (server, account, password) => invoke("login_check", { server, account, password }),
      provision: (server, account, password, name) => invoke("provision", { server, account, password, name }),
      listDevices: () => invoke("list_devices"),
      addDeviceConfig: (name) => invoke("add_device_config", { name }),
      revokeDevice: (id) => invoke("revoke_device", { id }),
      changePassword: (newPassword) => invoke("change_password", { newPassword }),
      connect: () => wrap("connect"),
      disconnect: () => wrap("disconnect"),
      status: () => invoke("status"),
      signOut: (revoke) => invoke("sign_out", { revoke }),
      windowControl: (action) => invoke("window_control", { action }),
    }
  : null;
