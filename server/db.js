// SQLite storage for accounts + the leaderboard. Kept deliberately tiny:
// one file, two tables, no migrations framework — this is a casual game's
// leaderboard, not a system of record.
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

// DB_PATH lets Render point this at a mounted persistent disk in
// production (see render.yaml); the default keeps local dev simple.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'server', 'data', 'hamswing.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    picture TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scores (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    best_score INTEGER NOT NULL,
    best_distance REAL NOT NULL,
    updated_at INTEGER NOT NULL
  );
`)

export const statements = {
  upsertUser: db.prepare(`
    INSERT INTO users (id, name, email, picture, created_at)
    VALUES (@id, @name, @email, @picture, @now)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      picture = excluded.picture
  `),
  getUser: db.prepare(`SELECT id, name, email, picture FROM users WHERE id = ?`),
  renameUser: db.prepare(`UPDATE users SET name = ? WHERE id = ?`),
  getBestScore: db.prepare(`SELECT best_score, best_distance FROM scores WHERE user_id = ?`),
  upsertScore: db.prepare(`
    INSERT INTO scores (user_id, best_score, best_distance, updated_at)
    VALUES (@userId, @score, @distance, @now)
    ON CONFLICT(user_id) DO UPDATE SET
      best_score = excluded.best_score,
      best_distance = excluded.best_distance,
      updated_at = excluded.updated_at
    WHERE excluded.best_score > scores.best_score
  `),
  topScores: db.prepare(`
    SELECT users.name AS name, users.picture AS picture, scores.best_score AS score, scores.best_distance AS distance
    FROM scores
    JOIN users ON users.id = scores.user_id
    ORDER BY scores.best_score DESC
    LIMIT ?
  `),
}
