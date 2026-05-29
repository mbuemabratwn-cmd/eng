import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { initDatabase, closeDatabase, getDatabasePath } from './db/database'
import { ChatRepository } from './repositories/chat.repository'
import { SettingsRepository } from './repositories/settings.repository'
import { JobRepository } from './repositories/job.repository'
import { LearningBlockRepository } from './repositories/learning-block.repository'
import { LearningEventRepository } from './repositories/learning-event.repository'
import { VocabularyRepository } from './repositories/vocabulary.repository'
import { DailyTargetPoolRepository } from './repositories/daily-target-pool.repository'
import { LongSentenceRepository } from './repositories/long-sentence.repository'
import { GrammarRepository } from './repositories/grammar.repository'
import { SummaryRepository } from './repositories/summary.repository'
import { FileRepository } from './repositories/file.repository'
import { AIProvider } from './ai/provider'
import { MockAIProvider } from './ai/mock-provider'
import { OpenAIProvider } from './ai/openai-provider'
import { JobQueue } from './services/job-queue'
import { AILogger } from './services/ai-logger'
import { LearningStateManager } from './services/learning-state-manager'
import { IntentRouter } from './services/intent-router'
import { AIOrchestrator } from './services/ai-orchestrator'
import { ActionDispatcher } from './services/action-dispatcher'
import { VocabularyEngine } from './services/vocabulary-engine'
import { ReviewLoadManager } from './services/review-load-manager'
import { DailyTargetPoolManager } from './services/daily-target-pool-manager'
import { VocabularyThemeLesson } from './services/vocabulary-theme-lesson'
import { SentenceEngine } from './services/sentence-engine'
import { GrammarEngine } from './services/grammar-engine'
import { SummaryModule } from './services/summary-module'
import { MemoryEngine } from './services/memory-engine'
import { FileIngestionEngine } from './services/file-ingestion-engine'
import { BackupService } from './services/backup-service'
import { DatabaseHealthService } from './services/database-health-service'

let mainWindow: BrowserWindow | null = null
let chatRepo: ChatRepository
let settingsRepo: SettingsRepository
let blockRepo: LearningBlockRepository
let eventRepo: LearningEventRepository
let vocabRepo: VocabularyRepository
let vocabEngine: VocabularyEngine
let poolRepo: DailyTargetPoolRepository
let reviewLoadManager: ReviewLoadManager
let poolManager: DailyTargetPoolManager
let themeLesson: VocabularyThemeLesson
let sentenceRepo: LongSentenceRepository
let sentenceEngine: SentenceEngine
let grammarRepo: GrammarRepository
let grammarEngine: GrammarEngine
let summaryRepo: SummaryRepository
let summaryModule: SummaryModule
let memoryEngine: MemoryEngine
let fileRepo: FileRepository
let fileEngine: FileIngestionEngine
let backupService: BackupService
let healthService: DatabaseHealthService
let jobQueue: JobQueue
let aiLogger: AILogger
let aiProvider: AIProvider
let stateManager: LearningStateManager
let intentRouter: IntentRouter
let orchestrator: AIOrchestrator
let currentSessionId: number | null = null

const LEARNING_STATE_SETTING_KEY = 'learning.current_state'

function getLearningStateSnapshot() {
  const state = stateManager.getState()
  return {
    currentSessionId,
    studyDay: state.study_day,
    currentTask: state.current_learning_task,
    teacherMode: state.teacher_mode,
    activeBlockId: state.active_learning_block_id,
    activeTask: state.active_task,
    persistencePolicy: state.persistence_policy,
    lessonState: themeLesson?.getLessonState?.() || null
  }
}

function persistLearningState(): void {
  if (!settingsRepo || !stateManager) return
  settingsRepo.set(LEARNING_STATE_SETTING_KEY, stateManager.toJSON())
}

function ensureActiveBlock(sessionId: number) {
  const studyDay = stateManager.getState().study_day
  let activeBlock = blockRepo.getActiveBlock(studyDay)
  if (!activeBlock) {
    activeBlock = blockRepo.create(studyDay, sessionId)
  }
  stateManager.setActiveBlock(activeBlock.id)
  stateManager.setActiveSession(sessionId)
  return activeBlock
}

function saveAssistantMessage(sessionId: number, content: string) {
  return chatRepo.saveMessage(sessionId, 'assistant', content)
}

function buildDailyPlanMessage(): string {
  const pool = poolManager.getOrCreateTodayPool()
  const reviewLoad = reviewLoadManager.getReviewLoad()
  const loadText = reviewLoad.reviewLoadRatio >= 0.6
    ? '复习压力偏高，所以新词会收一点，先把旧词稳住。'
    : '复习压力还可以，今天可以正常推进新词。'

  return [
    `今天建议先做词汇主题课：约 ${pool.new_word_count} 个新词，其中 ${pool.focused_word_count} 个重点精学。`,
    `到期复习词大约 ${pool.review_word_count} 个。${loadText}`,
    '顺序不用你管理：先用语境带一组词，再穿插易混词辨析和一两次小输出。你直接说“背单词”就可以开始。'
  ].join('\n\n')
}

