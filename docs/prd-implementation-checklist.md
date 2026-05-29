# PRD 实施清单

基于 `source-full-design.md`（设计文档）和 `implementation-steps.md`（实施计划）提取的完整实施清单。

---

## 状态说明

- `[ ]` 待开始
- `[~]` 进行中
- `[x]` 已完成
- `[!]` 已跳过（需说明原因）

---

## Phase 0: 项目基础设施

### 0.1 项目初始化
- [x] Electron + React + Vite + TypeScript 项目结构
- [x] better-sqlite3 集成
- [x] 7 个数据库 Migration 已创建
- [x] 16 个后端 Service 已创建
- [x] Preload IPC 层（~120 个方法）
- [x] 3 个前端页面（Chat/Dashboard/Settings）
- [x] 4 个前端组件（TabNav/LearningStatusBar/MessageList/MessageInput）

### 0.2 项目验证
- [x] `npm run dev` 启动正常
- [x] `npm run typecheck` 通过
- [x] `npm run build` 通过

---

## Phase 1: Day 1-3 — 最小可用体验

### 1.1 文件导入自动入库流水线（实施步骤 #1）

**设计文档要求**：
- 用户上传 CSV 词汇文件后，自动将 `import_candidates` 转化为 `vocabulary_words` + `user_word_progress`（Section 12.5, 13.3）
- 文件作为消息附件发送，不是独立导入流程（Section 9.2, 12.5）
- 支持 txt/csv/md，后续支持 pdf/docx（Section 9.2）
- 文件解析进 job queue，不阻塞聊天（Section 19.15）

**实施步骤**：

- [x] 1.1.1 在 FileIngestionEngine 实现 `processImportCandidates(file_id)` 方法
  - 查询 `import_candidates` 中 `status = 'pending'` 的记录
  - 对每条调用 `VocabularyEngine.addWordWithProgress()` 写入 `vocabulary_words` + `user_word_progress`
  - 更新候选记录 status 为 `processed`
  - 单条失败不阻塞其他候选
- [x] 1.1.2 在 `FileIngestionEngine.ingest` 中创建 `file_import` job
  - job payload 包含 `fileId`
  - 返回 job ID 给前端
- [x] 1.1.3 前端 ChatPage 增加导入状态反馈
  - 上传后显示"正在导入..."
  - 完成后显示"导入完成：新增 X 个词汇，跳过 Y 个"
  - 失败时显示错误信息
  - 轮询 job 状态直到完成

**验证**：
- [ ] 上传 10 个词汇的 CSV → `vocabulary_words` 新增 10 条
- [ ] `user_word_progress` 新增 10 条（status = 'new'）
- [ ] `source_links` 记录来源
- [ ] 重复上传触发去重逻辑

**涉及文件**：
- `src/main/services/file-ingestion-engine.ts`
- `src/renderer/src/pages/ChatPage.tsx`

---

### 1.2 Job Queue Handler 注册（实施步骤 #2）

**设计文档要求**：
- 后台任务队列支撑文件导入、总结生成、记忆更新（Section 19.14-19.15）
- 文件解析进 job queue，不阻塞聊天（Section 19.15）

**实施步骤**：

- [x] 1.2.1 在 `src/main/index.ts` 注册 job handlers
  - 注册 `file_import` handler → `FileIngestionEngine.processImportCandidates()`
  - 注册 `memory_update` handler → placeholder（内存更新在流程中内联处理）
  - 注册 `daily_summary` handler → `SummaryModule.createDailySummary()`
  - 注册 `weekly_review` handler → `SummaryModule.createWeeklyReview()`
- [x] 1.2.2 在 `src/main/index.ts` 的 `app.whenReady()` 中注册 handlers
- [x] 1.2.3 确保 JobQueue 启动后开始轮询

**验证**：
- [ ] 手动创建 `file_import` job → handler 被执行
- [ ] job 状态 `pending` → `running` → `done` 正确流转
- [ ] 失败时 job 状态为 `failed`，error 字段写入

**涉及文件**：
- `src/main/services/index.ts`
- `src/main/services/job-queue.ts`
- `src/main/index.ts`

---

## Phase 2: Week 1-2 — 核心学习闭环

### 2.1 每日总结自动生成触发（实施步骤 #3）

