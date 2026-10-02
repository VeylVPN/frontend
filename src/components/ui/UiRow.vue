<script setup lang="ts">
withDefaults(defineProps<{ label: string; description?: string; id?: string }>(), { description: "", id: undefined })
</script>

<template>
    <div class="flex items-center gap-5 border-t border-line px-5 py-3.5 first:border-t-0">
        <div class="min-w-0 flex-1">
            <p :id="id" class="text-[0.9375rem] font-semibold text-fg">{{ label }}</p>
            <p v-if="description" class="mt-0.5 text-small text-fg-3">{{ description }}</p>
            <slot name="below" />
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <slot />
        </div>
    </div>
</template>
