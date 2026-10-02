<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue"
import { Backend } from "../backend"
import BrandLogo from "../components/brand/BrandLogo.vue"
import IconBook from "../components/icons/IconBook.vue"
import IconGithub from "../components/icons/IconGithub.vue"
import IconServer from "../components/icons/IconServer.vue"
import IconAlert from "../components/icons/IconAlert.vue"
import IconDownload from "../components/icons/IconDownload.vue"
import ExternalLink from "../components/shell/ExternalLink.vue"
import BlockingSettings from "../components/settings/BlockingSettings.vue"
import DeleteAccountDialog from "../components/settings/DeleteAccountDialog.vue"
import DiagnosticsPanel from "../components/settings/DiagnosticsPanel.vue"
import PasswordDialog from "../components/settings/PasswordDialog.vue"
import SignOutDialog from "../components/settings/SignOutDialog.vue"
import UiBadge from "../components/ui/UiBadge.vue"
import UiButton from "../components/ui/UiButton.vue"
import UiCopy from "../components/ui/UiCopy.vue"
import UiPanel from "../components/ui/UiPanel.vue"
import UiRow from "../components/ui/UiRow.vue"
import UiSwitch from "../components/ui/UiSwitch.vue"
import { GroupAccount, Host, MaskAccount } from "../lib/format"
import { GUIDE, LINKS, PRIVACY } from "../lib/links"
import { nav } from "../stores/nav"
import { prefs } from "../stores/prefs"
import { LoadAccount, session } from "../stores/session"

const VERSION = __APP_VERSION__

const native = Backend().tunnel

const reveal = ref(false)
const dialog = ref<"password" | "signout" | "delete" | null>(null)

const SECTIONS = computed(() =>
    [
        native ? { id: "connection", label: "Connection" } : null,
        { id: "blocking", label: "Content blocking" },
        { id: "privacy", label: "Privacy" },
        { id: "account", label: "Account" },
        { id: "diagnostics", label: "Diagnostics" },
        { id: "about", label: "About" },
    ].filter((section): section is { id: string; label: string } => section !== null),
)

const account = computed(() => session.profile?.account ?? "")

const LINK_LIST = [
    { href: LINKS.source, label: "Source code", text: "This app, on GitHub", icon: IconGithub },
    { href: LINKS.server, label: "Server source", text: "The VeylVPN server you host", icon: IconServer },
    { href: GUIDE, label: "Self-hosting guide", text: "Install a server on any Debian or Ubuntu VPS", icon: IconBook },
    { href: LINKS.releases, label: "Releases", text: "New versions and checksums", icon: IconDownload },
    { href: LINKS.issues, label: "Report an issue", text: "Bugs and feature requests", icon: IconAlert },
]

