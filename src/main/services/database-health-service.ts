import Database from 'better-sqlite3'

export interface IntegrityCheckResult {
  ok: boolean
  message: string
  checkedAt: string
}

export interface MigrationState {
  version: number
  name: string
  checksum: string
  applied_at: string
}

export interface MigrationStatus {
  applied: MigrationState[]
  totalApplied: number
}

export interface StartupHealthResult {
  integrity: IntegrityCheckResult
  migrations: MigrationStatus
  databasePath: string
  databaseSizeBytes: number
  ok: boolean
}

export class DatabaseHealthService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  checkIntegrity(): IntegrityCheckResult {
    try {
      const result = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>
      const ok = result.length === 1 && result[0].integrity_check === 'ok'

      return {
        ok,
        message: ok ? '数据库完整性检查通过' : `完整性问题: ${result.map(r => r.integrity_check).join(', ')}`,
        checkedAt: new Date().toISOString()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        message: `完整性检查失败: ${message}`,
        checkedAt: new Date().toISOString()
      }
    }
  }

  getMigrationStatus(): MigrationStatus {
    try {
      const applied = this.db.prepare(
        'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version'
      ).all() as MigrationState[]

      return {
        applied,
        totalApplied: applied.length
      }
    } catch {
      return {
        applied: [],
        totalApplied: 0
      }
    }
  }

  runStartupHealthCheck(dbPath: string): StartupHealthResult {
    const integrity = this.checkIntegrity()
    const migrations = this.getMigrationStatus()

    let databaseSizeBytes = 0
    try {
      const { statSync } = require('fs')
      const stats = statSync(dbPath)
      databaseSizeBytes = stats.size
    } catch {
      // Ignore size check failure
    }

    return {
      integrity,
      migrations,
      databasePath: dbPath,
      databaseSizeBytes,
      ok: integrity.ok
    }
  }
}
