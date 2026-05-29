import type { LearningTask, TeacherMode } from './learning-state-manager'

export type Intent =
  | 'direct_answer_request'
  | 'summary_request'
  | 'stop_or_pause_request'
  | 'mode_switch_request'
  | 'file_with_instruction'
  | 'manual_state_override'
  | 'destructive_action_request'
  | 'learning_action'
  | 'free_chat'
  | 'unknown'

export interface IntentResult {
  intent: Intent
  confidence: 'high' | 'medium' | 'low'
  matchedPattern?: string
  metadata?: {
    targetTask?: LearningTask
    teacherMode?: TeacherMode
    command?: string
    [key: string]: unknown
  }
}

interface PatternRule {
  intent: Intent
  patterns: RegExp[]
  metadata?: Record<string, unknown>
}

const HIGH_CONFIDENCE_PATTERNS: PatternRule[] = [
  {
    intent: 'direct_answer_request',
    patterns: [
      /^(直接|请直接)?(告诉我|告诉我|说一下|说说|解释一下|解释|翻译|什么意思|怎么翻译|这句话?(?:怎么|是什么))/,
      /^(what|how|why|when|where|who)\s/i,
      /^(答案|answer|正确答案)(是什么|是)/,
    ]
  },
  {
    intent: 'summary_request',
    patterns: [
      /^(\/总结|总结|做个总结|帮我总结|生成总结|今日总结|今日回顾)/,
      /^(summary|summarize|recap|review)/i,
      /^(回顾一下|总结一下)/,
      /^(今天(?:就)?到这里|到此为止)/,
    ]
  },
  {
    intent: 'stop_or_pause_request',
    patterns: [
      /^(停|停下|停止|结束|暂停|不(?:学|练|看了?)了|到此为止|今天(?:就)?到这里)/,
      /^(stop|pause|end|quit|done|finish)/i,
      /^(休息一下?|先到这里)/,
    ]
  },
  {
    intent: 'destructive_action_request',
    patterns: [
      /^(清空|删除|重置|清除)(所有|全部|我的)?(记录|数据|进度|单词|学习)/,
      /^(delete|clear|reset|wipe)\s(all|everything|data|progress)/i,
      /^(从头开始|重新开始|全部删除)/,
    ]
  },
  {
    intent: 'manual_state_override',
    patterns: [
      /^(不要入库|不用保存|别记录|不保存|这次不(?:要)?(?:记|存))/,
      /^(导入|导入单词|添加单词|批量添加)/,
      /^(修改|更新|覆盖)(?:我的)?(?:单词|进度|状态)/,
    ]
  },
]

const MEDIUM_CONFIDENCE_PATTERNS: PatternRule[] = [
  {
    intent: 'mode_switch_request',
    patterns: [
      /^(我要|我想|切换|换|进入|开始)(?:到|成)?(?:单词|词汇|词汇学习|长难句|语法|自由(?:聊天|对话)|复习|背单词)/,
      /^(学单词|背单词|词汇学习|练句子|练语法|自由聊天)/,
      /^(word|vocabulary|sentence|grammar|free\s?chat|review)\s?(mode|练习)?/i,
      /^\/(背单词|复习|长难句|语法纠错|自由聊天|自由对话|今日计划|无限学习|易错词)/,
    ]
  },
  {
    intent: 'file_with_instruction',
    patterns: [
      /\.(csv|txt|md|pdf|docx|xlsx)\s/i,
      /^(上传|导入|处理)(?:这个|这个文件|文件)/,
    ]
  },
  {
    intent: 'learning_action',
    patterns: [
      /^(今天学什么|开始学习|开始今天的|每日计划|今日计划)/,
      /^(daily|today|plan|start\s?learning)/i,
      /^(复习|继续|下一个|再来|出题|测试我)/,
    ]
  },
]

const PERSISTENCE_POLICY_MAP: Partial<Record<Intent, string>> = {
  'manual_state_override': 'transient_only',
  'destructive_action_request': 'transient_only',
  'file_with_instruction': 'durable_import',
}

export class IntentRouter {
  classify(message: string): IntentResult {
    const trimmed = message.trim()
    if (!trimmed) {
      return { intent: 'unknown', confidence: 'low' }
    }

    // Check high confidence patterns first
    for (const rule of HIGH_CONFIDENCE_PATTERNS) {
      for (const pattern of rule.patterns) {
        if (pattern.test(trimmed)) {
          return {
            intent: rule.intent,
            confidence: 'high',
            matchedPattern: pattern.source,
            metadata: this.buildMetadata(rule.intent, trimmed, rule.metadata)
          }
        }
      }
    }

    // Check medium confidence patterns
    for (const rule of MEDIUM_CONFIDENCE_PATTERNS) {
      for (const pattern of rule.patterns) {
        if (pattern.test(trimmed)) {
          return {
            intent: rule.intent,
            confidence: 'medium',
            matchedPattern: pattern.source,
            metadata: this.buildMetadata(rule.intent, trimmed, rule.metadata)
          }
        }
      }
    }

    // Default to free_chat for conversational messages
    if (trimmed.length > 0) {
      return { intent: 'free_chat', confidence: 'low' }
    }

    return { intent: 'unknown', confidence: 'low' }
  }

  getPersistencePolicy(intent: Intent): string | null {
    return PERSISTENCE_POLICY_MAP[intent] || null
  }

  requiresConfirmation(intent: Intent): boolean {
    return intent === 'destructive_action_request'
  }

  private buildMetadata(intent: Intent, message: string, base?: Record<string, unknown>): IntentResult['metadata'] {
    const metadata: IntentResult['metadata'] = { ...base }

    if (intent === 'direct_answer_request') {
      metadata.teacherMode = 'answer'
    }

    if (intent === 'summary_request') {
      metadata.targetTask = 'summary'
      metadata.teacherMode = 'review'
      metadata.command = message.startsWith('/') ? message.split(/\s+/)[0] : undefined
    }

    if (intent === 'learning_action') {
      metadata.targetTask = 'daily_plan'
      metadata.teacherMode = 'review'
    }

    if (intent !== 'mode_switch_request') {
      return metadata
    }

    metadata.command = message.startsWith('/') ? message.split(/\s+/)[0] : undefined

    if (/背单词|学单词|词汇学习|\/背单词|vocabulary|word/i.test(message)) {
      metadata.targetTask = 'word_theme_learning'
      metadata.teacherMode = 'guide'
    } else if (/复习|易错词|review/i.test(message)) {
      metadata.targetTask = 'word_review'
      metadata.teacherMode = 'review'
    } else if (/长难句|练句子|sentence/i.test(message)) {
      metadata.targetTask = 'long_sentence'
      metadata.teacherMode = 'guide'
    } else if (/语法|纠错|grammar/i.test(message)) {
      metadata.targetTask = 'grammar_correction'
      metadata.teacherMode = 'explain'
    } else if (/自由聊天|自由对话|free/i.test(message)) {
      metadata.targetTask = 'free_chat'
      metadata.teacherMode = 'chat'
    } else if (/今日计划|每天.*什么|daily|plan/i.test(message)) {
      metadata.targetTask = 'daily_plan'
      metadata.teacherMode = 'review'
    }

    return metadata
  }
}
