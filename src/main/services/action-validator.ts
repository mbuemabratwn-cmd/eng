import { ParsedAction, StructuredPayload } from './structured-output-parser'
import { LearningState, LearningTask } from './learning-state-manager'

export interface ValidationResult {
  valid: boolean
  allowedActions: ParsedAction[]
  rejectedActions: Array<{ action: ParsedAction; reason: string }>
  warnings: string[]
}

// Actions allowed per learning task mode
const ALLOWED_ACTIONS: Partial<Record<LearningTask, string[]>> = {
  word_theme_learning: [
    'create_learning_event',
    'create_word_review_event',
    'suggest_word_update',
    'create_weak_candidate'
  ],
  word_review: [
    'create_learning_event',
    'create_word_review_event',
    'suggest_word_update',
    'update_review_schedule'
  ],
  long_sentence: [
    'create_learning_event',
    'create_sentence_progress',
    'suggest_vocabulary_weakness',
    'suggest_grammar_weakness'
  ],
  grammar_correction: [
    'create_learning_event',
    'create_grammar_error_event',
    'update_grammar_issue_summary_candidate'
  ],
  free_chat: [
    'create_light_grammar_feedback',
    'create_expression_feedback',
    'create_limited_learning_event'
  ],
  summary: [
    'create_block_summary',
    'create_daily_summary',
    'suggest_memory_update'
  ],
  daily_plan: [
    'create_learning_event'
  ],
  file_processing: [
    'create_file_record',
    'create_import_candidate',
    'create_file_chunk'
  ]
}

// Actions that are always allowed regardless of mode
const UNIVERSAL_ACTIONS = [
  'request_user_confirmation'
]

export class ActionValidator {
  validate(input: {
    payload: StructuredPayload | null
    state: LearningState
  }): ValidationResult {
    if (!input.payload || !input.payload.actions.length) {
      return {
        valid: true,
        allowedActions: [],
        rejectedActions: [],
        warnings: []
      }
    }

    const allowedActions: ParsedAction[] = []
    const rejectedActions: Array<{ action: ParsedAction; reason: string }> = []
    const warnings: string[] = [...input.payload.warnings]

    const currentTask = input.state.current_learning_task
    const allowedForMode = ALLOWED_ACTIONS[currentTask] || []
    const persistencePolicy = input.state.persistence_policy

    for (const action of input.payload.actions) {
      // Check if action type is universally allowed
      if (UNIVERSAL_ACTIONS.includes(action.type)) {
        allowedActions.push(action)
        continue
      }

      // Check if action type is allowed for current mode
      if (!allowedForMode.includes(action.type)) {
        rejectedActions.push({
          action,
          reason: `操作 '${action.type}' 在 '${currentTask}' 模式下不允许`
        })
        continue
      }

      // Check persistence policy
      if (persistencePolicy === 'transient_only' && this.isPersistentAction(action.type)) {
        rejectedActions.push({
          action,
          reason: `操作 '${action.type}' 与持久化策略 '${persistencePolicy}' 冲突`
        })
        continue
      }

      // Check for destructive actions
      if (this.isDestructiveAction(action.type)) {
        rejectedActions.push({
          action,
          reason: `操作 '${action.type}' 具有破坏性，需要用户确认`
        })
        continue
      }

      allowedActions.push(action)
    }

    return {
      valid: rejectedActions.length === 0,
      allowedActions,
      rejectedActions,
      warnings
    }
  }

  private isPersistentAction(actionType: string): boolean {
    const persistentActions = [
      'suggest_word_update',
      'create_weak_candidate',
      'update_review_schedule',
      'create_file_record',
      'create_import_candidate'
    ]
    return persistentActions.includes(actionType)
  }

  private isDestructiveAction(actionType: string): boolean {
    const destructiveActions = [
      'bulk_update_words',
      'clear_progress',
      'delete_records',
      'overwrite_import'
    ]
    return destructiveActions.includes(actionType)
  }
}
