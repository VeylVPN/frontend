<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue"
import { Backend } from "../backend"
import PixelGlobe from "../components/connection/PixelGlobe.vue"
import IconChevronRight from "../components/icons/IconChevronRight.vue"
import IconServer from "../components/icons/IconServer.vue"
import ExternalLink from "../components/shell/ExternalLink.vue"
import TopBar from "../components/shell/TopBar.vue"
import UiButton from "../components/ui/UiButton.vue"
import UiCopy from "../components/ui/UiCopy.vue"
import UiField from "../components/ui/UiField.vue"
import UiSegmented from "../components/ui/UiSegmented.vue"
import { DateText, GroupAccount } from "../lib/format"
import { GUIDE } from "../lib/links"
import { prefs } from "../stores/prefs"
import {
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

const card = ref<HTMLElement | null>(null)
const direction = ref<"forward" | "back">("forward")

const ORDER = ["server", "account", "created", "limit"]

const METHOD_LABELS: Record<JoinMethod, string> = { open: "New", invite: "Invite code", number: "Account number" }

const methods = computed(() => AvailableMethods().map((value) => ({ value, label: METHOD_LABELS[value] })))

const method = computed({ get: () => setup.method, set: (value: JoinMethod) => SetMethod(value) })

const createLabel = computed(() => (setup.info?.registration === "open" ? "Create an account" : setup.info?.registration === "invite" ? "Join with an invite" : "Claim an account number"))

const subtitle = computed(() => {
    switch (setup.step) {
        case "server":
            return "Connect to the VeylVPN server you host."
        case "account":
            return setup.mode === "signin" ? "Sign in with your account number." : "No email. Just a number and a password."
        case "created":
            return "Save this. It's the only way to sign in."
        default:
            return "Free a slot to add this computer."
    }
})

const submitLabel = computed(() => (setup.method === "invite" ? "Join" : setup.method === "number" ? "Set password" : "Create account"))

function FieldError(field: string): string | null {
    return setup.problem?.field === field ? setup.problem.message : null
}

function Account(value: string) {
    setup.account = GroupAccount(value)
}

async function Focus() {
    await nextTick()
    setTimeout(() => card.value?.querySelector<HTMLElement>("input:not([type=radio]), [data-initial]")?.focus(), 320)
}

watch(
    () => setup.step,
    (step, previous) => {
        direction.value = ORDER.indexOf(step) >= ORDER.indexOf(previous) ? "forward" : "back"
        void Focus()
    },
)

watch(() => [setup.mode, setup.method], Focus)

onMounted(() => {
    StartSetup()
    void Focus()
})
</script>

<template>
    <div class="relative flex h-full flex-col overflow-hidden bg-night">
        <TopBar :menus="false" />
        <div class="relative min-h-0 flex-1">
            <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_105%,rgb(40_54_190/0.42),transparent_70%)]" aria-hidden="true" />
            <div class="globe pointer-events-none absolute left-1/2 top-[54%] w-[max(1100px,128vw)] max-w-none -translate-x-1/2" aria-hidden="true">
                <PixelGlobe tone="on" :orbit="false" :still="!prefs.motion" class="w-full" />
            </div>
            <main class="relative z-10 flex h-full flex-col items-center overflow-y-auto px-6 pb-10">
                <div class="intro mt-[clamp(1rem,6vh,4rem)] text-center">
                    <h1 class="text-[clamp(2.5rem,7.2vh,4.4rem)] font-bold leading-[0.98] tracking-[-0.045em] text-fg">
                        Your VPN.
                        <span class="text-gradient block">Actually yours.</span>
                    </h1>
                    <Transition name="swap" mode="out-in">
                        <p :key="subtitle" class="mt-4 text-fg-2">{{ subtitle }}</p>
                    </Transition>
                </div>

                <div ref="card" class="card relative mt-[clamp(1.25rem,4vh,2.5rem)] w-full max-w-[410px] overflow-hidden rounded-[30px] p-6">
                    <Transition :name="`step-${direction}`" mode="out-in">
                        <form v-if="setup.step === 'server'" key="server" class="flex flex-col gap-4" novalidate @submit.prevent="SubmitServer()">
                            <UiField v-model="setup.server" label="Server address" placeholder="vpn.example.com" :error="FieldError('server')" inputmode="url" mono />
                            <p v-if="setup.error" class="text-small text-[#ff9b95]" role="alert">{{ setup.error.title }}. {{ setup.error.message }}</p>
                            <UiButton type="submit" variant="primary" size="lg" block :loading="setup.busy">{{ setup.busy ? "Checking" : "Continue" }}</UiButton>
                        </form>

                        <div v-else-if="setup.step === 'account'" key="account" class="flex flex-col gap-4">
                            <button v-if="native && setup.info" type="button" class="server-chip flex items-center gap-3 rounded-[18px] p-2.5 pr-3 text-left" @click="ChangeServer()">
                                <span class="grid size-9 shrink-0 place-items-center rounded-[12px] bg-violet-500/20 text-violet-200"><IconServer /></span>
                                <span class="min-w-0 flex-1">
                                    <span class="block truncate text-small font-semibold text-fg">{{ setup.info.name }}</span>
                                    <span class="tech block truncate !text-[0.72rem] text-fg-3">{{ setup.server }}</span>
                                </span>
                                <span class="text-[0.75rem] font-semibold text-fg-3">Change</span>
                            </button>

                            <Transition name="swap" mode="out-in">
                                <form v-if="setup.mode === 'signin'" key="signin" class="flex flex-col gap-4" novalidate @submit.prevent="SubmitSignIn()">
                                    <UiField :model-value="setup.account" label="Account number" placeholder="0000 0000 0000 0000" inputmode="numeric" :maxlength="19" :error="FieldError('account')" mono @update:model-value="Account" />
                                    <UiField v-model="setup.password" type="password" label="Password" autocomplete="current-password" :error="FieldError('password')" />
                                    <p v-if="setup.error" class="text-small text-[#ff9b95]" role="alert">{{ setup.error.title }}. {{ setup.error.message }}</p>
                                    <UiButton type="submit" variant="primary" size="lg" block :loading="setup.busy">{{ setup.busy ? "Signing in" : "Sign in" }}</UiButton>
                                    <button type="button" class="switch-mode" @click="SetMode('create')">
                                        {{ createLabel }}
                                        <IconChevronRight />
                                    </button>
                                </form>
                                <form v-else key="create" class="flex flex-col gap-4" novalidate @submit.prevent="SubmitCreate()">
                                    <UiSegmented v-if="methods.length > 1" v-model="method" :options="methods" label="How to create the account" class="self-start" />
                                    <UiField v-if="setup.method === 'invite'" v-model="setup.invite" label="Invite code" placeholder="VEYL-ABCD-EFGH" :maxlength="64" :error="FieldError('invite')" mono />
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
                                    <UiField v-model="setup.password" type="password" label="Password" hint="At least 10 characters." autocomplete="new-password" :error="FieldError('password')" />
                                    <UiField v-model="setup.repeat" type="password" label="Repeat password" autocomplete="new-password" :error="FieldError('repeat')" />
                                    <p v-if="setup.error" class="text-small text-[#ff9b95]" role="alert">{{ setup.error.title }}. {{ setup.error.message }}</p>
                                    <UiButton type="submit" variant="primary" size="lg" block :loading="setup.busy">{{ submitLabel }}</UiButton>
                                    <button type="button" class="switch-mode" @click="SetMode('signin')">
                                        I already have an account
                                        <IconChevronRight />
                                    </button>
                                </form>
                            </Transition>
                        </div>

                        <div v-else-if="setup.step === 'created'" key="created" class="flex flex-col gap-5">
                            <div class="number flex items-center justify-between gap-2 rounded-[20px] px-4 py-4">
                                <p class="tech selectable !text-[1.3rem] tracking-[0.06em] text-fg">{{ GroupAccount(setup.created) }}</p>
                                <UiCopy :value="setup.created" label="Copy account number" />
                            </div>
                            <p class="text-small text-fg-3">There's no email and no recovery. Keep it in a password manager.</p>
                            <p v-if="setup.error" class="text-small text-[#ff9b95]" role="alert">{{ setup.error.title }}. {{ setup.error.message }}</p>
                            <UiButton variant="primary" size="lg" block :loading="setup.busy" data-initial @click="ContinueCreated()">{{ setup.busy ? "Signing in" : "I've saved it" }}</UiButton>
                        </div>

                        <div v-else key="limit" class="flex flex-col gap-4">
                            <p class="text-small text-fg-2">Your account has reached its limit of {{ setup.limit }} devices.</p>
                            <ul class="overflow-hidden rounded-[20px] bg-white/[0.035] ring-1 ring-inset ring-white/[0.07]">
                                <li v-for="device in setup.devices" :key="device.id" class="flex items-center gap-3 px-4 py-3 [&+&]:border-t [&+&]:border-white/[0.06]">
                                    <span class="min-w-0 flex-1">
                                        <span class="block truncate font-semibold text-fg">{{ device.name }}</span>
                                        <span class="block text-[0.75rem] text-fg-3">{{ device.online ? "Online now" : "Offline" }} · {{ DateText(device.created) }}</span>
                                    </span>
                                    <UiButton size="sm" variant="danger" :loading="setup.releasing === device.id" :disabled="setup.releasing !== null && setup.releasing !== device.id" @click="ReleaseDevice(device.id)">Remove</UiButton>
                                </li>
                            </ul>
                            <p v-if="setup.error" class="text-small text-[#ff9b95]" role="alert">{{ setup.error.title }}. {{ setup.error.message }}</p>
                            <div class="flex gap-2">
                                <UiButton variant="ghost" size="lg" :disabled="setup.busy" @click="LeaveLimit()">Back</UiButton>
                                <UiButton class="flex-1" variant="primary" size="lg" :loading="setup.busy" :disabled="setup.devices.length >= setup.limit" @click="RetryAfterRelease()">Add this computer</UiButton>
                            </div>
                        </div>
                    </Transition>
                </div>

                <p v-if="setup.step === 'server'" class="foot mt-5 text-small text-fg-3">No server yet? <ExternalLink :href="GUIDE">Host one in a few minutes</ExternalLink></p>
            </main>
        </div>
    </div>
