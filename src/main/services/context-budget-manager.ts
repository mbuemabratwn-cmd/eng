export interface ContextBudget {
  recentMessages: number
  memorySummary: number
  dailySummary: number
  weeklyReview: number
  taskContext: number
  modePrompt: number
  globalSystemPrompt: number
  userInput: number
}

export interface FullContext {
  recentMessages: Array<{ role: string; content: string }>
  memorySummary: string | null
  dailySummary: string | null
  weeklyReview: string | null
  taskContext: string | null
  modePrompt: string
  globalSystemPrompt: string
  userInput: string
  breakReminder?: boolean
  blockDurationMinutes?: number
}

export interface TrimmedContext {
  recentMessages: Array<{ role: string; content: string }>
  memorySummary: string | null
  dailySummary: string | null
  weeklyReview: string | null
  taskContext: string | null
  modePrompt: string
  globalSystemPrompt: string
  userInput: string
  totalTokens: number
  breakReminder?: boolean
  blockDurationMinutes?: number
}

const DEFAULT_BUDGET: ContextBudget = {
  recentMessages: 2000,
  memorySummary: 1500,
  dailySummary: 500,
  weeklyReview: 500,
  taskContext: 500,
  modePrompt: 1000,
  globalSystemPrompt: 1500,
  userInput: 2000
}

export class ContextBudgetManager {
  private budget: ContextBudget

  constructor(budget?: Partial<ContextBudget>) {
    this.budget = { ...DEFAULT_BUDGET, ...budget }
  }

  estimateTokens(text: string): number {
    if (!text) return 0
    // Rough estimation:
    // Chinese characters: ~2 tokens each
    // English words: ~1.3 tokens each
    // Punctuation/spaces: ~0.5 tokens each
    let tokens = 0
    for (const char of text) {
      if (/[一-鿿]/.test(char)) {
        tokens += 2 // Chinese character
      } else if (/[a-zA-Z]/.test(char)) {
        tokens += 0.3 // Part of English word
      } else if (/\s/.test(char)) {
        tokens += 0.2 // Whitespace
      } else {
        tokens += 0.5 // Punctuation
      }
    }
    // Add overhead for English words (count spaces between words)
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length
    tokens += wordCount * 0.3
    return Math.ceil(tokens)
  }

  trim(context: FullContext): TrimmedContext {
    const result: TrimmedContext = {
      recentMessages: [],
      memorySummary: context.memorySummary,
      dailySummary: context.dailySummary,
      weeklyReview: context.weeklyReview,
      taskContext: context.taskContext,
      modePrompt: context.modePrompt,
      globalSystemPrompt: context.globalSystemPrompt,
      userInput: context.userInput,
      totalTokens: 0,
      breakReminder: context.breakReminder,
      blockDurationMinutes: context.blockDurationMinutes
    }

    // 1. Trim recent messages (keep most recent, drop oldest)
    result.recentMessages = this.trimMessages(
      context.recentMessages,
      this.budget.recentMessages
    )

    // 2. Trim memory summary (truncate if too long)
    if (result.memorySummary && this.estimateTokens(result.memorySummary) > this.budget.memorySummary) {
      result.memorySummary = this.truncateToTokenLimit(
        result.memorySummary,
        this.budget.memorySummary
      )
    }

    // 3. Trim daily summary
    if (result.dailySummary && this.estimateTokens(result.dailySummary) > this.budget.dailySummary) {
      result.dailySummary = this.truncateToTokenLimit(
        result.dailySummary,
        this.budget.dailySummary
      )
    }

    // 4. Trim weekly review
    if (result.weeklyReview && this.estimateTokens(result.weeklyReview) > this.budget.weeklyReview) {
      result.weeklyReview = this.truncateToTokenLimit(
        result.weeklyReview,
        this.budget.weeklyReview
      )
    }

    // 5. Trim task context (lowest priority, can be dropped)
    if (result.taskContext && this.estimateTokens(result.taskContext) > this.budget.taskContext) {
      result.taskContext = this.truncateToTokenLimit(
        result.taskContext,
        this.budget.taskContext
      )
    }

    // 6. Never trim: modePrompt, globalSystemPrompt, userInput
    // They are within budget by design

    // Calculate total tokens
    result.totalTokens = this.calculateTotalTokens(result)

    return result
  }

  private trimMessages(
    messages: Array<{ role: string; content: string }>,
    maxTokens: number
  ): Array<{ role: string; content: string }> {
    if (messages.length === 0) return []

    // Always keep the most recent messages
    const trimmed: Array<{ role: string; content: string }> = []
    let totalTokens = 0

    // Iterate from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const msgTokens = this.estimateTokens(msg.content) + 10 // overhead for role
      if (totalTokens + msgTokens > maxTokens && trimmed.length > 0) {
        break
      }
      trimmed.unshift(msg)
      totalTokens += msgTokens
    }

    return trimmed
  }

  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const totalTokens = this.estimateTokens(text)
    if (totalTokens <= maxTokens) return text

    // Truncate proportionally
    const ratio = maxTokens / totalTokens
    const targetLength = Math.floor(text.length * ratio * 0.9) // 90% to be safe
    return text.substring(0, targetLength) + '...'
  }

  private calculateTotalTokens(context: TrimmedContext): number {
    let total = 0
    total += this.estimateTokens(context.globalSystemPrompt)
    total += this.estimateTokens(context.modePrompt)
    total += this.estimateTokens(context.userInput)
    for (const msg of context.recentMessages) {
      total += this.estimateTokens(msg.content) + 10
    }
    if (context.memorySummary) total += this.estimateTokens(context.memorySummary)
    if (context.dailySummary) total += this.estimateTokens(context.dailySummary)
    if (context.weeklyReview) total += this.estimateTokens(context.weeklyReview)
    if (context.taskContext) total += this.estimateTokens(context.taskContext)
    return total
  }
}
