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
      provision: (server, account) => invoke("provision", { server, account }),
      newDeviceConfig: () => invoke("new_device_config"),
      connect: () => wrap("connect"),
      disconnect: () => wrap("disconnect"),
      status: () => invoke("status"),
      signOut: (revoke) => invoke("sign_out", { revoke }),
      apiPost: (server, path, body) => invoke("api_post", { server, path, body }),
      windowControl: (action) => invoke("window_control", { action }),
    }
  : null;
