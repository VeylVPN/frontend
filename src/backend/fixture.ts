import type { Provider } from "../partners/resolver"
import { type Bridge, BridgeError } from "./bridge"

type FixtureDevice = { id: string; name: string; created: number; online: boolean }

const OWN = "9c1e0b7f4a2d6e83"

function Wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function Flags(scenario: string): Set<string> {
    return new Set(
        scenario
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
    )
}

export function FixtureProvider(scenario: string): Provider {
    const flags = Flags(scenario)
    const ip = flags.has("partner-v6") ? "2a13:9500:1d9::20" : flags.has("partner") ? "104.223.81.20" : "203.0.113.9"
    const asn = flags.has("partner") || flags.has("partner-v6") ? "206533" : "64500"
    return {
        name: "Fixture",
        async Exit() {
            await Wait(500)
            if (flags.has("lookup-fail")) {
                throw new Error("Fixture lookup failure")
            }
            return { ip, network: null }
        },
        async Network() {
            await Wait(300)
            return { asns: [Number(asn)], prefix: ip.includes(":") ? "2a13:9500:1d9::/48" : ip.startsWith("104.") ? "104.223.81.0/24" : "203.0.113.0/24" }
        },
    }
}

export function CreateFixtureBridge(scenario: string): Bridge {
    const flags = Flags(scenario)
    const web = flags.has("web")
    let signedin = !flags.has("first-run") && !flags.has("limit")
    let state: "off" | "connecting" | "connected" = "off"
    let rx = 0
    let tx = 0
    let installed = !flags.has("install")
    let blocking = ["ads", "trackers", "malware"]
    let custom = false
    let released = false
    let running = false
    const devices: FixtureDevice[] = [
        { id: OWN, name: "Windows PC", created: 1757808000, online: false },
        { id: "4a2d6e839c1e0b7f", name: "Pixel 8", created: 1758240000, online: true },
        { id: "e83a2d6c1e0b7f94", name: "Quiet Otter", created: 1759017600, online: false },
    ]
    if (flags.has("orphaned")) {
        devices.shift()
    }

    function Reachable() {
        if (flags.has("offline")) {
            throw new BridgeError("UNREACHABLE", "Cannot reach that server")
        }
    }

    function Run() {
        if (running) {
            return
        }
        running = true
        setInterval(() => {
            if (state === "connected") {
                rx += 40000 + Math.round(Math.random() * 400000)
                tx += 8000 + Math.round(Math.random() * 60000)
            }
        }, 1000)
    }

    function List(created: "unix" | "iso") {
        return {
            limit: 5,
            devices: devices.map((device) => ({
                ...device,
                online: device.id === OWN ? state === "connected" : device.online,
                created: created === "unix" ? device.created : new Date(device.created * 1000).toISOString(),
            })),
        }
    }

    return {
        mode: web ? "web" : "native",
        tunnel: !web,
        Profile: async () => (signedin ? { server: "vpn.example.com", account: "4815162342108421", device_id: web ? "" : OWN } : null),
        Info: async () => {
            await Wait(350)
            Reachable()
            return {
                endpoint: "vpn.example.com",
                port: 1194,
                proto: "udp",
                stealth: true,
                stealth_port: 443,
                platform: "linux",
                name: "Home Server",
                version: "0.2.0",
                registration: flags.has("closed") ? "closed" : "invite",
                device_limit: 5,
                dns_categories: ["ads", "trackers", "malware", "adult", "gambling", "social"],
                dns_default: ["ads", "trackers", "malware"],
                post_quantum: true,
                app_url: "https://github.com/VeylVPN/frontend/releases/latest",
            }
        },
        Register: async (_, account) => {
            await Wait(600)
            return account ?? "4815162342108421"
        },
        Redeem: async (_, invite) => {
            await Wait(600)
            if (invite.toUpperCase() === "BAD") {
                throw new BridgeError("INVALID_INVITE", "invalid invite", 403)
            }
            return "4815162342108421"
        },
        Check: async (_, account, password) => {
            await Wait(500)
            Reachable()
            if (account !== "4815162342108421" || password.length < 10) {
                throw new BridgeError("", "invalid credentials")
            }
            return List("unix")
        },
        Provision: async () => {
            await Wait(700)
            if (flags.has("limit") && !released) {
                throw new BridgeError("", "device limit reached")
            }
            signedin = true
            return { server: "vpn.example.com", account: "4815162342108421", device_id: web ? "" : OWN }
        },
        Release: async (_, __, ___, id) => {
            await Wait(400)
            released = true
            const index = devices.findIndex((device) => device.id === id)
            if (index >= 0) {
                devices.splice(index, 1)
            }
        },
        Account: async () => {
            await Wait(300)
            Reachable()
            return {
                id: "3f9a1c2b7d4e",
                created: "2026-09-14T00:00:00Z",
                expires: flags.has("expired") ? "2026-09-30T00:00:00Z" : null,
                device_limit: 5,
                devices: devices.length,
                dns_blocking: blocking,
                dns_custom: custom,
                status: flags.has("expired") ? "expired" : "active",
            }
        },
        Devices: async () => {
            await Wait(400)
            Reachable()
            return List("iso")
        },
        Enroll: async (name) => {
            await Wait(900)
            if (devices.length >= 5) {
                throw new BridgeError("MAX_DEVICES_REACHED", "device limit reached", 409)
            }
            devices.push({ id: Math.random().toString(16).slice(2, 18).padEnd(16, "0"), name, created: Math.floor(Date.now() / 86400000) * 86400, online: false })
            return "client\ndev tun\nremote vpn.example.com 1194 udp\n<key>\nfixture-key-material\n</key>\n"
        },
        Rename: async (id, name) => {
            await Wait(300)
            const device = devices.find((item) => item.id === id)
            if (!device) {
                throw new BridgeError("DEVICE_NOT_FOUND", "unknown device", 404)
            }
            device.name = name
            return { ...device, created: new Date(device.created * 1000).toISOString() }
        },
        Remove: async (id) => {
            await Wait(400)
            const index = devices.findIndex((device) => device.id === id)
            if (index >= 0) {
                devices.splice(index, 1)
            }
            if (id === OWN) {
                signedin = false
                state = "off"
            }
        },
        Password: async () => {
            await Wait(500)
        },
        Blocking: async (categories) => {
            await Wait(450)
            blocking = categories ?? ["ads", "trackers", "malware"]
            custom = categories !== null
            return { dns_blocking: blocking, dns_custom: custom }
        },
        Delete: async (password) => {
            await Wait(600)
            if (password.length < 10) {
                throw new BridgeError("INVALID_CREDENTIALS", "invalid credentials", 401)
            }
            signedin = false
            state = "off"
        },
        SignOut: async () => {
            await Wait(300)
            signedin = false
            state = "off"
        },
        Connect: async () => {
            if (!installed) {
                await Wait(4000)
                installed = true
            }
            await Wait(300)
            if (flags.has("connect-error")) {
                throw "Could not enable the kill switch. Run Veyl as administrator."
            }
            state = "connecting"
            Run()
            if (flags.has("slow")) {
                await Wait(6000)
                return
            }
            await Wait(1600)
            state = "connected"
            if (flags.has("drop")) {
                setTimeout(() => {
                    state = "off"
                }, 9000)
            }
            if (flags.has("reconnect")) {
                setTimeout(() => {
                    state = "connecting"
                    setTimeout(() => {
                        state = "connected"
                    }, 5000)
                }, 8000)
            }
        },
        Disconnect: async () => {
            await Wait(450)
            state = "off"
            rx = 0
            tx = 0
        },
        Status: async () => ({ state, rx, tx }),
        Installed: async () => installed,
        Window: () => {},
        Tray: () => {},
        KeepInTray: () => {},
        OnTray: async () => () => {},
        MiniPlayer: () => {},
        Publish: () => {},
        OnMini: async () => () => {},
        Open: async (url) => {
            window.open(url, "_blank", "noopener,noreferrer")
        },
    }
}
