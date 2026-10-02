<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { GlobeTone } from "../../domain"
import { LAND_HEIGHT, LAND_MASK, LAND_WIDTH } from "./landmask"

const props = withDefaults(defineProps<{ tone: GlobeTone; orbit?: boolean; still?: boolean }>(), { orbit: true, still: false })

type Rgb = [number, number, number]

type Palette = { deep: Rgb; mid: Rgb; high: Rgb; rim: Rgb; gain: number; ocean: number; ring: number }

type Motion = { spin: number; comet: number; fps: number }

const PALETTES: Record<GlobeTone, Palette> = {
    idle: { deep: [40, 46, 150], mid: [86, 104, 240], high: [150, 170, 255], rim: [120, 136, 255], gain: 0.72, ocean: 0.6, ring: 0.35 },
    busy: { deep: [52, 46, 190], mid: [104, 110, 255], high: [170, 186, 255], rim: [150, 150, 255], gain: 0.92, ocean: 0.8, ring: 0.75 },
    on: { deep: [60, 52, 210], mid: [112, 120, 255], high: [206, 214, 255], rim: [196, 190, 255], gain: 1, ocean: 0.9, ring: 1 },
    fail: { deep: [44, 30, 82], mid: [128, 92, 168], high: [164, 128, 196], rim: [150, 110, 170], gain: 0.62, ocean: 0.5, ring: 0.25 },
}

const MOTION: Record<GlobeTone, Motion> = {
    idle: { spin: 0, comet: 0, fps: 0 },
    busy: { spin: 0.34, comet: 2.4, fps: 60 },
    on: { spin: 0.035, comet: 0.55, fps: 24 },
    fail: { spin: 0, comet: 0, fps: 0 },
}

const TILT = 0.34
const INCLINE = 0.32
const ORBIT_RADIUS = 1.28
const LIGHT = Normalize([-0.5, 0.6, 0.62])
const SHADES = 10
const LEVELS = 12
const BLEND = 800
const TRAIL = 26

const host = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

let frame = 0
let resizer: ResizeObserver | null = null
let angle = 0.62
let comet = 1.2
let spin = 0
let orbitSpeed = 0
let last = 0
let drawn = 0
let width = 0
let height = 0
let ratio = 1
let land: Float32Array = new Float32Array()
let ocean: Float32Array = new Float32Array()
let from: Palette = PALETTES[props.tone]
let to: Palette = PALETTES[props.tone]
let blend = 1
let started = 0
let glow: HTMLCanvasElement | null = null
let glowKey = ""
const buckets: number[][][] = Array.from({ length: SHADES }, () => Array.from({ length: LEVELS }, () => []))

function Normalize(vector: Rgb): Rgb {
    const length = Math.hypot(...vector)
    return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function Lerp(a: number, b: number, k: number): number {
    return a + (b - a) * k
}

function Mix(a: Rgb, b: Rgb, k: number): Rgb {
    return [Lerp(a[0], b[0], k), Lerp(a[1], b[1], k), Lerp(a[2], b[2], k)]
}

function Rgba(color: Rgb, alpha: number): string {
    return `rgba(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`
}

function Reduced(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function Mask(): Uint8Array {
    const binary = atob(LAND_MASK)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index)
    }
    return bytes
}

function IsLand(mask: Uint8Array, latitude: number, longitude: number): boolean {
    const row = Math.min(LAND_HEIGHT - 1, Math.max(0, Math.floor(((90 - latitude) / 180) * LAND_HEIGHT)))
    const column = Math.min(LAND_WIDTH - 1, Math.max(0, Math.floor(((longitude + 180) / 360) * LAND_WIDTH)))
    const cell = row * LAND_WIDTH + column
    return ((mask[cell >> 3] ?? 0) & (0x80 >> (cell & 7))) !== 0
}

