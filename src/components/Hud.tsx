import { memo, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { HudState } from '../game/types'
import { COMBO_WINDOW, MAX_HEARTS, MUSHROOM_DURATION } from '../game/constants'

// ---------------------------------------------------------------------------
// Hearts
// ---------------------------------------------------------------------------

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 32 30"
      className={`h-9 w-9 drop-shadow-[0_3px_5px_rgba(80,10,30,0.5)] sm:h-8 sm:w-8 ${
        filled ? 'animate-heart-beat' : ''
      }`}
      aria-hidden
    >
      <defs>
        <radialGradient id="heartFill" cx="34%" cy="26%" r="78%">
          <stop offset="0%" stopColor="#ffb3c6" />
          <stop offset="45%" stopColor="#ff4d70" />
          <stop offset="100%" stopColor="#b81a42" />
        </radialGradient>
      </defs>
      <path
        d="M16 28.2C8.4 22.6 1.6 17.4 1.6 10.9 1.6 6.1 5.3 2.6 9.8 2.6c2.7 0 5.1 1.4 6.2 3.5 1.1-2.1 3.5-3.5 6.2-3.5 4.5 0 8.2 3.5 8.2 8.3 0 6.5-6.8 11.7-14.4 17.3z"
        fill={filled ? 'url(#heartFill)' : 'rgba(20,40,26,0.55)'}
        stroke={filled ? 'rgba(120,12,44,0.75)' : 'rgba(255,255,255,0.25)'}
        strokeWidth="1.6"
      />
      {filled && (
        <ellipse cx="10.6" cy="9.4" rx="2.9" ry="3.8" fill="rgba(255,255,255,0.72)" transform="rotate(-28 10.6 9.4)" />
      )}
    </svg>
  )
}

const Hearts = memo(function Hearts({ hearts, flashId }: { hearts: number; flashId: number }) {
  // A heart heal is otherwise just a number ticking up — this plays a
  // one-shot glow/pop on the whole row so the moment actually reads,
  // especially the first time it happens in the tutorial.
  const [flashing, setFlashing] = useState(false)
  const seen = useRef(flashId)
  useEffect(() => {
    if (flashId === seen.current) return
    seen.current = flashId
    setFlashing(true)
    const t = setTimeout(() => setFlashing(false), 700)
    return () => clearTimeout(t)
  }, [flashId])

  return (
    <div
      className={`flex items-center gap-1.5 ${flashing ? 'animate-heart-heal' : ''}`}
      aria-label={`${hearts} of ${MAX_HEARTS} hearts remaining`}
    >
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <Heart key={i} filled={i < hearts} />
      ))}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Speedometer
// ---------------------------------------------------------------------------

const GAUGE_LEN = Math.PI * 56

