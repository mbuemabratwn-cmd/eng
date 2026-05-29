import { VocabularyRepository, VocabularyWord, UserWordProgress } from '../repositories/vocabulary.repository'
import { DailyTargetPoolManager } from './daily-target-pool-manager'
import { VocabularyEngine } from './vocabulary-engine'
import { LearningStateManager } from './learning-state-manager'

export interface ThemeLessonConfig {
  theme: string
  wordCount: number
  focusedWordCount: number
}

export interface DailyWordSelection {
  theme: string
  totalWords: number
  focusedWords: VocabularyWord[]
  ordinaryWords: VocabularyWord[]
  reviewWords: VocabularyWord[]
  poolId: number
}

export interface WordWithProgress {
  word: VocabularyWord
  progress: UserWordProgress | null
  isFocused: boolean
}

export interface ThemeLessonState {
  selection: DailyWordSelection | null
  currentIndex: number
  completedWords: number
  focusedCompleted: number
  reviewCompleted: number
  isActive: boolean
  lastQuestion: string | null
  recentIssue: string | null
}

export class VocabularyThemeLesson {
  private state: ThemeLessonState = {
    selection: null,
    currentIndex: 0,
    completedWords: 0,
    focusedCompleted: 0,
    reviewCompleted: 0,
    isActive: false,
    lastQuestion: null,
    recentIssue: null
  }

  constructor(
    private vocabRepo: VocabularyRepository,
    private vocabEngine: VocabularyEngine,
    private poolManager: DailyTargetPoolManager,
    private stateManager: LearningStateManager
  ) {}

  startLesson(config?: Partial<ThemeLessonConfig>): DailyWordSelection {
    // Get or create today's pool
    const pool = this.poolManager.getOrCreateTodayPool({
      baseNewWordCount: config?.wordCount,
      focusedWordCount: config?.focusedWordCount,
      targetType: 'vocabulary'
    })

    // Select words for today
    const selection = this.selectDailyWords(pool.id, config?.theme || 'daily_vocabulary')

    // Update state
    this.state = {
      selection,
      currentIndex: 0,
      completedWords: 0,
      focusedCompleted: 0,
      reviewCompleted: 0,
      isActive: true,
      lastQuestion: this.buildOpeningQuestion(selection),
      recentIssue: null
    }

    return selection
  }

  getCurrentWord(): WordWithProgress | null {
    if (!this.state.selection || !this.state.isActive) return null

    const allWords = [
      ...this.state.selection.focusedWords.map(w => ({ word: w, isFocused: true })),
      ...this.state.selection.ordinaryWords.map(w => ({ word: w, isFocused: false })),
      ...this.state.selection.reviewWords.map(w => ({ word: w, isFocused: false }))
    ]

    if (this.state.currentIndex >= allWords.length) return null

    const current = allWords[this.state.currentIndex]
    const progress = this.vocabRepo.getProgress(current.word.id)

    return {
      word: current.word,
      progress,
      isFocused: current.isFocused
    }
  }

  recordWordReview(isCorrect: boolean, score?: number, details?: {
    questionType?: string
    prompt?: string
    userAnswer?: string
    correctAnswer?: string
    aiFeedback?: string
  }): void {
    if (!this.state.selection || !this.state.isActive) return

    const currentWord = this.getCurrentWord()
    if (!currentWord) return

    const studyDay = this.stateManager.getState().study_day
    const session = this.stateManager.getState().active_chat_session_id

    // Record review through VocabularyEngine
    this.vocabEngine.recordReview({
      wordId: currentWord.word.id,
      sessionId: session || undefined,
      blockId: this.stateManager.getState().active_learning_block_id || undefined,
      isCorrect,
      score,
      mode: 'vocabulary_theme',
      questionType: details?.questionType,
      prompt: details?.prompt || this.state.lastQuestion || undefined,
      userAnswer: details?.userAnswer,
      correctAnswer: details?.correctAnswer,
      aiFeedback: details?.aiFeedback
    })

    // Update lesson state
    this.state.completedWords++
    if (currentWord.isFocused) {
      this.state.focusedCompleted++
    }

    // Check if this was a review word
    const isReviewWord = this.state.selection.reviewWords.some(w => w.id === currentWord.word.id)
    if (isReviewWord) {
      this.state.reviewCompleted++
    }

    // Move to next word
    this.state.currentIndex++
    this.state.recentIssue = !isCorrect && currentWord.word.word
      ? `${currentWord.word.word} 还不稳，后续复习时优先用语境辨析。`
      : null
    this.state.lastQuestion = this.buildCurrentQuestion()
  }

  getLessonState(): ThemeLessonState & { totalWords: number; progressPercent: number } {
    const totalWords = this.state.selection
      ? this.state.selection.focusedWords.length +
        this.state.selection.ordinaryWords.length +
        this.state.selection.reviewWords.length
      : 0

    return {
      ...this.state,
      totalWords,
      progressPercent: totalWords > 0 ? Math.round((this.state.completedWords / totalWords) * 100) : 0
    }
  }

