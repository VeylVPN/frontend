import { ToBridgeError } from "../backend/bridge"
import type { ErrorKind, VpnError } from "../domain"

type Entry = { kind: ErrorKind; title: string; message: string; retry: boolean }

const LEGACY: [RegExp, string][] = [
    [/^invalid credentials$/i, "INVALID_CREDENTIALS"],
    [/^too many (attempts|requests)/i, "TOO_MANY_REQUESTS"],
    [/^account already claimed$/i, "ACCOUNT_ALREADY_CLAIMED"],
    [/^device limit reached$/i, "MAX_DEVICES_REACHED"],
    [/^unknown device$/i, "DEVICE_NOT_FOUND"],
    [/^password must be at least/i, "WEAK_PASSWORD"],
    [/^invalid device name$/i, "INVALID_DEVICE_NAME"],
    [/^invalid csr$/i, "INVALID_CSR"],
    [/^account disabled$/i, "ACCOUNT_DISABLED"],
    [/^account expired$/i, "ACCOUNT_EXPIRED"],
    [/^invalid invite$/i, "INVALID_INVITE"],
    [/^(registration is closed|account required)$/i, "REGISTRATION_CLOSED"],
    [/^account or invite required$/i, "INVITE_REQUIRED"],
    [/^server is not configured yet$/i, "NOT_CONFIGURED"],
    [/^server error$/i, "INTERNAL_ERROR"],
    [/^cannot reach that server$/i, "UNREACHABLE"],
    [/^invalid server response$/i, "INVALID_RESPONSE"],
    [/^invalid profile from server$/i, "INVALID_RESPONSE"],
    [/^not signed in$/i, "NOT_SIGNED_IN"],
    [/^could not (generate key|encrypt profile|decrypt profile)/i, "LOCAL_STORAGE"],
    [/^connecting is only supported on windows$/i, "UNSUPPORTED"],
    [/^could not download openvpn$/i, "OPENVPN_DOWNLOAD"],
    [/^openvpn (download failed verification|installer signature check failed)$/i, "OPENVPN_VERIFY"],
    [/^openvpn installation failed/i, "OPENVPN_INSTALL"],
    [/^could not enable the kill switch/i, "KILL_SWITCH"],
    [/^could not start openvpn/i, "OPENVPN_START"],
    [/^could not connect/i, "TUNNEL_FAILED"],
]

