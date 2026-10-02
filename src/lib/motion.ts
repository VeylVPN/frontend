export function MotionReduced(): boolean {
    return typeof document !== "undefined" && document.documentElement.dataset.motion === "reduced"
}
