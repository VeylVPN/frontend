<script setup lang="ts">
import { ref } from "vue"
import { DateText } from "../../lib/format"
import { NeedsSignIn, SignOut, session } from "../../stores/session"
import { Notify } from "../../stores/toasts"
import UiButton from "../ui/UiButton.vue"
import UiNotice from "../ui/UiNotice.vue"

const leaving = ref(false)

async function Restart() {
    leaving.value = true
    try {
        await SignOut(false)
    } catch {
        Notify("Couldn't sign out", "error")
    } finally {
        leaving.value = false
    }
}
</script>

<template>
    <UiNotice v-if="session.orphaned" tone="warn" title="This computer was removed from your account">
        Its certificate was revoked, so it can't connect anymore. Sign in again to add it back as a new device.
        <template #actions>
            <UiButton size="sm" variant="secondary" :loading="leaving" @click="Restart()">Sign in again</UiButton>
        </template>
    </UiNotice>
    <UiNotice v-else-if="NeedsSignIn()" tone="warn" title="Your server signed you out">
        {{ session.accountError?.message }}
        <template #actions>
            <UiButton size="sm" variant="secondary" :loading="leaving" @click="Restart()">Sign in again</UiButton>
        </template>
    </UiNotice>
    <UiNotice v-else-if="session.account?.status === 'expired'" tone="warn" :title="`Account expired${session.account.expires ? ` on ${DateText(session.account.expires)}` : ''}`">
        Your server refuses new connections from this account until its admin extends it.
    </UiNotice>
    <UiNotice v-else-if="session.account?.status === 'disabled'" tone="danger" title="Account paused">
        Your server's admin has paused this account, so it can't connect. Ask them to enable it again.
    </UiNotice>
</template>
