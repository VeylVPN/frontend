import { createHash } from "node:crypto"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

const SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json"

const SOURCE_SHA256 = "ead5f68119c49a9250902e7da303bcb209341bbb8fefe7369a439b48b704658a"

const MAX_BYTES = 512 * 1024

const WIDTH = 360

const HEIGHT = 180

const OUTPUT = join(import.meta.dirname, "..", "src", "components", "connection", "landmask.ts")

type Topology = {
    transform: { scale: [number, number]; translate: [number, number] }
    arcs: [number, number][][]
    objects: { land: { geometries: { type: string; arcs: number[][][] }[] } }
}

type Point = [number, number]

async function Download(): Promise<Topology> {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(20000), headers: { "user-agent": "VeylVPN-desktop-build" } })
    if (!response.ok) {
        throw new Error(`${SOURCE} responded ${response.status}`)
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) {
        throw new Error("Land data is unexpectedly large")
    }
    const digest = createHash("sha256").update(bytes).digest("hex")
    if (digest !== SOURCE_SHA256) {
        throw new Error(`Land data checksum mismatch (got ${digest}). Review the new file and update SOURCE_SHA256.`)
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as Topology
}

function Arcs(topology: Topology): Point[][] {
    const [sx, sy] = topology.transform.scale
    const [tx, ty] = topology.transform.translate
    return topology.arcs.map((arc) => {
        let x = 0
        let y = 0
        return arc.map(([dx, dy]) => {
            x += dx
            y += dy
            return [x * sx + tx, y * sy + ty] as Point
        })
    })
}

function Rings(topology: Topology, arcs: Point[][]): Point[][] {
    const rings: Point[][] = []
    for (const geometry of topology.objects.land.geometries) {
        const polygons = geometry.type === "Polygon" ? [geometry.arcs as unknown as number[][]] : geometry.arcs
        for (const polygon of polygons) {
            for (const ring of polygon) {
                const points: Point[] = []
                for (const index of ring) {
                    const arc = index < 0 ? [...(arcs[~index] ?? [])].reverse() : (arcs[index] ?? [])
                    points.push(...(points.length ? arc.slice(1) : arc))
                }
                rings.push(points)
            }
        }
    }
    return rings
}

function Rasterize(rings: Point[][]): Uint8Array {
    const bits = new Uint8Array((WIDTH * HEIGHT) / 8)
    for (let row = 0; row < HEIGHT; row++) {
        const latitude = 90 - ((row + 0.5) * 180) / HEIGHT
        const crossings: number[] = []
        for (const ring of rings) {
            for (let index = 0; index < ring.length - 1; index++) {
                const [x1, y1] = ring[index] as Point
                const [x2, y2] = ring[index + 1] as Point
                if ((y1 <= latitude && latitude < y2) || (y2 <= latitude && latitude < y1)) {
                    crossings.push(x1 + ((latitude - y1) * (x2 - x1)) / (y2 - y1))
                }
            }
        }
        crossings.sort((a, b) => a - b)
        for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
            const from = crossings[pair] as number
            const to = crossings[pair + 1] as number
            for (let column = 0; column < WIDTH; column++) {
                const longitude = -180 + ((column + 0.5) * 360) / WIDTH
                if (longitude >= from && longitude <= to) {
                    const cell = row * WIDTH + column
                    bits[cell >> 3] = (bits[cell >> 3] ?? 0) | (0x80 >> (cell & 7))
                }
            }
        }
    }
    return bits
}

async function Main() {
    const topology = await Download()
    const bits = Rasterize(Rings(topology, Arcs(topology)))
    const land = [...bits].reduce((total, byte) => total + byte.toString(2).replace(/0/g, "").length, 0)
    const data = Buffer.from(bits).toString("base64")
    const lines = data.match(/.{1,120}/g) ?? []
    const source = [
        `export const LAND_WIDTH = ${WIDTH}`,
        "",
        `export const LAND_HEIGHT = ${HEIGHT}`,
        "",
        "export const LAND_MASK =",
        ...lines.map((line, index) => `    "${line}"${index < lines.length - 1 ? " +" : ""}`),
        "",
    ].join("\n")
    writeFileSync(OUTPUT, source)
    console.log(`Wrote ${WIDTH}x${HEIGHT} land mask, ${((land / (WIDTH * HEIGHT)) * 100).toFixed(1)}% land`)
}

await Main()
