import { ParsedAction } from './structured-output-parser'
import { VocabularyEngine } from './vocabulary-engine'
import { SentenceEngine } from './sentence-engine'
import { GrammarEngine } from './grammar-engine'
import { MemoryEngine } from './memory-engine'
import { VocabularyThemeLesson } from './vocabulary-theme-lesson'
import { LearningEventRepository } from '../repositories/learning-event.repository'
import type { LearningTask } from './learning-state-manager'

export interface DispatchResult {
  dispatched: Array<{ action: ParsedAction; result: unknown }>
  failed: Array<{ action: ParsedAction; error: string }>
}

export class ActionDispatcher {
  constructor(
    private vocabEngine: VocabularyEngine,
    private sentenceEngine: SentenceEngine,
    private grammarEngine: GrammarEngine,
    private memoryEngine: MemoryEngine,
    private eventRepo: LearningEventRepository,
    private themeLesson?: VocabularyThemeLesson
  ) {}

  dispatch(actions: ParsedAction[], sessionId: number, blockId: number | null, currentTask?: LearningTask): DispatchResult {
    const dispatched: Array<{ action: ParsedAction; result: unknown }> = []
    const failed: Array<{ action: ParsedAction; error: string }> = []

    for (const action of actions) {
      try {
        const result = this.executeAction(action, sessionId, blockId, currentTask)
        dispatched.push({ action, result })
      } catch (err) {
        failed.push({ action, error: err instanceof Error ? err.message : String(err) })
      }
    }

    return { dispatched, failed }
  }

  private executeAction(action: ParsedAction, sessionId: number, blockId: number | null, currentTask?: LearningTask): unknown {
    switch (action.type) {
      case 'create_learning_event':
        return this.createLearningEvent(action, sessionId, blockId)

      case 'create_word_review_event':
        return this.createWordReviewEvent(action, sessionId, blockId, currentTask)

      case 'suggest_word_update':
        return this.vocabEngine.applySuggestion(action, true)

      case 'create_weak_candidate':
        return this.vocabEngine.applySuggestion(action, true)

      case 'update_review_schedule':
        return this.vocabEngine.applySuggestion(action, true)

      case 'create_sentence_progress':
        return this.createSentenceProgress(action)

      case 'suggest_vocabulary_weakness':
        return this.vocabEngine.applySuggestion(action, true)

      case 'suggest_grammar_weakness':
        return this.createGrammarWeaknessCandidate(action)

      case 'create_grammar_error_event':
        return this.createGrammarErrorEvent(action, sessionId)

      case 'update_grammar_issue_summary_candidate':
        return this.grammarEngine.createIssuePattern({
          issueType: (action.issue_type as string) || 'unknown',
          issuePattern: (action.issue_pattern as string) || (action.description as string) || '',
          exampleErrors: action.example_errors as string[] | undefined,
          suggestedRule: (action.suggested_rule as string) || undefined
        })

      case 'create_light_grammar_feedback':
        return this.createGrammarErrorEvent(action, sessionId)

      case 'create_expression_feedback':
        return this.createLearningEvent(action, sessionId, blockId)

      case 'create_limited_learning_event':
        return this.createLearningEvent(action, sessionId, blockId)

      case 'create_block_summary':
      case 'create_daily_summary':
        return this.createLearningEvent(action, sessionId, blockId)

      case 'suggest_memory_update':
        return this.suggestMemoryUpdate(action)

      default:
        throw new Error(`未知的 action 类型: ${action.type}`)
    }
  }

  private createLearningEvent(action: ParsedAction, sessionId: number, blockId: number | null) {
    return this.eventRepo.create({
      session_id: sessionId,
      block_id: blockId,
      event_type: action.type,
      target_type: (action.target_type as string) || null,
      target_id: (action.target_id as number) || null,
      result: (action.result as string) || null,
      score: (action.score as number) || null,
      metadata: JSON.stringify(action),
      study_day: (action.study_day as string) || new Date().toISOString().slice(0, 10)
    })
  }

  private createWordReviewEvent(action: ParsedAction, sessionId: number, blockId: number | null, currentTask?: LearningTask) {
    const score = typeof action.score === 'number' ? action.score : 3
    const isCorrect = score >= 3

    if (currentTask === 'word_theme_learning' && this.themeLesson?.getCurrentWord()) {
      this.themeLesson.recordWordReview(isCorrect, score, {
        questionType: action.question_type as string | undefined,
        prompt: action.prompt as string | undefined,
        userAnswer: action.user_answer as string | undefined,
        correctAnswer: action.correct_answer as string | undefined,
        aiFeedback: action.ai_feedback as string | undefined
      })
      return this.themeLesson.getLessonState()
    }

    return this.vocabEngine.recordReview({
      wordId: action.word_id as number,
      sessionId,
      blockId: blockId || undefined,
      score,
      isCorrect,
      mode: action.review_type as string | undefined,
      questionType: action.question_type as string | undefined,
      prompt: action.prompt as string | undefined,
      userAnswer: action.user_answer as string | undefined,
      correctAnswer: action.correct_answer as string | undefined
    })
  }

  private createSentenceProgress(action: ParsedAction) {
    return this.sentenceEngine.recordGuess({
      sentenceId: action.sentence_id as number,
      userGuess: (action.user_guess as string) || '',
      isCorrect: action.is_correct as boolean ?? false,
      scores: action.scores as Record<string, number> | undefined
    })
  }

  private createGrammarErrorEvent(action: ParsedAction, sessionId: number) {
    return this.grammarEngine.recordError({
      sessionId,
      errorType: (action.error_type as string) || 'unknown',
      errorText: (action.error_text as string) || (action.original_text as string) || '',
      correction: (action.correction as string) || (action.corrected_text as string) || '',
      contextSentence: (action.context_sentence as string) || (action.explanation as string) || undefined,
      severity: (action.severity as 'minor' | 'moderate' | 'serious') || 'minor',
      aiFeedback: (action.ai_feedback as string) || undefined
    })
  }

  private createGrammarWeaknessCandidate(action: ParsedAction) {
    return this.grammarEngine.createIssuePattern({
      issueType: (action.issue_type as string) || 'unknown',
      issuePattern: (action.issue_pattern as string) || (action.description as string) || '',
      exampleErrors: action.example_errors as string[] | undefined,
      suggestedRule: (action.suggested_rule as string) || undefined
    })
  }

  private suggestMemoryUpdate(action: ParsedAction) {
    return this.memoryEngine.addMemory({
      memoryType: (action.memory_type as string) || 'other',
      category: (action.category as string) || 'general',
      content: (action.content as string) || '',
      confidence: (action.confidence as number) || 0.5,
      sourceType: 'ai_suggestion',
      sourceId: undefined,
      evidenceEventIds: action.evidence_event_ids as number[] | undefined
    })
  }
}
