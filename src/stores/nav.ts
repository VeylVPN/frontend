import { reactive } from "vue"

export type Page = "home" | "server" | "devices" | "settings"

export const PAGES: { id: Page; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "server", label: "Server" },
    { id: "devices", label: "Devices" },
    { id: "settings", label: "Settings" },
]

export const nav = reactive({ page: "home" as Page, section: null as string | null })

export function Go(page: Page, section: string | null = null) {
    nav.page = page
    nav.section = section
}
