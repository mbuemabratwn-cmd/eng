import { Migration } from './index'

export const migration003: Migration = {
  version: 3,
  name: 'daily_target_pool',
  sql: `
    CREATE TABLE IF NOT EXISTS daily_target_pools (
      id INTEGER PRIMARY KEY,
      study_day TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      recommended_minutes INTEGER DEFAULT 60,
      new_word_count INTEGER DEFAULT 50,
      focused_word_count INTEGER DEFAULT 20,
      review_word_count INTEGER DEFAULT 0,
      target_type TEXT DEFAULT 'vocabulary',
      status TEXT DEFAULT 'active',
      metadata TEXT,
      UNIQUE(study_day)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_target_pools_study_day
      ON daily_target_pools(study_day);

    CREATE INDEX IF NOT EXISTS idx_daily_target_pools_status
      ON daily_target_pools(status);
  `
}
