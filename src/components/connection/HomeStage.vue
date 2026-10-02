<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { Backend } from "../../backend"
import type { GlobeTone } from "../../domain"
import { useTween } from "../../composables/tween"
import { Bytes, Clock, DateText, Host, MaskIp, Rate } from "../../lib/format"
import { FormatAsn } from "../../partners/registry"
import { Connect, connection, Disconnect, DismissConnection, Toggle } from "../../stores/connection"
import { Go } from "../../stores/nav"
import { partner } from "../../stores/partner"
import { prefs } from "../../stores/prefs"
import { CheckServer, NeedsSignIn, SignOut, session } from "../../stores/session"
import { Notify } from "../../stores/toasts"
import AddDeviceDialog from "../devices/AddDeviceDialog.vue"
import IconAlert from "../icons/IconAlert.vue"
import IconArrowDown from "../icons/IconArrowDown.vue"
import IconArrowUp from "../icons/IconArrowUp.vue"
import IconChevronRight from "../icons/IconChevronRight.vue"
import IconDevices from "../icons/IconDevices.vue"
import IconFilter from "../icons/IconFilter.vue"
import IconGlobe from "../icons/IconGlobe.vue"
import IconInfo from "../icons/IconInfo.vue"
import IconPartner from "../icons/IconPartner.vue"
import IconPower from "../icons/IconPower.vue"
import IconShield from "../icons/IconShield.vue"
import IconX from "../icons/IconX.vue"
import ConnectOrb from "./ConnectOrb.vue"
import ConnectionTimer from "./ConnectionTimer.vue"
import PartnerBadge from "./PartnerBadge.vue"
import PixelGlobe from "./PixelGlobe.vue"
import QuickCard from "./QuickCard.vue"

type Message = { key: string; tone: "info" | "warn" | "fail"; text: string; action?: { label: string; run: () => void } }

const native = Backend().tunnel
const now = ref(Date.now())
const burst = ref(0)
const adding = ref(false)
const leaving = ref(false)
let ticker: ReturnType<typeof setInterval> | undefined

const host = computed(() => session.info?.endpoint ?? Host(session.profile?.server ?? ""))
const name = computed(() => session.info?.name ?? host.value)
const live = computed(() => connection.phase === "connected" || connection.phase === "reconnecting")

const tone = computed<GlobeTone>(() => {
    if (!native) {
        return "on"
    }
    switch (connection.phase) {
        case "connected":
            return "on"
        case "connecting":
        case "reconnecting":
            return "busy"
        case "error":
            return "fail"
        default:
            return "idle"
    }
})

const orb = computed(() => {
    if (!native) {
        return { label: "New profile", action: "Create an OpenVPN profile for a device", tone: "idle" as GlobeTone }
    }
    switch (connection.phase) {
        case "connecting":
            return { label: "Connecting", action: "Cancel connection", tone: tone.value }
        case "connected":
            return { label: "Connected", action: `Disconnect from ${name.value}`, tone: tone.value }
        case "reconnecting":
            return { label: "Reconnecting", action: `Disconnect from ${name.value}`, tone: tone.value }
        case "disconnecting":
            return { label: "Disconnecting", action: "Disconnecting", tone: tone.value }
        case "error":
            return { label: "Try again", action: `Try connecting to ${name.value} again`, tone: tone.value }
        default:
            return { label: "Connect", action: `Connect to ${name.value}`, tone: tone.value }
    }
})

const status = computed(() => {
    switch (connection.phase) {
        case "connected":
            return { dot: "bg-on shadow-[0_0_10px_rgb(84_232_112/0.9)]", text: "Protected" }
        case "connecting":
            return { dot: "bg-busy animate-pulse", text: "Connecting" }
        case "reconnecting":
            return { dot: "bg-busy animate-pulse", text: "Reconnecting" }
        case "error":
            return { dot: "bg-fail", text: "Not connected" }
        default:
            return { dot: "bg-idle", text: "Not connected" }
    }
})

const elapsed = computed(() => Clock(connection.since && live.value ? now.value - connection.since : 0))

const clock = computed(() => (live.value ? "live" : connection.phase === "connecting" ? "busy" : "idle"))

async function Restart() {
    leaving.value = true
    try {
        await SignOut(false)
    } catch {
        Notify("Couldn't sign out", "error")
    } finally {
        leaving.value = false
    }
}

