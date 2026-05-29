import { FileRepository, FileRecord, FileChunk, ImportCandidate } from '../repositories/file.repository'
import { JobQueue } from './job-queue'
import { VocabularyEngine } from './vocabulary-engine'
import { createHash } from 'crypto'

// Dynamic imports for pdf-parse and mammoth
let pdfParseModule: any = null
let mammothModule: any = null

export interface IngestFileInput {
  filename: string
  content: string
  filePath?: string
  fileType?: string
  mimeType?: string
  encoding?: string
}

export interface IngestFileResult {
  fileRecord: FileRecord
  chunks: FileChunk[]
  importCandidates: ImportCandidate[]
  jobId: number | null
  skipped: boolean
  reason?: string
}

export interface ChunkConfig {
  maxChunkSize: number
  overlapSize: number
  splitBy: 'paragraph' | 'line' | 'sentence' | 'fixed'
}

const SUPPORTED_FILE_TYPES = ['txt', 'csv', 'md', 'markdown', 'text', 'pdf', 'docx']
const UNSUPPORTED_FILE_TYPES = ['xlsx', 'doc', 'xls', 'pptx', 'ppt']

const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxChunkSize: 1000,
  overlapSize: 100,
  splitBy: 'paragraph'
}

export interface ProcessImportResult {
  fileId: number
  total: number
  imported: number
  skipped: number
  failed: number
  errors: Array<{ word: string; error: string }>
}

export class FileIngestionEngine {
  constructor(
    private fileRepo: FileRepository,
    private jobQueue: JobQueue,
    private vocabEngine?: VocabularyEngine
  ) {}

  async ingestFile(input: IngestFileInput, chunkConfig?: Partial<ChunkConfig>): Promise<IngestFileResult> {
    const fileType = this.detectFileType(input.filename, input.fileType)
    const fileHash = this.calculateHash(input.content)

    // Check for duplicate
    const existing = this.fileRepo.getFileByHash(fileHash)
    if (existing) {
      return {
        fileRecord: existing,
        chunks: this.fileRepo.getFileChunks(existing.id),
        importCandidates: this.fileRepo.getImportCandidatesByFile(existing.id),
        jobId: null,
        skipped: true,
        reason: '文件已导入（重复哈希）'
      }
    }

    // Check if file type is supported
    if (UNSUPPORTED_FILE_TYPES.includes(fileType)) {
      const fileRecord = this.fileRepo.addFileRecord({
        filename: input.filename,
        original_path: input.filePath || null,
        file_hash: fileHash,
        file_size: input.content.length,
        file_type: fileType,
        mime_type: input.mimeType || null,
        encoding: input.encoding || 'utf-8',
        status: 'unsupported',
        import_job_id: null,
        metadata: JSON.stringify({ reason: '文件类型暂不支持' })
      })

      return {
        fileRecord,
        chunks: [],
        importCandidates: [],
        jobId: null,
        skipped: true,
        reason: `文件类型 '${fileType}' 暂不支持`
      }
    }

    // Parse file content based on type
    let parsedContent = input.content
    if (fileType === 'pdf') {
      parsedContent = await this.parsePdf(input.content)
    } else if (fileType === 'docx') {
      parsedContent = await this.parseDocx(input.content)
    }

    // Create file record
    const fileRecord = this.fileRepo.addFileRecord({
      filename: input.filename,
      original_path: input.filePath || null,
      file_hash: fileHash,
      file_size: parsedContent.length,
      file_type: fileType,
      mime_type: input.mimeType || null,
      encoding: input.encoding || 'utf-8',
      status: 'processing',
      import_job_id: null,
      metadata: null
    })

    // Chunk the file
    const config = { ...DEFAULT_CHUNK_CONFIG, ...chunkConfig }
    const chunks = this.chunkContent(fileRecord.id, parsedContent, fileType, config)

    // Create import candidates based on file type
    const importCandidates = this.createImportCandidates(fileRecord.id, parsedContent, fileType)

    // Create import job
    const job = this.jobQueue.enqueue(
      'file_import',
      JSON.stringify({
        fileId: fileRecord.id,
        filename: input.filename,
        fileType,
        chunkCount: chunks.length,
        candidateCount: importCandidates.length
      }),
      `file:${fileHash}`
    )

    // Update file record with job ID
    this.fileRepo.updateFileRecord(fileRecord.id, {
      import_job_id: job.id,
      status: 'queued'
    })

    return {
      fileRecord: this.fileRepo.getFileRecord(fileRecord.id)!,
      chunks,
      importCandidates,
      jobId: job.id,
      skipped: false
    }
  }

  getFileRecord(id: number): FileRecord | null {
    return this.fileRepo.getFileRecord(id)
  }

