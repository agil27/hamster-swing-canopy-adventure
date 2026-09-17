import HamsterMark from './HamsterMark'

interface Props {
  highScore: number
  onPlay: () => void
  onHelp: () => void
  onTutorial: () => void
}

export default function StartScreen({ highScore, onPlay, onHelp, onTutorial }: Props) {
  return (
    <div
      data-ui-block
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(180deg, rgba(10,26,16,0.35), rgba(10,26,16,0.72))' }}
    >
      <div className="animate-pop-in flex w-full max-w-xl flex-col items-center text-center">
        <HamsterMark className="h-28 w-28 animate-float-soft drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)] sm:h-36 sm:w-36" />

        <h1 className="mt-2 font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-tight text-white text-storybook sm:text-6xl">
          Hamster Swing
        </h1>
        <p
          className="mt-1 bg-clip-text font-display text-lg font-extrabold uppercase tracking-[0.3em] text-transparent sm:text-2xl"
          style={{ backgroundImage: 'linear-gradient(90deg,#ffe9a8,#ffd166,#ffb347,#ffe9a8)' }}
        >
          Canopy Adventure
        </p>

        <p className="mt-4 max-w-md px-2 font-body text-sm font-bold leading-snug text-white/85 sm:text-base">
          Hook the glowing lanterns, swing through the enchanted canopy and ride the perfect arc as far as
          the forest will take you.
        </p>

        <div className="mt-6 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={onPlay} className="btn-candy w-full px-10 text-xl sm:w-auto">
            ▶ Start Swinging
          </button>
          <button type="button" onClick={onTutorial} className="btn-candy btn-candy-sky w-full px-8 sm:w-auto">
            🎓 Tutorial
          </button>
          <button type="button" onClick={onHelp} className="btn-candy btn-candy-amber w-full px-8 sm:w-auto">
            How to Play
          </button>
        </div>

        {highScore > 0 && (
          <div className="mt-6 flex items-center gap-2 rounded-2xl px-4 py-2 font-display text-base font-extrabold text-white text-storybook"
            style={{ background: 'rgba(20,45,26,0.6)', backdropFilter: 'blur(6px)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#ffe08a]" fill="currentColor" aria-hidden>
              <path d="M5 4h14v2a5 5 0 0 1-4 4.9V13l3 5v2H6v-2l3-5v-2.1A5 5 0 0 1 5 6V4z" />
            </svg>
            Best {highScore.toLocaleString()}
          </div>
        )}

        <p className="mt-5 font-body text-xs font-bold uppercase tracking-widest text-white/60">
          Tap · Click · Spacebar
        </p>
      </div>
    </div>
  )
}
