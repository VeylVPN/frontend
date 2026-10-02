import { BridgeError } from "../backend/bridge"

export function Invalid(): never {
    throw new BridgeError("INVALID_RESPONSE", "Invalid server response")
}

export function Fields(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return Invalid()
    }
    return value as Record<string, unknown>
}

export function IsControl(char: string): boolean {
    const code = char.charCodeAt(0)
    return code < 32 || code === 127
}

export function Text(value: unknown, max = 256): string | null {
    if (typeof value !== "string") {
        return null
    }
    const clean = [...value]
        .filter((char) => !IsControl(char))
        .join("")
        .trim()
    return clean ? clean.slice(0, max) : null
}

export function Count(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
}

export function Port(value: unknown): number | null {
    const port = Count(value)
    return port !== null && port >= 1 && port <= 65535 ? port : null
}

export function Flag(value: unknown): boolean {
    return value === true
}

export function Words(value: unknown, max = 32): string[] {
    if (!Array.isArray(value)) {
        return []
    }
    const out: string[] = []
    for (const item of value.slice(0, max)) {
        const word = Text(item, 32)
        if (word && /^[a-z0-9_-]+$/i.test(word) && !out.includes(word.toLowerCase())) {
            out.push(word.toLowerCase())
        }
    }
    return out
}

export function Moment(value: unknown): Date | null {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return new Date(value * 1000)
    }
    if (typeof value === "string" && value) {
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? null : date
    }
    return null
}
