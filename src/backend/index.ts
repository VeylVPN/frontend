import { SITE_URL } from "../lib/links"
import { type Provider, RIPESTAT, SiteProvider } from "../partners/resolver"
import type { Bridge } from "./bridge"
import { CreateNativeBridge } from "./native"
import { CreateWebBridge } from "./web"

export const IN_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

let current: Bridge | null = null

let lookup: Provider = SITE_URL ? SiteProvider(SITE_URL) : RIPESTAT

export function Backend(): Bridge {
    if (!current) {
        throw new Error("Backend bridge used before Prepare()")
    }
    return current
}

export function LookupProvider(): Provider {
    return lookup
}

export function Use(bridge: Bridge, provider?: Provider) {
    current = bridge
    if (provider) {
        lookup = provider
    }
}

export async function Prepare(): Promise<Bridge> {
    if (IN_TAURI) {
        Use(CreateNativeBridge())
        return Backend()
    }
    if (import.meta.env.DEV) {
        const scenario = new URLSearchParams(location.search).get("fixture")
        if (scenario !== null) {
            const fixture = await import("./fixture")
            Use(fixture.CreateFixtureBridge(scenario), fixture.FixtureProvider(scenario))
            return Backend()
        }
    }
    Use(CreateWebBridge())
    return Backend()
}
