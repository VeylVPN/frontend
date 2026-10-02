import { reactive } from "vue"
import { ParseAccountNumber, ParseProfile } from "../adapters/account"
import { ParseDevices } from "../adapters/devices"
import { Describe } from "../adapters/errors"
import { ParseInfo } from "../adapters/server"
import { Backend } from "../backend"
import { BridgeError } from "../backend/bridge"
import type { Device, ServerInfo, VpnError } from "../domain"
import { Digits, Host, ValidServer } from "../lib/format"
import { Complete, session } from "./session"

export type SetupStep = "server" | "account" | "created" | "limit"

export type AccountMode = "signin" | "create"

export type JoinMethod = "open" | "invite" | "number"

export type Problem = { field: string; message: string } | null

export const DEVICE_NAME = "Windows PC"

export const setup = reactive({
    step: "server" as SetupStep,
    server: "",
    info: null as ServerInfo | null,
    mode: "signin" as AccountMode,
    method: "open" as JoinMethod,
    account: "",
    password: "",
    repeat: "",
    invite: "",
    created: "",
    busy: false,
    error: null as VpnError | null,
    problem: null as Problem,
    devices: [] as Device[],
    limit: 0,
    releasing: null as string | null,
})

function Scrub() {
    setup.password = ""
    setup.repeat = ""
    setup.invite = ""
    setup.created = ""
    setup.devices = []
    setup.releasing = null
}

function Fail(field: string, message: string): false {
    setup.problem = { field, message }
    return false
}

function Methods(info: ServerInfo | null): JoinMethod[] {
    if (info?.registration === "open") {
        return ["open", "invite", "number"]
    }
    if (info?.registration === "invite") {
        return ["invite", "number"]
    }
    return ["number"]
}

export function AvailableMethods(): JoinMethod[] {
    return Methods(setup.info)
}

export function StartSetup() {
    Scrub()
    setup.error = null
    setup.problem = null
    setup.busy = false
    setup.mode = "signin"
    if (Backend().mode === "web") {
        setup.step = "account"
        setup.server = ""
        setup.info = session.info
    } else {
        setup.step = setup.info ? "account" : "server"
    }
    setup.method = Methods(setup.info)[0] ?? "number"
}

export function SetMode(mode: AccountMode) {
    setup.mode = mode
    setup.error = null
    setup.problem = null
    setup.method = Methods(setup.info)[0] ?? "number"
}

export function SetMethod(method: JoinMethod) {
    setup.method = method
    setup.error = null
    setup.problem = null
}

export function ChangeServer() {
    Scrub()
    setup.step = "server"
    setup.error = null
    setup.problem = null
}

export async function SubmitServer(): Promise<void> {
    setup.problem = null
    setup.error = null
    const host = Host(setup.server)
    if (!host) {
        Fail("server", "Enter your server's address.")
        return
    }
    if (!ValidServer(host)) {
        Fail("server", "Use just the address, for example vpn.example.com.")
        return
    }
    setup.busy = true
    try {
        setup.info = ParseInfo(await Backend().Info(host))
        setup.server = host
        setup.step = "account"
        setup.mode = "signin"
        setup.method = Methods(setup.info)[0] ?? "number"
    } catch (error) {
        setup.error = Describe(error)
    } finally {
        setup.busy = false
    }
}

async function Finish(account: string, password: string): Promise<void> {
    const bridge = Backend()
    const listed = ParseDevices(await bridge.Check(setup.server, account, password))
    try {
        const profile = ParseProfile(await bridge.Provision(setup.server, account, password, DEVICE_NAME))
        if (!profile) {
            throw new BridgeError("INVALID_RESPONSE", "Invalid server response")
        }
        const info = setup.info
        Scrub()
        setup.account = ""
        setup.step = "server"
        Complete(profile, info)
    } catch (error) {
        const described = Describe(error)
        if (described.code !== "MAX_DEVICES_REACHED") {
            throw error
        }
        setup.devices = listed.devices
        setup.limit = listed.limit
        setup.account = account
        setup.step = "limit"
    }
}

export async function SubmitSignIn(): Promise<void> {
    setup.problem = null
    setup.error = null
    const account = Digits(setup.account)
    if (account.length !== 16) {
        Fail("account", "Account numbers have 16 digits.")
        return
    }
    if (!setup.password) {
        Fail("password", "Enter your password.")
        return
    }
    setup.busy = true
    try {
        await Finish(account, setup.password)
    } catch (error) {
        setup.error = Describe(error)
    } finally {
        setup.busy = false
    }
}

function ValidPasswords(): boolean {
    if (setup.password.length < 10) {
        return Fail("password", "Use at least 10 characters.")
    }
    if (setup.password.length > 256) {
        return Fail("password", "Use at most 256 characters.")
    }
    if (setup.password !== setup.repeat) {
        return Fail("repeat", "The passwords don't match.")
    }
    return true
}

export async function SubmitCreate(): Promise<void> {
    setup.problem = null
    setup.error = null
    const account = Digits(setup.account)
    const invite = setup.invite.trim()
    if (setup.method === "number" && account.length !== 16) {
        Fail("account", "Account numbers have 16 digits.")
        return
    }
    if (setup.method === "invite" && (!invite || invite.length > 64)) {
        Fail("invite", "Enter the invite code you were given.")
        return
    }
    if (!ValidPasswords()) {
        return
    }
    setup.busy = true
    try {
        const bridge = Backend()
        const result =
            setup.method === "invite"
                ? await bridge.Redeem(setup.server, invite, setup.password)
                : await bridge.Register(setup.server, setup.method === "number" ? account : null, setup.password)
        setup.created = ParseAccountNumber(result)
        setup.invite = ""
        setup.step = "created"
    } catch (error) {
        setup.error = Describe(error)
    } finally {
        setup.busy = false
    }
}

export async function ContinueCreated(): Promise<void> {
    setup.error = null
    setup.busy = true
    try {
        await Finish(setup.created, setup.password)
    } catch (error) {
        setup.error = Describe(error)
    } finally {
        setup.busy = false
    }
}

export async function ReleaseDevice(id: string): Promise<void> {
    setup.error = null
    setup.releasing = id
    try {
        await Backend().Release(setup.server, Digits(setup.account), setup.password, id)
        setup.devices = setup.devices.filter((device) => device.id !== id)
    } catch (error) {
        setup.error = Describe(error)
    } finally {
        setup.releasing = null
    }
}

export async function RetryAfterRelease(): Promise<void> {
    setup.error = null
    setup.busy = true
    try {
        await Finish(Digits(setup.account), setup.password)
    } catch (error) {
        setup.error = Describe(error)
    } finally {
        setup.busy = false
    }
}

export function LeaveLimit() {
    Scrub()
    setup.step = "account"
    setup.mode = "signin"
}
