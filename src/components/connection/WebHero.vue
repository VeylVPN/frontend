<script setup lang="ts">
import { computed, ref } from "vue"
import { Host } from "../../lib/format"
import { LINKS } from "../../lib/links"
import { Go } from "../../stores/nav"
import { prefs } from "../../stores/prefs"
import { session } from "../../stores/session"
import AddDeviceDialog from "../devices/AddDeviceDialog.vue"
import IconDevices from "../icons/IconDevices.vue"
import IconServer from "../icons/IconServer.vue"
import IconShield from "../icons/IconShield.vue"
import ExternalLink from "../shell/ExternalLink.vue"
import ConnectOrb from "./ConnectOrb.vue"
import PixelGlobe from "./PixelGlobe.vue"
import StatCard from "./StatCard.vue"

const adding = ref(false)

const host = computed(() => session.info?.endpoint ?? Host(session.profile?.server ?? ""))
const name = computed(() => session.info?.name ?? host.value)
</script>

<template>
    <section class="relative isolate flex flex-col items-center justify-center overflow-hidden px-6 pb-6 pt-[clamp(0.5rem,3vh,2rem)] text-center [text-shadow:0_2px_14px_rgb(5_5_10/0.95)]" aria-labelledby="web-heading">
        <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_48%_at_50%_56%,rgb(61_82_230/0.16),transparent_72%)]" aria-hidden="true" />
        <h1 id="web-heading" class="text-[clamp(2.1rem,7.5vh,3.5rem)] font-bold leading-[1.05] tracking-[-0.035em] text-fg">Add a device</h1>
        <p class="mt-3 max-w-[34rem] text-small text-fg-2">
            A browser can't run the VPN itself. Create an OpenVPN profile for a phone or computer, then import it into the OpenVPN app there. The key is generated in this browser and never sent to your server.
        </p>
        <div class="relative my-[clamp(0.75rem,3vh,2rem)] grid max-h-[min(46vh,460px)] min-h-[clamp(136px,25vh,212px)] w-full flex-1 place-items-center">
            <PixelGlobe tone="on" :still="!prefs.motion" class="pointer-events-none absolute left-1/2 top-1/2 w-[clamp(430px,94vh,900px)] -translate-x-1/2 -translate-y-1/2 max-[720px]:w-[150vw]" />
            <ConnectOrb tone="idle" label="New profile" action="Create a device profile" class="relative z-10 w-[clamp(136px,25vh,212px)] text-[clamp(11px,1.95vh,16px)]" @press="adding = true" />
        </div>
        <p class="relative z-10 text-small text-fg-3">On Windows, use the app instead. <ExternalLink :href="LINKS.releases">Get VeylVPN for Windows</ExternalLink></p>
        <div class="relative z-10 mt-5 grid w-full max-w-[40rem] grid-cols-3 gap-3 max-[720px]:grid-cols-1">
            <StatCard :icon="IconServer" label="Server" :value="name" :sub="host" action="Server details" @press="Go('server')" />
            <StatCard
                :icon="IconDevices"
                label="Devices"
                :value="session.account ? `${session.account.devices} of ${session.account.limit}` : 'Your devices'"
                action="Manage devices"
                @press="Go('devices')"
            />
            <StatCard :icon="IconShield" label="Account" :value="session.account ? (session.account.status === 'active' ? 'Active' : session.account.status === 'expired' ? 'Expired' : 'Paused') : 'Loading'" />
        </div>
        <AddDeviceDialog :open="adding" @close="adding = false" />
    </section>
</template>
