<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{ value: string; state: "idle" | "busy" | "live" }>()

const chars = computed(() => [...props.value].map((char, index) => ({ char, index, colon: char === ":", tail: index >= props.value.length - 2 })))
</script>

<template>
    <p class="odometer flex items-center justify-center font-bold leading-none tracking-[-0.04em]" :data-state="state" aria-hidden="true">
        <template v-for="item in chars" :key="item.index">
            <span v-if="item.colon" class="colon">:</span>
            <span v-else class="cell" :class="item.tail && 'tail'" :style="{ '--i': item.index }">
                <Transition name="roll">
                    <span :key="item.char" class="digit">{{ item.char }}</span>
                </Transition>
            </span>
        </template>
    </p>
</template>

<style scoped>
.odometer {
    font-variant-numeric: tabular-nums;
    height: 1.02em;
}

.cell {
    position: relative;
    display: inline-block;
    width: 0.6em;
    height: 1.08em;
    overflow: hidden;
    text-align: center;
}

.digit {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--color-white);
    transition:
        color 700ms var(--ease-veil),
        opacity 700ms var(--ease-veil),
        text-shadow 700ms var(--ease-veil);
}

.tail .digit {
    color: #8a8fac;
}

.colon {
    display: inline-block;
    width: 0.3em;
    text-align: center;
    transform: translateY(-0.06em);
    color: var(--color-white);
    transition:
        color 700ms var(--ease-veil),
        opacity 700ms var(--ease-veil);
}

.odometer[data-state="idle"] .digit,
.odometer[data-state="idle"] .colon {
    color: rgb(150 160 230 / 0.13);
}

.odometer[data-state="busy"] .digit,
.odometer[data-state="busy"] .colon {
    color: rgb(170 175 255 / 0.18);
}

.odometer[data-state="busy"] .cell .digit {
    animation: scan 1.6s var(--ease-in-out-soft) infinite;
    animation-delay: calc(var(--i) * 90ms);
}

.odometer[data-state="live"] .digit {
    text-shadow: 0 0 40px rgb(143 127 255 / 0.25);
}

.roll-enter-active,
.roll-leave-active {
    transition:
        transform 420ms var(--ease-veil),
        opacity 420ms var(--ease-veil),
        filter 420ms var(--ease-veil);
}

.roll-enter-from {
    transform: translateY(70%);
    opacity: 0;
    filter: blur(3px);
}

.roll-leave-to {
    transform: translateY(-70%);
    opacity: 0;
    filter: blur(3px);
}

@keyframes scan {
    0%,
    100% {
        color: rgb(170 175 255 / 0.16);
    }
    45% {
        color: rgb(214 210 255 / 0.85);
        text-shadow: 0 0 24px rgb(143 127 255 / 0.6);
    }
}
</style>
