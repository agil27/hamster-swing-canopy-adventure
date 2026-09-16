import { CEILING_Y, GROUND_Y, VIEW_H, VIEW_W } from '../constants'
import { TAU } from '../rng'
import type { Chunk } from '../types'

/** Cheap deterministic hash → [0,1). Used for infinite procedural scenery. */
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Gradients are expensive to rebuild every frame, so cache the static ones.
const gradientCache = new Map<string, CanvasGradient>()
function cachedGradient(
  ctx: CanvasRenderingContext2D,
  key: string,
  build: (ctx: CanvasRenderingContext2D) => CanvasGradient,
) {
  let g = gradientCache.get(key)
  if (!g) {
    g = build(ctx)
    gradientCache.set(key, g)
  }
  return g
}

export function clearGradientCache() {
  gradientCache.clear()
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

export function drawSky(ctx: CanvasRenderingContext2D, time: number, gloom: number) {
  const bucket = Math.round(gloom * 10)
  const grad = cachedGradient(ctx, `sky-${bucket}`, (c) => {
    const g = c.createLinearGradient(0, 0, 0, VIEW_H)
    const mix = bucket / 10
    // Warm storybook sunset, darkening as the canopy thickens.
    g.addColorStop(0, mix > 0.4 ? '#3b2f66' : '#8ec5e8')
    g.addColorStop(0.28, mix > 0.4 ? '#6a5391' : '#bfe0f0')
    g.addColorStop(0.52, mix > 0.4 ? '#b98a9a' : '#ffd9b0')
    g.addColorStop(0.74, '#ffc98e')
    g.addColorStop(1, '#ffe7c2')
    return g
  })
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // Low sun with a soft bloom.
  const sunX = VIEW_W * 0.74
  const sunY = VIEW_H * 0.42
  const bloom = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 330)
  bloom.addColorStop(0, 'rgba(255,246,214,0.95)')
  bloom.addColorStop(0.28, 'rgba(255,220,150,0.55)')
  bloom.addColorStop(1, 'rgba(255,200,130,0)')
  ctx.fillStyle = bloom
  ctx.beginPath()
  ctx.arc(sunX, sunY, 330, 0, TAU)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,252,235,0.9)'
  ctx.beginPath()
  ctx.arc(sunX, sunY, 46, 0, TAU)
  ctx.fill()

  // Slanted sunbeams drifting through the canopy.
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 5; i++) {
    const t = time * 0.06 + i * 1.7
    const x = ((Math.sin(t * 0.3 + i) * 0.5 + 0.5) * VIEW_W * 1.2) - VIEW_W * 0.1
    const w = 60 + Math.sin(t + i) * 26
    const g = ctx.createLinearGradient(x, 0, x + 180, VIEW_H)
    g.addColorStop(0, 'rgba(255,244,205,0.16)')
    g.addColorStop(1, 'rgba(255,230,180,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + w, 0)
    ctx.lineTo(x + w + 230, VIEW_H)
    ctx.lineTo(x + 180, VIEW_H)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export function drawClouds(ctx: CanvasRenderingContext2D, camX: number, time: number) {
  const parallax = 0.055
  const spacing = 460
  const offset = camX * parallax
  const start = Math.floor(offset / spacing) - 1
  const end = start + Math.ceil(VIEW_W / spacing) + 3

  ctx.save()
  for (let k = start; k <= end; k++) {
    const r1 = hash(k * 3.17)
    const r2 = hash(k * 7.91)
    const r3 = hash(k * 13.3)
    const x = k * spacing + r1 * 220 - offset
    const y = 40 + r2 * 210 + Math.sin(time * 0.24 + k) * 9
    const scale = 0.6 + r3 * 0.85
    const alpha = 0.5 + r2 * 0.32

    ctx.globalAlpha = alpha
    ctx.fillStyle = r1 > 0.55 ? '#fff3e2' : '#ffffff'
    drawCloud(ctx, x, y, scale)
  }
  ctx.restore()
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.ellipse(x, y, 62 * s, 34 * s, 0, 0, TAU)
  ctx.ellipse(x - 52 * s, y + 10 * s, 40 * s, 24 * s, 0, 0, TAU)
  ctx.ellipse(x + 50 * s, y + 12 * s, 44 * s, 26 * s, 0, 0, TAU)
  ctx.ellipse(x + 12 * s, y - 22 * s, 38 * s, 28 * s, 0, 0, TAU)
  ctx.fill()
}

// ---------------------------------------------------------------------------
// Forest depth layers
// ---------------------------------------------------------------------------

interface ForestLayer {
  parallax: number
  spacing: number
  baseY: number
  minH: number
  maxH: number
  color: string
  lightColor: string
  lightChance: number
  scale: number
}

const FOREST_LAYERS: ForestLayer[] = [
  {
    parallax: 0.16,
    spacing: 168,
    baseY: GROUND_Y - 24,
    minH: 240,
    maxH: 360,
    color: 'rgba(118,146,150,0.55)',
    lightColor: 'rgba(255,240,190,0.5)',
    lightChance: 0.35,
    scale: 0.82,
  },
  {
    parallax: 0.33,
    spacing: 210,
    baseY: GROUND_Y + 6,
    minH: 300,
    maxH: 430,
    color: 'rgba(63,104,84,0.78)',
    lightColor: 'rgba(255,230,160,0.75)',
    lightChance: 0.55,
    scale: 1,
  },
  {
    parallax: 0.56,
    spacing: 268,
    baseY: GROUND_Y + 34,
    minH: 360,
    maxH: 520,
    color: 'rgba(28,62,47,0.92)',
    lightColor: 'rgba(255,225,150,0.95)',
    lightChance: 0.75,
    scale: 1.18,
  },
]

export function drawForest(ctx: CanvasRenderingContext2D, camX: number, time: number, gloom: number) {
  for (let li = 0; li < FOREST_LAYERS.length; li++) {
    const layer = FOREST_LAYERS[li]
    const offset = camX * layer.parallax
    const start = Math.floor(offset / layer.spacing) - 1
    const end = start + Math.ceil(VIEW_W / layer.spacing) + 2

    for (let k = start; k <= end; k++) {
      const seed = k * 31.7 + li * 917.3
      const r1 = hash(seed)
      const r2 = hash(seed + 1.3)
      const r3 = hash(seed + 5.9)
      const x = k * layer.spacing + (r1 - 0.5) * layer.spacing * 0.5 - offset
      if (x < -260 || x > VIEW_W + 260) continue
      const h = layer.minH + r2 * (layer.maxH - layer.minH)
      const w = (48 + r3 * 34) * layer.scale
      drawTree(ctx, x, layer.baseY, h, w, layer, seed, time, gloom)
    }
  }
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  w: number,
  layer: ForestLayer,
  seed: number,
  time: number,
  gloom: number,
) {
  const sway = Math.sin(time * 0.5 + seed) * (2 + layer.parallax * 5)

  ctx.save()
  ctx.fillStyle = layer.color

  // Trunk — a soft tapered wedge.
  ctx.beginPath()
  ctx.moveTo(x - w * 0.17, baseY)
  ctx.lineTo(x - w * 0.09, baseY - h * 0.62)
  ctx.lineTo(x + w * 0.09 + sway * 0.3, baseY - h * 0.62)
  ctx.lineTo(x + w * 0.17, baseY)
  ctx.closePath()
  ctx.fill()

  // Canopy — stacked blobs, smaller toward the top.
  const blobs = 4
  for (let i = 0; i < blobs; i++) {
    const t = i / (blobs - 1)
    const by = baseY - h * (0.56 + t * 0.44)
    const bw = w * (1.85 - t * 0.95)
    const bh = h * (0.16 - t * 0.045) + 26
    const wobble = sway * (0.4 + t)
    ctx.beginPath()
    ctx.ellipse(x + wobble + (hash(seed + i * 3.3) - 0.5) * w * 0.5, by, bw, bh, 0, 0, TAU)
    ctx.fill()
  }

  // Glowing fairy lights nestled in the leaves.
  const lightCount = Math.floor(hash(seed + 21.1) * 5)
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < lightCount; i++) {
    if (hash(seed + i * 9.7) > layer.lightChance) continue
    const lx = x + (hash(seed + i * 4.1) - 0.5) * w * 2.6
    const ly = baseY - h * (0.58 + hash(seed + i * 6.3) * 0.42)
    const pulse = 0.55 + 0.45 * Math.sin(time * 2.1 + seed + i)
    const r = (3 + hash(seed + i * 2.2) * 3.4) * (0.75 + pulse * 0.6) * (1 + gloom * 0.5)
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 4.2)
    g.addColorStop(0, layer.lightColor)
    g.addColorStop(0.35, 'rgba(255,220,150,0.35)')
    g.addColorStop(1, 'rgba(255,210,140,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(lx, ly, r * 4.2, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Luminous spores + sun dust drifting in the mid-ground. */
export function drawSpores(ctx: CanvasRenderingContext2D, camX: number, time: number) {
  const parallax = 0.72
  const spacing = 92
  const offset = camX * parallax
  const start = Math.floor(offset / spacing) - 1
  const end = start + Math.ceil(VIEW_W / spacing) + 2

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let k = start; k <= end; k++) {
    for (let i = 0; i < 2; i++) {
      const seed = k * 17.3 + i * 53.1
      const r1 = hash(seed)
      const r2 = hash(seed + 2.7)
      const x = k * spacing + r1 * spacing - offset
      const drift = Math.sin(time * 0.5 + seed) * 22
      const y = 80 + r2 * (GROUND_Y - 140) + drift
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.4 + seed * 3))
      const r = (1.6 + r1 * 2.6) * (0.7 + pulse)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
      g.addColorStop(0, `rgba(255,248,205,${0.5 * pulse})`)
      g.addColorStop(1, 'rgba(255,240,190,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r * 5, 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Canopy ceiling
// ---------------------------------------------------------------------------

export function drawCanopy(
  ctx: CanvasRenderingContext2D,
  camX: number,
  chunks: Chunk[],
  time: number,
  gloom: number,
) {
  // Mossy slab with a scalloped underside.
  const grad = cachedGradient(ctx, 'canopy', (c) => {
    const g = c.createLinearGradient(0, 0, 0, CEILING_Y + 30)
    g.addColorStop(0, '#16361f')
    g.addColorStop(0.55, '#245231')
    g.addColorStop(1, '#3d7a41')
    return g
  })

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(VIEW_W, 0)
  ctx.lineTo(VIEW_W, CEILING_Y - 12)
  // Scalloped moss edge that scrolls with the world.
  const step = 46
  const phase = -(camX % step)
  for (let x = VIEW_W; x >= -step; x -= step) {
    const sx = x + phase
    const bump = 12 + Math.sin((x + camX) * 0.021) * 7
    ctx.quadraticCurveTo(sx - step / 2, CEILING_Y - 12 + bump, sx - step, CEILING_Y - 12)
  }
  ctx.lineTo(-step, 0)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Moss speckles catching the light.
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137.5 - camX * 0.9) % (VIEW_W + 80) + VIEW_W + 80) % (VIEW_W + 80) - 40
    const sy = 18 + hash(i * 5.1) * (CEILING_Y - 40)
    ctx.fillStyle = hash(i) > 0.5 ? 'rgba(146,209,124,0.7)' : 'rgba(96,165,90,0.6)'
    ctx.beginPath()
    ctx.ellipse(sx, sy, 8 + hash(i * 2.3) * 12, 4 + hash(i * 3.7) * 5, 0, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // Hanging ivy vines.
  for (const chunk of chunks) {
    for (const v of chunk.vines) {
      const x = v.x - camX
      if (x < -60 || x > VIEW_W + 60) continue
      drawVine(ctx, x, v.length, v.phase, v.leaves, v.hue, time)
    }
  }

  // Gloom wash underneath the canopy for the darker tiers.
  if (gloom > 0.01) {
    const g = ctx.createLinearGradient(0, CEILING_Y - 20, 0, CEILING_Y + 260)
    g.addColorStop(0, `rgba(14,26,20,${0.5 * gloom})`)
    g.addColorStop(1, 'rgba(14,26,20,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, CEILING_Y - 20, VIEW_W, 280)
  }
}

function drawVine(
  ctx: CanvasRenderingContext2D,
  x: number,
  length: number,
  phase: number,
  leaves: number,
  hue: number,
  time: number,
) {
  const sway = Math.sin(time * 0.9 + phase) * 9
  ctx.save()
  ctx.strokeStyle = `hsl(${hue}, 38%, 32%)`
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, CEILING_Y - 14)
  ctx.quadraticCurveTo(x + sway * 0.5, CEILING_Y + length * 0.55, x + sway, CEILING_Y + length)
  ctx.stroke()

  ctx.fillStyle = `hsl(${hue}, 44%, 44%)`
  for (let i = 1; i <= leaves; i++) {
    const t = i / (leaves + 1)
    const lx = x + sway * t * t
    const ly = CEILING_Y - 14 + length * t
    const side = i % 2 === 0 ? 1 : -1
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(side * 0.7 + Math.sin(time + phase + i) * 0.12)
    ctx.beginPath()
    ctx.ellipse(side * 9, 0, 11, 6, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

export function drawGround(ctx: CanvasRenderingContext2D, camX: number, chunks: Chunk[], time: number) {
  const grad = cachedGradient(ctx, 'ground', (c) => {
    const g = c.createLinearGradient(0, GROUND_Y - 10, 0, VIEW_H)
    g.addColorStop(0, '#8fd35f')
    g.addColorStop(0.18, '#63b552')
    g.addColorStop(0.62, '#3e8a45')
    g.addColorStop(1, '#2b6636')
    return g
  })

  // Rolling grass crown.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-10, VIEW_H)
  ctx.lineTo(-10, GROUND_Y)
  const step = 28
  for (let x = -10; x <= VIEW_W + step; x += step) {
    const y = GROUND_Y - 4 - Math.sin((x + camX) * 0.012) * 5 - Math.sin((x + camX) * 0.045) * 2.5
    ctx.lineTo(x, y)
  }
  ctx.lineTo(VIEW_W + 10, VIEW_H)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Bright rim along the very top of the grass.
  ctx.strokeStyle = 'rgba(190,240,150,0.75)'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let x = -10; x <= VIEW_W + step; x += step) {
    const y = GROUND_Y - 4 - Math.sin((x + camX) * 0.012) * 5 - Math.sin((x + camX) * 0.045) * 2.5
    if (x === -10) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // Flower-dotted meadow props.
  for (const chunk of chunks) {
    for (const p of chunk.grass) {
      const x = p.x - camX
      if (x < -40 || x > VIEW_W + 40) continue
      drawGrassProp(ctx, x, p.kind, p.scale, p.hue, p.phase, time, camX)
    }
  }
}

function drawGrassProp(
  ctx: CanvasRenderingContext2D,
  x: number,
  kind: 'buttercup' | 'clover' | 'dandelion' | 'blade',
  scale: number,
  hue: number,
  phase: number,
  time: number,
  camX: number,
) {
  const baseY = GROUND_Y - 4 - Math.sin((x + camX) * 0.012) * 5
  const sway = Math.sin(time * 1.6 + phase) * 3 * scale

  ctx.save()
  ctx.translate(x, baseY)

  switch (kind) {
    case 'blade': {
      ctx.strokeStyle = `hsl(${hue}, 52%, 38%)`
      ctx.lineWidth = 3 * scale
      ctx.lineCap = 'round'
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.moveTo(i * 5 * scale, 2)
        ctx.quadraticCurveTo(i * 7 * scale + sway, -12 * scale, i * 10 * scale + sway * 1.6, -22 * scale)
        ctx.stroke()
      }
      break
    }
    case 'clover': {
      ctx.fillStyle = `hsl(${hue}, 46%, 42%)`
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.85
        ctx.beginPath()
        ctx.ellipse(
          Math.cos(a) * 7 * scale + sway,
          Math.sin(a) * 7 * scale - 8 * scale,
          6 * scale,
          5 * scale,
          a,
          0,
          TAU,
        )
        ctx.fill()
      }
      break
    }
    case 'buttercup': {
      ctx.strokeStyle = `hsl(${hue}, 48%, 34%)`
      ctx.lineWidth = 2.4 * scale
      ctx.beginPath()
      ctx.moveTo(0, 2)
      ctx.quadraticCurveTo(sway, -12 * scale, sway * 1.4, -22 * scale)
      ctx.stroke()
      const fx = sway * 1.4
      const fy = -22 * scale
      ctx.fillStyle = '#ffd95c'
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU
        ctx.beginPath()
        ctx.ellipse(fx + Math.cos(a) * 5 * scale, fy + Math.sin(a) * 5 * scale, 4.4 * scale, 4.4 * scale, 0, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#ff9f43'
      ctx.beginPath()
      ctx.arc(fx, fy, 3 * scale, 0, TAU)
      ctx.fill()
      break
    }
    case 'dandelion': {
      ctx.strokeStyle = `hsl(${hue}, 40%, 36%)`
      ctx.lineWidth = 2.2 * scale
      ctx.beginPath()
      ctx.moveTo(0, 2)
      ctx.quadraticCurveTo(sway, -16 * scale, sway * 1.5, -30 * scale)
      ctx.stroke()
      const px = sway * 1.5
      const py = -30 * scale
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1.1 * scale
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU + Math.sin(time + phase) * 0.1
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px + Math.cos(a) * 9 * scale, py + Math.sin(a) * 9 * scale)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU + Math.sin(time + phase) * 0.1
        ctx.beginPath()
        ctx.arc(px + Math.cos(a) * 9 * scale, py + Math.sin(a) * 9 * scale, 1.7 * scale, 0, TAU)
        ctx.fill()
      }
      break
    }
  }
  ctx.restore()
}
