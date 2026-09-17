import { useEffect, useState } from 'react'
import { fetchLeaderboard } from '../lib/api'
import type { LeaderboardEntry } from '../lib/api'

interface Props {
  currentUserName: string | null
  onClose: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardModal({ currentUserName, onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchLeaderboard()
      .then((r) => {
        if (!cancelled) setEntries(r.entries)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      data-ui-block
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,26,16,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="animate-pop-in flex max-h-full w-full max-w-md flex-col rounded-[28px] p-5 panel-wood sm:p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Leaderboard"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold text-[#5b3a24] sm:text-3xl">🏆 Leaderboard</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-[#e9d3ae] font-display text-lg font-extrabold text-[#5b3a24] transition hover:bg-[#dfc399] active:translate-y-[2px]"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="py-6 text-center font-body text-sm font-bold text-[#8a6a4c]">Couldn't load the leaderboard right now.</p>}
          {!error && entries === null && <p className="py-6 text-center font-body text-sm font-bold text-[#8a6a4c]">Loading…</p>}
          {!error && entries?.length === 0 && (
            <p className="py-6 text-center font-body text-sm font-bold text-[#8a6a4c]">No scores yet — be the first!</p>
          )}
          {entries && entries.length > 0 && (
            <ul className="space-y-1.5">
              {entries.map((entry, i) => {
                const mine = currentUserName !== null && entry.name === currentUserName
                return (
                  <li
                    key={`${entry.name}-${i}`}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
                      mine ? 'bg-[rgba(255,214,102,0.45)]' : 'bg-[rgba(255,255,255,0.55)]'
                    }`}
                  >
                    <span className="w-7 shrink-0 text-center font-display text-base font-extrabold text-[#8a6a4c]">
                      {MEDALS[i] ?? i + 1}
                    </span>
                    {entry.picture ? (
                      <img src={entry.picture} alt="" className="h-7 w-7 shrink-0 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-7 w-7 shrink-0 rounded-full bg-[#4fa85c]" />
                    )}
                    <span className="flex-1 truncate font-display text-sm font-extrabold text-[#5b3a24]">{entry.name}</span>
                    <span className="shrink-0 font-display text-base font-extrabold tabular-nums text-[#5b3a24]">
                      {entry.score.toLocaleString()}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
