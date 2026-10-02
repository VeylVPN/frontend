export type PartnerNetwork = {
    id: string
    asn: number
    name: string
    display: string
    kind: "infrastructure"
    verified: boolean
}

export const PARTNER_NETWORKS: Record<number, PartnerNetwork> = {
    206533: {
        id: "centrixnodes",
        asn: 206533,
        name: "CentrixNodes LLC",
        display: "CentrixNodes",
        kind: "infrastructure",
        verified: true,
    },
}

export function ParseAsn(value: unknown): number | null {
    const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(/^AS/i, "") : ""
    if (!/^\d{1,10}$/.test(text)) {
        return null
    }
    const asn = Number(text)
    return asn > 0 && asn <= 4294967295 ? asn : null
}

export function PartnerFor(asn: number | null): PartnerNetwork | null {
    if (asn === null) {
        return null
    }
    const partner = PARTNER_NETWORKS[asn]
    return partner?.verified ? partner : null
}

export function FormatAsn(asn: number | null): string {
    return asn === null ? "Unknown" : `AS${asn}`
}
