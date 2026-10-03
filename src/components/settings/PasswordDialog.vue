<script setup lang="ts">
import { ref, watch } from "vue"
import { Describe } from "../../adapters/errors"
import type { VpnError } from "../../domain"
import { ChangePassword } from "../../stores/session"
import { Notify } from "../../stores/toasts"
import UiButton from "../ui/UiButton.vue"
import UiDialog from "../ui/UiDialog.vue"
import UiField from "../ui/UiField.vue"

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ close: [] }>()

const next = ref("")
const repeat = ref("")
const busy = ref(false)
const problem = ref<{ field: string; message: string } | null>(null)
const failure = ref<VpnError | null>(null)

watch(
    () => props.open,
    () => {
        next.value = ""
        repeat.value = ""
        problem.value = null
        failure.value = null
    },
)

async function Save() {
    problem.value = null
    failure.value = null
    if (next.value.length < 10 || next.value.length > 256) {
        problem.value = { field: "next", message: "Use 10 to 256 characters." }
        return
    }
    if (next.value !== repeat.value) {
        problem.value = { field: "repeat", message: "The passwords don't match." }
        return
    }
    busy.value = true
    try {
        await ChangePassword(next.value)
        next.value = ""
        repeat.value = ""
        emit("close")
        Notify("Password changed", "success")
    } catch (error) {
        failure.value = Describe(error)
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <UiDialog :open="open" title="Change password" :locked="busy" @close="emit('close')">
        <form class="flex flex-col gap-4" @submit.prevent="Save">
            <p class="text-small text-fg-2">
                Your password manages devices on your account. VPN connections keep working, but other computers signed in with the old password will ask you to sign in again.
            </p>
            <UiField v-model="next" type="password" label="New password" autocomplete="new-password" :error="problem?.field === 'next' ? problem.message : null" hint="10 to 256 characters." />
            <UiField v-model="repeat" type="password" label="Repeat new password" autocomplete="new-password" :error="problem?.field === 'repeat' ? problem.message : null" />
            <p v-if="failure" class="rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-small text-fg-2" role="alert">
                <span class="font-semibold text-fg">{{ failure.title }}.</span> {{ failure.message }}
            </p>
            <div class="flex justify-end gap-2">
                <UiButton variant="ghost" :disabled="busy" @click="emit('close')">Cancel</UiButton>
                <UiButton type="submit" variant="primary" :loading="busy">Change password</UiButton>
            </div>
        </form>
    </UiDialog>
</template>
