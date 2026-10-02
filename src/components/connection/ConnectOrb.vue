<script setup lang="ts">
import { useId } from "vue"
import type { GlobeTone } from "../../domain"

withDefaults(defineProps<{ tone: GlobeTone; label: string; action: string; disabled?: boolean }>(), { disabled: false })

const emit = defineEmits<{ press: [] }>()

const PIXELS = [0, 1, 2, 3, 2, 1, 0]

const id = useId()
</script>

<template>
    <button type="button" class="orb group relative grid aspect-square place-items-center rounded-full" :data-tone="tone" :aria-label="action" :disabled="disabled" @click="emit('press')">
        <span class="halo absolute -inset-[34%] rounded-full" aria-hidden="true" />
        <span class="track absolute inset-0 rounded-full" aria-hidden="true" />
        <span class="fill absolute inset-0 rounded-full" aria-hidden="true" />
        <span class="arc absolute inset-0 rounded-full" aria-hidden="true" />
        <span class="core absolute inset-[11%] rounded-full" aria-hidden="true" />
        <span class="relative flex flex-col items-center gap-[0.7em]" aria-hidden="true">
            <svg class="mark w-[2.5em] overflow-visible" viewBox="0 0 7 4" fill="none" aria-hidden="true">
                <defs>
                    <linearGradient :id="`${id}-mark`" x1="0" y1="0" x2="7" y2="4" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stop-color="#ffffff" />
                        <stop offset="0.6" stop-color="#e2ddff" />
                        <stop offset="1" stop-color="#b3a8ff" />
                    </linearGradient>
                </defs>
                <rect
                    v-for="(row, column) in PIXELS"
                    :key="column"
                    class="px"
                    :x="column + 0.11"
                    :y="row + 0.11"
                    width="0.78"
                    height="0.78"
                    rx="0.2"
                    :fill="`url(#${id}-mark)`"
                    :style="{ '--i': column }"
                />
            </svg>
            <span class="relative grid h-[1.3em] min-w-[7em] place-items-center">
                <Transition name="swap" mode="out-in">
                    <span :key="label" class="label text-[0.92em] font-semibold tracking-[-0.01em]">{{ label }}</span>
                </Transition>
            </span>
        </span>
    </button>
</template>

<style scoped>
.orb {
    transition: transform 260ms var(--ease-veil);
    -webkit-tap-highlight-color: transparent;
}

.orb:not(:disabled):active {
    transform: scale(0.955);
}

.orb:focus-visible {
    outline-offset: 8px;
    border-radius: 999px;
}

.halo {
    background: radial-gradient(circle, rgb(113 92 255 / 0.55) 0%, rgb(82 107 255 / 0.2) 38%, transparent 66%);
    opacity: 0.18;
    filter: blur(10px);
    transform: scale(0.85);
    transition:
        opacity 900ms var(--ease-veil),
        transform 900ms var(--ease-veil);
}

.track {
    background: linear-gradient(180deg, #2e3154 0%, #1a1c33 100%);
    box-shadow:
        0 0 0 1px rgb(212 206 255 / 0.12) inset,
        0 40px 80px -30px rgb(0 0 0 / 0.95);
    transition: background 500ms var(--ease-veil);
}

.fill {
    --sweep: 0deg;
    background: conic-gradient(from -90deg, #d9d3ff 0deg, #8f7fff calc(var(--sweep) * 0.6), #b3a8ff var(--sweep), transparent var(--sweep));
    mask: radial-gradient(closest-side, transparent 88.5%, #000 89.5%);
    filter: drop-shadow(0 0 14px rgb(143 127 255 / 0.65));
    transition: --sweep 1100ms cubic-bezier(0.7, 0, 0.2, 1);
}

.arc {
    opacity: 0;
    background: conic-gradient(from 0deg, transparent 0 58%, rgb(214 210 255 / 0.15) 66%, rgb(235 232 255 / 0.95) 84%, transparent 85%);
    mask: radial-gradient(closest-side, transparent 88.5%, #000 89.5%);
    transition: opacity 400ms var(--ease-veil);
}

.core {
    background: radial-gradient(circle at 50% 26%, #1d1c3e 0%, #0d0c22 55%, #07071300 100%), #08081a;
    box-shadow:
        0 18px 40px -12px rgb(0 0 0 / 0.9) inset,
        0 -12px 34px -18px rgb(143 127 255 / 0.5) inset,
        0 0 0 1px rgb(0 0 0 / 0.55);
    transition: box-shadow 700ms var(--ease-veil);
}

.px {
    opacity: 0.32;
    transform-box: fill-box;
    transform-origin: center;
    transition:
        opacity 500ms var(--ease-veil),
        transform 500ms var(--ease-veil);
}

.label {
    color: var(--color-fg-2);
    transition: color 400ms var(--ease-veil);
}

.orb[data-tone="idle"]:not(:disabled):hover .track {
    background: linear-gradient(180deg, #3b3a72 0%, #1f1d48 100%);
}

.orb[data-tone="idle"]:not(:disabled):hover .halo {
    opacity: 0.45;
    transform: scale(0.95);
}

.orb[data-tone="idle"]:not(:disabled):hover .px {
    opacity: 0.85;
}

.orb[data-tone="idle"]:not(:disabled):hover .label {
    color: var(--color-fg);
}

.orb[data-tone="busy"] .halo {
    opacity: 0.55;
    transform: scale(0.95);
}

.orb[data-tone="busy"] .track {
    background: linear-gradient(180deg, #2b2470 0%, #171245 100%);
}

.orb[data-tone="busy"] .arc {
    opacity: 1;
    animation: orbit 1.25s linear infinite;
}

.orb[data-tone="busy"] .px {
    animation: charge 1.5s var(--ease-in-out-soft) infinite;
    animation-delay: calc(var(--i) * 110ms);
}

.orb[data-tone="busy"] .label,
.orb[data-tone="on"] .label {
    color: var(--color-fg);
}

.orb[data-tone="on"] .halo {
    opacity: 1;
    transform: scale(1.05);
}

.orb[data-tone="on"] .fill {
    --sweep: 360deg;
}

.orb[data-tone="on"] .core {
    box-shadow:
        0 18px 40px -12px rgb(0 0 0 / 0.9) inset,
        0 -16px 40px -14px rgb(143 127 255 / 0.85) inset,
        0 0 0 1px rgb(0 0 0 / 0.55);
}

.orb[data-tone="on"] .px {
    opacity: 1;
    animation: pop 700ms var(--ease-veil) both;
    animation-delay: calc(500ms + var(--i) * 45ms);
}

.orb[data-tone="on"] .mark {
    filter: drop-shadow(0 0.25em 0.8em rgb(143 127 255 / 0.85));
}

.orb[data-tone="fail"] .track {
    background: linear-gradient(180deg, #4a2032 0%, #24111c 100%);
    box-shadow:
        0 0 0 1px rgb(255 90 82 / 0.3) inset,
        0 30px 70px -30px rgb(255 90 82 / 0.45);
}

.orb[data-tone="fail"] .label {
    color: #ff9b95;
}

@keyframes orbit {
    to {
        transform: rotate(360deg);
    }
}

@keyframes charge {
    0%,
    100% {
        opacity: 0.3;
        transform: scale(0.85);
    }
    45% {
        opacity: 1;
        transform: scale(1.08);
    }
}

@keyframes pop {
    0% {
        transform: scale(0.6);
    }
    55% {
        transform: scale(1.18);
    }
    100% {
        transform: none;
    }
}
</style>
