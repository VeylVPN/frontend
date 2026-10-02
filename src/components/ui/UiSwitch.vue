<script setup lang="ts">
const model = defineModel<boolean>({ required: true })

withDefaults(defineProps<{ disabled?: boolean; busy?: boolean; label: string }>(), { disabled: false, busy: false })
</script>

<template>
    <button
        type="button"
        role="switch"
        :aria-checked="model"
        :aria-label="label"
        :aria-busy="busy || undefined"
        :disabled="disabled || busy"
        class="relative inline-flex h-6 w-10.5 shrink-0 items-center rounded-full border transition-[background,border-color,opacity] duration-200 ease-veil disabled:opacity-50"
        :class="model ? 'border-violet-400/60 bg-violet-600' : 'border-line-2 bg-surface-4'"
        @click="model = !model"
    >
        <span
            class="absolute left-[3px] size-4 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.5)] transition-transform duration-200 ease-veil"
            :class="[model ? 'translate-x-[18px]' : 'translate-x-0', busy && 'animate-pulse']"
        />
    </button>
</template>
