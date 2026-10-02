<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue"
import { Notify } from "../../stores/toasts"
import IconCheck from "../icons/IconCheck.vue"
import IconCopy from "../icons/IconCopy.vue"

const props = withDefaults(defineProps<{ value: string; label: string; text?: boolean }>(), { text: false })

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function Copy() {
    try {
        await navigator.clipboard.writeText(props.value)
        copied.value = true
        clearTimeout(timer)
        timer = setTimeout(() => {
            copied.value = false
        }, 1600)
    } catch {
        Notify("Couldn't copy to the clipboard", "error")
    }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
    <button
        type="button"
        class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-fg-3 transition-colors duration-150 hover:bg-white/[0.06] hover:text-fg"
        :class="text ? 'h-8 px-3 text-small font-semibold' : 'size-8'"
        :aria-label="copied ? 'Copied' : label"
        @click="Copy"
    >
        <component :is="copied ? IconCheck : IconCopy" :class="copied && 'text-ok'" />
        <span v-if="text">{{ copied ? "Copied" : "Copy" }}</span>
        <span class="sr-only" aria-live="polite">{{ copied ? "Copied" : "" }}</span>
    </button>
</template>
