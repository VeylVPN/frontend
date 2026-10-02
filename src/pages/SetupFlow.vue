<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue"
import { Backend } from "../backend"
import PixelGlobe from "../components/connection/PixelGlobe.vue"
import IconServer from "../components/icons/IconServer.vue"
import ExternalLink from "../components/shell/ExternalLink.vue"
import TitleBar from "../components/shell/TitleBar.vue"
import UiButton from "../components/ui/UiButton.vue"
import UiCopy from "../components/ui/UiCopy.vue"
import UiDetails from "../components/ui/UiDetails.vue"
import UiField from "../components/ui/UiField.vue"
import UiSegmented from "../components/ui/UiSegmented.vue"
import { DateText, GroupAccount } from "../lib/format"
import { GUIDE } from "../lib/links"
import {
    type AccountMode,
    AvailableMethods,
    ChangeServer,
    ContinueCreated,
    type JoinMethod,
    LeaveLimit,
    ReleaseDevice,
    RetryAfterRelease,
    SetMethod,
    SetMode,
    StartSetup,
    SubmitCreate,
    SubmitServer,
    SubmitSignIn,
    setup,
} from "../stores/setup"

const native = Backend().mode === "native"

const panel = ref<HTMLElement | null>(null)

async function Focus() {
    await nextTick()
    setTimeout(() => panel.value?.querySelector<HTMLElement>("input:not([type=radio]), [data-initial]")?.focus(), 240)
}

const STEPS = [
    { title: "Host a VeylVPN server", text: "One script sets it up on any Debian or Ubuntu VPS." },
    { title: "Sign in with your account number", text: "No email. Just a 16-digit number and a password." },
    { title: "Connect", text: "Traffic leaves through your own server." },
]

const createLabel = computed(() => {
    switch (setup.info?.registration) {
        case "open":
            return "Create account"
        case "invite":
            return "Join"
        default:
            return "Claim account"
    }
})

const modes = computed(() => [
    { value: "signin" as AccountMode, label: "Sign in" },
    { value: "create" as AccountMode, label: createLabel.value },
])

const METHOD_LABELS: Record<JoinMethod, string> = { open: "New account", invite: "Invite code", number: "Account number" }

const methods = computed(() => AvailableMethods().map((value) => ({ value, label: METHOD_LABELS[value] })))

const mode = computed({ get: () => setup.mode, set: (value: AccountMode) => SetMode(value) })
const method = computed({ get: () => setup.method, set: (value: JoinMethod) => SetMethod(value) })

const registration = computed(() => {
    switch (setup.info?.registration) {
        case "open":
            return "Anyone can create an account on this server."
        case "invite":
            return "New accounts need an invite code or an account number from the admin."
        case "closed":
            return "This server only accepts account numbers made by its admin."
        default:
            return ""
    }
})

const submitLabel = computed(() => {
    if (setup.method === "invite") {
        return "Join with invite"
    }
    return setup.method === "number" ? "Set password" : "Create account"
})

function FieldError(field: string): string | null {
    return setup.problem?.field === field ? setup.problem.message : null
}

function Account(value: string) {
    setup.account = GroupAccount(value)
}

watch(() => [setup.step, setup.mode, setup.method], Focus)

onMounted(() => {
    StartSetup()
    void Focus()
})
</script>

