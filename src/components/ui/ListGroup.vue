<script setup lang="ts">
withDefaults(defineProps<{ title?: string; hint?: string }>(), { title: "", hint: "" })
</script>

<template>
    <section class="mt-8 first:mt-3">
        <div v-if="title || $slots.aside" class="mb-2.5 flex items-end justify-between gap-3 px-1">
            <div class="min-w-0">
                <h3 v-if="title" class="text-[1.02rem] font-bold tracking-[-0.015em] text-fg">{{ title }}</h3>
                <p v-if="hint" class="mt-0.5 text-small text-fg-3">{{ hint }}</p>
            </div>
            <slot name="aside" />
        </div>
        <div class="group-box overflow-hidden rounded-[20px]">
            <slot />
        </div>
    </section>
</template>

<style scoped>
.group-box {
    background: linear-gradient(180deg, rgb(255 255 255 / 0.035), rgb(255 255 255 / 0.018));
    box-shadow: 0 0 0 1px rgb(255 255 255 / 0.065) inset;
}

.group-box > :deep(* + *) {
    box-shadow: 0 -1px 0 0 rgb(255 255 255 / 0.055);
}
</style>
