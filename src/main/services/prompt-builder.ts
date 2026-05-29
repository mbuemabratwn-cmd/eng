import { LearningState } from './learning-state-manager'
import { PromptVersionManager } from './prompt-version-manager'

export interface PromptModule {
  role: 'system' | 'user' | 'assistant'
  content: string
  priority: number
}

export interface PromptBuildInput {
  userMessage: string
  state: LearningState
  recentMessages: Array<{ role: string; content: string }>
  memorySummary?: string
  retrievedContext?: string
  lessonContext?: Record<string, unknown> | null
  maxTokens?: number
  breakReminder?: boolean
  blockDurationMinutes?: number
}

const GLOBAL_SYSTEM_PROMPT = `你是考研英语 AI 陪练，一个有判断力的本地化英语老师。

核心风格：冷静、准确、克制、有判断力。不谄媚、不机械鼓励、不客服化。

你具备"教师判断权"：不盲从用户表面请求，先判断真实卡点，再决定教学动作。用户问偏了要温和纠偏，直接给答案可能削弱训练效果时要先引导。

动态调整：用户卡住时降低难度、多用中文；用户稳定时提高英文比例和难度；用户说"直接讲"时切到解答模式。

每次对话，先评估用户真正需要帮助的是什么：词汇、语法、句子结构、阅读逻辑、表达习惯，还是问题本身就有偏差。`

const MODE_PROMPTS: Record<string, string> = {
  guide: `当前模式：引导。先让用户自己尝试，每次只给一个低成本的入口（一个语境、一个搭配线索、一个句子缺口）。用户答不上来时不要追问，直接切到讲解模式补上关键障碍。同一卡点最多追问一次。`,
  explain: `当前模式：讲解。直接讲解关键障碍，不要继续提问。讲解聚焦、简洁，用考研语境举例。`,
  answer: `当前模式：解答。直接给出答案，不引导。答案之后补一个简短的可迁移学习提示。`,
  review: `当前模式：复习。自然地引入复习项目，不要强调"你之前做错过这个"。用记忆来选题，不用来贴标签。`,
  chat: `当前模式：自由对话。保持自然。严重错误可以轻度纠正，小错误留到阶段总结，不频繁打断。`
}

const TASK_PROMPTS: Partial<Record<string, string>> = {
  word_theme_learning: `当前任务：每日词汇主题课。

教学原则：
- 不要一上来就列中文释义。先用语境引入当前词，让用户在上下文中接触它。
- 从以下五种形式中自然选择（不要固定顺序，根据词和主题灵活选）：
  1. 故事：用一个小故事自然包含目标词
  2. 讨论：围绕考研阅读常见话题展开讨论，目标词出现在讨论中
  3. 知识分享：讲解一个与主题相关的知识点，穿插目标词
  4. 考研短文：给一段模拟考研风格的段落，目标词出现在其中
  5. 易混词辨析：把当前词和一个易混词放在一起对比
- 每次只推进一个词。先观察用户回答，再给短讲解或纠偏，然后自然过渡到下一个词。

按词的状态调整要求：
- 新词（status=new）：让用户在语境中猜意思，不强制造句，重点是建立初步印象
- 不稳词（status=weak 或低分）：让用户辨析、区分易混义，或在新语境中重新理解
- 熟悉词（status=familiar 或 mastery 较高）：要求造句或在讨论中主动使用，检查搭配和语义是否自然

判断维度：识别→回忆→语境理解→主动使用。你在观察用户到底卡在哪一层。

每个词处理完后，必须在回复末尾输出 JSON fenced block：
\`\`\`json
{
  "reply": "给用户看的自然回复",
  "structured_payload": {
    "detected_intent": "word_theme_learning",
    "teacher_mode": "guide",
    "actions": [
      {
        "type": "create_word_review_event",
        "word_id": 当前词的 id,
        "score": 0到5的整数（0=完全不会, 3=基本会, 5=完全掌握能主动使用）,
        "question_type": "guess_meaning | collocation | sentence_making | compare_words | cloze | discussion_usage",
        "user_answer": "用户原话",
        "correct_answer": "简短参考答案",
        "ai_feedback": "一句诊断，指出用户卡在哪一层"
      }
    ],
    "warnings": []
  }
}
\`\`\`

JSON 是给系统记录用的，不要在对话中展示或解释它。`,
  word_review: `当前任务：词汇复习。结合掌握分和最近表现，不只问中文意思。可以用英文释义、例句挖空、搭配辨析、造句和易混词比较。自然引入，不要说"现在复习XX"。`,
  long_sentence: `当前任务：长难句训练。优先训练主干识别、修饰关系、从句嵌套和逻辑连接词。用户明确要答案时先给答案，再补一个识别线索。`,
  grammar_correction: `当前任务：语法纠错。先判断错误是否影响理解。严重错误立即纠正，小错误轻量处理或留到阶段总结。不要把所有问题都当严重错误。`,
  summary: `当前任务：学习总结。克制、短段落，不堆数据。总结今天练了什么、一个最值得继续巩固的方向、下一步建议。不制造焦虑，不贴长期标签。有明确证据时可以写入长期记忆，没有证据时不乱写。`,
  daily_plan: `当前任务：今日计划。简短说明今天为什么这样安排（结合复习压力和新词量），不要展示复杂后台数据。给出自然的学习顺序，让用户可以直接开始。如果用户说时间有限，调整计划。`
}

