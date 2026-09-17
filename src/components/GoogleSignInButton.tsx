import { useEffect, useRef, useState } from 'react'

interface Props {
  onCredential: (idToken: string) => void
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

/**
 * Renders Google's own "Sign in with Google" button via the Identity
 * Services script (loaded in index.html). That script is `async defer`,
 * so it may not be on `window` yet the instant this mounts — poll briefly
 * rather than assuming it's ready.
 */
export default function GoogleSignInButton({ onCredential }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const tryInit = () => {
      if (cancelled) return
      if (!window.google?.accounts?.id) {
        timer = setTimeout(tryInit, 150)
        return
      }
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      })
      if (hostRef.current) {
        window.google.accounts.id.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
        })
      }
      setReady(true)
    }
    tryInit()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [onCredential])

  if (!CLIENT_ID) return null

  return (
    <div className="flex flex-col items-center gap-1">
      <div ref={hostRef} />
      {!ready && <p className="font-body text-xs font-bold text-white/60">Loading sign-in…</p>}
    </div>
  )
}