function Grid(rows: number, mask: Uint8Array, keep: boolean): Float32Array {
    const list: number[] = []
    for (let row = 0; row < rows; row++) {
        const latitude = 90 - ((row + 0.5) / rows) * 180
        const phi = (latitude * Math.PI) / 180
        const count = Math.max(1, Math.round(Math.cos(phi) * rows * 2))
        const offset = (row % 2) * 0.5
        for (let step = 0; step < count; step++) {
            const longitude = -180 + ((step + offset) / count) * 360
            if (IsLand(mask, latitude, longitude) !== keep) {
                continue
            }
            const lambda = (longitude * Math.PI) / 180
            list.push(Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda))
        }
    }
    return new Float32Array(list)
}

function Current(): Palette {
    const k = blend
    return {
        deep: Mix(from.deep, to.deep, k),
        mid: Mix(from.mid, to.mid, k),
        high: Mix(from.high, to.high, k),
        rim: Mix(from.rim, to.rim, k),
        gain: Lerp(from.gain, to.gain, k),
        ocean: Lerp(from.ocean, to.ocean, k),
        ring: Lerp(from.ring, to.ring, k),
    }
}

function Colors(palette: Palette): string[][] {
    return Array.from({ length: SHADES }, (_, shade) => {
        const light = shade / (SHADES - 1)
        const color = light > 0.55 ? Mix(palette.mid, palette.high, (light - 0.55) / 0.45) : Mix(palette.deep, palette.mid, light / 0.55)
        return Array.from({ length: LEVELS }, (_, level) => Rgba(color, ((level + 1) / LEVELS) * palette.gain))
    })
}

function Measure() {
    const element = canvas.value
    if (!element) {
        return
    }
    ratio = Math.min(2, window.devicePixelRatio || 1)
    width = element.clientWidth
    height = element.clientHeight
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
    glowKey = ""
}

function Glow(palette: Palette, radius: number): HTMLCanvasElement {
    const key = `${width}x${height}@${ratio}:${palette.rim.map(Math.round).join(",")}:${palette.gain.toFixed(2)}`
    if (glow && glowKey === key) {
        return glow
    }
    glow ??= document.createElement("canvas")
    glow.width = Math.round(width * ratio)
    glow.height = Math.round(height * ratio)
    const context = glow.getContext("2d")
    if (!context) {
        return glow
    }
    const cx = width / 2
    const cy = height / 2
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    const body = context.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius)
    body.addColorStop(0, Rgba(palette.deep, 0.16 * palette.gain))
    body.addColorStop(0.75, Rgba([10, 10, 34], 0.5))
    body.addColorStop(1, Rgba(palette.mid, 0.12 * palette.gain))
    context.fillStyle = body
    context.beginPath()
    context.arc(cx, cy, radius, 0, Math.PI * 2)
    context.fill()
    const halo = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.14)
    halo.addColorStop(0, Rgba(palette.rim, 0))
    halo.addColorStop(0.83, Rgba(palette.rim, 0))
    halo.addColorStop(0.88, Rgba(palette.rim, 0.26 * palette.gain))
    halo.addColorStop(1, Rgba(palette.rim, 0))
    context.fillStyle = halo
    context.beginPath()
    context.arc(cx, cy, radius * 1.14, 0, Math.PI * 2)
    context.fill()
    const edge = context.createLinearGradient(0, cy - radius, 0, cy + radius * 0.4)
    edge.addColorStop(0, Rgba([236, 234, 255], 0.95 * palette.gain))
    edge.addColorStop(0.35, Rgba(palette.rim, 0.55 * palette.gain))
    edge.addColorStop(1, Rgba(palette.rim, 0))
    context.save()
    context.shadowColor = Rgba(palette.rim, 0.9 * palette.gain)
    context.shadowBlur = radius * 0.07
    context.strokeStyle = edge
    context.lineWidth = Math.max(1.5, radius * 0.012)
    context.beginPath()
    context.arc(cx, cy, radius * 0.998, Math.PI * 1.02, Math.PI * 1.98)
    context.stroke()
    context.restore()
    glowKey = key
    return glow
}

