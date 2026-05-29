import { ChatRepository } from '../repositories/chat.repository'
import { SummaryRepository } from '../repositories/summary.repository'
import { LearningState } from './learning-state-manager'

export interface ContextRetrieverInput {
  sessionId: number
  state: LearningState
  maxRecentMessages?: number
}

export interface RetrievedContext {
  recentMessages: Array<{ role: string; content: string }>
  memorySummary: string | null
  taskContext: string | null
  dailySummary: string | null
  weeklyReview: string | null
  breakReminder: boolean
  blockDurationMinutes: number
}

export class ContextRetriever {
  constructor(
    private chatRepo: ChatRepository,
    private summaryRepo: SummaryRepository
  ) {}

  retrieve(input: ContextRetrieverInput): RetrievedContext {
    const maxMessages = input.maxRecentMessages || 10

    // Get recent messages for context
    const messages = this.chatRepo.getRecentMessages(input.sessionId, maxMessages)
    const recentMessages = messages.reverse().map(m => ({
      role: m.role,
      content: m.content
    }))

    // Build task context from current state
    let taskContext: string | null = null
    if (input.state.current_learning_task !== 'none') {
      taskContext = `当前学习任务: ${input.state.current_learning_task}`
      if (input.state.active_task) {
        taskContext += `\n活跃任务: ${JSON.stringify(input.state.active_task)}`
      }
    }

    // Read active memories from ai_memory_summary
    const memorySummary = this.buildMemorySummary()

    // Get today's daily summary
    const dailySummary = this.buildDailySummary(input.state.study_day)

    // Get latest weekly review
    const weeklyReview = this.buildWeeklyReview()

    return {
      recentMessages,
      memorySummary,
      taskContext,
      dailySummary,
      weeklyReview,
      breakReminder: input.state.break_reminder_pending,
      blockDurationMinutes: input.state.block_started_at
        ? Math.floor((Date.now() - new Date(input.state.block_started_at).getTime()) / 60000)
        : 0
    }
  }

  private buildMemorySummary(): string | null {
    try {
      const memories = this.summaryRepo.getActiveMemories(30)
      if (memories.length === 0) return null

      // Group by memory_type for structured output
      const grouped: Record<string, string[]> = {}
      for (const mem of memories) {
        const type = mem.memory_type || 'other'
        if (!grouped[type]) grouped[type] = []
        // Include content and confidence for high-confidence memories
        const confidence = mem.confidence >= 0.7 ? ' [高置信度]' : ''
        grouped[type].push(`${mem.content}${confidence}`)
      }

      const typeLabels: Record<string, string> = {
        vocabulary: '词汇',
        grammar: '语法',
        long_sentence: '长难句',
        expression: '表达',
        language_preference: '语言偏好',
        overall_strategy: '整体策略',
        other: '其他'
      }

      const sections: string[] = []
      for (const [type, items] of Object.entries(grouped)) {
        const label = typeLabels[type] || type
        sections.push(`【${label}】\n${items.join('\n')}`)
      }

      return sections.join('\n\n')
    } catch {
      return null
    }
  }

  private buildDailySummary(studyDay: string): string | null {
    try {
      const summary = this.summaryRepo.getDailySummary(studyDay)
      if (!summary) return null

      const parts = [`【今日总结】\n${summary.content}`]
      if (summary.key_points) {
        try {
          const points = JSON.parse(summary.key_points)
          if (Array.isArray(points) && points.length > 0) {
            parts.push(`要点: ${points.join('、')}`)
          }
        } catch { /* ignore */ }
      }
      if (summary.recommendations) {
        try {
          const recs = JSON.parse(summary.recommendations)
          if (Array.isArray(recs) && recs.length > 0) {
            parts.push(`建议: ${recs.join('、')}`)
          }
        } catch { /* ignore */ }
      }
      return parts.join('\n')
    } catch {
      return null
    }
  }

  private buildWeeklyReview(): string | null {
    try {
      const reviews = this.summaryRepo.getRecentWeeklyReviews(1)
      if (reviews.length === 0) return null

      const review = reviews[0]
      const parts = [`【最近周复盘 (${review.week_start} ~ ${review.week_end})】\n${review.summary}`]
      if (review.recommendations) {
        try {
          const recs = JSON.parse(review.recommendations)
          if (Array.isArray(recs) && recs.length > 0) {
            parts.push(`建议: ${recs.join('、')}`)
          }
        } catch { /* ignore */ }
      }
      return parts.join('\n')
    } catch {
      return null
    }
  }
}
