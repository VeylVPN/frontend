<script setup lang="ts">
import { computed, useId } from "vue"

const GLYPHS: Record<string, string[]> = {
    V: ["X...X", "X...X", ".X.X.", ".X.X.", "..X.."],
    E: ["XXXX", "X...", "XXX.", "X...", "XXXX"],
    Y: ["X...X", ".X.X.", "..X..", "..X..", "..X.."],
    L: ["X...", "X...", "X...", "X...", "XXXX"],
    P: ["XXX.", "X..X", "XXX.", "X...", "X..."],
    N: ["X...X", "XX..X", "X.X.X", "X..XX", "X...X"],
}

const props = withDefaults(defineProps<{ text?: string; dim?: number }>(), { text: "VEYLVPN", dim: 4 })

const id = useId()

const layout = computed(() => {
    const cells: { x: number; y: number; order: number; tail: boolean }[] = []
    let cursor = 0
    ;[...props.text].forEach((letter, index) => {
        const glyph = GLYPHS[letter]
        if (!glyph) {
            return
        }
        glyph.forEach((row, y) => {
            ;[...row].forEach((value, x) => {
                if (value === "X") {
                    cells.push({ x: cursor + x, y, order: cursor + x + y, tail: index >= props.dim })
                }
            })
        })
        cursor += (glyph[0]?.length ?? 0) + 1
    })
    return { cells, width: cursor - 1 }
})
</script>

<template>
    <svg class="wordmark" :viewBox="`0 0 ${layout.width} 5`" fill="none" aria-label="VeylVPN" role="img">
        <defs>
            <linearGradient :id="`${id}-word`" x1="0" y1="0" x2="0" y2="5" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#ffffff" />
                <stop offset="0.6" stop-color="#c9c1ff" />
                <stop offset="1" stop-color="#7a66ff" />
            </linearGradient>
        </defs>
        <rect
            v-for="cell in layout.cells"
            :key="`${cell.x}-${cell.y}`"
            class="cell"
            :x="cell.x + 0.08"
            :y="cell.y + 0.08"
            width="0.84"
            height="0.84"
            rx="0.18"
            :fill="cell.tail ? '#8b90b8' : `url(#${id}-word)`"
            :style="{ animationDelay: `${cell.order * 18}ms` }"
        />
    </svg>
</template>

<style scoped>
.cell {
    animation: assemble 560ms var(--ease-veil) both;
    transform-box: fill-box;
    transform-origin: center;
}

@keyframes assemble {
    from {
        opacity: 0;
        transform: scale(0.2);
    }
    60% {
        opacity: 1;
    }
    to {
        opacity: 1;
        transform: none;
    }
}
</style>