  getPromptContext(): Record<string, unknown> | null {
    if (!this.state.selection || !this.state.isActive) return null

    const current = this.getCurrentWord()
    const totalWords = this.state.selection.focusedWords.length +
      this.state.selection.ordinaryWords.length +
      this.state.selection.reviewWords.length

    return {
      lesson_theme: this.state.selection.theme,
      lesson_progress: {
        completed_words: this.state.completedWords,
        total_words: totalWords,
        focused_completed: this.state.focusedCompleted,
        focused_total: this.state.selection.focusedWords.length,
        review_completed: this.state.reviewCompleted,
        review_total: this.state.selection.reviewWords.length
      },
      current_word: current ? {
        id: current.word.id,
        word: current.word.word,
        phonetic: current.word.phonetic,
        part_of_speech: current.word.part_of_speech,
        chinese_meaning: current.word.chinese_meaning,
        english_meaning: current.word.english_meaning,
        exam_tags: current.word.exam_tags,
        is_focused: current.isFocused,
        progress_status: current.progress?.status || 'new',
        mastery_score: current.progress?.mastery_score ?? 0
      } : null,
      last_question: this.state.lastQuestion,
      recent_issue: this.state.recentIssue,
      next_best_move: current ? 'ask_guess_or_usage' : 'summarize_lesson'
    }
  }

  getThemeSummary(): {
    theme: string
    totalWords: number
    focusedCount: number
    ordinaryCount: number
    reviewCount: number
    completedCount: number
    isComplete: boolean
  } | null {
    if (!this.state.selection) return null

    const totalWords = this.state.selection.focusedWords.length +
      this.state.selection.ordinaryWords.length +
      this.state.selection.reviewWords.length

    return {
      theme: this.state.selection.theme,
      totalWords,
      focusedCount: this.state.selection.focusedWords.length,
      ordinaryCount: this.state.selection.ordinaryWords.length,
      reviewCount: this.state.selection.reviewWords.length,
      completedCount: this.state.completedWords,
      isComplete: this.state.completedWords >= totalWords
    }
  }

  endLesson(): void {
    if (this.state.selection) {
      // Update pool progress
      this.poolManager.updatePoolProgress(this.state.selection.poolId, {
        completedNewWords: this.state.completedWords,
        completedFocusedWords: this.state.focusedCompleted,
        completedReviewWords: this.state.reviewCompleted
      })

      // Mark pool as completed if all words done
      const totalWords = this.state.selection.focusedWords.length +
        this.state.selection.ordinaryWords.length +
        this.state.selection.reviewWords.length

      if (this.state.completedWords >= totalWords) {
        this.poolManager.markPoolCompleted(this.state.selection.poolId)
      }
    }

    this.state = {
      selection: null,
      currentIndex: 0,
      completedWords: 0,
      focusedCompleted: 0,
      reviewCompleted: 0,
      isActive: false,
      lastQuestion: null,
      recentIssue: null
    }
  }

  private selectDailyWords(poolId: number, theme: string): DailyWordSelection {
    const pool = this.poolManager.getCurrentPool()
    if (!pool) throw new Error('No active pool found')

    // Get words that need review (due for review)
    const dueReviewWords = this.vocabEngine.getDueReviewWords(pool.review_word_count)

    // Get new words (words without progress or with 'new' status)
    const newWords = this.getNewWords(pool.new_word_count)

    // Get weak words for focused learning
    const weakWords = this.getWeakWordsForFocused(pool.focused_word_count)

    // Split new words into focused and ordinary
    const focusedWords = weakWords.length > 0 ? weakWords : newWords.slice(0, pool.focused_word_count)
    const ordinaryWords = weakWords.length > 0 ? newWords : newWords.slice(pool.focused_word_count)

    return {
      theme,
      totalWords: focusedWords.length + ordinaryWords.length + dueReviewWords.length,
      focusedWords,
      ordinaryWords,
      reviewWords: dueReviewWords.map(wr => wr.word),
      poolId
    }
  }

  private getNewWords(limit: number): VocabularyWord[] {
    // Get words without progress or with 'new' status
    const allWords = this.vocabRepo.getWords(limit * 2) // Get more than needed to filter
    const newWords: VocabularyWord[] = []

    for (const word of allWords) {
      if (newWords.length >= limit) break

      const progress = this.vocabRepo.getProgress(word.id)
      if (!progress || progress.status === 'new') {
        newWords.push(word)
      }
    }

    return newWords
  }

  private getWeakWordsForFocused(limit: number): VocabularyWord[] {
    const weakProgress = this.vocabRepo.getWeakWords(limit)
    const weakWords: VocabularyWord[] = []

    for (const progress of weakProgress) {
      const word = this.vocabRepo.getWord(progress.word_id)
      if (word) {
        weakWords.push(word)
      }
    }

    return weakWords
  }

  private buildOpeningQuestion(selection: DailyWordSelection): string | null {
    const first = selection.focusedWords[0] || selection.ordinaryWords[0] || selection.reviewWords[0]
    if (!first) return null
    return null // 由 AI 选择合适的教学形式引入，不预设固定问题
  }

  private buildCurrentQuestion(): string | null {
    return null // 由 AI 根据词的状态和教学形式动态生成问题
  }
}
