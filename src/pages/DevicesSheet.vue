<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import AddDeviceDialog from "../components/devices/AddDeviceDialog.vue"
import DeviceRow from "../components/devices/DeviceRow.vue"
import RemoveDeviceDialog from "../components/devices/RemoveDeviceDialog.vue"
import IconPlus from "../components/icons/IconPlus.vue"
import ListGroup from "../components/ui/ListGroup.vue"
import UiButton from "../components/ui/UiButton.vue"
import type { Device } from "../domain"
import { devices, IsCurrent, LoadDevices } from "../stores/devices"

const adding = ref(false)
const removing = ref<Device | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

const full = computed(() => devices.limit > 0 && devices.list.length >= devices.limit)

const ordered = computed(() => [...devices.list].sort((a, b) => Number(IsCurrent(b.id)) - Number(IsCurrent(a.id)) || Number(b.online) - Number(a.online)))

const online = computed(() => devices.list.filter((device) => device.online).length)

onMounted(() => {
    void LoadDevices()
    timer = setInterval(() => {
        if (document.visibilityState === "visible" && !adding.value && !removing.value) {
            void LoadDevices()
        }
    }, 15000)
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
    <div class="flex items-center gap-3">
        <div v-if="devices.status === 'ready'" class="flex-1">
            <p class="text-[2.4rem] font-bold leading-none tracking-[-0.04em] text-fg">
                {{ devices.list.length }}<span class="text-fg-4">/{{ devices.limit }}</span>
            </p>
            <p class="mt-1.5 text-small text-fg-3">{{ online }} online now</p>
        </div>
        <div v-else class="flex-1" aria-hidden="true">
            <span class="block h-9 w-20 animate-pulse rounded-[10px] bg-white/[0.07]" />
            <span class="mt-2 block h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
        </div>
        <UiButton variant="primary" size="lg" :disabled="full || devices.status !== 'ready'" @click="adding = true"><IconPlus />Add device</UiButton>
    </div>

    <p v-if="full" class="mt-4 text-small text-fg-3">At your limit. Remove a device to add another.</p>

    <ListGroup>
        <div v-if="devices.status === 'loading'" class="divide-y divide-white/[0.055]" aria-hidden="true">
            <div v-for="index in 3" :key="index" class="flex items-center gap-3.5 px-4 py-3.5">
                <span class="size-10 rounded-[13px] bg-white/[0.06]" />
                <span class="flex-1">
                    <span class="block h-3.5 w-36 rounded bg-white/[0.07]" />
                    <span class="mt-2 block h-3 w-24 rounded bg-white/[0.04]" />
                </span>
            </div>
        </div>
        <div v-else-if="devices.status === 'error' && devices.error" class="px-4 py-5 text-small text-fg-2">
            <p>{{ devices.error.message }}</p>
            <button type="button" class="mt-2 font-semibold text-violet-300 hover:text-violet-200" @click="LoadDevices()">Try again</button>
        </div>
        <p v-else-if="!devices.list.length" class="px-4 py-6 text-center text-small text-fg-3">No devices yet.</p>
        <TransitionGroup v-else tag="div" name="collapse" class="divide-y divide-white/[0.055]">
            <DeviceRow v-for="device in ordered" :key="device.id" :device="device" :current="IsCurrent(device.id)" renamable @remove="removing = $event" />
        </TransitionGroup>
    </ListGroup>

    <p class="mt-4 px-1 text-[0.75rem] text-fg-4">Each device has its own key, made on that device. Online status is read live and never stored.</p>

    <AddDeviceDialog :open="adding" @close="adding = false" />
    <RemoveDeviceDialog :device="removing" @close="removing = null" />
</template>
