import { BaseRepository } from './base'

export interface DailySummary {
  id: number
  study_day: string
  summary_type: string
  content: string
  key_points: string | null
  learning_stats: string | null
  vocabulary_progress: string | null
  grammar_progress: string | null
  sentence_progress: string | null
  recommendations: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyReview {
  id: number
  week_start: string
  week_end: string
  summary: string
  strengths: string | null
  weaknesses: string | null
  recommendations: string | null
  vocabulary_stats: string | null
  grammar_stats: string | null
  sentence_stats: string | null
  overall_score: number | null
  created_at: string
  updated_at: string
}

export interface AiMemorySummary {
  id: number
  memory_type: string
  category: string | null
  content: string
  confidence: number
  evidence_event_ids: string | null
  source_type: string | null
  source_id: number | null
  status: string
  first_observed_at: string
  last_observed_at: string
  observation_count: number
  created_at: string
  updated_at: string
}

export interface BlockSummary {
  id: number
  block_id: number
  summary: string
  activities: string | null
  vocabulary_learned: number
  sentences_practiced: number
  grammar_errors: number
  duration_minutes: number | null
  created_at: string
}

export class SummaryRepository extends BaseRepository {
  // Daily summary operations
  createDailySummary(summary: Omit<DailySummary, 'id' | 'created_at' | 'updated_at'>): DailySummary {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO daily_summaries (study_day, summary_type, content, key_points, learning_stats, vocabulary_progress, grammar_progress, sentence_progress, recommendations, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      summary.study_day, summary.summary_type || 'daily', summary.content,
      summary.key_points, summary.learning_stats, summary.vocabulary_progress,
      summary.grammar_progress, summary.sentence_progress, summary.recommendations, now, now
    )
    return this.db.prepare('SELECT * FROM daily_summaries WHERE id = ?').get(result.lastInsertRowid) as DailySummary
  }

  getDailySummary(studyDay: string): DailySummary | null {
    return this.db.prepare('SELECT * FROM daily_summaries WHERE study_day = ?').get(studyDay) as DailySummary | null
  }

  getDailySummaryById(id: number): DailySummary | null {
    return this.db.prepare('SELECT * FROM daily_summaries WHERE id = ?').get(id) as DailySummary | null
  }

  updateDailySummary(id: number, updates: Partial<DailySummary>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'study_day' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(id)

    this.db.prepare(
      `UPDATE daily_summaries SET ${setClause}, updated_at = ? WHERE id = ?`
    ).run(...values)
  }

  getRecentDailySummaries(limit = 7): DailySummary[] {
    return this.db.prepare(
      'SELECT * FROM daily_summaries ORDER BY study_day DESC LIMIT ?'
    ).all(limit) as DailySummary[]
  }

  // Weekly review operations
  createWeeklyReview(review: Omit<WeeklyReview, 'id' | 'created_at' | 'updated_at'>): WeeklyReview {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO weekly_reviews (week_start, week_end, summary, strengths, weaknesses, recommendations, vocabulary_stats, grammar_stats, sentence_stats, overall_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      review.week_start, review.week_end, review.summary, review.strengths,
      review.weaknesses, review.recommendations, review.vocabulary_stats,
      review.grammar_stats, review.sentence_stats, review.overall_score, now, now
    )
    return this.db.prepare('SELECT * FROM weekly_reviews WHERE id = ?').get(result.lastInsertRowid) as WeeklyReview
  }

  getWeeklyReview(weekStart: string): WeeklyReview | null {
    return this.db.prepare('SELECT * FROM weekly_reviews WHERE week_start = ?').get(weekStart) as WeeklyReview | null
  }

  getWeeklyReviewById(id: number): WeeklyReview | null {
    return this.db.prepare('SELECT * FROM weekly_reviews WHERE id = ?').get(id) as WeeklyReview | null
  }

  updateWeeklyReview(id: number, updates: Partial<WeeklyReview>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'week_start' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(id)

    this.db.prepare(
      `UPDATE weekly_reviews SET ${setClause}, updated_at = ? WHERE id = ?`
    ).run(...values)
  }

  getRecentWeeklyReviews(limit = 4): WeeklyReview[] {
    return this.db.prepare(
      'SELECT * FROM weekly_reviews ORDER BY week_start DESC LIMIT ?'
    ).all(limit) as WeeklyReview[]
  }

  // AI memory summary operations
  addMemorySummary(memory: Omit<AiMemorySummary, 'id' | 'created_at' | 'updated_at'>): AiMemorySummary {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO ai_memory_summary (memory_type, category, content, confidence, evidence_event_ids, source_type, source_id, status, first_observed_at, last_observed_at, observation_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      memory.memory_type, memory.category, memory.content, memory.confidence || 0.5,
      memory.evidence_event_ids, memory.source_type, memory.source_id,
      memory.status || 'active', memory.first_observed_at, memory.last_observed_at,
      memory.observation_count || 1, now, now
    )
    return this.db.prepare('SELECT * FROM ai_memory_summary WHERE id = ?').get(result.lastInsertRowid) as AiMemorySummary
  }

