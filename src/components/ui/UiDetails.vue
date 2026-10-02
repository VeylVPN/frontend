<script setup lang="ts">
import { ref, useId } from "vue"
import IconChevronDown from "../icons/IconChevronDown.vue"

withDefaults(defineProps<{ label?: string }>(), { label: "Technical details" })

const open = ref(false)
const id = useId()
</script>

<template>
    <div>
        <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full px-1 text-small font-semibold text-fg-3 transition-colors duration-150 hover:text-fg-2"
            :aria-expanded="open"
            :aria-controls="id"
            @click="open = !open"
        >
            {{ label }}
            <IconChevronDown class="transition-transform duration-200 ease-veil" :class="open && 'rotate-180'" />
        </button>
        <Transition name="collapse">
            <div v-if="open" :id="id" class="mt-2">
                <slot />
            </div>
        </Transition>
    </div>
</template>
