import { LongSentenceRepository, LongSentence, LongSentenceAnalysis, UserSentenceProgress, SentenceWeaknessCandidate } from '../repositories/long-sentence.repository'
import { FSRSScheduler, FSRSState, FSRSGrade } from './fsrs-scheduler'

export interface AddSentenceInput {
  sentence: string
  translation?: string
  source?: string
  difficultyLevel?: number
  createdByAi?: boolean
  aiModel?: string
  topic?: string
  grammarPoints?: string[]
}

export interface AddAnalysisInput {
  sentenceId: number
  analysisType: string
  content: string
  orderIndex?: number
}

export interface RecordGuessInput {
  sentenceId: number
  userGuess: string
  isCorrect: boolean
  scores?: {
    comprehension?: number
    structure?: number
    vocabulary?: number
    grammar?: number
  }
}

export interface WeaknessCandidateInput {
  sentenceId: number
  weaknessType: 'vocabulary' | 'grammar'
  referenceText?: string
  vocabularyWord?: string
  grammarPoint?: string
  severity?: number
  evidenceEventIds?: number[]
}

export interface SentenceWithAnalysis {
  sentence: LongSentence
  analyses: LongSentenceAnalysis[]
  progress: UserSentenceProgress | null
}

export interface SentencePracticeState {
  currentSentence: SentenceWithAnalysis | null
  currentIndex: number
  completedCount: number
  totalCount: number
  isActive: boolean
}

export class SentenceEngine {
  private state: SentencePracticeState = {
    currentSentence: null,
    currentIndex: 0,
    completedCount: 0,
    totalCount: 0,
    isActive: false
  }
  private fsrs: FSRSScheduler

  constructor(private sentenceRepo: LongSentenceRepository) {
    this.fsrs = new FSRSScheduler()
  }

  addSentence(input: AddSentenceInput): LongSentence {
    return this.sentenceRepo.addSentence({
      sentence: input.sentence,
      translation: input.translation || null,
      source: input.source || null,
      difficulty_level: input.difficultyLevel || 1,
      created_by_ai: input.createdByAi ? 1 : 0,
      ai_model: input.aiModel || null,
      topic: input.topic || null,
      grammar_points: input.grammarPoints ? JSON.stringify(input.grammarPoints) : null
    })
  }

  addAISentence(input: AddSentenceInput, aiModel: string): LongSentence {
    return this.addSentence({
      ...input,
      createdByAi: true,
      aiModel
    })
  }

  addAnalysis(input: AddAnalysisInput): LongSentenceAnalysis {
    return this.sentenceRepo.addAnalysis({
      sentence_id: input.sentenceId,
      analysis_type: input.analysisType,
      content: input.content,
      order_index: input.orderIndex || 0
    })
  }

  getSentenceWithAnalysis(sentenceId: number): SentenceWithAnalysis | null {
    const sentence = this.sentenceRepo.getSentence(sentenceId)
    if (!sentence) return null

    return {
      sentence,
      analyses: this.sentenceRepo.getAnalysesBySentence(sentenceId),
      progress: this.sentenceRepo.getProgress(sentenceId)
    }
  }

  startPractice(difficultyLevel?: number, topic?: string): SentencePracticeState {
    let sentences: LongSentence[]

    if (difficultyLevel) {
      sentences = this.sentenceRepo.getSentencesByDifficulty(difficultyLevel, 20)
    } else if (topic) {
      sentences = this.sentenceRepo.getSentencesByTopic(topic, 20)
    } else {
      sentences = this.sentenceRepo.getSentences(20)
    }

    if (sentences.length === 0) {
      this.state = {
        currentSentence: null,
        currentIndex: 0,
        completedCount: 0,
        totalCount: 0,
        isActive: false
      }
      return this.state
    }

    const firstSentence = this.getSentenceWithAnalysis(sentences[0].id)

    this.state = {
      currentSentence: firstSentence,
      currentIndex: 0,
      completedCount: 0,
      totalCount: sentences.length,
      isActive: true
    }

    return this.state
  }

  getCurrentSentence(): SentenceWithAnalysis | null {
    return this.state.currentSentence
  }

