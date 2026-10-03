<script setup lang="ts">
import BrandMark from "./components/brand/BrandMark.vue"
import AppShell from "./components/shell/AppShell.vue"
import ToastHost from "./components/shell/ToastHost.vue"
import SetupFlow from "./pages/SetupFlow.vue"
import { session } from "./stores/session"
</script>

<template>
    <div v-if="session.status === 'loading'" class="grid h-full place-items-center bg-base" role="status" aria-label="Starting VeylVPN">
        <BrandMark class="w-12 animate-pulse" />
    </div>
    <Transition v-else name="fade" mode="out-in">
        <SetupFlow v-if="session.status === 'signedout'" key="setup" />
        <AppShell v-else key="app" />
    </Transition>
    <ToastHost />
</template>
