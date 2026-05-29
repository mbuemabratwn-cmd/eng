import { Migration } from './index'

export const migration006: Migration = {
  version: 6,
  name: 'summary_memory',
  sql: `
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY,
      study_day TEXT NOT NULL,
      summary_type TEXT DEFAULT 'daily',
      content TEXT NOT NULL,
      key_points TEXT,
      learning_stats TEXT,
      vocabulary_progress TEXT,
      grammar_progress TEXT,
      sentence_progress TEXT,
      recommendations TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(study_day)
    );

    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id INTEGER PRIMARY KEY,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      summary TEXT NOT NULL,
      strengths TEXT,
      weaknesses TEXT,
      recommendations TEXT,
      vocabulary_stats TEXT,
      grammar_stats TEXT,
      sentence_stats TEXT,
      overall_score REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(week_start)
    );

    CREATE TABLE IF NOT EXISTS ai_memory_summary (
      id INTEGER PRIMARY KEY,
      memory_type TEXT NOT NULL,
      category TEXT,
      content TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      evidence_event_ids TEXT,
      source_type TEXT,
      source_id INTEGER,
      status TEXT DEFAULT 'active',
      first_observed_at TEXT NOT NULL,
      last_observed_at TEXT NOT NULL,
      observation_count INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS block_summaries (
      id INTEGER PRIMARY KEY,
      block_id INTEGER NOT NULL,
      summary TEXT NOT NULL,
      activities TEXT,
      vocabulary_learned INTEGER DEFAULT 0,
      sentences_practiced INTEGER DEFAULT 0,
      grammar_errors INTEGER DEFAULT 0,
      duration_minutes INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (block_id) REFERENCES learning_blocks(id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_summaries_study_day
      ON daily_summaries(study_day);

    CREATE INDEX IF NOT EXISTS idx_weekly_reviews_week_start
      ON weekly_reviews(week_start);

    CREATE INDEX IF NOT EXISTS idx_ai_memory_summary_type
      ON ai_memory_summary(memory_type);

    CREATE INDEX IF NOT EXISTS idx_ai_memory_summary_category
      ON ai_memory_summary(category);

    CREATE INDEX IF NOT EXISTS idx_ai_memory_summary_status
      ON ai_memory_summary(status);

    CREATE INDEX IF NOT EXISTS idx_ai_memory_summary_confidence
      ON ai_memory_summary(confidence);

    CREATE INDEX IF NOT EXISTS idx_ai_memory_summary_source
      ON ai_memory_summary(source_type, source_id);

    CREATE INDEX IF NOT EXISTS idx_block_summaries_block
      ON block_summaries(block_id);
  `
}
