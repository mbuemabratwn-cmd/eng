export type LearningTask =
  | 'none'
  | 'daily_plan'
  | 'word_theme_learning'
  | 'word_review'
  | 'long_sentence'
  | 'grammar_correction'
  | 'free_chat'
  | 'file_processing'
  | 'summary'
  | 'weekly_review'
  | 'settings'

export type TeacherMode = 'guide' | 'explain' | 'answer' | 'review' | 'chat'

export type PersistencePolicy =
  | 'transient_only'
  | 'message_only'
  | 'event_only'
  | 'update_progress'
  | 'durable_import'
  | 'memory_update_allowed'

export interface ActiveTask {
  task_type: LearningTask
  task_id?: string
  theme?: string
  status: string
  progress?: Record<string, unknown>
}

export interface LearningState {
  study_day: string
  active_chat_session_id: number | null
  active_learning_block_id: number | null
  current_learning_task: LearningTask
  teacher_mode: TeacherMode
  active_task: ActiveTask | null
  interrupted_task_stack: ActiveTask[]
  persistence_policy: PersistencePolicy
  last_user_activity_at: string | null
  last_state_transition_at: string | null
  break_reminder_pending: boolean
  block_started_at: string | null
}

export type StateEvent =
  | 'USER_STARTS_LEARNING'
  | 'USER_REQUESTS_DAILY_PLAN'
  | 'USER_SWITCHES_MODE'
  | 'USER_INTERRUPTS_WITH_QUESTION'
  | 'USER_REQUESTS_DIRECT_ANSWER'
  | 'USER_REQUESTS_SUMMARY'
  | 'USER_STOPS_LEARNING'
  | 'USER_UPLOADS_FILE'
  | 'USER_REQUESTS_IMPORT'
  | 'USER_REQUESTS_NO_IMPORT'
  | 'USER_OVERRIDES_WORD_STATE'
  | 'AI_FINISHES_REPLY'
  | 'AI_OUTPUT_PARSE_FAILED'
  | 'BLOCK_TIMEOUT'
  | 'BLOCK_SUMMARY_CREATED'
  | 'REVIEW_LOAD_TOO_HIGH'
  | 'DESTRUCTIVE_ACTION_REQUESTED'
  | 'DESTRUCTIVE_ACTION_CONFIRMED'

const BLOCK_TIMEOUT_MS = 45 * 60 * 1000 // 45 minutes
const BREAK_REMINDER_MS = 60 * 60 * 1000 // 60 minutes

export function getStudyDay(date?: Date): string {
  const now = date || new Date()
  const hour = now.getHours()
  if (hour < 4) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }
  return now.toISOString().split('T')[0]
}

export class LearningStateManager {
  private state: LearningState
  private blockTimeoutTimer: NodeJS.Timeout | null = null
  private breakReminderTimer: NodeJS.Timeout | null = null
  private onBlockTimeout: (() => void) | null = null
  private onBreakReminder: (() => void) | null = null

  constructor() {
    this.state = this.createInitialState()
  }

  private createInitialState(): LearningState {
    return {
      study_day: getStudyDay(),
      active_chat_session_id: null,
      active_learning_block_id: null,
      current_learning_task: 'none',
      teacher_mode: 'chat',
      active_task: null,
      interrupted_task_stack: [],
      persistence_policy: 'update_progress',
      last_user_activity_at: null,
      last_state_transition_at: null,
      break_reminder_pending: false,
      block_started_at: null
    }
  }

  getState(): LearningState {
    return { ...this.state }
  }

  setBlockTimeoutHandler(handler: () => void): void {
    this.onBlockTimeout = handler
  }

  setBreakReminderHandler(handler: () => void): void {
    this.onBreakReminder = handler
  }

  isBreakReminderPending(): boolean {
    return this.state.break_reminder_pending
  }

  clearBreakReminder(): void {
    this.state.break_reminder_pending = false
  }

  getBlockDurationMinutes(): number {
    if (!this.state.block_started_at) return 0
    const startTime = new Date(this.state.block_started_at).getTime()
    return Math.floor((Date.now() - startTime) / 60000)
  }

