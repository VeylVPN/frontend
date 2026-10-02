import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { openUrl } from "@tauri-apps/plugin-opener"
import { type Bridge, ToBridgeError } from "./bridge"

async function Call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    try {
        return await invoke<T>(command, args)
    } catch (error) {
        throw ToBridgeError(error)
    }
}

function Quiet(command: string, args?: Record<string, unknown>) {
    invoke(command, args).catch(() => {})
}

export function CreateNativeBridge(): Bridge {
    return {
        mode: "native",
        tunnel: true,
        Profile: () => Call("get_profile"),
        Info: (server) => Call("server_info", { server }),
        Register: (server, account, password) => Call("register", { server, account, password }),
        Redeem: (server, invite, password) => Call("redeem_invite", { server, invite, password }),
        Check: (server, account, password) => Call("login_check", { server, account, password }),
        Provision: (server, account, password, name) => Call("provision", { server, account, password, name }),
        Release: (server, account, password, id) => Call("revoke_with_credentials", { server, account, password, id }),
        Account: () => Call("account_info"),
        Devices: () => Call("list_devices"),
        Enroll: (name) => Call<string>("add_device_config", { name }),
        Rename: (id, name) => Call("rename_device", { id, name }),
        Remove: (id) => Call("revoke_device", { id }),
        Password: (next) => Call("change_password", { newPassword: next }),
        Blocking: (categories) => (categories ? Call("set_dns_blocking", { categories }) : Call("reset_dns_blocking")),
        Delete: (password) => Call("delete_account", { password }),
        SignOut: (revoke) => Call("sign_out", { revoke }),
        Connect: () => Call("connect"),
        Disconnect: () => Call("disconnect"),
        Status: () => Call("status"),
        Installed: () => Call<boolean>("openvpn_present").catch(() => true),
        Window: (action) => Quiet("window_control", { action }),
        Tray: (status, action, enabled) => Quiet("tray_status", { status, action, enabled }),
        KeepInTray: (enabled) => Quiet("set_close_to_tray", { enabled }),
        OnTray: (handler) => listen("tray-toggle", () => handler()),
        Open: async (url) => {
            try {
                await openUrl(url)
            } catch (error) {
                throw ToBridgeError(error)
            }
        },
    }
}
