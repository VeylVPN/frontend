<script setup lang="ts">
import type { Component } from "vue"

defineProps<{ icon: Component; title: string; text?: string }>()
</script>

<template>
    <div class="flex flex-col items-center px-6 py-12 text-center">
        <span class="grid size-12 place-items-center rounded-full border border-line-violet bg-violet-500/[0.08] text-[1.35rem] text-violet-300">
            <component :is="icon" />
        </span>
        <p class="mt-4 text-section font-bold text-fg">{{ title }}</p>
        <p v-if="text" class="mt-1.5 max-w-sm text-small text-fg-3">{{ text }}</p>
        <div v-if="$slots.default" class="mt-5 flex flex-wrap justify-center gap-2">
            <slot />
        </div>
    </div>
</template>
