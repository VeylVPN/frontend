import { Backend } from "../backend"
import { CreateMachine } from "./machine"

const machine = CreateMachine({ bridge: Backend })

export const connection = machine.state

export const Connect = machine.Connect

export const Disconnect = machine.Disconnect

export const Toggle = machine.Toggle

export const DismissConnection = machine.Dismiss

export const ResetConnection = machine.Reset

export const WakeConnection = machine.Wake

export function IsActive(): boolean {
    return connection.phase === "connected" || connection.phase === "reconnecting"
}