const message = computed<Message | null>(() => {
    if (!native) {
        return null
    }
    const phase = connection.phase
    if (phase === "error" && connection.error) {
        return { key: `error-${connection.error.code}`, tone: "fail", text: `${connection.error.title}. ${connection.error.message}`, action: { label: "Details", run: () => Go("settings", "diagnostics") } }
    }
    if (phase === "connecting" && connection.installing) {
        return { key: "installing", tone: "info", text: "Setting up the OpenVPN client for your first connection." }
    }
    if ((phase === "connecting" || phase === "reconnecting") && connection.slow) {
        return { key: "slow", tone: "warn", text: `Still trying to reach ${host.value}.` }
    }
    if (phase === "reconnecting") {
        return { key: "reconnecting", tone: "info", text: "Connection interrupted. The kill switch holds your traffic while it recovers." }
    }
    if (phase !== "idle") {
        return null
    }
    if (session.orphaned) {
        return { key: "orphaned", tone: "warn", text: "This computer was removed from your account.", action: { label: "Sign in again", run: Restart } }
    }
    if (NeedsSignIn()) {
        return { key: "signin", tone: "warn", text: "Your server signed you out.", action: { label: "Sign in again", run: Restart } }
    }
    if (session.account?.status === "expired") {
        return { key: "expired", tone: "warn", text: `Account expired${session.account.expires ? ` on ${DateText(session.account.expires)}` : ""}. Ask your server's admin to extend it.` }
    }
    if (session.account?.status === "disabled") {
        return { key: "disabled", tone: "fail", text: "Your server's admin paused this account." }
    }
    if (connection.dropped) {
        return { key: "dropped", tone: "info", text: "The connection ended unexpectedly and the kill switch was lifted.", action: { label: "Dismiss", run: DismissConnection } }
    }
    if (session.reach === "offline") {
        return { key: "offline", tone: "warn", text: `Can't reach ${name.value}.`, action: { label: "Retry", run: () => void CheckServer() } }
    }
    return null
})

const standing = computed(() => {
    switch (session.account?.status) {
        case "active":
            return "Account active"
        case "expired":
            return "Account expired"
        case "disabled":
            return "Account paused"
        default:
            return ""
    }
})

const received = useTween(() => connection.received)
const sent = useTween(() => connection.sent)

const exit = computed(() => (partner.exit ? (prefs.conceal ? MaskIp(partner.exit) : partner.exit) : ""))

const route = computed(() => {
    const info = session.info
    if (!info) {
        return "UDP"
    }
    return [`UDP ${info.port ?? ""}`.trim(), info.stealth ? `TCP ${info.stealth}` : null].filter(Boolean).join(" · ")
})

const network = computed(() => {
    if (partner.state === "matched" && partner.partner) {
        return { label: "Partner network", value: partner.partner.display, icon: IconPartner, accent: true }
    }
    if (partner.state === "not-matched") {
        return { label: "Exit network", value: FormatAsn(partner.asn), icon: IconGlobe, accent: false }
    }
    if (partner.state === "checking") {
        return { label: "Exit network", value: "Looking up", icon: IconGlobe, accent: false }
    }
    return { label: "Exit network", value: prefs.partner ? "Unknown" : "Lookup off", icon: IconGlobe, accent: false }
})

const NAMES: Record<string, string> = { ads: "Ads", trackers: "Trackers", malware: "Malware", adult: "Adult", gambling: "Gambling", social: "Social" }

