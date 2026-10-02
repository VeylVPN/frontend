<script setup lang="ts">
import { useId } from "vue"

withDefaults(defineProps<{ tone?: "gradient" | "white" }>(), { tone: "gradient" })

const id = useId()

const PIXELS = [0, 1, 2, 3, 2, 1, 0]
</script>

<template>
    <svg viewBox="0 0 7 4" fill="none" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient :id="`${id}-mark`" x1="0" y1="0" x2="7" y2="4" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#d4ceff" />
                <stop offset="0.55" stop-color="#8f7fff" />
                <stop offset="1" stop-color="#526bff" />
            </linearGradient>
        </defs>
        <rect
            v-for="(row, column) in PIXELS"
            :key="column"
            :x="column + 0.11"
            :y="row + 0.11"
            width="0.78"
            height="0.78"
            rx="0.2"
            :fill="tone === 'white' ? '#ffffff' : `url(#${id}-mark)`"
        />
    </svg>
</template>
