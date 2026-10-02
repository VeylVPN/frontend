import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const FONT_CSS = "https://api.fontshare.com/v2/css?f[]=satoshi@1&display=swap"

const FONT_HOST = "https://cdn.fontshare.com/"

const FONT_SHA256 = "e739aff9b4d02c264341d6d4872edcda28e79373aeda936f659566a1cd3eb47f"

const FONT_PATH = join(import.meta.dirname, "..", "src", "assets", "fonts", "Satoshi-Variable.woff2")

const MAX_BYTES = 512 * 1024

function Digest(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex")
}

async function Fetch(url: string): Promise<Response> {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "VeylVPN-desktop-build" } })
    if (!response.ok) {
        throw new Error(`${url} responded ${response.status}`)
    }
    return response
}

async function Main() {
    if (existsSync(FONT_PATH) && Digest(readFileSync(FONT_PATH)) === FONT_SHA256) {
        return
    }
    const css = await (await Fetch(FONT_CSS)).text()
    const block = css.split("@font-face").find((part) => /font-style:\s*normal/.test(part))
    const match = block ? /url\('(\/\/cdn\.fontshare\.com\/[^']+\.woff2)'\)/.exec(block) : null
    const url = match?.[1] ? `https:${match[1]}` : null
    if (!url?.startsWith(FONT_HOST)) {
        throw new Error("Could not find the Satoshi variable font in the Fontshare stylesheet")
    }
    const bytes = new Uint8Array(await (await Fetch(url)).arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) {
        throw new Error("Font download is unexpectedly large")
    }
    const digest = Digest(bytes)
    if (digest !== FONT_SHA256) {
        throw new Error(`Satoshi font checksum mismatch (got ${digest}). Review the new file and update FONT_SHA256 in scripts/fonts.ts.`)
    }
    mkdirSync(dirname(FONT_PATH), { recursive: true })
    writeFileSync(FONT_PATH, bytes)
    console.log("Fetched Satoshi variable font from Fontshare")
}

await Main()
