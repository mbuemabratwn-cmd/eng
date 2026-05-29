import Database from 'better-sqlite3'
import { migrations } from './migrations'

interface MigrationRecord {
  version: number
  name: string
  checksum: string
  applied_at: string
}

export async function runMigrations(db: Database.Database): Promise<void> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT,
      applied_at TEXT NOT NULL
    )
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations').all() as MigrationRecord[]
  const appliedVersions = new Set(applied.map(r => r.version))

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      const tx = db.transaction(() => {
        db.exec(migration.sql)
        db.prepare(
          'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
        ).run(migration.version, migration.name, migration.checksum || '', new Date().toISOString())
      })
      tx()
    }
  }
}