  recordGuess(input: RecordGuessInput): SentenceWeaknessCandidate[] {
    const progress = this.sentenceRepo.getProgress(input.sentenceId)
    if (!progress) {
      this.sentenceRepo.createProgress(input.sentenceId, 'learning')
    }

    const currentProgress = this.sentenceRepo.getProgress(input.sentenceId)!
    const now = new Date()

    // Calculate scores
    const guessScore = input.isCorrect ? 1.0 : 0.0
    const comprehensionScore = input.scores?.comprehension ?? guessScore
    const structureScore = input.scores?.structure ?? guessScore
    const vocabularyScore = input.scores?.vocabulary ?? guessScore
    const grammarScore = input.scores?.grammar ?? guessScore

    // Update progress with exponential moving average
    const alpha = 0.3
    const newComprehension = (currentProgress.comprehension_score || 0) * (1 - alpha) + comprehensionScore * alpha
    const newStructure = (currentProgress.structure_score || 0) * (1 - alpha) + structureScore * alpha
    const newVocabulary = (currentProgress.vocabulary_score || 0) * (1 - alpha) + vocabularyScore * alpha
    const newGrammar = (currentProgress.grammar_score || 0) * (1 - alpha) + grammarScore * alpha

    // FSRS scheduling
    const grade: FSRSGrade = FSRSScheduler.qualityToGrade(guessScore, input.isCorrect)
    const fsrsItem = {
      difficulty: currentProgress.fsrs_difficulty || 0,
      stability: currentProgress.fsrs_stability || 0,
      retrievability: currentProgress.fsrs_retrievability || 1,
      state: (currentProgress.fsrs_state || 0) as FSRSState,
      elapsedDays: currentProgress.fsrs_elapsed_days || 0,
      scheduledDays: currentProgress.interval_days || 0,
      lastReviewAt: currentProgress.fsrs_last_review_at ? new Date(currentProgress.fsrs_last_review_at) : null
    }

    const fsrsResult = this.fsrs.schedule(fsrsItem, grade, now)

    // Determine status
    const avgScore = (newComprehension + newStructure + newVocabulary + newGrammar) / 4
    let status = currentProgress.status
    if (avgScore >= 0.9 && currentProgress.attempt_count >= 3) {
      status = 'mastered'
    } else if (avgScore >= 0.6) {
      status = 'familiar'
    } else if (avgScore < 0.3 && currentProgress.attempt_count >= 2) {
      status = 'weak'
    } else if (status === 'new') {
      status = 'learning'
    }

    // Keep SM-2 ease_factor for backwards compatibility
    const easeFactor = Math.max(1.3, currentProgress.ease_factor + (input.isCorrect ? 0.1 : -0.2))

    this.sentenceRepo.updateProgress(input.sentenceId, {
      status,
      user_guess: input.userGuess,
      guess_score: guessScore,
      comprehension_score: newComprehension,
      structure_score: newStructure,
      vocabulary_score: newVocabulary,
      grammar_score: newGrammar,
      attempt_count: (currentProgress.attempt_count || 0) + 1,
      correct_count: (currentProgress.correct_count || 0) + (input.isCorrect ? 1 : 0),
      last_attempt_at: now.toISOString(),
      next_review_at: fsrsResult.nextReviewAt.toISOString(),
      interval_days: fsrsResult.scheduledDays,
      ease_factor: easeFactor,
      fsrs_difficulty: fsrsResult.difficulty,
      fsrs_stability: fsrsResult.stability,
      fsrs_retrievability: fsrsResult.retrievability,
      fsrs_state: fsrsResult.state,
      fsrs_last_review_at: now.toISOString(),
      fsrs_elapsed_days: 0
    })

    // Emit weakness candidates if not correct
    const candidates: SentenceWeaknessCandidate[] = []
    if (!input.isCorrect) {
      if (vocabularyScore < 0.5) {
        const candidate = this.emitWeaknessCandidate({
          sentenceId: input.sentenceId,
          weaknessType: 'vocabulary',
          referenceText: input.userGuess,
          severity: 1 - vocabularyScore
        })
        candidates.push(candidate)
      }

      if (grammarScore < 0.5) {
        const candidate = this.emitWeaknessCandidate({
          sentenceId: input.sentenceId,
          weaknessType: 'grammar',
          referenceText: input.userGuess,
          severity: 1 - grammarScore
        })
        candidates.push(candidate)
      }
    }

    // Move to next sentence
    this.state.completedCount++
    this.state.currentIndex++
    this.moveToNextSentence()

    return candidates
  }

  emitWeaknessCandidate(input: WeaknessCandidateInput): SentenceWeaknessCandidate {
    return this.sentenceRepo.addWeaknessCandidate({
      sentence_id: input.sentenceId,
      weakness_type: input.weaknessType,
      reference_text: input.referenceText || null,
      vocabulary_word: input.vocabularyWord || null,
      grammar_point: input.grammarPoint || null,
      severity: input.severity || 0.5,
      evidence_event_ids: input.evidenceEventIds ? JSON.stringify(input.evidenceEventIds) : null,
      status: 'pending'
    })
  }

  getPendingWeaknessCandidates(): SentenceWeaknessCandidate[] {
    return this.sentenceRepo.getPendingWeaknessCandidates()
  }

  markWeaknessCandidateProcessed(id: number): void {
    this.sentenceRepo.updateWeaknessCandidateStatus(id, 'processed')
  }

  endPractice(): void {
    this.state = {
      currentSentence: null,
      currentIndex: 0,
      completedCount: 0,
      totalCount: 0,
      isActive: false
    }
  }

  getPracticeState(): SentencePracticeState {
    return { ...this.state }
  }

  getDueReviewSentences(limit = 50): Array<{ sentence: LongSentence; progress: UserSentenceProgress }> {
    const now = new Date().toISOString()
    const dueProgressList = this.sentenceRepo.getDueReviewSentences(now, limit)
    const result: Array<{ sentence: LongSentence; progress: UserSentenceProgress }> = []

    for (const progress of dueProgressList) {
      const sentence = this.sentenceRepo.getSentence(progress.sentence_id)
      if (sentence) {
        result.push({ sentence, progress })
      }
    }

    return result
  }

  getWeakSentences(limit = 50): Array<{ sentence: LongSentence; progress: UserSentenceProgress }> {
    const weakProgressList = this.sentenceRepo.getWeakSentences(limit)
    const result: Array<{ sentence: LongSentence; progress: UserSentenceProgress }> = []

    for (const progress of weakProgressList) {
      const sentence = this.sentenceRepo.getSentence(progress.sentence_id)
      if (sentence) {
        result.push({ sentence, progress })
      }
    }

    return result
  }

  getStats() {
    return {
      sentenceCount: this.sentenceRepo.getSentenceCount(),
      progressStats: this.sentenceRepo.getProgressStats()
    }
  }

  private moveToNextSentence(): void {
    const sentences = this.sentenceRepo.getSentences(this.state.totalCount)
    if (this.state.currentIndex >= sentences.length) {
      this.state.currentSentence = null
      this.state.isActive = false
      return
    }

    const nextSentence = sentences[this.state.currentIndex]
    this.state.currentSentence = this.getSentenceWithAnalysis(nextSentence.id)
  }
}
