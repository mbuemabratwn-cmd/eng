import { AIProvider, AIRequest } from '../ai/provider'
import { ChatRepository } from '../repositories/chat.repository'
import { SummaryRepository } from '../repositories/summary.repository'
import { LearningStateManager } from './learning-state-manager'
import { IntentRouter } from './intent-router'
import { PromptBuilder } from './prompt-builder'
import { ContextRetriever } from './context-retriever'
import { ContextBudgetManager } from './context-budget-manager'
import { StructuredOutputParser, ParseResult } from './structured-output-parser'
import { ActionValidator, ValidationResult } from './action-validator'
import { ActionDispatcher, DispatchResult } from './action-dispatcher'
import { VocabularyThemeLesson } from './vocabulary-theme-lesson'
import { OutputLinter } from './output-linter'

export interface OrchestratorInput {
  userMessage: string
  sessionId: number
}

export interface OrchestratorResult {
  userMessage: { id: number; content: string; role: string; created_at: string }
  assistantMessage: { id: number; content: string; role: string; created_at: string } | null
  sessionId: number
  error?: string
  intent?: string
  parseResult?: ParseResult
  validationResult?: ValidationResult
  dispatchResult?: DispatchResult
  usage?: { inputTokens: number; outputTokens: number }
}

export class AIOrchestrator {
  private promptBuilder: PromptBuilder
  private contextRetriever: ContextRetriever
  private contextBudgetManager: ContextBudgetManager
  private outputParser: StructuredOutputParser
  private actionValidator: ActionValidator
  private outputLinter: OutputLinter

  constructor(
    private aiProvider: AIProvider,
    private chatRepo: ChatRepository,
    private stateManager: LearningStateManager,
    private intentRouter: IntentRouter,
    private summaryRepo: SummaryRepository,
    private actionDispatcher: ActionDispatcher,
    private themeLesson?: VocabularyThemeLesson
  ) {
    this.promptBuilder = new PromptBuilder()
    this.contextRetriever = new ContextRetriever(chatRepo, summaryRepo)
    this.contextBudgetManager = new ContextBudgetManager()
    this.outputParser = new StructuredOutputParser()
    this.actionValidator = new ActionValidator()
    this.outputLinter = new OutputLinter()
  }

  abort(): void {
    this.aiProvider.abort()
  }

  async processMessage(input: OrchestratorInput): Promise<OrchestratorResult> {
    const state = this.stateManager.getState()

    // Clear break reminder if user says "继续"
    if (input.userMessage.includes('继续') && this.stateManager.isBreakReminderPending()) {
      this.stateManager.clearBreakReminder()
    }

    // 1. Classify intent
    const intentResult = this.intentRouter.classify(input.userMessage)

    // 2. Retrieve context
    const rawContext = this.contextRetriever.retrieve({
      sessionId: input.sessionId,
      state
    })

    // 2.5. Trim context to budget
    const context = this.contextBudgetManager.trim({
      recentMessages: rawContext.recentMessages,
      memorySummary: rawContext.memorySummary,
      dailySummary: rawContext.dailySummary,
      weeklyReview: rawContext.weeklyReview,
      taskContext: rawContext.taskContext,
      modePrompt: '',
      globalSystemPrompt: '',
      userInput: input.userMessage
    })

    // 3. Build prompt
      const messages = this.promptBuilder.build({
        userMessage: input.userMessage,
        state,
        recentMessages: context.recentMessages,
        memorySummary: context.memorySummary || undefined,
        retrievedContext: context.taskContext || undefined,
        lessonContext: this.themeLesson?.getPromptContext() || null,
        breakReminder: context.breakReminder,
        blockDurationMinutes: context.blockDurationMinutes
      })

    // 4. Call AI provider
    const aiRequest: AIRequest = { messages }

    try {
      const aiResponse = await this.aiProvider.chat(aiRequest)

      // 5. Parse structured output
      const parseResult = this.outputParser.parse(aiResponse.content)

      // 5.5. Lint output quality
      const lintResult = this.outputLinter.lint(parseResult.reply, {
        hasUserQuestion: input.userMessage.includes('?') || input.userMessage.includes('？')
      })

      // Use cleaned reply if issues were found and auto-fixed
      if (lintResult.hasIssues) {
        console.log(`[OutputLinter] ${this.outputLinter.getSummary(lintResult)}`)
        parseResult.reply = lintResult.cleanedReply
      }

      // 6. Validate actions
      const validationResult = this.actionValidator.validate({
        payload: parseResult.payload,
        state
      })

      // 6.5. Dispatch validated actions to engines
      let dispatchResult: DispatchResult | undefined
      if (validationResult.allowedActions.length > 0) {
        dispatchResult = this.actionDispatcher.dispatch(
          validationResult.allowedActions,
          input.sessionId,
          state.active_learning_block_id,
          state.current_learning_task
        )
      }

      // 7. Save assistant message
      const assistantMessage = this.chatRepo.saveMessage(
        input.sessionId,
        'assistant',
        parseResult.reply
      )

      // 8. Transition state if needed
      if (parseResult.payload?.teacher_mode) {
        const nextMode = parseResult.payload.teacher_mode
        if (['guide', 'explain', 'answer', 'review', 'chat'].includes(nextMode)) {
          this.stateManager.transition('USER_SWITCHES_MODE', {
            task: state.current_learning_task,
            teacherMode: nextMode
          })
        }
      }

      return {
        userMessage: { id: 0, content: input.userMessage, role: 'user', created_at: '' },
        assistantMessage,
        sessionId: input.sessionId,
        intent: intentResult.intent,
        parseResult,
        validationResult,
        dispatchResult,
        usage: aiResponse.usage
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return {
        userMessage: { id: 0, content: input.userMessage, role: 'user', created_at: '' },
        assistantMessage: null,
        sessionId: input.sessionId,
        error: errorMessage,
        intent: intentResult.intent
      }
    }
  }
}
