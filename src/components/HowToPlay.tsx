import type { ReactNode } from 'react'

interface Props {
  onClose: () => void
}

const ROWS: Array<{ icon: ReactNode; title: string; body: string }> = [
  {
    icon: <span className="text-2xl">👆</span>,
    title: 'Hold to hook',
    body: 'Press and hold anywhere (or Spacebar) to fling an elastic rope onto the nearest canopy lantern ahead.',
  },
  {
    icon: <span className="text-2xl">🌀</span>,
    title: 'Swing to build speed',
    body: 'The rope reels in as you swing. Speed peaks at the bottom of the arc — that is the moment to let go.',
  },
  {
    icon: <span className="text-2xl">🚀</span>,
    title: 'Release to launch',
    body: 'Let go to launch forward and up. Golden seeds trace the perfect flight path, so follow the arc.',
  },
  {
    icon: <span className="text-2xl">👟</span>,
    title: 'Stomp the monsters',
    body: 'Drop onto slimes, bats and hedgehogs from above for a big bouncy reward. Touch one from the side and it costs a heart.',
  },
  {
    icon: <span className="text-2xl">❤️</span>,
    title: 'Mind your hearts',
    body: 'Three hearts. Hitting the grass triggers an emergency spring cushion and costs one. Collect floating hearts to heal.',
  },
  {
    icon: <span className="text-2xl">🍄</span>,
    title: 'Grab the magic mushroom',
    body: 'Six seconds of glowing invincibility — smash straight through anything in your way.',
  },
]

export default function HowToPlay({ onClose }: Props) {
  return (
    <div
      data-ui-block
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,26,16,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="animate-pop-in max-h-full w-full max-w-lg overflow-y-auto rounded-[28px] p-5 panel-wood sm:p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold text-[#5b3a24] sm:text-3xl">How to Play</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-[#e9d3ae] font-display text-lg font-extrabold text-[#5b3a24] transition hover:bg-[#dfc399] active:translate-y-[2px]"
          >
            ×
          </button>
        </div>

        <ul className="space-y-3">
          {ROWS.map((r) => (
            <li key={r.title} className="flex gap-3 rounded-2xl bg-[rgba(255,255,255,0.55)] p-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgba(255,214,102,0.35)]">
                {r.icon}
              </div>
              <div>
                <div className="font-display text-base font-extrabold text-[#5b3a24]">{r.title}</div>
                <p className="mt-0.5 text-sm font-semibold leading-snug text-[#7a5c40]">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-2xl bg-[rgba(255,214,102,0.28)] p-3 text-center">
          <p className="font-display text-sm font-extrabold text-[#5b3a24]">
            Chain seeds and stomps within {2.6}s to build a combo — up to a blazing x4.0 multiplier.
          </p>
        </div>

        <button type="button" onClick={onClose} className="btn-candy mt-5 w-full">
          Got it!
        </button>
      </div>
    </div>
  )
}
