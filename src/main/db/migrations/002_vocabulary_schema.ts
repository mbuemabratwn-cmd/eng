import { Migration } from './index'

export const migration002: Migration = {
  version: 2,
  name: 'vocabulary_schema',
  sql: `
    CREATE TABLE IF NOT EXISTS vocabulary_words (
      id INTEGER PRIMARY KEY,
      word TEXT NOT NULL UNIQUE,
      phonetic TEXT,
      part_of_speech TEXT,
      chinese_meaning TEXT,
      english_meaning TEXT,
      difficulty_level INTEGER DEFAULT 1,
      exam_tags TEXT,
      source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vocabulary_ai_notes (
      id INTEGER PRIMARY KEY,
      word_id INTEGER NOT NULL,
      ai_explanation_cn TEXT,
      ai_explanation_en TEXT,
      ai_examples TEXT,
      exam_usage TEXT,
      common_collocations TEXT,
      common_mistakes TEXT,
      synonyms TEXT,
      antonyms TEXT,
      memory_tips TEXT,
      generated_by_model TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (word_id) REFERENCES vocabulary_words(id)
    );

    CREATE TABLE IF NOT EXISTS user_word_progress (
      id INTEGER PRIMARY KEY,
      word_id INTEGER NOT NULL UNIQUE,
      status TEXT DEFAULT 'new',
      mastery_score REAL DEFAULT 0,
      recognition_score REAL DEFAULT 0,
      recall_score REAL DEFAULT 0,
      context_score REAL DEFAULT 0,
      usage_score REAL DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      mistake_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      last_seen_at TEXT,
      next_review_at TEXT,
      interval_days REAL DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      last_result TEXT,
      ai_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (word_id) REFERENCES vocabulary_words(id)
    );

    CREATE TABLE IF NOT EXISTS word_review_events (
      id INTEGER PRIMARY KEY,
      word_id INTEGER NOT NULL,
      session_id INTEGER,
      block_id INTEGER,
      mode TEXT,
      question_type TEXT,
      prompt TEXT,
      user_answer TEXT,
      correct_answer TEXT,
      is_correct INTEGER,
      score REAL,
      response_time_ms INTEGER,
      ai_feedback TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (word_id) REFERENCES vocabulary_words(id),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
      FOREIGN KEY (block_id) REFERENCES learning_blocks(id)
    );

    CREATE INDEX IF NOT EXISTS idx_vocabulary_words_word
      ON vocabulary_words(word);

    CREATE INDEX IF NOT EXISTS idx_vocabulary_words_difficulty
      ON vocabulary_words(difficulty_level);

    CREATE INDEX IF NOT EXISTS idx_vocabulary_ai_notes_word_id
      ON vocabulary_ai_notes(word_id);

    CREATE INDEX IF NOT EXISTS idx_user_word_progress_status
      ON user_word_progress(status);

    CREATE INDEX IF NOT EXISTS idx_user_word_progress_next_review
      ON user_word_progress(next_review_at);

    CREATE INDEX IF NOT EXISTS idx_user_word_progress_mastery
      ON user_word_progress(mastery_score);

    CREATE INDEX IF NOT EXISTS idx_user_word_progress_word_id
      ON user_word_progress(word_id);

    CREATE INDEX IF NOT EXISTS idx_word_review_events_word_created
      ON word_review_events(word_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_word_review_events_session
      ON word_review_events(session_id);

    CREATE INDEX IF NOT EXISTS idx_word_review_events_block
      ON word_review_events(block_id);

    CREATE INDEX IF NOT EXISTS idx_word_review_events_created
      ON word_review_events(created_at);
  `
}
