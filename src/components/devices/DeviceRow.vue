<script setup lang="ts">
import { nextTick, ref } from "vue"
import { Describe } from "../../adapters/errors"
import type { Device } from "../../domain"
import { DateText, ValidDeviceName } from "../../lib/format"
import { RenameDevice } from "../../stores/devices"
import { Notify } from "../../stores/toasts"
import IconDevices from "../icons/IconDevices.vue"
import IconLaptop from "../icons/IconLaptop.vue"
import IconPencil from "../icons/IconPencil.vue"
import IconTrash from "../icons/IconTrash.vue"

const props = defineProps<{ device: Device; current: boolean; renamable: boolean }>()

const emit = defineEmits<{ remove: [device: Device] }>()

const editing = ref(false)
const draft = ref("")
const saving = ref(false)
const problem = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)

async function Edit() {
    draft.value = props.device.name
    problem.value = null
    editing.value = true
    await nextTick()
    input.value?.select()
}

function Cancel() {
    editing.value = false
    problem.value = null
}

async function Save() {
    if (!ValidDeviceName(draft.value)) {
        problem.value = "Use 1 to 32 characters."
        return
    }
    if (draft.value.trim() === props.device.name) {
        Cancel()
        return
    }
    saving.value = true
    try {
        await RenameDevice(props.device.id, draft.value)
        editing.value = false
        Notify("Renamed", "success")
    } catch (error) {
        problem.value = Describe(error).message
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <div class="row group flex items-center gap-3.5 px-4 py-3">
        <span class="relative grid size-10 shrink-0 place-items-center rounded-[13px] text-[1.1rem]" :class="current ? 'bg-violet-500/20 text-violet-200' : 'bg-white/[0.06] text-fg-3'">
            <component :is="current ? IconLaptop : IconDevices" />
            <span v-if="device.online" class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#0b0d1c] bg-ok" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
            <form v-if="editing" class="flex items-center gap-2" @submit.prevent="Save" @keydown.escape.stop="Cancel">
                <input
                    ref="input"
                    v-model="draft"
                    class="h-9 min-w-0 flex-1 rounded-[11px] bg-white/[0.06] px-3 text-body text-fg outline-none ring-1 ring-inset ring-white/10 focus:ring-violet-400/70"
                    maxlength="32"
                    aria-label="Device name"
                    :aria-invalid="problem ? true : undefined"
                    spellcheck="false"
                />
                <button type="submit" class="h-9 rounded-full bg-white px-3.5 text-small font-bold text-ink-950 disabled:opacity-60" :disabled="saving">{{ saving ? "Saving" : "Save" }}</button>
            </form>
            <template v-else>
                <p class="truncate font-semibold text-fg">
                    {{ device.name }}<span v-if="current" class="ml-2 text-small font-medium text-violet-300">This computer</span>
                </p>
                <p class="mt-0.5 text-small text-fg-3">{{ device.online ? "Online now" : "Offline" }} · {{ DateText(device.created) }}</p>
            </template>
            <p v-if="problem" class="mt-1 text-small text-[#ff8a84]" role="alert">{{ problem }}</p>
        </div>
        <div v-if="!editing" class="actions flex shrink-0 items-center gap-1">
            <button v-if="renamable" type="button" class="action" :aria-label="`Rename ${device.name}`" @click="Edit"><IconPencil /></button>
            <button type="button" class="action danger" :aria-label="`Remove ${device.name}`" @click="emit('remove', device)"><IconTrash /></button>
        </div>
    </div>
</template>

<style scoped>
.row {
    transition: background 200ms var(--ease-veil);
}

.row:hover {
    background: rgb(255 255 255 / 0.025);
}

.actions {
    opacity: 0;
    transform: translateX(6px);
    transition:
        opacity 200ms var(--ease-veil),
        transform 200ms var(--ease-veil);
}

.row:hover .actions,
.row:focus-within .actions {
    opacity: 1;
    transform: none;
}

.action {
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    border-radius: 999px;
    color: var(--color-fg-3);
    transition:
        background 160ms var(--ease-veil),
        color 160ms var(--ease-veil);
}

.action:hover {
    background: rgb(255 255 255 / 0.07);
    color: var(--color-fg);
}

.action.danger:hover {
    background: rgb(255 90 82 / 0.12);
    color: #ff8a84;
}

@media (hover: none) {
    .actions {
        opacity: 1;
        transform: none;
    }
}
</style>
