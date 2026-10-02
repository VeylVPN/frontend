import type { Phase } from "../domain"
import type { Page } from "../stores/nav"

export type MiniSnapshot = {
    signed: boolean
    tunnel: boolean
    phase: Phase
    since: number | null
    name: string
    partner: string | null
    down: number
    up: number
    error: string | null
    motion: boolean
}

export type MiniRequest = { kind: "ready" } | { kind: "open"; page: Page }

export type MiniSource = {
    snapshot: MiniSnapshot
    Toggle(): void
    Open(page: Page): void
    Hide(): void
    OnShown(handler: () => void): void
}

export const EMPTY_SNAPSHOT: MiniSnapshot = {
    signed: false,
    tunnel: true,
    phase: "idle",
    since: null,
    name: "",
    partner: null,
    down: 0,
    up: 0,
    error: null,
    motion: true,
}

const PAGES: Page[] = ["home", "server", "devices", "settings"]

const PHASES: Phase[] = ["idle", "connecting", "connected", "reconnecting", "disconnecting", "error"]

function Text(value: unknown, max = 120): string {
    return typeof value === "string" ? value.slice(0, max) : ""
}

function Count(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
}

export function ParseRequest(value: unknown): MiniRequest | null {
    if (!value || typeof value !== "object") {
        return null
    }
    const record = value as Record<string, unknown>
    if (record.kind === "ready") {
        return { kind: "ready" }
    }
    if (record.kind === "open" && PAGES.includes(record.page as Page)) {
        return { kind: "open", page: record.page as Page }
    }
    return null
}

export function ParseSnapshot(value: unknown): MiniSnapshot {
    if (!value || typeof value !== "object") {
        return { ...EMPTY_SNAPSHOT }
    }
    const record = value as Record<string, unknown>
    const since = Count(record.since)
    return {
        signed: record.signed === true,
        tunnel: record.tunnel !== false,
        phase: PHASES.includes(record.phase as Phase) ? (record.phase as Phase) : "idle",
        since: since > 0 ? since : null,
        name: Text(record.name),
        partner: Text(record.partner) || null,
        down: Count(record.down),
        up: Count(record.up),
        error: Text(record.error) || null,
        motion: record.motion !== false,
    }
}
