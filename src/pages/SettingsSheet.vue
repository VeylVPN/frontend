<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue"
import { Backend } from "../backend"
import BrandWordmark from "../components/brand/BrandWordmark.vue"
import IconArrowUpRight from "../components/icons/IconArrowUpRight.vue"
import DeleteAccountDialog from "../components/settings/DeleteAccountDialog.vue"
import BlockingSettings from "../components/settings/BlockingSettings.vue"
import DiagnosticsPanel from "../components/settings/DiagnosticsPanel.vue"
import PasswordDialog from "../components/settings/PasswordDialog.vue"
import SignOutDialog from "../components/settings/SignOutDialog.vue"
import ListGroup from "../components/ui/ListGroup.vue"
import ListRow from "../components/ui/ListRow.vue"
import UiCopy from "../components/ui/UiCopy.vue"
import UiSwitch from "../components/ui/UiSwitch.vue"
import { GroupAccount, Host, MaskAccount } from "../lib/format"
import { GUIDE, LINKS, PRIVACY } from "../lib/links"
import { nav } from "../stores/nav"
import { prefs } from "../stores/prefs"
import { LoadAccount, session } from "../stores/session"
import { Notify } from "../stores/toasts"

const VERSION = __APP_VERSION__

const native = Backend().tunnel

const reveal = ref(false)
const dialog = ref<"password" | "signout" | "delete" | null>(null)

const account = computed(() => session.profile?.account ?? "")

const LINK_LIST = [
    { href: LINKS.source, label: "Source code" },
    { href: GUIDE, label: "Self-hosting guide" },
    { href: LINKS.releases, label: "Releases" },
    { href: LINKS.issues, label: "Report an issue" },
    { href: PRIVACY, label: "How the server avoids logs" },
]

async function Open(href: string) {
    try {
        await Backend().Open(href)
    } catch {
        Notify("Couldn't open the link", "error")
    }
}

onMounted(async () => {
    void LoadAccount()
    if (nav.section) {
        await nextTick()
        document.getElementById(`sheet-${nav.section}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
})
</script>

<template>
    <ListGroup title="Account">
        <ListRow label="Account number">
            <template #below>
                <p class="tech selectable mt-0.5 !text-[0.95rem] tracking-[0.04em] text-fg-2">{{ reveal ? GroupAccount(account) : MaskAccount(account) }}</p>
            </template>
            <button type="button" class="text-button" :aria-pressed="reveal" @click="reveal = !reveal">{{ reveal ? "Hide" : "Show" }}</button>
            <UiCopy :value="account" label="Copy account number" />
        </ListRow>
        <ListRow label="Server" :hint="Host(session.profile?.server ?? '')" />
        <ListRow label="Password">
            <button type="button" class="text-button" @click="dialog = 'password'">Change</button>
        </ListRow>
        <ListRow label="Sign out">
            <button type="button" class="text-button" @click="dialog = 'signout'">Sign out</button>
        </ListRow>
    </ListGroup>

    <ListGroup v-if="native" title="Connection">
        <ListRow label="Connect on launch">
            <UiSwitch v-model="prefs.autoconnect" label="Connect on launch" />
        </ListRow>
        <ListRow label="Keep running in the tray" hint="Closing the window keeps you connected.">
            <UiSwitch v-model="prefs.tray" label="Keep running in the tray" />
        </ListRow>
        <ListRow label="Mini player" hint="Opens a compact player when you minimize the window or click the tray icon.">
            <UiSwitch v-model="prefs.mini" label="Mini player" />
        </ListRow>
        <ListRow label="Kill switch" hint="Blocks traffic outside the tunnel while connected.">
            <span class="text-small font-semibold text-ok">Always on</span>
        </ListRow>
    </ListGroup>

    <ListGroup id="sheet-blocking" title="Content blocking" hint="Applies to every device on your account.">
        <BlockingSettings />
    </ListGroup>

    <ListGroup id="sheet-privacy" title="Privacy">
        <ListRow v-if="native" label="Recognize partner networks" hint="Asks RIPEstat about your exit address, through the tunnel.">
            <UiSwitch v-model="prefs.partner" label="Recognize partner networks" />
        </ListRow>
        <ListRow label="Hide IP addresses" hint="For screenshots and streams.">
            <UiSwitch v-model="prefs.conceal" label="Hide IP addresses" />
        </ListRow>
        <ListRow label="Reduce motion" hint="Stops the globe, particles and transitions.">
            <UiSwitch :model-value="!prefs.motion" label="Reduce motion" @update:model-value="prefs.motion = !$event" />
        </ListRow>
    </ListGroup>

    <ListGroup title="About">
        <div class="flex items-center justify-between gap-4 px-4 py-4">
            <BrandWordmark class="h-[11px]" />
            <span class="tech text-fg-3">App {{ VERSION }} · Server {{ session.info?.version ?? "?" }}</span>
        </div>
        <button v-for="link in LINK_LIST" :key="link.href" type="button" class="link-row flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-fg-2" @click="Open(link.href)">
            {{ link.label }}
            <IconArrowUpRight class="text-fg-4" />
        </button>
    </ListGroup>

    <DiagnosticsPanel />

    <div class="mt-8 flex items-center justify-between gap-4 px-1">
        <p class="text-[0.75rem] text-fg-4">Free and open source · GPL-3.0-or-later</p>
        <button type="button" class="text-small font-semibold text-[#ff8a84] hover:text-[#ffb0ab]" @click="dialog = 'delete'">Delete account</button>
    </div>

    <PasswordDialog :open="dialog === 'password'" @close="dialog = null" />
    <SignOutDialog :open="dialog === 'signout'" @close="dialog = null" />
    <DeleteAccountDialog :open="dialog === 'delete'" @close="dialog = null" />
</template>

<style scoped>
.text-button {
    border-radius: 999px;
    padding: 0.4rem 0.85rem;
    font-size: var(--text-small);
    font-weight: 600;
    color: var(--color-fg);
    background: rgb(255 255 255 / 0.07);
    transition: background 180ms var(--ease-veil);
}

.text-button:hover {
    background: rgb(255 255 255 / 0.12);
}

.link-row {
    transition:
        background 180ms var(--ease-veil),
        color 180ms var(--ease-veil);
}

.link-row:hover {
    background: rgb(255 255 255 / 0.03);
    color: var(--color-fg);
}
</style>
