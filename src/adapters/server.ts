import type { Registration, ServerInfo } from "../domain"
import { Count, Flag, Invalid, Port, Fields, Text, Words } from "./values"

const REGISTRATIONS: Registration[] = ["open", "invite", "closed"]

export function ParseInfo(raw: unknown): ServerInfo {
    const record = Fields(raw)
    const endpoint = Text(record.endpoint, 253)
    if (!endpoint) {
        return Invalid()
    }
    const version = Text(record.version, 32)
    return {
        name: Text(record.name, 64) ?? "VeylVPN server",
        endpoint,
        port: Port(record.port),
        protocol: Text(record.proto, 8)?.toLowerCase() ?? "udp",
        stealth: Flag(record.stealth) ? (Port(record.stealth_port) ?? 443) : null,
        platform: Text(record.platform, 16)?.toLowerCase() ?? null,
        version: version && /^[0-9A-Za-z.+-]+$/.test(version) ? version : null,
        registration: REGISTRATIONS.find((item) => item === record.registration) ?? null,
        limit: Count(record.device_limit),
        categories: Words(record.dns_categories),
        defaults: Words(record.dns_default),
        quantum: Flag(record.post_quantum),
    }
}
