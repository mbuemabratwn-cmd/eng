import { VocabularyRepository, VocabularyWord, VocabularyAiNote, UserWordProgress, WordReviewEvent } from '../repositories/vocabulary.repository'
import { ParsedAction } from './structured-output-parser'
import { FSRSScheduler, FSRSState, FSRSGrade } from './fsrs-scheduler'

export interface AddWordInput {
  word: string
  phonetic?: string
  part_of_speech?: string
  chinese_meaning?: string
  english_meaning?: string
  difficulty_level?: number
  exam_tags?: string
  source?: string
}

export interface ImportWordsInput {
  words: AddWordInput[]
  skipDuplicates?: boolean
}

export interface ImportWordsResult {
  imported: number
  skipped: number
  errors: Array<{ word: string; error: string }>
}

export interface RecordReviewInput {
  wordId: number
  sessionId?: number
  blockId?: number
  mode?: string
  questionType?: string
  prompt?: string
  userAnswer?: string
  correctAnswer?: string
  isCorrect: boolean
  score?: number
  responseTimeMs?: number
  aiFeedback?: string
}

export interface WordProgressInfo {
  word: VocabularyWord
  progress: UserWordProgress | null
  aiNote: VocabularyAiNote | null
  recentReviews: WordReviewEvent[]
}

export interface ApplySuggestionResult {
  applied: boolean
  actionType: string
  message: string
}

export class VocabularyEngine {
  private fsrs: FSRSScheduler

  constructor(private vocabRepo: VocabularyRepository) {
    this.fsrs = new FSRSScheduler()
  }

  addWord(input: AddWordInput): VocabularyWord {
    const existing = this.vocabRepo.getWordByText(input.word)
    if (existing) {
      return existing
    }
    return this.vocabRepo.addWord({
      word: input.word,
      phonetic: input.phonetic || null,
      part_of_speech: input.part_of_speech || null,
      chinese_meaning: input.chinese_meaning || null,
      english_meaning: input.english_meaning || null,
      difficulty_level: input.difficulty_level || 1,
      exam_tags: input.exam_tags || null,
      source: input.source || null
    })
  }

  addWordWithProgress(input: AddWordInput): { word: VocabularyWord; isNew: boolean } {
    const existing = this.vocabRepo.getWordByText(input.word)
    if (existing) {
      return { word: existing, isNew: false }
    }
    const word = this.vocabRepo.addWord({
      word: input.word,
      phonetic: input.phonetic || null,
      part_of_speech: input.part_of_speech || null,
      chinese_meaning: input.chinese_meaning || null,
      english_meaning: input.english_meaning || null,
      difficulty_level: input.difficulty_level || 1,
      exam_tags: input.exam_tags || null,
      source: input.source || null
    })
    this.vocabRepo.createProgress(word.id, 'new')
    return { word, isNew: true }
  }

  getWordByText(word: string): VocabularyWord | null {
    return this.vocabRepo.getWordByText(word)
  }

