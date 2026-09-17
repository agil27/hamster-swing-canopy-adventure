// The whole backend: serves the built frontend and the small JSON API it
// talks to (Google sign-in, display name, leaderboard). One process, one
// libSQL/Turso database — see db.js for why.
import 'dotenv/config'
import path from 'node:path'
import express from 'express'
import cookieParser from 'cookie-parser'
import { db, initSchema } from './db.js'
import { verifyGoogleIdToken, signSession, setSessionCookie, clearSessionCookie, readSession, requireAuth } from './auth.js'

const app = express()
const DIST_DIR = path.join(process.cwd(), 'dist')
const MAX_NAME_LENGTH = 20
const LEADERBOARD_LIMIT = 50
// A generous but real ceiling — keeps an obviously-forged score (someone
// hand-crafting a request) from parking itself at the top forever. This
// is a casual game's leaderboard, not an anti-cheat system: client-side
// scores are inherently trust-on-submit.
const MAX_PLAUSIBLE_SCORE = 5_000_000

app.set('trust proxy', 1)
app.use(express.json())
app.use(cookieParser())
app.use(readSession)

// --- auth ------------------------------------------------------------------

app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body || {}
  if (typeof idToken !== 'string' || !idToken) return res.status(400).json({ error: 'idToken is required' })

  let profile
  try {
    profile = await verifyGoogleIdToken(idToken)
  } catch (err) {
    console.warn('[auth] Google token verification failed:', err.message)
    return res.status(401).json({ error: 'Invalid Google token' })
  }

  const now = Date.now()
  await db.upsertUser({ id: profile.id, name: profile.name.slice(0, MAX_NAME_LENGTH), email: profile.email, picture: profile.picture, now })
  const user = await db.getUser(profile.id)

  setSessionCookie(res, signSession(user.id))
  res.json({ user: { id: user.id, name: user.name, picture: user.picture } })
})

app.get('/api/auth/me', async (req, res) => {
  if (!req.userId) return res.json({ user: null })
  const user = await db.getUser(req.userId)
  if (!user) return res.json({ user: null })
  res.json({ user: { id: user.id, name: user.name, picture: user.picture } })
})

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.put('/api/auth/name', requireAuth, async (req, res) => {
  const raw = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!raw) return res.status(400).json({ error: 'Name cannot be empty' })
  const name = raw.slice(0, MAX_NAME_LENGTH)
  await db.renameUser(name, req.userId)
  res.json({ user: { id: req.userId, name } })
})

// --- leaderboard -------------------------------------------------------------

app.post('/api/scores', requireAuth, async (req, res) => {
  const score = Math.round(Number(req.body?.score))
  const distance = Number(req.body?.distance) || 0
  if (!Number.isFinite(score) || score < 0 || score > MAX_PLAUSIBLE_SCORE) {
    return res.status(400).json({ error: 'Invalid score' })
  }
  const before = await db.getBestScore(req.userId)
  await db.upsertScore({ userId: req.userId, score, distance, now: Date.now() })
  const isNewBest = !before || score > before.best_score
  res.json({ ok: true, isNewBest, bestScore: isNewBest ? score : before.best_score })
})

app.get('/api/leaderboard', async (_req, res) => {
  const rows = await db.topScores(LEADERBOARD_LIMIT)
  res.json({ entries: rows.map((r) => ({ name: r.name, picture: r.picture, score: r.score, distance: r.distance })) })
})

// --- static frontend ---------------------------------------------------------

app.use(express.static(DIST_DIR))

// SPA fallback — anything that isn't an API call and isn't a real static
// file falls through to index.html so client-side state (none, today, but
// harmless to keep) never 404s.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

// Express 5 forwards a rejected promise from any async handler above
// straight here — keep the response JSON instead of Express's default
// HTML error page.
app.use((err, _req, res, _next) => {
  console.error('[server]', err)
  res.status(500).json({ error: 'Internal server error' })
})

const port = process.env.PORT || 3000
initSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`hamswing server listening on :${port}`)
    })
  })
  .catch((err) => {
    console.error('[server] failed to initialize the database:', err)
    process.exit(1)
  })
