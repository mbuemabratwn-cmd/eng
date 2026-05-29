import { Migration } from './index'

export const migration008: Migration = {
  version: 8,
  name: 'fsrs_fields',
  sql: `
    ALTER TABLE user_word_progress ADD COLUMN fsrs_difficulty REAL DEFAULT 0;
    ALTER TABLE user_word_progress ADD COLUMN fsrs_stability REAL DEFAULT 0;
    ALTER TABLE user_word_progress ADD COLUMN fsrs_retrievability REAL DEFAULT 1;
    ALTER TABLE user_word_progress ADD COLUMN fsrs_state INTEGER DEFAULT 0;
    ALTER TABLE user_word_progress ADD COLUMN fsrs_last_review_at TEXT;
    ALTER TABLE user_word_progress ADD COLUMN fsrs_elapsed_days REAL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_user_word_progress_fsrs_state
      ON user_word_progress(fsrs_state);

    CREATE INDEX IF NOT EXISTS idx_user_word_progress_fsrs_retrievability
      ON user_word_progress(fsrs_retrievability);

    ALTER TABLE user_sentence_progress ADD COLUMN fsrs_difficulty REAL DEFAULT 0;
    ALTER TABLE user_sentence_progress ADD COLUMN fsrs_stability REAL DEFAULT 0;
    ALTER TABLE user_sentence_progress ADD COLUMN fsrs_retrievability REAL DEFAULT 1;
    ALTER TABLE user_sentence_progress ADD COLUMN fsrs_state INTEGER DEFAULT 0;
    ALTER TABLE user_sentence_progress ADD COLUMN fsrs_last_review_at TEXT;
    ALTER TABLE user_sentence_progress ADD COLUMN fsrs_elapsed_days REAL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_user_sentence_progress_fsrs_state
      ON user_sentence_progress(fsrs_state);
  `
}
