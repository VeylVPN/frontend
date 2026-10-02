import { describe, expect, test, vi } from "vitest"
import { FormatAsn, ParseAsn, PartnerFor } from "../src/partners/registry"
import { CreateResolver, IsIp, type Provider, RIPESTAT } from "../src/partners/resolver"

function Json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

function Ripe(exit: string, asns: string[], prefix: string | null) {
    const calls: string[] = []
    const fetcher = vi.fn(async (url: string) => {
        calls.push(url)
        if (url.includes("whats-my-ip")) {
            return Json({ data: { ip: exit } })
        }
        return Json({ data: { asns, prefix } })
    })
    return { fetcher, calls }
}

function Hanging(): Provider {
    return {
        name: "hanging",
        Exit: (_, signal) =>
            new Promise((_, reject) => {
                signal.addEventListener("abort", () => reject(signal.reason ?? new Error("aborted")))
            }),
        Network: async () => ({ asns: [], prefix: null }),
    }
}

describe("registry", () => {
    test("parses ASNs in every common form", () => {
        expect(ParseAsn("AS206533")).toBe(206533)
        expect(ParseAsn("as206533")).toBe(206533)
        expect(ParseAsn("206533")).toBe(206533)
        expect(ParseAsn(206533)).toBe(206533)
        expect(ParseAsn("206.533")).toBeNull()
        expect(ParseAsn("")).toBeNull()
        expect(FormatAsn(206533)).toBe("AS206533")
    })

    test("treats an ASN as a network identity, not an address", () => {
        expect(PartnerFor(206533)?.display).toBe("CentrixNodes")
        expect(PartnerFor(64500)).toBeNull()
        expect(PartnerFor(null)).toBeNull()
        expect(IsIp("206533")).toBe(false)
    })

    test("validates IPv4 and IPv6 exit addresses", () => {
        expect(IsIp("104.223.81.20")).toBe(true)
        expect(IsIp("2a13:9500:1d9::20")).toBe(true)
        expect(IsIp("256.1.1.1")).toBe(false)
        expect(IsIp("example.com")).toBe(false)
        expect(IsIp("::ffff:1.2.3.4]")).toBe(false)
    })
})

describe("resolver", () => {
    test("matches an AS206533 IPv4 exit", async () => {
        const { fetcher } = Ripe("104.223.81.20", ["206533"], "104.223.81.0/24")
        const result = await CreateResolver({ provider: RIPESTAT, fetcher }).Resolve(new AbortController().signal)
        expect(result.state).toBe("matched")
        expect(result.partner?.id).toBe("centrixnodes")
        expect(result.asn).toBe(206533)
        expect(result.prefix).toBe("104.223.81.0/24")
    })

    test("matches an AS206533 IPv6 exit and sends only the exit address", async () => {
        const { fetcher, calls } = Ripe("2a13:9500:1d9::20", ["206533"], "2a13:9500:1d9::/48")
        const result = await CreateResolver({ provider: RIPESTAT, fetcher }).Resolve(new AbortController().signal)
        expect(result.state).toBe("matched")
        expect(calls[1]).toBe("https://stat.ripe.net/data/network-info/data.json?resource=2a13%3A9500%3A1d9%3A%3A20")
    })

    test("reports non-partner IPv4 and IPv6 exits", async () => {
        for (const ip of ["203.0.113.9", "2001:db8::9"]) {
            const { fetcher } = Ripe(ip, ["64500"], null)
            const result = await CreateResolver({ provider: RIPESTAT, fetcher }).Resolve(new AbortController().signal)
            expect(result.state).toBe("not-matched")
            expect(result.partner).toBeNull()
            expect(result.asn).toBe(64500)
        }
    })

    test("matches when the partner is one of several origin ASNs", async () => {
        const { fetcher } = Ripe("104.223.81.20", ["64500", "206533"], null)
        const result = await CreateResolver({ provider: RIPESTAT, fetcher }).Resolve(new AbortController().signal)
        expect(result.state).toBe("matched")
    })

    test("caches the network lookup per exit address", async () => {
        const { fetcher, calls } = Ripe("104.223.81.20", ["206533"], null)
        const resolver = CreateResolver({ provider: RIPESTAT, fetcher })
        await resolver.Resolve(new AbortController().signal)
        await resolver.Resolve(new AbortController().signal)
        expect(calls.filter((url) => url.includes("network-info"))).toHaveLength(1)
        expect(calls.filter((url) => url.includes("whats-my-ip"))).toHaveLength(2)
    })

    test("looks the network up again once the cache is stale", async () => {
        let clock = 0
        const { fetcher, calls } = Ripe("104.223.81.20", ["206533"], null)
        const resolver = CreateResolver({ provider: RIPESTAT, fetcher, now: () => clock, ttl: 1000 })
        await resolver.Resolve(new AbortController().signal)
        clock = 1500
        await resolver.Resolve(new AbortController().signal)
        expect(calls.filter((url) => url.includes("network-info"))).toHaveLength(2)
    })

    test("is unavailable when the lookup service fails", async () => {
        const fetcher = vi.fn(async () => Json({ error: "down" }, 503))
        const result = await CreateResolver({ provider: RIPESTAT, fetcher }).Resolve(new AbortController().signal)
        expect(result.state).toBe("unavailable")
        expect(result.partner).toBeNull()
    })

    test("is unavailable when there is no valid public exit address", async () => {
        const { fetcher } = Ripe("not an ip", ["206533"], null)
        const result = await CreateResolver({ provider: RIPESTAT, fetcher }).Resolve(new AbortController().signal)
        expect(result.state).toBe("unavailable")
        expect(result.exit).toBeNull()
    })

    test("times out slow lookups", async () => {
        const result = await CreateResolver({ provider: Hanging(), timeout: 20 }).Resolve(new AbortController().signal)
        expect(result.state).toBe("unavailable")
    })

    test("stops when the VPN disconnects during the lookup", async () => {
        const controller = new AbortController()
        const pending = CreateResolver({ provider: Hanging(), timeout: 5000 }).Resolve(controller.signal)
        controller.abort(new Error("disconnected"))
        await expect(pending).rejects.toThrow("disconnected")
    })
})
