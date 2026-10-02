<script setup lang="ts">
import { computed, ref, useId } from "vue"
import IconEye from "../icons/IconEye.vue"
import IconEyeOff from "../icons/IconEyeOff.vue"

const model = defineModel<string>({ required: true })

const props = withDefaults(
    defineProps<{
        label: string
        type?: "text" | "password"
        placeholder?: string
        hint?: string
        error?: string | null
        mono?: boolean
        autocomplete?: string
        inputmode?: "text" | "numeric" | "url"
        maxlength?: number
        disabled?: boolean
    }>(),
    { type: "text", placeholder: "", hint: "", error: null, mono: false, autocomplete: "off", inputmode: "text", maxlength: 256, disabled: false },
)

const emit = defineEmits<{ input: [value: string] }>()

const id = useId()
const shown = ref(false)
const kind = computed(() => (props.type === "password" && !shown.value ? "password" : "text"))
const described = computed(() => [props.error ? `${id}-error` : null, props.hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined)

function Input(event: Event) {
    const value = (event.target as HTMLInputElement).value
    model.value = value
    emit("input", value)
}
</script>

<template>
    <div class="flex flex-col gap-1.5">
        <label :for="id" class="px-1 text-small font-semibold text-fg-2">{{ label }}</label>
        <div
            class="flex h-[52px] items-center rounded-[16px] border bg-white/[0.045] transition-[border-color,box-shadow,background] duration-200 focus-within:border-violet-400/70 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_4px_rgb(113_92_255/0.16)]"
            :class="error ? 'border-danger/60' : 'border-white/[0.09] hover:border-white/[0.16]'"
        >
            <input
                :id="id"
                :value="model"
                :type="kind"
                :placeholder="placeholder"
                :autocomplete="autocomplete"
                :inputmode="inputmode"
                :maxlength="maxlength"
                :disabled="disabled"
                :aria-invalid="error ? true : undefined"
                :aria-describedby="described"
                spellcheck="false"
                autocapitalize="off"
                class="h-full min-w-0 flex-1 bg-transparent px-4 text-[1rem] text-fg outline-none placeholder:text-fg-4 disabled:opacity-60"
                :class="mono && 'tech !text-[0.9375rem] tracking-[0.04em]'"
                @input="Input"
            />
            <button
                v-if="type === 'password'"
                type="button"
                class="mr-1.5 grid size-8 shrink-0 place-items-center rounded-full text-fg-3 transition-colors duration-150 hover:bg-white/[0.06] hover:text-fg"
                :aria-label="shown ? 'Hide password' : 'Show password'"
                :aria-pressed="shown"
                @click="shown = !shown"
            >
                <component :is="shown ? IconEyeOff : IconEye" />
            </button>
        </div>
        <p v-if="error" :id="`${id}-error`" class="text-small text-[#ff8a84]">{{ error }}</p>
        <p v-else-if="hint" :id="`${id}-hint`" class="text-small text-fg-3">{{ hint }}</p>
    </div>
</template>
