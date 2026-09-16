import { useEffect, useRef } from 'react'
import type { GameEngine } from '../game/engine'
import { applyOrientation } from '../game/constants'
import { render } from '../game/render'
import { clearGradientCache } from '../game/render/background'

interface Props {
  engine: GameEngine
  /** Input is ignored while a modal owns the screen. */
  inputEnabled: boolean
}

/**
 * Owns the canvas element, the animation loop and all pointer/keyboard input.
 * Everything it touches lives on the engine, so this never re-renders.
 */
export default function GameCanvas({ engine, inputEnabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef(inputEnabled)
  inputRef.current = inputEnabled

  // --- render loop ---------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let raf = 0
    let last = performance.now()
    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      // Cap DPR: 2 is plenty and keeps big retina screens at 60fps.
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.floor(parent.clientWidth))
      const h = Math.max(1, Math.floor(parent.clientHeight))
      // Swap the internal world's aspect ratio to match — see the doc
      // comment on VIEW_W/VIEW_H for why this doesn't disturb gameplay.
      applyOrientation(h > w)
      width = Math.floor(w * dpr)
      height = Math.floor(h * dpr)
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      // Gradients are built against the old context state — rebuild them.
      clearGradientCache()
    }

    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('resize', resize)

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      engine.update(dt)
      render(ctx, engine, { width, height, dpr })
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [engine])

  // --- input ---------------------------------------------------------------
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!inputRef.current) return
      // Ignore clicks that land on HUD buttons rather than the play area.
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-ui-block]')) return
      engine.pressDown()
    }
    const up = () => engine.pressUp()

    const keyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'KeyW') return
      e.preventDefault()
      if (e.repeat) return
      if (!inputRef.current) return
      engine.pressDown()
    }
    const keyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'KeyW') return
      e.preventDefault()
      engine.pressUp()
    }

    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    // Letting go outside the window must still release the rope.
    window.addEventListener('blur', up)

    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', up)
    }
  }, [engine])

  return <canvas ref={canvasRef} className="h-full w-full" />
}
