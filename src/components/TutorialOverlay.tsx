import type { HudState } from '../game/types'

interface Props {
  hud: HudState
  onSkip: () => void
}

/**
 * The only DOM piece of the tutorial: an escape hatch. The instruction
 * itself — a handwritten note with an arrow at the relevant object — is
 * drawn directly on the canvas (see game/render/tutorial.ts), scrolling
 * and scaling with the world instead of sitting in a modal box on top of it.
 */
export default function TutorialOverlay({ hud, onSkip }: Props) {
  if (!hud.tutorialActive || hud.phase !== 'playing') return null

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="pointer-events-auto absolute bottom-4 right-4">
        <button
          data-ui-block
          type="button"
          onClick={onSkip}
          className="rounded-full px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-white/80 transition hover:text-white active:translate-y-[1px]"
          style={{ background: 'rgba(20,45,26,0.6)', backdropFilter: 'blur(4px)' }}
        >
          Skip tutorial
        </button>
      </div>
    </div>
  )
}
