import { BaseRepository } from './base'

export interface FileRecord {
  id: number
  filename: string
  original_path: string | null
  file_hash: string
  file_size: number | null
  file_type: string
  mime_type: string | null
  encoding: string | null
  status: string
  import_job_id: number | null
  metadata: string | null
  created_at: string
  updated_at: string
}

export interface FileChunk {
  id: number
  file_id: number
  chunk_index: number
  content: string
  content_type: string | null
  char_count: number | null
  word_count: number | null
  metadata: string | null
  created_at: string
}

export interface SourceLink {
  id: number
  source_type: string
  source_id: number
  target_type: string
  target_id: number
  relationship: string
  metadata: string | null
  created_at: string
}

export interface ImportCandidate {
  id: number
  file_id: number
  candidate_type: string
  content: string
  metadata: string | null
  status: string
  processed_at: string | null
  result_id: number | null
  created_at: string
  updated_at: string
}

export class FileRepository extends BaseRepository {
  // File record operations
  addFileRecord(record: Omit<FileRecord, 'id' | 'created_at' | 'updated_at'>): FileRecord {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO file_records (filename, original_path, file_hash, file_size, file_type, mime_type, encoding, status, import_job_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.filename, record.original_path, record.file_hash, record.file_size,
      record.file_type, record.mime_type, record.encoding, record.status || 'pending',
      record.import_job_id, record.metadata, now, now
    )
    return this.db.prepare('SELECT * FROM file_records WHERE id = ?').get(result.lastInsertRowid) as FileRecord
  }

  getFileRecord(id: number): FileRecord | null {
    return this.db.prepare('SELECT * FROM file_records WHERE id = ?').get(id) as FileRecord | null
  }

  getFileByHash(fileHash: string): FileRecord | null {
    return this.db.prepare('SELECT * FROM file_records WHERE file_hash = ?').get(fileHash) as FileRecord | null
  }

  getFileRecords(limit = 50, offset = 0): FileRecord[] {
    return this.db.prepare('SELECT * FROM file_records ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset) as FileRecord[]
  }

  getFileRecordsByStatus(status: string, limit = 50): FileRecord[] {
    return this.db.prepare('SELECT * FROM file_records WHERE status = ? ORDER BY id DESC LIMIT ?').all(status, limit) as FileRecord[]
  }

  getFileRecordsByType(fileType: string, limit = 50): FileRecord[] {
    return this.db.prepare('SELECT * FROM file_records WHERE file_type = ? ORDER BY id DESC LIMIT ?').all(fileType, limit) as FileRecord[]
  }

  updateFileRecord(id: number, updates: Partial<FileRecord>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(id)

    this.db.prepare(
      `UPDATE file_records SET ${setClause}, updated_at = ? WHERE id = ?`
    ).run(...values)
  }

  // File chunk operations
  addFileChunk(chunk: Omit<FileChunk, 'id' | 'created_at'>): FileChunk {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO file_chunks (file_id, chunk_index, content, content_type, char_count, word_count, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      chunk.file_id, chunk.chunk_index, chunk.content, chunk.content_type,
      chunk.char_count, chunk.word_count, chunk.metadata, now
    )
    return this.db.prepare('SELECT * FROM file_chunks WHERE id = ?').get(result.lastInsertRowid) as FileChunk
  }

  getFileChunks(fileId: number): FileChunk[] {
    return this.db.prepare(
      'SELECT * FROM file_chunks WHERE file_id = ? ORDER BY chunk_index'
    ).all(fileId) as FileChunk[]
  }

  getFileChunk(fileId: number, chunkIndex: number): FileChunk | null {
    return this.db.prepare(
      'SELECT * FROM file_chunks WHERE file_id = ? AND chunk_index = ?'
    ).get(fileId, chunkIndex) as FileChunk | null
  }

  deleteFileChunks(fileId: number): void {
    this.db.prepare('DELETE FROM file_chunks WHERE file_id = ?').run(fileId)
  }

  // Source link operations
  addSourceLink(link: Omit<SourceLink, 'id' | 'created_at'>): SourceLink {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO source_links (source_type, source_id, target_type, target_id, relationship, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      link.source_type, link.source_id, link.target_type, link.target_id,
      link.relationship || 'derived_from', link.metadata, now
    )
    return this.db.prepare('SELECT * FROM source_links WHERE id = ?').get(result.lastInsertRowid) as SourceLink
  }

  getSourceLinksBySource(sourceType: string, sourceId: number): SourceLink[] {
    return this.db.prepare(
      'SELECT * FROM source_links WHERE source_type = ? AND source_id = ?'
    ).all(sourceType, sourceId) as SourceLink[]
  }

  getSourceLinksByTarget(targetType: string, targetId: number): SourceLink[] {
    return this.db.prepare(
      'SELECT * FROM source_links WHERE target_type = ? AND target_id = ?'
    ).all(targetType, targetId) as SourceLink[]
  }

  deleteSourceLink(id: number): void {
    this.db.prepare('DELETE FROM source_links WHERE id = ?').run(id)
  }

  // Import candidate operations
  addImportCandidate(candidate: Omit<ImportCandidate, 'id' | 'created_at' | 'updated_at'>): ImportCandidate {
    const now = this.now()
    const result = this.db.prepare(
      `INSERT INTO import_candidates (file_id, candidate_type, content, metadata, status, processed_at, result_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      candidate.file_id, candidate.candidate_type, candidate.content,
      candidate.metadata, candidate.status || 'pending', candidate.processed_at,
      candidate.result_id, now, now
    )
    return this.db.prepare('SELECT * FROM import_candidates WHERE id = ?').get(result.lastInsertRowid) as ImportCandidate
  }

  getImportCandidate(id: number): ImportCandidate | null {
    return this.db.prepare('SELECT * FROM import_candidates WHERE id = ?').get(id) as ImportCandidate | null
  }

  getImportCandidatesByFile(fileId: number): ImportCandidate[] {
    return this.db.prepare(
      'SELECT * FROM import_candidates WHERE file_id = ? ORDER BY id'
    ).all(fileId) as ImportCandidate[]
  }

  getPendingImportCandidates(limit = 100): ImportCandidate[] {
    return this.db.prepare(
      "SELECT * FROM import_candidates WHERE status = 'pending' ORDER BY id LIMIT ?"
    ).all(limit) as ImportCandidate[]
  }

  updateImportCandidate(id: number, updates: Partial<ImportCandidate>): void {
    const now = this.now()
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now)
    values.push(id)

    this.db.prepare(
      `UPDATE import_candidates SET ${setClause}, updated_at = ? WHERE id = ?`
    ).run(...values)
  }

  // Stats
  getFileCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM file_records').get() as { count: number }
    return result.count
  }

  getChunkCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM file_chunks').get() as { count: number }
    return result.count
  }

  getCandidateStats(): { total: number; byStatus: Record<string, number>; byType: Record<string, number> } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM import_candidates').get() as { count: number }).count
    const statusRows = this.db.prepare(
      'SELECT status, COUNT(*) as count FROM import_candidates GROUP BY status'
    ).all() as Array<{ status: string; count: number }>
    const typeRows = this.db.prepare(
      'SELECT candidate_type, COUNT(*) as count FROM import_candidates GROUP BY candidate_type'
    ).all() as Array<{ candidate_type: string; count: number }>

    const byStatus: Record<string, number> = {}
    for (const row of statusRows) {
      byStatus[row.status] = row.count
    }

    const byType: Record<string, number> = {}
    for (const row of typeRows) {
      byType[row.candidate_type] = row.count
    }

    return { total, byStatus, byType }
  }
}