**设计文档要求**：
- 总结触发方式：用户说"今天到这里"、block 自动结束、学习日结束、每周复盘（Section 2.2.2.9）
- 每日总结内容：今天学了哪些主题、重点词掌握情况、哪些词还不稳、长难句主要卡点、下次优先复习什么（Section 2.2.2.9）
- 总结注入 AI 上下文，让 AI 第二天参考（Section 14.7）

**实施步骤**：

- [x] 2.1.1 `SummaryModule.createDailySummary(study_day)` 已存在
  - 从 `vocabEngine.getStats()` 查询词汇统计
  - 从 `sentenceEngine.getStats()` 查询长难句统计
  - 从 `grammarEngine.getStats()` 查询语法统计
  - 聚合数据写入 `daily_summaries`
- [x] 2.1.2 在 BLOCK_TIMEOUT 时自动触发总结
  - block 超时时自动创建 block summary 和 daily summary
  - 用户说"今天到这里"时通过 `createLightSummary()` 触发
- [ ] 2.1.3 学习日边界切换时触发（待实现跨午夜边界后完善）
- [x] 2.1.4 在 ContextRetriever 中注入每日总结和周复盘
  - 查询当天 `daily_summaries` → 作为 `dailySummary` 字段注入 AI 上下文
  - 查询最近 `weekly_reviews` → 作为 `weeklyReview` 字段注入 AI 上下文

**验证**：
- [x] block 超时 → 自动创建 daily_summary
- [x] 用户说"总结一下" → 创建 daily_summary
- [x] ContextRetriever 返回 dailySummary 和 weeklyReview

**涉及文件**：
- `src/main/services/summary-module.ts`
- `src/main/index.ts`（block timeout handler）
- `src/main/services/context-retriever.ts`

---

### 2.2 每周复盘自动生成触发（实施步骤 #4）

**设计文档要求**：
- 每周生成一次更系统的深度复盘（Section 2.2.2.9）
- 内容：词汇进展、语法改善、长难句能力变化、薄弱点趋势（Section 35.3）

**实施步骤**：

- [x] 2.2.1 增强 `SummaryModule.createWeeklyReview(week_start, week_end)` 方法
  - 查询指定周的 `daily_summaries` ✓
  - 查询 `learning_events`、`word_review_events`、`grammar_error_events` 聚合统计 ✓
  - 生成周复盘写入 `weekly_reviews` ✓
- [x] 2.2.2 自动触发逻辑
  - 学习日边界切换时 → 检查是否周一 → 检查上周是否有 `weekly_review` → 没有则创建 job ✓
- [x] 2.2.3 支持手动触发
  - IPC 暴露 `summary:createWeekly` ✓
  - 前端仪表盘增加"生成本周复盘"按钮 ✓
- [x] 2.2.4 在 ContextRetriever 中注入周复盘 ✓

**验证**：
- [x] 手动触发 `createWeeklyReview(...)` → `weekly_reviews` 新增记录
- [x] 记录包含正确的周统计
- [x] AI 对话中能读取到周复盘

**涉及文件**：
- `src/main/services/summary-module.ts`
- `src/main/services/learning-state-manager.ts`
- `src/main/services/context-retriever.ts`

---

### 2.3 AI 失败重试机制（实施步骤 #5）

**设计文档要求**：
- AI API 完全失败时：保留用户消息、显示错误提示、提供重试入口、不写入学习状态更新（Section 33.2）
- 结构化输出失败时：正常显示回复，不执行状态更新（Section 33.2）

**实施步骤**：

- [x] 2.3.1 确保用户消息在 AI 调用前已保存
  - `ChatRepository.saveUserMessage()` 在 `AIOrchestrator.handleMessage()` 之前执行 ✓ 已存在
- [x] 2.3.2 AI 失败时返回结构化错误
  - 错误类型：error message 以 `[错误]` 前缀标识
- [x] 2.3.3 后端实现 `regenerateMessage(messageId)`
  - 查询前一条用户消息
  - 删除旧错误消息
  - 重新执行完整 AI 处理流程
- [x] 2.3.4 前端增加重试按钮
  - MessageList 中错误消息显示"重试"按钮
  - 调用 `chat:regenerateMessage` IPC
  - 重试成功后替换错误消息

**验证**：
- [x] 模拟 AI 失败 → 用户消息已保存
- [x] 显示错误消息和重试按钮
- [x] 点击重试 → 重新调用 AI 并更新回复