function buildVocabularyLessonOpening(): string {
  const lessonState = themeLesson.getLessonState()
  const selection = lessonState.selection
  const current = themeLesson.getCurrentWord()

  if (!selection || !current) {
    return '现在词库里还没有可用的新词或复习词。你可以先通过文件或词表导入一批考研词汇。'
  }

  const currentWord = current.word
  const context = themeLesson.getPromptContext()
  const question = typeof context?.last_question === 'string'
    ? context.last_question
    : `先看 ${currentWord.word}。你猜它在考研语境里通常表达什么？`

  return [
    `今天进入词汇主题课：${selection.theme}。`,
    `本轮会接触 ${selection.totalWords} 个词，其中 ${selection.focusedWords.length} 个重点精学，${selection.reviewWords.length} 个复习词。`,
    '先不看完整词表，我们从一个词开始，用语境和讨论来学。',
    `当前词：${currentWord.word}${currentWord.phonetic ? ` ${currentWord.phonetic}` : ''}`,
    currentWord.english_meaning ? `英文释义线索：${currentWord.english_meaning}` : '',
    question
  ].filter(Boolean).join('\n\n')
}

function startVocabularyThemeLesson(sessionId: number) {
  const activeBlock = ensureActiveBlock(sessionId)
  const pool = poolManager.getOrCreateTodayPool()
  const selection = themeLesson.getLessonState().isActive
    ? themeLesson.getLessonState().selection
    : themeLesson.startLesson({
      wordCount: pool.new_word_count,
      focusedWordCount: pool.focused_word_count
    })

  stateManager.transition('USER_SWITCHES_MODE', {
    task: 'word_theme_learning',
    teacherMode: 'guide',
    theme: selection?.theme || 'daily_vocabulary',
    progress: {
      completed_words: themeLesson.getLessonState().completedWords,
      total_words: themeLesson.getLessonState().totalWords
    }
  })
  stateManager.setActiveBlock(activeBlock.id)
  persistLearningState()

  return buildVocabularyLessonOpening()
}

