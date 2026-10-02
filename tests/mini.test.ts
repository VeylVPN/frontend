import { describe, expect, test } from "vitest"
import { EMPTY_SNAPSHOT, ParseRequest, ParseSnapshot } from "../src/mini/types"

describe("mini player link", () => {
    test("accepts only known requests", () => {
        expect(ParseRequest({ kind: "ready" })).toEqual({ kind: "ready" })
        expect(ParseRequest({ kind: "open", page: "devices" })).toEqual({ kind: "open", page: "devices" })
        expect(ParseRequest({ kind: "open", page: "billing" })).toBeNull()
        expect(ParseRequest({ kind: "connect" })).toBeNull()
        expect(ParseRequest("ready")).toBeNull()
        expect(ParseRequest(null)).toBeNull()
    })

    test("reads a full snapshot", () => {
        const snapshot = { signed: true, tunnel: true, phase: "connected", since: 1700000000000, name: "Frankfurt", partner: "CentrixNodes", down: 2048, up: 512, error: null, motion: true }
        expect(ParseSnapshot(snapshot)).toEqual(snapshot)
    })

    test("falls back safely on malformed snapshots", () => {
        expect(ParseSnapshot(undefined)).toEqual(EMPTY_SNAPSHOT)
        const parsed = ParseSnapshot({ signed: "yes", phase: "exploded", since: -4, down: Number.NaN, up: "9", name: 42, motion: false })
        expect(parsed.signed).toBe(false)
        expect(parsed.phase).toBe("idle")
        expect(parsed.since).toBeNull()
        expect(parsed.down).toBe(0)
        expect(parsed.up).toBe(0)
        expect(parsed.name).toBe("")
        expect(parsed.motion).toBe(false)
    })

    test("clips long text", () => {
        expect(ParseSnapshot({ name: "x".repeat(500) }).name).toHaveLength(120)
    })
})
