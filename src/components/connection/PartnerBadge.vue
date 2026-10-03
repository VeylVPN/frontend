<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from "vue"
import { FormatAsn, type PartnerNetwork } from "../../partners/registry"
import IconPartner from "../icons/IconPartner.vue"

const props = withDefaults(defineProps<{ partner: PartnerNetwork; compact?: boolean; align?: "start" | "end"; reveal?: boolean }>(), { compact: false, align: "start", reveal: false })

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const id = useId()

function Outside(event: PointerEvent) {
    if (!root.value?.contains(event.target as Node | null)) {
        open.value = false
    }
}

function Leave(event: FocusEvent) {
    if (!root.value?.contains(event.relatedTarget as Node | null)) {
        open.value = false
    }
}

watch(open, (value) => {
    if (value) {
        document.addEventListener("pointerdown", Outside)
    } else {
        document.removeEventListener("pointerdown", Outside)
    }
})

onBeforeUnmount(() => document.removeEventListener("pointerdown", Outside))
</script>

<template>
    <span ref="root" class="relative inline-flex">
        <button
            type="button"
            class="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-violet-400/30 bg-[linear-gradient(180deg,rgb(113_92_255/0.16),rgb(82_107_255/0.06))] text-left shadow-[0_0_24px_-10px_rgb(113_92_255/0.8)] transition-[border-color,background] duration-200 hover:border-violet-300/55"
            :class="[compact ? 'h-8 px-3' : 'py-1.5 pl-2 pr-3.5', props.reveal && 'reveal']"
            :aria-expanded="open"
            :aria-controls="id"
            :title="`VeylVPN Partner Network: ${props.partner.display}`"
            @click="open = !open"
            @keydown.escape="open = false"
            @blur="Leave"
        >
            <IconPartner class="shrink-0 text-violet-300" :class="compact ? 'text-[0.95rem]' : 'text-[1.15rem]'" />
            <span v-if="compact" class="text-[0.78rem] font-semibold text-violet-100">Partner network <span class="text-violet-300">·</span> {{ partner.display }}</span>
            <span v-else class="flex flex-col leading-tight">
                <span class="text-[0.7rem] font-semibold text-violet-300/90">VeylVPN Partner Network</span>
                <span class="text-small font-bold text-fg">{{ partner.display }}</span>
            </span>
        </button>
        <Transition name="collapse">
            <div
                v-if="open"
                :id="id"
                class="absolute top-[calc(100%+8px)] z-[var(--z-raised)] w-[19rem] rounded-lg border border-line-violet bg-elevated p-4 text-left shadow-dialog"
                :class="align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'"
            >
                <p class="text-[0.75rem] font-semibold text-violet-300">VeylVPN Partner Network</p>
                <p class="mt-0.5 font-bold text-fg">{{ partner.display }}</p>
                <p class="mt-2 text-small text-fg-2">This VPN endpoint is operating on infrastructure from a recognized VeylVPN partner.</p>
                <dl class="mt-3 flex items-center justify-between border-t border-line pt-3 text-small">
                    <dt class="text-fg-3">Network</dt>
                    <dd class="tech text-fg">{{ FormatAsn(partner.asn) }}</dd>
                </dl>
                <p class="mt-3 text-[0.75rem] leading-relaxed text-fg-3">
                    Matched from the network that announces your VPN exit address. It doesn't mean VeylVPN or {{ partner.display }} operates or has audited this server.
                </p>
            </div>
        </Transition>
    </span>
</template>

<style scoped>
.reveal {
    animation: badge-in 700ms var(--ease-veil) both;
}

.reveal::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 20%, rgb(232 228 255 / 0.45) 50%, transparent 80%);
    transform: translateX(-120%);
    animation: shimmer 1.4s 350ms var(--ease-in-out-soft) both;
    pointer-events: none;
}

@keyframes badge-in {
    from {
        opacity: 0;
        transform: scale(0.9);
        filter: blur(4px);
    }
    to {
        opacity: 1;
        transform: none;
        filter: none;
    }
}

@keyframes shimmer {
    to {
        transform: translateX(120%);
    }
}
</style>
