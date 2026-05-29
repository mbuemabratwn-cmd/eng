import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync, readFileSync } from 'fs'
import archiver from 'archiver'
import { createWriteStream } from 'fs'

export interface BackupConfig {
  backupDir: string
  maxBackups: number
  autoBackupEnabled: boolean
  autoBackupIntervalHours: number
}

export interface BackupResult {
  success: boolean
  backupPath: string | null
  timestamp: string
  sizeBytes: number | null
  error?: string
}

export interface BackupInfo {
  filename: string
  path: string
  timestamp: string
  sizeBytes: number
}

const DEFAULT_CONFIG: BackupConfig = {
  backupDir: 'backups',
  maxBackups: 10,
  autoBackupEnabled: false,
  autoBackupIntervalHours: 24
}

export class BackupService {
  private config: BackupConfig
  private dbPath: string
  private autoBackupTimer: NodeJS.Timeout | null = null

  constructor(dbPath: string, config?: Partial<BackupConfig>) {
    this.dbPath = dbPath
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.ensureBackupDir()
  }

  getBackupPath(filename: string): string {
    return join(this.config.backupDir, filename)
  }

  createBackup(label?: string): BackupResult {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFilename = label
      ? `backup_${label}_${timestamp}.db`
      : `backup_${timestamp}.db`
    const backupPath = join(this.config.backupDir, backupFilename)

    try {
      // Ensure backup directory exists
      this.ensureBackupDir()

      // Copy database file
      copyFileSync(this.dbPath, backupPath)

      // Get file size
      const stats = statSync(backupPath)

      // Clean up old backups
      this.cleanupOldBackups()

      return {
        success: true,
        backupPath,
        timestamp: new Date().toISOString(),
        sizeBytes: stats.size
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        backupPath: null,
        timestamp: new Date().toISOString(),
        sizeBytes: null,
        error
      }
    }
  }

  listBackups(): BackupInfo[] {
    try {
      this.ensureBackupDir()

      const files = readdirSync(this.config.backupDir)
      const backups: BackupInfo[] = []

      for (const file of files) {
        if (!file.endsWith('.db')) continue

        const filePath = join(this.config.backupDir, file)
        const stats = statSync(filePath)

        backups.push({
          filename: file,
          path: filePath,
          timestamp: stats.mtime.toISOString(),
          sizeBytes: stats.size
        })
      }

      // Sort by timestamp descending
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      return backups
    } catch {
      return []
    }
  }

  deleteBackup(filename: string): boolean {
    try {
      const filePath = join(this.config.backupDir, filename)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  startAutoBackup(): void {
    if (this.autoBackupTimer) return
    if (!this.config.autoBackupEnabled) return

    const intervalMs = this.config.autoBackupIntervalHours * 60 * 60 * 1000
    this.autoBackupTimer = setInterval(() => {
      this.createBackup('auto')
    }, intervalMs)
  }

  stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
    }
  }

  getConfig(): BackupConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...updates }

    // Restart auto backup if settings changed
    if (this.autoBackupTimer) {
      this.stopAutoBackup()
      this.startAutoBackup()
    }
  }

  private ensureBackupDir(): void {
    const backupDir = this.config.backupDir
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true })
    }
  }

  private cleanupOldBackups(): void {
    const backups = this.listBackups()
    if (backups.length > this.config.maxBackups) {
      const toDelete = backups.slice(this.config.maxBackups)
      for (const backup of toDelete) {
        this.deleteBackup(backup.filename)
      }
    }
  }

  async exportFullPackage(): Promise<{ success: boolean; exportPath: string | null; error?: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const exportFilename = `export_${timestamp}.zip`
    const exportPath = join(this.config.backupDir, exportFilename)

    try {
      this.ensureBackupDir()

      // Create a temporary directory for staging
      const tempDir = join(this.config.backupDir, `temp_${timestamp}`)
      mkdirSync(tempDir, { recursive: true })

      // Copy database
      const dbBackupPath = join(tempDir, 'database.db')
      copyFileSync(this.dbPath, dbBackupPath)

      // Create manifest
      const manifest = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        contents: ['database.db'],
        appVersion: '0.1.0'
      }
      const manifestPath = join(tempDir, 'manifest.json')
      const fs = await import('fs')
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

      // Create zip archive
      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(exportPath)
        const archive = archiver('zip', { zlib: { level: 9 } })

        output.on('close', () => resolve())
        archive.on('error', (err) => reject(err))

        archive.pipe(output)
        archive.file(dbBackupPath, { name: 'database.db' })
        archive.file(manifestPath, { name: 'manifest.json' })
        archive.finalize()
      })

      // Cleanup temp directory
      fs.unlinkSync(dbBackupPath)
      fs.unlinkSync(manifestPath)
      fs.rmdirSync(tempDir)

      const stats = statSync(exportPath)

      return {
        success: true,
        exportPath,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        exportPath: null,
        error
      }
    }
  }

  async restoreBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if backup file exists
      if (!existsSync(backupPath)) {
        return { success: false, error: '备份文件不存在' }
      }

      // Create a snapshot backup before restoring
      const snapshotResult = this.createBackup('pre_restore')
      if (!snapshotResult.success) {
        return { success: false, error: `无法创建恢复前快照: ${snapshotResult.error}` }
      }

      // Copy backup to database path
      copyFileSync(backupPath, this.dbPath)

      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { success: false, error }
    }
  }
}
