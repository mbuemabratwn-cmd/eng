import { ContextBudgetManager } from '../context-budget-manager'

describe('ContextBudgetManager', () => {
  let manager: ContextBudgetManager

  beforeEach(() => {
    manager = new ContextBudgetManager()
  })

  describe('trim', () => {
    it('should return all context when under budget', () => {
      const context = {
        recentMessages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' }
        ],
        memorySummary: 'Short memory',
        dailySummary: 'Short daily summary',
        weeklyReview: 'Short weekly review',
        taskContext: 'Short task context',
        modePrompt: 'Guide mode',
        globalSystemPrompt: 'System prompt',
        userInput: 'Test message'
      }

      const result = manager.trim(context)

      expect(result.recentMessages).toHaveLength(2)
      expect(result.memorySummary).toBe('Short memory')
      expect(result.dailySummary).toBe('Short daily summary')
      expect(result.weeklyReview).toBe('Short weekly review')
      expect(result.taskContext).toBe('Short task context')
    })

    it('should trim messages when over budget', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with some content to make it longer`
      }))

      const context = {
        recentMessages: messages,
        memorySummary: 'Memory',
        dailySummary: 'Daily',
        weeklyReview: 'Weekly',
        taskContext: 'Task',
        modePrompt: 'Mode',
        globalSystemPrompt: 'System',
        userInput: 'Test'
      }

      const result = manager.trim(context)

      expect(result.recentMessages.length).toBeLessThan(100)
    })

    it('should trim lower priority sections first', () => {
      const longTaskContext = 'A'.repeat(10000)
      const longWeeklyReview = 'B'.repeat(10000)
      const longDailySummary = 'C'.repeat(10000)

      const context = {
        recentMessages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' }
        ],
        memorySummary: 'Important memory',
        dailySummary: longDailySummary,
        weeklyReview: longWeeklyReview,
        taskContext: longTaskContext,
        modePrompt: 'Mode',
        globalSystemPrompt: 'System',
        userInput: 'Test'
      }

      const result = manager.trim(context)

      // Higher priority items should be preserved
      expect(result.memorySummary).toBe('Important memory')
    })

    it('should never trim globalSystemPrompt', () => {
      const longSystemPrompt = 'A'.repeat(50000)

      const context = {
        recentMessages: [],
        memorySummary: null,
        dailySummary: null,
        weeklyReview: null,
        taskContext: null,
        modePrompt: 'Mode',
        globalSystemPrompt: longSystemPrompt,
        userInput: 'Test'
      }

      const result = manager.trim(context)

      expect(result.globalSystemPrompt).toBe(longSystemPrompt)
    })

    it('should never trim userInput', () => {
      const longUserInput = 'A'.repeat(50000)

      const context = {
        recentMessages: [],
        memorySummary: null,
        dailySummary: null,
        weeklyReview: null,
        taskContext: null,
        modePrompt: 'Mode',
        globalSystemPrompt: 'System',
        userInput: longUserInput
      }

      const result = manager.trim(context)

      expect(result.userInput).toBe(longUserInput)
    })

    it('should handle null optional fields', () => {
      const context = {
        recentMessages: [],
        memorySummary: null,
        dailySummary: null,
        weeklyReview: null,
        taskContext: null,
        modePrompt: 'Mode',
        globalSystemPrompt: 'System',
        userInput: 'Test'
      }

      const result = manager.trim(context)

      expect(result.memorySummary).toBeNull()
      expect(result.dailySummary).toBeNull()
      expect(result.weeklyReview).toBeNull()
      expect(result.taskContext).toBeNull()
    })
  })
})
