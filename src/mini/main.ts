import { createApp, reactive } from "vue"
import "../assets/main.css"
import MiniPlayer from "../components/mini/MiniPlayer.vue"
import { EMPTY_SNAPSHOT, type MiniSource } from "./types"

async function Source(): Promise<MiniSource> {
    if ("__TAURI_INTERNALS__" in window) {
        const remote = await import("./remote")
        return remote.CreateRemoteSource()
    }
    if (import.meta.env.DEV) {
        const local = await import("./local")
        return local.CreateLocalSource()
    }
    return {
        snapshot: reactive({ ...EMPTY_SNAPSHOT, tunnel: false }),
        Toggle: () => {},
        Open: () => {
            location.href = "./"
        },
        Hide: () => {},
        OnShown: () => {},
    }
}

const source = await Source()
createApp(MiniPlayer, { source }).mount("#app")
