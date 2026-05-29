import { contextBridge, ipcRenderer } from 'electron'

export interface AppApi {
  sendMessage: (content: string, sessionId?: number) => Promise<{
    userMessage: { id: number; content: string; role: string; created_at: string }
    assistantMessage: { id: number; content: string; role: string; created_at: string } | null
    sessionId: number
    error?: string
    requiresConfirmation?: boolean
    confirmationMessage?: string
    pendingIntent?: string
  }>
  streamMessage: (content: string, sessionId?: number) => void
  onStreamChunk: (callback: (chunk: { content: string; done: boolean }) => void) => () => void
  onStreamComplete: (callback: (result: { userMessage: { id: number; content: string; role: string; created_at: string }; assistantMessage: { id: number; content: string; role: string; created_at: string }; sessionId: number }) => void) => () => void
  onStreamError: (callback: (result: { error: string }) => void) => () => void
  getMessages: (sessionId: number, limit?: number, offset?: number) => Promise<Array<{
    id: number
    session_id: number
    role: string
    content: string
    created_at: string
  }>>
  getSessions: () => Promise<Array<{
    id: number
    title: string | null
    session_type: string | null
    created_at: string
  }>>
  getSessionList: (limit?: number, offset?: number) => Promise<Array<{
    id: number
    title: string | null
    session_type: string | null
    started_at: string
    ended_at: string | null
    summary: string | null
  }>>
  abortCurrentRequest: () => Promise<{ success: boolean }>
  createSession: (title?: string, sessionType?: string) => Promise<{
    id: number
    title: string | null
    session_type: string | null
    created_at: string
  }>
  getCurrentLearningState: () => Promise<{
    currentSessionId: number | null
    studyDay: string
    currentTask: string
    teacherMode: string
    activeBlockId: number | null
    activeTask: { task_type: string; status: string } | null
    persistencePolicy: string
  }>
  startLearning: (task?: string, teacherMode?: string) => Promise<{
    study_day: string
    current_learning_task: string
    teacher_mode: string
    active_learning_block_id: number | null
    active_task: { task_type: string; status: string } | null
    persistence_policy: string
  }>
  stopLearning: () => Promise<{
    study_day: string
    current_learning_task: string
    teacher_mode: string
    active_learning_block_id: number | null
  }>
  confirmAction: (intent: string, confirmed: boolean) => Promise<{
    success: boolean
    message: string
  }>
  classifyIntent: (message: string) => Promise<{
    intent: string
    confidence: 'high' | 'medium' | 'low'
    matchedPattern?: string
  }>
  getSetting: (key: string) => Promise<string | null>
  updateSetting: (key: string, value: string) => Promise<boolean>
  addWord: (input: { word: string; phonetic?: string; part_of_speech?: string; chinese_meaning?: string; english_meaning?: string; difficulty_level?: number; exam_tags?: string; source?: string }) => Promise<{ id: number; word: string; phonetic: string | null; part_of_speech: string | null; chinese_meaning: string | null; english_meaning: string | null; difficulty_level: number; exam_tags: string | null; source: string | null; created_at: string; updated_at: string }>
  importWords: (input: { words: Array<{ word: string; phonetic?: string; part_of_speech?: string; chinese_meaning?: string; english_meaning?: string; difficulty_level?: number; exam_tags?: string; source?: string }>; skipDuplicates?: boolean }) => Promise<{ imported: number; skipped: number; errors: Array<{ word: string; error: string }> }>
  getVocabProgressInfo: (wordId: number) => Promise<{ word: { id: number; word: string; phonetic: string | null; part_of_speech: string | null; chinese_meaning: string | null; english_meaning: string | null; difficulty_level: number; exam_tags: string | null; source: string | null }; progress: { id: number; word_id: number; status: string; mastery_score: number; recognition_score: number; recall_score: number; context_score: number; usage_score: number; correct_count: number; mistake_count: number; review_count: number; last_seen_at: string | null; next_review_at: string | null; interval_days: number; ease_factor: number; last_result: string | null } | null; aiNote: { id: number; word_id: number; ai_explanation_cn: string | null; ai_explanation_en: string | null; ai_examples: string | null; exam_usage: string | null; common_collocations: string | null; common_mistakes: string | null; synonyms: string | null; antonyms: string | null; memory_tips: string | null } | null; recentReviews: Array<{ id: number; word_id: number; mode: string | null; question_type: string | null; is_correct: number | null; score: number | null; created_at: string }> } | null>
  getVocabProgressInfoByText: (word: string) => Promise<{ word: { id: number; word: string; phonetic: string | null; part_of_speech: string | null; chinese_meaning: string | null; english_meaning: string | null; difficulty_level: number; exam_tags: string | null; source: string | null }; progress: { id: number; word_id: number; status: string; mastery_score: number; recognition_score: number; recall_score: number; context_score: number; usage_score: number; correct_count: number; mistake_count: number; review_count: number; last_seen_at: string | null; next_review_at: string | null; interval_days: number; ease_factor: number; last_result: string | null } | null; aiNote: { id: number; word_id: number; ai_explanation_cn: string | null; ai_explanation_en: string | null; ai_examples: string | null; exam_usage: string | null; common_collocations: string | null; common_mistakes: string | null; synonyms: string | null; antonyms: string | null; memory_tips: string | null } | null; recentReviews: Array<{ id: number; word_id: number; mode: string | null; question_type: string | null; is_correct: number | null; score: number | null; created_at: string }> } | null>
  recordWordReview: (input: { wordId: number; sessionId?: number; blockId?: number; mode?: string; questionType?: string; prompt?: string; userAnswer?: string; correctAnswer?: string; isCorrect: boolean; score?: number; responseTimeMs?: number; aiFeedback?: string }) => Promise<{ id: number; word_id: number; created_at: string }>
  getDueReviewWords: (limit?: number) => Promise<Array<{ word: { id: number; word: string; chinese_meaning: string | null }; progress: { id: number; word_id: number; status: string; mastery_score: number; next_review_at: string | null } }>>
  getWeakWords: (limit?: number) => Promise<Array<{ word: { id: number; word: string; chinese_meaning: string | null }; progress: { id: number; word_id: number; status: string; mastery_score: number } }>>
  getVocabStats: () => Promise<{ wordCount: number; progressStats: { total: number; byStatus: Record<string, number> } }>
  searchWords: (query: string, limit?: number) => Promise<Array<{ id: number; word: string; phonetic: string | null; part_of_speech: string | null; chinese_meaning: string | null; english_meaning: string | null; difficulty_level: number; exam_tags: string | null; source: string | null; created_at: string; updated_at: string }>>
  getOrCreateTodayPool: (config?: { recommendedMinutes?: number; baseNewWordCount?: number; focusedWordCount?: number; targetType?: string }) => Promise<{ id: number; study_day: string; recommended_minutes: number; new_word_count: number; focused_word_count: number; review_word_count: number; target_type: string; status: string; metadata: string | null }>
  getCurrentPool: () => Promise<{ id: number; study_day: string; recommended_minutes: number; new_word_count: number; focused_word_count: number; review_word_count: number; target_type: string; status: string; metadata: string | null } | null>
  updatePoolProgress: (poolId: number, updates: { completedNewWords?: number; completedReviewWords?: number; completedFocusedWords?: number }) => Promise<boolean>
  markPoolCompleted: (poolId: number) => Promise<boolean>
  getRecentPools: (limit?: number) => Promise<Array<{ id: number; study_day: string; recommended_minutes: number; new_word_count: number; focused_word_count: number; review_word_count: number; target_type: string; status: string; metadata: string | null }>>
  getPoolSummary: (poolId: number) => Promise<{ studyDay: string; recommendedMinutes: number; newWords: { target: number; completed: number }; focusedWords: { target: number; completed: number }; reviewWords: { target: number; completed: number }; status: string } | null>
  getReviewLoad: () => Promise<{ dueReviewCount: number; weakWordCount: number; totalActiveWords: number; reviewLoadRatio: number; recommendedNewWordReduction: number }>
  getReviewLoadLevel: () => Promise<'low' | 'medium' | 'high' | 'critical'>
  shouldReduceNewWords: () => Promise<boolean>
  startThemeLesson: (config?: { theme?: string; wordCount?: number; focusedWordCount?: number }) => Promise<{ theme: string; totalWords: number; focusedWords: Array<{ id: number; word: string; phonetic: string | null; part_of_speech: string | null; chinese_meaning: string | null; english_meaning: string | null; difficulty_level: number; exam_tags: string | null; source: string | null }>; ordinaryWords: Array<{ id: number; word: string; phonetic: string | null; part_of_speech: string | null; chinese_meaning: string | null; english_meaning: string | null; difficulty_level: number; exam_tags: string | null; source: string | null }>; reviewWords: Array<{ id: number; word: string; phonetic: string | null; part_of_speech: string | null; chinese_meaning: string | null; english_meaning: string | null; difficulty_level: number; exam_tags: string | null; source: string | null }>; poolId: number }>
  getCurrentThemeWord: () => Promise<{ word: { id: number; word: string; phonetic: string | null; part_of_speech: string | null; chinese_meaning: string | null; english_meaning: string | null; difficulty_level: number; exam_tags: string | null; source: string | null }; progress: { id: number; word_id: number; status: string; mastery_score: number; recognition_score: number; recall_score: number; context_score: number; usage_score: number; correct_count: number; mistake_count: number; review_count: number; last_seen_at: string | null; next_review_at: string | null; interval_days: number; ease_factor: number; last_result: string | null } | null; isFocused: boolean } | null>
  recordThemeReview: (isCorrect: boolean, score?: number) => Promise<boolean>
  getThemeLessonState: () => Promise<{ selection: { theme: string; totalWords: number; focusedWords: Array<{ id: number; word: string }>; ordinaryWords: Array<{ id: number; word: string }>; reviewWords: Array<{ id: number; word: string }>; poolId: number } | null; currentIndex: number; completedWords: number; focusedCompleted: number; reviewCompleted: number; isActive: boolean; totalWords: number; progressPercent: number }>
  getThemeSummary: () => Promise<{ theme: string; totalWords: number; focusedCount: number; ordinaryCount: number; reviewCount: number; completedCount: number; isComplete: boolean } | null>
  endThemeLesson: () => Promise<boolean>
  addSentence: (input: { sentence: string; translation?: string; source?: string; difficultyLevel?: number; createdByAi?: boolean; aiModel?: string; topic?: string; grammarPoints?: string[] }) => Promise<{ id: number; sentence: string; translation: string | null; source: string | null; difficulty_level: number; created_by_ai: number; ai_model: string | null; topic: string | null; grammar_points: string | null; created_at: string; updated_at: string }>
  addAISentence: (input: { sentence: string; translation?: string; source?: string; difficultyLevel?: number; topic?: string; grammarPoints?: string[] }, aiModel: string) => Promise<{ id: number; sentence: string; translation: string | null; source: string | null; difficulty_level: number; created_by_ai: number; ai_model: string | null; topic: string | null; grammar_points: string | null; created_at: string; updated_at: string }>
  addSentenceAnalysis: (input: { sentenceId: number; analysisType: string; content: string; orderIndex?: number }) => Promise<{ id: number; sentence_id: number; analysis_type: string; content: string; order_index: number; created_at: string }>
  getSentenceWithAnalysis: (sentenceId: number) => Promise<{ sentence: { id: number; sentence: string; translation: string | null; source: string | null; difficulty_level: number; created_by_ai: number; ai_model: string | null; topic: string | null; grammar_points: string | null }; analyses: Array<{ id: number; sentence_id: number; analysis_type: string; content: string; order_index: number; created_at: string }>; progress: { id: number; sentence_id: number; status: string; user_guess: string | null; guess_score: number | null; comprehension_score: number | null; structure_score: number | null; vocabulary_score: number | null; grammar_score: number | null; attempt_count: number; correct_count: number; last_attempt_at: string | null; next_review_at: string | null; interval_days: number; ease_factor: number } | null } | null>
  startSentencePractice: (difficultyLevel?: number, topic?: string) => Promise<{ currentSentence: { sentence: { id: number; sentence: string; translation: string | null }; analyses: Array<{ id: number; analysis_type: string; content: string; order_index: number }>; progress: { id: number; status: string; guess_score: number | null } | null } | null; currentIndex: number; completedCount: number; totalCount: number; isActive: boolean }>
  getCurrentSentence: () => Promise<{ sentence: { id: number; sentence: string; translation: string | null }; analyses: Array<{ id: number; analysis_type: string; content: string; order_index: number }>; progress: { id: number; status: string; guess_score: number | null } | null } | null>
  recordSentenceGuess: (input: { sentenceId: number; userGuess: string; isCorrect: boolean; scores?: { comprehension?: number; structure?: number; vocabulary?: number; grammar?: number } }) => Promise<Array<{ id: number; sentence_id: number; weakness_type: string; reference_text: string | null; vocabulary_word: string | null; grammar_point: string | null; severity: number; status: string; created_at: string }>>
  endSentencePractice: () => Promise<boolean>
  getSentencePracticeState: () => Promise<{ currentSentence: { sentence: { id: number; sentence: string; translation: string | null }; analyses: Array<{ id: number; analysis_type: string; content: string; order_index: number }>; progress: { id: number; status: string; guess_score: number | null } | null } | null; currentIndex: number; completedCount: number; totalCount: number; isActive: boolean }>
  getDueReviewSentences: (limit?: number) => Promise<Array<{ sentence: { id: number; sentence: string; translation: string | null; topic: string | null }; progress: { id: number; sentence_id: number; status: string; comprehension_score: number | null; next_review_at: string | null } }>>
  getWeakSentences: (limit?: number) => Promise<Array<{ sentence: { id: number; sentence: string; translation: string | null; topic: string | null }; progress: { id: number; sentence_id: number; status: string; comprehension_score: number | null } }>>
  getSentenceStats: () => Promise<{ sentenceCount: number; progressStats: { total: number; byStatus: Record<string, number> } }>
  getSentenceWeaknessCandidates: () => Promise<Array<{ id: number; sentence_id: number; weakness_type: string; reference_text: string | null; vocabulary_word: string | null; grammar_point: string | null; severity: number; status: string; created_at: string }>>
  markSentenceWeaknessProcessed: (id: number) => Promise<boolean>
  recordGrammarError: (input: { sessionId?: number; blockId?: number; errorType: string; errorText: string; correction?: string; contextSentence?: string; severity?: 'minor' | 'moderate' | 'serious'; aiFeedback?: string }) => Promise<{ errorEvent: { id: number; error_type: string; error_text: string; correction: string | null; severity: string; is_serious: number; created_at: string }; isSerious: boolean; shouldInterrupt: boolean; issueSummary: { id: number; issue_type: string; issue_pattern: string; occurrence_count: number } | null; weaknessCandidate: { id: number; weakness_type: string; grammar_point: string | null; severity: number; status: string } | null }>
  recordSeriousGrammarError: (input: { sessionId?: number; blockId?: number; errorType: string; errorText: string; correction?: string; contextSentence?: string; aiFeedback?: string }) => Promise<{ errorEvent: { id: number; error_type: string; error_text: string; correction: string | null; severity: string; is_serious: number; created_at: string }; isSerious: boolean; shouldInterrupt: boolean; issueSummary: { id: number; issue_type: string; issue_pattern: string; occurrence_count: number } | null; weaknessCandidate: { id: number; weakness_type: string; grammar_point: string | null; severity: number; status: string } | null }>
  recordMinorGrammarError: (input: { sessionId?: number; blockId?: number; errorType: string; errorText: string; correction?: string; contextSentence?: string; aiFeedback?: string }) => Promise<{ errorEvent: { id: number; error_type: string; error_text: string; correction: string | null; severity: string; is_serious: number; created_at: string }; isSerious: boolean; shouldInterrupt: boolean; issueSummary: { id: number; issue_type: string; issue_pattern: string; occurrence_count: number } | null; weaknessCandidate: { id: number; weakness_type: string; grammar_point: string | null; severity: number; status: string } | null }>
  acknowledgeGrammarError: (errorId: number) => Promise<boolean>
  getGrammarErrorsBySession: (sessionId: number, limit?: number) => Promise<Array<{ id: number; error_type: string; error_text: string; correction: string | null; severity: string; is_serious: number; created_at: string }>>
  getSeriousGrammarErrors: (limit?: number) => Promise<Array<{ id: number; error_type: string; error_text: string; correction: string | null; severity: string; is_serious: number; created_at: string }>>
  getUnacknowledgedGrammarErrors: (limit?: number) => Promise<Array<{ id: number; error_type: string; error_text: string; correction: string | null; severity: string; is_serious: number; created_at: string }>>
  getActiveGrammarIssues: () => Promise<Array<{ id: number; issue_type: string; issue_pattern: string; occurrence_count: number; first_seen_at: string; last_seen_at: string; status: string }>>
  getGrammarIssuesByType: (issueType: string) => Promise<Array<{ id: number; issue_type: string; issue_pattern: string; occurrence_count: number; first_seen_at: string; last_seen_at: string; status: string }>>
  createGrammarIssuePattern: (input: { issueType: string; issuePattern: string; exampleErrors?: string[]; suggestedRule?: string }) => Promise<{ id: number; issue_type: string; issue_pattern: string; occurrence_count: number; first_seen_at: string; last_seen_at: string; status: string }>
  getGrammarWeaknessCandidates: () => Promise<Array<{ id: number; weakness_type: string; grammar_point: string | null; severity: number; status: string; created_at: string }>>
  markGrammarWeaknessProcessed: (id: number) => Promise<boolean>
  getGrammarStats: () => Promise<{ errorCount: number; seriousErrorCount: number; issueSummaryStats: { total: number; byType: Record<string, number> } }>
  createDailySummary: (input: { studyDay?: string; content: string; keyPoints?: string[]; recommendations?: string[] }) => Promise<{ id: number; study_day: string; summary_type: string; content: string; key_points: string | null; learning_stats: string | null; vocabulary_progress: string | null; grammar_progress: string | null; sentence_progress: string | null; recommendations: string | null; created_at: string; updated_at: string }>
  getDailySummary: (studyDay?: string) => Promise<{ id: number; study_day: string; summary_type: string; content: string; key_points: string | null; learning_stats: string | null; vocabulary_progress: string | null; grammar_progress: string | null; sentence_progress: string | null; recommendations: string | null; created_at: string; updated_at: string } | null>
  getDailySummaryWithStats: (studyDay?: string) => Promise<{ summary: { id: number; study_day: string; summary_type: string; content: string; key_points: string | null; learning_stats: string | null }; stats: { vocabulary: { wordCount: number; progressStats: { total: number; byStatus: Record<string, number> } }; grammar: { errorCount: number; seriousErrorCount: number }; sentences: { sentenceCount: number; progressStats: { total: number; byStatus: Record<string, number> } } } } | null>
  getRecentDailySummaries: (limit?: number) => Promise<Array<{ id: number; study_day: string; summary_type: string; content: string; key_points: string | null; created_at: string }>>
  createWeeklyReview: (input: { weekStart: string; weekEnd: string; summary: string; strengths?: string[]; weaknesses?: string[]; recommendations?: string[]; overallScore?: number }) => Promise<{ id: number; week_start: string; week_end: string; summary: string; strengths: string | null; weaknesses: string | null; recommendations: string | null; overall_score: number | null; created_at: string; updated_at: string }>
  getWeeklyReview: (weekStart: string) => Promise<{ id: number; week_start: string; week_end: string; summary: string; strengths: string | null; weaknesses: string | null; recommendations: string | null; overall_score: number | null; created_at: string; updated_at: string } | null>
  getRecentWeeklyReviews: (limit?: number) => Promise<Array<{ id: number; week_start: string; week_end: string; summary: string; overall_score: number | null; created_at: string }>>
  createBlockSummary: (input: { blockId: number; summary: string; activities?: string[]; vocabularyLearned?: number; sentencesPracticed?: number; grammarErrors?: number; durationMinutes?: number }) => Promise<{ id: number; block_id: number; summary: string; activities: string | null; vocabulary_learned: number; sentences_practiced: number; grammar_errors: number; duration_minutes: number | null; created_at: string }>
  getBlockSummary: (blockId: number) => Promise<{ id: number; block_id: number; summary: string; activities: string | null; vocabulary_learned: number; sentences_practiced: number; grammar_errors: number; duration_minutes: number | null; created_at: string } | null>
  getRecentBlockSummaries: (limit?: number) => Promise<Array<{ id: number; block_id: number; summary: string; activities: string | null; vocabulary_learned: number; sentences_practiced: number; grammar_errors: number; duration_minutes: number | null; created_at: string }>>
  getSummaryStats: () => Promise<{ dailyCount: number; weeklyCount: number; memoryCount: number; blockCount: number }>
  addMemory: (input: { memoryType: string; category?: string; content: string; confidence?: number; evidenceEventIds?: number[]; sourceType?: string; sourceId?: number }) => Promise<{ id: number; memory_type: string; category: string | null; content: string; confidence: number; evidence_event_ids: string | null; source_type: string | null; source_id: number | null; status: string; first_observed_at: string; last_observed_at: string; observation_count: number; created_at: string; updated_at: string }>
  updateMemory: (id: number, input: { content?: string; confidence?: number; evidenceEventIds?: number[]; status?: string }) => Promise<{ id: number; memory_type: string; category: string | null; content: string; confidence: number; evidence_event_ids: string | null; source_type: string | null; source_id: number | null; status: string; first_observed_at: string; last_observed_at: string; observation_count: number; created_at: string; updated_at: string } | null>
  getMemory: (id: number) => Promise<{ id: number; memory_type: string; category: string | null; content: string; confidence: number; evidence_event_ids: string | null; source_type: string | null; source_id: number | null; status: string; first_observed_at: string; last_observed_at: string; observation_count: number; created_at: string; updated_at: string } | null>
  getActiveMemories: (limit?: number) => Promise<Array<{ id: number; memory_type: string; category: string | null; content: string; confidence: number; status: string; first_observed_at: string; last_observed_at: string; observation_count: number; created_at: string }>>
  getMemoriesByType: (memoryType: string, limit?: number) => Promise<Array<{ id: number; memory_type: string; category: string | null; content: string; confidence: number; status: string; first_observed_at: string; last_observed_at: string; observation_count: number; created_at: string }>>
  getMemoriesByCategory: (category: string, limit?: number) => Promise<Array<{ id: number; memory_type: string; category: string | null; content: string; confidence: number; status: string; first_observed_at: string; last_observed_at: string; observation_count: number; created_at: string }>>
  getMemoryWithEvidence: (id: number) => Promise<{ memory: { id: number; memory_type: string; category: string | null; content: string; confidence: number; evidence_event_ids: string | null; status: string; first_observed_at: string; last_observed_at: string; observation_count: number }; evidenceCount: number; daysSinceFirstObservation: number; daysSinceLastObservation: number } | null>
  archiveMemory: (id: number) => Promise<boolean>
  getMemoryStats: () => Promise<{ dailyCount: number; weeklyCount: number; memoryCount: number; blockCount: number }>
  ingestFile: (input: { filename: string; content: string; filePath?: string; fileType?: string; mimeType?: string; encoding?: string }, chunkConfig?: { maxChunkSize?: number; overlapSize?: number; splitBy?: 'paragraph' | 'line' | 'sentence' | 'fixed' }) => Promise<{ fileRecord: { id: number; filename: string; file_hash: string; file_size: number | null; file_type: string; status: string; import_job_id: number | null; created_at: string; updated_at: string }; chunks: Array<{ id: number; file_id: number; chunk_index: number; content: string; content_type: string | null; char_count: number | null; word_count: number | null; created_at: string }>; importCandidates: Array<{ id: number; file_id: number; candidate_type: string; content: string; status: string; created_at: string; updated_at: string }>; jobId: number | null; skipped: boolean; reason?: string }>
  getFileRecord: (id: number) => Promise<{ id: number; filename: string; file_hash: string; file_size: number | null; file_type: string; status: string; import_job_id: number | null; created_at: string; updated_at: string } | null>
  getFileByHash: (hash: string) => Promise<{ id: number; filename: string; file_hash: string; file_size: number | null; file_type: string; status: string; import_job_id: number | null; created_at: string; updated_at: string } | null>
  getFileRecords: (limit?: number, offset?: number) => Promise<Array<{ id: number; filename: string; file_hash: string; file_size: number | null; file_type: string; status: string; import_job_id: number | null; created_at: string; updated_at: string }>>
  getFileRecordsByStatus: (status: string, limit?: number) => Promise<Array<{ id: number; filename: string; file_hash: string; file_size: number | null; file_type: string; status: string; import_job_id: number | null; created_at: string; updated_at: string }>>
  getFileRecordsByType: (fileType: string, limit?: number) => Promise<Array<{ id: number; filename: string; file_hash: string; file_size: number | null; file_type: string; status: string; import_job_id: number | null; created_at: string; updated_at: string }>>
  getFileChunks: (fileId: number) => Promise<Array<{ id: number; file_id: number; chunk_index: number; content: string; content_type: string | null; char_count: number | null; word_count: number | null; created_at: string }>>
  getFileImportCandidates: (fileId: number) => Promise<Array<{ id: number; file_id: number; candidate_type: string; content: string; status: string; created_at: string; updated_at: string }>>
  getPendingFileCandidates: (limit?: number) => Promise<Array<{ id: number; file_id: number; candidate_type: string; content: string; status: string; created_at: string; updated_at: string }>>
  markFileCandidateProcessed: (candidateId: number, resultId: number) => Promise<boolean>
  markFileCompleted: (fileId: number) => Promise<boolean>
  markFileFailed: (fileId: number, error: string) => Promise<boolean>
  getFileStats: () => Promise<{ fileCount: number; chunkCount: number; candidateStats: { total: number; byStatus: Record<string, number>; byType: Record<string, number> } }>
  createBackup: (label?: string) => Promise<{ success: boolean; backupPath: string | null; timestamp: string; sizeBytes: number | null; error?: string }>
  listBackups: () => Promise<Array<{ filename: string; path: string; timestamp: string; sizeBytes: number }>>
  deleteBackup: (filename: string) => Promise<boolean>
  restoreBackup: (filename: string) => Promise<{ success: boolean; error?: string }>
  getBackupConfig: () => Promise<{ backupDir: string; maxBackups: number; autoBackupEnabled: boolean; autoBackupIntervalHours: number }>
  updateBackupConfig: (updates: { maxBackups?: number; autoBackupEnabled?: boolean; autoBackupIntervalHours?: number }) => Promise<{ backupDir: string; maxBackups: number; autoBackupEnabled: boolean; autoBackupIntervalHours: number }>
  checkDatabaseIntegrity: () => Promise<{ ok: boolean; message: string; checkedAt: string }>
  getMigrationStatus: () => Promise<{ applied: Array<{ version: number; name: string; checksum: string; applied_at: string }>; totalApplied: number }>
  runStartupHealthCheck: () => Promise<{ integrity: { ok: boolean; message: string; checkedAt: string }; migrations: { applied: Array<{ version: number; name: string; checksum: string; applied_at: string }>; totalApplied: number }; databasePath: string; databaseSizeBytes: number; ok: boolean }>
  getTodayTokenStats: () => Promise<{ requestCount: number; inputTokens: number; outputTokens: number; totalTokens: number }>
  selectFile: () => Promise<string | null>
  readFileContent: (filePath: string) => Promise<{ filename: string; content: string }>
  getJobStatus: (jobId: number) => Promise<{ id: number; type: string; status: string; payload: string | null; error: string | null; attempts: number; created_at: string; updated_at: string } | null>
  regenerateMessage: (messageId: number, sessionId?: number) => Promise<{ assistantMessage: { id: number; content: string; role: string; created_at: string } | null; error: string | null }>
  exportFullPackage: () => Promise<{ success: boolean; path?: string; error?: string }>
  runTestSuite: () => Promise<{ total: number; passed: number; failed: number; results: Array<{ id: string; passed: boolean; score: number }> }>
}

