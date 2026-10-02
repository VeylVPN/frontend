<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{ value: string }>()

const chars = computed(() => [...props.value])
</script>

<template>
    <p class="clock flex items-baseline justify-center font-bold leading-none tracking-[-0.03em] [text-shadow:none]">
        <span v-for="(char, index) in chars" :key="index" class="inline-block text-center" :class="char === ':' ? 'w-[0.32em] -translate-y-[0.06em]' : 'w-[0.6em]'">{{ char }}</span>
    </p>
</template>

<style scoped>
.clock {
    background-image: linear-gradient(100deg, #ffffff 0%, #ffffff 48%, #c9cbe0 70%, #7f849e 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    padding-block: 0.04em 0.1em;
}
</style>