  importWords(input: ImportWordsInput): ImportWordsResult {
    const skipDuplicates = input.skipDuplicates !== false
    const result: ImportWordsResult = { imported: 0, skipped: 0, errors: [] }

    for (const wordInput of input.words) {
      try {
        const existing = this.vocabRepo.getWordByText(wordInput.word)
        if (existing) {
          if (skipDuplicates) {
            result.skipped++
            continue
          }
          result.errors.push({ word: wordInput.word, error: '单词已存在' })
          continue
        }

        this.vocabRepo.addWord({
          word: wordInput.word,
          phonetic: wordInput.phonetic || null,
          part_of_speech: wordInput.part_of_speech || null,
          chinese_meaning: wordInput.chinese_meaning || null,
          english_meaning: wordInput.english_meaning || null,
          difficulty_level: wordInput.difficulty_level || 1,
          exam_tags: wordInput.exam_tags || null,
          source: wordInput.source || null
        })
        result.imported++
      } catch (err) {
        result.errors.push({
          word: wordInput.word,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    return result
  }

  getWordProgressInfo(wordId: number): WordProgressInfo | null {
    const word = this.vocabRepo.getWord(wordId)
    if (!word) return null

    return {
      word,
      progress: this.vocabRepo.getProgress(wordId),
      aiNote: this.vocabRepo.getAiNoteByWordId(wordId),
      recentReviews: this.vocabRepo.getReviewEventsByWord(wordId, 10)
    }
  }

  getWordProgressInfoByText(word: string): WordProgressInfo | null {
    const vocabWord = this.vocabRepo.getWordByText(word)
    if (!vocabWord) return null
    return this.getWordProgressInfo(vocabWord.id)
  }

  recordReview(input: RecordReviewInput): WordReviewEvent {
    // Ensure progress record exists
    let progress = this.vocabRepo.getProgress(input.wordId)
    if (!progress) {
      progress = this.vocabRepo.createProgress(input.wordId, 'learning')
    }

    // Record the review event
    const event = this.vocabRepo.recordReview({
      word_id: input.wordId,
      session_id: input.sessionId || null,
      block_id: input.blockId || null,
      mode: input.mode || null,
      question_type: input.questionType || null,
      prompt: input.prompt || null,
      user_answer: input.userAnswer || null,
      correct_answer: input.correctAnswer || null,
      is_correct: input.isCorrect ? 1 : 0,
      score: input.score ?? null,
      response_time_ms: input.responseTimeMs || null,
      ai_feedback: input.aiFeedback || null
    })

    // Update progress scores and SRS schedule
    this.updateProgressAfterReview(input.wordId, input.isCorrect, input.score)

    return event
  }

  applySuggestion(action: ParsedAction, validated: boolean): ApplySuggestionResult {
    if (!validated) {
      return {
        applied: false,
        actionType: action.type,
        message: '操作未通过 ActionValidator 验证 - 拒绝执行'
      }
    }

    switch (action.type) {
      case 'suggest_word_update':
        return this.applyWordUpdate(action)
      case 'create_weak_candidate':
        return this.applyWeakCandidate(action)
      case 'update_review_schedule':
        return this.applyReviewScheduleUpdate(action)
      default:
        return {
          applied: false,
          actionType: action.type,
          message: `未知操作类型: ${action.type}`
        }
    }
  }

  getDueReviewWords(limit = 50): Array<{ word: VocabularyWord; progress: UserWordProgress }> {
    const now = new Date().toISOString()
    const dueProgressList = this.vocabRepo.getDueReviewWords(now, limit)
    const result: Array<{ word: VocabularyWord; progress: UserWordProgress }> = []

    for (const progress of dueProgressList) {
      const word = this.vocabRepo.getWord(progress.word_id)
      if (word) {
        result.push({ word, progress })
      }
    }

    return result
  }

  getWeakWords(limit = 50): Array<{ word: VocabularyWord; progress: UserWordProgress }> {
    const weakProgressList = this.vocabRepo.getWeakWords(limit)
    const result: Array<{ word: VocabularyWord; progress: UserWordProgress }> = []

    for (const progress of weakProgressList) {
      const word = this.vocabRepo.getWord(progress.word_id)
      if (word) {
        result.push({ word, progress })
      }
    }

    return result
  }

  getStats() {
    return {
      wordCount: this.vocabRepo.getWordCount(),
      progressStats: this.vocabRepo.getProgressStats()
    }
  }

  private updateProgressAfterReview(wordId: number, isCorrect: boolean, score?: number): void {
    const progress = this.vocabRepo.getProgress(wordId)
    if (!progress) return

    const reviewScore = score ?? (isCorrect ? 1.0 : 0.0)
    const now = new Date()

    // Update counters
    const newCorrectCount = progress.correct_count + (isCorrect ? 1 : 0)
    const newMistakeCount = progress.mistake_count + (isCorrect ? 0 : 1)
    const newReviewCount = progress.review_count + 1

    // Update scores with exponential moving average (alpha = 0.3)
    const alpha = 0.3
    const newRecognitionScore = progress.recognition_score * (1 - alpha) + reviewScore * alpha
    const newRecallScore = progress.recall_score * (1 - alpha) + reviewScore * alpha
    const newContextScore = progress.context_score * (1 - alpha) + reviewScore * alpha
    const newUsageScore = progress.usage_score * (1 - alpha) + reviewScore * alpha

    // Mastery is weighted average of all scores
    const newMasteryScore = (
      newRecognitionScore * 0.25 +
      newRecallScore * 0.25 +
      newContextScore * 0.25 +
      newUsageScore * 0.25
    )

    // FSRS scheduling
    const grade: FSRSGrade = FSRSScheduler.qualityToGrade(reviewScore, isCorrect)
    const fsrsItem = {
      difficulty: progress.fsrs_difficulty || 0,
      stability: progress.fsrs_stability || 0,
      retrievability: progress.fsrs_retrievability || 1,
      state: (progress.fsrs_state || 0) as FSRSState,
      elapsedDays: progress.fsrs_elapsed_days || 0,
      scheduledDays: progress.interval_days || 0,
      lastReviewAt: progress.fsrs_last_review_at ? new Date(progress.fsrs_last_review_at) : null
    }

    const fsrsResult = this.fsrs.schedule(fsrsItem, grade, now)

    // Determine status based on mastery and FSRS state
    let status = progress.status
    if (newMasteryScore >= 0.9 && newReviewCount >= 5) {
      status = 'mastered'
    } else if (newMasteryScore >= 0.6) {
      status = 'familiar'
    } else if (newMasteryScore < 0.3 && newReviewCount >= 3) {
      status = 'weak'
    } else if (status === 'new') {
      status = 'learning'
    }

    // Keep SM-2 ease_factor for backwards compatibility
    const easeFactor = Math.max(1.3, progress.ease_factor + (isCorrect ? 0.1 : -0.2))

    this.vocabRepo.updateProgress(wordId, {
      status,
      mastery_score: newMasteryScore,
      recognition_score: newRecognitionScore,
      recall_score: newRecallScore,
      context_score: newContextScore,
      usage_score: newUsageScore,
      correct_count: newCorrectCount,
      mistake_count: newMistakeCount,
      review_count: newReviewCount,
      last_seen_at: now.toISOString(),
      next_review_at: fsrsResult.nextReviewAt.toISOString(),
      interval_days: fsrsResult.scheduledDays,
      ease_factor: easeFactor,
      last_result: isCorrect ? 'correct' : 'incorrect',
      fsrs_difficulty: fsrsResult.difficulty,
      fsrs_stability: fsrsResult.stability,
      fsrs_retrievability: fsrsResult.retrievability,
      fsrs_state: fsrsResult.state,
      fsrs_last_review_at: now.toISOString(),
      fsrs_elapsed_days: 0
    })
  }

  private applyWordUpdate(action: ParsedAction): ApplySuggestionResult {
    const wordId = action.word_id as number | undefined
    const updates = action.updates as Record<string, unknown> | undefined

    if (!wordId || !updates) {
      return { applied: false, actionType: action.type, message: '缺少 word_id 或更新内容' }
    }

    const word = this.vocabRepo.getWord(wordId)
    if (!word) {
      return { applied: false, actionType: action.type, message: `单词 ${wordId} 未找到` }
    }

    // Only allow updating specific fields via AI suggestion
    const allowedFields = ['chinese_meaning', 'english_meaning', 'part_of_speech', 'exam_tags']
    const filteredUpdates: Record<string, unknown> = {}
    let updatedCount = 0

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
        updatedCount++
      }
    }

    if (updatedCount === 0) {
      return { applied: false, actionType: action.type, message: '没有有效的可更新字段' }
    }

    // For now, store as AI note rather than directly updating the word
    // This is safer - the AI suggestion is preserved but doesn't overwrite verified data
    const existingNote = this.vocabRepo.getAiNoteByWordId(wordId)
    if (!existingNote) {
      this.vocabRepo.addAiNote({
        word_id: wordId,
        ai_explanation_cn: (updates.chinese_meaning as string) || null,
        ai_explanation_en: (updates.english_meaning as string) || null,
        ai_examples: null,
        exam_usage: (updates.exam_tags as string) || null,
        common_collocations: null,
        common_mistakes: null,
        synonyms: null,
        antonyms: null,
        memory_tips: null,
        generated_by_model: 'ai_suggestion'
      })
    }

    return {
      applied: true,
      actionType: action.type,
      message: `已记录单词 "${word.word}" 的 AI 建议（${updatedCount} 个字段）`
    }
  }

  private applyWeakCandidate(action: ParsedAction): ApplySuggestionResult {
    const wordId = action.word_id as number | undefined
    if (!wordId) {
      return { applied: false, actionType: action.type, message: '缺少 word_id' }
    }

    const word = this.vocabRepo.getWord(wordId)
    if (!word) {
      return { applied: false, actionType: action.type, message: `单词 ${wordId} 未找到` }
    }

    // Ensure progress exists and mark as weak
    let progress = this.vocabRepo.getProgress(wordId)
    if (!progress) {
      progress = this.vocabRepo.createProgress(wordId, 'weak')
    } else {
      this.vocabRepo.updateProgress(wordId, { status: 'weak' })
    }

    return {
      applied: true,
      actionType: action.type,
      message: `单词 "${word.word}" 已标记为薄弱项`
    }
  }

  private applyReviewScheduleUpdate(action: ParsedAction): ApplySuggestionResult {
    const wordId = action.word_id as number | undefined
    const nextReviewAt = action.next_review_at as string | undefined
    const intervalDays = action.interval_days as number | undefined

    if (!wordId) {
      return { applied: false, actionType: action.type, message: '缺少 word_id' }
    }

    const progress = this.vocabRepo.getProgress(wordId)
    if (!progress) {
      return { applied: false, actionType: action.type, message: `单词 ${wordId} 没有学习记录` }
    }

    const updates: Partial<UserWordProgress> = {}
    if (nextReviewAt) updates.next_review_at = nextReviewAt
    if (intervalDays !== undefined) updates.interval_days = intervalDays

    if (Object.keys(updates).length === 0) {
      return { applied: false, actionType: action.type, message: '未提供复习计划更新' }
    }

    this.vocabRepo.updateProgress(wordId, updates)

    return {
      applied: true,
      actionType: action.type,
      message: `已更新单词 ${wordId} 的复习计划`
    }
  }
}
