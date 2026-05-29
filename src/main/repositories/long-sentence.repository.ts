import { BaseRepository } from './base'

export interface LongSentence {
  id: number
  sentence: string
  translation: string | null
  source: string | null
  difficulty_level: number
  created_by_ai: number
  ai_model: string | null
  topic: string | null
  grammar_points: string | null
  created_at: string
  updated_at: string
}

export interface LongSentenceAnalysis {
  id: number
  sentence_id: number
  analysis_type: string
  content: string
  order_index: number
  created_at: string
}

export interface UserSentenceProgress {
  id: number
  sentence_id: number
  status: string
  user_guess: string | null
  guess_score: number | null
  comprehension_score: number | null
  structure_score: number | null
  vocabulary_score: number | null
  grammar_score: number | null
  attempt_count: number
  correct_count: number
  last_attempt_at: string | null
  next_review_at: string | null
  interval_days: number
  ease_factor: number
  created_at: string
  updated_at: string
  fsrs_difficulty: number
  fsrs_stability: number
  fsrs_retrievability: number
  fsrs_state: number
  fsrs_last_review_at: string | null
  fsrs_elapsed_days: number
}

export interface SentenceWeaknessCandidate {
  id: number
  sentence_id: number
  weakness_type: string
  reference_text: string | null
  vocabulary_word: string | null
  grammar_point: string | null
  severity: number
  evidence_event_ids: string | null
  status: string
  created_at: string
  updated_at: string
}

export class LongSentenceRepository extends BaseRepository {
  // Sentence operations
  addSentence(sentence: Omit<LongSentence, 'id' | 'created_at' | 'updated_at'>): LongSentence {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO long_sentences (sentence, translation, source, difficulty_level, created_by_ai, ai_model, topic, grammar_points, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      sentence.sentence, sentence.translation, sentence.source, sentence.difficulty_level || 1,
      sentence.created_by_ai || 0, sentence.ai_model, sentence.topic, sentence.grammar_points, now, now
    )
    return this.getSentence(result.lastInsertRowid as number)!
  }

  getSentence(id: number): LongSentence | null {
    return this.db.prepare('SELECT * FROM long_sentences WHERE id = ?').get(id) as LongSentence | null
  }

  getSentences(limit = 50, offset = 0): LongSentence[] {
    return this.db.prepare('SELECT * FROM long_sentences ORDER BY id LIMIT ? OFFSET ?').all(limit, offset) as LongSentence[]
  }

  getSentencesByDifficulty(level: number, limit = 50): LongSentence[] {
    return this.db.prepare('SELECT * FROM long_sentences WHERE difficulty_level = ? ORDER BY id LIMIT ?').all(level, limit) as LongSentence[]
  }

  getSentencesByTopic(topic: string, limit = 50): LongSentence[] {
    return this.db.prepare('SELECT * FROM long_sentences WHERE topic = ? ORDER BY id LIMIT ?').all(topic, limit) as LongSentence[]
  }

  getAIGeneratedSentences(limit = 50): LongSentence[] {
    return this.db.prepare('SELECT * FROM long_sentences WHERE created_by_ai = 1 ORDER BY id LIMIT ?').all(limit) as LongSentence[]
  }