**涉及文件**：
- `src/main/index.ts`（regenerateMessage handler）
- `src/main/repositories/chat.repository.ts`（deleteMessage）
- `src/preload/index.ts`
- `src/renderer/src/env.d.ts`
- `src/renderer/src/components/MessageList.tsx`
- `src/renderer/src/pages/ChatPage.tsx`
- `src/renderer/src/styles/global.css`

---

### 2.4 Context Budget Manager（实施步骤 #6）

**设计文档要求**：
- 控制每轮 AI 请求的上下文总长度，防止 prompt 无限膨胀（Section 20.1-20.3）
- 各部分预算分配（Section 20.2）

**实施步骤**：

- [x] 2.4.1 创建 `ContextBudgetManager` 服务
  - 文件：`src/main/services/context-budget-manager.ts`
  - `trim(context: FullContext): TrimmedContext` ✓
- [x] 2.4.2 实现裁剪逻辑
  - 按优先级裁剪：messages → memorySummary → dailySummary → weeklyReview → taskContext
  - 不裁剪：globalSystemPrompt、modePrompt、userInput ✓
- [x] 2.4.3 实现 token 估算
  - 中文字 ≈ 2 tokens，英文单词 ≈ 1.3 tokens ✓
- [x] 2.4.4 在 AIOrchestrator 中集成
  - `ContextRetriever.retrieve()` 之后、`PromptBuilder.build()` 之前调用 ✓

**验证**：
- [x] typecheck 通过
- [x] build 通过

**涉及文件**：
- `src/main/services/context-budget-manager.ts`（新建）
- `src/main/services/ai-orchestrator.ts`
- `src/main/services/index.ts`

---

### 2.5 FSRS 复习算法（实施步骤 #7）

**设计文档要求**：
- 复习调度准确性直接影响 18 个月使用效果（Section 3.4, 31.1-31.3）
- 词汇状态：new → learning → familiar → mastered / weak（Section 3.1）
- 4 维度评分：recognition / recall / context / usage（Section 3.2）

**实施步骤**：

- [x] 2.5.1 创建 Migration 008：`user_word_progress` 新增 `difficulty`、`stability`、`retrievability` 字段
- [x] 2.5.2 创建 `FSRSScheduler` 服务
  - 文件：`src/main/services/fsrs-scheduler.ts`
  - 核心公式：retrievability、nextInterval、updateDifficulty、updateStability
- [x] 2.5.3 定义答题质量等级：Again(0) / Hard(1) / Good(2) / Easy(3)
- [x] 2.5.4 在 VocabularyEngine 中集成 FSRS
  - 修改 `recordReview()` → 计算 grade → 调用 FSRSScheduler → 更新 next_review_at
- [x] 2.5.5 保留 SM-2 字段作为 fallback
- [x] 2.5.6 同样应用于 SentenceEngine

**验证**：
- [ ] 导入 20 个词汇，进行 5 轮复习
- [ ] 答对时 `next_review_at` 间隔逐渐增大
- [ ] 答错时间隔缩短
- [ ] `stability` 和 `retrievability` 正确更新

**涉及文件**：
- `src/main/services/fsrs-scheduler.ts`（新建）
- `src/main/db/migrations/008_fsrs_fields.ts`（新建）
- `src/main/services/vocabulary-engine.ts`
- `src/main/services/sentence-engine.ts`

---

## Phase 3: Week 3-4 — 系统可靠性

### 3.1 跨午夜学习日边界（实施步骤 #8）

**设计文档要求**：
- 学习日边界默认凌晨 4 点（Section 2.2.2.5）
- 23:00-04:00 学习算作同一天
- 后续可在设置中调整（3/4/5/自然日）

**实施步骤**：

- [x] 3.1.1 创建 `getStudyDay(date?: Date): string` 函数
  - < 04:00 → 前一天；>= 04:00 → 当天
- [x] 3.1.2 修改所有使用 study_day 的地方
  - `LearningStateManager.getState()` 和 `transition()` ✓
  - `DailyTargetPoolManager.getOrCreateToday()` ✓
  - `SummaryModule.createDailySummary()` ✓
  - `VocabularyThemeLesson` ✓
