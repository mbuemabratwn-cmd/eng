import { GrammarRepository, GrammarErrorEvent, GrammarIssueSummary, GrammarWeaknessCandidate } from '../repositories/grammar.repository'

export interface RecordErrorInput {
  sessionId?: number
  blockId?: number
  errorType: string
  errorText: string
  correction?: string
  contextSentence?: string
  severity?: 'minor' | 'moderate' | 'serious'
  aiFeedback?: string
}

export interface GrammarCorrectionResult {
  errorEvent: GrammarErrorEvent
  isSerious: boolean
  shouldInterrupt: boolean
  issueSummary: GrammarIssueSummary | null
  weaknessCandidate: GrammarWeaknessCandidate | null
}

export interface IssuePatternInput {
  issueType: string
  issuePattern: string
  exampleErrors?: string[]
  suggestedRule?: string
}

export class GrammarEngine {
  // Threshold for when to interrupt free chat for grammar errors
  private readonly SERIOUS_ERROR_THRESHOLD = 0.7
  private readonly MINOR_ERROR_SUMMARY_THRESHOLD = 3

  constructor(private grammarRepo: GrammarRepository) {}

  recordError(input: RecordErrorInput): GrammarCorrectionResult {
    const isSerious = input.severity === 'serious' || this.isSeriousError(input)
    const shouldInterrupt = isSerious

    // Record the error event
    const errorEvent = this.grammarRepo.addErrorEvent({
      session_id: input.sessionId || null,
      block_id: input.blockId || null,
      error_type: input.errorType,
      error_text: input.errorText,
      correction: input.correction || null,
      context_sentence: input.contextSentence || null,
      severity: input.severity || 'minor',
      is_serious: isSerious ? 1 : 0,
      user_acknowledged: 0,
      ai_feedback: input.aiFeedback || null
    })

    // Update or create issue summary
    const issueSummary = this.updateIssueSummary(input)

    // Emit weakness candidate if not serious (serious errors get immediate correction)
    let weaknessCandidate: GrammarWeaknessCandidate | null = null
    if (!isSerious && issueSummary && issueSummary.occurrence_count >= this.MINOR_ERROR_SUMMARY_THRESHOLD) {
      weaknessCandidate = this.emitWeaknessCandidate({
        errorEventId: errorEvent.id,
        issueSummaryId: issueSummary.id,
        weaknessType: 'grammar',
        referenceText: input.errorText,
        grammarPoint: input.errorType,
        severity: 0.5
      })
    }

    return {
      errorEvent,
      isSerious,
      shouldInterrupt,
      issueSummary,
      weaknessCandidate
    }
  }

  recordSeriousError(input: RecordErrorInput): GrammarCorrectionResult {
    return this.recordError({
      ...input,
      severity: 'serious'
    })
  }

  recordMinorError(input: RecordErrorInput): GrammarCorrectionResult {
    return this.recordError({
      ...input,
      severity: 'minor'
    })
  }

  acknowledgeError(errorId: number): void {
    this.grammarRepo.acknowledgeError(errorId)
  }

  getErrorEventsBySession(sessionId: number, limit = 50): GrammarErrorEvent[] {
    return this.grammarRepo.getErrorEventsBySession(sessionId, limit)
  }

  getSeriousErrors(limit = 50): GrammarErrorEvent[] {
    return this.grammarRepo.getSeriousErrors(limit)
  }

  getUnacknowledgedErrors(limit = 50): GrammarErrorEvent[] {
    return this.grammarRepo.getUnacknowledgedErrors(limit)
  }

  getActiveIssueSummaries(): GrammarIssueSummary[] {
    return this.grammarRepo.getActiveIssueSummaries()
  }

  getIssueSummariesByType(issueType: string): GrammarIssueSummary[] {
    return this.grammarRepo.getIssueSummariesByType(issueType)
  }

  createIssuePattern(input: IssuePatternInput): GrammarIssueSummary {
    const now = new Date().toISOString()
    const existing = this.grammarRepo.getIssueSummaryByPattern(input.issueType, input.issuePattern)

    if (existing) {
      this.grammarRepo.incrementIssueOccurrence(existing.id)
      return this.grammarRepo.getIssueSummary(existing.id)!
    }

    return this.grammarRepo.addIssueSummary({
      issue_type: input.issueType,
      issue_pattern: input.issuePattern,
      occurrence_count: 1,
      first_seen_at: now,
      last_seen_at: now,
      example_errors: input.exampleErrors ? JSON.stringify(input.exampleErrors) : null,
      suggested_rule: input.suggestedRule || null,
      status: 'active'
    })
  }

  getPendingWeaknessCandidates(): GrammarWeaknessCandidate[] {
    return this.grammarRepo.getPendingWeaknessCandidates()
  }

  markWeaknessCandidateProcessed(id: number): void {
    this.grammarRepo.updateWeaknessCandidateStatus(id, 'processed')
  }

  getStats() {
    return {
      errorCount: this.grammarRepo.getErrorCount(),
      seriousErrorCount: this.grammarRepo.getSeriousErrorCount(),
      issueSummaryStats: this.grammarRepo.getIssueSummaryStats()
    }
  }

  private isSeriousError(input: RecordErrorInput): boolean {
    // Serious errors: critical grammar mistakes that significantly affect meaning
    const seriousErrorTypes = [
      'subject_verb_disagreement',
      'tense_error',
      'article_error',
      'pronoun_error',
      'run_on_sentence',
      'sentence_fragment',
      'double_negative',
      'misplaced_modifier'
    ]

    return seriousErrorTypes.includes(input.errorType)
  }

  private updateIssueSummary(input: RecordErrorInput): GrammarIssueSummary | null {
    const now = new Date().toISOString()
    const existing = this.grammarRepo.getIssueSummaryByPattern(input.errorType, input.errorText)

    if (existing) {
      this.grammarRepo.incrementIssueOccurrence(existing.id)

      // Update example errors if we have fewer than 5
      if (existing.example_errors) {
        try {
          const examples = JSON.parse(existing.example_errors) as string[]
          if (examples.length < 5 && input.correction) {
            examples.push(input.correction)
            this.grammarRepo.updateIssueSummary(existing.id, {
              example_errors: JSON.stringify(examples)
            })
          }
        } catch {
          // Invalid JSON, update with new example
          if (input.correction) {
            this.grammarRepo.updateIssueSummary(existing.id, {
              example_errors: JSON.stringify([input.correction])
            })
          }
        }
      }

      return this.grammarRepo.getIssueSummary(existing.id)!
    }

    // Create new issue summary
    return this.grammarRepo.addIssueSummary({
      issue_type: input.errorType,
      issue_pattern: input.errorText,
      occurrence_count: 1,
      first_seen_at: now,
      last_seen_at: now,
      example_errors: input.correction ? JSON.stringify([input.correction]) : null,
      suggested_rule: null,
      status: 'active'
    })
  }

  private emitWeaknessCandidate(input: {
    errorEventId: number
    issueSummaryId: number
    weaknessType: string
    referenceText?: string
    grammarPoint?: string
    severity?: number
  }): GrammarWeaknessCandidate {
    return this.grammarRepo.addWeaknessCandidate({
      error_event_id: input.errorEventId,
      issue_summary_id: input.issueSummaryId,
      weakness_type: input.weaknessType,
      reference_text: input.referenceText || null,
      grammar_point: input.grammarPoint || null,
      severity: input.severity || 0.5,
      evidence_event_ids: JSON.stringify([input.errorEventId]),
      status: 'pending'
    })
  }
}
