import { BaseRepository } from './base'

export class SettingsRepository extends BaseRepository {
  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.db.prepare(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?'
    ).run(key, value, this.now(), value, this.now())
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  }
}