  getMemorySummary(id: number): AiMemorySummary | null {
    return this.db.prepare('SELECT * FROM ai_memory_summary WHERE id = ?').get(id) as AiMemorySummary | null
  }

  updateMemorySummary(id: number, updates: Partial<AiMemorySummary>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(id)

    this.db.prepare(
      `UPDATE ai_memory_summary SET ${setClause}, updated_at = ? WHERE id = ?`
    ).run(...values)
  }

  getActiveMemories(limit = 100): AiMemorySummary[] {
    return this.db.prepare(
      "SELECT * FROM ai_memory_summary WHERE status = 'active' ORDER BY confidence DESC, last_observed_at DESC LIMIT ?"
    ).all(limit) as AiMemorySummary[]
  }

  getMemoriesByType(memoryType: string, limit = 50): AiMemorySummary[] {
    return this.db.prepare(
      "SELECT * FROM ai_memory_summary WHERE memory_type = ? AND status = 'active' ORDER BY confidence DESC LIMIT ?"
    ).all(memoryType, limit) as AiMemorySummary[]
  }

  getMemoriesByCategory(category: string, limit = 50): AiMemorySummary[] {
    return this.db.prepare(
      "SELECT * FROM ai_memory_summary WHERE category = ? AND status = 'active' ORDER BY confidence DESC LIMIT ?"
    ).all(category, limit) as AiMemorySummary[]
  }

  findExistingMemory(memoryType: string, category: string | null, content: string): AiMemorySummary | null {
    if (category) {
      return this.db.prepare(
        "SELECT * FROM ai_memory_summary WHERE memory_type = ? AND category = ? AND content = ? AND status = 'active'"
      ).get(memoryType, category, content) as AiMemorySummary | null
    }
    return this.db.prepare(
      "SELECT * FROM ai_memory_summary WHERE memory_type = ? AND category IS NULL AND content = ? AND status = 'active'"
    ).get(memoryType, content) as AiMemorySummary | null
  }

  incrementObservation(id: number, evidenceEventIds?: string): void {
    const now = this.now()
    if (evidenceEventIds) {
      this.db.prepare(
        "UPDATE ai_memory_summary SET observation_count = observation_count + 1, last_observed_at = ?, evidence_event_ids = ?, updated_at = ? WHERE id = ?"
      ).run(now, evidenceEventIds, now, id)
    } else {
      this.db.prepare(
        "UPDATE ai_memory_summary SET observation_count = observation_count + 1, last_observed_at = ?, updated_at = ? WHERE id = ?"
      ).run(now, now, id)
    }
  }

  archiveMemory(id: number): void {
    const now = this.now()
    this.db.prepare(
      "UPDATE ai_memory_summary SET status = 'archived', updated_at = ? WHERE id = ?"
    ).run(now, id)
  }

  // Block summary operations
  createBlockSummary(summary: Omit<BlockSummary, 'id' | 'created_at'>): BlockSummary {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO block_summaries (block_id, summary, activities, vocabulary_learned, sentences_practiced, grammar_errors, duration_minutes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      summary.block_id, summary.summary, summary.activities,
      summary.vocabulary_learned || 0, summary.sentences_practiced || 0,
      summary.grammar_errors || 0, summary.duration_minutes, now
    )
    return this.db.prepare('SELECT * FROM block_summaries WHERE id = ?').get(result.lastInsertRowid) as BlockSummary
  }

  getBlockSummary(blockId: number): BlockSummary | null {
    return this.db.prepare('SELECT * FROM block_summaries WHERE block_id = ?').get(blockId) as BlockSummary | null
  }

  getRecentBlockSummaries(limit = 10): BlockSummary[] {
    return this.db.prepare(
      'SELECT * FROM block_summaries ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as BlockSummary[]
  }

  // Stats
  getSummaryStats(): { dailyCount: number; weeklyCount: number; memoryCount: number; blockCount: number } {
    const dailyCount = (this.db.prepare('SELECT COUNT(*) as count FROM daily_summaries').get() as { count: number }).count
    const weeklyCount = (this.db.prepare('SELECT COUNT(*) as count FROM weekly_reviews').get() as { count: number }).count
    const memoryCount = (this.db.prepare("SELECT COUNT(*) as count FROM ai_memory_summary WHERE status = 'active'").get() as { count: number }).count
    const blockCount = (this.db.prepare('SELECT COUNT(*) as count FROM block_summaries').get() as { count: number }).count
    return { dailyCount, weeklyCount, memoryCount, blockCount }
  }
}
