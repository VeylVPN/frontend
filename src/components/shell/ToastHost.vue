<script setup lang="ts">
import { Dismiss, toasts } from "../../stores/toasts"
import IconAlert from "../icons/IconAlert.vue"
import IconCheck from "../icons/IconCheck.vue"
import IconInfo from "../icons/IconInfo.vue"
</script>

<template>
    <div class="pointer-events-none fixed bottom-5 right-5 z-[var(--z-toast)] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col items-end gap-2" aria-live="polite" role="status">
        <TransitionGroup name="collapse">
            <button
                v-for="toast in toasts"
                :key="toast.id"
                type="button"
                class="pointer-events-auto flex w-full items-center gap-3 rounded-md border bg-elevated px-4 py-3 text-left text-small text-fg shadow-dialog"
                :class="toast.tone === 'error' ? 'border-danger/35' : toast.tone === 'success' ? 'border-ok/30' : 'border-line-violet'"
                @click="Dismiss(toast.id)"
            >
                <component
                    :is="toast.tone === 'error' ? IconAlert : toast.tone === 'success' ? IconCheck : IconInfo"
                    class="shrink-0 text-[1.05rem]"
                    :class="toast.tone === 'error' ? 'text-danger' : toast.tone === 'success' ? 'text-ok' : 'text-violet-300'"
                />
                <span class="flex-1">{{ toast.message }}</span>
            </button>
        </TransitionGroup>
    </div>
</template>
