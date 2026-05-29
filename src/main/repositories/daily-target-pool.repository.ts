import { BaseRepository } from './base'

export interface DailyTargetPool {
  id: number
  study_day: string
  created_at: string
  updated_at: string
  recommended_minutes: number
  new_word_count: number
  focused_word_count: number
  review_word_count: number
  target_type: string
  status: string
  metadata: string | null
}

export class DailyTargetPoolRepository extends BaseRepository {
  create(pool: Omit<DailyTargetPool, 'id' | 'created_at' | 'updated_at'>): DailyTargetPool {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO daily_target_pools (study_day, created_at, updated_at, recommended_minutes, new_word_count, focused_word_count, review_word_count, target_type, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      pool.study_day, now, now, pool.recommended_minutes, pool.new_word_count,
      pool.focused_word_count, pool.review_word_count, pool.target_type, pool.status, pool.metadata
    )
    return this.getById(result.lastInsertRowid as number)!
  }

  getById(id: number): DailyTargetPool | null {
    return this.db.prepare('SELECT * FROM daily_target_pools WHERE id = ?').get(id) as DailyTargetPool | null
  }

  getByStudyDay(studyDay: string): DailyTargetPool | null {
    return this.db.prepare('SELECT * FROM daily_target_pools WHERE study_day = ?').get(studyDay) as DailyTargetPool | null
  }

  update(id: number, updates: Partial<DailyTargetPool>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'study_day' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(id)

    this.db.prepare(
      `UPDATE daily_target_pools SET ${setClause}, updated_at = ? WHERE id = ?`
    ).run(...values)
  }

  getActive(studyDay: string): DailyTargetPool | null {
    return this.db.prepare(
      "SELECT * FROM daily_target_pools WHERE study_day = ? AND status = 'active'"
    ).get(studyDay) as DailyTargetPool | null
  }

  markCompleted(id: number): void {
    this.update(id, { status: 'completed' })
  }

  markExpired(id: number): void {
    this.update(id, { status: 'expired' })
  }

  getRecent(limit = 7): DailyTargetPool[] {
    return this.db.prepare(
      'SELECT * FROM daily_target_pools ORDER BY study_day DESC LIMIT ?'
    ).all(limit) as DailyTargetPool[]
  }
}
