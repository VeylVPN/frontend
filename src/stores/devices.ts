import { reactive } from "vue"
import { ParseDevice, ParseDevices } from "../adapters/devices"
import { Describe } from "../adapters/errors"
import { Backend } from "../backend"
import type { Device, VpnError } from "../domain"
import { session } from "./session"

export type DevicesStatus = "idle" | "loading" | "ready" | "error"

export const devices = reactive({
    list: [] as Device[],
    limit: 0,
    status: "idle" as DevicesStatus,
    error: null as VpnError | null,
})

export function IsCurrent(id: string): boolean {
    return Boolean(session.profile?.device && session.profile.device === id)
}

export async function LoadDevices(): Promise<void> {
    if (devices.status === "loading") {
        return
    }
    devices.status = devices.list.length ? "ready" : "loading"
    try {
        const result = ParseDevices(await Backend().Devices())
        devices.list = result.devices
        devices.limit = result.limit
        devices.status = "ready"
        devices.error = null
        const own = session.profile?.device
        session.orphaned = Boolean(own && Backend().mode === "native" && !result.devices.some((device) => device.id === own))
    } catch (error) {
        devices.error = Describe(error)
        devices.status = devices.list.length ? "ready" : "error"
    }
}

export async function AddDevice(name: string): Promise<string> {
    const profile = await Backend().Enroll(name.trim())
    void LoadDevices()
    return profile
}

export async function RenameDevice(id: string, name: string): Promise<void> {
    const updated = ParseDevice(await Backend().Rename(id, name.trim()))
    const index = devices.list.findIndex((device) => device.id === id)
    if (index >= 0) {
        devices.list[index] = updated
    }
}

export async function RemoveDevice(id: string): Promise<void> {
    await Backend().Remove(id)
    devices.list = devices.list.filter((device) => device.id !== id)
}

export function ResetDevices() {
    devices.list = []
    devices.limit = 0
    devices.status = "idle"
    devices.error = null
}
