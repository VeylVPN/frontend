<script setup lang="ts">
withDefaults(defineProps<{ tone?: "neutral" | "violet" | "ok" | "warn" | "danger" }>(), { tone: "neutral" })
</script>

<template>
    <span
        class="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.75rem] font-semibold leading-none"
        :class="{
            'border-line-2 bg-white/[0.04] text-fg-2': tone === 'neutral',
            'border-violet-400/30 bg-violet-500/[0.12] text-violet-200': tone === 'violet',
            'border-ok/30 bg-ok/[0.1] text-ok': tone === 'ok',
            'border-warn/35 bg-warn/[0.1] text-[#f0997a]': tone === 'warn',
            'border-danger/35 bg-danger/[0.1] text-[#ff8a84]': tone === 'danger',
        }"
    >
        <slot />
    </span>
</template>
