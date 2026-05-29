import Database from 'better-sqlite3'

export interface AILogEntry {
  provider?: string
  model?: string
  prompt_type?: string
  global_prompt_version?: string
  mode_prompt_version?: string
  output_schema_version?: string
  input_tokens_estimate?: number
  output_tokens_estimate?: number
  latency_ms?: number
  status: string
  error_message?: string
  related_session_id?: number
  related_block_id?: number
  related_message_id?: number
}

export class AILogger {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  log(entry: AILogEntry): void {
    this.db.prepare(`
      INSERT INTO ai_request_logs (
        provider, model, prompt_type, global_prompt_version,
        mode_prompt_version, output_schema_version,
        input_tokens_estimate, output_tokens_estimate,
        latency_ms, status, error_message,
        related_session_id, related_block_id, related_message_id,
        request_created_at, response_completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.provider || null,
      entry.model || null,
      entry.prompt_type || null,
      entry.global_prompt_version || null,
      entry.mode_prompt_version || null,
      entry.output_schema_version || null,
      entry.input_tokens_estimate || null,
      entry.output_tokens_estimate || null,
      entry.latency_ms || null,
      entry.status,
      entry.error_message || null,
      entry.related_session_id || null,
      entry.related_block_id || null,
      entry.related_message_id || null,
      new Date().toISOString(),
      entry.status === 'success' ? new Date().toISOString() : null
    )
  }

  getRecentLogs(limit = 50): unknown[] {
    return this.db.prepare(
      'SELECT * FROM ai_request_logs ORDER BY request_created_at DESC LIMIT ?'
    ).all(limit)
  }

  getTodayStats(): { requestCount: number; inputTokens: number; outputTokens: number; totalTokens: number } {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()

    const row = this.db.prepare(`
      SELECT
        COUNT(*) as requestCount,
        COALESCE(SUM(input_tokens_estimate), 0) as inputTokens,
        COALESCE(SUM(output_tokens_estimate), 0) as outputTokens
      FROM ai_request_logs
      WHERE request_created_at >= ? AND status = 'success'
    `).get(todayStr) as { requestCount: number; inputTokens: number; outputTokens: number }

    return {
      requestCount: row.requestCount,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.inputTokens + row.outputTokens
    }
  }
}
