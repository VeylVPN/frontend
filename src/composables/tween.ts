import { onBeforeUnmount, ref, watch } from "vue"
import { MotionReduced } from "../lib/motion"

export function useTween(source: () => number, ms = 700) {
    const value = ref(source())
    let frame = 0
    let from = value.value
    let to = value.value
    let started = 0

    function Step(now: number) {
        const k = Math.min(1, (now - started) / ms)
        const eased = 1 - (1 - k) ** 3
        value.value = from + (to - from) * eased
        frame = k < 1 ? requestAnimationFrame(Step) : 0
    }

    watch(source, (next) => {
        cancelAnimationFrame(frame)
        if (document.hidden || next < value.value || MotionReduced()) {
            value.value = next
            frame = 0
            return
        }
        from = value.value
        to = next
        started = performance.now()
        frame = requestAnimationFrame(Step)
    })

    onBeforeUnmount(() => cancelAnimationFrame(frame))

    return value
}
