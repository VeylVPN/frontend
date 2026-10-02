import { reactive } from "vue"

export type Sheet = "server" | "devices" | "settings"

export type Page = "home" | Sheet

export const nav = reactive({ sheet: null as Sheet | null, section: null as string | null })

export function Go(page: Page, section: string | null = null) {
    nav.sheet = page === "home" ? null : page
    nav.section = section
}

export function CloseSheet() {
    nav.sheet = null
    nav.section = null
}
