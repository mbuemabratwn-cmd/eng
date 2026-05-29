import { SummaryRepository, AiMemorySummary } from '../repositories/summary.repository'

export interface AddMemoryInput {
  memoryType: string
  category?: string
  content: string
  confidence?: number
  evidenceEventIds?: number[]
  sourceType?: string
  sourceId?: number
}

export interface UpdateMemoryInput {
  content?: string
  confidence?: number
  evidenceEventIds?: number[]
  status?: string
}

export interface MemoryWithEvidence {
  memory: AiMemorySummary
  evidenceCount: number
  daysSinceFirstObservation: number
  daysSinceLastObservation: number
}

export class MemoryEngine {
  private readonly CONFIDENCE_THRESHOLD = 0.3
  private readonly MAX_EVIDENCE_IDS = 20

  constructor(private summaryRepo: SummaryRepository) {}

  addMemory(input: AddMemoryInput): AiMemorySummary {
    const now = new Date().toISOString()

    // Check if similar memory already exists
    const existing = this.summaryRepo.findExistingMemory(
      input.memoryType,
      input.category || null,
      input.content
    )

    if (existing) {
      // Update existing memory with new evidence
      this.updateMemoryEvidence(existing.id, input.evidenceEventIds)
      return this.summaryRepo.getMemorySummary(existing.id)!
    }

    // Create new memory
    return this.summaryRepo.addMemorySummary({
      memory_type: input.memoryType,
      category: input.category || null,
      content: input.content,
      confidence: this.calculateInitialConfidence(input),
      evidence_event_ids: input.evidenceEventIds ? JSON.stringify(input.evidenceEventIds) : null,
      source_type: input.sourceType || null,
      source_id: input.sourceId || null,
      status: 'active',
      first_observed_at: now,
      last_observed_at: now,
      observation_count: 1
    })
  }

  updateMemory(id: number, input: UpdateMemoryInput): AiMemorySummary | null {
    const existing = this.summaryRepo.getMemorySummary(id)
    if (!existing) return null

    const updates: Partial<AiMemorySummary> = {}

    if (input.content !== undefined) updates.content = input.content
    if (input.confidence !== undefined) updates.confidence = input.confidence
    if (input.status !== undefined) updates.status = input.status
    if (input.evidenceEventIds) {
      updates.evidence_event_ids = this.mergeEvidenceIds(
        existing.evidence_event_ids,
        input.evidenceEventIds
      )
    }

    this.summaryRepo.updateMemorySummary(id, updates)
    return this.summaryRepo.getMemorySummary(id)!
  }

  getMemory(id: number): AiMemorySummary | null {
    return this.summaryRepo.getMemorySummary(id)
  }

  getActiveMemories(limit = 100): AiMemorySummary[] {
    return this.summaryRepo.getActiveMemories(limit)
  }

  getMemoriesByType(memoryType: string, limit = 50): AiMemorySummary[] {
    return this.summaryRepo.getMemoriesByType(memoryType, limit)
  }

  getMemoriesByCategory(category: string, limit = 50): AiMemorySummary[] {
    return this.summaryRepo.getMemoriesByCategory(category, limit)
  }

  getMemoryWithEvidence(id: number): MemoryWithEvidence | null {
    const memory = this.summaryRepo.getMemorySummary(id)
    if (!memory) return null

    const now = new Date()
    const firstObserved = new Date(memory.first_observed_at)
    const lastObserved = new Date(memory.last_observed_at)

    return {
      memory,
      evidenceCount: memory.evidence_event_ids ? JSON.parse(memory.evidence_event_ids).length : 0,
      daysSinceFirstObservation: Math.floor((now.getTime() - firstObserved.getTime()) / (1000 * 60 * 60 * 24)),
      daysSinceLastObservation: Math.floor((now.getTime() - lastObserved.getTime()) / (1000 * 60 * 60 * 24))
    }
  }

  archiveMemory(id: number): void {
    this.summaryRepo.archiveMemory(id)
  }

  getStats() {
    return this.summaryRepo.getSummaryStats()
  }

  private calculateInitialConfidence(input: AddMemoryInput): number {
    let confidence = input.confidence || 0.5

    // Adjust confidence based on evidence
    if (input.evidenceEventIds && input.evidenceEventIds.length > 0) {
      // More evidence = higher confidence
      confidence = Math.min(0.9, confidence + (input.evidenceEventIds.length * 0.1))
    }

    // Ensure confidence is within bounds
    return Math.max(this.CONFIDENCE_THRESHOLD, Math.min(0.9, confidence))
  }

  private updateMemoryEvidence(memoryId: number, newEvidenceIds?: number[]): void {
    if (!newEvidenceIds || newEvidenceIds.length === 0) return

    const existing = this.summaryRepo.getMemorySummary(memoryId)
    if (!existing) return

    const mergedIds = this.mergeEvidenceIds(existing.evidence_event_ids, newEvidenceIds)
    this.summaryRepo.incrementObservation(memoryId, mergedIds)
  }

  private mergeEvidenceIds(existingIds: string | null, newIds: number[]): string {
    let existing: number[] = []
    if (existingIds) {
      try {
        existing = JSON.parse(existingIds) as number[]
      } catch {
        existing = []
      }
    }

    // Merge and deduplicate
    const merged = [...new Set([...existing, ...newIds])]

    // Limit to MAX_EVIDENCE_IDS
    const limited = merged.slice(-this.MAX_EVIDENCE_IDS)

    return JSON.stringify(limited)
  }
}