  // Analysis operations
  addAnalysis(analysis: Omit<LongSentenceAnalysis, 'id' | 'created_at'>): LongSentenceAnalysis {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO long_sentence_analysis (sentence_id, analysis_type, content, order_index, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(analysis.sentence_id, analysis.analysis_type, analysis.content, analysis.order_index || 0, now)
    return this.db.prepare('SELECT * FROM long_sentence_analysis WHERE id = ?').get(result.lastInsertRowid) as LongSentenceAnalysis
  }

  getAnalysesBySentence(sentenceId: number): LongSentenceAnalysis[] {
    return this.db.prepare(
      'SELECT * FROM long_sentence_analysis WHERE sentence_id = ? ORDER BY order_index'
    ).all(sentenceId) as LongSentenceAnalysis[]
  }

  // Progress operations
  getProgress(sentenceId: number): UserSentenceProgress | null {
    return this.db.prepare('SELECT * FROM user_sentence_progress WHERE sentence_id = ?').get(sentenceId) as UserSentenceProgress | null
  }

  createProgress(sentenceId: number, status = 'new'): UserSentenceProgress {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO user_sentence_progress (sentence_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?)`
    ).run(sentenceId, status, now, now)
    return this.db.prepare('SELECT * FROM user_sentence_progress WHERE id = ?').get(result.lastInsertRowid) as UserSentenceProgress
  }

  updateProgress(sentenceId: number, updates: Partial<UserSentenceProgress>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'sentence_id' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(sentenceId)

    this.db.prepare(
      `UPDATE user_sentence_progress SET ${setClause}, updated_at = ? WHERE sentence_id = ?`
    ).run(...values)
  }

  getDueReviewSentences(studyDay: string, limit = 50): UserSentenceProgress[] {
    return this.db.prepare(
      'SELECT * FROM user_sentence_progress WHERE next_review_at <= ? AND status != ? ORDER BY next_review_at LIMIT ?'
    ).all(studyDay, 'mastered', limit) as UserSentenceProgress[]
  }

  getWeakSentences(limit = 50): UserSentenceProgress[] {
    return this.db.prepare(
      "SELECT * FROM user_sentence_progress WHERE status = 'weak' ORDER BY comprehension_score ASC LIMIT ?"
    ).all(limit) as UserSentenceProgress[]
  }

  // Weakness candidate operations
  addWeaknessCandidate(candidate: Omit<SentenceWeaknessCandidate, 'id' | 'created_at' | 'updated_at'>): SentenceWeaknessCandidate {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO sentence_weakness_candidates (sentence_id, weakness_type, reference_text, vocabulary_word, grammar_point, severity, evidence_event_ids, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      candidate.sentence_id, candidate.weakness_type, candidate.reference_text,
      candidate.vocabulary_word, candidate.grammar_point, candidate.severity || 0.5,
      candidate.evidence_event_ids, candidate.status || 'pending', now, now
    )
    return this.db.prepare('SELECT * FROM sentence_weakness_candidates WHERE id = ?').get(result.lastInsertRowid) as SentenceWeaknessCandidate
  }

  getWeaknessCandidatesBySentence(sentenceId: number): SentenceWeaknessCandidate[] {
    return this.db.prepare(
      'SELECT * FROM sentence_weakness_candidates WHERE sentence_id = ? ORDER BY severity DESC'
    ).all(sentenceId) as SentenceWeaknessCandidate[]
  }

  getPendingWeaknessCandidates(limit = 100): SentenceWeaknessCandidate[] {
    return this.db.prepare(
      "SELECT * FROM sentence_weakness_candidates WHERE status = 'pending' ORDER BY severity DESC LIMIT ?"
    ).all(limit) as SentenceWeaknessCandidate[]
  }

  updateWeaknessCandidateStatus(id: number, status: string): void {
    const now = this.now()
    this.db.prepare(
      "UPDATE sentence_weakness_candidates SET status = ?, updated_at = ? WHERE id = ?"
    ).run(status, now, id)
  }

  // Stats
  getSentenceCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM long_sentences').get() as { count: number }
    return result.count
  }

  getProgressStats(): { total: number; byStatus: Record<string, number> } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM user_sentence_progress').get() as { count: number }).count
    const rows = this.db.prepare(
      'SELECT status, COUNT(*) as count FROM user_sentence_progress GROUP BY status'
    ).all() as Array<{ status: string; count: number }>
    const byStatus: Record<string, number> = {}
    for (const row of rows) {
      byStatus[row.status] = row.count
    }
    return { total, byStatus }
  }
}
