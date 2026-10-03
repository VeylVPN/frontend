import { describe, expect, test } from "vitest"
import { ParseAccount, ParseAccountNumber, ParseBlocking, ParseProfile } from "../src/adapters/account"
import { ParseStatus } from "../src/adapters/connection"
import { ParseDevices } from "../src/adapters/devices"
import { ParseInfo } from "../src/adapters/server"

describe("ParseInfo", () => {
    test("maps the documented /v1/info response", () => {
        const info = ParseInfo({
            endpoint: "vpn.example.com",
            port: 1194,
            proto: "udp",
            stealth: true,
            stealth_port: 443,
            platform: "linux",
            name: "Veyl",
            version: "0.2.0",
            registration: "invite",
            device_limit: 5,
            dns_categories: ["ads", "trackers", "malware", "adult", "gambling", "social"],
            dns_default: ["ads", "trackers", "malware"],
            post_quantum: true,
            app_url: "https://github.com/VeylVPN/frontend/releases/latest",
        })
        expect(info).toEqual({
            name: "Veyl",
            endpoint: "vpn.example.com",
            port: 1194,
            protocol: "udp",
            stealth: 443,
            platform: "linux",
            version: "0.2.0",
            registration: "invite",
            limit: 5,
            categories: ["ads", "trackers", "malware", "adult", "gambling", "social"],
            defaults: ["ads", "trackers", "malware"],
            quantum: true,
        })
    })

    test("treats stealth without a port as 443 and drops unknown values", () => {
        const info = ParseInfo({ endpoint: "vpn.example.com", stealth: true, registration: "everyone", version: "<b>1</b>", port: 99999 })
        expect(info.stealth).toBe(443)
        expect(info.registration).toBeNull()
        expect(info.version).toBeNull()
        expect(info.port).toBeNull()
    })

    test("rejects a response without an endpoint", () => {
        expect(() => ParseInfo({ name: "x" })).toThrow("Invalid server response")
        expect(() => ParseInfo("nope")).toThrow("Invalid server response")
    })
})

describe("ParseStatus", () => {
    test("maps tunnel states and counters", () => {
        expect(ParseStatus({ state: "connected", rx: 10, tx: 20 })).toEqual({ state: "connected", received: 10, sent: 20 })
        expect(ParseStatus({ state: "off", rx: -5, tx: "x" })).toEqual({ state: "off", received: 0, sent: 0 })
        expect(() => ParseStatus({ state: "HANDSHAKE_WAIT" })).toThrow()
    })
})

describe("ParseDevices", () => {
    test("reads legacy unix timestamps and token API dates", () => {
        const legacy = ParseDevices({ limit: 5, devices: [{ id: "ab", name: "pc", created: 1757808000, online: true }] })
        expect(legacy.devices[0]?.created?.toISOString()).toBe("2025-09-14T00:00:00.000Z")
        const modern = ParseDevices({ limit: 5, devices: [{ id: "cd", name: "Quiet Otter", created: "2026-09-14T00:00:00Z", online: false }] })
        expect(modern.devices[0]?.created?.toISOString()).toBe("2026-09-14T00:00:00.000Z")
        expect(modern.devices[0]?.online).toBe(false)
    })

    test("strips control characters from untrusted names", () => {
        const list = ParseDevices({ limit: 5, devices: [{ id: "ab", name: "pc\u0007\u001b[31m" }] })
        expect(list.devices[0]?.name).toBe("pc[31m")
    })
})

describe("account parsing", () => {
    test("maps /v1/me", () => {
        const account = ParseAccount({
            id: "3f9a1c2b7d4e",
            created: "2026-09-14T00:00:00Z",
            expires: null,
            device_limit: 5,
            devices: 2,
            dns_blocking: ["ads", "trackers", "malware"],
            dns_custom: false,
            status: "active",
        })
        expect(account.status).toBe("active")
        expect(account.expires).toBeNull()
        expect(account.blocking).toEqual(["ads", "trackers", "malware"])
    })

    test("maps DNS updates and empty blocking", () => {
        expect(ParseBlocking({ dns_blocking: [], dns_custom: true })).toEqual({ blocking: [], custom: true })
        expect(() => ParseBlocking({ dns_custom: true })).toThrow()
    })

    test("reads the native profile and account numbers", () => {
        expect(ParseProfile(null)).toBeNull()
        expect(ParseProfile({ server: "vpn.example.com", account: "1234567812345678", device_id: "9c1e" })).toEqual({
            server: "vpn.example.com",
            account: "1234567812345678",
            device: "9c1e",
        })
        expect(() => ParseProfile({ server: "vpn.example.com", account: "12" })).toThrow()
        expect(ParseAccountNumber("1234 5678 1234 5678")).toBe("1234567812345678")
        expect(() => ParseAccountNumber({ account: "1" })).toThrow()
    })
})
