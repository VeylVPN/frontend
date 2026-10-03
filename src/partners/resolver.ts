import { ParseAsn, type PartnerNetwork, PartnerFor } from "./registry"

export type PartnerState = "idle" | "checking" | "matched" | "not-matched" | "unavailable"

export type PartnerMatch = {
    state: PartnerState
    exit: string | null
    asn: number | null
    prefix: string | null
    partner: PartnerNetwork | null
    source: string | null
    checked: number | null
    reason: string | null
}

export type NetworkInfo = {
    asns: number[]
    prefix: string | null
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export type Provider = {
    name: string
    Exit(fetcher: Fetcher, signal: AbortSignal): Promise<{ ip: string; network: NetworkInfo | null }>
    Network(fetcher: Fetcher, ip: string, signal: AbortSignal): Promise<NetworkInfo>
}

const RESPONSE_LIMIT = 64 * 1024

const CACHE_LIMIT = 32

export const IDLE_MATCH: PartnerMatch = {
    state: "idle",
    exit: null,
    asn: null,
    prefix: null,
    partner: null,
    source: null,
    checked: null,
    reason: null,
}

export function IsIp(value: string): boolean {
    if (/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(value)) {
        return true
    }
    if (!value.includes(":") || !/^[0-9a-f:.]+$/i.test(value) || value.length > 45) {
        return false
    }
    try {
        return new URL(`http://[${value}]/`).hostname.length > 2
    } catch {
        return false
    }
}

function Field(data: unknown, key: string): unknown {
    return data && typeof data === "object" ? (data as Record<string, unknown>)[key] : undefined
}

function Address(value: unknown): string {
    const ip = typeof value === "string" ? value.trim() : ""
    if (!IsIp(ip)) {
        throw new Error("No valid exit address")
    }
    return ip
}

function Prefix(value: unknown): string | null {
    return typeof value === "string" && /^[0-9a-f:.]+\/\d{1,3}$/i.test(value) ? value : null
}

function Asns(value: unknown): number[] {
    const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
    return list
        .slice(0, 8)
        .map(ParseAsn)
        .filter((asn): asn is number => asn !== null)
}

async function Json(fetcher: Fetcher, url: string, signal: AbortSignal): Promise<unknown> {
    const response = await fetcher(url, {
        signal,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        redirect: "error",
    })
    if (!response.ok) {
        throw new Error(`Lookup responded ${response.status}`)
    }
    const text = await response.text()
    if (text.length > RESPONSE_LIMIT) {
        throw new Error("Lookup response too large")
    }
    return JSON.parse(text)
}

export const RIPESTAT: Provider = {
    name: "RIPEstat",
    async Exit(fetcher, signal) {
        const data = await Json(fetcher, "https://stat.ripe.net/data/whats-my-ip/data.json", signal)
        return { ip: Address(Field(Field(data, "data"), "ip")), network: null }
    },
    async Network(fetcher, ip, signal) {
        const data = await Json(fetcher, `https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(ip)}`, signal)
        const inner = Field(data, "data")
        return { asns: Asns(Field(inner, "asns")), prefix: Prefix(Field(inner, "prefix")) }
    },
}

export function SiteProvider(base: string): Provider {
    const root = base.replace(/\/+$/, "")
    return {
        name: "VeylVPN",
        async Exit(fetcher, signal) {
            const data = await Json(fetcher, `${root}/api/connection`, signal)
            const network = Field(data, "network")
            return { ip: Address(Field(data, "ip")), network: network ? { asns: Asns(Field(network, "asn")), prefix: null } : null }
        },
        async Network() {
            throw new Error("Network lookup is not available from this provider")
        },
    }
}

function Deadline<T>(signal: AbortSignal, ms: number, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error("Lookup timed out")), ms)
    const Forward = () => controller.abort(signal.reason)
    if (signal.aborted) {
        Forward()
    } else {
        signal.addEventListener("abort", Forward, { once: true })
    }
    return task(controller.signal).finally(() => {
        clearTimeout(timer)
        signal.removeEventListener("abort", Forward)
    })
}

function Aborted(signal: AbortSignal): never {
    throw signal.reason instanceof Error ? signal.reason : new Error("Aborted")
}

export type ResolverOptions = {
    provider: Provider
    fetcher?: Fetcher
    now?: () => number
    ttl?: number
    timeout?: number
}

export function CreateResolver(options: ResolverOptions) {
    const provider = options.provider
    const fetcher: Fetcher = options.fetcher ?? ((input, init) => fetch(input, init))
    const now = options.now ?? Date.now
    const ttl = options.ttl ?? 6 * 60 * 60 * 1000
    const timeout = options.timeout ?? 6000
    const cache = new Map<string, { network: NetworkInfo; at: number }>()

    function Unavailable(reason: string, exit: string | null): PartnerMatch {
        return { ...IDLE_MATCH, state: "unavailable", exit, source: provider.name, checked: now(), reason }
    }

    function Remember(ip: string, network: NetworkInfo) {
        cache.delete(ip)
        cache.set(ip, { network, at: now() })
        while (cache.size > CACHE_LIMIT) {
            const oldest = cache.keys().next().value
            if (oldest === undefined) {
                break
            }
            cache.delete(oldest)
        }
    }

    async function Resolve(signal: AbortSignal): Promise<PartnerMatch> {
        let exit: string
        let network: NetworkInfo | null
        try {
            const result = await Deadline(signal, timeout, (inner) => provider.Exit(fetcher, inner))
            exit = result.ip
            network = result.network
        } catch {
            if (signal.aborted) {
                Aborted(signal)
            }
            return Unavailable("Couldn't determine the VPN exit address", null)
        }
        if (!network) {
            const hit = cache.get(exit)
            if (hit && now() - hit.at < ttl) {
                network = hit.network
            } else {
                try {
                    network = await Deadline(signal, timeout, (inner) => provider.Network(fetcher, exit, inner))
                } catch {
                    if (signal.aborted) {
                        Aborted(signal)
                    }
                    return Unavailable("Couldn't look up the network for the exit address", exit)
                }
                Remember(exit, network)
            }
        }
        if (signal.aborted) {
            Aborted(signal)
        }
        const partner = network.asns.map(PartnerFor).find((item) => item !== null) ?? null
        return {
            state: partner ? "matched" : "not-matched",
            exit,
            asn: partner?.asn ?? network.asns[0] ?? null,
            prefix: network.prefix,
            partner,
            source: provider.name,
            checked: now(),
            reason: null,
        }
    }

    return {
        Resolve,
        Clear: () => cache.clear(),
        Size: () => cache.size,
    }
}
