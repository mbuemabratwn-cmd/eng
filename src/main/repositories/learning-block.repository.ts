import { BaseRepository } from './base'

export interface LearningBlock {
  id: number
  session_id: number | null
  study_day: string
  started_at: string
  ended_at: string | null
  duration_seconds: number
  summary: string | null
  created_at: string
}

export class LearningBlockRepository extends BaseRepository {
  create(studyDay: string, sessionId?: number): LearningBlock {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO learning_blocks (session_id, study_day, started_at, created_at) VALUES (?, ?, ?, ?)'
    ).run(sessionId || null, studyDay, now, now)
    return this.getBlock(result.lastInsertRowid as number)!
  }

  getBlock(id: number): LearningBlock | null {
    return this.db.prepare('SELECT * FROM learning_blocks WHERE id = ?').get(id) as LearningBlock | null
  }

  getActiveBlock(studyDay: string): LearningBlock | null {
    return this.db.prepare(
      'SELECT * FROM learning_blocks WHERE study_day = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
    ).get(studyDay) as LearningBlock | null
  }

  endBlock(id: number, summary?: string): void {
    const now = this.now()
    const block = this.getBlock(id)
    if (!block) return

    const duration = Math.floor((new Date(now).getTime() - new Date(block.started_at).getTime()) / 1000)
    this.db.prepare(
      'UPDATE learning_blocks SET ended_at = ?, duration_seconds = ?, summary = ? WHERE id = ?'
    ).run(now, duration, summary || null, id)
  }

  getBlocksByStudyDay(studyDay: string): LearningBlock[] {
    return this.db.prepare(
      'SELECT * FROM learning_blocks WHERE study_day = ? ORDER BY started_at'
    ).all(studyDay) as LearningBlock[]
  }

  getRecentBlocks(limit = 10): LearningBlock[] {
    return this.db.prepare(
      'SELECT * FROM learning_blocks ORDER BY started_at DESC LIMIT ?'
    ).all(limit) as LearningBlock[]
  }
}
