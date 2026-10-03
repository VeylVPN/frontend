<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { Backend } from "../../backend"
import { Host, MaskIp } from "../../lib/format"
import { FormatAsn } from "../../partners/registry"
import { connection } from "../../stores/connection"
import { nav } from "../../stores/nav"
import { partner } from "../../stores/partner"
import { prefs } from "../../stores/prefs"
import { session } from "../../stores/session"
import UiCopy from "../ui/UiCopy.vue"
import IconChevronDown from "../icons/IconChevronDown.vue"
import ListGroup from "../ui/ListGroup.vue"

const VERSION = __APP_VERSION__

const bridge = Backend()
const installed = ref<boolean | null>(null)
const open = ref(nav.section === "diagnostics")

const PARTNER_STATES: Record<string, string> = {
    idle: "Not run",
    checking: "Checking",
    matched: "Partner network",
    "not-matched": "Not a partner network",
    unavailable: "Unavailable",
}

function Address(value: string | null): string {
    if (!value) {
        return "Unknown"
    }
    return prefs.conceal ? MaskIp(value) : value
}

const rows = computed(() => {
    const info = session.info
    const account = session.account
    const list: [string, string][] = [
        ["App", `VeylVPN ${VERSION} (${bridge.mode === "native" ? "Windows app" : "web client"})`],
        ["Server", `${Host(session.profile?.server ?? "")} · ${session.reach}${session.reachError ? ` · ${session.reachError.code || "error"}` : ""}`],
        ["Server version", info ? `${info.version ?? "unknown"} · ${info.platform ?? "unknown platform"} · sign-up ${info.registration ?? "unknown"}` : "Not loaded"],
        ["Tunnel settings", info ? `${info.protocol} ${info.port ?? "?"} · TCP fallback ${info.stealth ?? "off"} · post-quantum ${info.quantum ? "requested" : "off"}` : "Not loaded"],
        ["Account", account ? `${account.status} · ${account.devices}/${account.limit} devices · blocking ${account.custom ? "custom" : "default"} (${account.blocking.join(", ") || "none"})` : (session.accountError?.code ?? "Not loaded")],
    ]
    if (bridge.tunnel) {
        list.push(
            ["Connection", `${connection.phase} · backend reports ${connection.detail}${connection.polled ? ` at ${new Date(connection.polled).toLocaleTimeString()}` : ""}`],
            ["OpenVPN client", installed.value === null ? "Checking" : installed.value ? "Installed" : "Not installed yet (installed on first connect)"],
            ["Last error", connection.error ? connection.error.detail : "None"],
            ["Partner detection", prefs.partner ? `${PARTNER_STATES[partner.state] ?? partner.state}${partner.reason ? ` · ${partner.reason}` : ""}` : "Off"],
            ["VPN exit IP", Address(partner.exit)],
            ["Origin ASN", partner.asn === null ? "Unknown" : `${FormatAsn(partner.asn)}${partner.prefix ? ` · ${partner.prefix}` : ""}`],
            ["Partner match", partner.partner ? `Yes · ${partner.partner.display}` : partner.state === "not-matched" ? "No" : "Unknown"],
        )
    }
    return list
})

const report = computed(() => rows.value.map(([label, value]) => `${label}: ${value}`).join("\n"))

onMounted(async () => {
    if (bridge.tunnel) {
        installed.value = await bridge.Installed()
    }
})
</script>

<template>
    <ListGroup id="sheet-diagnostics" title="Diagnostics" hint="Never includes your account number, password or keys.">
        <template #aside>
            <UiCopy :value="report" label="Copy diagnostics" text />
        </template>
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left text-small font-semibold text-fg-2 transition-colors hover:text-fg" :aria-expanded="open" @click="open = !open">
            {{ open ? "Hide details" : "Show details" }}
            <IconChevronDown class="transition-transform duration-300 ease-veil" :class="open && 'rotate-180'" />
        </button>
        <Transition name="collapse">
            <dl v-if="open" class="px-4 pb-3">
                <div v-for="[label, value] in rows" :key="label" class="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5">
                    <dt class="text-[0.75rem] text-fg-3">{{ label }}</dt>
                    <dd class="tech selectable break-words !text-[0.75rem] text-fg-2">{{ value }}</dd>
                </div>
            </dl>
        </Transition>
    </ListGroup>
</template>
