<script setup lang="ts">
import { computed } from "vue"
import { Host } from "../../lib/format"
import DevicesSheet from "../../pages/DevicesSheet.vue"
import ServerSheet from "../../pages/ServerSheet.vue"
import SettingsSheet from "../../pages/SettingsSheet.vue"
import { CloseSheet, nav } from "../../stores/nav"
import { session } from "../../stores/session"
import HomeStage from "../connection/HomeStage.vue"
import SidePanel from "./SidePanel.vue"
import TopBar from "./TopBar.vue"

const serverName = computed(() => session.info?.name ?? Host(session.profile?.server ?? "Your server"))
</script>

<template>
    <div class="relative flex h-full flex-col overflow-hidden bg-night">
        <TopBar />
        <div class="stage-wrap min-h-0 flex-1" :class="nav.sheet && 'receded'" :inert="nav.sheet !== null">
            <HomeStage />
        </div>
        <SidePanel :open="nav.sheet === 'server'" :title="serverName" @close="CloseSheet()">
            <ServerSheet />
        </SidePanel>
        <SidePanel :open="nav.sheet === 'devices'" title="Devices" @close="CloseSheet()">
            <DevicesSheet />
        </SidePanel>
        <SidePanel :open="nav.sheet === 'settings'" title="Settings" @close="CloseSheet()">
            <SettingsSheet />
        </SidePanel>
    </div>
</template>

<style scoped>
.stage-wrap {
    transform-origin: 30% 50%;
    transition:
        transform 620ms cubic-bezier(0.16, 1, 0.3, 1),
        opacity 620ms cubic-bezier(0.16, 1, 0.3, 1),
        filter 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.stage-wrap.receded {
    transform: scale(0.955) translateX(-3%);
    opacity: 0.55;
}
</style>