const Speedometer = memo(function Speedometer({ kmh, rating }: { kmh: number; rating: string }) {
  const p = Math.max(0, Math.min(1, kmh / 145))
  const color = p < 0.32 ? '#7ee081' : p < 0.62 ? '#ffd166' : p < 0.85 ? '#ff9f43' : '#ff6b6b'

  return (
    <div className="pointer-events-none select-none">
      <div className="relative rounded-3xl px-3.5 pb-2.5 pt-1.5 panel-wood">
        <svg viewBox="0 0 140 88" className="h-[92px] w-[146px] sm:h-[86px] sm:w-[140px]" aria-hidden>
          <path d="M14 72 A56 56 0 0 1 126 72" fill="none" stroke="rgba(92,58,30,0.22)" strokeWidth="11" strokeLinecap="round" />
          <path
            d="M14 72 A56 56 0 0 1 126 72"
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${p * GAUGE_LEN} ${GAUGE_LEN}`}
            style={{ transition: 'stroke-dasharray 90ms linear, stroke 200ms linear' }}
          />
          {/* Tick marks */}
          {Array.from({ length: 7 }, (_, i) => {
            const a = Math.PI + (i / 6) * Math.PI
            const x1 = 70 + Math.cos(a) * 44
            const y1 = 72 + Math.sin(a) * 44
            const x2 = 70 + Math.cos(a) * 38
            const y2 = 72 + Math.sin(a) * 38
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(92,58,30,0.4)" strokeWidth="2.4" strokeLinecap="round" />
          })}
          <g style={{ transition: 'transform 90ms linear' }} transform={`rotate(${p * 180 - 90} 70 72)`}>
            <line x1="70" y1="72" x2="70" y2="28" stroke="#8a4a22" strokeWidth="4" strokeLinecap="round" />
          </g>
          <circle cx="70" cy="72" r="7" fill="#8a4a22" />
          <circle cx="70" cy="72" r="3" fill="#ffd9a8" />
        </svg>
        <div className="-mt-2 text-center">
          <div className="font-display text-2xl font-extrabold leading-none text-[#5b3a24] sm:text-2xl">
            {Math.round(kmh)}
            <span className="ml-1 text-[13px] font-bold text-[#8a6a4c]">km/h</span>
          </div>
          <div className="mt-0.5 font-display text-[13px] font-bold uppercase tracking-wider" style={{ color }}>
            {rating}
          </div>
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Combo + power-up meters
// ---------------------------------------------------------------------------

function Flame() {
  return (
    <svg viewBox="0 0 24 28" className="h-5 w-5 animate-float-soft" aria-hidden>
      <path d="M12 0c2 5-3 6-3 10 0 2 1 3 2.5 3S14 11 13 9c3 2 6 5 6 9a7 7 0 0 1-14 0c0-6 7-9 7-18z" fill="#ff8f3f" />
      <path d="M12 12c1 2.5-1.6 3.2-1.6 5.3 0 1.6 1.2 2.7 2.6 2.7 2 0 3.2-1.6 3.2-3.6 0-2.4-2.2-3.4-4.2-4.4z" fill="#ffe066" />
    </svg>
  )
}

const ComboMeter = memo(function ComboMeter({ combo, timer, count }: { combo: number; timer: number; count: number }) {
  if (combo <= 1) return null
  const p = Math.max(0, Math.min(1, timer / COMBO_WINDOW))
  const hot = combo >= 2.5
  const r = 22
  const circumference = 2 * Math.PI * r

  return (
    <div key={combo} className="animate-pop-in pointer-events-none flex select-none items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-5"
      style={{
        background: hot
          ? 'linear-gradient(100deg, rgba(255,107,53,0.95), rgba(255,170,60,0.92))'
          : 'linear-gradient(100deg, rgba(255,171,64,0.92), rgba(255,214,102,0.9))',
        boxShadow: hot
          ? '0 0 26px 6px rgba(255,140,60,0.5), inset 0 2px 0 rgba(255,255,255,0.45)'
          : '0 8px 20px -8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.45)',
      }}
    >
      <div className="relative grid h-14 w-14 place-items-center">
        <svg viewBox="0 0 52 52" className="absolute h-14 w-14 -rotate-90" aria-hidden>
          <circle cx="26" cy="26" r={r} fill="rgba(90,40,10,0.28)" />
          <circle
            cx="26"
            cy="26"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${p * circumference} ${circumference}`}
            style={{ transition: 'stroke-dasharray 90ms linear' }}
          />
        </svg>
        <span className="font-display text-[17px] font-extrabold text-white text-storybook">x{combo.toFixed(1)}</span>
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 font-display text-lg font-extrabold text-white text-storybook">
          {hot && <Flame />}
          COMBO
        </div>
        <div className="font-display text-xs font-bold text-white/85">{count} chain</div>
      </div>
    </div>
  )
})

const PowerBar = memo(function PowerBar({ time }: { time: number }) {
  if (time <= 0) return null
  const p = Math.max(0, Math.min(1, time / MUSHROOM_DURATION))
  return (
    <div className="animate-pop-in pointer-events-none w-56 select-none rounded-full p-1.5"
      style={{ background: 'rgba(12,40,22,0.7)', boxShadow: '0 0 22px 4px rgba(120,240,150,0.35)' }}
    >
      <div className="relative h-6 overflow-hidden rounded-full bg-[rgba(255,255,255,0.12)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${p * 100}%`,
            background: 'linear-gradient(90deg,#8bf59a,#43d66a)',
            transition: 'width 90ms linear',
          }}
        />
        <div className="absolute inset-0 grid place-items-center font-display text-xs font-extrabold uppercase tracking-wider text-white text-storybook">
          Invincible {time.toFixed(1)}s
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      data-ui-block
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white transition active:translate-y-[2px]"
      style={{
        background: 'linear-gradient(180deg, rgba(58,104,64,0.92), rgba(28,64,36,0.94))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 5px 0 rgba(16,40,22,0.9), 0 10px 18px -8px rgba(0,0,0,0.7)',
      }}
    >
      {children}
    </button>
  )
}

function SpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 9l5 6M22 9l-5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <rect x="5" y="4" width="5" height="16" rx="1.5" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Root HUD
//
// The top bar is orientation-aware: in landscape (phones held sideways,
// tablets, desktop) it keeps the original compact 3-column row, since there
// is enough width for it. In portrait — where a phone is narrow but tall —
// it stacks into three full-width rows instead of squeezing three columns
// into ~375px, so nothing has to shrink to fit.
// ---------------------------------------------------------------------------