  transition(event: StateEvent, context?: Record<string, unknown>): LearningState {
    const now = new Date().toISOString()
    this.state.last_state_transition_at = now
    this.state.last_user_activity_at = now

    // Reset block timeout on user activity
    this.resetBlockTimeout()

    switch (event) {
      case 'USER_STARTS_LEARNING':
        this.state.study_day = getStudyDay()
        if (!this.state.active_learning_block_id && context?.blockId) {
          this.state.active_learning_block_id = context.blockId as number
        }
        if (this.state.current_learning_task === 'none') {
          this.state.current_learning_task = 'daily_plan'
          this.state.teacher_mode = 'review'
        }
        break

      case 'USER_REQUESTS_DAILY_PLAN':
        this.state.current_learning_task = 'daily_plan'
        this.state.teacher_mode = 'review'
        break

      case 'USER_SWITCHES_MODE':
        if (context?.task) {
          // Push current task to stack if different
          const taskChanged = this.state.active_task?.task_type !== context.task
          if (this.state.active_task && taskChanged) {
            this.state.interrupted_task_stack.push({ ...this.state.active_task })
          }
          this.state.current_learning_task = context.task as LearningTask
          if (taskChanged || !this.state.active_task) {
            this.state.active_task = {
              task_type: context.task as LearningTask,
              theme: context.theme as string | undefined,
              status: (context.status as string | undefined) || 'in_progress',
              progress: context.progress as Record<string, unknown> | undefined
            }
          } else {
            const updates: Partial<ActiveTask> = {
              status: (context.status as string | undefined) || this.state.active_task.status
            }
            if (context.theme !== undefined) updates.theme = context.theme as string
            if (context.progress !== undefined) updates.progress = context.progress as Record<string, unknown>
            this.updateActiveTask(updates)
          }
        }
        if (context?.teacherMode) {
          this.state.teacher_mode = context.teacherMode as TeacherMode
        }
        break

      case 'USER_INTERRUPTS_WITH_QUESTION':
        if (this.state.active_task) {
          this.state.interrupted_task_stack.push({ ...this.state.active_task })
        }
        this.state.current_learning_task = (context?.task as LearningTask) || 'grammar_correction'
        this.state.teacher_mode = (context?.teacherMode as TeacherMode) || 'explain'
        this.state.active_task = {
          task_type: this.state.current_learning_task,
          status: 'in_progress'
        }
        break

      case 'USER_REQUESTS_DIRECT_ANSWER':
        this.state.teacher_mode = 'answer'
        break

      case 'USER_REQUESTS_SUMMARY':
        this.state.current_learning_task = 'summary'
        this.state.teacher_mode = 'review'
        break

      case 'USER_STOPS_LEARNING':
        this.state.current_learning_task = 'none'
        this.state.teacher_mode = 'chat'
        this.state.active_task = null
        this.clearBlockTimeout()
        break

      case 'BLOCK_TIMEOUT':
        this.state.active_learning_block_id = null
        this.state.current_learning_task = 'none'
        this.state.teacher_mode = 'chat'
        break

      case 'BLOCK_SUMMARY_CREATED':
        this.state.active_learning_block_id = null
        break

      case 'USER_REQUESTS_NO_IMPORT':
        this.state.persistence_policy = 'transient_only'
        break

      case 'USER_REQUESTS_IMPORT':
        this.state.persistence_policy = 'durable_import'
        break

      case 'AI_FINISHES_REPLY':
        // Could restore from interrupted stack
        break
    }

    return this.getState()
  }

  setActiveSession(sessionId: number): void {
    this.state.active_chat_session_id = sessionId
  }

  setActiveBlock(blockId: number): void {
    this.state.active_learning_block_id = blockId
    this.state.block_started_at = new Date().toISOString()
    this.state.break_reminder_pending = false
    this.resetBlockTimeout()
    this.resetBreakReminder()
  }

  clearActiveBlock(): void {
    this.state.active_learning_block_id = null
    this.state.block_started_at = null
    this.state.break_reminder_pending = false
    this.clearBlockTimeout()
    this.clearBreakReminderTimer()
  }

  setPersistencePolicy(policy: PersistencePolicy): void {
    this.state.persistence_policy = policy
  }

  updateActiveTask(updates: Partial<ActiveTask>): void {
    if (!this.state.active_task) return
    this.state.active_task = {
      ...this.state.active_task,
      ...updates,
      progress: {
        ...(this.state.active_task.progress || {}),
        ...(updates.progress || {})
      }
    }
  }

  restoreFromInterrupted(): ActiveTask | null {
    const task = this.state.interrupted_task_stack.pop()
    if (task) {
      this.state.active_task = task
      this.state.current_learning_task = task.task_type
    }
    return task || null
  }

  private resetBlockTimeout(): void {
    this.clearBlockTimeout()
    if (this.state.active_learning_block_id) {
      this.blockTimeoutTimer = setTimeout(() => {
        this.transition('BLOCK_TIMEOUT')
        this.onBlockTimeout?.()
      }, BLOCK_TIMEOUT_MS)
    }
  }

  private clearBlockTimeout(): void {
    if (this.blockTimeoutTimer) {
      clearTimeout(this.blockTimeoutTimer)
      this.blockTimeoutTimer = null
    }
  }

  private resetBreakReminder(): void {
    this.clearBreakReminderTimer()
    if (this.state.active_learning_block_id) {
      this.breakReminderTimer = setTimeout(() => {
        this.state.break_reminder_pending = true
        this.onBreakReminder?.()
      }, BREAK_REMINDER_MS)
    }
  }

  private clearBreakReminderTimer(): void {
    if (this.breakReminderTimer) {
      clearTimeout(this.breakReminderTimer)
      this.breakReminderTimer = null
    }
  }

  toJSON(): string {
    return JSON.stringify(this.state)
  }

  fromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json)
      this.state = { ...this.createInitialState(), ...parsed }
    } catch {
      this.state = this.createInitialState()
    }
  }
}
