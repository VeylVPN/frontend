import { IsControl } from "../adapters/values"

const UNITS = ["KB", "MB", "GB", "TB"]

export function Bytes(value: number): string {
    if (!Number.isFinite(value) || value < 1024) {
        return `${Math.max(0, Math.round(value || 0))} B`
    }
    let size = value
    let index = -1
    do {
        size /= 1024
        index++
    } while (size >= 1024 && index < UNITS.length - 1)
    return `${size.toFixed(size < 10 ? 2 : size < 100 ? 1 : 0)} ${UNITS[index]}`
}

export function Rate(value: number): string {
    return `${Bytes(value)}/s`
}

function Pad(value: number): string {
    return String(value).padStart(2, "0")
}

export function Clock(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    return `${Pad(hours)}:${Pad(minutes)}:${Pad(total % 60)}`
}

export function Digits(value: string): string {
    return value.replace(/\D/g, "").slice(0, 16)
}

export function GroupAccount(value: string): string {
    return Digits(value)
        .replace(/(.{4})/g, "$1 ")
        .trim()
}

export function MaskAccount(value: string): string {
    return `•••• •••• •••• ${Digits(value).slice(-4)}`
}

export function MaskIp(value: string): string {
    if (value.includes(":")) {
        return "••••:••••:••••::••••"
    }
    return "•••.•••.•••.•••"
}

export function DateText(value: Date | null): string {
    if (!value) {
        return "Unknown"
    }
    return value.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

export function Host(server: string): string {
    return server
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/+$/, "")
}

export function Plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`
}

export function ValidServer(value: string): boolean {
    const host = Host(value)
    return host.length > 0 && host.length <= 253 && /^[A-Za-z0-9.\-:[\]]+$/.test(host) && !host.startsWith(".") && !host.startsWith("-")
}

export function ValidDeviceName(value: string): boolean {
    const name = value.trim()
    return name.length >= 1 && name.length <= 32 && ![...name].some(IsControl)
}
