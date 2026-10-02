import type { Tunnel, TunnelState } from "../domain"
import { Count, Invalid, Fields } from "./values"

const STATES: TunnelState[] = ["off", "connecting", "connected"]

export function ParseStatus(raw: unknown): Tunnel {
    const record = Fields(raw)
    const state = STATES.find((item) => item === record.state)
    if (!state) {
        return Invalid()
    }
    return {
        state,
        received: Count(record.rx) ?? 0,
        sent: Count(record.tx) ?? 0,
    }
}
