<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { Describe } from "../../adapters/errors"
import type { VpnError } from "../../domain"
import { ValidDeviceName } from "../../lib/format"
import { AddDevice } from "../../stores/devices"
import { Notify } from "../../stores/toasts"
import IconAlert from "../icons/IconAlert.vue"
import IconDownload from "../icons/IconDownload.vue"
import UiButton from "../ui/UiButton.vue"
import UiCopy from "../ui/UiCopy.vue"
import UiDialog from "../ui/UiDialog.vue"
import UiField from "../ui/UiField.vue"

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ close: [] }>()

const name = ref("")
const profile = ref("")
const busy = ref(false)
const problem = ref<string | null>(null)
const failure = ref<VpnError | null>(null)

const file = computed(() => {
    const slug = name.value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    return `veyl-${slug || "device"}.ovpn`
})

watch(
    () => props.open,
    (open) => {
        if (open) {
            name.value = ""
            profile.value = ""
            problem.value = null
            failure.value = null
        } else {
            profile.value = ""
        }
    },
)

async function Create() {
    problem.value = null
    failure.value = null
    if (!ValidDeviceName(name.value)) {
        problem.value = "Use 1 to 32 characters."
        return
    }
    busy.value = true
    try {
        profile.value = await AddDevice(name.value)
    } catch (error) {
        failure.value = Describe(error)
    } finally {
        busy.value = false
    }
}

function Download() {
    const url = URL.createObjectURL(new Blob([profile.value], { type: "application/x-openvpn-profile" }))
    const link = document.createElement("a")
    link.href = url
    link.download = file.value
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    Notify(`Saved ${file.value}`, "success")
}

function Close() {
    profile.value = ""
    emit("close")
}
</script>

<template>
    <UiDialog :open="open" :title="profile ? 'Profile ready' : 'Add a device'" :locked="busy" @close="Close">
        <form v-if="!profile" class="flex flex-col gap-4" @submit.prevent="Create">
            <p class="text-small text-fg-2">
                VeylVPN creates a key for the new device on this computer, asks your server to sign a certificate for it, and gives you an OpenVPN profile to import on that device.
            </p>
            <UiField v-model="name" label="Device name" placeholder="Pixel 8" hint="Shown in your device list. 1 to 32 characters." :error="problem" :maxlength="32" />
            <p v-if="failure" class="rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-small text-fg-2" role="alert">
                <span class="font-semibold text-fg">{{ failure.title }}.</span> {{ failure.message }}
            </p>
            <div class="mt-1 flex justify-end gap-2">
                <UiButton variant="ghost" :disabled="busy" @click="Close">Cancel</UiButton>
                <UiButton type="submit" variant="primary" :loading="busy">{{ busy ? "Generating keys" : "Create profile" }}</UiButton>
            </div>
        </form>
        <div v-else class="flex flex-col gap-4">
            <p class="text-small text-fg-2">Import this file into the OpenVPN app on <span class="font-semibold text-fg">{{ name.trim() }}</span>. It works with the OpenVPN Connect app and with OpenVPN 2.5 or newer.</p>
            <div class="flex gap-3 rounded-md border border-warn/30 bg-warn/[0.06] p-3.5 text-small text-fg-2">
                <IconAlert class="mt-0.5 shrink-0 text-warn" />
                <p>The profile contains this device's private key and is shown only now. Anyone with the file can connect as that device, so remove it from your list if the file leaks.</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <UiButton variant="primary" @click="Download"><IconDownload />Save {{ file }}</UiButton>
                <UiCopy :value="profile" label="Copy profile" text class="!h-10 border border-line-2 !px-4" />
            </div>
            <div class="flex justify-end">
                <UiButton variant="ghost" @click="Close">Done</UiButton>
            </div>
        </div>
    </UiDialog>
</template>
