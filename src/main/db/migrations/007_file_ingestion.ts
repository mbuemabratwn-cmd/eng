import { Migration } from './index'

export const migration007: Migration = {
  version: 7,
  name: 'file_ingestion',
  sql: `
    CREATE TABLE IF NOT EXISTS file_records (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      original_path TEXT,
      file_hash TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT NOT NULL,
      mime_type TEXT,
      encoding TEXT,
      status TEXT DEFAULT 'pending',
      import_job_id INTEGER,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_chunks (
      id INTEGER PRIMARY KEY,
      file_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT,
      char_count INTEGER,
      word_count INTEGER,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES file_records(id)
    );

    CREATE TABLE IF NOT EXISTS source_links (
      id INTEGER PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      relationship TEXT DEFAULT 'derived_from',
      metadata TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(source_type, source_id, target_type, target_id)
    );

    CREATE TABLE IF NOT EXISTS import_candidates (
      id INTEGER PRIMARY KEY,
      file_id INTEGER NOT NULL,
      candidate_type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      status TEXT DEFAULT 'pending',
      processed_at TEXT,
      result_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES file_records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_file_records_hash
      ON file_records(file_hash);

    CREATE INDEX IF NOT EXISTS idx_file_records_status
      ON file_records(status);

    CREATE INDEX IF NOT EXISTS idx_file_records_type
      ON file_records(file_type);

    CREATE INDEX IF NOT EXISTS idx_file_records_import_job
      ON file_records(import_job_id);

    CREATE INDEX IF NOT EXISTS idx_file_chunks_file
      ON file_chunks(file_id);

    CREATE INDEX IF NOT EXISTS idx_file_chunks_index
      ON file_chunks(file_id, chunk_index);

    CREATE INDEX IF NOT EXISTS idx_source_links_source
      ON source_links(source_type, source_id);

    CREATE INDEX IF NOT EXISTS idx_source_links_target
      ON source_links(target_type, target_id);

    CREATE INDEX IF NOT EXISTS idx_import_candidates_file
      ON import_candidates(file_id);

    CREATE INDEX IF NOT EXISTS idx_import_candidates_type
      ON import_candidates(candidate_type);

    CREATE INDEX IF NOT EXISTS idx_import_candidates_status
      ON import_candidates(status);
  `
}
