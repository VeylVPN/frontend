<script setup lang="ts">
import { computed, ref } from "vue"
import { Describe } from "../../adapters/errors"
import { Connect, connection } from "../../stores/connection"
import { LoadAccount, SetBlocking, session } from "../../stores/session"
import { Notify } from "../../stores/toasts"
import IconCheck from "../icons/IconCheck.vue"
import UiSpinner from "../ui/UiSpinner.vue"

const LABELS: Record<string, string> = {
    ads: "Ads",
    trackers: "Trackers",
    malware: "Malware",
    adult: "Adult",
    gambling: "Gambling",
    social: "Social media",
}

const saving = ref<string | null>(null)
const changed = ref(false)

const categories = computed(() => {
    const list = session.info?.categories.length ? session.info.categories : (session.account?.blocking ?? [])
    return list.map((id) => ({ id, label: LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1) }))
})

const connected = computed(() => connection.phase === "connected" || connection.phase === "reconnecting")

async function Change(id: string) {
    const account = session.account
    if (!account || saving.value) {
        return
    }
    const next = account.blocking.includes(id) ? account.blocking.filter((item) => item !== id) : [...account.blocking, id]
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
    <div v-if="session.account" class="px-4 py-4">
        <fieldset class="flex flex-wrap gap-2">
            <legend class="sr-only">Blocked categories</legend>
            <button
                v-for="category in categories"
                :key="category.id"
                type="button"
                class="chip inline-flex h-10 items-center gap-2 rounded-full px-4 text-small font-semibold"
                :class="session.account.blocking.includes(category.id) && 'on'"
                :aria-pressed="session.account.blocking.includes(category.id)"
                :disabled="saving !== null && saving !== category.id"
                @click="Change(category.id)"
            >
                <span class="tick grid size-4 place-items-center rounded-full">
                    <UiSpinner v-if="saving === category.id" class="text-[0.55rem]" />
                    <IconCheck v-else class="text-[0.7rem]" />
                </span>
                {{ category.label }}
            </button>
        </fieldset>
        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-small">
            <span class="text-fg-3">{{ session.account.custom ? "Custom for your account" : "Your server's default" }}</span>
            <button v-if="session.account.custom" type="button" class="font-semibold text-violet-300 hover:text-violet-200 disabled:opacity-50" :disabled="saving !== null" @click="Reset">Use default</button>
            <button v-if="changed && connected" type="button" class="ml-auto font-semibold text-violet-300 hover:text-violet-200" @click="Apply">Reconnect to apply</button>
        </div>
    </div>
    <div v-else-if="session.accountError" class="px-4 py-4 text-small text-fg-2">
        <p>{{ session.accountError.message }}</p>
        <button type="button" class="mt-2 font-semibold text-violet-300 hover:text-violet-200" @click="LoadAccount()">Try again</button>
    </div>
    <p v-else class="px-4 py-4 text-small text-fg-3">Loading…</p>
</template>

<style scoped>
.chip {
    color: var(--color-fg-2);
    background: rgb(255 255 255 / 0.05);
    box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08) inset;
    transition:
        background 220ms var(--ease-veil),
        color 220ms var(--ease-veil),
        box-shadow 220ms var(--ease-veil),
        transform 160ms var(--ease-veil);
}

.chip:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.08);
    color: var(--color-fg);
}

.chip:active:not(:disabled) {
    transform: scale(0.96);
}

.chip:disabled {
    opacity: 0.55;
}

.chip .tick {
    color: transparent;
    box-shadow: 0 0 0 1.5px rgb(255 255 255 / 0.25) inset;
    transition:
        background 220ms var(--ease-veil),
        color 220ms var(--ease-veil),
        box-shadow 220ms var(--ease-veil),
        transform 300ms var(--ease-veil);
}

.chip.on {
    color: var(--color-fg);
    background: linear-gradient(180deg, rgb(113 92 255 / 0.32), rgb(76 55 224 / 0.22));
    box-shadow:
        0 0 0 1px rgb(143 127 255 / 0.5) inset,
        0 10px 30px -14px rgb(113 92 255 / 0.9);
}

.chip.on .tick {
    color: var(--color-ink-950);
    background: var(--color-violet-200);
    box-shadow: none;
    animation: tick-pop 360ms var(--ease-veil);
}

@keyframes tick-pop {
    from {
        transform: scale(0.4);
    }
    60% {
        transform: scale(1.2);
    }
}
</style>
