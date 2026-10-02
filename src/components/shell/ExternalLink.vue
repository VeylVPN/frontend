<script setup lang="ts">
import { Backend } from "../../backend"
import { Notify } from "../../stores/toasts"
import IconArrowUpRight from "../icons/IconArrowUpRight.vue"

const props = withDefaults(defineProps<{ href: string; icon?: boolean }>(), { icon: true })

async function Open(event: MouseEvent) {
    event.preventDefault()
    try {
        await Backend().Open(props.href)
    } catch {
        Notify("Couldn't open the link", "error")
    }
}
</script>

<template>
    <a
        :href="href"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 font-semibold text-violet-300 underline decoration-violet-300/30 underline-offset-[3px] transition-colors duration-150 hover:decoration-violet-300"
        @click="Open"
    >
        <slot />
        <IconArrowUpRight v-if="icon" class="text-[0.95em]" />
        <span class="sr-only">(opens in your browser)</span>
    </a>
</template>