  getFileByHash(hash: string): FileRecord | null {
    return this.fileRepo.getFileByHash(hash)
  }

  getFileRecords(limit = 50, offset = 0): FileRecord[] {
    return this.fileRepo.getFileRecords(limit, offset)
  }

  getFileRecordsByStatus(status: string, limit = 50): FileRecord[] {
    return this.fileRepo.getFileRecordsByStatus(status, limit)
  }

  getFileRecordsByType(fileType: string, limit = 50): FileRecord[] {
    return this.fileRepo.getFileRecordsByType(fileType, limit)
  }

  getFileChunks(fileId: number): FileChunk[] {
    return this.fileRepo.getFileChunks(fileId)
  }

  getImportCandidates(fileId: number): ImportCandidate[] {
    return this.fileRepo.getImportCandidatesByFile(fileId)
  }

  getPendingImportCandidates(limit = 100): ImportCandidate[] {
    return this.fileRepo.getPendingImportCandidates(limit)
  }

  markCandidateProcessed(candidateId: number, resultId: number): void {
    const now = new Date().toISOString()
    this.fileRepo.updateImportCandidate(candidateId, {
      status: 'processed',
      processed_at: now,
      result_id: resultId
    })
  }

  markFileCompleted(fileId: number): void {
    this.fileRepo.updateFileRecord(fileId, { status: 'completed' })
  }

  markFileFailed(fileId: number, error: string): void {
    this.fileRepo.updateFileRecord(fileId, {
      status: 'failed',
      metadata: JSON.stringify({ error })
    })
  }

  getStats() {
    return {
      fileCount: this.fileRepo.getFileCount(),
      chunkCount: this.fileRepo.getChunkCount(),
      candidateStats: this.fileRepo.getCandidateStats()
    }
  }

  setVocabEngine(vocabEngine: VocabularyEngine): void {
    this.vocabEngine = vocabEngine
  }

  processImportCandidates(fileId: number): ProcessImportResult {
    if (!this.vocabEngine) {
      throw new Error('VocabularyEngine not set. Call setVocabEngine() first.')
    }

    const candidates = this.fileRepo.getImportCandidatesByFile(fileId)
      .filter(c => c.status === 'pending' && c.candidate_type === 'vocabulary')

    const result: ProcessImportResult = {
      fileId,
      total: candidates.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: []
    }

    for (const candidate of candidates) {
      try {
        const data = JSON.parse(candidate.content)
        const word = data.word?.trim()
        const meaning = data.chinese_meaning?.trim()

        if (!word || !meaning) {
          this.fileRepo.updateImportCandidate(candidate.id, {
            status: 'skipped',
            processed_at: new Date().toISOString(),
            result_id: null
          })
          result.skipped++
          continue
        }

        // Add word with progress (handles dedup internally)
        const { word: vocabWord, isNew } = this.vocabEngine.addWordWithProgress({
          word,
          chinese_meaning: meaning,
          phonetic: data.phonetic || undefined,
          part_of_speech: data.part_of_speech || undefined,
          english_meaning: data.english_meaning || undefined,
          source: `file:${fileId}`
        })

        if (!isNew) {
          this.fileRepo.updateImportCandidate(candidate.id, {
            status: 'skipped',
            processed_at: new Date().toISOString(),
            result_id: vocabWord.id
          })
          result.skipped++
          continue
        }

        this.fileRepo.updateImportCandidate(candidate.id, {
          status: 'processed',
          processed_at: new Date().toISOString(),
          result_id: vocabWord.id
        })
        result.imported++
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        this.fileRepo.updateImportCandidate(candidate.id, {
          status: 'failed',
          processed_at: new Date().toISOString(),
          result_id: null
        })
        result.failed++
        result.errors.push({
          word: candidate.content.substring(0, 50),
          error: errorMsg
        })
      }
    }

    // Mark file as completed
    this.fileRepo.updateFileRecord(fileId, { status: 'completed' })

    return result
  }

  private detectFileType(filename: string, explicitType?: string): string {
    if (explicitType) return explicitType.toLowerCase()

    const ext = filename.split('.').pop()?.toLowerCase()
    if (!ext) return 'unknown'

    if (SUPPORTED_FILE_TYPES.includes(ext)) return ext
    if (UNSUPPORTED_FILE_TYPES.includes(ext)) return ext
    if (ext === 'markdown') return 'md'
    if (ext === 'text') return 'txt'

    return ext
  }

  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  private chunkContent(fileId: number, content: string, fileType: string, config: ChunkConfig): FileChunk[] {
    const chunks: FileChunk[] = []
    let parts: string[] = []

    switch (config.splitBy) {
      case 'paragraph':
        parts = this.splitByParagraph(content)
        break
      case 'line':
        parts = this.splitByLine(content)
        break
      case 'sentence':
        parts = this.splitBySentence(content)
        break
      case 'fixed':
        parts = this.splitByFixedSize(content, config.maxChunkSize)
        break
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim()
      if (part.length === 0) continue

      const chunk = this.fileRepo.addFileChunk({
        file_id: fileId,
        chunk_index: i,
        content: part,
        content_type: this.detectContentType(part, fileType),
        char_count: part.length,
        word_count: this.countWords(part),
        metadata: null
      })
      chunks.push(chunk)
    }

    return chunks
  }

