<script setup lang="ts">
import { computed, onMounted } from "vue"
import { Backend } from "../backend"
import PartnerBadge from "../components/connection/PartnerBadge.vue"
import IconRefresh from "../components/icons/IconRefresh.vue"
import UiBadge from "../components/ui/UiBadge.vue"
import UiButton from "../components/ui/UiButton.vue"
import UiCopy from "../components/ui/UiCopy.vue"
import UiNotice from "../components/ui/UiNotice.vue"
import UiPanel from "../components/ui/UiPanel.vue"
import UiRow from "../components/ui/UiRow.vue"
import { DateText, Host, MaskIp } from "../lib/format"
import { FormatAsn } from "../partners/registry"
import { connection } from "../stores/connection"
import { Go } from "../stores/nav"
import { partner } from "../stores/partner"
import { prefs } from "../stores/prefs"
import { CheckServer, LoadAccount, Refresh, session } from "../stores/session"

const native = Backend().tunnel

const host = computed(() => session.info?.endpoint ?? Host(session.profile?.server ?? ""))

const registration = computed(() => {
    switch (session.info?.registration) {
        case "open":
            return { label: "Open", text: "Anyone with the address can create an account." }
        case "invite":
            return { label: "Invite only", text: "New accounts need an invite code or an account number from the admin." }
        case "closed":
            return { label: "Closed", text: "Only account numbers made by the admin can be claimed." }
        default:
            return null
    }
})

const status = computed(() => {
    switch (session.account?.status) {
        case "active":
            return { label: "Active", tone: "ok" as const }
        case "expired":
            return { label: "Expired", tone: "warn" as const }
        case "disabled":
            return { label: "Paused", tone: "danger" as const }
        default:
            return null
    }
})

const exit = computed(() => (partner.exit ? (prefs.conceal ? MaskIp(partner.exit) : partner.exit) : null))

const reach = computed(() => {
    switch (session.reach) {
        case "online":
            return { label: "Online", tone: "ok" as const }
        case "offline":
            return { label: "Unreachable", tone: "warn" as const }
        case "checking":
            return { label: "Checking", tone: "neutral" as const }
        default:
            return { label: "Unknown", tone: "neutral" as const }
    }
})

onMounted(() => {
    void Refresh()
})
</script>

