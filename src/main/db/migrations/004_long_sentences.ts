import { Migration } from './index'

export const migration004: Migration = {
  version: 4,
  name: 'long_sentences',
  sql: `
    CREATE TABLE IF NOT EXISTS long_sentences (
      id INTEGER PRIMARY KEY,
      sentence TEXT NOT NULL,
      translation TEXT,
      source TEXT,
      difficulty_level INTEGER DEFAULT 1,
      created_by_ai INTEGER DEFAULT 0,
      ai_model TEXT,
      topic TEXT,
      grammar_points TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS long_sentence_analysis (
      id INTEGER PRIMARY KEY,
      sentence_id INTEGER NOT NULL,
      analysis_type TEXT NOT NULL,
      content TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sentence_id) REFERENCES long_sentences(id)
    );

    CREATE TABLE IF NOT EXISTS user_sentence_progress (
      id INTEGER PRIMARY KEY,
      sentence_id INTEGER NOT NULL,
      status TEXT DEFAULT 'new',
      user_guess TEXT,
      guess_score REAL,
      comprehension_score REAL,
      structure_score REAL,
      vocabulary_score REAL,
      grammar_score REAL,
      attempt_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      next_review_at TEXT,
      interval_days REAL DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(sentence_id),
      FOREIGN KEY (sentence_id) REFERENCES long_sentences(id)
    );

    CREATE TABLE IF NOT EXISTS sentence_weakness_candidates (
      id INTEGER PRIMARY KEY,
      sentence_id INTEGER NOT NULL,
      weakness_type TEXT NOT NULL,
      reference_text TEXT,
      vocabulary_word TEXT,
      grammar_point TEXT,
      severity REAL DEFAULT 0.5,
      evidence_event_ids TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (sentence_id) REFERENCES long_sentences(id)
    );

    CREATE INDEX IF NOT EXISTS idx_long_sentences_difficulty
      ON long_sentences(difficulty_level);

    CREATE INDEX IF NOT EXISTS idx_long_sentences_topic
      ON long_sentences(topic);

    CREATE INDEX IF NOT EXISTS idx_long_sentences_created_by_ai
      ON long_sentences(created_by_ai);

    CREATE INDEX IF NOT EXISTS idx_long_sentence_analysis_sentence
      ON long_sentence_analysis(sentence_id);

    CREATE INDEX IF NOT EXISTS idx_user_sentence_progress_sentence
      ON user_sentence_progress(sentence_id);

    CREATE INDEX IF NOT EXISTS idx_user_sentence_progress_status
      ON user_sentence_progress(status);

    CREATE INDEX IF NOT EXISTS idx_user_sentence_progress_next_review
      ON user_sentence_progress(next_review_at);

    CREATE INDEX IF NOT EXISTS idx_sentence_weakness_candidates_sentence
      ON sentence_weakness_candidates(sentence_id);

    CREATE INDEX IF NOT EXISTS idx_sentence_weakness_candidates_type
      ON sentence_weakness_candidates(weakness_type);

    CREATE INDEX IF NOT EXISTS idx_sentence_weakness_candidates_status
      ON sentence_weakness_candidates(status);
  `
}
