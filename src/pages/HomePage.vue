<script setup lang="ts">
import { computed } from "vue"
import { Backend } from "../backend"
import ConnectionStage from "../components/connection/ConnectionStage.vue"
import WebHero from "../components/connection/WebHero.vue"
import AccountNotices from "../components/shell/AccountNotices.vue"
import UiButton from "../components/ui/UiButton.vue"
import UiNotice from "../components/ui/UiNotice.vue"
import { Connect, connection, DismissConnection } from "../stores/connection"
import { CheckServer, session } from "../stores/session"

const native = Backend().tunnel

const unreachable = computed(() => session.reach === "offline" && (connection.phase === "idle" || connection.phase === "error"))
</script>

<template>
    <div class="flex min-h-full flex-col">
        <div class="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-6 pt-4 empty:hidden">
            <AccountNotices />
            <UiNotice v-if="connection.dropped && connection.phase === 'idle'" tone="info" title="The connection ended" dismissible @dismiss="DismissConnection()">
                OpenVPN stopped unexpectedly, so VeylVPN closed the session and lifted the kill switch. Your traffic is not going through your server right now.
                <template #actions>
                    <UiButton size="sm" @click="Connect()">Reconnect</UiButton>
                </template>
            </UiNotice>
            <UiNotice v-if="unreachable && session.reachError" tone="warn" :title="session.reachError.title">
                {{ session.reachError.message }}
                <template #actions>
                    <UiButton size="sm" :loading="session.reach === 'checking'" @click="CheckServer()">Check again</UiButton>
                </template>
            </UiNotice>
        </div>
        <ConnectionStage v-if="native" class="flex-1" />
        <WebHero v-else class="flex-1" />
    </div>
</template>