<template>
    <div class="flex h-full flex-col bg-base">
        <TitleBar v-if="native" />
        <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(360px,460px)] max-[860px]:grid-cols-1">
            <aside class="relative isolate flex flex-col justify-between overflow-hidden border-r border-line px-[clamp(1.5rem,4vw,3.5rem)] pb-10 pt-[clamp(1.5rem,6vh,4rem)] max-[860px]:hidden">
                <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_40%_100%,rgb(61_82_230/0.28),transparent_70%)]" aria-hidden="true" />
                <div class="pointer-events-none absolute left-1/2 top-[66%] -z-10 w-[min(1040px,150%)] -translate-x-1/2" aria-hidden="true">
                    <PixelGlobe tone="on" class="w-full" />
                </div>
                <div>
                    <h1 class="max-w-[30rem] text-[clamp(2.25rem,5vw,3.6rem)] font-bold leading-[1] tracking-[-0.04em]">
                        <span class="block text-fg">Your VPN.</span>
                        <span class="text-gradient block">On infrastructure you control.</span>
                    </h1>
                    <ol class="mt-8 flex max-w-[26rem] flex-col gap-4">
                        <li v-for="(step, index) in STEPS" :key="step.title" class="flex gap-3.5">
                            <span class="grid size-7 shrink-0 place-items-center rounded-full border border-violet-400/30 bg-violet-500/15 text-[0.8rem] font-bold text-violet-200">{{ index + 1 }}</span>
                            <span>
                                <span class="block font-semibold text-fg">{{ step.title }}</span>
                                <span class="block text-small text-fg-3">{{ step.text }}</span>
                            </span>
                        </li>
                    </ol>
                    <p class="mt-6"><ExternalLink :href="GUIDE">Read the self-hosting guide</ExternalLink></p>
                </div>
            </aside>

            <main ref="panel" class="flex min-h-0 flex-col overflow-y-auto">
                <div class="m-auto w-full max-w-[400px] px-6 py-10">
                    <Transition name="page" mode="out-in">
                        <section v-if="setup.step === 'server'" key="server" aria-labelledby="setup-server">
                            <h2 id="setup-server" class="text-heading font-bold text-fg">Add your server</h2>
                            <p class="mt-2 text-fg-2">Enter the address you chose when you set up your VeylVPN server.</p>
                            <form class="mt-6 flex flex-col gap-4" novalidate @submit.prevent="SubmitServer()">
                                <UiField
                                    v-model="setup.server"
                                    label="Server address"
                                    placeholder="vpn.example.com"
                                    hint="A domain, or the free sslip.io name the installer offered."
                                    :error="FieldError('server')"
                                    inputmode="url"
                                    mono
                                />
                                <div v-if="setup.error" class="rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-3 text-small text-fg-2" role="alert">
                                    <p><span class="font-semibold text-fg">{{ setup.error.title }}.</span> {{ setup.error.message }}</p>
                                    <UiDetails class="mt-2">
                                        <p class="tech selectable text-fg-3">{{ setup.error.detail }}</p>
                                    </UiDetails>
                                </div>
                                <UiButton type="submit" variant="primary" size="lg" block :loading="setup.busy">{{ setup.busy ? "Checking server" : "Continue" }}</UiButton>
                            </form>
                            <p class="mt-6 text-small text-fg-3">No server yet? <ExternalLink :href="GUIDE">Set one up in a few minutes</ExternalLink></p>
                        </section>

                        <section v-else-if="setup.step === 'account'" key="account" aria-labelledby="setup-account">
                            <div v-if="native && setup.info" class="mb-6 flex items-center gap-3 rounded-lg border border-line bg-surface-1 p-3">
                                <span class="grid size-9 shrink-0 place-items-center rounded-md bg-violet-500/15 text-violet-300"><IconServer /></span>
                                <span class="min-w-0 flex-1">
                                    <span class="block truncate text-small font-semibold text-fg">{{ setup.info.name }}<span v-if="setup.info.version" class="font-normal text-fg-3"> · v{{ setup.info.version }}</span></span>
                                    <span class="tech block truncate !text-[0.75rem] text-fg-3">{{ setup.server }}</span>
                                </span>
                                <UiButton size="sm" variant="ghost" @click="ChangeServer()">Change</UiButton>
                            </div>
                            <h2 id="setup-account" class="text-heading font-bold text-fg">{{ setup.mode === "signin" ? "Sign in" : createLabel }}</h2>
                            <p v-if="registration" class="mt-2 text-small text-fg-3">{{ registration }}</p>
                            <UiSegmented v-model="mode" :options="modes" label="Sign in or create an account" class="mt-5" />

                            <form v-if="setup.mode === 'signin'" class="mt-5 flex flex-col gap-4" novalidate @submit.prevent="SubmitSignIn()">
                                <UiField
                                    :model-value="setup.account"
                                    label="Account number"
                                    placeholder="0000 0000 0000 0000"
                                    inputmode="numeric"
                                    :maxlength="19"
                                    :error="FieldError('account')"
                                    mono
                                    @update:model-value="Account"
                                />
                                <UiField v-model="setup.password" type="password" label="Password" autocomplete="current-password" :error="FieldError('password')" />
                                <div v-if="setup.error" class="rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-3 text-small text-fg-2" role="alert">
                                    <span class="font-semibold text-fg">{{ setup.error.title }}.</span> {{ setup.error.message }}
                                </div>
                                <UiButton type="submit" variant="primary" size="lg" block :loading="setup.busy">{{ setup.busy ? "Signing in" : "Sign in" }}</UiButton>
                                <p v-if="native" class="text-center text-small text-fg-3">Signing in creates a key for this computer and adds it to your devices.</p>
                            </form>

                            <form v-else class="mt-5 flex flex-col gap-4" novalidate @submit.prevent="SubmitCreate()">
                                <UiSegmented v-if="methods.length > 1" v-model="method" :options="methods" label="How to create the account" />
                                <p v-if="setup.method === 'open'" class="text-small text-fg-3">Your server generates a 16-digit account number for you.</p>
                                <UiField
                                    v-if="setup.method === 'invite'"
                                    v-model="setup.invite"
                                    label="Invite code"
                                    placeholder="VEYL-ABCD-EFGH-IJKL-MNOP"
                                    :maxlength="64"
                                    :error="FieldError('invite')"
                                    mono
                                />
                                <UiField
                                    v-if="setup.method === 'number'"
                                    :model-value="setup.account"
                                    label="Account number from your admin"
                                    placeholder="0000 0000 0000 0000"
                                    inputmode="numeric"
                                    :maxlength="19"
                                    :error="FieldError('account')"
                                    mono
                                    @update:model-value="Account"
                                />
                                <UiField v-model="setup.password" type="password" label="Choose a password" hint="10 to 256 characters." autocomplete="new-password" :error="FieldError('password')" />
                                <UiField v-model="setup.repeat" type="password" label="Repeat password" autocomplete="new-password" :error="FieldError('repeat')" />
                                <div v-if="setup.error" class="rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-3 text-small text-fg-2" role="alert">
                                    <span class="font-semibold text-fg">{{ setup.error.title }}.</span> {{ setup.error.message }}
                                </div>
                                <UiButton type="submit" variant="primary" size="lg" block :loading="setup.busy">{{ submitLabel }}</UiButton>
                            </form>
                        </section>

                        <section v-else-if="setup.step === 'created'" key="created" aria-labelledby="setup-created">
                            <h2 id="setup-created" class="text-heading font-bold text-fg">Your account number</h2>
                            <p class="mt-2 text-fg-2">This number is the only way to sign in. There's no email and no recovery, so store it somewhere safe, like a password manager.</p>
                            <div class="surface-card mt-6 flex items-center justify-between gap-3 rounded-lg px-5 py-4">
                                <p class="tech selectable !text-[1.35rem] tracking-[0.06em] text-fg">{{ GroupAccount(setup.created) }}</p>
                                <UiCopy :value="setup.created" label="Copy account number" />
                            </div>
                            <div v-if="setup.error" class="mt-4 rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-3 text-small text-fg-2" role="alert">
                                <span class="font-semibold text-fg">{{ setup.error.title }}.</span> {{ setup.error.message }}
                            </div>
                            <UiButton class="mt-6" variant="primary" size="lg" block :loading="setup.busy" @click="ContinueCreated()">{{ setup.busy ? "Signing in" : "I've saved it, continue" }}</UiButton>
                        </section>

                        <section v-else key="limit" aria-labelledby="setup-limit">
                            <h2 id="setup-limit" class="text-heading font-bold text-fg">Device limit reached</h2>
                            <p class="mt-2 text-fg-2">Your account has reached its limit of {{ setup.limit }} devices. Remove one to add this computer.</p>
                            <ul class="mt-5 overflow-hidden rounded-lg border border-line bg-surface-1">
                                <li v-for="device in setup.devices" :key="device.id" class="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                                    <span class="min-w-0 flex-1">
                                        <span class="block truncate font-semibold text-fg">{{ device.name }}</span>
                                        <span class="block text-small text-fg-3">{{ device.online ? "Online now" : "Offline" }} · Added {{ DateText(device.created) }}</span>
                                    </span>
                                    <UiButton size="sm" variant="danger" :loading="setup.releasing === device.id" :disabled="setup.releasing !== null && setup.releasing !== device.id" @click="ReleaseDevice(device.id)">
                                        Remove
                                    </UiButton>
                                </li>
                                <li v-if="!setup.devices.length" class="px-4 py-3 text-small text-fg-3">No devices left to remove.</li>
                            </ul>
                            <div v-if="setup.error" class="mt-4 rounded-md border border-danger/30 bg-danger/[0.06] px-3.5 py-3 text-small text-fg-2" role="alert">
                                <span class="font-semibold text-fg">{{ setup.error.title }}.</span> {{ setup.error.message }}
                            </div>
                            <div class="mt-6 flex gap-2">
                                <UiButton variant="ghost" size="lg" :disabled="setup.busy" @click="LeaveLimit()">Back</UiButton>
                                <UiButton class="flex-1" variant="primary" size="lg" :loading="setup.busy" :disabled="setup.devices.length >= setup.limit" @click="RetryAfterRelease()">Add this computer</UiButton>
                            </div>
                        </section>
                    </Transition>
                </div>
            </main>
        </div>
    </div>
</template>
