import { BaseRepository } from './base'

export interface GrammarErrorEvent {
  id: number
  session_id: number | null
  block_id: number | null
  error_type: string
  error_text: string
  correction: string | null
  context_sentence: string | null
  severity: string
  is_serious: number
  user_acknowledged: number
  ai_feedback: string | null
  created_at: string
}

export interface GrammarIssueSummary {
  id: number
  issue_type: string
  issue_pattern: string
  occurrence_count: number
  first_seen_at: string
  last_seen_at: string
  example_errors: string | null
  suggested_rule: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface GrammarWeaknessCandidate {
  id: number
  error_event_id: number | null
  issue_summary_id: number | null
  weakness_type: string
  reference_text: string | null
  grammar_point: string | null
  severity: number
  evidence_event_ids: string | null
  status: string
  created_at: string
  updated_at: string
}

export class GrammarRepository extends BaseRepository {
  // Error event operations
  addErrorEvent(event: Omit<GrammarErrorEvent, 'id' | 'created_at'>): GrammarErrorEvent {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO grammar_error_events (session_id, block_id, error_type, error_text, correction, context_sentence, severity, is_serious, user_acknowledged, ai_feedback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.session_id, event.block_id, event.error_type, event.error_text,
      event.correction, event.context_sentence, event.severity || 'minor',
      event.is_serious || 0, event.user_acknowledged || 0, event.ai_feedback, now
    )
    return this.db.prepare('SELECT * FROM grammar_error_events WHERE id = ?').get(result.lastInsertRowid) as GrammarErrorEvent
  }

  getErrorEvent(id: number): GrammarErrorEvent | null {
    return this.db.prepare('SELECT * FROM grammar_error_events WHERE id = ?').get(id) as GrammarErrorEvent | null
  }

  getErrorEventsBySession(sessionId: number, limit = 50): GrammarErrorEvent[] {
    return this.db.prepare(
      'SELECT * FROM grammar_error_events WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(sessionId, limit) as GrammarErrorEvent[]
  }

  getErrorEventsByBlock(blockId: number, limit = 50): GrammarErrorEvent[] {
    return this.db.prepare(
      'SELECT * FROM grammar_error_events WHERE block_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(blockId, limit) as GrammarErrorEvent[]
  }

  getSeriousErrors(limit = 50): GrammarErrorEvent[] {
    return this.db.prepare(
      'SELECT * FROM grammar_error_events WHERE is_serious = 1 ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as GrammarErrorEvent[]
  }

  getUnacknowledgedErrors(limit = 50): GrammarErrorEvent[] {
    return this.db.prepare(
      'SELECT * FROM grammar_error_events WHERE user_acknowledged = 0 ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as GrammarErrorEvent[]
  }

  acknowledgeError(id: number): void {
    const now = this.now()
    this.db.prepare(
      'UPDATE grammar_error_events SET user_acknowledged = 1, created_at = created_at WHERE id = ?'
    ).run(id)
  }

  // Issue summary operations
  addIssueSummary(summary: Omit<GrammarIssueSummary, 'id' | 'created_at' | 'updated_at'>): GrammarIssueSummary {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO grammar_issue_summary (issue_type, issue_pattern, occurrence_count, first_seen_at, last_seen_at, example_errors, suggested_rule, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      summary.issue_type, summary.issue_pattern, summary.occurrence_count || 1,
      summary.first_seen_at, summary.last_seen_at, summary.example_errors,
      summary.suggested_rule, summary.status || 'active', now, now
    )
    return this.db.prepare('SELECT * FROM grammar_issue_summary WHERE id = ?').get(result.lastInsertRowid) as GrammarIssueSummary
  }

  getIssueSummary(id: number): GrammarIssueSummary | null {
    return this.db.prepare('SELECT * FROM grammar_issue_summary WHERE id = ?').get(id) as GrammarIssueSummary | null
  }

  getIssueSummaryByPattern(issueType: string, pattern: string): GrammarIssueSummary | null {
    return this.db.prepare(
      'SELECT * FROM grammar_issue_summary WHERE issue_type = ? AND issue_pattern = ?'
    ).get(issueType, pattern) as GrammarIssueSummary | null
  }

  updateIssueSummary(id: number, updates: Partial<GrammarIssueSummary>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(id)

    this.db.prepare(
      `UPDATE grammar_issue_summary SET ${setClause}, updated_at = ? WHERE id = ?`
    ).run(...values)
  }

  incrementIssueOccurrence(id: number): void {
    const now = this.now()
    this.db.prepare(
      'UPDATE grammar_issue_summary SET occurrence_count = occurrence_count + 1, last_seen_at = ?, updated_at = ? WHERE id = ?'
    ).run(now, now, id)
  }

  getActiveIssueSummaries(limit = 100): GrammarIssueSummary[] {
    return this.db.prepare(
      "SELECT * FROM grammar_issue_summary WHERE status = 'active' ORDER BY occurrence_count DESC LIMIT ?"
    ).all(limit) as GrammarIssueSummary[]
  }

  getIssueSummariesByType(issueType: string, limit = 50): GrammarIssueSummary[] {
    return this.db.prepare(
      'SELECT * FROM grammar_issue_summary WHERE issue_type = ? ORDER BY occurrence_count DESC LIMIT ?'
    ).all(issueType, limit) as GrammarIssueSummary[]
  }

  // Weakness candidate operations
  addWeaknessCandidate(candidate: Omit<GrammarWeaknessCandidate, 'id' | 'created_at' | 'updated_at'>): GrammarWeaknessCandidate {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO grammar_weakness_candidates (error_event_id, issue_summary_id, weakness_type, reference_text, grammar_point, severity, evidence_event_ids, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      candidate.error_event_id, candidate.issue_summary_id, candidate.weakness_type,
      candidate.reference_text, candidate.grammar_point, candidate.severity || 0.5,
      candidate.evidence_event_ids, candidate.status || 'pending', now, now
    )
    return this.db.prepare('SELECT * FROM grammar_weakness_candidates WHERE id = ?').get(result.lastInsertRowid) as GrammarWeaknessCandidate
  }

  getPendingWeaknessCandidates(limit = 100): GrammarWeaknessCandidate[] {
    return this.db.prepare(
      "SELECT * FROM grammar_weakness_candidates WHERE status = 'pending' ORDER BY severity DESC LIMIT ?"
    ).all(limit) as GrammarWeaknessCandidate[]
  }

  updateWeaknessCandidateStatus(id: number, status: string): void {
    const now = this.now()
    this.db.prepare(
      'UPDATE grammar_weakness_candidates SET status = ?, updated_at = ? WHERE id = ?'
    ).run(status, now, id)
  }

  // Stats
  getErrorCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM grammar_error_events').get() as { count: number }
    return result.count
  }

  getSeriousErrorCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM grammar_error_events WHERE is_serious = 1').get() as { count: number }
    return result.count
  }

  getIssueSummaryStats(): { total: number; byType: Record<string, number> } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM grammar_issue_summary').get() as { count: number }).count
    const rows = this.db.prepare(
      'SELECT issue_type, COUNT(*) as count FROM grammar_issue_summary GROUP BY issue_type'
    ).all() as Array<{ issue_type: string; count: number }>
    const byType: Record<string, number> = {}
    for (const row of rows) {
      byType[row.issue_type] = row.count
    }
    return { total, byType }
  }
}
