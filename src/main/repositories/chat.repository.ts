import { BaseRepository } from './base'

export interface ChatSession {
  id: number
  title: string | null
  session_type: string | null
  started_at: string | null
  ended_at: string | null
  total_duration_seconds: number
  summary: string | null
  ai_strategy_used: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  session_id: number
  role: string
  content: string
  detected_language: string | null
  intent_type: string | null
  related_word_ids: string | null
  related_sentence_ids: string | null
  detected_error_ids: string | null
  created_at: string
}

export class ChatRepository extends BaseRepository {
  createSession(title?: string, sessionType?: string): ChatSession {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO chat_sessions (title, session_type, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(title || null, sessionType || null, now, now, now)
    return this.getSession(result.lastInsertRowid as number)!
  }

  getSession(id: number): ChatSession | null {
    return this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as ChatSession | null
  }

  getRecentSessions(limit = 20): ChatSession[] {
    return this.db.prepare('SELECT * FROM chat_sessions ORDER BY created_at DESC LIMIT ?').all(limit) as ChatSession[]
  }

  getSessions(limit = 50, offset = 0): ChatSession[] {
    return this.db.prepare('SELECT * FROM chat_sessions ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as ChatSession[]
  }

  updateSession(id: number, updates: Partial<Pick<ChatSession, 'title' | 'ended_at' | 'total_duration_seconds' | 'summary' | 'ai_strategy_used'>>): void {
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title) }
    if (updates.ended_at !== undefined) { fields.push('ended_at = ?'); values.push(updates.ended_at) }
    if (updates.total_duration_seconds !== undefined) { fields.push('total_duration_seconds = ?'); values.push(updates.total_duration_seconds) }
    if (updates.summary !== undefined) { fields.push('summary = ?'); values.push(updates.summary) }
    if (updates.ai_strategy_used !== undefined) { fields.push('ai_strategy_used = ?'); values.push(updates.ai_strategy_used) }

    if (fields.length === 0) return

    fields.push('updated_at = ?')
    values.push(this.now())
    values.push(id)

    this.db.prepare(`UPDATE chat_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  saveMessage(sessionId: number, role: string, content: string, extras?: Partial<Pick<ChatMessage, 'detected_language' | 'intent_type' | 'related_word_ids' | 'related_sentence_ids' | 'detected_error_ids'>>): ChatMessage {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO chat_messages (session_id, role, content, detected_language, intent_type, related_word_ids, related_sentence_ids, detected_error_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      sessionId,
      role,
      content,
      extras?.detected_language || null,
      extras?.intent_type || null,
      extras?.related_word_ids || null,
      extras?.related_sentence_ids || null,
      extras?.detected_error_ids || null,
      now
    )
    return this.getMessage(result.lastInsertRowid as number)!
  }

  getMessage(id: number): ChatMessage | null {
    return this.db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessage | null
  }

  getMessages(sessionId: number, limit = 50, offset = 0): ChatMessage[] {
    return this.db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(sessionId, limit, offset) as ChatMessage[]
  }

  getRecentMessages(sessionId: number, count = 20): ChatMessage[] {
    return this.db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(sessionId, count) as ChatMessage[]
  }

  deleteMessage(id: number): boolean {
    const result = this.db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id)
    return result.changes > 0
  }
}
