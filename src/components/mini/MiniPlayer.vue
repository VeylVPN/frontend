<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { CreateStage, OrbLabel, Presence } from "../../composables/stage"
import { Clock, Rate } from "../../lib/format"
import type { MiniSource } from "../../mini/types"
import BrandWordmark from "../brand/BrandWordmark.vue"
import ConnectionTimer from "../connection/ConnectionTimer.vue"
import OrbScene from "../connection/OrbScene.vue"
import IconArrowDown from "../icons/IconArrowDown.vue"
import IconArrowUp from "../icons/IconArrowUp.vue"
import IconArrowUpRight from "../icons/IconArrowUpRight.vue"
import IconDevices from "../icons/IconDevices.vue"
import IconMinus from "../icons/IconMinus.vue"
import IconPartner from "../icons/IconPartner.vue"
import IconServer from "../icons/IconServer.vue"
import IconSliders from "../icons/IconSliders.vue"

const props = defineProps<{ source: MiniSource }>()

const snapshot = props.source.snapshot
const stage = CreateStage(() => snapshot.phase)
const visual = stage.visual
const now = ref(Date.now())
const entrance = ref(0)
let ticker: ReturnType<typeof setInterval> | undefined

watch(
    () => snapshot.phase,
    (phase) => stage.Sync(phase),
)

watch(
    () => snapshot.motion,
    (motion) => {
        document.documentElement.dataset.motion = motion ? "full" : "reduced"
    },
    { immediate: true },
)

const ready = computed(() => snapshot.signed && snapshot.tunnel)
const live = computed(() => ready.value && stage.live.value)

const status = computed(() => {
    if (!ready.value) {
        return { dot: "bg-idle", text: snapshot.tunnel ? "Signed out" : "Desktop only" }
    }
    if (visual.value === "fail" && snapshot.error) {
        return { dot: "bg-fail", text: snapshot.error }
    }
    return Presence(visual.value)
})

const action = computed(() => {
    if (!ready.value) {
        return "Open VeylVPN to sign in"
    }
    switch (snapshot.phase) {
        case "connecting":
            return "Cancel connection"
        case "connected":
        case "reconnecting":
            return `Disconnect from ${snapshot.name}`
        case "disconnecting":
            return "Disconnecting"
        default:
            return `Connect to ${snapshot.name}`
    }
})

const elapsed = computed(() => Clock(snapshot.since && live.value ? now.value - snapshot.since : 0))

const clock = computed(() => (live.value ? "live" : visual.value === "charging" ? "busy" : "idle"))

const hint = computed(() => {
    if (!ready.value) {
        return "Not signed in"
    }
    switch (visual.value) {
        case "idle":
            return "Press the orb to connect"
        case "fail":
            return "Press the orb to try again"
        default:
            return `${OrbLabel(visual.value)} to ${snapshot.name || "your server"}`
    }
})

const TOOLS = [
    { page: "server", label: "Server", icon: IconServer },
    { page: "devices", label: "Devices", icon: IconDevices },
    { page: "settings", label: "Settings", icon: IconSliders },
] as const

function Press() {
    if (!ready.value) {
        props.source.Open("home")
        return
    }
    props.source.Toggle()
}

function Key(event: KeyboardEvent) {
    if (event.key === "Escape") {
        props.source.Hide()
    }
}

