import { type Bridge, BridgeError } from "./bridge"
import { FillProfile, GenerateDeviceKey, SupportsKeys } from "./csr"

type Credentials = { account: string; password: string }

type Token = { value: string; until: number }

const TOKEN_LIFETIME = 50 * 60 * 1000

function Field(data: unknown, key: string): unknown {
    return data && typeof data === "object" ? (data as Record<string, unknown>)[key] : undefined
}

function Unsupported(): never {
    throw new BridgeError("UNSUPPORTED", "Connecting needs the VeylVPN app for Windows")
}

export function CreateWebBridge(fetcher: typeof fetch = (input, init) => fetch(input, init), origin = () => location.host): Bridge {
    let creds: Credentials | null = null
    let token: Token | null = null

    async function Request(method: string, path: string, body?: unknown, bearer?: string): Promise<unknown> {
        const headers: Record<string, string> = {}
        if (body !== undefined) {
            headers["Content-Type"] = "application/json"
        }
        if (bearer) {
            headers.Authorization = `Bearer ${bearer}`
        }
        let response: Response
        try {
            response = await fetcher(path, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
                redirect: "error",
            })
        } catch {
            throw new BridgeError("UNREACHABLE", "Cannot reach that server")
        }
        if (response.status === 204) {
            return null
        }
        const data: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
            const code = Field(data, "code")
            const message = Field(data, "error")
            throw new BridgeError(
                typeof code === "string" ? code : "",
                typeof message === "string" && message ? message : "Request failed",
                response.status,
            )
        }
        if (data === undefined) {
            throw new BridgeError("INVALID_RESPONSE", "Invalid server response")
        }
        return data
    }

    async function Issue(account: string, password: string): Promise<Token> {
        const data = await Request("POST", "/v1/auth/token", { account, password })
        const value = Field(data, "access_token")
        if (typeof value !== "string" || !value.startsWith("vey_")) {
            throw new BridgeError("INVALID_RESPONSE", "Invalid server response")
        }
        token = { value, until: Date.now() + TOKEN_LIFETIME }
        return token
    }

    async function Authorized(method: string, path: string, body?: unknown): Promise<unknown> {
        if (!creds) {
            throw new BridgeError("NOT_SIGNED_IN", "Not signed in")
        }
        const current = token && Date.now() < token.until ? token : await Issue(creds.account, creds.password)
        try {
            return await Request(method, path, body, current.value)
        } catch (error) {
            if (error instanceof BridgeError && error.code === "INVALID_ACCESS_TOKEN" && creds) {
                const fresh = await Issue(creds.account, creds.password)
                return Request(method, path, body, fresh.value)
            }
            throw error
        }
    }

    async function AccountNumber(data: unknown): Promise<string> {
        const account = Field(data, "account")
        if (typeof account !== "string") {
            throw new BridgeError("INVALID_RESPONSE", "Invalid server response")
        }
        return account
    }

    return {
        mode: "web",
        tunnel: false,
        Profile: async () => (creds ? { server: origin(), account: creds.account, device_id: "" } : null),
        Info: () => Request("GET", "/v1/info"),
        Register: async (_, account, password) => AccountNumber(await Request("POST", "/v1/register", account ? { account, password } : { password })),
        Redeem: async (_, invite, password) => AccountNumber(await Request("POST", "/v1/register", { invite, password })),
        Check: async (_, account, password) => {
            const issued = await Issue(account, password)
            creds = { account, password }
            return Request("GET", "/v1/me/devices", undefined, issued.value)
        },
        Provision: async (_, account) => ({ server: origin(), account, device_id: "" }),
        Release: async (_, account, password, id) => {
            await Request("POST", "/v1/revoke", { account, password, id })
        },
        Account: () => Authorized("GET", "/v1/me"),
        Devices: () => Authorized("GET", "/v1/me/devices"),
        Enroll: async (name) => {
            if (!SupportsKeys()) {
                throw new BridgeError("NO_WEBCRYPTO", "This browser cannot generate keys here")
            }
            const material = await GenerateDeviceKey()
            const data = await Authorized("POST", "/v1/me/devices", { name, csr: material.csr })
            const profile = Field(data, "profile")
            if (typeof profile !== "string") {
                throw new BridgeError("INVALID_RESPONSE", "Invalid server response")
            }
            return FillProfile(profile, material.key)
        },
        Rename: (id, name) => Authorized("PATCH", `/v1/me/devices/${encodeURIComponent(id)}`, { name }),
        Remove: async (id) => {
            await Authorized("DELETE", `/v1/me/devices/${encodeURIComponent(id)}`)
        },
        Password: async (next) => {
            if (!creds) {
                throw new BridgeError("NOT_SIGNED_IN", "Not signed in")
            }
            const data = await Authorized("PUT", "/v1/me/password", { password: creds.password, new_password: next })
            creds = { account: creds.account, password: next }
            const value = Field(data, "access_token")
            token = typeof value === "string" ? { value, until: Date.now() + TOKEN_LIFETIME } : null
        },
        Blocking: (categories) => (categories ? Authorized("PUT", "/v1/me/dns", { blocking: categories }) : Authorized("DELETE", "/v1/me/dns")),
        Delete: async (password) => {
            await Authorized("DELETE", "/v1/me", { password })
            creds = null
            token = null
        },
        SignOut: async () => {
            const current = token
            creds = null
            token = null
            if (current) {
                await Request("POST", "/v1/auth/logout", undefined, current.value).catch(() => null)
            }
        },
        Connect: async () => Unsupported(),
        Disconnect: async () => {},
        Status: async () => ({ state: "off", rx: 0, tx: 0 }),
        Installed: async () => false,
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
