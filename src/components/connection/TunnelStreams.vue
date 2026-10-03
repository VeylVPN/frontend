<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import { MotionReduced } from "../../lib/motion"

export type StreamMode = "off" | "charge" | "lock" | "release"

const props = defineProps<{ mode: StreamMode; ratio: number }>()

type Particle = {
    r: number
    a: number
    vr: number
    va: number
    accel: number
    life: number
    max: number
    size: number
    kind: "in" | "out" | "spark"
}

const canvas = ref<HTMLCanvasElement | null>(null)

let frame = 0
let last = 0
let width = 0
let height = 0
let dpr = 1
let spawn = 0
let ring = -1
let particles: Particle[] = []
let resizer: ResizeObserver | null = null

function Reduced(): boolean {
    return MotionReduced()
}

function Orb(): number {
    return Math.min(width, height) / props.ratio / 2
}

function Measure() {
    const element = canvas.value
    if (!element) {
        return
    }
    dpr = Math.min(2, window.devicePixelRatio || 1)
    width = element.clientWidth
    height = element.clientHeight
    element.width = Math.round(width * dpr)
    element.height = Math.round(height * dpr)
}

function Random(min: number, max: number): number {
    return min + Math.random() * (max - min)
}

function Inbound(): Particle {
    const orb = Orb()
    const r = orb * Random(2.1, 4.6)
    const a = Random(0, Math.PI * 2)
    return { r, a, vr: -Random(20, 70), va: Random(0.55, 1.35), accel: -Random(260, 520), life: 0, max: 4, size: Random(1, 2.2), kind: "in" }
}

function Outbound(): Particle {
    const orb = Orb()
    return {
        r: orb * Random(1, 1.15),
        a: Random(0, Math.PI * 2),
        vr: Random(140, 460),
        va: Random(0.4, 1.4),
        accel: -Random(120, 260),
        life: 0,
        max: Random(0.7, 1.25),
        size: Random(1, 2.4),
        kind: "out",
    }
}

function Spark(): Particle {
    const orb = Orb()
    return {
        r: orb * 1.02,
        a: Random(0, Math.PI * 2),
        vr: Random(380, 980),
        va: Random(-0.3, 0.3),
        accel: -Random(500, 900),
        life: 0,
        max: Random(0.45, 0.85),
        size: Random(1.2, 2.8),
        kind: "spark",
    }
}

function Burst() {
    for (const particle of particles) {
        if (particle.kind === "in") {
            particle.accel *= 5
            particle.vr -= 260
        }
    }
    for (let index = 0; index < 70; index++) {
        particles.push(Spark())
    }
    ring = 0
}

function Release() {
    particles = particles.filter((particle) => particle.kind !== "in")
    for (let index = 0; index < 90; index++) {
        const particle = Outbound()
        particle.life = -Random(0, 0.35)
        particles.push(particle)
    }
}

function Step(delta: number) {
    const orb = Orb()
    if (props.mode === "charge") {
        spawn += delta * 85
        while (spawn >= 1) {
            spawn -= 1
            particles.push(Inbound())
        }
    }
    const kept: Particle[] = []
    for (const particle of particles) {
        particle.life += delta
        if (particle.life < 0) {
            kept.push(particle)
            continue
        }
        particle.vr += particle.accel * delta
        if (particle.kind !== "in") {
            particle.vr = Math.max(particle.kind === "spark" ? 20 : 30, particle.vr)
        }
        particle.r += particle.vr * delta
        particle.a += particle.va * delta * (particle.kind === "in" ? 1 + orb / Math.max(particle.r, 1) : 1)
        const alive = particle.kind === "in" ? particle.r > orb * 1.04 && particle.life < particle.max : particle.life < particle.max
        if (alive) {
            kept.push(particle)
        }
    }
    particles = kept
    if (ring >= 0) {
        ring += delta
        if (ring > 1.1) {
            ring = -1
        }
    }
}

function Draw() {
    const context = canvas.value?.getContext("2d")
    if (!context) {
        return
    }
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.globalCompositeOperation = "lighter"
    context.lineCap = "round"
    const cx = width / 2
    const cy = height / 2
    const orb = Orb()
    for (const particle of particles) {
        if (particle.life < 0) {
            continue
        }
        const cos = Math.cos(particle.a)
        const sin = Math.sin(particle.a)
        const x = cx + cos * particle.r
        const y = cy + sin * particle.r
        const tangent = particle.r * particle.va
        const vx = cos * particle.vr - sin * tangent
        const vy = sin * particle.vr + cos * tangent
        const tail = particle.kind === "in" ? 0.045 : 0.03
        let alpha: number
        if (particle.kind === "in") {
            const near = 1 - Math.min(1, (particle.r - orb) / (orb * 3.6))
            alpha = Math.min(1, particle.life * 3) * (0.22 + near * 0.78)
            context.strokeStyle = `rgba(${Math.round(150 + near * 105)},${Math.round(140 + near * 115)},255,${alpha.toFixed(3)})`
        } else {
            const fade = 1 - particle.life / particle.max
            alpha = fade * fade
            context.strokeStyle = particle.kind === "spark" ? `rgba(238,234,255,${alpha.toFixed(3)})` : `rgba(128,140,255,${(alpha * 0.85).toFixed(3)})`
        }
        context.lineWidth = particle.size
        context.beginPath()
        context.moveTo(x - vx * tail, y - vy * tail)
        context.lineTo(x, y)
        context.stroke()
    }
    if (ring >= 0) {
        const k = ring / 1.1
        const eased = 1 - (1 - k) ** 3
        context.lineWidth = 2.5 * (1 - k) + 0.5
        context.strokeStyle = `rgba(214,208,255,${(0.85 * (1 - k)).toFixed(3)})`
        context.shadowColor = "rgba(143,127,255,0.9)"
        context.shadowBlur = 24
        context.beginPath()
        context.arc(cx, cy, orb * (1.05 + eased * 3.4), 0, Math.PI * 2)
        context.stroke()
        context.shadowBlur = 0
    }
    context.globalCompositeOperation = "source-over"
}

function Tick(now: number) {
    frame = 0
    const delta = last ? Math.min(0.05, (now - last) / 1000) : 0
    last = now
    Step(delta)
    Draw()
    if ((props.mode === "charge" || particles.length || ring >= 0) && !document.hidden) {
        frame = requestAnimationFrame(Tick)
    } else {
        last = 0
        Draw()
    }
}

function Wake() {
    if (Reduced()) {
        particles = []
        ring = -1
        Draw()
        return
    }
    if (!frame) {
        last = 0
        frame = requestAnimationFrame(Tick)
    }
}

watch(
    () => props.mode,
    (mode, previous) => {
        if (mode === "lock" && previous !== "lock") {
            Burst()
        }
        if (mode === "release" && previous !== "release") {
            Release()
        }
        Wake()
    },
)

function OnVisibility() {
    if (!document.hidden) {
        Wake()
    }
}

onMounted(() => {
    Measure()
    resizer = new ResizeObserver(Measure)
    if (canvas.value) {
        resizer.observe(canvas.value)
    }
    document.addEventListener("visibilitychange", OnVisibility)
    if (props.mode === "charge") {
        Wake()
    }
})

onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    resizer?.disconnect()
    document.removeEventListener("visibilitychange", OnVisibility)
})
</script>

<template>
    <canvas ref="canvas" class="block" aria-hidden="true" />
</template>
