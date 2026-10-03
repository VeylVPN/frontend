<script setup lang="ts">
import { ref, watch } from "vue"
import { Describe } from "../../adapters/errors"
import { Backend } from "../../backend"
import type { VpnError } from "../../domain"
import { SignOut } from "../../stores/session"
import UiButton from "../ui/UiButton.vue"
import UiDialog from "../ui/UiDialog.vue"

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ close: [] }>()

const native = Backend().mode === "native"
const revoke = ref(true)
const busy = ref(false)
const failure = ref<VpnError | null>(null)

watch(
    () => props.open,
    () => {
        revoke.value = true
        failure.value = null
    },
)

async function Run() {
    busy.value = true
    failure.value = null
    try {
        await SignOut(native && revoke.value)
        emit("close")
    } catch (error) {
        failure.value = Describe(error)
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <UiDialog :open="open" title="Sign out" :locked="busy" @close="emit('close')">
        <div class="flex flex-col gap-4">
            <p v-if="native" class="text-small text-fg-2">VeylVPN disconnects, then deletes your saved sign-in and this computer's key from this computer.</p>
            <p v-else class="text-small text-fg-2">Your credentials are only kept in this page's memory, and signing out forgets them.</p>
            <label v-if="native" class="flex cursor-pointer gap-3 rounded-md border border-line bg-surface-2/60 p-3.5">
                <input v-model="revoke" type="checkbox" class="mt-1 size-4 shrink-0 accent-violet-500" />
                <span>
                    <span class="block text-small font-semibold text-fg">Also remove this computer from my account</span>
                    <span class="mt-0.5 block text-small text-fg-3">Revokes its certificate and frees a device slot. Leave it on unless you plan to sign back in right away.</span>
                </span>
            </label>
            <p v-if="failure" class="rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-small text-fg-2" role="alert">
                <span class="font-semibold text-fg">{{ failure.title }}.</span> {{ failure.message }}
            </p>
            <div class="flex justify-end gap-2">
                <UiButton variant="ghost" :disabled="busy" data-initial @click="emit('close')">Cancel</UiButton>
                <UiButton variant="primary" :loading="busy" @click="Run">Sign out</UiButton>
            </div>
        </div>
    </UiDialog>
</template>
