import { reactive } from "vue"

export type Tone = "info" | "success" | "error"

export type Toast = {
    id: number
    message: string
    tone: Tone
}

export const toasts = reactive<Toast[]>([])

let next = 1

export function Dismiss(id: number) {
    const index = toasts.findIndex((toast) => toast.id === id)
    if (index >= 0) {
        toasts.splice(index, 1)
    }
}

export function Notify(message: string, tone: Tone = "info", ms = 3200) {
    const id = next++
    toasts.push({ id, message, tone })
    while (toasts.length > 3) {
        toasts.shift()
    }
    setTimeout(() => Dismiss(id), ms)
}