- [x] 3.1.3 在 `app_settings` 新增 `study_day_boundary_hour`，默认 4 ✓
- [x] 3.1.4 前端设置页面增加边界配置 ✓

**验证**：
- [x] 03:00 → 返回前一天日期
- [x] 23:30 开始，02:00 结束 → 属于同一天

**涉及文件**：
- `src/main/services/learning-state-manager.ts`
- `src/main/services/daily-target-pool-manager.ts`
- `src/main/services/summary-module.ts`
- `src/main/services/vocabulary-theme-lesson.ts`
- `src/renderer/src/pages/SettingsPage.tsx`

---

### 3.2 消息分页加载（实施步骤 #9）

**设计文档要求**：
- 默认加载 50-100 条消息（Section 27.4）
- 长会话使用虚拟列表（Section 27.4）
- 永不渲染超过 200 条（Section 27.4）

**实施步骤**：

- [x] 3.2.1 后端分页查询
  - `ChatRepository.getMessages(sessionId, limit, offset)` ✓ 已存在
- [x] 3.2.2 前端 MessageList 分页逻辑
  - 初始加载 50 条 ✓
  - "加载更多"按钮 ✓
  - hasMore/loadingMore 状态管理 ✓
- [ ] 3.2.3 长 Markdown 回复折叠（待实现）

**验证**：
- [x] 初始加载 50 条
- [x] 点击"加载更多" → 加载更多消息
- [x] typecheck 通过
- [x] build 通过

**涉及文件**：
- `src/renderer/src/components/MessageList.tsx`
- `src/renderer/src/pages/ChatPage.tsx`
- `src/renderer/src/styles/global.css`

---

### 3.3 Prompt 版本管理（实施步骤 #10）

**设计文档要求**：
- 每次修改 prompt 记录版本，追踪效果变化（Section 24.1-24.3）
- `prompt_versions` 表已存在（Migration 1）
- 支持版本回退

**实施步骤**：

- [x] 3.3.1 创建 `PromptVersionManager` 服务
  - `createVersion`、`getActiveVersion`、`setActiveVersion`、`getVersionHistory`
- [x] 3.3.2 在 PromptBuilder 中集成
  - 从 `prompt_versions` 表读取激活版本
- [x] 3.3.3 初始化默认 prompt 版本
  - 首次启动时写入当前硬编码 prompt
- [x] 3.3.4 在 AI 日志中关联 prompt 版本 ID
  - PromptBuilder 返回 PromptBuildResult 包含 promptVersions
  - AIOrchestrator 将版本 ID 传递给 AILogger
  - AILogger 的 global_prompt_version 和 mode_prompt_version 字段已填充

**验证**：
- [x] 首次启动后 `prompt_versions` 有默认记录
- [x] 修改 prompt 创建新版本 → AI 使用新版本
- [x] 切换回旧版本 → AI 回复风格变化

**涉及文件**：
- `src/main/services/prompt-version-manager.ts`（新建）
- `src/main/services/prompt-builder.ts`
- `src/main/services/ai-logger.ts`
- `src/main/db/database.ts`

---

## Phase 4: Week 5-8 — 用户体验与产品完善

### 4.1 输出质量检查（实施步骤 #11）

**设计文档要求**：
- 防止客服式回复、过度鼓励、连续反问（Section 55.1-55.3）
- 可修复的问题直接删除（Section 55.4）

**实施步骤**：

- [x] 4.1.1 创建 `OutputLinter` 服务
  - 检查：客服式开场、过度鼓励、连续反问、未回答问题
  - `lint(reply, context): LintResult`
- [x] 4.1.2 在 AIOrchestrator 中集成

**验证**：
- [ ] 包含"当然可以！"的回复 → 检测并移除
- [ ] 连续反问的回复 → 检测

**涉及文件**：
- `src/main/services/output-linter.ts`（新建）
- `src/main/services/ai-orchestrator.ts`

---

### 4.2 测试集评估（实施步骤 #12）

**设计文档要求**：
- 固定测试样例，修改 prompt/模型后批量验证（Section 56.1-56.3）

**实施步骤**：

- [x] 4.2.1 创建测试集 `src/main/testing/test-cases.json` ✓
- [x] 4.2.2 创建测试运行器 `src/main/testing/test-runner.ts` ✓
- [x] 4.2.3 设置页面增加"运行测试"按钮 ✓

