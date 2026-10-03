import type { Account, AccountStatus, Blocking, Profile } from "../domain"
import { Count, Flag, Invalid, Moment, Fields, Text, Words } from "./values"

const STATUSES: AccountStatus[] = ["active", "expired", "disabled"]

export function ParseAccount(raw: unknown): Account {
    const record = Fields(raw)
    const id = Text(record.id, 64)
    const status = STATUSES.find((item) => item === record.status)
    if (!id || !status) {
        return Invalid()
    }
    return {
        id,
        created: Moment(record.created),
        expires: Moment(record.expires),
        limit: Count(record.device_limit) ?? 0,
        devices: Count(record.devices) ?? 0,
        blocking: Words(record.dns_blocking),
        custom: Flag(record.dns_custom),
        status,
    }
}

export function ParseBlocking(raw: unknown): Blocking {
    const record = Fields(raw)
    if (!Array.isArray(record.dns_blocking)) {
        return Invalid()
    }
    return { blocking: Words(record.dns_blocking), custom: Flag(record.dns_custom) }
}

export function ParseProfile(raw: unknown): Profile | null {
    if (raw === null || raw === undefined) {
        return null
    }
    const record = Fields(raw)
    const server = Text(record.server, 260)
    const account = Text(record.account, 32)
    if (!server || !account || !/^\d{16}$/.test(account)) {
        return Invalid()
    }
    return { server, account, device: Text(record.device_id, 64) ?? "" }
}

export function ParseAccountNumber(raw: unknown): string {
    const number = typeof raw === "string" ? raw.replace(/\s/g, "") : ""
    return /^\d{16}$/.test(number) ? number : Invalid()
}