function createLightSummary(sessionId: number, reason: string): string {
  const state = stateManager.getState()
  const blockId = state.active_learning_block_id
  const studyDay = state.study_day

  if (!blockId) {
    stateManager.transition('USER_STOPS_LEARNING')
    persistLearningState()
    return '现在没有正在进行的学习块。需要的话，直接说“背单词”，我们重新开始。'
  }

  const block = blockRepo.getBlock(blockId)
  const reviews = vocabRepo.getReviewEventsByBlock(blockId)
  const events = eventRepo.getEventsByBlock(blockId)
  const lessonSummary = themeLesson.getThemeSummary()
  const lowScoreReviews = reviews.filter(r => (r.score ?? 0) < 3 || r.is_correct === 0)
  const durationMinutes = block
    ? Math.max(1, Math.round((Date.now() - new Date(block.started_at).getTime()) / 60000))
    : undefined

  const activities = [
    lessonSummary ? `词汇主题课：${lessonSummary.theme}` : null,
    reviews.length > 0 ? `记录 ${reviews.length} 次词汇互动` : null,
    events.length > 0 ? `记录 ${events.length} 条学习事件` : null
  ].filter(Boolean) as string[]

  const mainIssue = lowScoreReviews.length > 0
    ? `有 ${lowScoreReviews.length} 个词还不稳，下一轮先用语境和易混辨析巩固。`
    : '这一轮没有明显低分词，下一次可以继续推进新词，同时穿插少量复习。'

  const content = [
    `这轮先收一下。${reason}`,
    activities.length > 0 ? `你刚才主要做了：${activities.join('、')}。` : '这轮学习记录不多，先不做过度判断。',
    mainIssue,
    '下次建议：先继续词汇主题课，再把不稳的词放进一个短句里用一次。'
  ].join('\n\n')

  const blockSummary = summaryModule.createBlockSummary({
    blockId,
    summary: content,
    activities,
    vocabularyLearned: reviews.length,
    durationMinutes
  })

  summaryModule.createDailySummary({
    studyDay,
    content,
    keyPoints: activities,
    recommendations: ['下次先复习低分词，再继续新词语境训练']
  })

  if (lowScoreReviews.length > 0) {
    memoryEngine.addMemory({
      memoryType: 'vocabulary',
      category: 'word_theme_learning',
      content: `最近词汇主题课中有 ${lowScoreReviews.length} 个词在语境理解或主动使用上不稳，需要后续用短句和辨析复现。`,
      confidence: 0.6,
      sourceType: 'block_summary',
      sourceId: blockSummary.id
    })
  }

  if (lessonSummary) {
    themeLesson.endLesson()
  }
  blockRepo.endBlock(blockId, content)
  stateManager.transition('USER_STOPS_LEARNING')
  persistLearningState()

  return content
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIPC() {
  ipcMain.handle('chat:sendMessage', async (_event, payload: { content: string; sessionId?: number }) => {
    const sessionId = payload.sessionId || currentSessionId
    if (!sessionId) {
      const session = chatRepo.createSession('新对话', 'free_chat')
      currentSessionId = session.id
    }
    const sid = sessionId || currentSessionId!

    // Classify intent
    const intentResult = intentRouter.classify(payload.content)

    // Destructive actions require confirmation - block and ask
    if (intentRouter.requiresConfirmation(intentResult.intent)) {
      const userMessage = chatRepo.saveMessage(sid, 'user', payload.content)
      return {
        userMessage,
        assistantMessage: null,
        sessionId: sid,
        requiresConfirmation: true,
        confirmationMessage: '此操作具有破坏性，需要确认。请确认后继续。',
        pendingIntent: intentResult.intent
      }
    }

    if (intentResult.intent === 'direct_answer_request') {
      stateManager.transition('USER_REQUESTS_DIRECT_ANSWER')
      persistLearningState()
    }

    // Handle summary and stop/pause as a light learning closeout.
    if (intentResult.intent === 'summary_request' || intentResult.intent === 'stop_or_pause_request') {
      const userMessage = chatRepo.saveMessage(sid, 'user', payload.content)
      const summary = createLightSummary(sid, intentResult.intent === 'summary_request' ? '这是本轮轻量总结。' : '你说先停一下，我把当前进度记住。')
      const assistantMessage = saveAssistantMessage(sid, summary)
      return {
        userMessage,
        assistantMessage,
        sessionId: sid,
        learningState: getLearningStateSnapshot(),
        lessonState: themeLesson.getLessonState()
      }
    }

    if (intentResult.intent === 'learning_action' && intentResult.metadata?.targetTask === 'daily_plan') {
      const userMessage = chatRepo.saveMessage(sid, 'user', payload.content)
      ensureActiveBlock(sid)
      stateManager.transition('USER_REQUESTS_DAILY_PLAN')
      const assistantMessage = saveAssistantMessage(sid, buildDailyPlanMessage())
      persistLearningState()
      return {
        userMessage,
        assistantMessage,
        sessionId: sid,
        learningState: getLearningStateSnapshot(),
        lessonState: themeLesson.getLessonState()
      }
    }

    // Handle mode switch
    if (intentResult.intent === 'mode_switch_request') {
      const targetTask = intentResult.metadata?.targetTask || 'free_chat'
      const teacherMode = intentResult.metadata?.teacherMode || 'chat'

      if (targetTask === 'word_theme_learning') {
        const userMessage = chatRepo.saveMessage(sid, 'user', payload.content)
        const assistantMessage = saveAssistantMessage(sid, startVocabularyThemeLesson(sid))
        return {
          userMessage,
          assistantMessage,
          sessionId: sid,
          learningState: getLearningStateSnapshot(),
          lessonState: themeLesson.getLessonState()
        }
      }

      if (targetTask === 'daily_plan') {
        const userMessage = chatRepo.saveMessage(sid, 'user', payload.content)
        ensureActiveBlock(sid)
        stateManager.transition('USER_REQUESTS_DAILY_PLAN')
        const assistantMessage = saveAssistantMessage(sid, buildDailyPlanMessage())
        persistLearningState()
        return {
          userMessage,
          assistantMessage,
          sessionId: sid,
          learningState: getLearningStateSnapshot(),
          lessonState: themeLesson.getLessonState()
        }
      }

      stateManager.transition('USER_SWITCHES_MODE', {
        task: targetTask,
        teacherMode
      })
      persistLearningState()
    }

    // Apply persistence policy from intent
    const policy = intentRouter.getPersistencePolicy(intentResult.intent)
    if (policy) {
      stateManager.setPersistencePolicy(policy as any)
    }

    // Ensure an active learning block exists
    const studyDay = stateManager.getState().study_day
    let activeBlock = blockRepo.getActiveBlock(studyDay)
    if (!activeBlock) {
      activeBlock = blockRepo.create(studyDay, sid)
      stateManager.setActiveBlock(activeBlock.id)
    }

    // Update state manager with session
    stateManager.setActiveSession(sid)

    // Save user message first (before AI call) - this must never be rolled back
    const userMessage = chatRepo.saveMessage(sid, 'user', payload.content)

    const startTime = Date.now()
    try {
      // Use orchestrator for AI call with structured output parsing
      const result = await orchestrator.processMessage({
        userMessage: payload.content,
        sessionId: sid
      })

      const latency = Date.now() - startTime

      // Log successful AI request
      aiLogger.log({
        provider: aiProvider.name,
        status: 'success',
        latency_ms: latency,
        input_tokens_estimate: result.usage?.inputTokens,
        output_tokens_estimate: result.usage?.outputTokens,
        related_session_id: sid,
        related_message_id: userMessage.id
      })

      // Transition state after AI reply
      stateManager.transition('AI_FINISHES_REPLY')
      if (stateManager.getState().current_learning_task === 'word_theme_learning' && themeLesson.getCurrentWord()) {
        const alreadyRecorded = result.dispatchResult?.dispatched.some(d => d.action.type === 'create_word_review_event') ||
          result.dispatchResult?.failed.some(d => d.action.type === 'create_word_review_event') || false
        if (!alreadyRecorded && intentResult.intent !== 'direct_answer_request') {
          // AI 未返回结构化评分，降级处理：不推进课程，只记录为一次轻量互动
          // 不调用 recordWordReview 避免重复记录，只更新活跃任务进度
        }
        const lessonState = themeLesson.getLessonState()
        stateManager.updateActiveTask({
          progress: {
            completed_words: lessonState.completedWords,
            total_words: lessonState.totalWords,
            progress_percent: lessonState.progressPercent
          }
        })
      }
      persistLearningState()

      return {
        userMessage,
        assistantMessage: result.assistantMessage,
        sessionId: sid,
        learningState: getLearningStateSnapshot(),
        lessonState: themeLesson.getLessonState()
      }
    } catch (err) {
      const latency = Date.now() - startTime
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Log failed AI request
      aiLogger.log({
        provider: aiProvider.name,
        status: 'failed',
        latency_ms: latency,
        error_message: errorMessage,
        related_session_id: sid,
        related_message_id: userMessage.id
      })

      // User message is preserved - return error but keep the message
      return {
        userMessage,
        assistantMessage: null,
        error: errorMessage,
        sessionId: sid
      }
    }
  })

  ipcMain.handle('chat:getMessages', async (_event, payload: { sessionId: number; limit?: number; offset?: number }) => {
    return chatRepo.getMessages(payload.sessionId, payload.limit || 50, payload.offset || 0)
  })

  ipcMain.handle('chat:getSessions', async () => {
    return chatRepo.getRecentSessions()
  })

  ipcMain.handle('chat:getSessionList', async (_event, payload: { limit?: number; offset?: number }) => {
    const limit = payload.limit || 50
    const offset = payload.offset || 0
    return chatRepo.getSessions(limit, offset)
  })

  ipcMain.handle('chat:abort', async () => {
    if (orchestrator) {
      orchestrator.abort()
    }
    return { success: true }
  })

  ipcMain.handle('chat:regenerateMessage', async (_event, payload: { messageId: number; sessionId?: number }) => {
    const sessionId = payload.sessionId || currentSessionId
    if (!sessionId) throw new Error('No active session')

    // Find the error message and the previous user message
    const messages = chatRepo.getMessages(sessionId, 50, 0)
    const errorIdx = messages.findIndex(m => m.id === payload.messageId)
    if (errorIdx === -1) throw new Error('Message not found')

    // Find the user message before the error
    let userContent = ''
    for (let i = errorIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userContent = messages[i].content
        break
      }
    }
    if (!userContent) throw new Error('No user message found to regenerate from')

    // Delete the error message
    chatRepo.deleteMessage(payload.messageId)

    // Re-process through orchestrator
    const startTime = Date.now()
    try {
      const result = await orchestrator.processMessage({
        userMessage: userContent,
        sessionId
      })
      const latency = Date.now() - startTime
      aiLogger.log({
        provider: aiProvider.name,
        status: 'success',
        latency_ms: latency,
        input_tokens_estimate: result.usage?.inputTokens,
        output_tokens_estimate: result.usage?.outputTokens,
        related_session_id: sessionId,
        related_message_id: payload.messageId
      })
      return { assistantMessage: result.assistantMessage, error: null }
    } catch (err) {
      const latency = Date.now() - startTime
      const errorMessage = err instanceof Error ? err.message : String(err)
      aiLogger.log({
        provider: aiProvider.name,
        status: 'failed',
        latency_ms: latency,
        error_message: errorMessage,
        related_session_id: sessionId,
        related_message_id: payload.messageId
      })
      return { assistantMessage: null, error: errorMessage }
    }
  })

  ipcMain.handle('chat:createSession', async (_event, payload?: { title?: string; sessionType?: string }) => {
    const session = chatRepo.createSession(payload?.title, payload?.sessionType)
    currentSessionId = session.id
    return session
  })

  ipcMain.handle('learning:getCurrentState', async () => {
    const state = stateManager.getState()
    return {
      currentSessionId,
      studyDay: state.study_day,
      currentTask: state.current_learning_task,
      teacherMode: state.teacher_mode,
      activeBlockId: state.active_learning_block_id,
      activeTask: state.active_task,
      persistencePolicy: state.persistence_policy
    }
  })

  ipcMain.handle('learning:startLearning', async (_event, payload?: { task?: string; teacherMode?: string }) => {
    const studyDay = stateManager.getState().study_day
    let activeBlock = blockRepo.getActiveBlock(studyDay)
    if (!activeBlock) {
      const sid = currentSessionId || chatRepo.createSession('New Chat', 'free_chat').id
      if (!currentSessionId) currentSessionId = sid
      activeBlock = blockRepo.create(studyDay, sid)
    }
    stateManager.setActiveBlock(activeBlock.id)
    stateManager.transition('USER_STARTS_LEARNING', { blockId: activeBlock.id })
    if (payload?.task) {
      stateManager.transition('USER_SWITCHES_MODE', { task: payload.task, teacherMode: payload.teacherMode })
    }
    return stateManager.getState()
  })

  ipcMain.handle('learning:stopLearning', async () => {
    const blockId = stateManager.getState().active_learning_block_id
    if (blockId) {
      blockRepo.endBlock(blockId, '用户结束学习')
    }
    stateManager.transition('USER_STOPS_LEARNING')
    return stateManager.getState()
  })

  ipcMain.handle('learning:confirmAction', async (_event, payload: { intent: string; confirmed: boolean }) => {
    if (payload.confirmed) {
      stateManager.transition('DESTRUCTIVE_ACTION_CONFIRMED')
      return { success: true, message: '操作已确认。破坏性操作将立即执行。' }
    }
    stateManager.transition('DESTRUCTIVE_ACTION_REQUESTED')
    return { success: false, message: '操作已取消。' }
  })

  ipcMain.handle('learning:classifyIntent', async (_event, message: string) => {
    return intentRouter.classify(message)
  })

  ipcMain.handle('settings:get', async (_event, key: string) => {
    return settingsRepo.get(key)
  })

  ipcMain.handle('settings:update', async (_event, key: string, value: string) => {
    settingsRepo.set(key, value)
    return true
  })

  ipcMain.handle('jobs:getStatus', async (_event, jobId: number) => {
    return jobQueue.getJob(jobId)
  })

  ipcMain.handle('jobs:getFailed', async () => {
    return jobQueue.getFailedJobs()
  })

  ipcMain.handle('jobs:retry', async (_event, jobId: number) => {
    jobQueue.retryJob(jobId)
    return true
  })

  ipcMain.handle('ai:getTodayStats', async () => {
    return aiLogger.getTodayStats()
  })

  // Vocabulary IPC handlers
  ipcMain.handle('vocab:addWord', async (_event, input: { word: string; phonetic?: string; part_of_speech?: string; chinese_meaning?: string; english_meaning?: string; difficulty_level?: number; exam_tags?: string; source?: string }) => {
    return vocabEngine.addWord(input)
  })

  ipcMain.handle('vocab:importWords', async (_event, input: { words: Array<{ word: string; phonetic?: string; part_of_speech?: string; chinese_meaning?: string; english_meaning?: string; difficulty_level?: number; exam_tags?: string; source?: string }>; skipDuplicates?: boolean }) => {
    return vocabEngine.importWords(input)
  })

  ipcMain.handle('vocab:getProgressInfo', async (_event, wordId: number) => {
    return vocabEngine.getWordProgressInfo(wordId)
  })

  ipcMain.handle('vocab:getProgressInfoByText', async (_event, word: string) => {
    return vocabEngine.getWordProgressInfoByText(word)
  })

  ipcMain.handle('vocab:recordReview', async (_event, input: { wordId: number; sessionId?: number; blockId?: number; mode?: string; questionType?: string; prompt?: string; userAnswer?: string; correctAnswer?: string; isCorrect: boolean; score?: number; responseTimeMs?: number; aiFeedback?: string }) => {
    return vocabEngine.recordReview(input)
  })

  ipcMain.handle('vocab:getDueReview', async (_event, limit?: number) => {
    return vocabEngine.getDueReviewWords(limit)
  })

  ipcMain.handle('vocab:getWeakWords', async (_event, limit?: number) => {
    return vocabEngine.getWeakWords(limit)
  })

  ipcMain.handle('vocab:getStats', async () => {
    return vocabEngine.getStats()
  })

  ipcMain.handle('vocab:search', async (_event, query: string, limit?: number) => {
    return vocabRepo.searchWords(query, limit)
  })

  // Daily target pool and review load IPC handlers
  ipcMain.handle('pool:getOrCreateToday', async (_event, config?: { recommendedMinutes?: number; baseNewWordCount?: number; focusedWordCount?: number; targetType?: string }) => {
    return poolManager.getOrCreateTodayPool(config)
  })

  ipcMain.handle('pool:getCurrent', async () => {
    return poolManager.getCurrentPool()
  })

  ipcMain.handle('pool:updateProgress', async (_event, poolId: number, updates: { completedNewWords?: number; completedReviewWords?: number; completedFocusedWords?: number }) => {
    poolManager.updatePoolProgress(poolId, updates)
    return true
  })

  ipcMain.handle('pool:markCompleted', async (_event, poolId: number) => {
    poolManager.markPoolCompleted(poolId)
    return true
  })

  ipcMain.handle('pool:getRecent', async (_event, limit?: number) => {
    return poolManager.getRecentPools(limit)
  })

  ipcMain.handle('pool:getSummary', async (_event, poolId: number) => {
    const pool = poolRepo.getById(poolId)
    if (!pool) return null
    return poolManager.getPoolSummary(pool)
  })

  ipcMain.handle('review:getLoad', async () => {
    return reviewLoadManager.getReviewLoad()
  })

  ipcMain.handle('review:getLoadLevel', async () => {
    return reviewLoadManager.getLoadLevel()
  })

  ipcMain.handle('review:shouldReduce', async () => {
    return reviewLoadManager.shouldReduceNewWords()
  })

  // Vocabulary theme lesson IPC handlers
  ipcMain.handle('theme:startLesson', async (_event, config?: { theme?: string; wordCount?: number; focusedWordCount?: number }) => {
    return themeLesson.startLesson(config)
  })

  ipcMain.handle('theme:getCurrentWord', async () => {
    return themeLesson.getCurrentWord()
  })

  ipcMain.handle('theme:recordReview', async (_event, isCorrect: boolean, score?: number) => {
    themeLesson.recordWordReview(isCorrect, score)
    return true
  })

  ipcMain.handle('theme:getState', async () => {
    return themeLesson.getLessonState()
  })

  ipcMain.handle('theme:getSummary', async () => {
    return themeLesson.getThemeSummary()
  })

  ipcMain.handle('theme:endLesson', async () => {
    themeLesson.endLesson()
    return true
  })

  // Sentence engine IPC handlers
  ipcMain.handle('sentence:add', async (_event, input: { sentence: string; translation?: string; source?: string; difficultyLevel?: number; createdByAi?: boolean; aiModel?: string; topic?: string; grammarPoints?: string[] }) => {
    return sentenceEngine.addSentence(input)
  })

  ipcMain.handle('sentence:addAI', async (_event, input: { sentence: string; translation?: string; source?: string; difficultyLevel?: number; topic?: string; grammarPoints?: string[] }, aiModel: string) => {
    return sentenceEngine.addAISentence(input, aiModel)
  })

  ipcMain.handle('sentence:addAnalysis', async (_event, input: { sentenceId: number; analysisType: string; content: string; orderIndex?: number }) => {
    return sentenceEngine.addAnalysis(input)
  })

  ipcMain.handle('sentence:getWithAnalysis', async (_event, sentenceId: number) => {
    return sentenceEngine.getSentenceWithAnalysis(sentenceId)
  })

  ipcMain.handle('sentence:startPractice', async (_event, difficultyLevel?: number, topic?: string) => {
    return sentenceEngine.startPractice(difficultyLevel, topic)
  })

  ipcMain.handle('sentence:getCurrent', async () => {
    return sentenceEngine.getCurrentSentence()
  })

  ipcMain.handle('sentence:recordGuess', async (_event, input: { sentenceId: number; userGuess: string; isCorrect: boolean; scores?: { comprehension?: number; structure?: number; vocabulary?: number; grammar?: number } }) => {
    return sentenceEngine.recordGuess(input)
  })

  ipcMain.handle('sentence:endPractice', async () => {
    sentenceEngine.endPractice()
    return true
  })

  ipcMain.handle('sentence:getState', async () => {
    return sentenceEngine.getPracticeState()
  })

  ipcMain.handle('sentence:getDueReview', async (_event, limit?: number) => {
    return sentenceEngine.getDueReviewSentences(limit)
  })

  ipcMain.handle('sentence:getWeak', async (_event, limit?: number) => {
    return sentenceEngine.getWeakSentences(limit)
  })

  ipcMain.handle('sentence:getStats', async () => {
    return sentenceEngine.getStats()
  })

  ipcMain.handle('sentence:getWeaknessCandidates', async () => {
    return sentenceEngine.getPendingWeaknessCandidates()
  })

  ipcMain.handle('sentence:markWeaknessProcessed', async (_event, id: number) => {
    sentenceEngine.markWeaknessCandidateProcessed(id)
    return true
  })

  // Grammar engine IPC handlers
  ipcMain.handle('grammar:recordError', async (_event, input: { sessionId?: number; blockId?: number; errorType: string; errorText: string; correction?: string; contextSentence?: string; severity?: 'minor' | 'moderate' | 'serious'; aiFeedback?: string }) => {
    return grammarEngine.recordError(input)
  })

  ipcMain.handle('grammar:recordSeriousError', async (_event, input: { sessionId?: number; blockId?: number; errorType: string; errorText: string; correction?: string; contextSentence?: string; aiFeedback?: string }) => {
    return grammarEngine.recordSeriousError(input)
  })

  ipcMain.handle('grammar:recordMinorError', async (_event, input: { sessionId?: number; blockId?: number; errorType: string; errorText: string; correction?: string; contextSentence?: string; aiFeedback?: string }) => {
    return grammarEngine.recordMinorError(input)
  })

  ipcMain.handle('grammar:acknowledgeError', async (_event, errorId: number) => {
    grammarEngine.acknowledgeError(errorId)
    return true
  })

  ipcMain.handle('grammar:getErrorsBySession', async (_event, sessionId: number, limit?: number) => {
    return grammarEngine.getErrorEventsBySession(sessionId, limit)
  })

  ipcMain.handle('grammar:getSeriousErrors', async (_event, limit?: number) => {
    return grammarEngine.getSeriousErrors(limit)
  })

  ipcMain.handle('grammar:getUnacknowledged', async (_event, limit?: number) => {
    return grammarEngine.getUnacknowledgedErrors(limit)
  })

  ipcMain.handle('grammar:getActiveIssues', async () => {
    return grammarEngine.getActiveIssueSummaries()
  })

  ipcMain.handle('grammar:getIssuesByType', async (_event, issueType: string) => {
    return grammarEngine.getIssueSummariesByType(issueType)
  })

  ipcMain.handle('grammar:createIssuePattern', async (_event, input: { issueType: string; issuePattern: string; exampleErrors?: string[]; suggestedRule?: string }) => {
    return grammarEngine.createIssuePattern(input)
  })

  ipcMain.handle('grammar:getWeaknessCandidates', async () => {
    return grammarEngine.getPendingWeaknessCandidates()
  })

  ipcMain.handle('grammar:markWeaknessProcessed', async (_event, id: number) => {
    grammarEngine.markWeaknessCandidateProcessed(id)
    return true
  })

  ipcMain.handle('grammar:getStats', async () => {
    return grammarEngine.getStats()
  })

  // Summary module IPC handlers
  ipcMain.handle('summary:createDaily', async (_event, input: { studyDay?: string; content: string; keyPoints?: string[]; recommendations?: string[] }) => {
    return summaryModule.createDailySummary(input)
  })

  ipcMain.handle('summary:getDaily', async (_event, studyDay?: string) => {
    return summaryModule.getDailySummary(studyDay)
  })

  ipcMain.handle('summary:getDailyWithStats', async (_event, studyDay?: string) => {
    return summaryModule.getDailySummaryWithStats(studyDay)
  })

  ipcMain.handle('summary:getRecentDaily', async (_event, limit?: number) => {
    return summaryModule.getRecentDailySummaries(limit)
  })

  ipcMain.handle('summary:createWeekly', async (_event, input: { weekStart: string; weekEnd: string; summary: string; strengths?: string[]; weaknesses?: string[]; recommendations?: string[]; overallScore?: number }) => {
    return summaryModule.createWeeklyReview(input)
  })

  ipcMain.handle('summary:getWeekly', async (_event, weekStart: string) => {
    return summaryModule.getWeeklyReview(weekStart)
  })

  ipcMain.handle('summary:getRecentWeekly', async (_event, limit?: number) => {
    return summaryModule.getRecentWeeklyReviews(limit)
  })

  ipcMain.handle('summary:createBlock', async (_event, input: { blockId: number; summary: string; activities?: string[]; vocabularyLearned?: number; sentencesPracticed?: number; grammarErrors?: number; durationMinutes?: number }) => {
    return summaryModule.createBlockSummary(input)
  })

  ipcMain.handle('summary:getBlock', async (_event, blockId: number) => {
    return summaryModule.getBlockSummary(blockId)
  })

  ipcMain.handle('summary:getRecentBlocks', async (_event, limit?: number) => {
    return summaryModule.getRecentBlockSummaries(limit)
  })

  ipcMain.handle('summary:getStats', async () => {
    return summaryModule.getStats()
  })

  // Memory engine IPC handlers
  ipcMain.handle('memory:add', async (_event, input: { memoryType: string; category?: string; content: string; confidence?: number; evidenceEventIds?: number[]; sourceType?: string; sourceId?: number }) => {
    return memoryEngine.addMemory(input)
  })

  ipcMain.handle('memory:update', async (_event, id: number, input: { content?: string; confidence?: number; evidenceEventIds?: number[]; status?: string }) => {
    return memoryEngine.updateMemory(id, input)
  })

  ipcMain.handle('memory:get', async (_event, id: number) => {
    return memoryEngine.getMemory(id)
  })

  ipcMain.handle('memory:getActive', async (_event, limit?: number) => {
    return memoryEngine.getActiveMemories(limit)
  })

  ipcMain.handle('memory:getByType', async (_event, memoryType: string, limit?: number) => {
    return memoryEngine.getMemoriesByType(memoryType, limit)
  })

  ipcMain.handle('memory:getByCategory', async (_event, category: string, limit?: number) => {
    return memoryEngine.getMemoriesByCategory(category, limit)
  })

  ipcMain.handle('memory:getWithEvidence', async (_event, id: number) => {
    return memoryEngine.getMemoryWithEvidence(id)
  })

  ipcMain.handle('memory:archive', async (_event, id: number) => {
    memoryEngine.archiveMemory(id)
    return true
  })

  ipcMain.handle('memory:getStats', async () => {
    return memoryEngine.getStats()
  })

  // File ingestion engine IPC handlers
  ipcMain.handle('file:ingest', async (_event, input: { filename: string; content: string; filePath?: string; fileType?: string; mimeType?: string; encoding?: string }, chunkConfig?: { maxChunkSize?: number; overlapSize?: number; splitBy?: 'paragraph' | 'line' | 'sentence' | 'fixed' }) => {
    return fileEngine.ingestFile(input, chunkConfig)
  })

  ipcMain.handle('file:getRecord', async (_event, id: number) => {
    return fileEngine.getFileRecord(id)
  })

  ipcMain.handle('file:getByHash', async (_event, hash: string) => {
    return fileEngine.getFileByHash(hash)
  })

  ipcMain.handle('file:getRecords', async (_event, limit?: number, offset?: number) => {
    return fileEngine.getFileRecords(limit, offset)
  })

  ipcMain.handle('file:getByStatus', async (_event, status: string, limit?: number) => {
    return fileEngine.getFileRecordsByStatus(status, limit)
  })

  ipcMain.handle('file:getByType', async (_event, fileType: string, limit?: number) => {
    return fileEngine.getFileRecordsByType(fileType, limit)
  })

  ipcMain.handle('file:getChunks', async (_event, fileId: number) => {
    return fileEngine.getFileChunks(fileId)
  })

  ipcMain.handle('file:getCandidates', async (_event, fileId: number) => {
    return fileEngine.getImportCandidates(fileId)
  })

  ipcMain.handle('file:getPendingCandidates', async (_event, limit?: number) => {
    return fileEngine.getPendingImportCandidates(limit)
  })

  ipcMain.handle('file:markCandidateProcessed', async (_event, candidateId: number, resultId: number) => {
    fileEngine.markCandidateProcessed(candidateId, resultId)
    return true
  })

  ipcMain.handle('file:markCompleted', async (_event, fileId: number) => {
    fileEngine.markFileCompleted(fileId)
    return true
  })

  ipcMain.handle('file:markFailed', async (_event, fileId: number, error: string) => {
    fileEngine.markFileFailed(fileId, error)
    return true
  })

  ipcMain.handle('file:getStats', async () => {
    return fileEngine.getStats()
  })

  // Backup service IPC handlers
  ipcMain.handle('backup:create', async (_event, label?: string) => {
    return backupService.createBackup(label)
  })

  ipcMain.handle('backup:list', async () => {
    return backupService.listBackups()
  })

  ipcMain.handle('backup:delete', async (_event, filename: string) => {
    return backupService.deleteBackup(filename)
  })

  ipcMain.handle('backup:restore', async (_event, filename: string) => {
    const backupPath = backupService.getBackupPath(filename)
    return backupService.restoreBackup(backupPath)
  })

  ipcMain.handle('backup:getConfig', async () => {
    return backupService.getConfig()
  })

  ipcMain.handle('backup:updateConfig', async (_event, updates: { maxBackups?: number; autoBackupEnabled?: boolean; autoBackupIntervalHours?: number }) => {
    backupService.updateConfig(updates)
    return backupService.getConfig()
  })

  // Database health service IPC handlers
  ipcMain.handle('health:checkIntegrity', async () => {
    return healthService.checkIntegrity()
  })

  ipcMain.handle('health:getMigrationStatus', async () => {
    return healthService.getMigrationStatus()
  })

  ipcMain.handle('health:startupCheck', async () => {
    return healthService.runStartupHealthCheck(getDatabasePath())
  })

  ipcMain.handle('dialog:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '文本文件', extensions: ['txt', 'md', 'csv', 'json', 'xml', 'html'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle('file:readContent', async (_event, filePath: string) => {
    try {
      const content = await readFile(filePath, 'utf-8')
      const filename = filePath.split('/').pop() || filePath
      return { filename, content }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`读取文件失败: ${message}`)
    }
  })
}

