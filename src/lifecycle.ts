import { watch } from "vue"
import { Backend, Prepare } from "./backend"
import { Host } from "./lib/format"
import { StartMiniLink } from "./mini/publish"
import { Connect, connection, Toggle, WakeConnection } from "./stores/connection"
import { StartPartnerWatch } from "./stores/partner"
import { prefs } from "./stores/prefs"
import { Boot, CheckServer, session } from "./stores/session"

const RECHECK = 5 * 60 * 1000

function TrayText(): [string, string, boolean] {
    if (session.status !== "signedin") {
        return ["Signed out", "Connect", false]
    }
    const name = session.info?.name ?? Host(session.profile?.server ?? "")
    switch (connection.phase) {
        case "connecting":
            return [`Connecting to ${name}`, "Cancel", true]
        case "connected":
            return [`Connected to ${name}`, "Disconnect", true]
        case "reconnecting":
            return ["Reconnecting", "Disconnect", true]
        case "disconnecting":
            return ["Disconnecting", "Disconnect", false]
        case "error":
            return ["Couldn't connect", "Connect", true]
        default:
            return ["Not connected", "Connect", true]
    }
}

function Visible(): boolean {
    return document.visibilityState === "visible"
}

export async function Start(): Promise<void> {
    await Prepare()
    const bridge = Backend()
    watch(
        () => prefs.motion,
        (motion) => {
            document.documentElement.dataset.motion = motion ? "full" : "reduced"
        },
        { immediate: true },
    )
    watch(
        () => prefs.tray,
        (enabled) => bridge.KeepInTray(enabled),
        { immediate: true },
    )
    watch(
        TrayText,
        ([status, action, enabled]) => bridge.Tray(status, action, enabled),
        { immediate: true },
    )
    StartPartnerWatch()
    await StartMiniLink()
    if (bridge.mode === "native") {
        navigator.locks?.request("veylvpn-awake", () => new Promise(() => {})).catch(() => {})
    }
    await bridge.OnTray(() => {
        if (session.status === "signedin") {
            void Toggle()
        }
    })
    document.addEventListener("visibilitychange", () => {
        WakeConnection()
        if (Visible() && session.status === "signedin" && (!session.checked || Date.now() - session.checked > RECHECK)) {
            void CheckServer()
        }
    })
    setInterval(() => {
        if (Visible() && session.status === "signedin") {
            void CheckServer()
        }
    }, RECHECK)
}

export async function Launch(): Promise<void> {
    await Boot()
    const requested = import.meta.env.DEV && new URLSearchParams(location.search).has("connect")
    if (session.status === "signedin" && Backend().tunnel && (prefs.autoconnect || requested)) {
        void Connect()
    }
}
