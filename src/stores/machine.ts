import { reactive } from "vue"
import { ParseStatus } from "../adapters/connection"
import { Describe } from "../adapters/errors"
import type { Bridge } from "../backend/bridge"
import type { Phase, Tunnel, TunnelState, VpnError } from "../domain"

export type ConnectionState = {
    phase: Phase
    since: number | null
    received: number
    sent: number
    down: number
    up: number
    error: VpnError | null
    dropped: boolean
    installing: boolean
    slow: boolean
    detail: TunnelState
    polled: number | null
}

export type MachineOptions = {
    bridge: () => Bridge
    now?: () => number
    hidden?: () => boolean
    patience?: number
}

const BUSY: Phase[] = ["connecting", "reconnecting", "disconnecting"]

export function CreateMachine(options: MachineOptions) {
    const now = options.now ?? Date.now
    const hidden = options.hidden ?? (() => typeof document !== "undefined" && document.visibilityState === "hidden")
    const patience = options.patience ?? 45000
    const state = reactive<ConnectionState>({
        phase: "idle",
        since: null,
        received: 0,
        sent: 0,
        down: 0,
        up: 0,
        error: null,
        dropped: false,
        installing: false,
        slow: false,
        detail: "off",
        polled: null,
    })
    let ticket = 0
    let inflight: Promise<void> | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let waiting: ReturnType<typeof setTimeout> | null = null
    let polling = false
    let sample: { at: number; received: number; sent: number } | null = null

    function Interval(): number | null {
        if (state.phase === "connected" || state.phase === "reconnecting") {
            return hidden() ? 4000 : 1000
        }
        return state.phase === "connecting" ? 1000 : null
    }

    function Schedule() {
        if (timer) {
            clearTimeout(timer)
            timer = null
        }
        const delay = Interval()
        if (delay !== null) {
            timer = setTimeout(Poll, delay)
        }
    }

    function Calm() {
        if (waiting) {
            clearTimeout(waiting)
            waiting = null
        }
        state.slow = false
    }

    function Arm() {
        Calm()
        waiting = setTimeout(() => {
            waiting = null
            if (state.phase === "connecting" || state.phase === "reconnecting") {
                state.slow = true
            }
        }, patience)
    }

    function Stop() {
        if (timer) {
            clearTimeout(timer)
            timer = null
        }
        Calm()
    }

    function Clear() {
        state.since = null
        state.received = 0
        state.sent = 0
        state.down = 0
        state.up = 0
        sample = null
    }

    function Measure(tunnel: Tunnel) {
        const at = now()
        if (sample && at > sample.at && tunnel.received >= sample.received && tunnel.sent >= sample.sent) {
            const seconds = (at - sample.at) / 1000
            state.down = state.down * 0.35 + ((tunnel.received - sample.received) / seconds) * 0.65
            state.up = state.up * 0.35 + ((tunnel.sent - sample.sent) / seconds) * 0.65
        } else {
            state.down = 0
            state.up = 0
        }
        sample = { at, received: tunnel.received, sent: tunnel.sent }
        state.received = tunnel.received
        state.sent = tunnel.sent
    }

    function Apply(tunnel: Tunnel) {
        state.detail = tunnel.state
        state.polled = now()
        if (state.phase === "idle" || state.phase === "error" || state.phase === "disconnecting") {
            return
        }
        if (tunnel.state === "connected") {
            if (state.phase !== "connected") {
                state.phase = "connected"
                state.since ??= now()
                state.installing = false
                state.error = null
                Calm()
            }
            Measure(tunnel)
            return
        }
        if (tunnel.state === "connecting") {
            if (state.phase === "connected") {
                state.phase = "reconnecting"
                state.down = 0
                state.up = 0
                sample = null
                Arm()
            }
            return
        }
        if (inflight) {
            return
        }
        state.phase = "idle"
        state.dropped = true
        state.detail = "off"
        Clear()
        Stop()
    }

    async function Poll() {
        if (timer) {
            clearTimeout(timer)
            timer = null
        }
        if (polling) {
            return
        }
        polling = true
        try {
            Apply(ParseStatus(await options.bridge().Status()))
        } catch {
        } finally {
            polling = false
            Schedule()
        }
    }

    async function Start(bridge: Bridge) {
        state.installing = !(await bridge.Installed())
        await bridge.Connect()
    }

    async function Connect() {
        const bridge = options.bridge()
        if (!bridge.tunnel || inflight || BUSY.includes(state.phase)) {
            return
        }
        const mine = ++ticket
        state.phase = "connecting"
        state.error = null
        state.dropped = false
        Clear()
        Arm()
        Schedule()
        const call = Start(bridge)
        inflight = call
        let failure: unknown
        let failed = false
        try {
            await call
        } catch (error) {
            failed = true
            failure = error
        } finally {
            if (inflight === call) {
                inflight = null
            }
        }
        if (mine !== ticket) {
            return
        }
        state.installing = false
        if (failed) {
            state.phase = "error"
            state.error = Describe(failure)
            state.detail = "off"
            Stop()
            return
        }
        await Poll()
    }

    async function Disconnect() {
        if (state.phase === "idle" || state.phase === "disconnecting") {
            return
        }
        if (state.phase === "error") {
            state.phase = "idle"
            state.error = null
            return
        }
        const bridge = options.bridge()
        ticket++
        state.phase = "disconnecting"
        Stop()
        await bridge.Disconnect().catch(() => {})
        const pending = inflight
        if (pending) {
            await pending.catch(() => {})
            await bridge.Disconnect().catch(() => {})
        }
        state.phase = "idle"
        state.installing = false
        state.detail = "off"
        Clear()
    }

    function Toggle() {
        if (state.phase === "idle" || state.phase === "error") {
            return Connect()
        }
        return Disconnect()
    }

    function Dismiss() {
        state.dropped = false
        if (state.phase === "error") {
            state.phase = "idle"
            state.error = null
        }
    }

    function Reset() {
        ticket++
        Stop()
        state.phase = "idle"
        state.error = null
        state.dropped = false
        state.installing = false
        state.detail = "off"
        Clear()
    }

    function Wake() {
        if (!polling) {
            Schedule()
        }
    }

    return { state, Connect, Disconnect, Toggle, Dismiss, Reset, Wake, Poll }
}
