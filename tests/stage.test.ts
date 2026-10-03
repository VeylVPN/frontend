import { describe, expect, test } from "vitest"
import { CHARGE_MIN, type Clock, CreateStage, LOCK_TIME, RELEASE_TIME } from "../src/composables/stage"
import type { Phase } from "../src/domain"

function FakeClock() {
    let time = 0
    let next = 1
    const tasks = new Map<number, { at: number; run: () => void }>()
    const clock: Clock = {
        now: () => time,
        later: (run, ms) => {
            const id = next++
            tasks.set(id, { at: time + ms, run })
            return id as unknown as ReturnType<typeof setTimeout>
        },
        cancel: (handle) => {
            tasks.delete(handle as unknown as number)
        },
    }
    function Advance(ms: number) {
        const end = time + ms
        for (;;) {
            const due = [...tasks.entries()].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
            if (!due) {
                break
            }
            tasks.delete(due[0])
            time = due[1].at
            due[1].run()
        }
        time = end
    }
    return { clock, Advance }
}

function Setup() {
    let phase: Phase = "idle"
    const fake = FakeClock()
    const stage = CreateStage(() => phase, fake.clock)
    function Enter(next: Phase) {
        phase = next
        stage.Sync(next)
    }
    return { stage, Enter, Advance: fake.Advance }
}

describe("connection choreography", () => {
    test("charges for a minimum time before locking in, even when the backend is instant", () => {
        const { stage, Enter, Advance } = Setup()
        Enter("connecting")
        expect(stage.visual.value).toBe("charging")
        expect(stage.streams.value).toBe("charge")
        Advance(200)
        Enter("connected")
        expect(stage.visual.value).toBe("charging")
        Advance(CHARGE_MIN - 200)
        expect(stage.visual.value).toBe("locking")
        expect(stage.wave.value?.kind).toBe("in")
        Advance(LOCK_TIME)
        expect(stage.visual.value).toBe("live")
        expect(stage.tone.value).toBe("on")
    })

    test("locks in right away when connecting already took long enough", () => {
        const { stage, Enter, Advance } = Setup()
        Enter("connecting")
        Advance(5000)
        Enter("connected")
        Advance(0)
        expect(stage.visual.value).toBe("locking")
    })

    test("plays the full release after a disconnect before settling", () => {
        const { stage, Enter, Advance } = Setup()
        Enter("connecting")
        Advance(2000)
        Enter("connected")
        Advance(LOCK_TIME)
        Enter("disconnecting")
        expect(stage.visual.value).toBe("releasing")
        expect(stage.wave.value?.kind).toBe("out")
        Enter("idle")
        expect(stage.visual.value).toBe("releasing")
        Advance(RELEASE_TIME)
        expect(stage.visual.value).toBe("idle")
    })

    test("waits for a slow disconnect to finish", () => {
        const { stage, Enter, Advance } = Setup()
        Enter("connecting")
        Advance(2000)
        Enter("connected")
        Advance(LOCK_TIME)
        Enter("disconnecting")
        Advance(RELEASE_TIME + 3000)
        expect(stage.visual.value).toBe("releasing")
        Enter("idle")
        expect(stage.visual.value).toBe("idle")
    })

    test("cancelling while charging releases without a light wave", () => {
        const { stage, Enter, Advance } = Setup()
        Enter("connecting")
        Advance(500)
        Enter("disconnecting")
        expect(stage.visual.value).toBe("releasing")
        expect(stage.wave.value).toBeNull()
        Enter("idle")
        Advance(RELEASE_TIME)
        expect(stage.visual.value).toBe("idle")
    })

    test("an unexpected drop releases too", () => {
        const { stage, Enter, Advance } = Setup()
        Enter("connecting")
        Advance(2000)
        Enter("connected")
        Advance(LOCK_TIME)
        Enter("idle")
        expect(stage.visual.value).toBe("releasing")
        Advance(RELEASE_TIME)
        expect(stage.visual.value).toBe("idle")
    })

    test("reconnecting recovers without waiting for the minimum charge", () => {
        const { stage, Enter, Advance } = Setup()
        Enter("connecting")
        Advance(2000)
        Enter("connected")
        Advance(LOCK_TIME)
        Enter("reconnecting")
        expect(stage.visual.value).toBe("recovering")
        expect(stage.live.value).toBe(true)
        Enter("connected")
        Advance(0)
        expect(stage.visual.value).toBe("locking")
    })

    test("errors stop the sequence", () => {
        const { stage, Enter } = Setup()
        Enter("connecting")
        Enter("error")
        expect(stage.visual.value).toBe("fail")
        expect(stage.streams.value).toBe("off")
        Enter("connecting")
        expect(stage.visual.value).toBe("charging")
    })
})
