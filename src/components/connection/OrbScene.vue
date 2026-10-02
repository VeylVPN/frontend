<script setup lang="ts">
import { ref, watch } from "vue"
import type { StreamMode, Visual, Wave } from "../../composables/stage"
import type { GlobeTone } from "../../domain"
import ConnectOrb from "./ConnectOrb.vue"
import PixelGlobe from "./PixelGlobe.vue"
import TunnelStreams from "./TunnelStreams.vue"

const props = withDefaults(
    defineProps<{
        visual: Visual
        tone: GlobeTone
        streams: StreamMode
        wave: Wave | null
        label: string
        action: string
        size: string
        globe: string
        lift?: number
        still?: boolean
        disabled?: boolean
        orbit?: boolean
    }>(),
    { lift: 0.25, still: false, disabled: false, orbit: true },
)

const emit = defineEmits<{ press: [] }>()

const RATIO = 4.4

const burst = ref(0)

watch(
    () => props.visual,
    (visual) => {
        if (visual === "locking") {
            burst.value++
        }
    },
)
</script>

<template>
    <div class="relative grid place-items-center" :style="{ '--orb': size }">
        <PixelGlobe
            :tone="tone"
            :still="still"
            :wave="wave"
            :orbit="orbit"
            :focus="[0.5, lift]"
            class="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            :style="{ width: globe, transform: `translate(-50%, -${lift * 100}%)` }"
        />
        <div class="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[var(--orb)] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
            <template v-if="visual === 'charging' || visual === 'recovering'">
                <span v-for="index in 3" :key="index" class="gather absolute inset-0 rounded-full" :style="{ animationDelay: `${(index - 1) * 0.6}s` }" />
            </template>
            <template v-if="burst">
                <span :key="`burst-${burst}`" class="burst absolute inset-0 rounded-full" />
                <span :key="`echo-${burst}`" class="burst echo absolute inset-0 rounded-full" />
                <span :key="`flash-${burst}`" class="flash absolute -inset-[60%] rounded-full" />
            </template>
        </div>
        <TunnelStreams :mode="streams" :ratio="RATIO" class="pointer-events-none absolute left-1/2 top-1/2 h-[calc(var(--orb)*4.4)] w-[calc(var(--orb)*4.4)] -translate-x-1/2 -translate-y-1/2" />
        <ConnectOrb
            :tone="tone"
            :label="label"
            :action="action"
            :disabled="disabled"
            :moment="visual === 'locking' ? 'lock' : visual === 'releasing' ? 'release' : null"
            class="relative z-10 w-[var(--orb)] text-[length:calc(var(--orb)/13.5)]"
            @press="emit('press')"
        />
    </div>
</template>

<style scoped>
.gather {
    border: 1.5px solid rgb(190 180 255 / 0.55);
    box-shadow:
        0 0 30px -4px rgb(113 92 255 / 0.75),
        0 0 14px -6px rgb(214 210 255 / 0.9) inset;
    opacity: 0;
    animation: gather 1.8s cubic-bezier(0.55, 0, 0.75, 0.4) infinite;
}

.burst {
    border: 2px solid rgb(236 232 255 / 0.95);
    box-shadow: 0 0 60px 6px rgb(143 127 255 / 0.75);
    animation: burst 1.25s 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.burst.echo {
    border-width: 1px;
    animation: burst 1.6s 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.flash {
    background: radial-gradient(circle, rgb(196 186 255 / 0.62), rgb(82 107 255 / 0.18) 42%, transparent 70%);
    animation: flash 1.6s 80ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes gather {
    0% {
        opacity: 0;
        transform: scale(3);
    }
    35% {
        opacity: 0.7;
    }
    100% {
        opacity: 0;
        transform: scale(1);
    }
}

@keyframes burst {
    0% {
        opacity: 0;
        transform: scale(0.98);
    }
    6% {
        opacity: 1;
    }
    100% {
        opacity: 0;
        transform: scale(4.2);
    }
}

@keyframes flash {
    0% {
        opacity: 0;
        transform: scale(0.4);
    }
    22% {
        opacity: 1;
    }
    100% {
        opacity: 0;
        transform: scale(1.5);
    }
}
</style>
