import { Migration } from './index'

export const migration005: Migration = {
  version: 5,
  name: 'grammar',
  sql: `
    CREATE TABLE IF NOT EXISTS grammar_error_events (
      id INTEGER PRIMARY KEY,
      session_id INTEGER,
      block_id INTEGER,
      error_type TEXT NOT NULL,
      error_text TEXT NOT NULL,
      correction TEXT,
      context_sentence TEXT,
      severity TEXT DEFAULT 'minor',
      is_serious INTEGER DEFAULT 0,
      user_acknowledged INTEGER DEFAULT 0,
      ai_feedback TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
      FOREIGN KEY (block_id) REFERENCES learning_blocks(id)
    );

    CREATE TABLE IF NOT EXISTS grammar_issue_summary (
      id INTEGER PRIMARY KEY,
      issue_type TEXT NOT NULL,
      issue_pattern TEXT NOT NULL,
      occurrence_count INTEGER DEFAULT 1,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      example_errors TEXT,
      suggested_rule TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(issue_type, issue_pattern)
    );

    CREATE TABLE IF NOT EXISTS grammar_weakness_candidates (
      id INTEGER PRIMARY KEY,
      error_event_id INTEGER,
      issue_summary_id INTEGER,
      weakness_type TEXT NOT NULL,
      reference_text TEXT,
      grammar_point TEXT,
      severity REAL DEFAULT 0.5,
      evidence_event_ids TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (error_event_id) REFERENCES grammar_error_events(id),
      FOREIGN KEY (issue_summary_id) REFERENCES grammar_issue_summary(id)
    );

    CREATE INDEX IF NOT EXISTS idx_grammar_error_events_session
      ON grammar_error_events(session_id);

    CREATE INDEX IF NOT EXISTS idx_grammar_error_events_block
      ON grammar_error_events(block_id);

    CREATE INDEX IF NOT EXISTS idx_grammar_error_events_type
      ON grammar_error_events(error_type);

    CREATE INDEX IF NOT EXISTS idx_grammar_error_events_severity
      ON grammar_error_events(severity);

    CREATE INDEX IF NOT EXISTS idx_grammar_error_events_serious
      ON grammar_error_events(is_serious);

    CREATE INDEX IF NOT EXISTS idx_grammar_error_events_created
      ON grammar_error_events(created_at);

    CREATE INDEX IF NOT EXISTS idx_grammar_issue_summary_type
      ON grammar_issue_summary(issue_type);

    CREATE INDEX IF NOT EXISTS idx_grammar_issue_summary_status
      ON grammar_issue_summary(status);

    CREATE INDEX IF NOT EXISTS idx_grammar_weakness_candidates_error
      ON grammar_weakness_candidates(error_event_id);

    CREATE INDEX IF NOT EXISTS idx_grammar_weakness_candidates_summary
      ON grammar_weakness_candidates(issue_summary_id);

    CREATE INDEX IF NOT EXISTS idx_grammar_weakness_candidates_type
      ON grammar_weakness_candidates(weakness_type);

    CREATE INDEX IF NOT EXISTS idx_grammar_weakness_candidates_status
      ON grammar_weakness_candidates(status);
  `
}