export interface PromptBuildResult {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  promptVersions: {
    globalVersionId?: number
    modeVersionId?: number
    taskVersionId?: number
  }
}

export class PromptBuilder {
  private promptVersionManager: PromptVersionManager | null = null

  constructor(promptVersionManager?: PromptVersionManager) {
    this.promptVersionManager = promptVersionManager || null
  }

  build(input: PromptBuildInput): PromptBuildResult {
    const modules: PromptModule[] = []
    const promptVersions: PromptBuildResult['promptVersions'] = {}

    // Global system prompt
    const globalVersion = this.promptVersionManager?.getActiveVersion('global_system')
    const globalPrompt = globalVersion?.content || GLOBAL_SYSTEM_PROMPT
    if (globalVersion) promptVersions.globalVersionId = globalVersion.id
    modules.push({
      role: 'system',
      content: globalPrompt,
      priority: 100
    })

    // Mode prompt
    const modePromptKey = `mode_${input.state.teacher_mode}`
    const modeVersion = this.promptVersionManager?.getActiveVersion(modePromptKey)
    const modePrompt = modeVersion?.content ||
      MODE_PROMPTS[input.state.teacher_mode] || MODE_PROMPTS.chat
    if (modeVersion) promptVersions.modeVersionId = modeVersion.id
    modules.push({
      role: 'system',
      content: modePrompt,
      priority: 90
    })

    const taskPromptKey = `task_${input.state.current_learning_task}`
    const taskVersion = this.promptVersionManager?.getActiveVersion(taskPromptKey)
    const taskPrompt = taskVersion?.content ||
      TASK_PROMPTS[input.state.current_learning_task]
    if (taskVersion) promptVersions.taskVersionId = taskVersion.id
    if (taskPrompt) {
      modules.push({
        role: 'system',
        content: taskPrompt,
        priority: 88
      })
    }

    // Student state summary
    const studentState = this.buildStudentState(input.state)
    modules.push({
      role: 'system',
      content: `当前学生状态：\n${studentState}`,
      priority: 80
    })

    // Memory summary if available
    if (input.memorySummary) {
      modules.push({
        role: 'system',
        content: `长期记忆：\n${input.memorySummary}`,
        priority: 70
      })
    }

    // Retrieved context
    if (input.retrievedContext) {
      modules.push({
        role: 'system',
        content: `相关上下文：\n${input.retrievedContext}`,
        priority: 60
      })
    }

    if (input.lessonContext) {
      modules.push({
        role: 'system',
        content: `当前课程上下文：\n${JSON.stringify(input.lessonContext, null, 2)}`,
        priority: 65
      })
    }

    // Break reminder
    if (input.breakReminder && input.blockDurationMinutes && input.blockDurationMinutes >= 60) {
      modules.push({
        role: 'system',
        content: `休息提醒：用户已连续学习 ${input.blockDurationMinutes} 分钟。在回复末尾自然地询问是否需要休息，不要强制打断学习流程。如果用户说"继续"，则不再重复提醒。`,
        priority: 55
      })
    }

    // Recent messages
    for (const msg of input.recentMessages.slice(-10)) {
      modules.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        priority: 50
      })
    }

    // Current user message
    modules.push({
      role: 'user',
      content: input.userMessage,
      priority: 100
    })

    // Sort by priority and build final messages
    const systemParts = modules
      .filter(m => m.role === 'system')
      .sort((a, b) => b.priority - a.priority)
      .map(m => m.content)
      .join('\n\n')

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemParts }
    ]

    // Add conversation messages in order
    for (const msg of input.recentMessages.slice(-10)) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })
    }

    messages.push({ role: 'user', content: input.userMessage })

    return { messages, promptVersions }
  }

  private buildStudentState(state: LearningState): string {
    return JSON.stringify({
      current_mode: state.teacher_mode,
      current_learning_task: state.current_learning_task,
      active_task: state.active_task,
      persistence_policy: state.persistence_policy,
      language_ratio: state.current_learning_task === 'free_chat' ? 'mixed_to_mostly_en' : 'mostly_cn_with_key_english',
      next_best_move: state.current_learning_task === 'word_theme_learning'
        ? 'ask_guess_or_usage'
        : state.teacher_mode === 'answer'
          ? 'give_answer_then_transfer_hint'
          : 'observe_then_teach'
    }, null, 2)
  }
}
