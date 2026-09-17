import { VIEW_H, VIEW_W, tierForDistance } from '../constants'
import type { GameEngine } from '../engine'
import { clamp } from '../rng'
import { drawCanopy, drawClouds, drawForest, drawGround, drawSky, drawSpores } from './background'
import { drawAnchor, drawHeartPickup, drawMonster, drawMushroom, drawPlayer, drawRope, drawSeed } from './entities'
import { drawTutorialCallout } from './tutorial'

export interface Viewport {
  /** Device-pixel size of the backing canvas. */
  width: number
  height: number
  dpr: number
}

/**
 * Renders one frame. The world is authored at a fixed VIEW_W × VIEW_H and
 * letterboxed into whatever the canvas actually is, so gameplay never changes
 * with screen size.
 */
export function render(ctx: CanvasRenderingContext2D, engine: GameEngine, vp: Viewport) {
  const cssW = vp.width / vp.dpr
  const cssH = vp.height / vp.dpr
  const scale = Math.min(cssW / VIEW_W, cssH / VIEW_H)
  const offX = (cssW - VIEW_W * scale) / 2
  const offY = (cssH - VIEW_H * scale) / 2

  ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0)

  // Letterbox backdrop — deep forest so the bars read as part of the art.
  ctx.fillStyle = '#0e2415'
  ctx.fillRect(0, 0, cssW, cssH)

  ctx.save()
  ctx.translate(offX, offY)
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.rect(0, 0, VIEW_W, VIEW_H)
  ctx.clip()

  const time = engine.time
  const tier = tierForDistance(engine.distance)
  const gloom = tier.gloom

  // Screen shake.
  const sh = engine.shake
  const shakeX = sh > 0.05 ? (Math.random() - 0.5) * sh : 0
  const shakeY = sh > 0.05 ? (Math.random() - 0.5) * sh : 0
  ctx.translate(shakeX, shakeY)

  const camX = engine.camX
  const camY = engine.camY

  // --- background ----------------------------------------------------------
  drawSky(ctx, time, gloom)
  drawClouds(ctx, camX, time)
  drawForest(ctx, camX, time, gloom)
  drawSpores(ctx, camX, time)

  const chunks = engine.world.visibleChunks(camX - 200, camX + VIEW_W + 200)

  drawCanopy(ctx, camX, chunks, time, gloom)
  drawGround(ctx, camX, chunks, time)

  // --- world entities ------------------------------------------------------
  for (const chunk of chunks) {
    for (const a of chunk.anchors) {
      if (a.x - camX < -80 || a.x - camX > VIEW_W + 80) continue
      drawAnchor(ctx, a, camX, time)
    }
  }
  for (const chunk of chunks) {
    for (const s of chunk.seeds) {
      if (s.taken) continue
      const sx = s.x - camX
      if (sx < -40 || sx > VIEW_W + 40) continue
      drawSeed(ctx, s, camX, time)
    }
    for (const h of chunk.hearts) {
      if (h.taken) continue
      const hx = h.x - camX
      if (hx < -60 || hx > VIEW_W + 60) continue
      drawHeartPickup(ctx, h, camX, time)
    }
    for (const m of chunk.mushrooms) {
      if (m.taken) continue
      const mx = m.x - camX
      if (mx < -60 || mx > VIEW_W + 60) continue
      drawMushroom(ctx, m, camX, time)
    }
    for (const mo of chunk.monsters) {
      if (mo.dead && mo.deadTime > 1.3) continue
      const mx = mo.x - camX
      if (mx < -80 || mx > VIEW_W + 80) continue
      drawMonster(ctx, mo, camX, time)
    }
  }

  // --- player --------------------------------------------------------------
  drawRope(ctx, engine, camX)
  if (engine.phase !== 'gameover' || engine.hearts > 0) {
    drawPlayer(ctx, engine, camX, time)
  }

  engine.particles.draw(ctx, camX, camY)

  // --- full-screen effects -------------------------------------------------
  if (engine.flash > 0.01) {
    ctx.save()
    ctx.globalAlpha = clamp(engine.flash, 0, 0.75)
    ctx.fillStyle = engine.flashColor
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.restore()
  }

  drawVignette(ctx, gloom, engine.invincibleTime > 0)

  // Drawn last so the handwritten note sits on top of everything, including
  // the flash/vignette washes.
  drawTutorialCallout(ctx, engine, time)

  ctx.restore()
}

function drawVignette(ctx: CanvasRenderingContext2D, gloom: number, invincible: boolean) {
  const g = ctx.createRadialGradient(
    VIEW_W / 2,
    VIEW_H * 0.46,
    VIEW_H * 0.3,
    VIEW_W / 2,
    VIEW_H * 0.46,
    VIEW_W * 0.78,
  )
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(12,26,16,${0.28 + gloom * 0.34})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  if (invincible) {
    // Faint rainbow bloom around the edges while the mushroom burns.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const r = ctx.createRadialGradient(
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_H * 0.34,
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_W * 0.7,
    )
    r.addColorStop(0, 'rgba(0,0,0,0)')
    r.addColorStop(1, 'rgba(120,255,180,0.18)')
    ctx.fillStyle = r
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.restore()
  }
}
