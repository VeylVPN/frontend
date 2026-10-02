import type { Mode } from "../domain"

export type WindowAction = "min" | "max" | "close"

export class BridgeError extends Error {
    code: string
    status: number

    constructor(code: string, message: string, status = 0) {
        super(message)
        this.name = "BridgeError"
        this.code = code
        this.status = status
    }
}

export function ToBridgeError(value: unknown): BridgeError {
    if (value instanceof BridgeError) {
        return value
    }
    if (typeof value === "string") {
        return new BridgeError("", value)
    }
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>
        const code = typeof record.code === "string" ? record.code : ""
        const message = typeof record.message === "string" ? record.message : "Request failed"
        const status = typeof record.status === "number" ? record.status : 0
        return new BridgeError(code, message, status)
    }
    return new BridgeError("", "Request failed")
}

export interface Bridge {
    mode: Mode
    tunnel: boolean
    Profile(): Promise<unknown>
    Info(server: string | null): Promise<unknown>
    Register(server: string, account: string | null, password: string): Promise<unknown>
    Redeem(server: string, invite: string, password: string): Promise<unknown>
    Check(server: string, account: string, password: string): Promise<unknown>
    Provision(server: string, account: string, password: string, name: string): Promise<unknown>
    Release(server: string, account: string, password: string, id: string): Promise<void>
    Account(): Promise<unknown>
    Devices(): Promise<unknown>
    Enroll(name: string): Promise<string>
    Rename(id: string, name: string): Promise<unknown>
    Remove(id: string): Promise<void>
    Password(next: string): Promise<void>
    Blocking(categories: string[] | null): Promise<unknown>
    Delete(password: string): Promise<void>
    SignOut(revoke: boolean): Promise<void>
    Connect(): Promise<void>
    Disconnect(): Promise<void>
    Status(): Promise<unknown>
    Installed(): Promise<boolean>
    Window(action: WindowAction): void
    Tray(status: string, action: string, enabled: boolean): void
    KeepInTray(enabled: boolean): void
    OnTray(handler: () => void): Promise<() => void>
    Open(url: string): Promise<void>
}
