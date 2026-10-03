<script setup lang="ts">
withDefaults(defineProps<{ label: string; hint?: string; id?: string }>(), { hint: "", id: undefined })
</script>

<template>
    <div class="flex min-h-[3.6rem] items-center gap-4 px-4 py-3">
        <div class="min-w-0 flex-1">
            <p :id="id" class="text-[0.95rem] font-semibold text-fg">{{ label }}</p>
            <p v-if="hint" class="mt-0.5 text-small leading-snug text-fg-3">{{ hint }}</p>
            <slot name="below" />
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <slot />
        </div>
    </div>
</template>
