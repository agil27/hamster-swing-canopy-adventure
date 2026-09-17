// Storage for accounts + the leaderboard, via libSQL (Turso's client) —
// SQLite-compatible, so the schema/SQL below barely differs from a plain
// local SQLite file, but the actual data lives on Turso's free hosted
// tier, so it survives deploys and spin-downs (unlike anything written to
// Render's own ephemeral disk). Falls back to a local SQLite *file* (no
// account, no network) when TURSO_DATABASE_URL isn't set, so local dev
// and the headless tests never need a Turso account at all.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'

const TURSO_URL = process.env.TURSO_DATABASE_URL
const LOCAL_DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'server', 'data', 'hamswing.db')

if (!TURSO_URL) {
  fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true })
}

export const client = createClient(
  TURSO_URL
    ? { url: TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: `file:${LOCAL_DB_PATH}` },
)

if (!TURSO_URL) console.warn('[db] TURSO_DATABASE_URL is not set — using a local SQLite file. Fine for dev, not for a real deploy.')

export async function initSchema() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        picture TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scores (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        best_score INTEGER NOT NULL,
        best_distance REAL NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ],
    'write',
  )
}

export const db = {
  async upsertUser({ id, name, email, picture, now }) {
    await client.execute({
      sql: `INSERT INTO users (id, name, email, picture, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET email = excluded.email, picture = excluded.picture`,
      args: [id, name, email ?? null, picture ?? null, now],
    })
  },

  async getUser(id) {
    const r = await client.execute({ sql: `SELECT id, name, email, picture FROM users WHERE id = ?`, args: [id] })
    return r.rows[0] ?? null
  },

  async renameUser(name, id) {
    await client.execute({ sql: `UPDATE users SET name = ? WHERE id = ?`, args: [name, id] })
  },

  async getBestScore(userId) {
    const r = await client.execute({ sql: `SELECT best_score, best_distance FROM scores WHERE user_id = ?`, args: [userId] })
    return r.rows[0] ?? null
  },

  async upsertScore({ userId, score, distance, now }) {
    await client.execute({
      sql: `INSERT INTO scores (user_id, best_score, best_distance, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              best_score = excluded.best_score,
              best_distance = excluded.best_distance,
              updated_at = excluded.updated_at
            WHERE excluded.best_score > scores.best_score`,
      args: [userId, score, distance, now],
    })
  },

  async topScores(limit) {
    const r = await client.execute({
      sql: `SELECT users.name AS name, users.picture AS picture, scores.best_score AS score, scores.best_distance AS distance
            FROM scores
            JOIN users ON users.id = scores.user_id
            ORDER BY scores.best_score DESC
            LIMIT ?`,
      args: [limit],
    })
    return r.rows
  },
}
