// Thin fetch wrappers for the backend in server/index.js. Every call is
// same-origin and cookie-based (credentials: 'include'), so there's no
// token to juggle on the client beyond the one-shot Google ID token at
// sign-in time.
export interface AuthUser {
  id: string
  name: string
  picture: string | null
}

export interface LeaderboardEntry {
  name: string
  picture: string | null
  score: number
  distance: number
}

class ApiError extends Error {}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function fetchMe(): Promise<{ user: AuthUser | null }> {
  return jsonFetch('/api/auth/me')
}

export function signInWithGoogle(idToken: string): Promise<{ user: AuthUser }> {
  return jsonFetch('/api/auth/google', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ idToken }),
  })
}

export function signOut(): Promise<{ ok: true }> {
  return jsonFetch('/api/auth/logout', { method: 'POST' })
}

export function updateName(name: string): Promise<{ user: AuthUser }> {
  return jsonFetch('/api/auth/name', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  })
}

export function fetchLeaderboard(): Promise<{ entries: LeaderboardEntry[] }> {
  return jsonFetch('/api/leaderboard')
}

export function submitScore(score: number, distance: number): Promise<{ ok: true; isNewBest: boolean; bestScore: number }> {
  return jsonFetch('/api/scores', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ score, distance }),
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** submitScore, with retries — Render's free tier spins the instance down
 *  after ~15 min idle, and the first request after that can fail (timeout
 *  or refused connection) well before it ever reaches our server code,
 *  purely while the container wakes back up. 5 attempts with a growing
 *  delay between them (1.5s, 2.5s, 3.5s, 4.5s — ~12s worst case) comfortably
 *  covers a real cold start without making a genuine failure hang forever.
 *  Every failed attempt is logged so a real, non-transient problem is
 *  still easy to find in the browser console. */
export async function submitScoreWithRetries(score: number, distance: number, attempts = 5): Promise<{ ok: true; isNewBest: boolean; bestScore: number }> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await submitScore(score, distance)
    } catch (err) {
      const isLastAttempt = i === attempts - 1
      if (isLastAttempt) {
        console.error(`[score] save failed after ${attempts} attempts:`, err)
        throw err
      }
      console.warn(`[score] save attempt ${i + 1}/${attempts} failed, retrying:`, err)
      await sleep(1500 + i * 1000)
    }
  }
  // Unreachable (the loop above always either returns or throws), but
  // keeps TypeScript happy about every path returning a value.
  throw new Error('submitScoreWithRetries: unreachable')
}
