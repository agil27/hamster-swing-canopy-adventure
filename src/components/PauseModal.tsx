interface Props {
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
  /** Restarting a tutorial run re-launches the guided script instead of a
   *  normal game, so the label/behaviour differ slightly. */
  isTutorial: boolean
}

export default function PauseModal({ onResume, onRestart, onMenu, isTutorial }: Props) {
  return (
    <div
      data-ui-block
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,26,16,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onResume}
    >
      <div
        className="animate-pop-in w-full max-w-sm rounded-[28px] p-6 text-center panel-wood sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Paused"
      >
        <h2 className="font-display text-3xl font-extrabold text-[#5b3a24] sm:text-4xl">Paused</h2>
        {isTutorial && (
          <p className="mt-1.5 font-body text-sm font-bold text-[#8a6a4c]">Tutorial in progress</p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button type="button" onClick={onResume} className="btn-candy w-full">
            ▶ Resume
          </button>
          <button type="button" onClick={onRestart} className="btn-candy btn-candy-sky w-full">
            ↻ {isTutorial ? 'Restart Tutorial' : 'Restart Run'}
          </button>
          <button type="button" onClick={onMenu} className="btn-candy btn-candy-amber w-full">
            🏠 Main Menu
          </button>
        </div>
      </div>
    </div>
  )
}
