<script setup lang="ts">
const model = defineModel<boolean>({ required: true })

withDefaults(defineProps<{ disabled?: boolean; busy?: boolean; label: string }>(), { disabled: false, busy: false })
</script>

<template>
    <button
        type="button"
        role="switch"
        class="switch relative inline-flex h-[28px] w-[48px] shrink-0 items-center rounded-full"
        :class="model && 'on'"
        :aria-checked="model"
        :aria-label="label"
        :aria-busy="busy || undefined"
        :disabled="disabled || busy"
        @click="model = !model"
    >
        <span class="thumb absolute left-[3px] h-[22px] w-[22px] rounded-full bg-white" :class="busy && 'animate-pulse'" />
    </button>
</template>

<style scoped>
.switch {
    background: rgb(255 255 255 / 0.1);
    box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08) inset;
    transition:
        background 260ms var(--ease-veil),
        box-shadow 260ms var(--ease-veil);
}

.switch.on {
    background: linear-gradient(180deg, #8f7fff, #6552ff);
    box-shadow:
        0 0 0 1px rgb(179 168 255 / 0.5) inset,
        0 6px 20px -6px rgb(113 92 255 / 0.9);
}

.switch:disabled {
    opacity: 0.5;
}

.thumb {
    box-shadow:
        0 2px 6px rgb(0 0 0 / 0.45),
        0 0 0 0.5px rgb(0 0 0 / 0.1);
    transition:
        transform 320ms cubic-bezier(0.34, 1.4, 0.64, 1),
        width 200ms var(--ease-veil);
}

.switch.on .thumb {
    transform: translateX(20px);
}

.switch:active:not(:disabled) .thumb {
    width: 27px;
}

.switch.on:active:not(:disabled) .thumb {
    transform: translateX(15px);
}
</style>
