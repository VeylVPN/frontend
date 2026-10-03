import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { Bridge } from "../src/backend/bridge"
import { CreateMachine } from "../src/stores/machine"

type Tunnel = { state: "off" | "connecting" | "connected"; rx: number; tx: number }

function FakeBridge(overrides: Partial<Bridge> = {}) {
    const tunnel: Tunnel = { state: "off", rx: 0, tx: 0 }
    const calls = { connect: 0, disconnect: 0 }
    let release: (() => void) | null = null
    const bridge = {
        mode: "native",
        tunnel: true,
        Installed: async () => true,
        Connect: () =>
            new Promise<void>((resolve) => {
                calls.connect++
                tunnel.state = "connecting"
                release = () => {
                    tunnel.state = "connected"
                    resolve()
                }
            }),
        Disconnect: async () => {
            calls.disconnect++
            tunnel.state = "off"
        },
        Status: async () => ({ ...tunnel }),
        ...overrides,
    } as unknown as Bridge
    return { bridge, tunnel, calls, Finish: () => release?.() }
}

async function Flush() {
    for (let index = 0; index < 5; index++) {
        await Promise.resolve()
    }
}

async function Connected(fake: ReturnType<typeof FakeBridge>, machine: ReturnType<typeof CreateMachine>) {
    const pending = machine.Connect()
    await Flush()
    fake.Finish()
    await pending
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

describe("connection machine", () => {
    test("connects and reports live counters", async () => {
        const fake = FakeBridge()
        let clock = 0
        const machine = CreateMachine({ bridge: () => fake.bridge, now: () => clock, hidden: () => false })
        const pending = machine.Connect()
        await Flush()
        expect(machine.state.phase).toBe("connecting")
        fake.Finish()
        await pending
        expect(machine.state.phase).toBe("connected")
        fake.tunnel.rx = 2048
        fake.tunnel.tx = 1024
        clock = 1000
        await vi.advanceTimersByTimeAsync(1000)
        expect(machine.state.received).toBe(2048)
        expect(machine.state.down).toBeGreaterThan(0)
    })

    test("ignores rapid repeated connect presses", async () => {
        const fake = FakeBridge()
        const machine = CreateMachine({ bridge: () => fake.bridge, hidden: () => false })
        void machine.Connect()
        void machine.Connect()
        void machine.Connect()
        await Flush()
        expect(fake.calls.connect).toBe(1)
    })

    test("cancel while connecting wins over a late connect result", async () => {
        const fake = FakeBridge()
        const machine = CreateMachine({ bridge: () => fake.bridge, hidden: () => false })
        const connecting = machine.Connect()
        await Flush()
        const cancelling = machine.Disconnect()
        await Flush()
        fake.Finish()
        await connecting
        await cancelling
        expect(machine.state.phase).toBe("idle")
        expect(fake.calls.disconnect).toBe(2)
    })

    test("maps a backend connect error", async () => {
        const fake = FakeBridge({
            Connect: async () => {
                throw "Could not enable the kill switch. Run Veyl as administrator."
            },
        })
        const machine = CreateMachine({ bridge: () => fake.bridge, hidden: () => false })
        await machine.Connect()
        expect(machine.state.phase).toBe("error")
        expect(machine.state.error?.code).toBe("KILL_SWITCH")
        machine.Dismiss()
        expect(machine.state.phase).toBe("idle")
    })

    test("shows reconnecting while OpenVPN recovers, then connected again", async () => {
        const fake = FakeBridge()
        const machine = CreateMachine({ bridge: () => fake.bridge, hidden: () => false })
        await Connected(fake, machine)
        const since = machine.state.since
        fake.tunnel.state = "connecting"
        await vi.advanceTimersByTimeAsync(1000)
        expect(machine.state.phase).toBe("reconnecting")
        fake.tunnel.state = "connected"
        await vi.advanceTimersByTimeAsync(1000)
        expect(machine.state.phase).toBe("connected")
        expect(machine.state.since).toBe(since)
    })

    test("detects an unexpected drop", async () => {
        const fake = FakeBridge()
        const machine = CreateMachine({ bridge: () => fake.bridge, hidden: () => false })
        await Connected(fake, machine)
        fake.tunnel.state = "off"
        await vi.advanceTimersByTimeAsync(1000)
        expect(machine.state.phase).toBe("idle")
        expect(machine.state.dropped).toBe(true)
    })

    test("flags a connection attempt that takes too long", async () => {
        const fake = FakeBridge()
        const machine = CreateMachine({ bridge: () => fake.bridge, hidden: () => false, patience: 5000 })
        void machine.Connect()
        await Flush()
        expect(machine.state.slow).toBe(false)
        await vi.advanceTimersByTimeAsync(5000)
        expect(machine.state.slow).toBe(true)
        expect(machine.state.phase).toBe("connecting")
    })

    test("does not poll while idle", async () => {
        const status = vi.fn(async () => ({ state: "off", rx: 0, tx: 0 }))
        const fake = FakeBridge({ Status: status })
        CreateMachine({ bridge: () => fake.bridge, hidden: () => false })
        await vi.advanceTimersByTimeAsync(10000)
        expect(status).not.toHaveBeenCalled()
    })

    test("polls less often while the window is hidden", async () => {
        const fake = FakeBridge()
        let hidden = false
        const machine = CreateMachine({ bridge: () => fake.bridge, hidden: () => hidden })
        await Connected(fake, machine)
        const status = vi.spyOn(fake.bridge, "Status")
        hidden = true
        machine.Wake()
        await vi.advanceTimersByTimeAsync(8000)
        expect(status.mock.calls.length).toBeLessThanOrEqual(2)
    })
})
