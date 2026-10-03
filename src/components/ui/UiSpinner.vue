<template>
    <span class="spinner inline-flex items-center gap-[0.18em]" aria-hidden="true">
        <span v-for="index in 3" :key="index" class="block size-[0.32em] rounded-[0.08em] bg-current" :style="{ animationDelay: `${(index - 1) * 140}ms` }" />
    </span>
</template>

<style scoped>
.spinner > span {
    animation: blink 0.9s var(--ease-in-out-soft) infinite;
}

@keyframes blink {
    0%,
    100% {
        opacity: 0.25;
    }
    40% {
        opacity: 1;
    }
}
</style>
