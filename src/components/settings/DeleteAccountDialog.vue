<script setup lang="ts">
import { ref, watch } from "vue"
import { Describe } from "../../adapters/errors"
import type { VpnError } from "../../domain"
import { DeleteAccount } from "../../stores/session"
import { Notify } from "../../stores/toasts"
import UiButton from "../ui/UiButton.vue"
import UiDialog from "../ui/UiDialog.vue"
import UiField from "../ui/UiField.vue"

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ close: [] }>()

const password = ref("")
const busy = ref(false)
const failure = ref<VpnError | null>(null)

watch(
    () => props.open,
    () => {
        password.value = ""
        failure.value = null
    },
)

async function Run() {
    if (!password.value) {
        return
    }
    busy.value = true
    failure.value = null
    try {
        await DeleteAccount(password.value)
        password.value = ""
        emit("close")
        Notify("Account deleted", "info", 4200)
    } catch (error) {
        failure.value = Describe(error)
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <UiDialog :open="open" title="Delete account" :locked="busy" @close="emit('close')">
        <form class="flex flex-col gap-4" @submit.prevent="Run">
            <p class="text-small text-fg-2">This deletes your account on your server and revokes every device on it right away, including this computer. It can't be undone.</p>
            <UiField v-model="password" type="password" label="Confirm with your password" autocomplete="current-password" />
            <p v-if="failure" class="rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-small text-fg-2" role="alert">
                <span class="font-semibold text-fg">{{ failure.title }}.</span> {{ failure.message }}
            </p>
            <div class="flex justify-end gap-2">
                <UiButton variant="ghost" :disabled="busy" @click="emit('close')">Cancel</UiButton>
                <UiButton type="submit" variant="danger" :loading="busy" :disabled="!password">Delete account</UiButton>
            </div>
        </form>
    </UiDialog>
</template>
