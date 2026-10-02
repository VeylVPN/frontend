<script setup lang="ts">
import IconAlert from "../icons/IconAlert.vue"
import IconInfo from "../icons/IconInfo.vue"
import IconX from "../icons/IconX.vue"

withDefaults(defineProps<{ tone?: "info" | "warn" | "danger"; title: string; dismissible?: boolean }>(), { tone: "info", dismissible: false })

const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
    <div
        class="flex gap-3.5 rounded-lg border p-4"
        :class="{
            'border-line-violet bg-violet-500/[0.06]': tone === 'info',
            'border-warn/30 bg-warn/[0.06]': tone === 'warn',
            'border-danger/30 bg-danger/[0.06]': tone === 'danger',
        }"
        :role="tone === 'info' ? 'status' : 'alert'"
    >
        <component
            :is="tone === 'info' ? IconInfo : IconAlert"
            class="mt-0.5 shrink-0 text-[1.15rem]"
            :class="{ 'text-violet-300': tone === 'info', 'text-warn': tone === 'warn', 'text-danger': tone === 'danger' }"
        />
        <div class="min-w-0 flex-1">
            <p class="font-semibold text-fg">{{ title }}</p>
            <div class="mt-0.5 text-small text-fg-2">
                <slot />
            </div>
            <div v-if="$slots.actions" class="mt-3 flex flex-wrap items-center gap-2">
                <slot name="actions" />
            </div>
        </div>
        <button
            v-if="dismissible"
            type="button"
            class="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-full text-fg-3 transition-colors duration-150 hover:bg-white/[0.06] hover:text-fg"
            aria-label="Dismiss"
            @click="emit('dismiss')"
        >
            <IconX />
        </button>
    </div>
</template>
