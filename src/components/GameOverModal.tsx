import type { HudState } from '../game/types'
import HamsterMark from './HamsterMark'

export type ScoreSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'signedOut'

interface Props {
  hud: HudState
  onRestart: () => void
  onMenu: () => void
  onShowLeaderboard: () => void
  saveStatus: ScoreSaveStatus
}

function SaveStatusLine({ status }: { status: ScoreSaveStatus }) {
  if (status === 'saving') return <p className="mt-2 font-body text-xs font-bold text-[#8a6a4c]">Saving to leaderboard…</p>
  if (status === 'saved') return <p className="mt-2 font-body text-xs font-bold text-[#2c6b3c]">✓ Saved to the leaderboard</p>
  if (status === 'error') return <p className="mt-2 font-body text-xs font-bold text-[#b4522f]">Couldn't save your score — try again next run</p>
  if (status === 'signedOut') return <p className="mt-2 font-body text-xs font-bold text-[#8a6a4c]">Sign in from the main menu to save scores</p>
  return null
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-[rgba(255,255,255,0.55)] px-3 py-2 text-center">
      <div className="font-display text-xl font-extrabold tabular-nums sm:text-2xl" style={{ color: accent ?? '#5b3a24' }}>
        {value}
      </div>
      <div className="font-display text-[10px] font-extrabold uppercase tracking-widest text-[#8a6a4c]">{label}</div>
    </div>
  )
}

export default function GameOverModal({ hud, onRestart, onMenu, onShowLeaderboard, saveStatus }: Props) {
  return (
    <div
      data-ui-block
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,26,16,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="animate-pop-in w-full max-w-md rounded-[28px] p-5 panel-wood sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-label="Run complete"
      >
        <div className="flex flex-col items-center">
          <HamsterMark className="h-20 w-20 drop-shadow-[0_8px_14px_rgba(0,0,0,0.3)]" />

          {hud.isNewHighScore ? (
            <div
              className="mt-2 animate-shimmer rounded-full px-5 py-1.5 font-display text-sm font-extrabold uppercase tracking-widest text-[#6b3f10]"
              style={{
                backgroundImage:
                  'linear-gradient(100deg,#ffd166 0%,#fff3c4 35%,#ffd166 55%,#ffb347 100%)',
                backgroundSize: '220% 100%',
                boxShadow: '0 6px 18px -6px rgba(255,180,60,0.8)',
              }}
            >
              ★ New Best Score ★
            </div>
          ) : (
            <div className="mt-2 font-display text-sm font-extrabold uppercase tracking-widest text-[#8a6a4c]">
              Run complete
            </div>
          )}

          <div className="mt-1 font-display text-5xl font-extrabold tabular-nums text-[#5b3a24] sm:text-6xl">
            {hud.score.toLocaleString()}
          </div>
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.25em] text-[#8a6a4c]">Score</div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Distance" value={`${hud.distance.toFixed(0)}m`} accent="#2c6b3c" />
          <Stat label="Seeds" value={String(hud.seedsCollected)} accent="#c9911f" />
          <Stat label="Stomps" value={String(hud.monstersStomped)} accent="#b4522f" />
          <Stat label="Best Combo" value={`x${hud.bestCombo.toFixed(1)}`} accent="#c2410c" />
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[rgba(255,214,102,0.28)] px-4 py-2.5">
          <span className="font-display text-sm font-extrabold uppercase tracking-widest text-[#8a6a4c]">
            Best ever
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums text-[#5b3a24]">
            {hud.highScore.toLocaleString()}
          </span>
        </div>

        <div className="mt-3 text-center font-display text-sm font-bold text-[#8a6a4c]">
          Furthest tier reached: <span className="text-[#5b3a24]">{hud.tierName}</span>
        </div>

        <div className="text-center">
          <SaveStatusLine status={saveStatus} />
          <button
            type="button"
            onClick={onShowLeaderboard}
            className="mt-1 font-display text-sm font-extrabold text-[#5b3a24] underline decoration-[#8a6a4c]/40 underline-offset-4"
          >
            🏆 View Leaderboard
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onRestart} className="btn-candy flex-1">
            ↻ Swing Again
          </button>
          <button type="button" onClick={onMenu} className="btn-candy btn-candy-amber flex-1">
            Main Menu
          </button>
        </div>
      </div>
    </div>
  )
}