</template>

<style scoped>
.globe {
    animation: globe-in 1400ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.intro {
    animation: intro-in 900ms 150ms var(--ease-veil) both;
}

.card {
    background: linear-gradient(180deg, rgb(22 25 50 / 0.82), rgb(11 13 28 / 0.9));
    box-shadow:
        0 0 0 1px rgb(255 255 255 / 0.08) inset,
        0 1px 0 0 rgb(255 255 255 / 0.1) inset,
        0 40px 100px -40px rgb(0 0 0 / 0.95),
        0 0 80px -30px rgb(76 55 224 / 0.45);
    backdrop-filter: blur(18px);
    animation: intro-in 900ms 300ms var(--ease-veil) both;
}

.foot {
    animation: intro-in 900ms 450ms var(--ease-veil) both;
}

.server-chip {
    background: rgb(255 255 255 / 0.045);
    box-shadow: 0 0 0 1px rgb(255 255 255 / 0.07) inset;
    transition: background 200ms var(--ease-veil);
}

.server-chip:hover {
    background: rgb(255 255 255 / 0.08);
}

.number {
    background: linear-gradient(180deg, rgb(113 92 255 / 0.16), rgb(76 55 224 / 0.08));
    box-shadow: 0 0 0 1px rgb(143 127 255 / 0.32) inset;
}

.switch-mode {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    font-size: var(--text-small);
    font-weight: 600;
    color: var(--color-fg-3);
    transition: color 180ms var(--ease-veil);
}

.switch-mode:hover {
    color: var(--color-fg);
}

.step-forward-enter-active,
.step-forward-leave-active,
.step-back-enter-active,
.step-back-leave-active {
    transition:
        opacity 300ms var(--ease-veil),
        transform 380ms var(--ease-veil),
        filter 300ms var(--ease-veil);
}

.step-forward-enter-from,
.step-back-leave-to {
    opacity: 0;
    transform: translateX(36px);
    filter: blur(4px);
}

.step-forward-leave-to,
.step-back-enter-from {
    opacity: 0;
    transform: translateX(-36px);
    filter: blur(4px);
}

@keyframes globe-in {
    from {
        opacity: 0;
        transform: translateY(12%);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

@keyframes intro-in {
    from {
        opacity: 0;
        transform: translateY(18px);
        filter: blur(6px);
    }
    to {
        opacity: 1;
        transform: none;
        filter: none;
    }
}
</style>
