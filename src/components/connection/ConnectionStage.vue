<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import type { GlobeTone } from "../../domain"
import { Bytes, Clock, Host, MaskIp, Rate } from "../../lib/format"
import { TROUBLESHOOTING } from "../../lib/links"
import { FormatAsn } from "../../partners/registry"
import { connection, Disconnect, DismissConnection, Toggle } from "../../stores/connection"
import { Go } from "../../stores/nav"
import { partner } from "../../stores/partner"
import { prefs } from "../../stores/prefs"
import { session } from "../../stores/session"
import IconArrowDown from "../icons/IconArrowDown.vue"
import IconArrowUp from "../icons/IconArrowUp.vue"
import IconDevices from "../icons/IconDevices.vue"
import IconGlobe from "../icons/IconGlobe.vue"
import IconPartner from "../icons/IconPartner.vue"
import IconPower from "../icons/IconPower.vue"
import IconServer from "../icons/IconServer.vue"
import IconShield from "../icons/IconShield.vue"
import IconX from "../icons/IconX.vue"
import ExternalLink from "../shell/ExternalLink.vue"
import UiDetails from "../ui/UiDetails.vue"
import BigClock from "./BigClock.vue"
import ConnectOrb from "./ConnectOrb.vue"
import PartnerBadge from "./PartnerBadge.vue"
import PixelGlobe from "./PixelGlobe.vue"
import StatCard from "./StatCard.vue"

const now = ref(Date.now())
const burst = ref(0)
let ticker: ReturnType<typeof setInterval> | undefined

const host = computed(() => session.info?.endpoint ?? Host(session.profile?.server ?? ""))
const name = computed(() => session.info?.name ?? host.value)
const live = computed(() => connection.phase === "connected" || connection.phase === "reconnecting")

const tone = computed<GlobeTone>(() => {
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
    switch (connection.phase) {
        case "connecting":
            return { label: "Connecting", action: "Cancel connection" }
        case "connected":
            return { label: "Connected", action: `Disconnect from ${name.value}` }
        case "reconnecting":
            return { label: "Reconnecting", action: `Disconnect from ${name.value}` }
        case "disconnecting":
            return { label: "Disconnecting", action: "Disconnecting" }
        case "error":
            return { label: "Try again", action: `Try connecting to ${name.value} again` }
        default:
            return { label: "Connect", action: `Connect to ${name.value}` }
    }
})

const heading = computed(() => {
    switch (connection.phase) {
        case "connecting":
            return "Connecting"
        case "disconnecting":
            return "Disconnecting"
        case "error":
            return connection.error?.title ?? "Couldn't connect"
        default:
            return "Not connected"
    }
})

const detail = computed(() => {
    switch (connection.phase) {
        case "connecting":
            if (connection.installing) {
                return "Setting up the official OpenVPN client for your first connection. This can take a minute."
            }
            if (connection.slow) {
                return `Still trying to reach ${host.value}. Your server may be offline, or this device may have been removed from your account.`
            }
            return `Establishing an encrypted tunnel to ${host.value}…`
        case "reconnecting":
            return connection.slow
                ? `Still trying to reach ${host.value}. The kill switch keeps traffic blocked until the tunnel is back.`
                : "Connection interrupted. Restoring it now, with the kill switch blocking traffic meanwhile."
        case "disconnecting":
            return connection.installing ? "Stopping once the OpenVPN setup finishes…" : "Closing the tunnel…"
        case "error":
            return connection.error?.message ?? ""
        case "idle":
            return "Your traffic isn't going through your VeylVPN server right now."
        default:
            return ""
    }
})

const elapsed = computed(() => Clock(connection.since ? now.value - connection.since : 0))

const exit = computed(() => (partner.exit ? (prefs.conceal ? MaskIp(partner.exit) : partner.exit) : ""))

const route = computed(() => {
    const info = session.info
    if (!info) {
        return ""
    }
    return [`${info.protocol.toUpperCase()}${info.port ? ` ${info.port}` : ""}`, info.stealth ? `TCP ${info.stealth}` : null].filter(Boolean).join(" · ")
})

const network = computed(() => {
    if (partner.state === "matched" && partner.partner) {
        return { label: "Partner network", value: partner.partner.display, icon: IconPartner, accent: true }
    }
    if (partner.state === "not-matched") {
        return { label: "Exit network", value: FormatAsn(partner.asn), icon: IconGlobe, accent: false }
    }
    if (partner.state === "checking") {
        return { label: "Exit network", value: "Looking up…", icon: IconGlobe, accent: false }
    }
    return { label: "Exit network", value: prefs.partner ? "Not available" : "Lookup off", icon: IconGlobe, accent: false }
})

