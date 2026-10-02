<script setup lang="ts">
import type { Component } from "vue"

withDefaults(defineProps<{ icon: Component; label: string; value: string; sub?: string; accent?: boolean; action?: string }>(), {
    sub: "",
    accent: false,
    action: undefined,
})

const emit = defineEmits<{ press: [] }>()

function Track(event: PointerEvent) {
    const element = event.currentTarget as HTMLElement
    const box = element.getBoundingClientRect()
    element.style.setProperty("--x", `${event.clientX - box.left}px`)
    element.style.setProperty("--y", `${event.clientY - box.top}px`)
}
</script>

<template>
    <button
        v-if="action"
        type="button"
        :aria-label="`${action}: ${label} ${value}`"
        class="quick interactive relative flex min-w-0 flex-col items-start overflow-hidden rounded-[24px] p-4 text-left"
        :class="accent && 'accent'"
        @click="emit('press')"
        @pointermove="Track"
    >
        <span class="spot pointer-events-none absolute inset-0" aria-hidden="true" />
        <span class="relative grid size-8 place-items-center rounded-full text-[0.95rem]" :class="accent ? 'bg-violet-500/25 text-violet-100' : 'bg-white/[0.07] text-fg-2'">
            <component :is="icon" />
        </span>
        <span class="relative mt-4 text-[0.75rem] font-medium text-fg-3">{{ label }}</span>
        <span class="relative mt-0.5 w-full truncate text-[1.05rem] font-bold tracking-[-0.015em] text-fg">{{ value }}</span>
        <span v-if="sub" class="tech relative mt-0.5 w-full truncate !text-[0.72rem] text-fg-4">{{ sub }}</span>
    </button>
    <div v-else class="quick relative flex min-w-0 flex-col items-start overflow-hidden rounded-[24px] p-4" :class="accent && 'accent'">
        <span class="relative grid size-8 place-items-center rounded-full text-[0.95rem]" :class="accent ? 'bg-violet-500/25 text-violet-100' : 'bg-white/[0.07] text-fg-2'">
            <component :is="icon" />
        </span>
        <span class="relative mt-4 text-[0.75rem] font-medium text-fg-3">{{ label }}</span>
        <span class="relative mt-0.5 w-full truncate text-[1.05rem] font-bold tracking-[-0.015em] text-fg">{{ value }}</span>
        <span v-if="sub" class="tech relative mt-0.5 w-full truncate !text-[0.72rem] text-fg-4">{{ sub }}</span>
    </div>
</template>

<style scoped>
.quick {
    background: linear-gradient(180deg, rgb(24 27 52 / 0.86) 0%, rgb(13 15 32 / 0.92) 100%);
    box-shadow:
        0 0 0 1px rgb(255 255 255 / 0.06) inset,
        0 1px 0 0 rgb(255 255 255 / 0.06) inset,
        0 24px 50px -28px rgb(0 0 0 / 0.95);
    transition:
        transform 280ms var(--ease-veil),
        box-shadow 280ms var(--ease-veil);
}

.quick.accent {
    box-shadow:
        0 0 0 1px rgb(143 127 255 / 0.32) inset,
        0 1px 0 0 rgb(255 255 255 / 0.08) inset,
        0 24px 50px -28px rgb(76 55 224 / 0.8);
}

.spot {
    opacity: 0;
    background: radial-gradient(220px circle at var(--x, 50%) var(--y, 50%), rgb(143 127 255 / 0.16), transparent 60%);
    transition: opacity 280ms var(--ease-veil);
}

.interactive:hover {
    transform: translateY(-3px);
    box-shadow:
        0 0 0 1px rgb(179 168 255 / 0.22) inset,
        0 1px 0 0 rgb(255 255 255 / 0.08) inset,
        0 30px 60px -28px rgb(76 55 224 / 0.6);
}

.interactive:hover .spot {
    opacity: 1;
}

.interactive:active {
    transform: translateY(-1px) scale(0.985);
}
</style>