const api: AppApi = {
  sendMessage: (content, sessionId) =>
    ipcRenderer.invoke('chat:sendMessage', { content, sessionId }),
  streamMessage: (content, sessionId) => {
    ipcRenderer.send('chat:stream', { content, sessionId })
  },
  onStreamChunk: (callback) => {
    const handler = (_event: unknown, chunk: { content: string; done: boolean }) => callback(chunk)
    ipcRenderer.on('chat:stream:chunk', handler)
    return () => { ipcRenderer.removeListener('chat:stream:chunk', handler) }
  },
  onStreamComplete: (callback) => {
    const handler = (_event: unknown, result: { userMessage: { id: number; content: string; role: string; created_at: string }; assistantMessage: { id: number; content: string; role: string; created_at: string }; sessionId: number }) => callback(result)
    ipcRenderer.on('chat:stream:complete', handler)
    return () => { ipcRenderer.removeListener('chat:stream:complete', handler) }
  },
  onStreamError: (callback) => {
    const handler = (_event: unknown, result: { error: string }) => callback(result)
    ipcRenderer.on('chat:stream:error', handler)
    return () => { ipcRenderer.removeListener('chat:stream:error', handler) }
  },
  getMessages: (sessionId, limit, offset) =>
    ipcRenderer.invoke('chat:getMessages', { sessionId, limit, offset }),
  getSessions: () =>
    ipcRenderer.invoke('chat:getSessions'),
  getSessionList: (limit, offset) =>
    ipcRenderer.invoke('chat:getSessionList', { limit, offset }),
  abortCurrentRequest: () =>
    ipcRenderer.invoke('chat:abort'),
  createSession: (title, sessionType) =>
    ipcRenderer.invoke('chat:createSession', { title, sessionType }),
  getCurrentLearningState: () =>
    ipcRenderer.invoke('learning:getCurrentState'),
  startLearning: (task, teacherMode) =>
    ipcRenderer.invoke('learning:startLearning', { task, teacherMode }),
  stopLearning: () =>
    ipcRenderer.invoke('learning:stopLearning'),
  confirmAction: (intent, confirmed) =>
    ipcRenderer.invoke('learning:confirmAction', { intent, confirmed }),
  classifyIntent: (message) =>
    ipcRenderer.invoke('learning:classifyIntent', message),
  getSetting: (key) =>
    ipcRenderer.invoke('settings:get', key),
  updateSetting: (key, value) =>
    ipcRenderer.invoke('settings:update', key, value),
  addWord: (input) =>
    ipcRenderer.invoke('vocab:addWord', input),
  importWords: (input) =>
    ipcRenderer.invoke('vocab:importWords', input),
  getVocabProgressInfo: (wordId) =>
    ipcRenderer.invoke('vocab:getProgressInfo', wordId),
  getVocabProgressInfoByText: (word) =>
    ipcRenderer.invoke('vocab:getProgressInfoByText', word),
  recordWordReview: (input) =>
    ipcRenderer.invoke('vocab:recordReview', input),
  getDueReviewWords: (limit) =>
    ipcRenderer.invoke('vocab:getDueReview', limit),
  getWeakWords: (limit) =>
    ipcRenderer.invoke('vocab:getWeakWords', limit),
  getVocabStats: () =>
    ipcRenderer.invoke('vocab:getStats'),
  searchWords: (query, limit) =>
    ipcRenderer.invoke('vocab:search', query, limit),
  getOrCreateTodayPool: (config) =>
    ipcRenderer.invoke('pool:getOrCreateToday', config),
  getCurrentPool: () =>
    ipcRenderer.invoke('pool:getCurrent'),
  updatePoolProgress: (poolId, updates) =>
    ipcRenderer.invoke('pool:updateProgress', poolId, updates),
  markPoolCompleted: (poolId) =>
    ipcRenderer.invoke('pool:markCompleted', poolId),
  getRecentPools: (limit) =>
    ipcRenderer.invoke('pool:getRecent', limit),
  getPoolSummary: (poolId) =>
    ipcRenderer.invoke('pool:getSummary', poolId),
  getReviewLoad: () =>
    ipcRenderer.invoke('review:getLoad'),
  getReviewLoadLevel: () =>
    ipcRenderer.invoke('review:getLoadLevel'),
  shouldReduceNewWords: () =>
    ipcRenderer.invoke('review:shouldReduce'),
  startThemeLesson: (config) =>
    ipcRenderer.invoke('theme:startLesson', config),
  getCurrentThemeWord: () =>
    ipcRenderer.invoke('theme:getCurrentWord'),
  recordThemeReview: (isCorrect, score) =>
    ipcRenderer.invoke('theme:recordReview', isCorrect, score),
  getThemeLessonState: () =>
    ipcRenderer.invoke('theme:getState'),
  getThemeSummary: () =>
    ipcRenderer.invoke('theme:getSummary'),
  endThemeLesson: () =>
    ipcRenderer.invoke('theme:endLesson'),
  addSentence: (input) =>
    ipcRenderer.invoke('sentence:add', input),
  addAISentence: (input, aiModel) =>
    ipcRenderer.invoke('sentence:addAI', input, aiModel),
  addSentenceAnalysis: (input) =>
    ipcRenderer.invoke('sentence:addAnalysis', input),
  getSentenceWithAnalysis: (sentenceId) =>
    ipcRenderer.invoke('sentence:getWithAnalysis', sentenceId),
  startSentencePractice: (difficultyLevel, topic) =>
    ipcRenderer.invoke('sentence:startPractice', difficultyLevel, topic),
  getCurrentSentence: () =>
    ipcRenderer.invoke('sentence:getCurrent'),
  recordSentenceGuess: (input) =>
    ipcRenderer.invoke('sentence:recordGuess', input),
  endSentencePractice: () =>
    ipcRenderer.invoke('sentence:endPractice'),
  getSentencePracticeState: () =>
    ipcRenderer.invoke('sentence:getState'),
  getDueReviewSentences: (limit) =>
    ipcRenderer.invoke('sentence:getDueReview', limit),
  getWeakSentences: (limit) =>
    ipcRenderer.invoke('sentence:getWeak', limit),
  getSentenceStats: () =>
    ipcRenderer.invoke('sentence:getStats'),
  getSentenceWeaknessCandidates: () =>
    ipcRenderer.invoke('sentence:getWeaknessCandidates'),
  markSentenceWeaknessProcessed: (id) =>
    ipcRenderer.invoke('sentence:markWeaknessProcessed', id),
  recordGrammarError: (input) =>
    ipcRenderer.invoke('grammar:recordError', input),
  recordSeriousGrammarError: (input) =>
    ipcRenderer.invoke('grammar:recordSeriousError', input),
  recordMinorGrammarError: (input) =>
    ipcRenderer.invoke('grammar:recordMinorError', input),
  acknowledgeGrammarError: (errorId) =>
    ipcRenderer.invoke('grammar:acknowledgeError', errorId),
  getGrammarErrorsBySession: (sessionId, limit) =>
    ipcRenderer.invoke('grammar:getErrorsBySession', sessionId, limit),
  getSeriousGrammarErrors: (limit) =>
    ipcRenderer.invoke('grammar:getSeriousErrors', limit),
  getUnacknowledgedGrammarErrors: (limit) =>
    ipcRenderer.invoke('grammar:getUnacknowledged', limit),
  getActiveGrammarIssues: () =>
    ipcRenderer.invoke('grammar:getActiveIssues'),
  getGrammarIssuesByType: (issueType) =>
    ipcRenderer.invoke('grammar:getIssuesByType', issueType),
  createGrammarIssuePattern: (input) =>
    ipcRenderer.invoke('grammar:createIssuePattern', input),
  getGrammarWeaknessCandidates: () =>
    ipcRenderer.invoke('grammar:getWeaknessCandidates'),
  markGrammarWeaknessProcessed: (id) =>
    ipcRenderer.invoke('grammar:markWeaknessProcessed', id),
  getGrammarStats: () =>
    ipcRenderer.invoke('grammar:getStats'),
  createDailySummary: (input) =>
    ipcRenderer.invoke('summary:createDaily', input),
  getDailySummary: (studyDay) =>
    ipcRenderer.invoke('summary:getDaily', studyDay),
  getDailySummaryWithStats: (studyDay) =>
    ipcRenderer.invoke('summary:getDailyWithStats', studyDay),
  getRecentDailySummaries: (limit) =>
    ipcRenderer.invoke('summary:getRecentDaily', limit),
  createWeeklyReview: (input) =>
    ipcRenderer.invoke('summary:createWeekly', input),
  getWeeklyReview: (weekStart) =>
    ipcRenderer.invoke('summary:getWeekly', weekStart),
  getRecentWeeklyReviews: (limit) =>
    ipcRenderer.invoke('summary:getRecentWeekly', limit),
  createBlockSummary: (input) =>
    ipcRenderer.invoke('summary:createBlock', input),
  getBlockSummary: (blockId) =>
    ipcRenderer.invoke('summary:getBlock', blockId),
  getRecentBlockSummaries: (limit) =>
    ipcRenderer.invoke('summary:getRecentBlocks', limit),
  getSummaryStats: () =>
    ipcRenderer.invoke('summary:getStats'),
  addMemory: (input) =>
    ipcRenderer.invoke('memory:add', input),
  updateMemory: (id, input) =>
    ipcRenderer.invoke('memory:update', id, input),
  getMemory: (id) =>
    ipcRenderer.invoke('memory:get', id),
  getActiveMemories: (limit) =>
    ipcRenderer.invoke('memory:getActive', limit),
  getMemoriesByType: (memoryType, limit) =>
    ipcRenderer.invoke('memory:getByType', memoryType, limit),
  getMemoriesByCategory: (category, limit) =>
    ipcRenderer.invoke('memory:getByCategory', category, limit),
  getMemoryWithEvidence: (id) =>
    ipcRenderer.invoke('memory:getWithEvidence', id),
  archiveMemory: (id) =>
    ipcRenderer.invoke('memory:archive', id),
  getMemoryStats: () =>
    ipcRenderer.invoke('memory:getStats'),
  ingestFile: (input, chunkConfig) =>
    ipcRenderer.invoke('file:ingest', input, chunkConfig),
  getFileRecord: (id) =>
    ipcRenderer.invoke('file:getRecord', id),
  getFileByHash: (hash) =>
    ipcRenderer.invoke('file:getByHash', hash),
  getFileRecords: (limit, offset) =>
    ipcRenderer.invoke('file:getRecords', limit, offset),
  getFileRecordsByStatus: (status, limit) =>
    ipcRenderer.invoke('file:getByStatus', status, limit),
  getFileRecordsByType: (fileType, limit) =>
    ipcRenderer.invoke('file:getByType', fileType, limit),
  getFileChunks: (fileId) =>
    ipcRenderer.invoke('file:getChunks', fileId),
  getFileImportCandidates: (fileId) =>
    ipcRenderer.invoke('file:getCandidates', fileId),
  getPendingFileCandidates: (limit) =>
    ipcRenderer.invoke('file:getPendingCandidates', limit),
  markFileCandidateProcessed: (candidateId, resultId) =>
    ipcRenderer.invoke('file:markCandidateProcessed', candidateId, resultId),
  markFileCompleted: (fileId) =>
    ipcRenderer.invoke('file:markCompleted', fileId),
  markFileFailed: (fileId, error) =>
    ipcRenderer.invoke('file:markFailed', fileId, error),
  getFileStats: () =>
    ipcRenderer.invoke('file:getStats'),
  createBackup: (label) =>
    ipcRenderer.invoke('backup:create', label),
  listBackups: () =>
    ipcRenderer.invoke('backup:list'),
  deleteBackup: (filename) =>
    ipcRenderer.invoke('backup:delete', filename),
  restoreBackup: (filename) =>
    ipcRenderer.invoke('backup:restore', filename),
  getBackupConfig: () =>
    ipcRenderer.invoke('backup:getConfig'),
  updateBackupConfig: (updates) =>
    ipcRenderer.invoke('backup:updateConfig', updates),
  checkDatabaseIntegrity: () =>
    ipcRenderer.invoke('health:checkIntegrity'),
  getMigrationStatus: () =>
    ipcRenderer.invoke('health:getMigrationStatus'),
  runStartupHealthCheck: () =>
    ipcRenderer.invoke('health:startupCheck'),
  getTodayTokenStats: () =>
    ipcRenderer.invoke('ai:getTodayStats'),
  selectFile: () =>
    ipcRenderer.invoke('dialog:selectFile'),
  readFileContent: (filePath) =>
    ipcRenderer.invoke('file:readContent', filePath),
  getJobStatus: (jobId) =>
    ipcRenderer.invoke('jobs:getStatus', jobId),
  regenerateMessage: (messageId, sessionId) =>
    ipcRenderer.invoke('chat:regenerateMessage', { messageId, sessionId }),
  exportFullPackage: () =>
    ipcRenderer.invoke('backup:exportFull'),
  runTestSuite: () =>
    ipcRenderer.invoke('testing:runSuite')
}

contextBridge.exposeInMainWorld('appApi', api)
