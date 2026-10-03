<script setup lang="ts">
import { Backend } from "../../backend"
import { Go, nav } from "../../stores/nav"
import BrandWordmark from "../brand/BrandWordmark.vue"
import IconDevices from "../icons/IconDevices.vue"
import IconSliders from "../icons/IconSliders.vue"
import IconButton from "./IconButton.vue"
import WindowControls from "./WindowControls.vue"

withDefaults(defineProps<{ menus?: boolean }>(), { menus: true })

const native = Backend().mode === "native"
</script>

<template>
    <header class="relative z-40 grid h-[60px] shrink-0 grid-cols-[1fr_auto_1fr] items-center" data-tauri-drag-region>
        <div class="flex items-center pl-4" data-tauri-drag-region>
            <IconButton v-if="menus" label="Settings" :active="nav.sheet === 'settings'" @click="Go(nav.sheet === 'settings' ? 'home' : 'settings')">
                <IconSliders />
            </IconButton>
        </div>
        <BrandWordmark class="pointer-events-none h-[13px]" />
        <div class="flex h-full items-start justify-end" data-tauri-drag-region>
            <IconButton v-if="menus" class="mr-3 mt-[10px]" label="Devices" :active="nav.sheet === 'devices'" @click="Go(nav.sheet === 'devices' ? 'home' : 'devices')">
                <IconDevices />
            </IconButton>
            <WindowControls v-if="native" class="h-9" />
            <span v-else class="w-1" />
        </div>
    </header>
</template>