function Project(x: number, y: number, z: number, sin: number, cos: number, tsin: number, tcos: number): [number, number, number] {
    const rx = x * cos + z * sin
    const rz = -x * sin + z * cos
    const ry = y * tcos - rz * tsin
    const depth = y * tsin + rz * tcos
    return [rx, ry, depth]
}

function Orbit(context: CanvasRenderingContext2D, palette: Palette, cx: number, cy: number, radius: number, front: boolean) {
    if (!props.orbit || palette.ring < 0.05) {
        return
    }
    const tsin = Math.sin(TILT)
    const tcos = Math.cos(TILT)
    const isin = Math.sin(INCLINE)
    const icos = Math.cos(INCLINE)
    const dot = Math.max(1, radius / 260)
    const steps = 180
    for (let step = 0; step < steps; step++) {
        const theta = (step / steps) * Math.PI * 2
        const ox = Math.cos(theta) * ORBIT_RADIUS
        const oz = Math.sin(theta) * ORBIT_RADIUS
        const x = ox * icos
        const y = ox * isin
        const [sx, sy, depth] = Project(x, y, oz, 0, 1, tsin, tcos)
        if (depth >= 0 !== front) {
            continue
        }
        if (!front && sx * sx + sy * sy < 1) {
            continue
        }
        const behind = depth < 0 ? 0.45 : 1
        context.fillStyle = Rgba(palette.mid, 0.32 * palette.ring * behind)
        context.fillRect(cx + sx * radius - dot / 2, cy - sy * radius - dot / 2, dot, dot)
    }
    if (orbitSpeed === 0 && palette.ring < 0.6) {
        return
    }
    for (let tail = TRAIL; tail >= 0; tail--) {
        const theta = comet - tail * 0.045
        const ox = Math.cos(theta) * ORBIT_RADIUS
        const oz = Math.sin(theta) * ORBIT_RADIUS
        const [sx, sy, depth] = Project(ox * icos, ox * isin, oz, 0, 1, tsin, tcos)
        if (depth >= 0 !== front) {
            continue
        }
        if (!front && sx * sx + sy * sy < 1) {
            continue
        }
        const fade = 1 - tail / (TRAIL + 1)
        const size = dot * (1 + fade * 2.2)
        context.fillStyle = Rgba(tail === 0 ? [246, 244, 255] : palette.high, fade * fade * palette.ring * (depth < 0 ? 0.5 : 1))
        context.fillRect(cx + sx * radius - size / 2, cy - sy * radius - size / 2, size, size)
    }
}

function Dots(points: Float32Array, isLand: boolean, palette: Palette, cx: number, cy: number, radius: number) {
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    const tsin = Math.sin(TILT)
    const tcos = Math.cos(TILT)
    const unit = Math.max(1, radius / 290)
    for (let index = 0; index < points.length; index += 3) {
        const [rx, ry, depth] = Project(points[index] ?? 0, points[index + 1] ?? 0, points[index + 2] ?? 0, sin, cos, tsin, tcos)
        if (depth < 0.02) {
            continue
        }
        const light = Math.max(0, rx * LIGHT[0] + ry * LIGHT[1] + depth * LIGHT[2])
        const rim = (1 - depth) ** 3
        const shine = Math.min(1, light * 1.05 + rim * 0.55)
        const alpha = isLand ? 0.42 + 0.58 * shine ** 1.1 : (0.03 + 0.13 * shine) * palette.ocean
        const level = Math.min(LEVELS - 1, Math.floor(alpha * LEVELS))
        if (level < 1 && isLand) {
            continue
        }
        const size = isLand ? unit * (1.05 + depth * 0.6 + shine * 0.7) : unit * (0.7 + depth * 0.35)
        buckets[Math.round(shine * (SHADES - 1))]?.[Math.max(0, level)]?.push(cx + rx * radius - size / 2, cy - ry * radius - size / 2, size)
    }
}

