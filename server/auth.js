// Google ID-token verification + our own lightweight session cookie. We
// never touch Google's session — a signed JWT in an httpOnly cookie is our
// entire auth state, checked on each request that needs to know who's
// asking.
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const SESSION_SECRET = process.env.SESSION_SECRET || ''
const COOKIE_NAME = 'hamswing_session'
const SESSION_DAYS = 30

if (!GOOGLE_CLIENT_ID) console.warn('[auth] GOOGLE_CLIENT_ID is not set — Google sign-in will fail.')
if (!SESSION_SECRET) console.warn('[auth] SESSION_SECRET is not set — using an insecure fallback. Set it in production.')

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID)

/** Verifies a Google ID token (the `credential` from Google Identity
 *  Services on the client) and returns the bits of the payload we care
 *  about. Throws if the token is invalid, expired, or minted for a
 *  different client. */
export async function verifyGoogleIdToken(idToken) {
  const ticket = await oauthClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
  const payload = ticket.getPayload()
  if (!payload?.sub) throw new Error('Google token had no subject')
  return {
    id: payload.sub,
    name: payload.name || payload.email || 'Player',
    email: payload.email || null,
    picture: payload.picture || null,
  }
}

export function signSession(userId) {
  return jwt.sign({ uid: userId }, SESSION_SECRET || 'dev-only-insecure-secret', { expiresIn: `${SESSION_DAYS}d` })
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

/** Express middleware: reads the session cookie (if any) and attaches
 *  `req.userId`. Never rejects the request itself — routes that require a
 *  signed-in user check `req.userId` and 401 themselves, so public routes
 *  (like the leaderboard) can share the same middleware harmlessly. */
export function readSession(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (token) {
    try {
      const payload = jwt.verify(token, SESSION_SECRET || 'dev-only-insecure-secret')
      req.userId = payload.uid
    } catch {
      // Expired or tampered — treat as signed out rather than erroring.
    }
  }
  next()
}

export function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Sign in required' })
  next()
}
