<script setup lang="ts">
import { computed } from "vue"
import UiSpinner from "./UiSpinner.vue"

const props = withDefaults(
    defineProps<{
        variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet"
        size?: "sm" | "md" | "lg"
        type?: "button" | "submit"
        disabled?: boolean
        loading?: boolean
        block?: boolean
    }>(),
    { variant: "secondary", size: "md", type: "button", disabled: false, loading: false, block: false },
)

const classes = computed(() => [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-[-0.01em] transition-[background,box-shadow,color,transform,border-color,opacity] duration-200 ease-veil active:scale-[0.98] disabled:active:scale-100",
    props.size === "lg" ? "h-13 px-8 text-[1rem]" : props.size === "sm" ? "h-8 px-3.5 text-small" : "h-10 px-5 text-[0.9rem]",
    props.block && "w-full",
    props.variant === "primary" &&
        "bg-[linear-gradient(180deg,#ffffff_0%,#e4e0ff_100%)] text-ink-950 shadow-button hover:shadow-[0_1px_0_0_rgb(255_255_255/0.6)_inset,0_16px_50px_-12px_rgb(143_127_255/1)] disabled:opacity-55 disabled:shadow-none",
    props.variant === "secondary" && "border border-line-2 bg-white/[0.04] text-fg hover:border-line-3 hover:bg-white/[0.08] disabled:opacity-50",
    props.variant === "quiet" && "border border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg disabled:opacity-50",
    props.variant === "ghost" && "text-fg-2 hover:bg-white/[0.05] hover:text-fg disabled:opacity-50",
    props.variant === "danger" && "border border-danger/30 bg-danger/[0.08] text-[#ff8a84] hover:border-danger/50 hover:bg-danger/[0.14] disabled:opacity-50",
])
</script>

<template>
    <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined">
        <UiSpinner v-if="loading" class="text-[0.9em]" />
        <slot />
    </button>
</template>