<template>
    <div class="mx-auto w-full max-w-[860px] px-[clamp(1.25rem,3vw,2.5rem)] py-8">
        <header class="flex flex-wrap items-end justify-between gap-4">
            <div class="min-w-0">
                <div class="flex items-center gap-3">
                    <h1 class="truncate text-heading font-bold text-fg">{{ session.info?.name ?? "Your server" }}</h1>
                    <UiBadge :tone="reach.tone">{{ reach.label }}</UiBadge>
                </div>
                <p class="tech mt-1.5 flex items-center gap-1 text-fg-2">
                    <span class="selectable truncate">{{ host }}</span>
                    <UiCopy :value="host" label="Copy server address" />
                </p>
            </div>
            <UiButton variant="ghost" size="sm" :loading="session.reach === 'checking' || session.accountLoading" @click="Refresh()">
                <IconRefresh v-if="session.reach !== 'checking' && !session.accountLoading" />
                Check again
            </UiButton>
        </header>

        <div class="mt-6 flex flex-col gap-4">
            <UiNotice v-if="session.reach === 'offline' && session.reachError" tone="warn" :title="session.reachError.title">
                {{ session.reachError.message }}
                <template #actions>
                    <UiButton size="sm" @click="CheckServer()">Try again</UiButton>
                </template>
            </UiNotice>

            <UiPanel v-if="session.info" title="Connection" description="What your server tells the app about its tunnels.">
                <UiRow label="Protocol" :description="`OpenVPN over ${session.info.protocol.toUpperCase()}${session.info.port ? `, port ${session.info.port}` : ''}.`">
                    <UiBadge tone="violet">OpenVPN</UiBadge>
                </UiRow>
                <UiRow
                    label="TCP fallback"
                    :description="
                        session.info.stealth
                            ? `When a network blocks UDP, the app falls back to TCP port ${session.info.stealth}${session.info.platform === 'windows' ? '' : ', where the tunnel looks like ordinary HTTPS'}.`
                            : 'Off. The app only uses UDP on this server.'
                    "
                >
                    <UiBadge :tone="session.info.stealth ? 'ok' : 'neutral'">{{ session.info.stealth ? `TCP ${session.info.stealth}` : "Off" }}</UiBadge>
                </UiRow>
                <UiRow
                    label="Post-quantum key exchange"
                    :description="session.info.quantum ? 'Requested by the server. The hybrid X25519 + ML-KEM-768 exchange is used when the server\'s OpenSSL supports it.' : 'Not requested by the server.'"
                >
                    <UiBadge :tone="session.info.quantum ? 'violet' : 'neutral'">{{ session.info.quantum ? "Requested" : "Off" }}</UiBadge>
                </UiRow>
                <UiRow label="Server software" :description="session.info.platform === 'windows' ? 'Running on Windows.' : session.info.platform === 'linux' ? 'Running on Linux.' : 'Platform not reported.'">
                    <span class="tech text-fg-2">{{ session.info.version ? `v${session.info.version}` : "Unknown" }}</span>
                </UiRow>
            </UiPanel>
            <div v-else-if="session.reach === 'checking'" class="h-52 rounded-lg border border-line bg-surface-1/60" aria-hidden="true" />

            <UiNotice v-if="session.info?.platform === 'windows'" tone="info" title="This server runs on Windows">
                IPv6 inside the tunnel is off, and Windows doesn't filter forwarded traffic the way the Linux firewall does. The server's README explains these limits.
            </UiNotice>

            <UiPanel title="Your account" description="Your account number never leaves this computer except to sign in.">
                <template #aside>
                    <UiBadge v-if="status" :tone="status.tone">{{ status.label }}</UiBadge>
                </template>
                <template v-if="session.account">
                    <UiRow label="Account ID" description="An opaque ID your server's admin sees. It is not your account number.">
                        <span class="tech text-fg-2">{{ session.account.id }}</span>
                    </UiRow>
                    <UiRow label="Created" description="Rounded to the day on purpose.">
                        <span class="text-small text-fg-2">{{ DateText(session.account.created) }}</span>
                    </UiRow>
                    <UiRow label="Expires">
                        <span class="text-small text-fg-2">{{ session.account.expires ? DateText(session.account.expires) : "Never" }}</span>
                    </UiRow>
                    <UiRow label="Devices">
                        <button type="button" class="text-small font-semibold text-violet-300 hover:text-violet-200" @click="Go('devices')">{{ session.account.devices }} of {{ session.account.limit }}</button>
                    </UiRow>
                </template>
                <div v-else-if="session.accountError" class="px-5 pb-4 pt-2">
                    <p class="text-small text-fg-2"><span class="font-semibold text-fg">{{ session.accountError.title }}.</span> {{ session.accountError.message }}</p>
                    <UiButton class="mt-3" size="sm" :loading="session.accountLoading" @click="LoadAccount()">Try again</UiButton>
                </div>
                <p v-else class="px-5 pb-4 pt-2 text-small text-fg-3">Loading account details…</p>
            </UiPanel>

            <UiPanel v-if="registration" title="Sign-up">
                <UiRow label="New accounts" :description="registration.text">
                    <UiBadge>{{ registration.label }}</UiBadge>
                </UiRow>
            </UiPanel>

            <UiPanel v-if="native" title="Exit network" description="Where your traffic appears to come from while connected.">
                <template v-if="exit && (connection.phase === 'connected' || connection.phase === 'reconnecting')">
                    <UiRow label="VPN exit IP" description="The address websites see.">
                        <span class="tech selectable text-fg-2">{{ exit }}</span>
                        <UiCopy v-if="partner.exit" :value="partner.exit" label="Copy VPN exit IP" />
                    </UiRow>
                    <UiRow label="Network" :description="partner.prefix ? `Announced as ${partner.prefix}.` : ''">
                        <span class="tech text-fg-2">{{ FormatAsn(partner.asn) }}</span>
                    </UiRow>
                    <UiRow label="Infrastructure" :description="partner.partner ? 'Recognized VeylVPN partner network.' : 'Not a recognized partner network.'">
                        <PartnerBadge v-if="partner.partner" :partner="partner.partner" compact align="end" />
                        <span v-else class="text-small text-fg-3">Standard</span>
                    </UiRow>
                </template>
                <p v-else-if="!prefs.partner" class="px-5 pb-4 pt-2 text-small text-fg-3">
                    Network lookup is off.
                    <button type="button" class="font-semibold text-violet-300 hover:text-violet-200" @click="Go('settings', 'privacy')">Change in Settings</button>
                </p>
                <p v-else-if="partner.state === 'checking'" class="px-5 pb-4 pt-2 text-small text-fg-3">Looking up your exit network…</p>
                <p v-else-if="partner.state === 'unavailable' && connection.phase === 'connected'" class="px-5 pb-4 pt-2 text-small text-fg-3">The network lookup didn't answer. The connection itself is fine.</p>
                <p v-else class="px-5 pb-4 pt-2 text-small text-fg-3">Connect to see which network your traffic leaves from.</p>
            </UiPanel>
        </div>
    </div>
</template>
