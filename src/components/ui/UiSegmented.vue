<script setup lang="ts" generic="T extends string">
import { useId } from "vue"

const model = defineModel<T>({ required: true })

defineProps<{ options: { value: T; label: string }[]; label: string }>()

const id = useId()
</script>

<template>
    <fieldset class="inline-flex rounded-full border border-line bg-surface-1 p-1">
        <legend class="sr-only">{{ label }}</legend>
        <label
            v-for="option in options"
            :key="option.value"
            class="inline-flex h-8 cursor-pointer items-center rounded-full px-4 text-small font-semibold transition-[background,color] duration-200 ease-veil has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet-300"
            :class="model === option.value ? 'bg-surface-4 text-fg shadow-[0_1px_0_0_rgb(255_255_255/0.06)_inset]' : 'text-fg-3 hover:text-fg-2'"
        >
            <input v-model="model" type="radio" class="sr-only" :name="id" :value="option.value" />
            {{ option.label }}
        </label>
    </fieldset>
</template>
