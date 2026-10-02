import { reactive } from "vue"
import { ParseAccount, ParseBlocking, ParseProfile } from "../adapters/account"
import { Describe, Is } from "../adapters/errors"
import { ParseInfo } from "../adapters/server"
import { Backend } from "../backend"
import type { Account, Profile, Reach, ServerInfo, VpnError } from "../domain"
import { ResetConnection } from "./connection"
import { ResetDevices } from "./devices"
import { Go } from "./nav"
import { ResetPartner } from "./partner"

export type SessionStatus = "loading" | "signedout" | "signedin"

export const session = reactive({
    status: "loading" as SessionStatus,
    profile: null as Profile | null,
    info: null as ServerInfo | null,
    reach: "unknown" as Reach,
    reachError: null as VpnError | null,
    checked: null as number | null,
    account: null as Account | null,
    accountError: null as VpnError | null,
    accountLoading: false,
    orphaned: false,
})

export async function CheckServer(): Promise<void> {
    if (session.reach === "checking") {
        return
    }
    session.reach = "checking"
    try {
        session.info = ParseInfo(await Backend().Info(null))
        session.reach = "online"
        session.reachError = null
    } catch (error) {
        session.reach = "offline"
        session.reachError = Describe(error)
    } finally {
        session.checked = Date.now()
    }
}

export async function LoadAccount(): Promise<void> {
    if (session.accountLoading) {
        return
    }
    session.accountLoading = true
    try {
        session.account = ParseAccount(await Backend().Account())
        session.accountError = null
    } catch (error) {
        session.accountError = Describe(error)
    } finally {
        session.accountLoading = false
    }
}

export async function Refresh(): Promise<void> {
    await Promise.all([CheckServer(), LoadAccount()])
}

export async function Boot(): Promise<void> {
    try {
        session.profile = ParseProfile(await Backend().Profile())
    } catch {
        session.profile = null
    }
    session.status = session.profile ? "signedin" : "signedout"
    if (session.profile) {
        void Refresh()
    } else if (Backend().mode === "web") {
        void CheckServer()
    }
}

export function Complete(profile: Profile, info: ServerInfo | null) {
    session.profile = profile
    session.info = info
    session.reach = info ? "online" : "unknown"
    session.reachError = null
    session.account = null
    session.accountError = null
    session.orphaned = false
    session.status = "signedin"
    Go("home")
    void Refresh()
}

function Forget() {
    ResetConnection()
    ResetDevices()
    ResetPartner()
    session.profile = null
    session.account = null
    session.accountError = null
    session.orphaned = false
    session.status = "signedout"
    Go("home")
}

export async function SignOut(revoke: boolean): Promise<void> {
    await Backend().SignOut(revoke)
    Forget()
}

export async function DeleteAccount(password: string): Promise<void> {
    await Backend().Delete(password)
    Forget()
}

export async function ChangePassword(next: string): Promise<void> {
    await Backend().Password(next)
}

export async function SetBlocking(categories: string[] | null): Promise<void> {
    const result = ParseBlocking(await Backend().Blocking(categories))
    if (session.account) {
        session.account.blocking = result.blocking
        session.account.custom = result.custom
    }
}

export function NeedsSignIn(): boolean {
    return session.orphaned || Is(session.accountError, "INVALID_CREDENTIALS", "INVALID_ACCESS_TOKEN", "NOT_SIGNED_IN")
}
