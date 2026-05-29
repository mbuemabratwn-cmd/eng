import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './migrator'

let db: Database.Database | null = null

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'learning.db')
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export async function initDatabase(dbPath?: string): Promise<Database.Database> {
  const path = dbPath || getDatabasePath()
  db = new Database(path)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  await runMigrations(db)

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
