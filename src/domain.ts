export type Mode = "native" | "web"

export type TunnelState = "off" | "connecting" | "connected"

export type Tunnel = {
    state: TunnelState
    received: number
    sent: number
}

export type Phase = "idle" | "connecting" | "connected" | "reconnecting" | "disconnecting" | "error"

export type Registration = "open" | "invite" | "closed"

export type Category = string

export type ServerInfo = {
    name: string
    endpoint: string
    port: number | null
    protocol: string
    stealth: number | null
    platform: string | null
    version: string | null
    registration: Registration | null
    limit: number | null
    categories: Category[]
    defaults: Category[]
    quantum: boolean
}

export type AccountStatus = "active" | "expired" | "disabled"

export type Account = {
    id: string
    created: Date | null
    expires: Date | null
    limit: number
    devices: number
    blocking: Category[]
    custom: boolean
    status: AccountStatus
}

export type Blocking = {
    blocking: Category[]
    custom: boolean
}

export type Device = {
    id: string
    name: string
    created: Date | null
    online: boolean
}

export type DeviceList = {
    limit: number
    devices: Device[]
}

export type Profile = {
    server: string
    account: string
    device: string
}

export type ErrorKind =
    | "SERVICE_UNAVAILABLE"
    | "CONFIGURATION_ERROR"
    | "PERMISSION_ERROR"
    | "CONNECTION_TIMEOUT"
    | "AUTHENTICATION_ERROR"
    | "ACCOUNT_ERROR"
    | "LIMIT_ERROR"
    | "RATE_LIMITED"
    | "TUNNEL_ERROR"
    | "NETWORK_ERROR"
    | "UNKNOWN_ERROR"

export type VpnError = {
    kind: ErrorKind
    code: string
    title: string
    message: string
    detail: string
    retry: boolean
}

export type Reach = "unknown" | "checking" | "online" | "offline"

export type GlobeTone = "idle" | "busy" | "on" | "fail"