interface Props {
  hud: HudState
  muted: boolean
  onToggleMute: () => void
  onHelp: () => void
  onPause: () => void
}

export default function Hud({ hud, muted, onToggleMute, onHelp, onPause }: Props) {
  const playing = hud.phase === 'playing' || hud.phase === 'crashing'

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Top bar */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col gap-2.5 px-3 landscape:flex-row landscape:items-start landscape:justify-between landscape:gap-2 sm:px-5"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        {/* Hearts + score */}
        <div className="flex items-center justify-between gap-3 landscape:flex-col landscape:items-start landscape:justify-start landscape:gap-2">
          <Hearts hearts={hud.hearts} flashId={hud.heartsFlashId} />
          <div className="hud-chip">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#ffd166]" fill="currentColor" aria-hidden>
              <path d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.1 6.1 20.2l1.2-6.6L2.5 9l6.6-.9L12 2z" />
            </svg>
            <span className="tabular-nums text-xl sm:text-xl text-storybook">{hud.score.toLocaleString()}</span>
          </div>
        </div>

        {/* Tier badge + distance */}
        <div className="flex items-center justify-center gap-2.5 landscape:flex-col landscape:gap-1.5 landscape:pt-0.5">
          <div
            className="animate-badge-glow rounded-2xl px-4 py-2 font-display text-base font-extrabold uppercase tracking-widest text-white text-storybook sm:text-base"
            style={{
              background: `linear-gradient(180deg, ${hud.tierAccent}dd, ${hud.tierAccent}99)`,
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), 0 8px 18px -8px rgba(0,0,0,0.7)',
            }}
          >
            {hud.tierName}
          </div>
          <div className="hud-chip">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#9be89b]" fill="currentColor" aria-hidden>
              <path d="M4 18h3V8H4v10zm6.5 0h3V4h-3v14zM17 18h3v-7h-3v7z" />
            </svg>
            <span className="tabular-nums text-lg sm:text-lg text-storybook">{hud.distance.toFixed(0)} m</span>
          </div>
        </div>

        {/* High score + controls */}
        <div className="flex items-center justify-between gap-3 landscape:flex-col landscape:items-end landscape:gap-2">
          <div className="hud-chip">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#ffe08a]" fill="currentColor" aria-hidden>
              <path d="M5 4h14v2a5 5 0 0 1-4 4.9V13l3 5v2H6v-2l3-5v-2.1A5 5 0 0 1 5 6V4z" />
            </svg>
            <span className="tabular-nums text-base sm:text-base text-storybook">{hud.highScore.toLocaleString()}</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <IconButton onClick={onToggleMute} label={muted ? 'Unmute audio' : 'Mute audio'}>
              {muted ? <SpeakerOff /> : <SpeakerOn />}
            </IconButton>
            {hud.phase === 'playing' && (
              <IconButton onClick={onPause} label="Pause">
                <PauseIcon />
              </IconButton>
            )}
            <IconButton onClick={onHelp} label="How to play">
              <span className="font-display text-xl font-extrabold leading-none">?</span>
            </IconButton>
          </div>
        </div>
      </div>

      {/* Combo + power-up stack — sits below the top bar, which is taller
          in portrait (three stacked rows) than landscape (one row). */}
      {playing && (
        <div
          className="absolute inset-x-0 flex flex-col items-center gap-2 px-3 portrait:top-[calc(12.5rem_+_env(safe-area-inset-top,0px))] landscape:top-[calc(7.5rem_+_env(safe-area-inset-top,0px))]"
        >
          <ComboMeter combo={hud.combo} timer={hud.comboTimer} count={hud.comboCount} />
          <PowerBar time={hud.invincibleTime} />
        </div>
      )}

      {/* Speedometer */}
      {playing && (
        <div className="absolute left-3 sm:left-5" style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <Speedometer kmh={hud.speedKmh} rating={hud.speedRating} />
        </div>
      )}

      {/* Hold hint, shown only on the opening runway — pushed high enough
          above the (now bigger) speedometer that they never overlap.
          Suppressed during the tutorial, which shows its own step-specific
          instruction in this exact slot instead. */}
      {playing && hud.distance < 22 && !hud.tutorialActive && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ bottom: 'calc(11rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="animate-float-soft rounded-full px-6 py-2.5 text-center font-display text-base font-extrabold text-white text-storybook sm:text-base"
            style={{ background: 'rgba(20,45,26,0.72)', backdropFilter: 'blur(6px)' }}
          >
            Hold to hook the lanterns · Release to fly
          </div>
        </div>
      )}
    </div>
  )
}
