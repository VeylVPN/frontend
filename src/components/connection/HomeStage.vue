<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { Backend } from "../../backend"
import { CreateStage, OrbLabel, Presence } from "../../composables/stage"
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
import ConnectionTimer from "./ConnectionTimer.vue"
import OrbScene from "./OrbScene.vue"
import PartnerBadge from "./PartnerBadge.vue"
import QuickCard from "./QuickCard.vue"

type Message = { key: string; tone: "info" | "warn" | "fail"; text: string; action?: { label: string; run: () => void } }

const native = Backend().tunnel
const now = ref(Date.now())
const adding = ref(false)
const leaving = ref(false)
let ticker: ReturnType<typeof setInterval> | undefined

const stage = CreateStage(() => connection.phase)

watch(
    () => connection.phase,
    (phase) => stage.Sync(phase),
)

const visual = stage.visual

const host = computed(() => session.info?.endpoint ?? Host(session.profile?.server ?? ""))
const name = computed(() => session.info?.name ?? host.value)
const live = computed(() => native && stage.live.value)

const label = computed(() => (native ? OrbLabel(visual.value) : "New profile"))

const action = computed(() => {
    if (!native) {
        return "Create an OpenVPN profile for a device"
    }
    switch (connection.phase) {
        case "connecting":
            return "Cancel connection"
        case "connected":
        case "reconnecting":
            return `Disconnect from ${name.value}`
        case "disconnecting":
            return "Disconnecting"
        case "error":
            return `Try connecting to ${name.value} again`
        default:
            return `Connect to ${name.value}`
    }
})

const status = computed(() => Presence(visual.value))

const elapsed = computed(() => Clock(connection.since && live.value ? now.value - connection.since : 0))

const clock = computed(() => (live.value ? "live" : visual.value === "charging" ? "busy" : "idle"))

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
    if (phase !== "idle" || visual.value === "releasing") {
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
    if (visual.value === "live") {
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

onBeforeUnmount(() => {
    clearInterval(ticker)
    stage.Dispose()
})
</script>

<template>
    <section class="stage relative isolate flex h-full flex-col items-center justify-center overflow-hidden px-5" aria-labelledby="stage-heading">
        <div class="backdrop pointer-events-none absolute inset-0 -z-10" :class="[stage.tone.value === 'on' && 'lit', visual === 'locking' && 'flare']" aria-hidden="true" />
        <h1 id="stage-heading" class="sr-only">{{ native ? status.text : "Add a device" }}</h1>

        <header class="rise relative z-20 flex flex-col items-center pt-[clamp(0.25rem,2vh,1.5rem)] text-center">
            <ConnectionTimer v-if="native" :value="elapsed" :state="clock" :direction="visual === 'releasing' ? 'down' : 'up'" class="text-[clamp(3.3rem,12.5vh,7.25rem)]" />
            <p v-else class="text-[clamp(2.4rem,8vh,4rem)] font-bold leading-none tracking-[-0.04em] text-fg">Add a device</p>
            <div class="mt-[clamp(0.5rem,1.6vh,1rem)] flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                <button type="button" class="server group inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-2.5 text-[1.05rem] font-semibold text-fg" @click="Go('server')">
                    <span v-if="native" class="relative grid size-2 place-items-center" aria-hidden="true">
                        <span v-if="visual === 'locking'" class="ping absolute inset-0 rounded-full bg-on" />
                        <span class="size-2 rounded-full transition-[background,box-shadow] duration-500" :class="status.dot" />
                    </span>
                    <span class="sr-only">{{ status.text }}, </span>
                    {{ name }}
                    <IconChevronRight class="text-fg-4 transition-transform duration-300 ease-veil group-hover:translate-x-0.5 group-hover:text-fg-2" />
                </button>
                <Transition name="swap">
                    <PartnerBadge v-if="live && partner.state === 'matched' && partner.partner" :partner="partner.partner" compact reveal />
                </Transition>
            </div>
        </header>

        <OrbScene
            class="rise rise-2 relative my-[clamp(0.25rem,1.5vh,1.5rem)] max-h-[min(48vh,470px)] min-h-[clamp(140px,26vh,224px)] w-full flex-1"
            :visual="native ? visual : 'live'"
            :tone="native ? stage.tone.value : 'on'"
            :streams="native ? stage.streams.value : 'off'"
            :wave="native ? stage.wave.value : null"
            :label="label"
            :action="action"
            size="clamp(140px,26vh,224px)"
            globe="clamp(600px,128vh,1280px)"
            :lift="0.25"
            :still="!prefs.motion"
            :disabled="connection.phase === 'disconnecting'"
            @press="Press"
        />

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
                <button v-if="native && visual === 'charging'" key="cancel" type="button" class="pill" @click="Disconnect()"><IconX />Cancel connection</button>
                <button v-else-if="native && live" key="disconnect" type="button" class="pill" @click="Disconnect()"><IconPower />Disconnect</button>
                <button v-else-if="native && visual === 'fail'" key="dismiss" type="button" class="pill" @click="DismissConnection()"><IconX />Dismiss</button>
                <button v-else-if="native && connection.dropped && visual === 'idle'" key="reconnect" type="button" class="pill" @click="Connect()"><IconPower />Reconnect</button>
            </Transition>
        </div>

        <div class="relative z-20 w-full max-w-[42rem] pb-[clamp(0.75rem,3vh,1.75rem)] pt-[clamp(0.5rem,1.6vh,1.25rem)]">
            <Transition name="cards" mode="out-in">
                <div v-if="live" key="live" class="stagger grid grid-cols-3 gap-3 max-[520px]:gap-2">
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
}

.backdrop::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(50% 42% at 50% 52%, rgb(113 92 255 / 0.24), transparent 70%);
    opacity: 0;
    transition: opacity 1400ms var(--ease-veil);
}

.backdrop.lit::after {
    opacity: 1;
}

.backdrop::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(38% 34% at 50% 46%, rgb(214 208 255 / 0.32), rgb(113 92 255 / 0.12) 45%, transparent 75%);
    opacity: 0;
}

.backdrop.flare::before {
    animation: flare 1.6s 100ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.ping {
    animation: ping 1.1s 150ms cubic-bezier(0, 0, 0.2, 1) both;
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

.cards-enter-active {
    transition: opacity 200ms var(--ease-veil);
}

.cards-leave-active {
    transition:
        opacity 260ms var(--ease-veil),
        transform 260ms var(--ease-veil),
        filter 260ms var(--ease-veil);
}

.cards-enter-from {
    opacity: 0;
}

.cards-leave-to {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
    filter: blur(4px);
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

@keyframes flare {
    0% {
        opacity: 0;
    }
    18% {
        opacity: 1;
    }
    100% {
        opacity: 0;
    }
}

@keyframes ping {
    0% {
        opacity: 0.8;
        transform: scale(1);
    }
    100% {
        opacity: 0;
        transform: scale(4.5);
    }
}
</style>
