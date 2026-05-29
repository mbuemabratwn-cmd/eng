import { BaseRepository } from './base'

export interface VocabularyWord {
  id: number
  word: string
  phonetic: string | null
  part_of_speech: string | null
  chinese_meaning: string | null
  english_meaning: string | null
  difficulty_level: number
  exam_tags: string | null
  source: string | null
  created_at: string
  updated_at: string
}

export interface VocabularyAiNote {
  id: number
  word_id: number
  ai_explanation_cn: string | null
  ai_explanation_en: string | null
  ai_examples: string | null
  exam_usage: string | null
  common_collocations: string | null
  common_mistakes: string | null
  synonyms: string | null
  antonyms: string | null
  memory_tips: string | null
  generated_by_model: string | null
  created_at: string
  updated_at: string
}

export interface UserWordProgress {
  id: number
  word_id: number
  status: string
  mastery_score: number
  recognition_score: number
  recall_score: number
  context_score: number
  usage_score: number
  correct_count: number
  mistake_count: number
  review_count: number
  last_seen_at: string | null
  next_review_at: string | null
  interval_days: number
  ease_factor: number
  last_result: string | null
  ai_note: string | null
  created_at: string
  updated_at: string
  fsrs_difficulty: number
  fsrs_stability: number
  fsrs_retrievability: number
  fsrs_state: number
  fsrs_last_review_at: string | null
  fsrs_elapsed_days: number
}

export interface WordReviewEvent {
  id: number
  word_id: number
  session_id: number | null
  block_id: number | null
  mode: string | null
  question_type: string | null
  prompt: string | null
  user_answer: string | null
  correct_answer: string | null
  is_correct: number | null
  score: number | null
  response_time_ms: number | null
  ai_feedback: string | null
  created_at: string
}

export class VocabularyRepository extends BaseRepository {
  // Word operations
  addWord(word: Omit<VocabularyWord, 'id' | 'created_at' | 'updated_at'>): VocabularyWord {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO vocabulary_words (word, phonetic, part_of_speech, chinese_meaning, english_meaning, difficulty_level, exam_tags, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      word.word, word.phonetic, word.part_of_speech, word.chinese_meaning,
      word.english_meaning, word.difficulty_level || 1, word.exam_tags, word.source, now, now
    )
    return this.getWord(result.lastInsertRowid as number)!
  }

  getWord(id: number): VocabularyWord | null {
    return this.db.prepare('SELECT * FROM vocabulary_words WHERE id = ?').get(id) as VocabularyWord | null
  }

  getWordByText(word: string): VocabularyWord | null {
    return this.db.prepare('SELECT * FROM vocabulary_words WHERE word = ?').get(word) as VocabularyWord | null
  }

  getWords(limit = 100, offset = 0): VocabularyWord[] {
    return this.db.prepare('SELECT * FROM vocabulary_words ORDER BY id LIMIT ? OFFSET ?').all(limit, offset) as VocabularyWord[]
  }

  searchWords(query: string, limit = 50): VocabularyWord[] {
    return this.db.prepare(
      'SELECT * FROM vocabulary_words WHERE word LIKE ? OR chinese_meaning LIKE ? LIMIT ?'
    ).all(`%${query}%`, `%${query}%`, limit) as VocabularyWord[]
  }

  // AI notes operations
  addAiNote(note: Omit<VocabularyAiNote, 'id' | 'created_at' | 'updated_at'>): VocabularyAiNote {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO vocabulary_ai_notes (word_id, ai_explanation_cn, ai_explanation_en, ai_examples, exam_usage, common_collocations, common_mistakes, synonyms, antonyms, memory_tips, generated_by_model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      note.word_id, note.ai_explanation_cn, note.ai_explanation_en, note.ai_examples,
      note.exam_usage, note.common_collocations, note.common_mistakes, note.synonyms,
      note.antonyms, note.memory_tips, note.generated_by_model, now, now
    )
    return this.db.prepare('SELECT * FROM vocabulary_ai_notes WHERE id = ?').get(result.lastInsertRowid) as VocabularyAiNote
  }

