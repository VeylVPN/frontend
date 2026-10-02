<script setup lang="ts">
import { Dismiss, toasts } from "../../stores/toasts"
import IconAlert from "../icons/IconAlert.vue"
import IconCheck from "../icons/IconCheck.vue"
import IconInfo from "../icons/IconInfo.vue"
</script>

<template>
    <div class="pointer-events-none fixed inset-x-0 bottom-6 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        <TransitionGroup name="toast">
            <button
                v-for="toast in toasts"
                :key="toast.id"
                type="button"
                class="toast pointer-events-auto flex items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-4 text-small font-semibold text-fg"
                @click="Dismiss(toast.id)"
            >
                <span class="grid size-5 place-items-center rounded-full text-[0.75rem]" :class="toast.tone === 'error' ? 'bg-danger/25 text-[#ff9b95]' : toast.tone === 'success' ? 'bg-ok/20 text-ok' : 'bg-violet-500/25 text-violet-200'">
                    <component :is="toast.tone === 'error' ? IconAlert : toast.tone === 'success' ? IconCheck : IconInfo" />
                </span>
                {{ toast.message }}
            </button>
        </TransitionGroup>
    </div>
</template>

<style scoped>
.toast {
    background: rgb(18 20 40 / 0.92);
    box-shadow:
        0 0 0 1px rgb(255 255 255 / 0.08) inset,
        0 20px 50px -18px rgb(0 0 0 / 0.95);
    backdrop-filter: blur(12px);
}

.toast-enter-active {
    transition:
        opacity 420ms var(--ease-veil),
        transform 520ms cubic-bezier(0.34, 1.4, 0.64, 1);
}

.toast-leave-active {
    transition:
        opacity 220ms var(--ease-veil),
        transform 220ms var(--ease-veil);
}

.toast-enter-from {
    opacity: 0;
    transform: translateY(16px) scale(0.92);
}

.toast-leave-to {
    opacity: 0;
    transform: scale(0.95);
}

.toast-move {
    transition: transform 320ms var(--ease-veil);
}
</style>
