<script setup lang="ts">
import { Backend } from "../../backend"
import type { WindowAction } from "../../backend/bridge"
import IconMinus from "../icons/IconMinus.vue"
import IconSquare from "../icons/IconSquare.vue"
import IconX from "../icons/IconX.vue"

const BUTTONS: { action: WindowAction; label: string }[] = [
    { action: "min", label: "Minimize" },
    { action: "max", label: "Maximize or restore" },
    { action: "close", label: "Close" },
]

function Run(action: WindowAction) {
    Backend().Window(action)
}
</script>

<template>
    <div class="flex h-full items-stretch">
        <button
            v-for="button in BUTTONS"
            :key="button.action"
            type="button"
            class="grid w-11 place-items-center text-fg-3 transition-colors duration-150 focus-visible:rounded-none focus-visible:outline-offset-[-2px]"
            :class="button.action === 'close' ? 'hover:bg-[#c4352f] hover:text-white' : 'hover:bg-white/[0.06] hover:text-fg'"
            :aria-label="button.label"
            :title="button.label"
            @click="Run(button.action)"
        >
            <IconMinus v-if="button.action === 'min'" class="text-[0.95rem]" />
            <IconSquare v-else-if="button.action === 'max'" class="text-[0.8rem]" />
            <IconX v-else class="text-[0.95rem]" />
        </button>
    </div>
</template>