  getAiNoteByWordId(wordId: number): VocabularyAiNote | null {
    return this.db.prepare('SELECT * FROM vocabulary_ai_notes WHERE word_id = ?').get(wordId) as VocabularyAiNote | null
  }

  // Progress operations
  getProgress(wordId: number): UserWordProgress | null {
    return this.db.prepare('SELECT * FROM user_word_progress WHERE word_id = ?').get(wordId) as UserWordProgress | null
  }

  createProgress(wordId: number, status = 'new'): UserWordProgress {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO user_word_progress (word_id, status, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(wordId, status, now, now)
    return this.db.prepare('SELECT * FROM user_word_progress WHERE id = ?').get(result.lastInsertRowid) as UserWordProgress
  }

  updateProgress(wordId: number, updates: Partial<UserWordProgress>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'word_id' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(wordId)

    this.db.prepare(
      `UPDATE user_word_progress SET ${setClause}, updated_at = ? WHERE word_id = ?`
    ).run(...values)
  }

  getProgressByStatus(status: string, limit = 100): UserWordProgress[] {
    return this.db.prepare(
      'SELECT * FROM user_word_progress WHERE status = ? ORDER BY next_review_at LIMIT ?'
    ).all(status, limit) as UserWordProgress[]
  }

  getDueReviewWords(studyDay: string, limit = 100): UserWordProgress[] {
    return this.db.prepare(
      'SELECT * FROM user_word_progress WHERE next_review_at <= ? AND status != ? ORDER BY next_review_at LIMIT ?'
    ).all(studyDay, 'mastered', limit) as UserWordProgress[]
  }

  getWeakWords(limit = 50): UserWordProgress[] {
    return this.db.prepare(
      'SELECT * FROM user_word_progress WHERE status = ? ORDER BY mastery_score ASC LIMIT ?'
    ).all('weak', limit) as UserWordProgress[]
  }

  // Review event operations
  recordReview(event: Omit<WordReviewEvent, 'id' | 'created_at'>): WordReviewEvent {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO word_review_events (word_id, session_id, block_id, mode, question_type, prompt, user_answer, correct_answer, is_correct, score, response_time_ms, ai_feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      event.word_id, event.session_id, event.block_id, event.mode,
      event.question_type, event.prompt, event.user_answer, event.correct_answer,
      event.is_correct, event.score, event.response_time_ms, event.ai_feedback, now
    )
    return this.db.prepare('SELECT * FROM word_review_events WHERE id = ?').get(result.lastInsertRowid) as WordReviewEvent
  }

  getReviewEventsByWord(wordId: number, limit = 20): WordReviewEvent[] {
    return this.db.prepare(
      'SELECT * FROM word_review_events WHERE word_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(wordId, limit) as WordReviewEvent[]
  }

  getRecentReviewEvents(limit = 50): WordReviewEvent[] {
    return this.db.prepare(
      'SELECT * FROM word_review_events ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as WordReviewEvent[]
  }

  getReviewEventsByBlock(blockId: number): WordReviewEvent[] {
    return this.db.prepare(
      'SELECT * FROM word_review_events WHERE block_id = ? ORDER BY created_at'
    ).all(blockId) as WordReviewEvent[]
  }

  // Stats
  getWordCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM vocabulary_words').get() as { count: number }
    return result.count
  }

  getProgressStats(): { total: number; byStatus: Record<string, number> } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM user_word_progress').get() as { count: number }).count
    const rows = this.db.prepare(
      'SELECT status, COUNT(*) as count FROM user_word_progress GROUP BY status'
    ).all() as Array<{ status: string; count: number }>
    const byStatus: Record<string, number> = {}
    for (const row of rows) {
      byStatus[row.status] = row.count
    }
    return { total, byStatus }
  }
}
