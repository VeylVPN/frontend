export const SITE_URL: string = ""

export const LINKS = {
    organization: "https://github.com/VeylVPN",
    source: "https://github.com/VeylVPN/frontend",
    server: "https://github.com/VeylVPN/backend",
    guide: "https://github.com/VeylVPN/backend#install",
    nolog: "https://github.com/VeylVPN/backend#no-logs",
    api: "https://github.com/VeylVPN/backend/blob/main/docs/API.md",
    releases: "https://github.com/VeylVPN/frontend/releases",
    issues: "https://github.com/VeylVPN/frontend/issues",
} as const

export function SiteLink(path: string): string | null {
    return SITE_URL ? `${SITE_URL.replace(/\/+$/, "")}${path}` : null
}

export const GUIDE = SiteLink("/docs/server") ?? LINKS.guide

export const TROUBLESHOOTING = SiteLink("/docs/troubleshooting")

export const PRIVACY = SiteLink("/privacy") ?? LINKS.nolog