const announcement = computed(() => {
    if (connection.phase === "connected") {
        return `Protected. Connected to ${name.value}.`
    }
    if (connection.phase === "reconnecting") {
        return "Reconnecting."
    }
    return connection.phase === "error" ? `${heading.value}. ${detail.value}` : heading.value
})

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
    <section class="stage relative isolate flex flex-col items-center justify-center overflow-hidden px-6 pb-[clamp(0.75rem,2.5vh,1.5rem)] pt-[clamp(0.5rem,2.5vh,2rem)]" aria-labelledby="stage-heading">
        <div
            class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_48%_at_50%_56%,rgb(61_82_230/0.2),transparent_72%)] transition-opacity duration-700"
            :class="tone === 'on' ? 'opacity-100' : 'opacity-50'"
            aria-hidden="true"
        />

        <header class="enter relative z-20 flex flex-col items-center text-center [text-shadow:0_2px_14px_rgb(5_5_10/0.95)]">
            <h1 id="stage-heading" class="sr-only">{{ live ? (connection.phase === "connected" ? "Protected" : "Reconnecting") : heading }}</h1>
            <Transition name="swap" mode="out-in">
                <BigClock v-if="live" key="clock" :value="elapsed" class="text-[clamp(3rem,11.5vh,5.75rem)]" aria-hidden="true" />
                <p
                    v-else
                    :key="heading"
                    class="font-bold leading-[1.05] tracking-[-0.035em] text-fg"
                    :class="connection.phase === 'error' ? 'text-[clamp(1.6rem,5.4vh,2.6rem)]' : 'text-[clamp(2.1rem,7.5vh,3.5rem)]'"
                    aria-hidden="true"
                >
                    {{ heading }}
                </p>
            </Transition>
            <div class="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                <Transition name="swap">
                    <span
                        v-if="live"
                        class="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.78rem] font-semibold transition-colors duration-500"
                        :class="connection.phase === 'connected' ? 'border-ok/30 bg-ok/10 text-ok' : 'border-violet-400/30 bg-violet-500/10 text-violet-200'"
                    >
                        <span class="size-1.5 rounded-full" :class="connection.phase === 'connected' ? 'bg-ok shadow-[0_0_8px_rgb(84_232_112/0.8)]' : 'animate-pulse bg-violet-300'" />
                        {{ connection.phase === "connected" ? "Protected" : "Reconnecting" }}
                    </span>
                </Transition>
                <button type="button" class="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[1.05rem] font-semibold text-fg transition-colors hover:bg-white/[0.04]" @click="Go('server')">
                    <span class="grid size-7 place-items-center rounded-full bg-violet-500/20 text-[0.95rem] text-violet-200">
                        <IconServer />
                    </span>
                    {{ name }}
                </button>
                <Transition name="swap">
                    <PartnerBadge v-if="live && partner.state === 'matched' && partner.partner" :partner="partner.partner" compact reveal />
                </Transition>
            </div>
            <Transition name="swap" mode="out-in">
                <p v-if="detail" :key="detail" class="mt-2 max-w-[32rem] text-small text-fg-3">{{ detail }}</p>
            </Transition>
            <div v-if="connection.phase === 'error' && connection.error" class="mt-2 flex flex-col items-center gap-1.5">
                <UiDetails>
                    <p class="tech selectable max-w-[30rem] rounded-md border border-line bg-surface-1 px-3 py-2 text-left text-fg-2">{{ connection.error.detail }}</p>
                </UiDetails>
                <ExternalLink v-if="TROUBLESHOOTING" :href="TROUBLESHOOTING" class="text-small">Troubleshooting guide</ExternalLink>
            </div>
        </header>

        <div class="enter enter-2 relative my-[clamp(0.375rem,1.5vh,2rem)] grid max-h-[min(46vh,460px)] min-h-[clamp(136px,25vh,212px)] w-full flex-1 place-items-center">
            <PixelGlobe :tone="tone" :still="!prefs.motion" class="pointer-events-none absolute left-1/2 top-1/2 w-[clamp(470px,94vh,940px)] -translate-x-1/2 -translate-y-1/2" />
            <div class="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[clamp(136px,25vh,212px)] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                <template v-if="tone === 'busy'">
                    <span v-for="index in 3" :key="index" class="ripple absolute inset-0 rounded-full" :style="{ animationDelay: `${(index - 1) * 0.85}s` }" />
                </template>
                <span v-if="burst" :key="burst" class="burst absolute inset-0 rounded-full" />
                <span v-if="burst" :key="`flash-${burst}`" class="flash absolute -inset-[30%] rounded-full" />
            </div>
            <ConnectOrb
                :tone="tone"
                :label="orb.label"
                :action="orb.action"
                :disabled="connection.phase === 'disconnecting'"
                class="relative z-10 w-[clamp(136px,25vh,212px)] text-[clamp(11px,1.95vh,16px)]"
                @press="Toggle()"
            />
        </div>

        <div class="enter enter-3 relative z-10 flex h-11 items-center justify-center">
            <Transition name="swap" mode="out-in">
                <button v-if="connection.phase === 'connecting'" key="cancel" type="button" class="pill" @click="Disconnect()"><IconX />Cancel connection</button>
                <button v-else-if="live" key="disconnect" type="button" class="pill" @click="Disconnect()"><IconPower />Disconnect</button>
                <button v-else-if="connection.phase === 'error'" key="dismiss" type="button" class="pill" @click="DismissConnection()"><IconX />Dismiss</button>
                <button v-else-if="connection.phase === 'disconnecting'" key="leaving" type="button" class="pill" disabled>Disconnecting…</button>
            </Transition>
        </div>

        <Transition name="fade" mode="out-in">
            <div v-if="live" key="live" class="stagger relative z-10 mt-[clamp(0.5rem,1.5vh,1.5rem)] grid w-full max-w-[44rem] grid-cols-4 gap-3">
                <StatCard :icon="IconServer" label="Server" :value="name" :sub="host" action="Server details" style="--i: 0" @press="Go('server')" />
                <StatCard :icon="IconArrowDown" label="Received" :value="Bytes(connection.received)" :sub="connection.phase === 'connected' ? Rate(connection.down) : 'Paused'" style="--i: 1" />
                <StatCard :icon="IconArrowUp" label="Sent" :value="Bytes(connection.sent)" :sub="connection.phase === 'connected' ? Rate(connection.up) : 'Paused'" style="--i: 2" />
                <StatCard :icon="network.icon" :label="network.label" :value="network.value" :sub="exit" :accent="network.accent" action="Exit network details" style="--i: 3" @press="Go('server')" />
            </div>
            <div v-else key="idle" class="stagger relative z-10 mt-[clamp(0.5rem,1.5vh,1.5rem)] grid w-full max-w-[44rem] grid-cols-3 gap-3">
                <StatCard :icon="IconServer" label="Server" :value="name" :sub="host" action="Server details" style="--i: 0" @press="Go('server')" />
                <StatCard :icon="IconShield" label="Protocol" value="OpenVPN" :sub="route" style="--i: 1" />
                <StatCard
                    :icon="IconDevices"
                    label="Devices"
                    :value="session.account ? `${session.account.devices} of ${session.account.limit}` : 'Your devices'"
                    :sub="session.account?.status === 'active' ? 'Account active' : session.account ? `Account ${session.account.status === 'disabled' ? 'paused' : session.account.status}` : ''"
                    action="Manage devices"
                    style="--i: 2"
                    @press="Go('devices')"
                />
            </div>
        </Transition>

        <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </section>