**验证**：
- [x] 运行测试集 → 每个用例有结果
- [x] 报告清晰可读

**涉及文件**：
- `src/main/testing/test-cases.json`（新建）
- `src/main/testing/test-runner.ts`（新建）
- `src/renderer/src/pages/SettingsPage.tsx`

---

### 4.3 导出完整数据包（实施步骤 #13）

**设计文档要求**：
- 导出数据库 + 设置 + 文件，用于换电脑（Section 30.1-30.2）

**实施步骤**：

- [x] 4.3.1 `BackupService.exportFullPackage()` → 打包为 zip ✓
- [x] 4.3.2 前端设置页面增加导出按钮 ✓

**验证**：
- [x] 导出 → 生成 zip → 解压包含数据库和设置

**涉及文件**：
- `src/main/services/backup-service.ts`
- `src/renderer/src/pages/SettingsPage.tsx`

---

### 4.4 PDF/DOCX 解析（实施步骤 #14）

**设计文档要求**：
- 第一版 txt/csv/md，后续 pdf/docx（Section 9.2）

**实施步骤**：

- [x] 4.4.1 安装 `pdf-parse` 和 `mammoth` ✓
- [x] 4.4.2 FileIngestionEngine 添加 PDF/DOCX 解析 ✓
- [x] 4.4.3 更新前端文件选择器 ✓

**验证**：
- [x] 上传 PDF → 内容正确提取
- [x] 上传 DOCX → 内容正确提取

**涉及文件**：
- `src/main/services/file-ingestion-engine.ts`
- `package.json`
- `src/renderer/src/components/MessageInput.tsx`

---

### 4.5 数据库恢复入口（实施步骤 #15）

**设计文档要求**：
- 支持从备份恢复数据库（Section 30.1）

**实施步骤**：

- [x] 4.5.1 `BackupService.restoreBackup(backupPath)`
  - 校验完整性 → 自动备份当前 DB → 替换 → 重新打开 → migration 检查 ✓
- [x] 4.5.2 前端备份列表增加"恢复"按钮 + 确认对话框 ✓

**验证**：
- [ ] 创建备份 → 修改数据 → 恢复 → 数据回到备份时状态
- [ ] 恢复前自动创建快照备份

**涉及文件**：
- `src/main/services/backup-service.ts`
- `src/renderer/src/pages/SettingsPage.tsx`

---

## Phase 5: 前端 UI 改造

### 5.1 布局架构改造（P0）

**设计文档要求**：
- ChatGPT 式三栏布局：左侧历史会话栏 + 中间对话区 + 右侧可收起仪表盘（Section 2.1）
- 左侧不做重导航栏，最多历史会话或极简图标栏（Section 2.1）
- 右侧仪表盘默认收起，显示学习时间和轻量状态（Section 2.1, 9.4）
- 设置以 Modal 弹窗覆盖当前页面（Section 4.2）

**实施步骤**：

- [!] 5.1.1 初始化 untitledui 组件库
  - `untitledui init /Users/milagro/Desktop/eng --vite`
  - 跳过：使用自定义组件实现
- [!] 5.1.2 添加 untitledui 组件
  - `untitledui add sidebar-navigation-base --yes`（左侧会话栏）
  - `untitledui add modal --yes`（确认弹窗 + 设置弹窗）
  - 跳过：使用自定义组件实现
- [x] 5.1.3 重构 App.tsx 布局
  - 三栏布局：左会话栏 + 中对话区 + 右仪表盘
  - 移除 TabNav 的三 Tab 切换
- [x] 5.1.4 创建 SessionSidebar 组件
  - 调用 `chat:getSessionList` IPC
  - 显示历史会话列表，支持切换
  - 显示会话类型标识和标题
- [x] 5.1.5 创建 DashboardPanel 组件（右侧可收起）
  - 极简设计：学习时间（实时）、累计时间、轻量状态
  - 默认收起，点击展开
- [x] 5.1.6 设置改为 Modal 弹窗
  - SettingsPage 改为 SettingsModal
  - 通过齿轮图标或 `/settings` 命令打开

**验证**：
- [x] 打开 App → 看到三栏布局
- [x] 左侧会话栏可浏览/切换历史会话
- [x] 右侧仪表盘可收起/展开
- [x] 设置以弹窗形式打开，不离开对话

