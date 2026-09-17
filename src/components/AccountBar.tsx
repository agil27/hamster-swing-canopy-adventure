import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthUser } from '../lib/api'
import GoogleSignInButton from './GoogleSignInButton'

interface Props {
  user: AuthUser | null
  loading: boolean
  onCredential: (idToken: string) => void
  onSignOut: () => void
  onRename: (name: string) => Promise<void>
}

export default function AccountBar({ user, loading, onCredential, onSignOut, onRename }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="h-11" aria-hidden />

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <GoogleSignInButton onCredential={onCredential} />
        <p className="font-body text-xs font-bold text-white/55">Sign in to save your score to the leaderboard</p>
      </div>
    )
  }

  const startEditing = () => {
    setDraft(user.name)
    setEditing(true)
  }

  const submitRename = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || trimmed === user.name) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onRename(trimmed)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form onSubmit={submitRename} className="flex items-center gap-2 rounded-full bg-[rgba(20,45,26,0.6)] px-3 py-1.5 backdrop-blur">
        <input
          id="account-name-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 20))}
          maxLength={20}
          className="w-32 rounded-full bg-white/90 px-3 py-1 font-body text-sm font-bold text-[#3a2a18] outline-none"
        />
        <button type="submit" disabled={saving} className="font-display text-xs font-extrabold text-[#8bf59a]">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="font-display text-xs font-extrabold text-white/70">
          Cancel
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-[rgba(20,45,26,0.6)] py-1.5 pl-1.5 pr-3 backdrop-blur">
      {user.picture ? (
        <img src={user.picture} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="h-7 w-7 rounded-full bg-[#4fa85c]" />
      )}
      <button type="button" onClick={startEditing} className="font-display text-sm font-extrabold text-white" title="Edit your name">
        {user.name} ✎
      </button>
      <button type="button" onClick={onSignOut} className="font-body text-xs font-bold text-white/55 hover:text-white/80">
        Sign out
      </button>
    </div>
  )
}
