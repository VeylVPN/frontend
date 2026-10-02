import { reactive, watch } from "vue"
import { Launch, Start } from "../lifecycle"
import { Toggle } from "../stores/connection"
import { Snapshot } from "./publish"
import type { MiniSource } from "./types"

export async function CreateLocalSource(): Promise<MiniSource> {
    await Start()
    await Launch()
    const snapshot = reactive(Snapshot())
    watch(Snapshot, (next) => Object.assign(snapshot, next))
    return {
        snapshot,
        Toggle: () => {
            void Toggle()
        },
        Open: () => {
            location.href = `/${location.search}`
        },
        Hide: () => {},
        OnShown: () => {},
    }
}
