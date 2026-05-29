import { Migration } from './index'

export const migration001: Migration = {
  version: 1,
  name: 'initial_schema',
  sql: `
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY,
      title TEXT,
      session_type TEXT,
      started_at TEXT,
      ended_at TEXT,
      total_duration_seconds INTEGER DEFAULT 0,
      summary TEXT,
      ai_strategy_used TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      detected_language TEXT,
      intent_type TEXT,
      related_word_ids TEXT,
      related_sentence_ids TEXT,
      detected_error_ids TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS learning_blocks (
      id INTEGER PRIMARY KEY,
      session_id INTEGER,
      study_day TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER DEFAULT 0,
      summary TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS learning_events (
      id INTEGER PRIMARY KEY,
      session_id INTEGER,
      block_id INTEGER,
      event_type TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      result TEXT,
      score REAL,
      metadata TEXT,
      study_day TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
      FOREIGN KEY (block_id) REFERENCES learning_blocks(id)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      error TEXT,
      resource_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_request_logs (
      id INTEGER PRIMARY KEY,
      provider TEXT,
      model TEXT,
      prompt_type TEXT,
      global_prompt_version TEXT,
      mode_prompt_version TEXT,
      output_schema_version TEXT,
      input_tokens_estimate INTEGER,
      output_tokens_estimate INTEGER,
      latency_ms INTEGER,
      status TEXT,
      error_message TEXT,
      request_created_at TEXT NOT NULL,
      response_completed_at TEXT,
      related_session_id INTEGER,
      related_block_id INTEGER,
      related_message_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id INTEGER PRIMARY KEY,
      prompt_name TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
      ON chat_messages(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
      ON chat_messages(created_at);

    CREATE INDEX IF NOT EXISTS idx_learning_events_created_at
      ON learning_events(created_at);

    CREATE INDEX IF NOT EXISTS idx_learning_events_event_type_created_at
      ON learning_events(event_type, created_at);

    CREATE INDEX IF NOT EXISTS idx_learning_events_target
      ON learning_events(target_type, target_id);

    CREATE INDEX IF NOT EXISTS idx_learning_events_session_id
      ON learning_events(session_id);

    CREATE INDEX IF NOT EXISTS idx_learning_events_block_id
      ON learning_events(block_id);

    CREATE INDEX IF NOT EXISTS idx_learning_events_study_day
      ON learning_events(study_day);

    CREATE INDEX IF NOT EXISTS idx_jobs_status
      ON jobs(status);

    CREATE INDEX IF NOT EXISTS idx_jobs_resource_key
      ON jobs(resource_key);

    CREATE INDEX IF NOT EXISTS idx_ai_request_logs_created_at
      ON ai_request_logs(request_created_at);

    CREATE INDEX IF NOT EXISTS idx_prompt_versions_name_active
      ON prompt_versions(prompt_name, is_active);
  `
}