function Flush(context: CanvasRenderingContext2D, colors: string[][]) {
    buckets.forEach((shade, shadeIndex) => {
        shade.forEach((level, levelIndex) => {
            if (!level.length) {
                return
            }
            context.fillStyle = colors[shadeIndex]?.[levelIndex] ?? "transparent"
            context.beginPath()
            for (let index = 0; index < level.length; index += 3) {
                const size = level[index + 2] ?? 1
                context.rect(level[index] ?? 0, level[index + 1] ?? 0, size, size)
            }
            context.fill()
            level.length = 0
        })
    })
}

function Draw() {
    const context = canvas.value?.getContext("2d")
    if (!context || !width) {
        return
    }
    const palette = Current()
    const colors = Colors(palette)
    const radius = Math.min(width, height) * 0.4
    const cx = width / 2
    const cy = height / 2
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    Orbit(context, palette, cx, cy, radius, false)
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.drawImage(Glow(palette, radius), 0, 0)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    Dots(ocean, false, palette, cx, cy, radius)
    Flush(context, colors)
    Dots(land, true, palette, cx, cy, radius)
    Flush(context, colors)
    Orbit(context, palette, cx, cy, radius, true)
}

function Tick(now: number) {
    frame = 0
    const motion = Reduced() || (props.still && props.tone !== "busy") ? { spin: 0, comet: 0, fps: 0 } : MOTION[props.tone]
    const delta = last ? Math.min(0.05, (now - last) / 1000) : 0
    last = now
    spin = Lerp(spin, motion.spin, Math.min(1, delta * 1.8))
    orbitSpeed = Lerp(orbitSpeed, motion.comet, Math.min(1, delta * 1.8))
    if (Math.abs(spin) < 0.001 && motion.spin === 0) {
        spin = 0
    }
    if (Math.abs(orbitSpeed) < 0.01 && motion.comet === 0) {
        orbitSpeed = 0
    }
    angle += delta * spin
    comet += delta * orbitSpeed
    blend = Math.min(1, (now - started) / BLEND)
    const settling = blend < 1 || spin !== motion.spin || orbitSpeed !== motion.comet
    const fps = settling ? 60 : motion.fps
    if (fps && now - drawn >= 1000 / fps - 2) {
        drawn = now
        Draw()
    } else if (!fps) {
        Draw()
    }
    const moving = settling || motion.fps > 0
    if (moving && !document.hidden) {
        frame = requestAnimationFrame(Tick)
    } else {
        last = 0
    }
}

function Wake() {
    if (Reduced()) {
        blend = 1
        Draw()
        return
    }
    if (!frame) {
        last = 0
        frame = requestAnimationFrame(Tick)
    }
}

function OnVisibility() {
    if (!document.hidden) {
        Wake()
    }
}

watch(
    () => props.still,
    () => Wake(),
)

watch(
    () => props.tone,
    (tone) => {
        from = blend >= 1 ? to : Current()
        to = PALETTES[tone]
        blend = 0
        started = performance.now()
        Wake()
    },
)

onMounted(() => {
    const mask = Mask()
    const small = (navigator.hardwareConcurrency ?? 8) <= 4
    land = Grid(small ? 96 : 120, mask, true)
    ocean = Grid(small ? 48 : 62, mask, false)
    Measure()
    Draw()
    resizer = new ResizeObserver(() => {
        Measure()
        Draw()
    })
    if (host.value) {
        resizer.observe(host.value)
    }
    document.addEventListener("visibilitychange", OnVisibility)
    Wake()
})

onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    resizer?.disconnect()
    document.removeEventListener("visibilitychange", OnVisibility)
})
</script>

<template>
    <div ref="host" class="aspect-square" aria-hidden="true">
        <div class="relative size-full">
            <div
                class="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgb(76_55_224/0.42),rgb(30_40_160/0.22)_48%,transparent_72%)] blur-2xl transition-opacity duration-700"
                :class="tone === 'on' ? 'opacity-60' : tone === 'busy' ? 'opacity-50' : 'opacity-25'"
            />
            <canvas ref="canvas" class="relative size-full" />
        </div>
    </div>
</template>
