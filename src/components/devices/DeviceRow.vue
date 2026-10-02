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
import UiBadge from "../ui/UiBadge.vue"
import UiButton from "../ui/UiButton.vue"

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
        Notify("Device renamed", "success")
    } catch (error) {
        problem.value = Describe(error).message
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <li class="flex items-center gap-4 border-t border-line px-5 py-3.5 first:border-t-0">
        <span class="grid size-10 shrink-0 place-items-center rounded-md border text-[1.15rem]" :class="current ? 'border-line-violet bg-violet-500/[0.1] text-violet-300' : 'border-line bg-surface-2 text-fg-3'">
            <component :is="current ? IconLaptop : IconDevices" />
        </span>
        <div class="min-w-0 flex-1">
            <form v-if="editing" class="flex flex-wrap items-center gap-2" @submit.prevent="Save" @keydown.escape.stop="Cancel">
                <input
                    ref="input"
                    v-model="draft"
                    class="h-9 min-w-0 flex-1 rounded-md border border-line-2 bg-surface-1 px-3 text-body text-fg outline-none focus:border-violet-400/70"
                    :class="problem && 'border-danger/60'"
                    maxlength="32"
                    aria-label="Device name"
                    :aria-invalid="problem ? true : undefined"
                    spellcheck="false"
                />
                <UiButton size="sm" type="submit" variant="primary" :loading="saving">Save</UiButton>
                <UiButton size="sm" variant="ghost" :disabled="saving" @click="Cancel">Cancel</UiButton>
                <p v-if="problem" class="w-full text-small text-[#ff8a84]" role="alert">{{ problem }}</p>
            </form>
            <template v-else>
                <p class="flex items-center gap-2">
                    <span class="truncate font-semibold text-fg">{{ device.name }}</span>
                    <UiBadge v-if="current" tone="violet">This device</UiBadge>
                </p>
                <p class="mt-0.5 flex items-center gap-1.5 text-small text-fg-3">
                    <span class="size-1.5 rounded-full" :class="device.online ? 'bg-ok shadow-[0_0_6px_rgb(84_232_112/0.7)]' : 'bg-fg-4'" aria-hidden="true" />
                    {{ device.online ? "Online now" : "Offline" }}
                    <span aria-hidden="true">·</span>
                    Added {{ DateText(device.created) }}
                </p>
            </template>
        </div>
        <div v-if="!editing" class="flex shrink-0 items-center gap-1">
            <button
                v-if="renamable"
                type="button"
                class="grid size-9 place-items-center rounded-full text-fg-3 transition-colors duration-150 hover:bg-white/[0.06] hover:text-fg"
                :aria-label="`Rename ${device.name}`"
                @click="Edit"
            >
                <IconPencil />
            </button>
            <button
                type="button"
                class="grid size-9 place-items-center rounded-full text-fg-3 transition-colors duration-150 hover:bg-danger/[0.1] hover:text-[#ff8a84]"
                :aria-label="`Remove ${device.name}`"
                @click="emit('remove', device)"
            >
                <IconTrash />
            </button>
        </div>
    </li>
</template>
