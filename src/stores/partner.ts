import { reactive, watch } from "vue"
import { LookupProvider } from "../backend"
import { CreateResolver, IDLE_MATCH, type PartnerMatch } from "../partners/resolver"
import { connection } from "./connection"
import { prefs } from "./prefs"

const SETTLE = 1200

export const partner = reactive<PartnerMatch>({ ...IDLE_MATCH })

let resolver: ReturnType<typeof CreateResolver> | null = null
let controller: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let generation = 0

function Resolver() {
    resolver ??= CreateResolver({ provider: LookupProvider() })
    return resolver
}

function Abort() {
    generation++
    if (timer) {
        clearTimeout(timer)
        timer = null
    }
    controller?.abort()
    controller = null
}

export function ResetPartner() {
    Abort()
    Object.assign(partner, IDLE_MATCH)
}

export async function CheckPartner(): Promise<void> {
    Abort()
    if (!prefs.partner || connection.phase !== "connected") {
        return
    }
    const mine = generation
    controller = new AbortController()
    partner.state = "checking"
    try {
        const result = await Resolver().Resolve(controller.signal)
        if (mine === generation) {
            Object.assign(partner, result)
        }
    } catch {
        if (mine === generation) {
            Object.assign(partner, IDLE_MATCH)
        }
    } finally {
        if (mine === generation) {
            controller = null
        }
    }
}

function Plan() {
    Abort()
    timer = setTimeout(() => {
        timer = null
        void CheckPartner()
    }, SETTLE)
}

export function StartPartnerWatch() {
    watch(
        () => connection.phase,
        (phase, previous) => {
            if (phase === "connected" && previous !== "connected") {
                if (prefs.partner) {
                    Plan()
                }
                return
            }
            if (phase === "reconnecting") {
                Abort()
                return
            }
            if (phase !== "connected") {
                ResetPartner()
            }
        },
    )
    watch(
        () => prefs.partner,
        (enabled) => {
            if (!enabled) {
                ResetPartner()
            } else if (connection.phase === "connected") {
                Plan()
            }
        },
    )
}
