import { TAU } from './rng'

export type ParticleKind =
  | 'spark'
  | 'impactStar'
  | 'dust'
  | 'heart'
  | 'rainbow'
  | 'ring'
  | 'text'
  | 'petal'
  | 'comic'

export interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  rot: number
  vrot: number
  color: string
  gravity: number
  drag: number
  text?: string
  /** Extra emphasis for text popups. */
  bold?: boolean
  /** Rings grow from size to size * spread. */
  spread?: number
}

const TWO_PI = TAU

/** Draws a classic five-pointed cartoon star centred on the origin. */
export function starPath(ctx: CanvasRenderingContext2D, r: number, inner = 0.46) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * inner
    const a = (i / 10) * TWO_PI - Math.PI / 2
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** Four-point sparkle — the twinkly "magic" shape. */
export function sparklePath(ctx: CanvasRenderingContext2D, r: number) {
  const w = r * 0.28
  ctx.beginPath()
  ctx.moveTo(0, -r)
  ctx.quadraticCurveTo(w, -w, r, 0)
  ctx.quadraticCurveTo(w, w, 0, r)
  ctx.quadraticCurveTo(-w, w, -r, 0)
  ctx.quadraticCurveTo(-w, -w, 0, -r)
  ctx.closePath()
}

/** Jagged American-comic "impact burst" — the explosion shape behind a
 *  POW!/BAM! callout. Deliberately irregular (unlike starPath's clean
 *  five points) so it reads as a hand-drawn ink burst, not a sticker. */
