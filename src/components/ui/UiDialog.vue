<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue"
import IconX from "../icons/IconX.vue"

const props = withDefaults(defineProps<{ open: boolean; title: string; locked?: boolean; wide?: boolean }>(), { locked: false, wide: false })

const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const id = useId()
let previous: HTMLElement | null = null

function Close() {
    if (!props.locked) {
        emit("close")
    }
}

function Cancel(event: Event) {
    event.preventDefault()
    Close()
}

function Backdrop(event: MouseEvent) {
    if (event.target === dialog.value) {
        Close()
    }
}

watch(
    () => props.open,
    async (open) => {
        const element = dialog.value
        if (!element) {
            return
        }
        if (open && !element.open) {
            previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
            element.showModal()
            await nextTick()
            const target = element.querySelector<HTMLElement>("[autofocus], input, textarea, select") ?? element.querySelector<HTMLElement>("[data-initial]")
            target?.focus()
        } else if (!open && element.open) {
            element.close()
            previous?.focus()
            previous = null
        }
    },
    { flush: "post" },
)

onBeforeUnmount(() => {
    if (dialog.value?.open) {
        dialog.value.close()
    }
})
</script>

<template>
    <Teleport to="body">
        <dialog
            ref="dialog"
            class="dialog m-auto max-h-[min(86vh,720px)] w-[calc(100vw-2rem)] overflow-visible bg-transparent p-0 text-fg backdrop:bg-overlay"
            :class="wide ? 'max-w-[560px]' : 'max-w-[440px]'"
            :aria-labelledby="`${id}-title`"
            @cancel="Cancel"
            @mousedown="Backdrop"
        >
            <div v-if="open" class="panel flex max-h-[min(86vh,720px)] flex-col overflow-hidden rounded-xl border border-line-violet bg-elevated shadow-dialog">
                <header class="flex items-start justify-between gap-4 px-6 pt-6">
                    <h2 :id="`${id}-title`" class="text-section font-bold text-fg">{{ title }}</h2>
                    <button
                        type="button"
                        class="-mr-2 -mt-1 grid size-8 place-items-center rounded-full text-fg-3 transition-colors duration-150 hover:bg-white/[0.06] hover:text-fg disabled:opacity-40"
                        :disabled="locked"
                        aria-label="Close"
                        @click="Close"
                    >
                        <IconX />
                    </button>
                </header>
                <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">
                    <slot />
                </div>
            </div>
        </dialog>
    </Teleport>
</template>

<style scoped>
.dialog[open] .panel {
    animation: enter 0.24s var(--ease-veil) both;
}

.dialog::backdrop {
    backdrop-filter: blur(2px);
}

.dialog[open]::backdrop {
    animation: shade 0.2s var(--ease-veil) both;
}

@keyframes enter {
    from {
        opacity: 0;
        transform: translateY(8px) scale(0.985);
    }
}

@keyframes shade {
    from {
        opacity: 0;
    }
}
</style>
