import { VIEW_W } from '../constants'
import { TUTORIAL_HINT_FADE, TUTORIAL_INSTRUCTIONS, TUTORIAL_RETRY_INSTRUCTIONS } from '../tutorial'
import type { GameEngine } from '../engine'

const INK = '#7a3a1e'
const PAPER = 'rgba(255,250,235,0.95)'
const CELEBRATE_INK = '#2c6b3c'

// Any instruction/retry copy renders as a plain handwritten note; anything
// else showing (a "Nice!"/"Invincible!" acknowledgement) gets the
// celebratory treatment instead.
const INSTRUCTION_TEXTS = new Set<string>([
  ...Object.values(TUTORIAL_INSTRUCTIONS),
  ...Object.values(TUTORIAL_RETRY_INSTRUCTIONS),
])

/**
 * Draws the current tutorial note as a handwritten card fixed near the top
 * of the (letterboxed, already-transformed) view — no arrow: it scrolls
 * and scales with the world, but doesn't try to point at anything.
 *
 * Gameplay never pauses for this: the engine holds the note up for a while
 * then lets it go, so the card fades out here over its last
 * TUTORIAL_HINT_FADE seconds rather than snapping away.
 */
export function drawTutorialCallout(ctx: CanvasRenderingContext2D, engine: GameEngine, time: number) {
  if (!engine.tutorialActive) return
  const text = engine.tutorialHintText
  if (!text) return

  const alpha = engine.tutorialHintTimer >= TUTORIAL_HINT_FADE ? 1 : engine.tutorialHintTimer / TUTORIAL_HINT_FADE
  if (alpha <= 0) return

  const celebrating = !INSTRUCTION_TEXTS.has(text)

  const noteX = VIEW_W / 2
  const noteY = 250 + Math.sin(time * 1.4) * 4

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `700 ${celebrating ? 40 : 34}px 'Caveat', cursive`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const metrics = ctx.measureText(text)
  const padX = 34
  const boxW = Math.min(metrics.width + padX * 2, VIEW_W - 48)
  const boxH = 64

  ctx.translate(noteX, noteY)
  ctx.rotate(-0.025)

  // Soft torn-paper backing so the handwriting stays legible over any
  // background the forest happens to be showing.
  ctx.save()
  ctx.shadowColor = 'rgba(20,10,4,0.35)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 6
  ctx.fillStyle = PAPER
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 16)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(122,58,30,0.35)'
  ctx.lineWidth = 2
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 16)
  ctx.stroke()

  ctx.fillStyle = celebrating ? CELEBRATE_INK : INK
  ctx.fillText(text, 0, 0, boxW - padX)
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
