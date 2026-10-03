<script setup lang="ts">
withDefaults(defineProps<{ label: string; active?: boolean }>(), { active: false })
</script>

<template>
    <button type="button" class="icon-button grid size-10 place-items-center rounded-[14px] text-[1.15rem]" :class="active && 'active'" :aria-label="label" :title="label">
        <slot />
    </button>
</template>

<style scoped>
.icon-button {
    color: var(--color-fg-2);
    background: rgb(255 255 255 / 0.045);
    box-shadow:
        0 0 0 1px rgb(255 255 255 / 0.07) inset,
        0 1px 0 0 rgb(255 255 255 / 0.06) inset;
    transition:
        background 200ms var(--ease-veil),
        color 200ms var(--ease-veil),
        transform 200ms var(--ease-veil),
        box-shadow 200ms var(--ease-veil);
}

.icon-button:hover {
    color: var(--color-fg);
    background: rgb(255 255 255 / 0.09);
}

.icon-button:active {
    transform: scale(0.94);
}

.icon-button.active {
    color: var(--color-fg);
    background: rgb(113 92 255 / 0.22);
    box-shadow:
        0 0 0 1px rgb(143 127 255 / 0.45) inset,
        0 0 24px -6px rgb(113 92 255 / 0.8);
}
</style>