</template>

<style scoped>
.pill {
    display: inline-flex;
    height: 2.75rem;
    align-items: center;
    gap: 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--color-line-2);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.03));
    padding-inline: 1.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-fg);
    box-shadow:
        0 1px 0 0 rgb(255 255 255 / 0.08) inset,
        0 16px 40px -22px rgb(0 0 0 / 0.9);
    transition:
        background 200ms var(--ease-veil),
        border-color 200ms var(--ease-veil),
        transform 200ms var(--ease-veil);
}

.pill:hover:not(:disabled) {
    border-color: var(--color-line-3);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.05));
}

.pill:active:not(:disabled) {
    transform: scale(0.98);
}

.pill:disabled {
    color: var(--color-fg-3);
}


.enter {
    animation: stage-in 640ms var(--ease-veil) both;
}

.enter-2 {
    animation-delay: 90ms;
}

.enter-3 {
    animation-delay: 180ms;
}

.ripple {
    border: 1.5px solid rgb(179 168 255 / 0.55);
    box-shadow: 0 0 24px -4px rgb(113 92 255 / 0.6);
    opacity: 0;
    animation: ripple 2.55s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
}

.burst {
    border: 2px solid rgb(226 222 255 / 0.85);
    box-shadow: 0 0 40px 2px rgb(143 127 255 / 0.65);
    animation: burst 1.1s var(--ease-veil) both;
}

.flash {
    background: radial-gradient(circle, rgb(143 127 255 / 0.55), rgb(82 107 255 / 0.18) 45%, transparent 70%);
    animation: flash 1.3s var(--ease-veil) both;
}

@keyframes stage-in {
    from {
        opacity: 0;
        transform: translateY(16px);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

@keyframes ripple {
    0% {
        opacity: 0.7;
        transform: scale(1);
    }
    100% {
        opacity: 0;
        transform: scale(2.7);
    }
}

@keyframes burst {
    0% {
        opacity: 0.95;
        transform: scale(0.95);
    }
    100% {
        opacity: 0;
        transform: scale(3.4);
    }
}

@keyframes flash {
    0% {
        opacity: 0;
        transform: scale(0.6);
    }
    25% {
        opacity: 1;
    }
    100% {
        opacity: 0;
        transform: scale(1.5);
    }
}
</style>