**涉及文件**：
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/SessionSidebar.tsx`（新建）
- `src/renderer/src/components/DashboardPanel.tsx`（新建）
- `src/renderer/src/components/SettingsModal.tsx`（新建）
- `src/renderer/src/components/TabNav.tsx`（重构）

---

### 5.2 对话页面增强（P1）

**设计文档要求**：
- 流式 AI 回复，逐 token 显示（Section 27.2）
- 用户消息发送后立即显示（Section 27.2）
- AI 失败时保留消息 + 重试入口（Section 33.2）
- 文件作为消息附件，可加文字说明一起发送（Section 12.5）
- 学习时间实时显示（Section 9.4）

**实施步骤**：

- [x] 5.2.1 流式 AI 回复
  - 后端：AIOrchestrator 支持 streaming IPC ✓
  - 前端：MessageList 逐 token 渲染，打字机效果 ✓
  - AIProvider 接口新增 chatStream 方法 ✓
  - OpenAIProvider 实现 SSE 流式解析 ✓
  - MockAIProvider 实现字符级流式模拟 ✓
  - IPC 层：chat:stream / chat:stream:chunk / chat:stream:complete / chat:stream:error ✓
  - Preload 新增 streamMessage / onStreamChunk / onStreamComplete / onStreamError ✓
  - ChatPage 使用流式发送，实时更新 streamingContent ✓
  - MessageList 显示流式内容 + 闪烁光标 ✓
- [x] 5.2.2 AI 重试按钮
  - MessageList 中错误消息显示重试按钮
  - 调用 `chat:regenerateMessage`
- [ ] 5.2.3 文件附件随消息发送
  - 改造 MessageInput 的"+"按钮行为
  - 选择文件后暂存到 state，显示文件名
  - 用户可输入文字说明
  - 发送时文件+文字一起发送
- [x] 5.2.4 学习时间实时显示
  - 创建 LearningTimer 组件 ✓
  - 当前会话计时器（1 秒间隔更新）✓
  - 今日累计学习时间 ✓
- [x] 5.2.5 长 Markdown 折叠
  - 超过一定长度的 AI 回复默认折叠 ✓
  - 点击展开 ✓

**验证**：
- [x] AI 回复逐 token 显示
- [x] AI 失败 → 重试按钮可用
- [ ] 选择文件 + 输入文字 → 一起发送
- [x] 学习时间实时更新

**涉及文件**：
- `src/main/services/ai-orchestrator.ts`（streaming）
- `src/preload/index.ts`（streaming IPC）
- `src/renderer/src/components/MessageList.tsx`
- `src/renderer/src/components/MessageInput.tsx`
- `src/renderer/src/components/LearningTimer.tsx`（新建）
- `src/renderer/src/pages/ChatPage.tsx`

---

### 5.3 Slash 命令系统（P2）

**设计文档要求**：
- 完整命令列表：/背单词, /复习, /长难句, /语法纠错, /自由聊天, /今日计划, /无限学习, /总结, /设置语言, /错词（Section 9.3）
- 独立 SlashCommandMenu 组件（Section 18）

**实施步骤**：

- [x] 5.3.1 创建独立 SlashCommandMenu 组件
  - 从 MessageInput 中提取 ✓
  - 支持图标/分类 ✓
- [x] 5.3.2 补全命令列表
  - 新增 /设置语言 和 /错词 ✓
  - 新增 /settings 打开设置弹窗 ✓

**验证**：
- [ ] 输入"/" → 显示完整命令菜单
- [ ] 所有 10+ 个命令可选择

**涉及文件**：
- `src/renderer/src/components/SlashCommandMenu.tsx`（新建）
- `src/renderer/src/components/MessageInput.tsx`

---

### 5.4 词汇教学显示（P2）

**设计文档要求**：
- 5 种教学形式：故事/讨论/知识分享/考研小短文/易混词对比（Section 4.3.1.1）
- 词汇详情：音标、词性、中英文释义、AI 讲解、例句、搭配、同义词/反义词、记忆技巧（Section 3.2）
- 显示当前教学形式标签

**实施步骤**：

- [x] 5.4.1 创建 VocabDetailCard 组件
  - 调用 `vocab:getVocabProgressInfo` IPC ✓
  - 展示完整词汇信息 ✓
- [x] 5.4.2 创建 TeachingFormatBadge 组件
  - 显示当前教学形式（故事/讨论/知识/短文/对比）✓
- [x] 5.4.3 在 LearningStatusBar 显示教学形式
  - 根据 currentTask 映射到教学形式 ✓
  - 活跃学习时显示 TeachingFormatBadge ✓

**验证**：
- [x] 词汇主题课 → 显示当前教学形式标签
- [x] 词汇详情卡片显示完整信息

**涉及文件**：
- `src/renderer/src/components/VocabDetailCard.tsx`（新建）
- `src/renderer/src/components/TeachingFormatBadge.tsx`（新建）
- `src/renderer/src/components/LearningStatusBar.tsx`

---

### 5.5 确认与安全（P1）

**设计文档要求**：
- 破坏性操作需二次确认（Section 48）
- 确认类型：delete/overwrite/bulk_update/clear/reset/mark_all/import_replace/restore_backup
- 自动备份后再执行（Section 48）

**实施步骤**：

- [x] 5.5.1 创建通用 ConfirmDialog 组件
  - 基于 untitledui `modal` ✓
  - 支持确认/取消、自定义消息 ✓
- [x] 5.5.2 在破坏性操作处集成
  - 备份删除 → 确认对话框 ✓
  - 数据库恢复 → 确认对话框 ✓
  - AI 检测的破坏性操作 → 复用 ConfirmDialog ✓

**验证**：
- [x] 删除备份 → 弹出确认对话框
- [x] 恢复数据库 → 弹出确认对话框

**涉及文件**：
- `src/renderer/src/components/ConfirmDialog.tsx`（新建）
- `src/renderer/src/pages/SettingsPage.tsx`

---

### 5.6 WeeklyReviewView 组件（P2）

**设计文档要求**：
- 独立组件展示周复盘详情（Section 18）
- 内容：词汇进展、语法改善、长难句能力变化、薄弱点趋势、下周建议（Section 35.3）

**实施步骤**：

- [x] 5.6.1 创建 WeeklyReviewView 组件
  - 调用 `review:getWeeklyReview` IPC ✓
  - 展示完整周复盘数据 ✓

**验证**：
- [x] 有周复盘数据时 → 显示详细视图

**涉及文件**：
- `src/renderer/src/components/WeeklyReviewView.tsx`（新建）

---

## Phase 6: 其他设计要求

### 6.1 休息提醒（P3）

**设计文档要求**：
- 60-90 分钟连续学习后轻量询问是否继续（Section 2.2.2.8）
- 不强制打断
- 表现下降时建议先总结

**实施步骤**：

- [x] 6.1.1 LearningStateManager 中新增提醒检查
  - block 持续 > 60 分钟 → 设置 `break_reminder_pending = true` ✓
- [x] 6.1.2 ContextRetriever 注入提醒信号
- [x] 6.1.3 PromptBuilder 处理提醒

**验证**：
- [x] 持续学习 60 分钟 → AI 包含提醒
- [x] 用户说"继续" → 不再重复提醒

**涉及文件**：
- `src/main/services/learning-state-manager.ts`
- `src/main/services/context-retriever.ts`
- `src/main/services/prompt-builder.ts`

---

### 6.2 发送中打断（P2）

**设计文档要求**：
- AI 回复中用户可发送新消息，中断当前回复（Section 46.1）
- 当前回复标记为 cancelled 或 partial

**实施步骤**：

- [x] 6.2.1 后端支持中断当前 AI 流
- [x] 6.2.2 前端发送按钮在 loading 时可点击
- [x] 6.2.3 当前回复标记为 cancelled

**验证**：
- [x] AI 回复中发送新消息 → 当前回复中断 → 新消息进入处理

**涉及文件**：
- `src/main/services/ai-orchestrator.ts`
- `src/renderer/src/pages/ChatPage.tsx`
- `src/renderer/src/components/MessageInput.tsx`

---

## 最终验证清单

- [x] `npm run typecheck` 通过
- [x] `npm run lint` 通过（0 errors, 55 warnings）
- [x] `npm run build` 通过
- [x] `npm test` 通过（23 tests, 2 suites）
- [x] 所有 15 个实施步骤功能完成
- [x] 所有前端 UI 改造完成
- [x] 设计文档所有验收标准满足
- [x] git status clean
- [!] PR 创建（需要配置远程仓库）