export function comicBurstPath(ctx: CanvasRenderingContext2D, r: number) {
  const spikes = [1, 0.5, 0.82, 0.42, 1.08, 0.46, 0.78, 0.4, 1, 0.52, 0.9, 0.38, 1.1, 0.48, 0.8, 0.44]
  ctx.beginPath()
  for (let i = 0; i < spikes.length; i++) {
    const a = (i / spikes.length) * TWO_PI - Math.PI / 2
    const rad = r * spikes[i]
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

export function heartPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  ctx.moveTo(0, r * 0.72)
  ctx.bezierCurveTo(-r * 1.32, -r * 0.14, -r * 0.62, -r * 1.16, 0, -r * 0.46)
  ctx.bezierCurveTo(r * 0.62, -r * 1.16, r * 1.32, -r * 0.14, 0, r * 0.72)
  ctx.closePath()
}

const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#faa2c1']

export class ParticleSystem {
  private items: Particle[] = []
  /** Hard cap so a long combo chain can never tank the frame rate. */
  private readonly max = 900

  get count() {
    return this.items.length
  }

  clear() {
    this.items.length = 0
  }

  private push(p: Particle) {
    if (this.items.length >= this.max) this.items.shift()
    this.items.push(p)
  }

  // -------------------------------------------------------------------------
  // Emitters
  // -------------------------------------------------------------------------

  /** Twinkling sparkle burst — seeds, hearts, magic. */
  sparkleBurst(x: number, y: number, count: number, color: string, speed = 220, size = 9) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TWO_PI
      const s = speed * (0.35 + Math.random() * 0.8)
      this.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.4,
        size: size * (0.6 + Math.random() * 0.7),
        rot: Math.random() * TWO_PI,
        vrot: (Math.random() - 0.5) * 9,
        color,
        gravity: 180,
        drag: 1.6,
      })
    }
  }

  /** Comic impact stars that spin away from a hit. */
  impactStars(x: number, y: number, count = 7, color = '#ffd166') {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5
      const s = 240 + Math.random() * 300
      this.push({
        kind: 'impactStar',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.45,
        size: 11 + Math.random() * 9,
        rot: Math.random() * TWO_PI,
        vrot: (Math.random() - 0.5) * 16,
        color,
        gravity: 620,
        drag: 0.9,
      })
    }
  }

  /** Soft dust puffs — landings, stomps, ground scuffs. */
  dustPuff(x: number, y: number, count = 8, color = 'rgba(255,248,230,0.85)', spread = 170) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TWO_PI
      const s = spread * (0.2 + Math.random())
      this.push({
        kind: 'dust',
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.55 - 30,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.5,
        size: 10 + Math.random() * 18,
        rot: 0,
        vrot: 0,
        color,
        gravity: -25,
        drag: 2.6,
      })
    }
  }

  /** Heart sparkles for pickups and healing. */
  heartSparkle(x: number, y: number, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
      const s = 90 + Math.random() * 190
      this.push({
        kind: 'heart',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.5,
        size: 7 + Math.random() * 8,
        rot: (Math.random() - 0.5) * 0.7,
        vrot: (Math.random() - 0.5) * 4,
        color: i % 3 === 0 ? '#ffd1dc' : '#ff5a7a',
        gravity: -60,
        drag: 1.4,
      })
    }
  }

  /** Rainbow trail dot dropped behind an invincible hamster. */
  rainbowTrail(x: number, y: number, index: number) {
    this.push({
      kind: 'rainbow',
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40 - 20,
      life: 0,
      maxLife: 0.55,
      size: 16 + Math.random() * 10,
      rot: 0,
      vrot: 0,
      color: RAINBOW[index % RAINBOW.length],
      gravity: -40,
      drag: 1.2,
    })
  }

  /** Expanding shockwave ring. */
  ring(x: number, y: number, color: string, size = 28, spread = 4, life = 0.45) {
    this.push({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: life,
      size,
      rot: 0,
      vrot: 0,
      color,
      gravity: 0,
      drag: 0,
      spread,
    })
  }

  /** Floating score popup: "+100", "x2 COMBO", etc. */
  popup(x: number, y: number, text: string, color = '#fff6d5', bold = true, size = 30) {
    this.push({
      kind: 'text',
      x,
      y,
      vx: (Math.random() - 0.5) * 30,
      vy: -120,
      life: 0,
      maxLife: 1.15,
      size,
      rot: 0,
      vrot: 0,
      color,
      gravity: 60,
      drag: 1.1,
      text,
      bold,
    })
  }

  /** American-comic-style impact callout — "POW!", "SPLAT!" — a jagged ink
   *  burst behind bold slanted lettering, punching in hard and gone fast. */
  comicPop(x: number, y: number, text: string, color = '#ffd166') {
    this.push({
      kind: 'comic',
      x,
      y,
      vx: 0,
      vy: -36,
      life: 0,
      maxLife: 0.6,
      size: 38,
      rot: (Math.random() - 0.5) * 0.16,
      vrot: 0,
      color,
      gravity: -30,
      drag: 2.4,
      text,
      bold: true,
    })
  }

  /** Drifting petals/spores used for ambience near the player. */
  petal(x: number, y: number, color: string) {
    this.push({
      kind: 'petal',
      x,
      y,
      vx: (Math.random() - 0.5) * 50 - 20,
      vy: 20 + Math.random() * 40,
      life: 0,
      maxLife: 2.2 + Math.random(),
      size: 5 + Math.random() * 6,
      rot: Math.random() * TWO_PI,
      vrot: (Math.random() - 0.5) * 3,
      color,
      gravity: 12,
      drag: 0.5,
    })
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  update(dt: number) {
    const items = this.items
    let write = 0
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      p.life += dt
      if (p.life >= p.maxLife) continue

      if (p.drag > 0) {
        const d = Math.exp(-p.drag * dt)
        p.vx *= d
        p.vy *= d
      }
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vrot * dt

      items[write++] = p
    }
    items.length = write
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const p of this.items) {
      const t = p.life / p.maxLife
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      if (alpha <= 0) continue
      const x = p.x - camX
      const y = p.y - camY

      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
      ctx.translate(x, y)

      switch (p.kind) {
        case 'spark': {
          ctx.rotate(p.rot)
          const s = p.size * (1 - t * 0.5)
          ctx.fillStyle = p.color
          ctx.shadowColor = p.color
          ctx.shadowBlur = 12
          sparklePath(ctx, s)
          ctx.fill()
          break
        }
        case 'impactStar': {
          ctx.rotate(p.rot)
          const s = p.size * (1 - t * 0.28)
          ctx.fillStyle = p.color
          ctx.strokeStyle = 'rgba(96,52,18,0.85)'
          ctx.lineWidth = 2.4
          ctx.shadowColor = 'rgba(255,209,102,0.8)'
          ctx.shadowBlur = 10
          starPath(ctx, s)
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.stroke()
          break
        }
        case 'dust': {
          const s = p.size * (0.5 + t * 1.1)
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s)
          g.addColorStop(0, p.color)
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(0, 0, s, 0, TWO_PI)
          ctx.fill()
          break
        }
        case 'heart': {
          ctx.rotate(p.rot)
          const s = p.size * (1 - t * 0.35)
          ctx.fillStyle = p.color
          ctx.shadowColor = 'rgba(255,90,122,0.9)'
          ctx.shadowBlur = 12
          heartPath(ctx, s)
          ctx.fill()
          break
        }
        case 'rainbow': {
          const s = p.size * (1 - t * 0.6)
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s)
          g.addColorStop(0, p.color)
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(0, 0, s, 0, TWO_PI)
          ctx.fill()
          break
        }
        case 'ring': {
          const s = p.size * (1 + t * (p.spread ?? 3))
          ctx.strokeStyle = p.color
          ctx.lineWidth = Math.max(1, 7 * (1 - t))
          ctx.beginPath()
          ctx.arc(0, 0, s, 0, TWO_PI)
          ctx.stroke()
          break
        }
        case 'petal': {
          ctx.rotate(p.rot)
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TWO_PI)
          ctx.fill()
          break
        }
        case 'text': {
          const pop = t < 0.2 ? 0.7 + (t / 0.2) * 0.42 : 1.12 - (t - 0.2) * 0.14
          ctx.scale(pop, pop)
          ctx.font = `800 ${p.size}px "Baloo 2", "Nunito", system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineJoin = 'round'
          ctx.lineWidth = 7
          ctx.strokeStyle = 'rgba(74,38,16,0.92)'
          ctx.strokeText(p.text!, 0, 0)
          const grad = ctx.createLinearGradient(0, -p.size * 0.6, 0, p.size * 0.6)
          grad.addColorStop(0, '#ffffff')
          grad.addColorStop(1, p.color)
          ctx.fillStyle = grad
          ctx.fillText(p.text!, 0, 0)
          break
        }
        case 'comic': {
          // Punches in fast with a little overshoot, then settles — the
          // classic comic-panel "POW!" pop.
          const pop = t < 0.18 ? 0.35 + (t / 0.18) * 0.95 : 1.3 - ((t - 0.18) / 0.82) * 0.3
          ctx.rotate(p.rot)
          ctx.scale(pop, pop)

          // Jagged ink burst behind the lettering.
          const burstR = p.size * 1.55
          ctx.fillStyle = p.color
          ctx.strokeStyle = 'rgba(28,14,8,0.95)'
          ctx.lineWidth = 4
          comicBurstPath(ctx, burstR)
          ctx.fill()
          ctx.stroke()

          // Bold slanted comic lettering, Sunday-strip style.
          ctx.rotate(-0.09)
          ctx.font = `400 ${p.size}px "Bangers", "Baloo 2", system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineJoin = 'round'
          ctx.lineWidth = 6
          ctx.strokeStyle = 'rgba(20,10,4,0.95)'
          ctx.strokeText(p.text!, 0, 0)
          ctx.fillStyle = '#fff8e6'
          ctx.fillText(p.text!, 0, 0)
          break
        }
      }
      ctx.restore()
    }
  }
}