app.whenReady().then(async () => {
  const db = await initDatabase()
  chatRepo = new ChatRepository(db)
  settingsRepo = new SettingsRepository(db)
  blockRepo = new LearningBlockRepository(db)
  eventRepo = new LearningEventRepository(db)
  vocabRepo = new VocabularyRepository(db)
  vocabEngine = new VocabularyEngine(vocabRepo)
  poolRepo = new DailyTargetPoolRepository(db)
  sentenceRepo = new LongSentenceRepository(db)
  grammarRepo = new GrammarRepository(db)
  summaryRepo = new SummaryRepository(db)
  fileRepo = new FileRepository(db)
  aiLogger = new AILogger(db)

  // Set default AI config if not already configured
  if (!settingsRepo.get('ai.base_url')) {
    settingsRepo.set('ai.base_url', 'https://987xyz.com/v1')
  }
  if (!settingsRepo.get('ai.model')) {
    settingsRepo.set('ai.model', 'gpt-5.5')
  }

  const apiKey = settingsRepo.get('ai.api_key')
  const baseUrl = settingsRepo.get('ai.base_url') || 'https://987xyz.com/v1'
  const model = settingsRepo.get('ai.model') || 'gpt-5.5'

  if (apiKey) {
    aiProvider = new OpenAIProvider({ baseUrl, apiKey, model })
  } else {
    aiProvider = new MockAIProvider()
  }

  stateManager = new LearningStateManager()
  const savedLearningState = settingsRepo.get(LEARNING_STATE_SETTING_KEY)
  if (savedLearningState) {
    stateManager.fromJSON(savedLearningState)
    currentSessionId = stateManager.getState().active_chat_session_id
  }
  intentRouter = new IntentRouter()

  reviewLoadManager = new ReviewLoadManager(vocabRepo)
  poolManager = new DailyTargetPoolManager(poolRepo, reviewLoadManager, stateManager)
  themeLesson = new VocabularyThemeLesson(vocabRepo, vocabEngine, poolManager, stateManager)
  sentenceEngine = new SentenceEngine(sentenceRepo)
  grammarEngine = new GrammarEngine(grammarRepo)
  summaryModule = new SummaryModule(summaryRepo, vocabEngine, sentenceEngine, grammarEngine, stateManager)
  memoryEngine = new MemoryEngine(summaryRepo)

  const actionDispatcher = new ActionDispatcher(vocabEngine, sentenceEngine, grammarEngine, memoryEngine, eventRepo, themeLesson)
  orchestrator = new AIOrchestrator(aiProvider, chatRepo, stateManager, intentRouter, summaryRepo, actionDispatcher, themeLesson)

  const jobRepo = new JobRepository(db)
  jobQueue = new JobQueue(jobRepo)

  fileEngine = new FileIngestionEngine(fileRepo, jobQueue, vocabEngine)
  backupService = new BackupService(getDatabasePath())
  healthService = new DatabaseHealthService(db)

  // Start auto-backup if enabled
  backupService.startAutoBackup()
  stateManager.setBlockTimeoutHandler(() => {
    const blockId = stateManager.getState().active_learning_block_id
    const studyDay = stateManager.getState().study_day
    if (blockId) {
      // Create block summary before ending
      const reviews = vocabRepo.getReviewEventsByBlock(blockId)
      const block = blockRepo.getBlock(blockId)
      const durationMinutes = block
        ? Math.max(1, Math.round((Date.now() - new Date(block.started_at).getTime()) / 60000))
        : undefined

      summaryModule.createBlockSummary({
        blockId,
        summary: '因不活跃自动结束的学习块',
        vocabularyLearned: reviews.length,
        durationMinutes
      })

      blockRepo.endBlock(blockId, '因不活跃自动结束')

      // Auto-create daily summary on block timeout
      try {
        summaryModule.createDailySummary({
          studyDay,
          content: `学习块因不活跃自动结束。本次学习时长约 ${durationMinutes || 0} 分钟。`,
          keyPoints: ['学习块自动结束'],
          recommendations: ['下次可以继续学习']
        })
      } catch (err) {
        console.error('Failed to create daily summary on block timeout:', err)
      }
    }
  })

  // Register job handlers
  jobQueue.registerHandler('file_import', async (payload: string) => {
    const data = JSON.parse(payload)
    const fileId = data.fileId
    if (!fileId) throw new Error('file_import job missing fileId')
    const result = fileEngine.processImportCandidates(fileId)
    console.log(`[JobQueue] file_import completed:`, result)
  })

  jobQueue.registerHandler('memory_update', async (payload: string) => {
    // Memory update is handled by the memory engine after block/daily summary
    // For now, this is a placeholder - memory updates happen inline
    console.log(`[JobQueue] memory_update processed`)
  })

  jobQueue.registerHandler('daily_summary', async (payload: string) => {
    const data = JSON.parse(payload)
    const studyDay = data.studyDay || new Date().toISOString().split('T')[0]
    summaryModule.createDailySummary({
      studyDay,
      content: '自动生成的每日总结',
      keyPoints: [],
      recommendations: []
    })
    console.log(`[JobQueue] daily_summary completed for ${studyDay}`)
  })

  jobQueue.registerHandler('weekly_review', async (payload: string) => {
    const data = JSON.parse(payload)
    if (data.weekStart && data.weekEnd) {
      summaryModule.createWeeklyReview({
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        summary: '自动生成的周复盘'
      })
      console.log(`[JobQueue] weekly_review completed for ${data.weekStart} to ${data.weekEnd}`)
    }
  })

  jobQueue.start(2000)

  registerIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // End active learning block on exit
  const blockId = stateManager?.getState().active_learning_block_id
  if (blockId) {
    blockRepo?.endBlock(blockId, '应用退出时结束')
  }
  jobQueue?.stop()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
