import { invoke } from "@tauri-apps/api/core"
import { emitTo, listen } from "@tauri-apps/api/event"
import { reactive } from "vue"
import { EMPTY_SNAPSHOT, type MiniSnapshot, type MiniSource, ParseSnapshot } from "./types"

export async function CreateRemoteSource(): Promise<MiniSource> {
    const snapshot = reactive<MiniSnapshot>({ ...EMPTY_SNAPSHOT })
    const shown: (() => void)[] = []
    await listen("mini-state", (event) => {
        Object.assign(snapshot, ParseSnapshot(event.payload))
    })
    await listen("mini-shown", () => {
        for (const handler of shown) {
            handler()
        }
    })
    emitTo("main", "mini-request", { kind: "ready" }).catch(() => {})
    return {
        snapshot,
        Toggle: () => {
            emitTo("main", "tray-toggle").catch(() => {})
        },
        Open: (page) => {
            invoke("mini_open", { page }).catch(() => {})
        },
        Hide: () => {
            invoke("mini_hide").catch(() => {})
        },
        OnShown: (handler) => {
            shown.push(handler)
        },
    }
}
