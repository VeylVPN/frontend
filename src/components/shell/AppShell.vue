<script setup lang="ts">
import { nextTick, ref, watch } from "vue"
import { Backend } from "../../backend"
import DevicesPage from "../../pages/DevicesPage.vue"
import HomePage from "../../pages/HomePage.vue"
import ServerPage from "../../pages/ServerPage.vue"
import SettingsPage from "../../pages/SettingsPage.vue"
import { Go, nav, PAGES, type Page } from "../../stores/nav"
import IconDevices from "../icons/IconDevices.vue"
import IconHome from "../icons/IconHome.vue"
import IconServer from "../icons/IconServer.vue"
import IconSliders from "../icons/IconSliders.vue"
import SideNav from "./SideNav.vue"
import WindowControls from "./WindowControls.vue"

const VIEWS = { home: HomePage, server: ServerPage, devices: DevicesPage, settings: SettingsPage }

const ICONS: Record<Page, typeof IconHome> = { home: IconHome, server: IconServer, devices: IconDevices, settings: IconSliders }

const native = Backend().mode === "native"

const main = ref<HTMLElement | null>(null)

watch(
    () => nav.page,
    async () => {
        await nextTick()
        main.value?.scrollTo({ top: 0 })
        main.value?.focus({ preventScroll: true })
    },
)
</script>

<template>
    <div class="flex h-full bg-base">
        <SideNav :chrome="native" class="max-[720px]:hidden" />
        <div class="flex min-w-0 flex-1 flex-col">
            <header v-if="native" class="flex h-[var(--titlebar)] shrink-0 justify-end" data-tauri-drag-region>
                <WindowControls />
            </header>
            <main ref="main" class="relative min-h-0 flex-1 overflow-y-auto outline-none" tabindex="-1">
                <div class="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden" aria-hidden="true">
                    <div class="grid-lines absolute inset-0 opacity-70 [mask-image:radial-gradient(70%_80%_at_50%_0%,#000_10%,transparent_75%)]" />
                    <div class="absolute left-1/2 top-[-260px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(101_82_255/0.16),transparent)]" />
                </div>
                <Transition name="page" mode="out-in">
                    <component :is="VIEWS[nav.page]" :key="nav.page" class="relative" />
                </Transition>
            </main>
            <nav class="flex shrink-0 justify-around border-t border-line bg-elevated px-2 pb-2 pt-1.5 min-[721px]:hidden" aria-label="Main">
                <button
                    v-for="page in PAGES"
                    :key="page.id"
                    type="button"
                    class="flex flex-col items-center gap-0.5 rounded-md px-4 py-1.5 text-[0.7rem] font-semibold"
                    :class="nav.page === page.id ? 'text-fg' : 'text-fg-3'"
                    :aria-current="nav.page === page.id ? 'page' : undefined"
                    @click="Go(page.id)"
                >
                    <component :is="ICONS[page.id]" class="text-[1.2rem]" :class="nav.page === page.id && 'text-violet-300'" />
                    {{ page.label }}
                </button>
            </nav>
        </div>
    </div>
</template>