function Jump(id: string) {
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

onMounted(async () => {
    void LoadAccount()
    if (nav.section) {
        await nextTick()
        Jump(nav.section)
        nav.section = null
    }
})
</script>

<template>
    <div class="@container mx-auto w-full max-w-[1040px] px-[clamp(1.25rem,3vw,2.5rem)] py-8">
        <h1 class="text-heading font-bold text-fg">Settings</h1>
        <div class="mt-6 grid gap-8 @[52rem]:grid-cols-[11rem_minmax(0,1fr)]">
            <nav class="hidden @[52rem]:block" aria-label="Settings sections">
                <ul class="sticky top-2 flex flex-col gap-0.5">
                    <li v-for="section in SECTIONS" :key="section.id">
                        <button type="button" class="w-full rounded-md px-3 py-1.5 text-left text-small font-semibold text-fg-3 transition-colors hover:bg-white/[0.04] hover:text-fg" @click="Jump(section.id)">
                            {{ section.label }}
                        </button>
                    </li>
                </ul>
            </nav>

            <div class="flex min-w-0 flex-col gap-5">
                <section v-if="native" id="settings-connection" class="scroll-mt-4">
                    <UiPanel title="Connection">
                        <UiRow id="setting-autoconnect" label="Connect when VeylVPN opens" description="Starts the tunnel as soon as the app opens and you're signed in.">
                            <UiSwitch v-model="prefs.autoconnect" label="Connect when VeylVPN opens" />
                        </UiRow>
                        <UiRow id="setting-tray" label="Keep running in the tray" description="Closing the window leaves VeylVPN running in the notification area, still connected. Quit from the tray icon.">
                            <UiSwitch v-model="prefs.tray" label="Keep running in the tray" />
                        </UiRow>
                        <UiRow label="Kill switch" description="While VeylVPN is connected or reconnecting, Windows Firewall blocks all traffic outside the tunnel. It's lifted when you disconnect or quit, or if OpenVPN stops.">
                            <UiBadge tone="ok">Always on</UiBadge>
                        </UiRow>
                        <UiRow label="Protocol" description="OpenVPN with a key and certificate made on this computer. UDP first, with your server's TCP fallback when UDP is blocked.">
                            <UiBadge tone="violet">OpenVPN</UiBadge>
                        </UiRow>
                    </UiPanel>
                </section>

                <section id="settings-blocking" class="scroll-mt-4">
                    <BlockingSettings />
                </section>

                <section id="settings-privacy" class="scroll-mt-4">
                    <UiPanel title="Privacy">
                        <UiRow v-if="native" id="setting-partner" label="Recognize partner networks">
                            <template #below>
                                <p class="mt-0.5 text-small text-fg-3">
                                    After you connect, VeylVPN asks RIPE NCC's public RIPEstat service which network your exit address belongs to, and shows a badge if it's a VeylVPN partner. The request goes through your tunnel,
                                    so RIPE only sees your server's address. Results stay in memory until you quit.
                                </p>
                            </template>
                            <UiSwitch v-model="prefs.partner" label="Recognize partner networks" />
                        </UiRow>
                        <UiRow label="Animate the globe" description="Slowly turns the globe while you are connected. It pauses whenever the window is hidden, and your system reduced-motion setting always wins.">
                            <UiSwitch v-model="prefs.motion" label="Animate the globe" />
                        </UiRow>
                        <UiRow label="Hide IP addresses" description="Masks addresses on screen and in copied diagnostics, for screenshots and streams.">
                            <UiSwitch v-model="prefs.conceal" label="Hide IP addresses" />
                        </UiRow>
                        <UiRow label="No traffic logs">
                            <template #below>
                                <p class="mt-0.5 text-small text-fg-3">
                                    Your server stores account and device records, never IP addresses, connection times, traffic amounts or DNS queries.
                                    <ExternalLink :href="PRIVACY">How the server avoids logging</ExternalLink>
                                </p>
                            </template>
                        </UiRow>
                    </UiPanel>
                </section>

                <section id="settings-account" class="scroll-mt-4">
                    <UiPanel title="Account">
                        <UiRow label="Account number" description="Your only sign-in name. There's no email and no recovery.">
                            <span class="tech selectable text-fg-2">{{ reveal ? GroupAccount(account) : MaskAccount(account) }}</span>
                            <UiButton size="sm" variant="ghost" :aria-pressed="reveal" @click="reveal = !reveal">{{ reveal ? "Hide" : "Show" }}</UiButton>
                            <UiCopy :value="account" label="Copy account number" />
                        </UiRow>
                        <UiRow label="Server">
                            <span class="tech text-fg-2">{{ Host(session.profile?.server ?? "") }}</span>
                        </UiRow>
                        <UiRow label="Password" description="Used to manage your devices.">
                            <UiButton size="sm" @click="dialog = 'password'">Change</UiButton>
                        </UiRow>
                        <UiRow label="Sign out" :description="native ? 'Disconnect and remove your sign-in from this computer.' : 'Forget your credentials in this browser.'">
                            <UiButton size="sm" @click="dialog = 'signout'">Sign out</UiButton>
                        </UiRow>
                        <UiRow label="Delete account" description="Deletes the account on your server and revokes every device.">
                            <UiButton size="sm" variant="danger" @click="dialog = 'delete'">Delete</UiButton>
                        </UiRow>
                    </UiPanel>
                </section>

                <section id="settings-diagnostics" class="scroll-mt-4">
                    <DiagnosticsPanel />
                </section>

                <section id="settings-about" class="scroll-mt-4">
                    <UiPanel>
                        <div class="flex flex-wrap items-center justify-between gap-4 px-5 pt-5">
                            <BrandLogo />
                            <UiBadge tone="violet">Free and open source</UiBadge>
                        </div>
                        <p class="px-5 pt-3 text-small text-fg-2">
                            A VPN that runs on a server you control. No subscription, no provider in the middle. Licensed GPL-3.0-or-later.
                        </p>
                        <dl class="mx-5 mt-4 grid grid-cols-2 gap-3">
                            <div class="rounded-md border border-line bg-surface-2/60 px-3.5 py-2.5">
                                <dt class="text-[0.75rem] text-fg-3">App</dt>
                                <dd class="tech text-fg">{{ VERSION }}</dd>
                            </div>
                            <div class="rounded-md border border-line bg-surface-2/60 px-3.5 py-2.5">
                                <dt class="text-[0.75rem] text-fg-3">Server</dt>
                                <dd class="tech text-fg">{{ session.info?.version ?? "Unknown" }}</dd>
                            </div>
                        </dl>
                        <p class="px-5 pt-3 text-small text-fg-3">VeylVPN doesn't update itself. New versions are published on GitHub with their checksums.</p>
                        <ul class="mt-3 border-t border-line">
                            <li v-for="link in LINK_LIST" :key="link.href" class="flex items-center gap-3.5 border-t border-line px-5 py-3 first:border-t-0">
                                <component :is="link.icon" class="shrink-0 text-[1.1rem] text-fg-3" />
                                <div class="min-w-0 flex-1">
                                    <ExternalLink :href="link.href">{{ link.label }}</ExternalLink>
                                    <p class="text-small text-fg-3">{{ link.text }}</p>
                                </div>
                            </li>
                        </ul>
                    </UiPanel>
                </section>
            </div>
        </div>

        <PasswordDialog :open="dialog === 'password'" @close="dialog = null" />
        <SignOutDialog :open="dialog === 'signout'" @close="dialog = null" />
        <DeleteAccountDialog :open="dialog === 'delete'" @close="dialog = null" />
    </div>
</template>
