import { BaseRepository } from './base'

export interface LearningEvent {
  id: number
  session_id: number | null
  block_id: number | null
  event_type: string
  target_type: string | null
  target_id: number | null
  result: string | null
  score: number | null
  metadata: string | null
  study_day: string | null
  created_at: string
}

export class LearningEventRepository extends BaseRepository {
  create(event: Omit<LearningEvent, 'id' | 'created_at'>): LearningEvent {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO learning_events (session_id, block_id, event_type, target_type, target_id, result, score, metadata, study_day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      event.session_id,
      event.block_id,
      event.event_type,
      event.target_type,
      event.target_id,
      event.result,
      event.score,
      event.metadata,
      event.study_day,
      now
    )
    return this.getEvent(result.lastInsertRowid as number)!
  }

  getEvent(id: number): LearningEvent | null {
    return this.db.prepare('SELECT * FROM learning_events WHERE id = ?').get(id) as LearningEvent | null
  }

  getEventsByStudyDay(studyDay: string): LearningEvent[] {
    return this.db.prepare(
      'SELECT * FROM learning_events WHERE study_day = ? ORDER BY created_at'
    ).all(studyDay) as LearningEvent[]
  }

  getEventsByBlock(blockId: number): LearningEvent[] {
    return this.db.prepare(
      'SELECT * FROM learning_events WHERE block_id = ? ORDER BY created_at'
    ).all(blockId) as LearningEvent[]
  }

  getEventsBySession(sessionId: number): LearningEvent[] {
    return this.db.prepare(
      'SELECT * FROM learning_events WHERE session_id = ? ORDER BY created_at'
    ).all(sessionId) as LearningEvent[]
  }

  getRecentEvents(limit = 50): LearningEvent[] {
    return this.db.prepare(
      'SELECT * FROM learning_events ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as LearningEvent[]
  }

  getEventsByType(eventType: string, limit = 50): LearningEvent[] {
    return this.db.prepare(
      'SELECT * FROM learning_events WHERE event_type = ? ORDER BY created_at DESC LIMIT ?'
    ).all(eventType, limit) as LearningEvent[]
  }
}
