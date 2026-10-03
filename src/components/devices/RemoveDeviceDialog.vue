<script setup lang="ts">
import { ref, watch } from "vue"
import { Describe } from "../../adapters/errors"
import type { Device, VpnError } from "../../domain"
import { IsCurrent, RemoveDevice } from "../../stores/devices"
import { SignOut } from "../../stores/session"
import { Notify } from "../../stores/toasts"
import UiButton from "../ui/UiButton.vue"
import UiDialog from "../ui/UiDialog.vue"

const props = defineProps<{ device: Device | null }>()

const emit = defineEmits<{ close: [] }>()

const busy = ref(false)
const failure = ref<VpnError | null>(null)

watch(
    () => props.device,
    () => {
        failure.value = null
    },
)

async function Remove() {
    const device = props.device
    if (!device) {
        return
    }
    const own = IsCurrent(device.id)
    busy.value = true
    failure.value = null
    try {
        await RemoveDevice(device.id)
        busy.value = false
        emit("close")
        if (own) {
            await SignOut(false)
            Notify("This computer was removed and signed out", "info", 4200)
        } else {
            Notify(`${device.name} removed`, "success")
        }
    } catch (error) {
        failure.value = Describe(error)
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <UiDialog :open="device !== null" :title="device ? `Remove ${device.name}?` : 'Remove device'" :locked="busy" @close="emit('close')">
        <div v-if="device" class="flex flex-col gap-4">
            <p class="text-small text-fg-2">Its certificate is revoked right away and any live session on it ends. It can't connect again unless you add it back.</p>
            <p v-if="IsCurrent(device.id)" class="rounded-md border border-warn/30 bg-warn/[0.06] px-3.5 py-2.5 text-small text-fg-2">
                This is the computer you're using. VeylVPN disconnects and signs you out here.
            </p>
            <p v-if="failure" class="rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-small text-fg-2" role="alert">
                <span class="font-semibold text-fg">{{ failure.title }}.</span> {{ failure.message }}
            </p>
            <div class="flex justify-end gap-2">
                <UiButton variant="ghost" :disabled="busy" data-initial @click="emit('close')">Cancel</UiButton>
                <UiButton variant="danger" :loading="busy" @click="Remove">Remove device</UiButton>
            </div>
        </div>
    </UiDialog>
</template>
