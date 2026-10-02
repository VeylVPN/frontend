<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import AddDeviceDialog from "../components/devices/AddDeviceDialog.vue"
import DeviceRow from "../components/devices/DeviceRow.vue"
import RemoveDeviceDialog from "../components/devices/RemoveDeviceDialog.vue"
import IconDevices from "../components/icons/IconDevices.vue"
import IconPlus from "../components/icons/IconPlus.vue"
import IconRefresh from "../components/icons/IconRefresh.vue"
import AccountNotices from "../components/shell/AccountNotices.vue"
import UiButton from "../components/ui/UiButton.vue"
import UiEmpty from "../components/ui/UiEmpty.vue"
import UiNotice from "../components/ui/UiNotice.vue"
import type { Device } from "../domain"
import { devices, IsCurrent, LoadDevices } from "../stores/devices"

const adding = ref(false)
const removing = ref<Device | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

const full = computed(() => devices.limit > 0 && devices.list.length >= devices.limit)

const ordered = computed(() => [...devices.list].sort((a, b) => Number(IsCurrent(b.id)) - Number(IsCurrent(a.id))))

function Visible(): boolean {
    return document.visibilityState === "visible"
}

onMounted(() => {
    void LoadDevices()
    timer = setInterval(() => {
        if (Visible() && !adding.value && !removing.value) {
            void LoadDevices()
        }
    }, 15000)
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
    <div class="mx-auto w-full max-w-[860px] px-[clamp(1.25rem,3vw,2.5rem)] py-8">
        <header class="flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 class="text-heading font-bold text-fg">Devices</h1>
                <p class="mt-1.5 max-w-xl text-fg-2">
                    <template v-if="devices.limit">{{ devices.list.length }} of {{ devices.limit }} in use. </template>Each device has its own key, generated on that device, and you can remove any of them instantly.
                </p>
            </div>
            <div class="flex items-center gap-2">
                <UiButton variant="ghost" size="sm" :loading="devices.status === 'loading'" aria-label="Refresh devices" @click="LoadDevices()">
                    <IconRefresh v-if="devices.status !== 'loading'" />
                    Refresh
                </UiButton>
                <UiButton variant="primary" :disabled="full || devices.status !== 'ready'" @click="adding = true"><IconPlus />Add device</UiButton>
            </div>
        </header>

        <div class="mt-6 flex flex-col gap-3 empty:hidden">
            <AccountNotices />
            <UiNotice v-if="full" tone="info" title="Your account is at its device limit">Remove a device to add another. Your server's admin sets the limit.</UiNotice>
            <UiNotice v-if="devices.error && devices.status === 'ready'" tone="warn" :title="devices.error.title">{{ devices.error.message }}</UiNotice>
        </div>

        <section class="mt-6 overflow-hidden rounded-lg border border-line bg-surface-1/80" aria-label="Devices on your account" :aria-busy="devices.status === 'loading'">
            <ul v-if="devices.status === 'loading'" aria-hidden="true">
                <li v-for="index in 3" :key="index" class="flex items-center gap-4 border-t border-line px-5 py-4 first:border-t-0">
                    <span class="size-10 rounded-md bg-surface-3" />
                    <span class="flex-1">
                        <span class="block h-3.5 w-40 rounded bg-surface-3" />
                        <span class="mt-2 block h-3 w-56 rounded bg-surface-2" />
                    </span>
                </li>
            </ul>
            <UiEmpty v-else-if="devices.status === 'error' && devices.error" :icon="IconDevices" :title="devices.error.title" :text="devices.error.message">
                <UiButton @click="LoadDevices()">Try again</UiButton>
            </UiEmpty>
            <UiEmpty v-else-if="devices.status === 'ready' && !devices.list.length" :icon="IconDevices" title="No devices yet" text="Create a profile for your first phone or computer.">
                <UiButton variant="primary" @click="adding = true"><IconPlus />Add device</UiButton>
            </UiEmpty>
            <TransitionGroup v-else tag="ul" name="collapse">
                <DeviceRow v-for="device in ordered" :key="device.id" :device="device" :current="IsCurrent(device.id)" renamable @remove="removing = $event" />
            </TransitionGroup>
        </section>

        <p class="mt-4 text-small text-fg-3">"Online now" is read live from your server's OpenVPN and is never stored. Creation dates are rounded to the day on purpose.</p>

        <AddDeviceDialog :open="adding" @close="adding = false" />
        <RemoveDeviceDialog :device="removing" @close="removing = null" />
    </div>
</template>
