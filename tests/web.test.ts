import { describe, expect, test, vi } from "vitest"
import { CreateWebBridge } from "../src/backend/web"
import { FillProfile, GenerateDeviceKey } from "../src/backend/csr"
import { Bytes, Clock, GroupAccount, MaskAccount, MaskIp, ValidDeviceName, ValidServer } from "../src/lib/format"

function Json(body: unknown, status = 200): Response {
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

describe("web bridge", () => {
    test("uses a bearer token and refreshes it once when the server revokes it", async () => {
        let issued = 0
        const seen: string[] = []
        const fetcher = vi.fn(async (path: string | URL | Request, init?: RequestInit) => {
            const url = String(path)
            const auth = new Headers(init?.headers).get("Authorization") ?? ""
            seen.push(`${init?.method} ${url} ${auth}`)
            if (url === "/v1/auth/token") {
                issued++
                return Json({ access_token: `vey_${issued}`, expires_at: "2026-10-02T13:00:00Z" })
            }
            if (url === "/v1/me/devices" && auth === "Bearer vey_1" && issued === 1 && seen.filter((line) => line.includes("/v1/me/devices")).length > 1) {
                return Json({ error: "invalid access token", code: "INVALID_ACCESS_TOKEN" }, 401)
            }
            return Json({ limit: 5, devices: [] })
        })
        const bridge = CreateWebBridge(fetcher as typeof fetch, () => "vpn.example.com")
        await bridge.Check("", "1234567812345678", "a long passphrase")
        await bridge.Devices()
        expect(issued).toBe(2)
        expect(seen.at(-1)).toBe("GET /v1/me/devices Bearer vey_2")
    })

    test("surfaces the server error envelope", async () => {
        const fetcher = vi.fn(async () => Json({ error: "invalid credentials", code: "INVALID_CREDENTIALS" }, 401))
        const bridge = CreateWebBridge(fetcher as typeof fetch)
        await expect(bridge.Check("", "1234567812345678", "wrong password")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 })
        await expect(bridge.Account()).rejects.toMatchObject({ code: "NOT_SIGNED_IN" })
    })

    test("forgets credentials on sign out", async () => {
        const fetcher = vi.fn(async (path: string | URL | Request) => (String(path) === "/v1/auth/token" ? Json({ access_token: "vey_1" }) : Json({ limit: 5, devices: [] })))
        const bridge = CreateWebBridge(fetcher as typeof fetch, () => "vpn.example.com")
        await bridge.Check("", "1234567812345678", "a long passphrase")
        expect(await bridge.Profile()).toEqual({ server: "vpn.example.com", account: "1234567812345678", device_id: "" })
        await bridge.SignOut(false)
        expect(await bridge.Profile()).toBeNull()
    })
})

describe("device keys", () => {
    test("generates a P-256 key and certificate request in the browser", async () => {
        const material = await GenerateDeviceKey()
        expect(material.csr).toMatch(/^-----BEGIN CERTIFICATE REQUEST-----\n/)
        expect(material.key).toMatch(/^-----BEGIN PRIVATE KEY-----\n/)
    })

    test("fills the private key placeholder line", () => {
        const out = FillProfile("client\n<key>\n__PRIVATE_KEY__\n</key>\n", "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n")
        expect(out).toContain("<key>\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n</key>")
        expect(() => FillProfile("client\n", "k")).toThrow()
    })
})

describe("format", () => {
    test("formats sizes, clocks and account numbers", () => {
        expect(Bytes(0)).toBe("0 B")
        expect(Bytes(1536)).toBe("1.50 KB")
        expect(Bytes(1.24 * 1024 ** 3)).toBe("1.24 GB")
        expect(Clock(6138000)).toBe("01:42:18")
        expect(GroupAccount("1234567812345678")).toBe("1234 5678 1234 5678")
        expect(MaskAccount("1234567812345678")).toBe("•••• •••• •••• 5678")
        expect(MaskIp("104.223.81.20")).toBe("•••.•••.•••.•••")
        expect(MaskIp("2a13:9500::1")).toContain("••••")
    })

    test("validates user input", () => {
        expect(ValidServer("vpn.example.com")).toBe(true)
        expect(ValidServer("203-0-113-5.sslip.io")).toBe(true)
        expect(ValidServer("https://vpn.example.com/")).toBe(true)
        expect(ValidServer("vpn.example.com/v1?x")).toBe(false)
        expect(ValidDeviceName("Pixel 8")).toBe(true)
        expect(ValidDeviceName("")).toBe(false)
        expect(ValidDeviceName("a".repeat(33))).toBe(false)
        expect(ValidDeviceName("bad\u0007name")).toBe(false)
    })
})
