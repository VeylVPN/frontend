<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue"
import IconX from "../icons/IconX.vue"

const props = defineProps<{ open: boolean; title: string; subtitle?: string }>()

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const id = useId()
let previous: HTMLElement | null = null

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])"

function Keys(event: KeyboardEvent) {
    if (document.querySelector("dialog[open]")) {
        return
    }
    if (event.key === "Escape" && !event.defaultPrevented) {
        emit("close")
        return
    }
    Trap(event)
}

function Trap(event: KeyboardEvent) {
    if (event.key !== "Tab" || !panel.value) {
        return
    }
    const items = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null)
    const first = items[0]
    const last = items.at(-1)
    if (!first || !last) {
        return
    }
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
    }
}

async function Focus() {
    await nextTick()
    panel.value?.querySelector<HTMLElement>("[data-initial]")?.focus()
}

watch(
    () => props.open,
    (open) => {
        if (open) {
            previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
            document.addEventListener("keydown", Keys)
            void Focus()
        } else {
            document.removeEventListener("keydown", Keys)
            previous?.focus()
            previous = null
        }
    },
    { immediate: true },
)

onBeforeUnmount(() => document.removeEventListener("keydown", Keys))
</script>

<template>
    <Transition name="sheet" :duration="{ enter: 560, leave: 300 }">
        <div v-if="open" class="fixed inset-x-0 bottom-0 top-[60px] z-30">
            <button type="button" class="shade absolute inset-0 cursor-default" tabindex="-1" aria-label="Close panel" @click="emit('close')" />
            <aside ref="panel" class="panel absolute bottom-0 right-0 top-0 flex w-[min(500px,100vw)] flex-col" role="dialog" aria-modal="true" :aria-labelledby="`${id}-title`">
                <header class="flex items-start justify-between gap-4 px-7 pb-2 pt-6">
                    <div class="min-w-0">
                        <h2 :id="`${id}-title`" class="truncate text-[1.85rem] font-bold leading-tight tracking-[-0.035em] text-fg">{{ title }}</h2>
                        <p v-if="subtitle" class="mt-1 text-small text-fg-3">{{ subtitle }}</p>
                    </div>
                    <button type="button" class="close mt-1 grid size-9 shrink-0 place-items-center rounded-full text-fg-2" aria-label="Close" data-initial @click="emit('close')">
                        <IconX />
                    </button>
                </header>
                <div class="items min-h-0 flex-1 overflow-y-auto px-7 pb-10 pt-2">
                    <slot />
                </div>
            </aside>
        </div>
    </Transition>
</template>

<style scoped>
.shade {
    background: rgb(3 4 12 / 0.5);
}

.panel {
    background:
        radial-gradient(120% 45% at 100% 0%, rgb(76 55 224 / 0.16), transparent 60%),
        linear-gradient(180deg, #0c0e1f 0%, #080915 100%);
    box-shadow:
        1px 0 0 0 rgb(255 255 255 / 0.07) inset,
        0 1px 0 0 rgb(255 255 255 / 0.05) inset,
        -40px 0 120px -40px rgb(0 0 0 / 0.95);
    border-top-left-radius: 28px;
}

.sheet-enter-active .shade {
    animation: shade-in 420ms var(--ease-veil) both;
}

.sheet-leave-active .shade {
    animation: shade-in 300ms var(--ease-veil) reverse both;
}

.sheet-enter-active .panel {
    animation: slide-in 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.sheet-leave-active .panel {
    animation: slide-out 300ms cubic-bezier(0.7, 0, 0.84, 0) both;
}

.sheet-enter-active .items > :deep(*) {
    animation: item-in 600ms var(--ease-veil) both;
    animation-delay: 80ms;
}

.sheet-enter-active .items > :deep(*:nth-child(2)) {
    animation-delay: 140ms;
}

.sheet-enter-active .items > :deep(*:nth-child(3)) {
    animation-delay: 200ms;
}

.sheet-enter-active .items > :deep(*:nth-child(4)) {
    animation-delay: 260ms;
}

.sheet-enter-active .items > :deep(*:nth-child(n + 5)) {
    animation-delay: 320ms;
}

.close {
    background: rgb(255 255 255 / 0.05);
    box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08) inset;
    transition:
        background 200ms var(--ease-veil),
        color 200ms var(--ease-veil),
        transform 320ms var(--ease-veil);
}

.close:hover {
    background: rgb(255 255 255 / 0.1);
    color: var(--color-fg);
    transform: rotate(90deg);
}

@keyframes slide-in {
    from {
        transform: translateX(104%);
    }
    to {
        transform: none;
    }
}

@keyframes slide-out {
    to {
        transform: translateX(104%);
    }
}

@keyframes item-in {
    from {
        opacity: 0;
        transform: translateX(28px);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

@keyframes shade-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
</style>
