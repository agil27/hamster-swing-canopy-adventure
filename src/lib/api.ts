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