props.source.OnShown(() => {
    entrance.value++
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

onMounted(() => document.addEventListener("keydown", Key))

onBeforeUnmount(() => {
    document.removeEventListener("keydown", Key)
    clearInterval(ticker)
    stage.Dispose()
})
</script>

<template>
    <main :key="entrance" class="mini relative isolate grid h-full grid-rows-[1fr_auto] overflow-hidden bg-night" :aria-label="`VeylVPN mini player. ${status.text}`">
        <div class="pointer-events-none absolute inset-0 -z-10" data-tauri-drag-region aria-hidden="true" />
        <div class="flex min-h-0 gap-3.5 p-3 pb-0" data-tauri-drag-region>
            <div class="tile enter relative aspect-square h-full shrink-0 overflow-hidden rounded-[18px]" :class="[stage.tone.value === 'on' && 'lit', visual === 'locking' && 'flare']">
                <OrbScene
                    class="size-full"
                    :visual="ready ? visual : 'idle'"
                    :tone="ready ? stage.tone.value : 'idle'"
                    :streams="ready ? stage.streams.value : 'off'"
                    :wave="ready ? stage.wave.value : null"
                    label=""
                    :action="action"
                    size="84px"
                    globe="300px"
                    :lift="0.2"
                    :orbit="false"
                    :still="!snapshot.motion"
                    :disabled="ready && snapshot.phase === 'disconnecting'"
                    @press="Press"
                />
                <span class="ring pointer-events-none absolute inset-0 z-30 rounded-[inherit]" aria-hidden="true" />
            </div>
            <div class="enter enter-2 flex min-w-0 flex-1 flex-col" data-tauri-drag-region>
                <header class="-mr-1.5 flex h-8 shrink-0 items-center justify-between" data-tauri-drag-region>
                    <BrandWordmark class="pointer-events-none h-[9px]" />
                    <div class="flex items-center">
                        <button type="button" class="chrome" aria-label="Open VeylVPN" title="Open VeylVPN" @click="source.Open('home')"><IconArrowUpRight /></button>
                        <button type="button" class="chrome" aria-label="Hide mini player" title="Hide" @click="source.Hide()"><IconMinus /></button>
                    </div>
                </header>
                <div class="flex flex-1 flex-col justify-center pb-1" data-tauri-drag-region>
                    <p class="flex items-center gap-2 text-small font-semibold text-fg-2">
                        <span class="relative grid size-2 shrink-0 place-items-center" aria-hidden="true">
                            <span v-if="visual === 'locking'" class="ping absolute inset-0 rounded-full bg-on" />
                            <span class="size-2 rounded-full transition-[background,box-shadow] duration-500" :class="status.dot" />
                        </span>
                        <Transition name="swap" mode="out-in">
                            <span :key="status.text" class="truncate">{{ status.text }}</span>
                        </Transition>
                    </p>
                    <ConnectionTimer v-if="ready" :value="elapsed" :state="clock" :direction="visual === 'releasing' ? 'down' : 'up'" class="mt-1 justify-start text-[2.05rem]" />
                    <button v-else type="button" class="mt-1 self-start text-[1.3rem] font-bold leading-tight tracking-[-0.03em] text-fg" @click="source.Open('home')">Open VeylVPN</button>
                    <p class="mt-1 flex min-w-0 items-center gap-1.5 text-small text-fg-3">
                        <span class="truncate">{{ ready ? snapshot.name || "Your server" : "Sign in to connect" }}</span>
                        <Transition name="swap">
                            <span v-if="live && snapshot.partner" class="partner inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[0.72rem] font-semibold"><IconPartner />{{ snapshot.partner }}</span>
                        </Transition>
                    </p>
                </div>
            </div>
        </div>

        <footer class="enter enter-3 flex h-[52px] items-center gap-2 pl-4 pr-3" data-tauri-drag-region>
            <Transition name="swap" mode="out-in">
                <p v-if="live" key="rates" class="tech flex min-w-0 items-center gap-3 text-fg-3">
                    <span class="inline-flex items-center gap-1"><IconArrowDown class="text-fg-4" /><span class="sr-only">Down</span>{{ snapshot.phase === "connected" ? Rate(snapshot.down) : "Paused" }}</span>
                    <span class="inline-flex items-center gap-1"><IconArrowUp class="text-fg-4" /><span class="sr-only">Up</span>{{ snapshot.phase === "connected" ? Rate(snapshot.up) : "Paused" }}</span>
                </p>
                <p v-else :key="hint" class="truncate text-small text-fg-4">{{ hint }}</p>
            </Transition>
            <nav class="ml-auto flex items-center gap-1" aria-label="Open in VeylVPN">
                <button v-for="tool in TOOLS" :key="tool.page" type="button" class="tool" :aria-label="tool.label" :title="tool.label" :disabled="!ready" @click="source.Open(tool.page)">
                    <component :is="tool.icon" />
                </button>
            </nav>
        </footer>
    </main>
</template>

<style scoped>
.mini {
    background: radial-gradient(90% 120% at 0% 0%, rgb(26 30 90 / 0.5), transparent 60%), var(--color-night);
    box-shadow: 0 0 0 1px rgb(143 127 255 / 0.16) inset;
}

.mini footer {
    box-shadow: 0 1px 0 0 rgb(255 255 255 / 0.05) inset;
}

.tile {
    isolation: isolate;
    background:
        radial-gradient(70% 55% at 50% 62%, rgb(32 44 150 / 0.38), transparent 70%),
        radial-gradient(120% 90% at 50% 120%, #0d1440 0%, #070a1c 52%, var(--color-base) 100%);
    box-shadow: 0 18px 40px -20px rgb(0 0 0 / 0.9);
}

.ring {
    box-shadow: 0 0 0 1px rgb(143 127 255 / 0.22) inset;
    transition: box-shadow 1400ms var(--ease-veil);
}

.tile.lit .ring {
    box-shadow:
        0 0 0 1px rgb(170 158 255 / 0.55) inset,
        0 0 24px -6px rgb(113 92 255 / 0.7) inset;
}

.tile::after,
.tile::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    border-radius: inherit;
    opacity: 0;
}

.tile::after {
    background: radial-gradient(60% 55% at 50% 50%, rgb(113 92 255 / 0.28), transparent 72%);
    transition: opacity 1400ms var(--ease-veil);
}

.tile.lit::after {
    opacity: 1;
}

.tile::before {
    background: radial-gradient(50% 50% at 50% 50%, rgb(214 208 255 / 0.4), rgb(113 92 255 / 0.14) 45%, transparent 75%);
}

.tile.flare::before {
    animation: flare 1.6s 100ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.enter {
    animation: enter 520ms var(--ease-veil) both;
}

.tile.enter {
    animation-name: enter-tile;
    animation-duration: 700ms;
}

.enter-2 {
    animation-delay: 70ms;
}

.enter-3 {
    animation-delay: 140ms;
}

.chrome,
.tool {
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: var(--color-fg-3);
    transition:
        background 200ms var(--ease-veil),
        color 200ms var(--ease-veil),
        transform 200ms var(--ease-veil);
}

.chrome {
    width: 30px;
    height: 30px;
    font-size: 0.95rem;
}

.tool {
    width: 34px;
    height: 34px;
    font-size: 1.05rem;
    background: rgb(255 255 255 / 0.045);
    box-shadow: 0 0 0 1px rgb(255 255 255 / 0.07) inset;
}

.chrome:hover,
.tool:not(:disabled):hover {
    color: var(--color-fg);
    background: rgb(255 255 255 / 0.09);
}

.chrome:active,
.tool:not(:disabled):active {
    transform: scale(0.92);
}

.tool:disabled {
    opacity: 0.4;
}

.partner {
    color: var(--color-violet-200);
    background: rgb(113 92 255 / 0.2);
    box-shadow: 0 0 0 1px rgb(143 127 255 / 0.4) inset;
}

.ping {
    animation: ping 1.1s 150ms cubic-bezier(0, 0, 0.2, 1) both;
}

@keyframes enter {
    from {
        opacity: 0;
        transform: translateY(10px);
        filter: blur(4px);
    }
    to {
        opacity: 1;
        transform: none;
        filter: none;
    }
}

@keyframes enter-tile {
    from {
        opacity: 0;
        transform: scale(0.9);
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
