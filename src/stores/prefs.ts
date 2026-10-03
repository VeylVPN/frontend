import { reactive, watch } from "vue"

const KEY = "veylvpn.preferences"

export type Prefs = {
    autoconnect: boolean
    tray: boolean
    partner: boolean
    conceal: boolean
    motion: boolean
    mini: boolean
}

const DEFAULTS: Prefs = { autoconnect: false, tray: false, partner: true, conceal: false, motion: true, mini: true }

function Read(): Prefs {
    try {
        const raw = localStorage.getItem(KEY)
        const data: unknown = raw ? JSON.parse(raw) : {}
        const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {}
        return {
            autoconnect: record.autoconnect === true,
            tray: record.tray === true,
            partner: record.partner !== false,
            conceal: record.conceal === true,
            motion: record.motion !== false,
            mini: record.mini !== false,
        }
    } catch {
        return { ...DEFAULTS }
    }
}

export const prefs = reactive<Prefs>(Read())

watch(
    prefs,
    (value) => {
        try {
            localStorage.setItem(KEY, JSON.stringify(value))
        } catch {}
    },
    { deep: true },
)

export function ResetPrefs() {
    Object.assign(prefs, DEFAULTS)
}
