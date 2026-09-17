import { CEILING_Y, GROUND_Y, PLAYER_RADIUS } from '../constants'
import { heartPath, sparklePath, starPath } from '../particles'
import { TAU, clamp } from '../rng'
import type { Anchor, HeartPickup, Monster, Mushroom, Seed } from '../types'
import type { GameEngine } from '../engine'

// ---------------------------------------------------------------------------
// Canopy lanterns (swing anchors)
// ---------------------------------------------------------------------------

export function drawAnchor(ctx: CanvasRenderingContext2D, a: Anchor, camX: number, time: number) {
  const x = a.x - camX
  const sway = Math.sin(time * 1.3 + a.phase) * 4
  const y = a.y
  const glow = 0.55 + 0.45 * Math.sin(time * 2.4 + a.phase) + a.flash * 1.4
  const hot = a.active ? 1 : 0

  ctx.save()

  // Cord up to the canopy.
  ctx.strokeStyle = 'rgba(58,44,26,0.85)'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(x, CEILING_Y - 14)
  ctx.quadraticCurveTo(x + sway * 0.4, (CEILING_Y + y) / 2, x + sway, y - 16)
  ctx.stroke()

  ctx.translate(x + sway, y)
  ctx.rotate(Math.sin(time * 1.3 + a.phase) * 0.06)

  // Warm halo.
  const haloR = 46 + glow * 12 + hot * 22
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, haloR)
  halo.addColorStop(0, `rgba(255,236,170,${0.55 + hot * 0.3})`)
  halo.addColorStop(0.4, `rgba(255,205,110,${0.24 + hot * 0.2})`)
  halo.addColorStop(1, 'rgba(255,190,90,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, 0, haloR, 0, TAU)
  ctx.fill()

  // Lantern cap.
  ctx.fillStyle = '#6b4526'
  ctx.beginPath()
  ctx.moveTo(-11, -16)
  ctx.lineTo(11, -16)
  ctx.lineTo(8, -10)
  ctx.lineTo(-8, -10)
  ctx.closePath()
  ctx.fill()

  // Glass body.
  const body = ctx.createLinearGradient(-10, -10, 10, 14)
  body.addColorStop(0, `hsla(${a.hue}, 95%, ${72 + hot * 12}%, 0.95)`)
  body.addColorStop(0.5, `hsla(${a.hue - 8}, 92%, ${58 + hot * 12}%, 0.95)`)
  body.addColorStop(1, `hsla(${a.hue - 16}, 88%, ${44 + hot * 10}%, 0.95)`)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-9, -10)
  ctx.quadraticCurveTo(-13, 2, -7, 12)
  ctx.lineTo(7, 12)
  ctx.quadraticCurveTo(13, 2, 9, -10)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(92,58,30,0.9)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Inner flame.
  ctx.fillStyle = 'rgba(255,250,220,0.95)'
  ctx.beginPath()
  ctx.ellipse(0, 1, 3.4, 5 + glow, 0, 0, TAU)
  ctx.fill()

  // Base.
  ctx.fillStyle = '#6b4526'
  ctx.fillRect(-8, 11, 16, 4)

  // Bright ring pulse right after a grab or release.
  if (a.flash > 0.02) {
    ctx.strokeStyle = `rgba(255,240,190,${a.flash * 0.8})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, 20 + (1 - a.flash) * 34, 0, TAU)
    ctx.stroke()
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Collectibles
// ---------------------------------------------------------------------------

export function drawSeed(ctx: CanvasRenderingContext2D, s: Seed, camX: number, time: number) {
  const x = s.x - camX
  const y = s.y + Math.sin(time * 2.4 + s.phase) * 5

  ctx.save()
  ctx.translate(x, y)

  // Glow.
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 26)
  g.addColorStop(0, 'rgba(255,226,122,0.55)')
  g.addColorStop(1, 'rgba(255,214,102,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 26, 0, TAU)
  ctx.fill()

  ctx.rotate(Math.sin(time * 1.7 + s.phase) * 0.28 - 0.3)

  // Sunflower seed hull.
  const hull = ctx.createLinearGradient(-8, -11, 8, 11)
  hull.addColorStop(0, '#ffe9a3')
  hull.addColorStop(0.45, '#f6c344')
  hull.addColorStop(1, '#d99320')
  ctx.fillStyle = hull
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.quadraticCurveTo(9, -6, 7, 6)
  ctx.quadraticCurveTo(4, 12, 0, 12)
  ctx.quadraticCurveTo(-4, 12, -7, 6)
  ctx.quadraticCurveTo(-9, -6, 0, -12)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(150,92,22,0.75)'
  ctx.lineWidth = 1.6
  ctx.stroke()

  // Signature stripes.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(-2.5, -7)
  ctx.quadraticCurveTo(-3.5, 1, -2, 8)
  ctx.moveTo(2.5, -7)
  ctx.quadraticCurveTo(3.5, 1, 2, 8)
  ctx.stroke()

  // Twinkle.
  const tw = 0.5 + 0.5 * Math.sin(time * 3.1 + s.phase * 2)
  ctx.globalAlpha = tw
  ctx.fillStyle = '#fffbe6'
  ctx.translate(6, -9)
  sparklePath(ctx, 4.5)
  ctx.fill()

  ctx.restore()
}

export function drawHeartPickup(ctx: CanvasRenderingContext2D, h: HeartPickup, camX: number, time: number) {
  const x = h.x - camX
  const bob = Math.sin(time * 2.1 + h.phase) * 7
  const y = h.y + bob
  const pulse = 1 + Math.sin(time * 4 + h.phase) * 0.07

  ctx.save()
  ctx.translate(x, y)

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 40)
  g.addColorStop(0, 'rgba(255,120,160,0.5)')
  g.addColorStop(1, 'rgba(255,90,130,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 40, 0, TAU)
  ctx.fill()

  ctx.scale(pulse, pulse)
  ctx.rotate(Math.sin(time * 1.4 + h.phase) * 0.12)

  // Glossy 3D heart.
  const body = ctx.createRadialGradient(-6, -8, 2, 0, 2, 24)
  body.addColorStop(0, '#ff9ab3')
  body.addColorStop(0.45, '#ff4f75')
  body.addColorStop(1, '#c81f47')
  ctx.fillStyle = body
  heartPath(ctx, 18)
  ctx.fill()

  ctx.strokeStyle = 'rgba(140,20,50,0.55)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Specular blob.
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath()
  ctx.ellipse(-6, -8, 4.6, 6.4, -0.5, 0, TAU)
  ctx.fill()

  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 3 + h.phase)
  ctx.fillStyle = '#ffe3ec'
  ctx.translate(13, -12)
  sparklePath(ctx, 5)
  ctx.fill()

  ctx.restore()
}

export function drawMushroom(ctx: CanvasRenderingContext2D, m: Mushroom, camX: number, time: number) {
  const x = m.x - camX
  const y = m.y + Math.sin(time * 1.9 + m.phase) * 6
  const pulse = 0.6 + 0.4 * Math.sin(time * 3.4 + m.phase)

  ctx.save()
  ctx.translate(x, y)

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 46)
  g.addColorStop(0, `rgba(139,245,154,${0.35 + pulse * 0.3})`)
  g.addColorStop(1, 'rgba(110,240,140,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 46, 0, TAU)
  ctx.fill()

  ctx.rotate(Math.sin(time * 1.2 + m.phase) * 0.1)

  // Stem.
  ctx.fillStyle = '#f6f0d8'
  ctx.beginPath()
  ctx.moveTo(-6, 2)
  ctx.quadraticCurveTo(-8, 14, -5, 17)
  ctx.lineTo(5, 17)
  ctx.quadraticCurveTo(8, 14, 6, 2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(120,120,80,0.4)'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Cap.
  const cap = ctx.createLinearGradient(0, -18, 0, 6)
  cap.addColorStop(0, '#9cff9c')
  cap.addColorStop(0.5, '#43d66a')
  cap.addColorStop(1, '#1f9a49')
  ctx.fillStyle = cap
  ctx.beginPath()
  ctx.moveTo(-20, 3)
  ctx.quadraticCurveTo(-21, -19, 0, -19)
  ctx.quadraticCurveTo(21, -19, 20, 3)
  ctx.quadraticCurveTo(0, 8, -20, 3)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,90,44,0.7)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Spots.
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  const spots: Array<[number, number, number]> = [
    [-9, -7, 4],
    [4, -11, 3.4],
    [12, -3, 2.8],
    [-2, -3, 2.6],
  ]
  for (const [sx, sy, r] of spots) {
    ctx.beginPath()
    ctx.ellipse(sx, sy, r, r * 0.85, 0, 0, TAU)
    ctx.fill()
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

export function drawMonster(ctx: CanvasRenderingContext2D, m: Monster, camX: number, time: number) {
  const x = m.x - camX
  const y = m.y

  ctx.save()
  ctx.translate(x, y)

  if (m.dead) {
    // Both defeat animations physically travel out of view before they
    // fade — the tumble flies sideways off-screen, the stomp actually falls
    // with gravity — so disappearing is the *motion* carrying it off, not
    // the fade; the fade itself is a slow safety net well behind that, long
    // enough it's essentially never seen (a stomped monster is off the
    // bottom of the screen in well under a second).
    const fadeDuration = m.spin !== 0 ? 1.1 : 2.2
    const t = clamp(m.deadTime / fadeDuration, 0, 1)
    ctx.globalAlpha = 1 - t
    if (m.spin !== 0) {
      // Knockout tumble with circling stars.
      ctx.rotate(m.spin * 3)
      drawMonsterBody(ctx, m, time, 1, 1)
      ctx.rotate(-m.spin * 3)
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i / 3) * TAU
        ctx.save()
        ctx.translate(Math.cos(a) * 26, Math.sin(a) * 12 - 26)
        ctx.rotate(a)
        ctx.fillStyle = '#ffd166'
        starPath(ctx, 7)
        ctx.fill()
        ctx.restore()
      }
    } else {
      // Cartoon squish flat.
      const sq = m.squash
      ctx.translate(0, m.radius * sq * 0.72)
      drawMonsterBody(ctx, m, time, 1 + sq * 0.65, Math.max(0.12, 1 - sq * 0.92))
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.7
        ctx.save()
        ctx.translate(Math.cos(a) * 30 * sq, Math.sin(a) * 30 * sq - 8)
        ctx.rotate(a + time * 3)
        ctx.fillStyle = '#ffe9a8'
        starPath(ctx, 6 * (1 - sq * 0.4))
        ctx.fill()
        ctx.restore()
      }
    }
    ctx.restore()
    return
  }

  drawMonsterBody(ctx, m, time, 1, 1)
  ctx.restore()
}

function drawMonsterBody(
  ctx: CanvasRenderingContext2D,
  m: Monster,
  time: number,
  sx: number,
  sy: number,
) {
  ctx.save()
  ctx.scale(sx, sy)
  switch (m.kind) {
    case 'slime':
      drawSlime(ctx, m, time)
      break
    case 'bat':
      drawBat(ctx, m, time)
      break
    case 'hedgehog':
      drawHedgehog(ctx, m, time)
      break
  }
  ctx.restore()
}

function eyes(ctx: CanvasRenderingContext2D, dx: number, dy: number, r: number, look = 1) {
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(side * dx, dy, r, r * 1.15, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#2a1c14'
    ctx.beginPath()
    ctx.ellipse(side * dx + look * r * 0.24, dy + r * 0.12, r * 0.52, r * 0.62, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.arc(side * dx + look * r * 0.24 - r * 0.2, dy - r * 0.16, r * 0.2, 0, TAU)
    ctx.fill()
  }
}

function drawSlime(ctx: CanvasRenderingContext2D, m: Monster, time: number) {
  const wobble = Math.sin(time * 5 + m.phase) * 0.07 + m.squash * 0.35
  const w = m.radius * (1 + wobble)
  const h = m.radius * (1 - wobble * 0.8)

  // Soft shadow on the grass.
  ctx.fillStyle = 'rgba(20,50,28,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, m.radius * 0.95, w * 0.9, 5, 0, 0, TAU)
  ctx.fill()

  const g = ctx.createRadialGradient(-w * 0.3, -h * 0.4, 2, 0, 0, w * 1.3)
  g.addColorStop(0, 'rgba(190,255,190,0.95)')
  g.addColorStop(0.45, 'rgba(104,214,124,0.92)')
  g.addColorStop(1, 'rgba(46,148,84,0.95)')
  ctx.fillStyle = g

  // Blobby body with a droopy bottom.
  ctx.beginPath()
  ctx.moveTo(-w, h * 0.55)
  ctx.quadraticCurveTo(-w * 1.06, -h * 0.85, 0, -h)
  ctx.quadraticCurveTo(w * 1.06, -h * 0.85, w, h * 0.55)
  ctx.quadraticCurveTo(w * 0.5, h * 1.08, 0, h * 0.98)
  ctx.quadraticCurveTo(-w * 0.5, h * 1.08, -w, h * 0.55)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(28,102,58,0.65)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Gloss.
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(-w * 0.35, -h * 0.45, w * 0.24, h * 0.16, -0.5, 0, TAU)
  ctx.fill()

  eyes(ctx, w * 0.32, -h * 0.12, m.radius * 0.28, m.dir)

  // Cheeky little smile.
  ctx.strokeStyle = '#2a1c14'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, h * 0.12, m.radius * 0.28, 0.25 * Math.PI, 0.75 * Math.PI)
  ctx.stroke()
}

function drawBat(ctx: CanvasRenderingContext2D, m: Monster, time: number) {
  const flap = Math.sin(time * 11 + m.phase)
  const r = m.radius

  ctx.save()
  ctx.scale(m.vx >= 0 ? 1 : -1, 1)

  // Wings.
  ctx.fillStyle = '#7c5cc4'
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)
    ctx.rotate(flap * 0.34 * side)
    ctx.beginPath()
    ctx.moveTo(r * 0.5, -r * 0.1)
    ctx.quadraticCurveTo(r * 1.5, -r * 0.9, r * 2.05, -r * 0.1)
    ctx.quadraticCurveTo(r * 1.6, 0, r * 1.7, r * 0.42)
    ctx.quadraticCurveTo(r * 1.25, r * 0.12, r * 1.05, r * 0.5)
    ctx.quadraticCurveTo(r * 0.8, r * 0.16, r * 0.5, r * 0.4)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(58,38,96,0.7)'
    ctx.lineWidth = 1.6
    ctx.stroke()
    ctx.restore()
  }

  // Body.
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.35, 2, 0, 0, r * 1.2)
  g.addColorStop(0, '#b79df0')
  g.addColorStop(0.5, '#8a6bd0')
  g.addColorStop(1, '#5b3f9b')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.82, r * 0.9, 0, 0, TAU)
  ctx.fill()

  // Ears.
  ctx.fillStyle = '#7c5cc4'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * r * 0.3, -r * 0.72)
    ctx.lineTo(side * r * 0.56, -r * 1.42)
    ctx.lineTo(side * r * 0.72, -r * 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#c9a7f5'
    ctx.beginPath()
    ctx.moveTo(side * r * 0.4, -r * 0.72)
    ctx.lineTo(side * r * 0.55, -r * 1.16)
    ctx.lineTo(side * r * 0.63, -r * 0.62)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#7c5cc4'
  }

  eyes(ctx, r * 0.3, -r * 0.14, r * 0.25, 1)

  // Fangs.
  ctx.fillStyle = '#ffffff'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * r * 0.16, r * 0.26)
    ctx.lineTo(side * r * 0.3, r * 0.26)
    ctx.lineTo(side * r * 0.23, r * 0.5)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

function drawHedgehog(ctx: CanvasRenderingContext2D, m: Monster, time: number) {
  const r = m.radius
  const run = Math.sin(time * 16 + m.phase)

  ctx.save()
  ctx.scale(m.dir, 1)

  ctx.fillStyle = 'rgba(20,50,28,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, r * 0.95, r * 0.95, 5, 0, 0, TAU)
  ctx.fill()

  // Spiky back.
  ctx.fillStyle = '#6b4a8f'
  ctx.beginPath()
  ctx.moveTo(-r * 0.95, r * 0.5)
  for (let i = 0; i <= 9; i++) {
    const t = i / 9
    const bx = -r * 0.95 + t * r * 1.7
    const by = r * 0.5 - Math.sin(t * Math.PI) * r * 1.15
    const spike = i % 2 === 0 ? 8 : 4
    ctx.lineTo(bx, by - spike)
    ctx.lineTo(bx + r * 0.09, by)
  }
  ctx.lineTo(r * 0.8, r * 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(46,28,66,0.7)'
  ctx.lineWidth = 1.6
  ctx.stroke()

  // Face & belly.
  const g = ctx.createRadialGradient(r * 0.4, -r * 0.1, 2, r * 0.3, 0, r)
  g.addColorStop(0, '#ffe0b8')
  g.addColorStop(1, '#d9a273')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(r * 0.42, r * 0.06, r * 0.56, r * 0.5, 0, 0, TAU)
  ctx.fill()

  // Snout.
  ctx.fillStyle = '#2a1c14'
  ctx.beginPath()
  ctx.arc(r * 0.95, r * 0.08, r * 0.13, 0, TAU)
  ctx.fill()

  eyes(ctx, r * 0.12, -r * 0.2, r * 0.2, 1)

  // Scurrying feet.
  ctx.fillStyle = '#b5764a'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * r * 0.3 + run * side * 4, r * 0.62, r * 0.18, r * 0.12, 0, 0, TAU)
    ctx.fill()
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Rope
// ---------------------------------------------------------------------------

export function drawRope(ctx: CanvasRenderingContext2D, engine: GameEngine, camX: number) {
  const h = engine.hook
  if (h.state === 'idle') return
  const p = engine.player
  const px = p.x - camX
  const py = p.y
  const ax = h.state === 'flying' ? h.tipX - camX : (h.anchor?.x ?? 0) - camX
  const ay = h.state === 'flying' ? h.tipY : (h.anchor?.y ?? 0)

  const dx = px - ax
  const dy = py - ay
  const dist = Math.hypot(dx, dy) || 1
  // Slack rope sags; a taut rope snaps straight and goes thin.
  const slack = h.state === 'attached' ? clamp((h.restLen - dist) / 60, 0, 1) : 0.35
  const midX = (px + ax) / 2
  const midY = (py + ay) / 2 + slack * 26

  ctx.save()
  ctx.lineCap = 'round'

  // Outer glow.
  ctx.strokeStyle = 'rgba(255,226,150,0.35)'
  ctx.lineWidth = 7 - slack * 2
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(midX, midY, px, py)
  ctx.stroke()

  // Braided core.
  const grad = ctx.createLinearGradient(ax, ay, px, py)
  grad.addColorStop(0, '#f6e0a8')
  grad.addColorStop(0.5, '#e0b972')
  grad.addColorStop(1, '#c79352')
  ctx.strokeStyle = grad
  ctx.lineWidth = 3.6 - slack * 0.8
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(midX, midY, px, py)
  ctx.stroke()

  // Twist detail.
  ctx.strokeStyle = 'rgba(255,255,255,0.32)'
  ctx.lineWidth = 1.2
  ctx.setLineDash([6, 7])
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(midX, midY, px, py)
  ctx.stroke()
  ctx.setLineDash([])

  // Hook claw at the anchor end.
  ctx.save()
  ctx.translate(ax, ay)
  ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2)
  ctx.strokeStyle = '#d8c39a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, 7, Math.PI * 0.15, Math.PI * 1.3)
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}

// ---------------------------------------------------------------------------
// The hamster
// ---------------------------------------------------------------------------

export function drawPlayer(ctx: CanvasRenderingContext2D, engine: GameEngine, camX: number, time: number) {
  const p = engine.player
  const x = p.x - camX
  const y = p.y
  const r = PLAYER_RADIUS

  const invincible = engine.invincibleTime > 0
  const iframes = engine.iframeTime > 0
  // Blink out on alternating frames while invulnerable.
  const blinkOut = iframes && Math.floor(time * 14) % 2 === 0

  ctx.save()
  ctx.translate(x, y)

  // Ground shadow, tighter the closer the hamster is to the grass.
  const shadowT = clamp((y - CEILING_Y) / 520, 0, 1)
  ctx.save()
  ctx.globalAlpha = 0.16 + shadowT * 0.16
  ctx.fillStyle = '#123018'
  ctx.beginPath()
  ctx.ellipse(0, GROUND_Y - y, r * (0.5 + shadowT * 0.7), 7 * (0.4 + shadowT * 0.8), 0, 0, TAU)
  ctx.fill()
  ctx.restore()

  // Aura passes: invincibility rainbow, then the i-frame amber shield.
  if (invincible) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 9)
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.5)
    g.addColorStop(0, `rgba(160,255,175,${0.35 * pulse})`)
    g.addColorStop(0.6, `rgba(120,240,190,${0.22 * pulse})`)
    g.addColorStop(1, 'rgba(120,240,190,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, r * 2.5, 0, TAU)
    ctx.fill()
  }
  if (iframes) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 16)
    const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 2.1)
    g.addColorStop(0, 'rgba(255,196,90,0)')
    g.addColorStop(0.72, `rgba(255,196,90,${0.3 * pulse})`)
    g.addColorStop(1, 'rgba(255,170,60,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, r * 2.1, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = `rgba(255,214,120,${0.35 + pulse * 0.35})`
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.32, 0, TAU)
    ctx.stroke()
  }

  if (blinkOut) ctx.globalAlpha = 0.42

  // Squash & stretch, aligned to motion / rope tension.
  ctx.rotate(p.squashAngle)
  ctx.scale(1 - p.squash, 1 + p.squash * 0.88)
  ctx.rotate(-p.squashAngle)

  // Crash tumble spin.
  if (engine.phase === 'crashing') ctx.rotate(p.tumble)

  drawHamster(ctx, engine, r, time)
  drawCrystalBall(ctx, r, p.rot, invincible, time)

  ctx.restore()
}

function drawHamster(ctx: CanvasRenderingContext2D, engine: GameEngine, r: number, time: number) {
  const p = engine.player
  ctx.save()

  // The hamster stays roughly upright inside the ball, leaning into the roll.
  const lean = Math.sin(p.rot) * 0.14
  const bob = Math.sin(p.rot * 2) * 1.5
  ctx.rotate(lean)
  ctx.translate(0, bob)
  ctx.scale(p.facing, 1)

  const s = r / 27

  // Tail nub.
  ctx.fillStyle = '#e0b183'
  ctx.beginPath()
  ctx.ellipse(-15 * s, 4 * s, 5 * s, 4 * s, 0, 0, TAU)
  ctx.fill()

  // Ears — twitch on a timer.
  const twitch = p.earTwitch < 0 ? Math.sin(time * 40) * 0.25 : 0
  for (const side of [-1, 1] as const) {
    ctx.save()
    ctx.translate(side * 7 * s - 2 * s, -14 * s)
    ctx.rotate(side * 0.25 + twitch * side)
    ctx.fillStyle = '#d8a878'
    ctx.beginPath()
    ctx.ellipse(0, 0, 6.5 * s, 7.5 * s, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#ffc9c0'
    ctx.beginPath()
    ctx.ellipse(0, 0.5 * s, 3.6 * s, 4.4 * s, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  // Body.
  const body = ctx.createRadialGradient(-3 * s, -6 * s, 2 * s, 0, 0, 20 * s)
  body.addColorStop(0, '#fff1d4')
  body.addColorStop(0.55, '#f7d9a8')
  body.addColorStop(1, '#e0b183')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(0, 0, 17 * s, 15.5 * s, 0, 0, TAU)
  ctx.fill()

  // Cream belly patch.
  ctx.fillStyle = 'rgba(255,248,232,0.95)'
  ctx.beginPath()
  ctx.ellipse(2 * s, 5 * s, 11 * s, 9 * s, 0, 0, TAU)
  ctx.fill()

  // Muzzle.
  ctx.fillStyle = '#fff7e8'
  ctx.beginPath()
  ctx.ellipse(8 * s, 2 * s, 8 * s, 6.4 * s, 0, 0, TAU)
  ctx.fill()

  // Rosy cheeks.
  ctx.fillStyle = 'rgba(255,155,165,0.55)'
  ctx.beginPath()
  ctx.ellipse(11 * s, 4 * s, 4.4 * s, 3.2 * s, 0, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-7 * s, 3 * s, 4.2 * s, 3 * s, 0, 0, TAU)
  ctx.fill()

  // Eyes — big, glossy, with a periodic blink.
  const blinking = p.blink < 0
  const dizzy = engine.phase === 'crashing'
  for (const side of [-1, 1] as const) {
    const ex = side === 1 ? 7.5 * s : -3.5 * s
    const ey = -4 * s
    if (dizzy) {
      // Spiral "knocked out" eyes.
      ctx.strokeStyle = '#2a1c14'
      ctx.lineWidth = 1.8 * s
      ctx.beginPath()
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU * 2 + time * 6
        const rad = (i / 26) * 4.6 * s
        const px2 = ex + Math.cos(a) * rad
        const py2 = ey + Math.sin(a) * rad
        if (i === 0) ctx.moveTo(px2, py2)
        else ctx.lineTo(px2, py2)
      }
      ctx.stroke()
      continue
    }
    if (blinking) {
      ctx.strokeStyle = '#2a1c14'
      ctx.lineWidth = 2 * s
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - 3.4 * s, ey)
      ctx.quadraticCurveTo(ex, ey + 2 * s, ex + 3.4 * s, ey)
      ctx.stroke()
      continue
    }
    ctx.fillStyle = '#2a1c14'
    ctx.beginPath()
    ctx.ellipse(ex, ey, 4 * s, 4.8 * s, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ex + 1.4 * s, ey - 1.8 * s, 1.5 * s, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ex - 1.2 * s, ey + 1.6 * s, 0.8 * s, 0, TAU)
    ctx.fill()
  }

  // Nose + mouth.
  ctx.fillStyle = '#ff8fa0'
  ctx.beginPath()
  ctx.moveTo(13.5 * s, 0.5 * s)
  ctx.lineTo(16.5 * s, 0.5 * s)
  ctx.lineTo(15 * s, 3 * s)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#8a5a3a'
  ctx.lineWidth = 1.3 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(15 * s, 3.4 * s)
  ctx.quadraticCurveTo(13 * s, 5.6 * s, 11 * s, 4.2 * s)
  ctx.moveTo(15 * s, 3.4 * s)
  ctx.quadraticCurveTo(17 * s, 5.4 * s, 18.4 * s, 3.6 * s)
  ctx.stroke()

  // Whiskers.
  ctx.strokeStyle = 'rgba(120,80,50,0.55)'
  ctx.lineWidth = 1 * s
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(14 * s, 1.6 * s + i * 1.4 * s)
    ctx.lineTo(24 * s, 0.4 * s + i * 3.4 * s)
    ctx.stroke()
  }

  // Front paws, padding along as the ball rolls.
  ctx.fillStyle = '#ffe6c4'
  const paw = Math.sin(p.rot * 3) * 2.4 * s
  ctx.beginPath()
  ctx.ellipse(7 * s + paw, 12 * s, 4.2 * s, 3.2 * s, 0, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-2 * s - paw, 12.5 * s, 4 * s, 3 * s, 0, 0, TAU)
  ctx.fill()

  ctx.restore()
}

function drawCrystalBall(
  ctx: CanvasRenderingContext2D,
  r: number,
  rot: number,
  invincible: boolean,
  time: number,
) {
  ctx.save()

  // Glass tint.
  const glass = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r)
  if (invincible) {
    glass.addColorStop(0, 'rgba(235,255,240,0.5)')
    glass.addColorStop(0.55, 'rgba(150,245,190,0.22)')
    glass.addColorStop(0.88, 'rgba(90,220,160,0.28)')
    glass.addColorStop(1, 'rgba(210,255,230,0.55)')
  } else {
    glass.addColorStop(0, 'rgba(255,255,255,0.46)')
    glass.addColorStop(0.5, 'rgba(190,232,255,0.16)')
    glass.addColorStop(0.86, 'rgba(150,205,255,0.24)')
    glass.addColorStop(1, 'rgba(255,255,255,0.5)')
  }
  ctx.fillStyle = glass
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.fill()

  // Refraction facets that rotate with the ball.
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.clip()
  ctx.globalCompositeOperation = 'lighter'
  const prism = ['rgba(255,190,210,0.18)', 'rgba(190,225,255,0.2)', 'rgba(220,255,210,0.16)']
  for (let i = 0; i < 3; i++) {
    ctx.save()
    ctx.rotate(rot * 0.6 + (i / 3) * TAU)
    ctx.fillStyle = prism[i]
    ctx.beginPath()
    ctx.ellipse(r * 0.28, 0, r * 0.62, r * 0.17, 0.4, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  // Rim light.
  ctx.strokeStyle = 'rgba(255,255,255,0.78)'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(0, 0, r - 1.2, 0, TAU)
  ctx.stroke()

  // Warm bounce light along the lower-right rim.
  ctx.strokeStyle = 'rgba(255,214,150,0.6)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, r - 2.4, Math.PI * 0.08, Math.PI * 0.62)
  ctx.stroke()

  // Specular highlights.
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.4, -r * 0.46, r * 0.2, r * 0.13, -0.7, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-r * 0.15, -r * 0.62, r * 0.08, r * 0.06, -0.7, 0, TAU)
  ctx.fill()

  // A slow travelling twinkle on the glass.
  const tw = (Math.sin(time * 1.7) * 0.5 + 0.5) * TAU
  ctx.save()
  ctx.rotate(tw)
  ctx.globalAlpha = 0.75
  ctx.fillStyle = '#ffffff'
  ctx.translate(0, -r * 0.72)
  sparklePath(ctx, r * 0.16)
  ctx.fill()
  ctx.restore()

  ctx.restore()
}
