import { computed, ref } from "vue"
import type { GlobeTone, Phase } from "../domain"

export type Visual = "idle" | "charging" | "recovering" | "locking" | "live" | "releasing" | "fail"

export type Wave = { at: number; kind: "in" | "out" }

export type StreamMode = "off" | "charge" | "lock" | "release"

export const CHARGE_MIN = 1400

export const LOCK_TIME = 1300

export const RELEASE_TIME = 1250

export type Clock = {
    now: () => number
    later: (run: () => void, ms: number) => ReturnType<typeof setTimeout>
    cancel: (handle: ReturnType<typeof setTimeout>) => void
}

const REAL: Clock = {
    now: () => performance.now(),
    later: (run, ms) => setTimeout(run, ms),
    cancel: (handle) => clearTimeout(handle),
}

const ACTIVE: Visual[] = ["live", "locking", "charging", "recovering"]

export function CreateStage(phase: () => Phase, clock: Clock = REAL) {
    const visual = ref<Visual>(phase() === "connected" ? "live" : phase() === "error" ? "fail" : "idle")
    const wave = ref<Wave | null>(null)
    let timer: ReturnType<typeof setTimeout> | null = null
    let charged = 0
    let released = true

    function Clear() {
        if (timer) {
            clock.cancel(timer)
            timer = null
        }
    }

    function Lock() {
        Clear()
        visual.value = "locking"
        wave.value = { at: clock.now(), kind: "in" }
        timer = clock.later(() => {
            timer = null
            if (phase() === "connected") {
                visual.value = "live"
            } else {
                Sync(phase())
            }
        }, LOCK_TIME)
    }

    function Release() {
        if (visual.value === "releasing") {
            return
        }
        Clear()
        const was = visual.value
        visual.value = "releasing"
        released = false
        if (was === "live" || was === "locking" || was === "recovering") {
            wave.value = { at: clock.now(), kind: "out" }
        }
        timer = clock.later(() => {
            timer = null
            released = true
            if (phase() !== "disconnecting") {
                Settle(phase())
            }
        }, RELEASE_TIME)
    }

    function Settle(current: Phase) {
        visual.value = "idle"
        if (current !== "idle") {
            Sync(current)
        }
    }

    function Sync(current: Phase) {
        switch (current) {
            case "connecting":
                Clear()
                if (visual.value !== "charging") {
                    charged = clock.now()
                    visual.value = "charging"
                }
                return
            case "reconnecting":
                Clear()
                charged = clock.now()
                visual.value = "recovering"
                return
            case "connected": {
                if (visual.value === "locking" || visual.value === "live") {
                    return
                }
                if (visual.value === "charging" || visual.value === "recovering") {
                    const wait = visual.value === "recovering" ? 0 : Math.max(0, CHARGE_MIN - (clock.now() - charged))
                    Clear()
                    timer = clock.later(Lock, wait)
                    return
                }
                Lock()
                return
            }
            case "disconnecting":
                Release()
                return
            case "error":
                Clear()
                visual.value = "fail"
                return
            default:
                if (visual.value === "releasing") {
                    if (released) {
                        visual.value = "idle"
                    }
                    return
                }
                if (ACTIVE.includes(visual.value)) {
                    Release()
                    return
                }
                Clear()
                visual.value = "idle"
        }
    }

    const tone = computed<GlobeTone>(() => {
        switch (visual.value) {
            case "charging":
            case "recovering":
                return "busy"
            case "locking":
            case "live":
                return "on"
            case "fail":
                return "fail"
            default:
                return "idle"
        }
    })

    const streams = computed<StreamMode>(() => {
        switch (visual.value) {
            case "charging":
            case "recovering":
                return "charge"
            case "locking":
                return "lock"
            case "releasing":
                return "release"
            default:
                return "off"
        }
    })

    const live = computed(() => visual.value === "locking" || visual.value === "live" || visual.value === "recovering")

    return { visual, wave, tone, streams, live, Sync, Dispose: Clear }
}

export function OrbLabel(visual: Visual): string {
    switch (visual) {
        case "charging":
            return "Connecting"
        case "recovering":
            return "Reconnecting"
        case "locking":
        case "live":
            return "Connected"
        case "releasing":
            return "Disconnecting"
        case "fail":
            return "Try again"
        default:
            return "Connect"
    }
}

export function Presence(visual: Visual): { dot: string; text: string } {
    switch (visual) {
        case "locking":
        case "live":
            return { dot: "bg-on shadow-[0_0_10px_rgb(84_232_112/0.9)]", text: "Protected" }
        case "charging":
            return { dot: "bg-busy animate-pulse", text: "Connecting" }
        case "recovering":
            return { dot: "bg-busy animate-pulse", text: "Reconnecting" }
        case "releasing":
            return { dot: "bg-idle", text: "Disconnecting" }
        default:
            return { dot: visual === "fail" ? "bg-fail" : "bg-idle", text: "Not connected" }
    }
}
