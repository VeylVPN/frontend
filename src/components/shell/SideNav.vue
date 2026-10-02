<script setup lang="ts">
import { computed } from "vue"
import { Backend } from "../../backend"
import { Host } from "../../lib/format"
import { Go, nav, PAGES, type Page } from "../../stores/nav"
import { connection } from "../../stores/connection"
import { CheckServer, session } from "../../stores/session"
import BrandLogo from "../brand/BrandLogo.vue"
import IconDevices from "../icons/IconDevices.vue"
import IconHome from "../icons/IconHome.vue"
import IconServer from "../icons/IconServer.vue"
import IconSliders from "../icons/IconSliders.vue"

defineProps<{ chrome: boolean }>()

const ICONS: Record<Page, typeof IconHome> = { home: IconHome, server: IconServer, devices: IconDevices, settings: IconSliders }

const native = Backend().tunnel

const active = computed(() => Math.max(0, PAGES.findIndex((page) => page.id === nav.page)))

const VERSION = __APP_VERSION__

const status = computed(() => {
    switch (connection.phase) {
        case "connected":
            return { label: "Protected", tone: "bg-on shadow-[0_0_8px_rgb(84_232_112/0.7)]" }
        case "connecting":
            return { label: "Connecting", tone: "bg-busy animate-pulse" }
        case "reconnecting":
            return { label: "Reconnecting", tone: "bg-busy animate-pulse" }
        case "disconnecting":
            return { label: "Disconnecting", tone: "bg-idle" }
        case "error":
            return { label: "Couldn't connect", tone: "bg-fail" }
        default:
            return { label: "Not connected", tone: "bg-idle" }
    }
})

const reach = computed(() => {
    const version = session.info?.version ? ` · v${session.info.version}` : ""
    switch (session.reach) {
        case "online":
            return { label: `Server online${version}`, tone: "bg-ok" }
        case "offline":
            return { label: "Server unreachable", tone: "bg-warn" }
        case "checking":
            return { label: "Checking server", tone: "bg-busy animate-pulse" }
        default:
            return { label: "Server status unknown", tone: "bg-idle" }
    }
})
</script>

<template>
    <aside class="flex h-full w-[var(--sidebar)] flex-col border-r border-line bg-[linear-gradient(180deg,#090a13_0%,#07080f_100%)]">
        <div v-if="chrome" class="flex h-[var(--titlebar)] shrink-0 items-center px-5" data-tauri-drag-region>
            <BrandLogo class="pointer-events-none" />
        </div>
        <div v-else class="flex h-16 shrink-0 items-center px-5">
            <BrandLogo />
        </div>
        <nav class="relative mx-3 mt-3 flex flex-col gap-1" aria-label="Main">
            <span
                class="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-md bg-surface-3 shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset] transition-transform duration-300 ease-veil"
                :style="{ transform: `translateY(${active * 44}px)` }"
                aria-hidden="true"
            >
                <span class="absolute left-0 top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_10px_rgb(143_127_255/0.8)]" />
            </span>
            <button
                v-for="page in PAGES"
                :key="page.id"
                type="button"
                class="relative flex h-10 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-semibold transition-colors duration-200 ease-veil"
                :class="nav.page === page.id ? 'text-fg' : 'text-fg-3 hover:bg-white/[0.035] hover:text-fg-2'"
                :aria-current="nav.page === page.id ? 'page' : undefined"
                @click="Go(page.id)"
            >
                <component :is="ICONS[page.id]" class="text-[1.15rem] transition-colors duration-300" :class="nav.page === page.id ? 'text-violet-300' : ''" />
                {{ page.label }}
            </button>
        </nav>
        <div class="mt-auto flex flex-col gap-3 border-t border-line px-5 py-4">
            <button v-if="native" type="button" class="flex items-center gap-2.5 text-left" @click="Go('home')">
                <span class="size-2 shrink-0 rounded-full" :class="status.tone" aria-hidden="true" />
                <span class="min-w-0">
                    <span class="block text-small font-semibold text-fg">{{ status.label }}</span>
                    <span class="tech block truncate text-[0.75rem] text-fg-3">{{ session.info?.name ?? Host(session.profile?.server ?? "") }}</span>
                </span>
            </button>
            <button type="button" class="flex items-center gap-2.5 text-left text-[0.75rem] text-fg-3 transition-colors hover:text-fg-2" title="Check the server again" @click="CheckServer()">
                <span class="size-1.5 shrink-0 rounded-full" :class="reach.tone" aria-hidden="true" />
                {{ reach.label }}
            </button>
            <p class="text-[0.75rem] text-fg-4">VeylVPN {{ native ? "for Windows" : "web" }} {{ VERSION }}</p>
        </div>
    </aside>
</template>