const ENTRIES: Record<string, Entry> = {
    UNREACHABLE: {
        kind: "SERVICE_UNAVAILABLE",
        title: "Server unreachable",
        message: "VeylVPN couldn't reach your server. Check the address, and that the server is online and finished setup.",
        retry: true,
    },
    NOT_CONFIGURED: {
        kind: "SERVICE_UNAVAILABLE",
        title: "Server setup isn't finished",
        message: "Your server is running but has no public address yet. Finish the setup page on the server, then try again.",
        retry: true,
    },
    INTERNAL_ERROR: {
        kind: "SERVICE_UNAVAILABLE",
        title: "Server error",
        message: "Your server ran into a problem handling the request. Try again in a moment.",
        retry: true,
    },
    INVALID_RESPONSE: {
        kind: "SERVICE_UNAVAILABLE",
        title: "Unexpected response",
        message: "That address answered, but not like a VeylVPN server. Check that it points to your server.",
        retry: true,
    },
    INVALID_SERVER: {
        kind: "CONFIGURATION_ERROR",
        title: "Check the address",
        message: "Enter just the server address, for example vpn.example.com.",
        retry: false,
    },
    INVALID_CREDENTIALS: {
        kind: "AUTHENTICATION_ERROR",
        title: "Wrong account number or password",
        message: "Check both and try again. After five wrong attempts the account pauses sign-in for a minute.",
        retry: false,
    },
    INVALID_ACCESS_TOKEN: {
        kind: "AUTHENTICATION_ERROR",
        title: "Signed out by the server",
        message: "Your password may have changed on another device. Sign in again.",
        retry: false,
    },
    NOT_SIGNED_IN: {
        kind: "AUTHENTICATION_ERROR",
        title: "Not signed in",
        message: "Sign in to your server to continue.",
        retry: false,
    },
    TOO_MANY_REQUESTS: {
        kind: "RATE_LIMITED",
        title: "Too many attempts",
        message: "Your server is slowing down sign-in attempts. Wait a minute and try again.",
        retry: true,
    },
    ACCOUNT_DISABLED: {
        kind: "ACCOUNT_ERROR",
        title: "Account paused",
        message: "Your server's admin has paused this account. Ask them to enable it again.",
        retry: false,
    },
    ACCOUNT_EXPIRED: {
        kind: "ACCOUNT_ERROR",
        title: "Account expired",
        message: "This account is past its expiry date. Ask your server's admin to extend it.",
        retry: false,
    },
    ACCOUNT_ALREADY_CLAIMED: {
        kind: "ACCOUNT_ERROR",
        title: "Account already set up",
        message: "That account number already has a password. Sign in with it instead.",
        retry: false,
    },
    INVALID_INVITE: {
        kind: "ACCOUNT_ERROR",
        title: "Invite not valid",
        message: "That invite code is unknown, used up or expired. Ask for a new one.",
        retry: false,
    },
    REGISTRATION_CLOSED: {
        kind: "ACCOUNT_ERROR",
        title: "Sign-up is closed",
        message: "This server only accepts account numbers made by its admin.",
        retry: false,
    },
    INVITE_REQUIRED: {
        kind: "ACCOUNT_ERROR",
        title: "Invite needed",
        message: "This server needs an invite code or an account number from its admin.",
        retry: false,
    },
    MAX_DEVICES_REACHED: {
        kind: "LIMIT_ERROR",
        title: "Device limit reached",
        message: "Remove a device from your account to add another.",
        retry: false,
    },
    DEVICE_NOT_FOUND: {
        kind: "CONFIGURATION_ERROR",
        title: "Device not found",
        message: "That device is no longer on your account.",
        retry: false,
    },
    WEAK_PASSWORD: {
        kind: "CONFIGURATION_ERROR",
        title: "Password too short",
        message: "Passwords are 10 to 256 characters.",
        retry: false,
    },
    INVALID_DEVICE_NAME: {
        kind: "CONFIGURATION_ERROR",
        title: "Check the device name",
        message: "Names are 1 to 32 printable characters.",
        retry: false,
    },
    INVALID_CSR: {
        kind: "CONFIGURATION_ERROR",
        title: "Key request rejected",
        message: "The server didn't accept this device's key request. Try again.",
        retry: true,
    },
    INVALID_DNS_CATEGORY: {
        kind: "CONFIGURATION_ERROR",
        title: "Unknown blocking category",
        message: "Your server doesn't offer that category.",
        retry: false,
    },
    NO_WEBCRYPTO: {
        kind: "CONFIGURATION_ERROR",
        title: "Can't create keys here",
        message: "Browsers only generate keys on HTTPS pages. Open your server over HTTPS, or add the device from the Windows app.",
        retry: false,
    },
    LOCAL_STORAGE: {
        kind: "PERMISSION_ERROR",
        title: "Couldn't use this computer's key store",
        message: "VeylVPN couldn't create or unlock its local keys. Try again, or sign out and back in.",
        retry: true,
    },
    UNSUPPORTED: {
        kind: "TUNNEL_ERROR",
        title: "Not supported here",
        message: "Connecting needs the VeylVPN app for Windows.",
        retry: false,
    },
    OPENVPN_DOWNLOAD: {
        kind: "NETWORK_ERROR",
        title: "Couldn't download OpenVPN",
        message: "The first connection installs the official OpenVPN client. Check your internet connection and try again.",
        retry: true,
    },
    OPENVPN_VERIFY: {
        kind: "TUNNEL_ERROR",
        title: "OpenVPN download failed verification",
        message: "The downloaded installer didn't match its pinned checksum or signature, so VeylVPN refused to install it.",
        retry: true,
    },
    OPENVPN_INSTALL: {
        kind: "PERMISSION_ERROR",
        title: "Couldn't install OpenVPN",
        message: "Installing the OpenVPN client needs administrator rights. Make sure VeylVPN runs as administrator.",
        retry: true,
    },
    KILL_SWITCH: {
        kind: "PERMISSION_ERROR",
        title: "Couldn't turn on the kill switch",
        message: "VeylVPN won't connect without the kill switch. It needs administrator rights to change Windows Firewall.",
        retry: true,
    },
    OPENVPN_START: {
        kind: "PERMISSION_ERROR",
        title: "Couldn't start OpenVPN",
        message: "The OpenVPN client didn't start. Make sure VeylVPN runs as administrator.",
        retry: true,
    },
    TUNNEL_FAILED: {
        kind: "TUNNEL_ERROR",
        title: "Tunnel didn't come up",
        message: "OpenVPN stopped before the tunnel was ready. Check that your server is online and that this device is still on your account.",
        retry: true,
    },
}

const FALLBACK: Entry = {
    kind: "UNKNOWN_ERROR",
    title: "Something went wrong",
    message: "VeylVPN couldn't finish that. Try again, and open technical details if it keeps happening.",
    retry: true,
}

export function CodeFor(code: string, message: string): string {
    if (code) {
        return code
    }
    const text = message.trim()
    return LEGACY.find(([pattern]) => pattern.test(text))?.[1] ?? ""
}

export function Describe(value: unknown): VpnError {
    const error = ToBridgeError(value)
    const code = CodeFor(error.code, error.message)
    const entry = ENTRIES[code] ?? FALLBACK
    const detail = [code || null, error.status ? `HTTP ${error.status}` : null, error.message].filter(Boolean).join(" · ")
    return { kind: entry.kind, code, title: entry.title, message: entry.message, detail, retry: entry.retry }
}

export function Is(error: VpnError | null, ...codes: string[]): boolean {
    return Boolean(error && codes.includes(error.code))
}
