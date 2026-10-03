<script setup lang="ts">
import { computed, nextTick, onMounted } from "vue"
import { Backend } from "../backend"
import PartnerBadge from "../components/connection/PartnerBadge.vue"
import IconRefresh from "../components/icons/IconRefresh.vue"
import ListGroup from "../components/ui/ListGroup.vue"
import UiCopy from "../components/ui/UiCopy.vue"
import UiSpinner from "../components/ui/UiSpinner.vue"
import { DateText, Host, MaskIp } from "../lib/format"
import { FormatAsn } from "../partners/registry"
import { connection } from "../stores/connection"
import { Go, nav } from "../stores/nav"
import { partner } from "../stores/partner"
import { prefs } from "../stores/prefs"
import { CheckServer, LoadAccount, Refresh, session } from "../stores/session"

const native = Backend().tunnel

const host = computed(() => session.info?.endpoint ?? Host(session.profile?.server ?? ""))

const live = computed(() => connection.phase === "connected" || connection.phase === "reconnecting")

const facts = computed(() => {
    const info = session.info
    if (!info) {
        return []
    }
    const signup = info.registration === "open" ? "Open" : info.registration === "invite" ? "Invite only" : info.registration === "closed" ? "Admin only" : "Unknown"
    return [
        { label: "Protocol", value: `OpenVPN · UDP${info.port ? ` ${info.port}` : ""}` },
        { label: "Fallback", value: info.stealth ? `TCP ${info.stealth}` : "Off" },
        { label: "Post-quantum", value: info.quantum ? "Requested" : "Off" },
        { label: "Server", value: `${info.version ? `v${info.version}` : "Unknown"}${info.platform ? ` · ${info.platform === "windows" ? "Windows" : info.platform === "linux" ? "Linux" : info.platform}` : ""}` },
        { label: "Sign-up", value: signup },
        { label: "Device limit", value: info.limit === null ? "Unknown" : String(info.limit) },
    ]
})

const account = computed(() => {
    const value = session.account
    if (!value) {
        return []
    }
    return [
        { label: "Status", value: value.status === "active" ? "Active" : value.status === "expired" ? "Expired" : "Paused" },
        { label: "Devices", value: `${value.devices} of ${value.limit}` },
        { label: "Created", value: DateText(value.created) },
        { label: "Expires", value: value.expires ? DateText(value.expires) : "Never" },
    ]
})

const exit = computed(() => (partner.exit ? (prefs.conceal ? MaskIp(partner.exit) : partner.exit) : null))

const reach = computed(() => {
    switch (session.reach) {
        case "online":
            return { dot: "bg-ok shadow-[0_0_8px_rgb(84_232_112/0.8)]", text: "Online" }
        case "offline":
            return { dot: "bg-warn", text: "Unreachable" }
        case "checking":
            return { dot: "bg-busy animate-pulse", text: "Checking" }
        default:
            return { dot: "bg-idle", text: "Unknown" }
    }
})

onMounted(async () => {
    void Refresh()
    if (nav.section) {
        await nextTick()
        document.getElementById(`sheet-${nav.section}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
})
</script>

<template>
    <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex h-8 items-center gap-2 rounded-full bg-white/[0.05] px-3 text-small font-semibold text-fg-2">
            <span class="size-1.5 rounded-full" :class="reach.dot" />
            {{ reach.text }}
        </span>
        <span class="tech inline-flex h-8 items-center gap-1 rounded-full bg-white/[0.05] pl-3 pr-1 text-fg-2">
            <span class="selectable truncate">{{ host }}</span>
            <UiCopy :value="host" label="Copy server address" />
        </span>
        <button
            type="button"
            class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-small font-semibold text-fg-3 transition-colors hover:bg-white/[0.05] hover:text-fg"
            :disabled="session.reach === 'checking' || session.accountLoading"
            @click="Refresh()"
        >
            <UiSpinner v-if="session.reach === 'checking' || session.accountLoading" />
            <IconRefresh v-else />
            Refresh
        </button>
    </div>

    <ListGroup title="Connection">
        <dl v-if="facts.length" class="grid grid-cols-2">
            <div v-for="(fact, index) in facts" :key="fact.label" class="px-4 py-3.5" :class="[index % 2 === 1 && 'border-l border-white/[0.055]', index > 1 && 'border-t border-white/[0.055]']">
                <dt class="text-[0.75rem] text-fg-3">{{ fact.label }}</dt>
                <dd class="mt-0.5 font-semibold text-fg">{{ fact.value }}</dd>
            </div>
        </dl>
        <div v-else-if="session.reachError" class="px-4 py-4 text-small text-fg-2">
            <p>{{ session.reachError.message }}</p>
            <button type="button" class="mt-2 font-semibold text-violet-300 hover:text-violet-200" @click="CheckServer()">Try again</button>
        </div>
        <p v-else class="px-4 py-4 text-small text-fg-3">Loading…</p>
    </ListGroup>

    <ListGroup title="Your account">
        <dl v-if="account.length" class="grid grid-cols-2">
            <div v-for="(fact, index) in account" :key="fact.label" class="px-4 py-3.5" :class="[index % 2 === 1 && 'border-l border-white/[0.055]', index > 1 && 'border-t border-white/[0.055]']">
                <dt class="text-[0.75rem] text-fg-3">{{ fact.label }}</dt>
                <dd class="mt-0.5 font-semibold" :class="fact.label === 'Status' && fact.value !== 'Active' ? 'text-warn' : 'text-fg'">{{ fact.value }}</dd>
            </div>
        </dl>
        <div v-else-if="session.accountError" class="px-4 py-4 text-small text-fg-2">
            <p>{{ session.accountError.message }}</p>
            <button type="button" class="mt-2 font-semibold text-violet-300 hover:text-violet-200" @click="LoadAccount()">Try again</button>
        </div>
        <p v-else class="px-4 py-4 text-small text-fg-3">Loading…</p>
    </ListGroup>

    <ListGroup v-if="native" id="sheet-exit" title="Exit network">
        <template v-if="live && exit">
            <div class="flex items-center gap-3 px-4 py-3.5">
                <div class="min-w-0 flex-1">
                    <p class="text-[0.75rem] text-fg-3">VPN exit IP</p>
                    <p class="tech selectable mt-0.5 truncate !text-[0.95rem] text-fg">{{ exit }}</p>
                </div>
                <UiCopy v-if="partner.exit" :value="partner.exit" label="Copy VPN exit IP" />
            </div>
            <div class="flex items-center gap-3 px-4 py-3.5">
                <div class="min-w-0 flex-1">
                    <p class="text-[0.75rem] text-fg-3">Network</p>
                    <p class="tech mt-0.5 !text-[0.95rem] text-fg">{{ FormatAsn(partner.asn) }}<span v-if="partner.prefix" class="text-fg-3"> · {{ partner.prefix }}</span></p>
                </div>
                <PartnerBadge v-if="partner.partner" :partner="partner.partner" compact align="end" />
            </div>
        </template>
        <p v-else-if="!prefs.partner" class="px-4 py-4 text-small text-fg-3">
            Lookup is off.
            <button type="button" class="font-semibold text-violet-300 hover:text-violet-200" @click="Go('settings', 'privacy')">Turn it on</button>
        </p>
        <p v-else-if="partner.state === 'checking'" class="px-4 py-4 text-small text-fg-3">Looking up…</p>
        <p v-else class="px-4 py-4 text-small text-fg-3">{{ live ? "The lookup didn't answer. Your connection is fine." : "Connect to see where your traffic exits." }}</p>
    </ListGroup>
</template>
