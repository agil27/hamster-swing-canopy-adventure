import { useCallback, useEffect, useState } from 'react'
import { fetchMe, signInWithGoogle, signOut as apiSignOut, updateName as apiUpdateName } from './api'
import type { AuthUser } from './api'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((r) => {
        if (!cancelled) setUser(r.user)
      })
      .catch(() => {
        /* not signed in, or the server's briefly unreachable — either way, stay signed out */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signInWithIdToken = useCallback(async (idToken: string) => {
    const r = await signInWithGoogle(idToken)
    setUser(r.user)
    return r.user
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    setUser(null)
  }, [])

  const rename = useCallback(async (name: string) => {
    const r = await apiUpdateName(name)
    setUser(r.user)
    return r.user
  }, [])

  return { user, loading, signInWithIdToken, signOut, rename }
}