  private splitByParagraph(content: string): string[] {
    return content.split(/\n\s*\n/)
  }

  private splitByLine(content: string): string[] {
    return content.split('\n')
  }

  private splitBySentence(content: string): string[] {
    return content.split(/(?<=[.!?])\s+/)
  }

  private splitByFixedSize(content: string, maxSize: number): string[] {
    const parts: string[] = []
    let offset = 0

    while (offset < content.length) {
      let end = Math.min(offset + maxSize, content.length)

      // Try to break at a word boundary
      if (end < content.length) {
        const lastSpace = content.lastIndexOf(' ', end)
        if (lastSpace > offset) {
          end = lastSpace
        }
      }

      parts.push(content.substring(offset, end))
      offset = end
    }

    return parts
  }

  private detectContentType(content: string, fileType: string): string {
    if (fileType === 'csv') return 'tabular'
    if (fileType === 'md') return 'markdown'

    // Simple heuristic: if content looks like a list, mark as list
    if (/^\s*[-*]\s+/m.test(content)) return 'list'
    if (/^\s*\d+\.\s+/m.test(content)) return 'list'

    return 'text'
  }

  private countWords(content: string): number {
    // Simple word count: split by whitespace
    return content.split(/\s+/).filter(w => w.length > 0).length
  }

  private createImportCandidates(fileId: number, content: string, fileType: string): ImportCandidate[] {
    const candidates: ImportCandidate[] = []

    if (fileType === 'csv') {
      // Parse CSV for vocabulary import
      const vocabCandidates = this.parseCsvForVocabulary(fileId, content)
      candidates.push(...vocabCandidates)
    } else if (fileType === 'txt' || fileType === 'md') {
      // Create text content candidate
      candidates.push(this.fileRepo.addImportCandidate({
        file_id: fileId,
        candidate_type: 'text_content',
        content,
        metadata: JSON.stringify({ fileType }),
        status: 'pending',
        processed_at: null,
        result_id: null
      }))
    }

    return candidates
  }

  private parseCsvForVocabulary(fileId: number, content: string): ImportCandidate[] {
    const candidates: ImportCandidate[] = []
    const lines = content.split('\n').filter(line => line.trim().length > 0)

    // Skip header if present
    const startIndex = this.hasHeader(lines) ? 1 : 0

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]
      const fields = this.parseCsvLine(line)

      if (fields.length >= 2) {
        const word = fields[0].trim()
        const meaning = fields[1].trim()

        if (word.length > 0 && meaning.length > 0) {
          candidates.push(this.fileRepo.addImportCandidate({
            file_id: fileId,
            candidate_type: 'vocabulary',
            content: JSON.stringify({
              word,
              chinese_meaning: meaning,
              phonetic: fields[2]?.trim() || null,
              part_of_speech: fields[3]?.trim() || null,
              english_meaning: fields[4]?.trim() || null
            }),
            metadata: JSON.stringify({ lineIndex: i, rawLine: line }),
            status: 'pending',
            processed_at: null,
            result_id: null
          }))
        }
      }
    }

    return candidates
  }

  private hasHeader(lines: string[]): boolean {
    if (lines.length < 2) return false

    const firstLine = lines[0].toLowerCase()
    const headerKeywords = ['word', 'vocabulary', 'english', 'meaning', 'chinese', 'translation', '单词', '词汇', '中文', '释义']

    return headerKeywords.some(keyword => firstLine.includes(keyword))
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }

    fields.push(current)
    return fields
  }

  private async parsePdf(base64Content: string): Promise<string> {
    try {
      const pdfParse = require('pdf-parse')
      const buffer = Buffer.from(base64Content, 'base64')
      const data = await pdfParse(buffer)
      return data.text
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      throw new Error(`PDF 解析失败: ${error}`)
    }
  }

  private async parseDocx(base64Content: string): Promise<string> {
    try {
      const mammoth = require('mammoth')
      const buffer = Buffer.from(base64Content, 'base64')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      throw new Error(`DOCX 解析失败: ${error}`)
    }
  }
}
