<script setup lang="ts">
import { computed, ref } from "vue"
import { Describe } from "../../adapters/errors"
import { Connect, connection } from "../../stores/connection"
import { LoadAccount, SetBlocking, session } from "../../stores/session"
import { Notify } from "../../stores/toasts"
import UiBadge from "../ui/UiBadge.vue"
import UiButton from "../ui/UiButton.vue"
import UiPanel from "../ui/UiPanel.vue"
import UiRow from "../ui/UiRow.vue"
import UiSwitch from "../ui/UiSwitch.vue"

const LABELS: Record<string, { label: string; text: string }> = {
    ads: { label: "Ads", text: "Ad networks and ad servers." },
    trackers: { label: "Trackers", text: "Analytics and tracking domains." },
    malware: { label: "Malware", text: "Known malware, phishing and scam domains." },
    adult: { label: "Adult content", text: "Adult and explicit sites." },
    gambling: { label: "Gambling", text: "Betting and casino sites." },
    social: { label: "Social media", text: "Social networks." },
}

const saving = ref<string | null>(null)
const changed = ref(false)

const categories = computed(() => {
    const list = session.info?.categories.length ? session.info.categories : (session.account?.blocking ?? [])
    return list.map((id) => ({ id, ...(LABELS[id] ?? { label: id.charAt(0).toUpperCase() + id.slice(1), text: "" }) }))
})

const connected = computed(() => connection.phase === "connected" || connection.phase === "reconnecting")

async function Change(id: string, enabled: boolean) {
    const account = session.account
    if (!account || saving.value) {
        return
    }
    const next = enabled ? [...new Set([...account.blocking, id])] : account.blocking.filter((item) => item !== id)
    saving.value = id
    try {
        await SetBlocking(next)
        changed.value = true
    } catch (error) {
        Notify(Describe(error).title, "error")
    } finally {
        saving.value = null
    }
}

async function Reset() {
    saving.value = "reset"
    try {
        await SetBlocking(null)
        changed.value = true
        Notify("Back to your server's default", "success")
    } catch (error) {
        Notify(Describe(error).title, "error")
    } finally {
        saving.value = null
    }
}

async function Apply() {
    changed.value = false
    await Connect()
}
</script>

<template>
    <UiPanel title="Content blocking" description="Your server's resolver blocks these for every device on your account, using the HaGeZi and Mullvad blocklists.">
        <template #aside>
            <UiBadge v-if="session.account" :tone="session.account.custom ? 'violet' : 'neutral'">{{ session.account.custom ? "Custom" : "Server default" }}</UiBadge>
        </template>
        <template v-if="session.account">
            <UiRow v-for="category in categories" :id="`blocking-${category.id}`" :key="category.id" :label="category.label" :description="category.text">
                <UiSwitch
                    :model-value="session.account.blocking.includes(category.id)"
                    :label="`Block ${category.label.toLowerCase()}`"
                    :busy="saving === category.id"
                    :disabled="saving !== null && saving !== category.id"
                    @update:model-value="Change(category.id, $event)"
                />
            </UiRow>
            <div class="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5">
                <p class="flex-1 text-small text-fg-3">
                    {{ changed && connected ? "This computer picks up the change the next time it connects." : "Devices pick up changes the next time they connect." }}
                </p>
                <UiButton v-if="changed && connected" size="sm" variant="secondary" @click="Apply">Reconnect now</UiButton>
                <UiButton v-if="session.account.custom" size="sm" variant="ghost" :loading="saving === 'reset'" :disabled="saving !== null && saving !== 'reset'" @click="Reset">Use server default</UiButton>
            </div>
        </template>
        <div v-else-if="session.accountError" class="px-5 pb-4 pt-2">
            <p class="text-small text-fg-2"><span class="font-semibold text-fg">{{ session.accountError.title }}.</span> {{ session.accountError.message }}</p>
            <UiButton class="mt-3" size="sm" :loading="session.accountLoading" @click="LoadAccount()">Try again</UiButton>
        </div>
        <p v-else class="px-5 pb-4 pt-2 text-small text-fg-3">Loading your blocking choices…</p>
    </UiPanel>
</template>
