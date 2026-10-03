import type { Device, DeviceList } from "../domain"
import { Count, Flag, Invalid, Moment, Fields, Text } from "./values"

export function ParseDevice(raw: unknown): Device {
    const record = Fields(raw)
    const id = Text(record.id, 64)
    if (!id) {
        return Invalid()
    }
    return {
        id,
        name: Text(record.name, 64) ?? "Unnamed device",
        created: Moment(record.created),
        online: Flag(record.online),
    }
}

export function ParseDevices(raw: unknown): DeviceList {
    const record = Fields(raw)
    if (!Array.isArray(record.devices)) {
        return Invalid()
    }
    return {
        limit: Count(record.limit) ?? 0,
        devices: record.devices.slice(0, 256).map(ParseDevice),
    }
}
