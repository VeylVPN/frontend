import { describe, expect, test } from "vitest"
import { CodeFor, Describe } from "../src/adapters/errors"
import { BridgeError } from "../src/backend/bridge"

describe("Describe", () => {
    test("branches on the server error code", () => {
        const error = Describe({ code: "MAX_DEVICES_REACHED", message: "device limit reached", status: 409 })
        expect(error.kind).toBe("LIMIT_ERROR")
        expect(error.title).toBe("Device limit reached")
        expect(error.detail).toBe("MAX_DEVICES_REACHED · HTTP 409 · device limit reached")
    })

    test("maps legacy string errors from the Rust core", () => {
        expect(Describe("invalid credentials").kind).toBe("AUTHENTICATION_ERROR")
        expect(Describe("Cannot reach that server").kind).toBe("SERVICE_UNAVAILABLE")
        expect(Describe("Too many attempts, try again later").kind).toBe("RATE_LIMITED")
        expect(Describe("registration is closed").code).toBe("REGISTRATION_CLOSED")
        expect(Describe("account or invite required").code).toBe("INVITE_REQUIRED")
    })

    test("maps connect failures without hiding the raw message", () => {
        const error = Describe("Could not enable the kill switch. Run Veyl as administrator.")
        expect(error.kind).toBe("PERMISSION_ERROR")
        expect(error.title).toBe("Couldn't turn on the kill switch")
        expect(error.detail).toContain("Run Veyl as administrator")
        expect(Describe("Could not connect. Run Veyl as administrator.").kind).toBe("TUNNEL_ERROR")
        expect(Describe("OpenVPN download failed verification").code).toBe("OPENVPN_VERIFY")
        expect(Describe("Could not download OpenVPN").kind).toBe("NETWORK_ERROR")
    })

    test("falls back to an unknown error with technical details", () => {
        const error = Describe(new BridgeError("", "Access is denied. (os error 5)"))
        expect(error.kind).toBe("UNKNOWN_ERROR")
        expect(error.detail).toBe("Access is denied. (os error 5)")
        expect(CodeFor("", "something new")).toBe("")
    })
})
