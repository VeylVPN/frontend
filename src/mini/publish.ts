import { computed, watch } from "vue"
import { Backend } from "../backend"
import { Host } from "../lib/format"
import { connection } from "../stores/connection"
import { Go } from "../stores/nav"
import { partner } from "../stores/partner"
import { prefs } from "../stores/prefs"
import { session } from "../stores/session"
import { type MiniSnapshot, ParseRequest } from "./types"

export function Snapshot(): MiniSnapshot {
    const host = session.info?.endpoint ?? Host(session.profile?.server ?? "")
    return {
        signed: session.status === "signedin",
        tunnel: Backend().tunnel,
        phase: connection.phase,
        since: connection.since,
        name: session.info?.name ?? host,
        partner: partner.state === "matched" && partner.partner ? partner.partner.display : null,
        down: connection.down,
        up: connection.up,
        error: connection.phase === "error" && connection.error ? connection.error.title : null,
        motion: prefs.motion,
    }
}

export async function StartMiniLink(): Promise<void> {
    const bridge = Backend()
    const enabled = computed(() => prefs.mini && session.status === "signedin" && bridge.tunnel)
    watch(enabled, (on) => bridge.MiniPlayer(on), { immediate: true })
    watch(Snapshot, (snapshot) => bridge.Publish(snapshot), { immediate: true })
    await bridge.OnMini((value) => {
        const request = ParseRequest(value)
        if (request?.kind === "ready") {
            bridge.Publish(Snapshot())
        } else if (request?.kind === "open") {
            Go(request.page)
        }
    })
}
