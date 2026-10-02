<script setup lang="ts">
import BrandLogo from "../brand/BrandLogo.vue"
import WindowControls from "./WindowControls.vue"
</script>

<template>
    <header class="relative z-[var(--z-chrome)] flex h-[var(--titlebar)] shrink-0 items-stretch justify-between" data-tauri-drag-region>
        <div class="flex items-center px-5" data-tauri-drag-region>
            <BrandLogo class="pointer-events-none" />
        </div>
        <WindowControls />
    </header>
</template>
