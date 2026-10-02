<script setup lang="ts">
import BrandMark from "../brand/BrandMark.vue"
import type { GlobeTone } from "../../domain"

withDefaults(defineProps<{ tone: GlobeTone; label: string; action: string; disabled?: boolean }>(), { disabled: false })

const emit = defineEmits<{ press: [] }>()
</script>

<template>
    <button type="button" class="orb group relative grid aspect-square place-items-center rounded-full" :data-tone="tone" :aria-label="action" :disabled="disabled" @click="emit('press')">
        <span class="orb-halo absolute -inset-[28%] rounded-full" aria-hidden="true" />
        <span class="orb-ring absolute inset-0 rounded-full" aria-hidden="true" />
        <span class="orb-arc absolute inset-0 rounded-full" aria-hidden="true" />
        <span class="orb-core absolute inset-[9%] rounded-full" aria-hidden="true" />
        <span class="relative flex flex-col items-center gap-[0.55em]" aria-hidden="true">
            <BrandMark tone="white" class="orb-mark w-[2.4em]" />
            <span class="relative grid h-[1.4em] place-items-center">
                <Transition name="swap" mode="out-in">
                    <span :key="label" class="orb-label text-[0.95em] font-semibold tracking-[-0.01em]">{{ label }}</span>
                </Transition>
            </span>
        </span>
    </button>
</template>

<style scoped>
.orb {
    transition: transform 200ms var(--ease-veil);
}

.orb:not(:disabled):active {
    transform: scale(0.97);
}

.orb:focus-visible {
    outline-offset: 6px;
    border-radius: 999px;
}

.orb-halo {
    background: radial-gradient(circle, rgb(113 92 255 / 0.5) 0%, rgb(82 107 255 / 0.18) 40%, transparent 66%);
    opacity: 0.25;
    filter: blur(8px);
    transition: opacity 900ms var(--ease-veil);
}

.orb-ring {
    background: linear-gradient(180deg, #474a78 0%, #262844 100%);
    box-shadow:
        0 0 0 1px rgb(212 206 255 / 0.2) inset,
        0 30px 70px -30px rgb(0 0 0 / 0.9);
    transition:
        background 700ms var(--ease-veil),
        box-shadow 700ms var(--ease-veil);
}

.orb-arc {
    opacity: 0;
    background: conic-gradient(from 0deg, transparent 0 62%, rgb(212 206 255 / 0.95) 86%, transparent 100%);
    mask: radial-gradient(closest-side, transparent 89%, #000 90.5%);
    transition: opacity 400ms var(--ease-veil);
}

.orb-core {
    background: radial-gradient(circle at 50% 30%, #1b1a3a 0%, #0c0b1f 58%, #070712 100%);
    box-shadow:
        0 14px 34px -10px rgb(0 0 0 / 0.85) inset,
        0 -10px 30px -16px rgb(143 127 255 / 0.4) inset,
        0 0 0 1px rgb(0 0 0 / 0.5);
}

.orb-mark {
    opacity: 0.55;
    transition:
        opacity 600ms var(--ease-veil),
        transform 600ms var(--ease-veil);
}

.orb-label {
    color: var(--color-fg-2);
    transition: color 400ms var(--ease-veil);
}

.orb[data-tone="idle"]:not(:disabled):hover .orb-ring {
    background: linear-gradient(180deg, #6552ff 0%, #2b1fa8 100%);
    box-shadow:
        0 0 0 1px rgb(212 206 255 / 0.3) inset,
        0 24px 60px -24px rgb(76 55 224 / 0.9);
}

.orb[data-tone="idle"]:not(:disabled):hover .orb-mark,
.orb[data-tone="idle"]:not(:disabled):hover .orb-label {
    opacity: 1;
    color: var(--color-fg);
}

.orb[data-tone="busy"] .orb-halo {
    opacity: 0.6;
}

.orb[data-tone="busy"] .orb-ring {
    background: linear-gradient(180deg, #4a37e0 0%, #1c13a0 100%);
}

.orb[data-tone="busy"] .orb-arc {
    opacity: 1;
    animation: orbit 1.3s linear infinite;
}

.orb[data-tone="busy"] .orb-mark {
    opacity: 0.85;
    animation: breathe 1.6s var(--ease-in-out-soft) infinite;
}

.orb[data-tone="busy"] .orb-label {
    color: var(--color-fg);
}

.orb[data-tone="on"] .orb-halo {
    opacity: 1;
}

.orb[data-tone="on"] .orb-ring {
    background:
        radial-gradient(circle at 50% 0%, rgb(232 228 255 / 0.95), transparent 48%),
        radial-gradient(circle at 50% 100%, rgb(143 127 255 / 0.75), transparent 56%),
        linear-gradient(180deg, #b3a8ff 0%, #715cff 55%, #8f7fff 100%);
    box-shadow:
        0 0 0 1px rgb(232 228 255 / 0.45) inset,
        0 30px 80px -26px rgb(113 92 255 / 1),
        0 0 90px -20px rgb(143 127 255 / 0.7);
}

.orb[data-tone="on"] .orb-mark {
    opacity: 1;
    filter: drop-shadow(0 4px 12px rgb(143 127 255 / 0.65));
}

.orb[data-tone="on"] .orb-label {
    color: var(--color-fg);
}

.orb[data-tone="fail"] .orb-ring {
    background: linear-gradient(180deg, #5a2a35 0%, #2a1520 100%);
    box-shadow:
        0 0 0 1px rgb(255 90 82 / 0.35) inset,
        0 24px 60px -26px rgb(255 90 82 / 0.5);
}

.orb[data-tone="fail"] .orb-label {
    color: #ff8a84;
}

@keyframes orbit {
    to {
        transform: rotate(360deg);
    }
}

@keyframes breathe {
    0%,
    100% {
        opacity: 0.55;
        transform: translateY(0);
    }
    50% {
        opacity: 1;
        transform: translateY(-2px);
    }
}
</style>