const blocking = computed(() => {
    const list = session.account?.blocking ?? []
    if (!session.account) {
        return { value: "Blocking", sub: "" }
    }
    if (!list.length) {
        return { value: "Off", sub: "Nothing blocked" }
    }
    const names = list.map((item) => NAMES[item] ?? item)
    return { value: `${list.length} ${list.length === 1 ? "category" : "categories"}`, sub: names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ") }
})

const announcement = computed(() => {
    if (connection.phase === "connected") {
        return `Protected. Connected to ${name.value}.`
    }
    return message.value ? `${status.value.text}. ${message.value.text}` : status.value.text
})

function Press() {
    if (!native) {
        adding.value = true
        return
    }
    void Toggle()
}

watch(
    () => live.value,
    (active) => {
        clearInterval(ticker)
        ticker = undefined
        if (active) {
            now.value = Date.now()
            ticker = setInterval(() => {
                now.value = Date.now()
            }, 1000)
        }
    },
    { immediate: true },
)

watch(
    () => connection.phase,
    (phase, previous) => {
        if (phase === "connected" && (previous === "connecting" || previous === "reconnecting")) {
            burst.value++
        }
    },
)

onBeforeUnmount(() => clearInterval(ticker))
</script>

<template>
    <section class="stage relative isolate flex h-full flex-col items-center justify-center overflow-hidden px-5" aria-labelledby="stage-heading">
        <div class="backdrop pointer-events-none absolute inset-0 -z-10" :class="tone === 'on' && 'lit'" aria-hidden="true" />
        <h1 id="stage-heading" class="sr-only">{{ native ? status.text : "Add a device" }}</h1>

        <header class="rise relative z-20 flex flex-col items-center pt-[clamp(0.25rem,2vh,1.5rem)] text-center">
            <ConnectionTimer v-if="native" :value="elapsed" :state="clock" class="text-[clamp(3.3rem,12.5vh,7.25rem)]" />
            <p v-else class="text-[clamp(2.4rem,8vh,4rem)] font-bold leading-none tracking-[-0.04em] text-fg">Add a device</p>
            <div class="mt-[clamp(0.5rem,1.6vh,1rem)] flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                <button type="button" class="server group inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-2.5 text-[1.05rem] font-semibold text-fg" @click="Go('server')">
                    <span v-if="native" class="size-2 rounded-full transition-[background,box-shadow] duration-500" :class="status.dot" aria-hidden="true" />
                    <span class="sr-only">{{ status.text }}, </span>
                    {{ name }}
                    <IconChevronRight class="text-fg-4 transition-transform duration-300 ease-veil group-hover:translate-x-0.5 group-hover:text-fg-2" />
                </button>
                <Transition name="swap">
                    <PartnerBadge v-if="live && partner.state === 'matched' && partner.partner" :partner="partner.partner" compact reveal />
                </Transition>
            </div>
        </header>

        <div class="rise rise-2 relative my-[clamp(0.25rem,1.5vh,1.5rem)] grid max-h-[min(48vh,470px)] min-h-[clamp(140px,26vh,224px)] w-full flex-1 place-items-center">
            <PixelGlobe :tone="tone" :still="!prefs.motion" class="pointer-events-none absolute left-1/2 top-1/2 w-[clamp(600px,128vh,1280px)] max-w-none -translate-x-1/2 -translate-y-[25%]" />
            <div class="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[clamp(140px,26vh,224px)] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                <template v-if="tone === 'busy'">
                    <span v-for="index in 3" :key="index" class="ripple absolute inset-0 rounded-full" :style="{ animationDelay: `${(index - 1) * 0.9}s` }" />
                </template>
                <span v-if="burst" :key="burst" class="burst absolute inset-0 rounded-full" />
                <span v-if="burst" :key="`flash-${burst}`" class="flash absolute -inset-[45%] rounded-full" />
            </div>
            <ConnectOrb
                :tone="orb.tone"
                :label="orb.label"
                :action="orb.action"
                :disabled="connection.phase === 'disconnecting'"
                class="relative z-10 w-[clamp(140px,26vh,224px)] text-[clamp(11px,2vh,16.5px)]"
                @press="Press"
            />
        </div>

        <div class="rise rise-3 relative z-20 flex min-h-[3.25rem] flex-col items-center justify-center gap-2">
            <Transition name="swap" mode="out-in">
                <div
                    v-if="message"
                    :key="message.key"
                    class="note flex max-w-[34rem] items-center gap-2.5 rounded-full py-2 pl-3.5 text-small"
                    :class="[message.action ? 'pr-1.5' : 'pr-4', message.tone]"
                    :role="message.tone === 'info' ? 'status' : 'alert'"
                >
                    <component :is="message.tone === 'info' ? IconInfo : IconAlert" class="shrink-0" />
                    <span class="text-fg-2">{{ message.text }}</span>
                    <button v-if="message.action" type="button" class="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 font-semibold text-fg transition-colors hover:bg-white/[0.14]" :disabled="leaving" @click="message.action.run()">
                        {{ message.action.label }}
                    </button>
                </div>
            </Transition>
            <Transition name="swap" mode="out-in">
                <button v-if="native && connection.phase === 'connecting'" key="cancel" type="button" class="pill" @click="Disconnect()"><IconX />Cancel connection</button>
                <button v-else-if="native && live" key="disconnect" type="button" class="pill" @click="Disconnect()"><IconPower />Disconnect</button>
                <button v-else-if="native && connection.phase === 'error'" key="dismiss" type="button" class="pill" @click="DismissConnection()"><IconX />Dismiss</button>
                <button v-else-if="native && connection.dropped && connection.phase === 'idle'" key="reconnect" type="button" class="pill" @click="Connect()"><IconPower />Reconnect</button>
            </Transition>
        </div>

        <div class="relative z-20 w-full max-w-[42rem] pb-[clamp(0.75rem,3vh,1.75rem)] pt-[clamp(0.5rem,1.6vh,1.25rem)]">
            <Transition name="fade" mode="out-in">
                <div v-if="native && live" key="live" class="stagger grid grid-cols-3 gap-3 max-[520px]:gap-2">
                    <QuickCard :icon="IconArrowDown" label="Received" :value="Bytes(received)" :sub="connection.phase === 'connected' ? Rate(connection.down) : 'Paused'" style="--i: 0" />
                    <QuickCard :icon="IconArrowUp" label="Sent" :value="Bytes(sent)" :sub="connection.phase === 'connected' ? Rate(connection.up) : 'Paused'" style="--i: 1" />
                    <QuickCard :icon="network.icon" :label="network.label" :value="network.value" :sub="exit" :accent="network.accent" action="Exit network" style="--i: 2" @press="Go('server', 'exit')" />
                </div>
                <div v-else key="idle" class="stagger grid grid-cols-3 gap-3 max-[520px]:gap-2">
                    <QuickCard :icon="IconShield" label="Protocol" value="OpenVPN" :sub="route" action="Server details" style="--i: 0" @press="Go('server')" />
                    <QuickCard
                        :icon="IconDevices"
                        label="Devices"
                        :value="session.account ? `${session.account.devices} of ${session.account.limit}` : 'Devices'"
                        :sub="standing"
                        action="Manage devices"
                        style="--i: 1"
                        @press="Go('devices')"
                    />
                    <QuickCard :icon="IconFilter" label="Blocking" :value="blocking.value" :sub="blocking.sub" action="Content blocking" style="--i: 2" @press="Go('settings', 'blocking')" />
                </div>
            </Transition>
        </div>

        <AddDeviceDialog v-if="!native" :open="adding" @close="adding = false" />
        <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </section>
</template>

<style scoped>
.backdrop {
    background:
        radial-gradient(70% 55% at 50% 62%, rgb(32 44 150 / 0.32), transparent 70%),
        radial-gradient(120% 90% at 50% 120%, #0d1440 0%, #070a1c 48%, var(--color-base) 100%);
    transition: opacity 900ms var(--ease-veil);
}

.backdrop::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(50% 42% at 50% 58%, rgb(113 92 255 / 0.22), transparent 70%);
    opacity: 0;
    transition: opacity 1200ms var(--ease-veil);
}

.backdrop.lit::after {
    opacity: 1;
}

.server {
    transition: background 200ms var(--ease-veil);
}

.server:hover {
    background: rgb(255 255 255 / 0.05);
}

.rise {
    animation: rise-in 820ms var(--ease-veil) both;
}

.rise-2 {
    animation-delay: 120ms;
}

.rise-3 {
    animation-delay: 240ms;
}

.note {
    background: rgb(16 18 38 / 0.86);
    box-shadow:
        0 0 0 1px rgb(255 255 255 / 0.07) inset,
        0 14px 40px -20px rgb(0 0 0 / 0.9);
}

.note.info svg {
    color: var(--color-violet-300);
}

.note.warn svg {
    color: var(--color-warn);
}

.note.fail svg {
    color: var(--color-danger);
}

.pill {
    display: inline-flex;
    height: 2.75rem;
    align-items: center;
    gap: 0.6rem;
    border-radius: 999px;
    padding-inline: 1.35rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-fg);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.04));
    box-shadow:
        0 0 0 1px rgb(255 255 255 / 0.1) inset,
        0 1px 0 0 rgb(255 255 255 / 0.12) inset,
        0 18px 40px -20px rgb(0 0 0 / 0.95);
    backdrop-filter: blur(10px);
    transition:
        background 220ms var(--ease-veil),
        transform 220ms var(--ease-veil);
}

