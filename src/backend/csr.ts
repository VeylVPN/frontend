const ENCODER = new TextEncoder()

const KEY_PLACEHOLDER = "__PRIVATE_KEY__"

function Concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
    let offset = 0
    for (const part of parts) {
        out.set(part, offset)
        offset += part.length
    }
    return out
}

function Length(size: number): Uint8Array<ArrayBuffer> {
    if (size < 128) {
        return Uint8Array.of(size)
    }
    const bytes: number[] = []
    let rest = size
    while (rest > 0) {
        bytes.unshift(rest & 0xff)
        rest >>= 8
    }
    return Uint8Array.of(0x80 | bytes.length, ...bytes)
}

function Der(tag: number, ...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const body = Concat(...parts)
    return Concat(Uint8Array.of(tag), Length(body.length), body)
}

function Integer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0) {
        start++
    }
    let value = Concat(bytes.slice(start))
    if ((value[0] ?? 0) & 0x80) {
        value = Concat(Uint8Array.of(0), value)
    }
    return Der(0x02, value)
}

function Signature(raw: Uint8Array): Uint8Array<ArrayBuffer> {
    return Der(0x30, Integer(raw.slice(0, 32)), Integer(raw.slice(32)))
}

function Pem(label: string, bytes: Uint8Array): string {
    let binary = ""
    for (const byte of bytes) {
        binary += String.fromCharCode(byte)
    }
    const body = (btoa(binary).match(/.{1,64}/g) ?? []).join("\n")
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`
}

export function SupportsKeys(): boolean {
    return Boolean(globalThis.crypto?.subtle)
}

export async function GenerateDeviceKey(): Promise<{ csr: string; key: string }> {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey))
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey))
    const subject = Der(0x30, Der(0x31, Der(0x30, Uint8Array.of(0x06, 0x03, 0x55, 0x04, 0x03), Der(0x0c, ENCODER.encode("veyl")))))
    const info = Der(0x30, Uint8Array.of(0x02, 0x01, 0x00), subject, spki, Uint8Array.of(0xa0, 0x00))
    const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, info))
    const algorithm = Der(0x30, Uint8Array.of(0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02))
    const signature = Der(0x03, Uint8Array.of(0), Signature(raw))
    return {
        csr: Pem("CERTIFICATE REQUEST", Der(0x30, info, algorithm, signature)),
        key: Pem("PRIVATE KEY", pkcs8),
    }
}

export function FillProfile(profile: string, key: string): string {
    const lines = profile.split("\n")
    const index = lines.findIndex((line) => line.trim() === KEY_PLACEHOLDER)
    if (index < 0) {
        throw new Error("Invalid profile from server")
    }
    lines[index] = key.trim()
    return lines.join("\n")
}
