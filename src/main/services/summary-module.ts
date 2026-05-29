import { SummaryRepository, DailySummary, WeeklyReview, BlockSummary } from '../repositories/summary.repository'
import { VocabularyEngine } from './vocabulary-engine'
import { SentenceEngine } from './sentence-engine'
import { GrammarEngine } from './grammar-engine'
import { LearningStateManager } from './learning-state-manager'

export interface CreateDailySummaryInput {
  studyDay?: string
  content: string
  keyPoints?: string[]
  recommendations?: string[]
}

export interface CreateWeeklyReviewInput {
  weekStart: string
  weekEnd: string
  summary: string
  strengths?: string[]
  weaknesses?: string[]
  recommendations?: string[]
  overallScore?: number
}

export interface CreateBlockSummaryInput {
  blockId: number
  summary: string
  activities?: string[]
  vocabularyLearned?: number
  sentencesPracticed?: number
  grammarErrors?: number
  durationMinutes?: number
}

export interface DailySummaryWithStats {
  summary: DailySummary
  stats: {
    vocabulary: { wordCount: number; progressStats: { total: number; byStatus: Record<string, number> } }
    grammar: { errorCount: number; seriousErrorCount: number }
    sentences: { sentenceCount: number; progressStats: { total: number; byStatus: Record<string, number> } }
  }
}

export class SummaryModule {
  constructor(
    private summaryRepo: SummaryRepository,
    private vocabEngine: VocabularyEngine,
    private sentenceEngine: SentenceEngine,
    private grammarEngine: GrammarEngine,
    private stateManager: LearningStateManager
  ) {}

  createDailySummary(input: CreateDailySummaryInput): DailySummary {
    const studyDay = input.studyDay || this.stateManager.getState().study_day

    // Gather stats from all engines
    const vocabStats = this.vocabEngine.getStats()
    const sentenceStats = this.sentenceEngine.getStats()
    const grammarStats = this.grammarEngine.getStats()

    const summary = {
      study_day: studyDay,
      summary_type: 'daily',
      content: input.content,
      key_points: input.keyPoints ? JSON.stringify(input.keyPoints) : null,
      learning_stats: JSON.stringify({
        vocabulary: vocabStats,
        sentences: sentenceStats,
        grammar: grammarStats
      }),
      vocabulary_progress: JSON.stringify(vocabStats.progressStats),
      grammar_progress: JSON.stringify({
        errorCount: grammarStats.errorCount,
        seriousErrorCount: grammarStats.seriousErrorCount
      }),
      sentence_progress: JSON.stringify(sentenceStats.progressStats),
      recommendations: input.recommendations ? JSON.stringify(input.recommendations) : null
    }

    const existing = this.summaryRepo.getDailySummary(studyDay)
    if (existing) {
      this.summaryRepo.updateDailySummary(existing.id, summary)
      return this.summaryRepo.getDailySummaryById(existing.id)!
    }

    return this.summaryRepo.createDailySummary(summary)
  }

  getDailySummary(studyDay?: string): DailySummary | null {
    const day = studyDay || this.stateManager.getState().study_day
    return this.summaryRepo.getDailySummary(day)
  }

  getDailySummaryWithStats(studyDay?: string): DailySummaryWithStats | null {
    const summary = this.getDailySummary(studyDay)
    if (!summary) return null

    return {
      summary,
      stats: {
        vocabulary: this.vocabEngine.getStats(),
        grammar: this.grammarEngine.getStats(),
        sentences: this.sentenceEngine.getStats()
      }
    }
  }

  getRecentDailySummaries(limit = 7): DailySummary[] {
    return this.summaryRepo.getRecentDailySummaries(limit)
  }

  createWeeklyReview(input: CreateWeeklyReviewInput): WeeklyReview {
    // Gather stats from all engines
    const vocabStats = this.vocabEngine.getStats()
    const sentenceStats = this.sentenceEngine.getStats()
    const grammarStats = this.grammarEngine.getStats()

    return this.summaryRepo.createWeeklyReview({
      week_start: input.weekStart,
      week_end: input.weekEnd,
      summary: input.summary,
      strengths: input.strengths ? JSON.stringify(input.strengths) : null,
      weaknesses: input.weaknesses ? JSON.stringify(input.weaknesses) : null,
      recommendations: input.recommendations ? JSON.stringify(input.recommendations) : null,
      vocabulary_stats: JSON.stringify(vocabStats),
      grammar_stats: JSON.stringify(grammarStats),
      sentence_stats: JSON.stringify(sentenceStats),
      overall_score: input.overallScore || null
    })
  }

  getWeeklyReview(weekStart: string): WeeklyReview | null {
    return this.summaryRepo.getWeeklyReview(weekStart)
  }

  getRecentWeeklyReviews(limit = 4): WeeklyReview[] {
    return this.summaryRepo.getRecentWeeklyReviews(limit)
  }

  createBlockSummary(input: CreateBlockSummaryInput): BlockSummary {
    return this.summaryRepo.createBlockSummary({
      block_id: input.blockId,
      summary: input.summary,
      activities: input.activities ? JSON.stringify(input.activities) : null,
      vocabulary_learned: input.vocabularyLearned || 0,
      sentences_practiced: input.sentencesPracticed || 0,
      grammar_errors: input.grammarErrors || 0,
      duration_minutes: input.durationMinutes || null
    })
  }

  getBlockSummary(blockId: number): BlockSummary | null {
    return this.summaryRepo.getBlockSummary(blockId)
  }

  getRecentBlockSummaries(limit = 10): BlockSummary[] {
    return this.summaryRepo.getRecentBlockSummaries(limit)
  }

  getStats() {
    return this.summaryRepo.getSummaryStats()
  }
}