.pill:hover {
    background: linear-gradient(180deg, rgb(255 255 255 / 0.15), rgb(255 255 255 / 0.06));
}

.pill:active {
    transform: scale(0.97);
}

.ripple {
    border: 1.5px solid rgb(179 168 255 / 0.5);
    box-shadow: 0 0 30px -6px rgb(113 92 255 / 0.7);
    opacity: 0;
    animation: ripple 2.7s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
}

.burst {
    border: 2px solid rgb(232 228 255 / 0.9);
    box-shadow: 0 0 50px 4px rgb(143 127 255 / 0.7);
    animation: burst 1.2s 650ms var(--ease-veil) both;
}

.flash {
    background: radial-gradient(circle, rgb(160 146 255 / 0.5), rgb(82 107 255 / 0.15) 45%, transparent 70%);
    animation: flash 1.5s 600ms var(--ease-veil) both;
}

@keyframes rise-in {
    from {
        opacity: 0;
        transform: translateY(26px) scale(0.985);
        filter: blur(6px);
    }
    to {
        opacity: 1;
        transform: none;
        filter: none;
    }
}

@keyframes ripple {
    0% {
        opacity: 0.75;
        transform: scale(1);
    }
    100% {
        opacity: 0;
        transform: scale(2.9);
    }
}

@keyframes burst {
    0% {
        opacity: 0;
        transform: scale(0.95);
    }
    8% {
        opacity: 1;
    }
    100% {
        opacity: 0;
        transform: scale(3.6);
    }
}

@keyframes flash {
    0% {
        opacity: 0;
        transform: scale(0.5);
    }
    25% {
        opacity: 1;
    }
    100% {
        opacity: 0;
        transform: scale(1.4);
    }
}
</style>
