<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string; tag?: "section" | "div" }>(), { title: "", description: "", tag: "section" })
</script>

<template>
    <component :is="tag" class="rounded-lg border border-line bg-surface-1/80">
        <header v-if="title || $slots.aside" class="flex items-start justify-between gap-4 px-5 pb-1 pt-4">
            <div class="min-w-0">
                <h2 v-if="title" class="font-bold tracking-[-0.015em] text-fg">{{ title }}</h2>
                <p v-if="description" class="mt-0.5 text-small text-fg-3">{{ description }}</p>
            </div>
            <slot name="aside" />
        </header>
        <slot />
    </component>
</template>
