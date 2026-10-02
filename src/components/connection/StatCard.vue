<script setup lang="ts">
import type { Component } from "vue"

withDefaults(defineProps<{ icon: Component; label: string; value: string; sub?: string; mono?: boolean; accent?: boolean; action?: string }>(), {
    sub: "",
    mono: false,
    accent: false,
    action: undefined,
})

const emit = defineEmits<{ press: [] }>()
</script>

<template>
    <button
        v-if="action"
        type="button"
        :aria-label="`${action}: ${label} ${value}`"
        class="card flex min-w-0 flex-col items-start rounded-[22px] border p-4 text-left transition-[border-color,background] duration-200 ease-veil hover:border-line-3"
        :class="accent ? 'border-violet-400/35' : 'border-line'"
        @click="emit('press')"
    >
        <span class="grid size-8 place-items-center rounded-full text-[1rem]" :class="accent ? 'bg-violet-500/20 text-violet-200' : 'bg-white/[0.06] text-fg-2'">
            <component :is="icon" />
        </span>
        <span class="mt-3 text-[0.75rem] text-fg-3">{{ label }}</span>
        <span class="mt-0.5 w-full truncate font-bold text-fg" :class="mono ? 'tech !text-[0.9375rem]' : 'text-[0.9875rem] tracking-[-0.01em]'">{{ value }}</span>
        <span v-if="sub" class="tech mt-0.5 w-full truncate !text-[0.75rem] text-fg-3">{{ sub }}</span>
    </button>
    <div v-else class="card flex min-w-0 flex-col items-start rounded-[22px] border p-4" :class="accent ? 'border-violet-400/35' : 'border-line'">
        <span class="grid size-8 place-items-center rounded-full text-[1rem]" :class="accent ? 'bg-violet-500/20 text-violet-200' : 'bg-white/[0.06] text-fg-2'">
            <component :is="icon" />
        </span>
        <span class="mt-3 text-[0.75rem] text-fg-3">{{ label }}</span>
        <span class="mt-0.5 w-full truncate font-bold text-fg" :class="mono ? 'tech !text-[0.9375rem]' : 'text-[0.9875rem] tracking-[-0.01em]'">{{ value }}</span>
        <span v-if="sub" class="tech mt-0.5 w-full truncate !text-[0.75rem] text-fg-3">{{ sub }}</span>
    </div>
</template>

<style scoped>
.card {
    background: linear-gradient(180deg, rgb(22 24 44 / 0.92) 0%, rgb(12 13 26 / 0.94) 100%);
    box-shadow:
        0 1px 0 0 rgb(255 255 255 / 0.05) inset,
        0 24px 50px -30px rgb(0 0 0 / 0.95);
}
</style>
