# 功能缺口分步实施文档

基于设计文档（8732 行）与当前代码库（63 个源文件）的对比分析，以下是待实现功能的分步实施方案。

---

## 总览

| 阶段 | 时间 | 目标 | 优先级范围 |
|------|------|------|-----------|
| Day 1-3 | 第 1-3 天 | 最小可用体验：词汇能导入、后台任务能跑 | 1-2 |
| Week 1-2 | 第 1-2 周 | 核心学习闭环：总结自动生成、复习算法升级 | 3-7 |
| Week 3-4 | 第 3-4 周 | 系统可靠性：AI 重试、上下文预算、消息分页、Prompt 版本 | 8-11 |
| Week 5-8 | 第 5-8 周 | 用户体验与产品完善 | 12-20 |

**修订说明**（相比初版）：
- 文件导入从 #2 提升到 #1 —— 没有词汇库，核心学习功能完全不可用
- Job Queue 从 #1 降到 #2 —— 它是基础设施，但不是用户直接感知的功能
- FSRS 从 #10 提升到 #7 —— 直接影响 18 个月使用周期的复习效果
- 跨午夜学习日边界从 #5 降到 #8 —— 使用频率相对低，且当前用自然日也能工作
- 阶段结构从"技术分层"改为"时间线" —— 以交付可用功能为导向

---

## 组件开发策略

### 原则

- **简单组件**（按钮、输入框、卡片、列表、标签等）→ 自己写，用 `/d3` skill 辅助
- **复杂组件**（弹窗、侧边栏导航、Tabs 切换、复杂表单等）→ 用 **untitledui CLI** 生成

### untitledui CLI 使用方法

**路径**：`/Users/milagro/.local/node/current/bin/untitledui`

**项目初始化**（首次使用，项目已用 Vite）：
```bash
untitledui init /Users/milagro/Desktop/eng --vite
```

**添加组件**：
```bash
# 添加单个组件
untitledui add modal --yes

# 添加多个组件
untitledui add tabs sidebar-navigation-base header-navigation --yes

# 指定项目路径
untitledui add modal -d /Users/milagro/Desktop/eng --yes

# 指定组件类型
untitledui add modal -t application --yes
```

**搜索组件**：
```bash
# 自然语言搜索
untitledui search "sidebar navigation"
untitledui search "modal dialog confirmation"
untitledui search "tabs navigation"
```

**常用选项**：
- `--yes` / `-y`：非交互模式，使用默认配置（AI 代理推荐使用）
- `-d <directory>`：指定项目目录
- `-t <type>`：指定组件类型（base / application / marketing / shared-assets / foundations）
- `-o`：覆盖已有文件

### 本项目可用的 untitledui 组件

根据搜索结果，以下组件适合本项目：

| 组件 | 用途 | 命令 |
|------|------|------|
| `modal` | 设置弹窗、确认对话框 | `untitledui add modal --yes` |
| `tabs` | 对话/仪表盘切换（如保留 Tab 形式） | `untitledui add tabs --yes` |
| `sidebar-navigation-base` | 左侧历史会话栏 | `untitledui add sidebar-navigation-base --yes` |
| `sidebar-simple` | 简洁侧边栏变体 | `untitledui add sidebar-simple --yes` |
| `header-navigation` | 顶部导航栏 | `untitledui add header-navigation --yes` |
| `sidebar-section-dividers` | 带分隔线的侧边栏 | `untitledui add sidebar-section-dividers --yes` |

### 组件分配方案

| 前端工作 | 组件来源 | 说明 |
|----------|----------|------|
| 确认对话框 | **untitledui `modal`** | 复杂弹窗逻辑，用现成组件 |
| 设置弹窗 | **untitledui `modal`** | 复用同一组件 |
| 左侧会话栏 | **untitledui `sidebar-navigation-base`** | 导航类组件用现成的 |
| 右侧仪表盘面板 | **自己写** | 简单的收起/展开面板 |
| 消息列表分页 | **自己写** | 滚动加载逻辑，无现成组件 |
| 流式打字机效果 | **自己写** | 文本动画，简单实现 |
| AI 重试按钮 | **自己写** | 简单按钮 |
| 文件附件 UI | **自己写** | 简单的文件预览条 |
| Slash 命令菜单 | **自己写** | 已有基础，扩展即可 |
| 学习时间计时器 | **自己写** | 简单定时器 |
| 词汇详情卡片 | **自己写** | 纯数据展示 |
| 教学形式标签 | **自己写** | 简单 Badge |
| WeeklyReviewView | **自己写** | Markdown 渲染 + 数据展示 |

---

## Day 1-3：最小可用体验

### 第 1 项：文件导入自动入库流水线

**目标**：用户上传 CSV 词汇文件后，系统自动将解析出的词汇候选项转化为实际的 `vocabulary_words` 和 `user_word_progress` 记录。这是整个应用的核心前提——没有词汇库，背单词、复习、主题课等功能全部不可用。

**前置条件**：`FileIngestionEngine` 的 CSV 解析和 `import_candidates` 创建逻辑已存在。

**步骤**：

1. **在 FileIngestionEngine 中实现 `processImportCandidates` 方法**
   - 输入：`file_id: number`
   - 逻辑：
     - 查询 `import_candidates` 表中 `status = 'pending'` 且 `file_id` 匹配的记录
     - 对每条候选记录，调用 `VocabularyEngine.addWord()` 写入 `vocabulary_words`
     - 创建对应的 `user_word_progress` 记录（status = 'new'）
     - 在 `source_links` 表中记录来源关系（source_type = 'file', source_id = file_id）
     - 将候选记录 status 更新为 `processed`
   - 错误处理：单条失败不阻塞其他候选，记录失败原因

2. **在 FileIngestionEngine.ingest 方法中触发异步处理**
   - 当文件解析完成后，创建 `file_import` 类型的 job
   - job payload 包含 `file_id`
   - 返回 job ID 给前端

3. **前端 ChatPage 增加导入反馈**
   - 文件上传成功后，显示"正在导入..."状态
   - 导入完成后，显示"导入完成：新增 X 个词汇，跳过 Y 个已存在词汇"
   - 导入失败时，显示错误信息

4. **验证**
   - 上传一个包含 10 个词汇的 CSV 文件
   - 确认 `vocabulary_words` 表新增 10 条记录
   - 确认 `user_word_progress` 表新增 10 条记录（status = 'new'）
   - 确认 `source_links` 表记录了来源
   - 上传重复文件，确认去重逻辑

**涉及文件**：
- `src/main/services/file-ingestion-engine.ts`（新增 `processImportCandidates`）
- `src/renderer/src/pages/ChatPage.tsx`（导入状态反馈）

---

### 第 2 项：Job Queue Handler 注册

**目标**：让后台任务队列真正运转起来，支撑文件导入、总结生成、记忆更新等异步任务。Job Queue 框架已存在但没有任何 handler 注册，所有异步任务（file_import、daily_summary、weekly_review、memory_update）都卡在 pending 状态。

**前置条件**：`src/main/services/job-queue.ts` 框架已存在，`src/main/repositories/job.repository.ts` 已存在。

**步骤**：

1. **创建 `registerJobHandlers()` 函数**
   - 在 `src/main/services/index.ts` 中创建
   - 注册 4 种 handler：
     - `file_import` → 调用 `FileIngestionEngine.processImportCandidates()`
     - `memory_update` → 调用 `MemoryEngine.updateAfterBlock()` 或 `updateAfterDailySummary()`
     - `daily_summary` → 调用 `SummaryModule.createDailySummary()`
     - `weekly_review` → 调用 `SummaryModule.createWeeklyReview()`
   - Handler 签名：`async (job: Job) => Promise<void>`
   - 成功时更新 job 状态为 `done`，失败时更新为 `failed` 并记录 error

2. **在应用启动时注册 handlers**
   - 在 `src/main/index.ts` 的 `app.whenReady()` 回调中调用 `registerJobHandlers()`
   - 确保 JobQueue 实例在应用启动后开始轮询

3. **验证**
   - 手动创建一个 `file_import` 类型的 job，确认 handler 被执行
   - 确认 job 状态从 `pending` → `running` → `done` 正确流转
   - 确认失败时 job 状态为 `failed`，error 字段被写入

**涉及文件**：
- `src/main/services/index.ts`（新增 `registerJobHandlers`）
- `src/main/services/job-queue.ts`（确认 handler 注册机制）
- `src/main/index.ts`（启动时调用注册）

---

## Week 1-2：核心学习闭环

### 第 3 项：每日总结自动生成触发

**目标**：在学习日结束时（用户说"今天到这里"、block 超时、学习日切换），系统自动生成每日总结并写入 `daily_summaries` 表。总结让 AI 在第二天能参考昨日表现调整教学策略。

**前置条件**：`SummaryModule.createDailySummary()` 已存在，第 2 项完成（Job Queue handler 可用）。

**步骤**：

1. **增强 `createDailySummary` 方法**
   - 从 `learning_events` 表查询当天所有学习事件
   - 从 `word_review_events` 表查询当天词汇练习统计
   - 从 `user_sentence_progress` 表查询当天长难句练习统计
   - 从 `grammar_error_events` 表查询当天语法错误统计
   - 聚合数据生成 summary 文本（可调用 AI 生成自然语言总结）
   - 写入 `daily_summaries` 表

2. **创建自动触发机制**
   - 在 `LearningStateManager` 中，当 `USER_STOPS_LEARNING` 或 `USER_REQUESTS_SUMMARY` 事件触发时：创建 `daily_summary` 类型的 job
   - 在 `BLOCK_TIMEOUT` 事件触发时（45分钟无互动），也触发每日总结

3. **在学习日边界切换时触发**
   - 当系统检测到学习日切换（凌晨 4 点后第一次学习行为）：
     - 检查前一天是否有 `daily_summary`
     - 如果没有，自动生成

4. **在 AI 上下文中注入每日总结**
   - 在 `ContextRetriever` 中，查询当天的 `daily_summaries`
   - 如果存在，作为 `daily_summary` 字段注入 AI 上下文

5. **验证**
   - 手动触发 `createDailySummary('2026-05-28')`
   - 确认 `daily_summaries` 表新增一条记录
   - 确认第二天的 AI 对话中能读取到昨日总结

**涉及文件**：
- `src/main/services/summary-module.ts`（增强 `createDailySummary`）
- `src/main/services/learning-state-manager.ts`（触发总结）
- `src/main/services/context-retriever.ts`（注入总结到上下文）

---

### 第 4 项：每周复盘自动生成触发

**目标**：每周自动（或手动触发）生成深度复盘，写入 `weekly_reviews` 表。周复盘让 AI 了解用户本周整体表现和薄弱趋势。

**前置条件**：`SummaryModule.createWeeklyReview()` 已存在，第 3 项完成（每日总结数据可用）。

**步骤**：

1. **增强 `createWeeklyReview` 方法**
   - 查询指定周的 `daily_summaries` 数据
   - 查询该周的 `learning_events`、`word_review_events`、`grammar_error_events` 聚合统计
   - 生成周复盘内容：词汇进展、语法改善、长难句能力变化、薄弱点趋势
   - 写入 `weekly_reviews` 表

2. **实现自动触发逻辑**
   - 在学习日边界切换时（凌晨 4 点后第一次学习行为）：
     - 检查今天是否是周一
     - 如果是，检查上周是否有 `weekly_review`
     - 如果没有，创建 `weekly_review` 类型的 job

3. **支持手动触发**
   - 通过 IPC 暴露 `summary:createWeekly` 方法
   - 前端在仪表盘页面增加"生成本周复盘"按钮
   - 或通过 `/周复盘` slash command 触发

4. **在 AI 上下文中注入周复盘**
   - 在 `ContextRetriever` 中，查询最近的 `weekly_reviews`
   - 注入 AI 上下文

5. **验证**
   - 手动触发 `createWeeklyReview('2026-05-22', '2026-05-28')`
   - 确认 `weekly_reviews` 表新增一条记录
   - 确认 AI 对话中能读取到周复盘

**涉及文件**：
- `src/main/services/summary-module.ts`（增强 `createWeeklyReview`）
- `src/main/services/learning-state-manager.ts`（触发逻辑）
- `src/main/services/context-retriever.ts`（注入上下文）

---

### 第 5 项：AI 失败重试机制

**目标**：AI API 调用失败时，用户可以一键重试，且不会丢失已发送的消息。设计文档明确要求："保留用户消息，显示错误提示，提供重试入口，不写入学习状态更新。"

**前置条件**：`AIOrchestrator` 的错误处理逻辑已存在基础框架。

**步骤**：

1. **确保用户消息在 AI 调用前已保存**
   - 在 `AIOrchestrator.handleMessage()` 中，确认 `ChatRepository.saveUserMessage()` 在调用 AI 之前执行

2. **AI 失败时返回结构化错误**
   - 修改 `AIOrchestrator`，当 AI 调用失败时，返回错误类型（network_error / api_error / parse_error / timeout）
   - 不要吞掉错误

3. **后端实现 regenerateMessage**
   - 在 `AIOrchestrator` 中新增 `regenerateMessage(messageId)` 方法
   - 逻辑：查询该消息之前的最后一条用户消息，重新执行完整的 AI 处理流程，用新的 AI 回复替换旧的错误消息

4. **前端增加重试按钮**
   - 在 `MessageList` 组件中，当最后一条 AI 消息是错误消息时，显示"重试"按钮
   - 点击重试按钮，调用 `chat:regenerateMessage` IPC 方法

5. **验证**
   - 模拟 AI API 失败（断网或使用无效 API key）
   - 确认用户消息已保存
   - 确认显示错误消息和重试按钮
   - 点击重试，确认重新调用 AI 并更新回复

**涉及文件**：
- `src/main/services/ai-orchestrator.ts`（错误处理、regenerate 方法）
- `src/preload/index.ts`（注册 regenerate channel）
- `src/renderer/src/components/MessageList.tsx`（重试按钮 UI）

---

### 第 6 项：Context Budget Manager

**目标**：控制每轮 AI 请求的上下文总长度，防止 prompt 无限膨胀导致 AI 质量下降或超出 token 限制。长期使用 18 个月后，记忆、历史、词汇数据会持续增长，必须有预算控制。

**前置条件**：`ContextRetriever` 已存在，`PromptBuilder` 已存在。

**步骤**：

1. **创建 ContextBudgetManager 服务**
   - 文件：`src/main/services/context-budget-manager.ts`
   - 职责：接收完整上下文，按优先级裁剪到预算范围内

2. **定义上下文预算规则**
   - 全局 token 预算：默认 12000 tokens 用于上下文
   - 各部分预算分配：
     - `recent_messages`：最多 2000 tokens（约 10-15 条消息）
     - `ai_memory_summary`：最多 1500 tokens（每类最多 3 条）
     - `retrieved_context`：最多 2000 tokens
     - `daily_target_pool`：最多 500 tokens
     - `lesson_context`：最多 1500 tokens
     - `student_state`：最多 500 tokens
     - `mode_prompt`：最多 1000 tokens
     - `global_system_prompt`：最多 1500 tokens

3. **实现裁剪逻辑**
   - `trim(context: FullContext): TrimmedContext` 方法
   - 按优先级从低到高裁剪：retrieved_context → recent_messages → ai_memory_summary → lesson_context
   - 不裁剪：global_system_prompt、mode_prompt、student_state、当前用户输入

4. **在 AIOrchestrator 中集成**
   - 在 `ContextRetriever.retrieve()` 之后、`PromptBuilder.build()` 之前调用 `ContextBudgetManager.trim(context)`

5. **token 估算方法**
   - 粗略估算：1 个中文字 ≈ 2 tokens，1 个英文单词 ≈ 1.3 tokens

6. **验证**
   - 构造一个超大上下文（大量历史消息 + 多条记忆）
   - 确认裁剪后总 token 数在预算范围内
   - 确认高优先级内容未被裁剪

**涉及文件**：
- `src/main/services/context-budget-manager.ts`（新建）
- `src/main/services/ai-orchestrator.ts`（集成 budget manager）
- `src/main/services/index.ts`（导出新服务）

---

### 第 7 项：FSRS 复习算法

**目标**：将当前的 SM-2 复习调度升级为 FSRS-inspired 简化算法，提高复习准确性。用户计划使用 18 个月，复习调度的准确性直接影响长期学习效果。

**前置条件**：`VocabularyEngine` 的 SM-2 逻辑已存在。

**步骤**：

1. **在 user_word_progress 表中新增 FSRS 字段**
   - 创建 Migration 008：`difficulty`（REAL）、`stability`（REAL）、`retrievability`（REAL）
   - 初始值：difficulty = 0.3, stability = 1.0, retrievability = 1.0

2. **创建 FSRSScheduler 服务**
   - 文件：`src/main/services/fsrs-scheduler.ts`
   - 实现 FSRS 核心公式：
     - `retrievability(t, S) = (1 + t/(9*S))^(-1)`
     - `nextInterval(R, S, grade)` 根据答题质量调整
     - `updateDifficulty(D, grade)` 根据答题质量更新
     - `updateStability(S, R, grade)` 根据 retrievability 和答题质量更新

3. **定义答题质量等级（grade）**
   - `Again` (0)：完全不会
   - `Hard` (1)：勉强答对
   - `Good` (2)：正常答对
   - `Easy` (3)：轻松答对

4. **在 VocabularyEngine 中集成 FSRS**
   - 修改 `recordReview()` 方法
   - 根据答题结果计算 grade，调用 `FSRSScheduler` 更新
   - 计算 `next_review_at`：`now + nextInterval`

5. **保留 SM-2 字段作为 fallback**
   - 如果 FSRS 字段为空，fallback 到 SM-2

6. **同样应用于 SentenceEngine**
   - `user_sentence_progress` 表也新增 FSRS 字段

7. **验证**
   - 导入 20 个词汇，进行 5 轮复习
   - 确认 `next_review_at` 的间隔逐渐增大（答对时）
   - 确认答错时间隔缩短

**涉及文件**：
- `src/main/services/fsrs-scheduler.ts`（新建）
- `src/main/db/migrations/008_fsrs_fields.ts`（新 migration）
- `src/main/services/vocabulary-engine.ts`（集成 FSRS）
- `src/main/services/sentence-engine.ts`（集成 FSRS）

---

## Week 3-4：系统可靠性

### 第 8 项：跨午夜学习日边界（4am）

**目标**：将学习日边界从自然日改为凌晨 4 点，确保 23:00-04:00 的学习算作同一天。

**前置条件**：`LearningStateManager` 的 `study_day` 逻辑需要修改。

**步骤**：

1. **创建学习日计算工具函数**
   - 在 `learning-state-manager.ts` 中新增 `getStudyDay(date?: Date): string`
   - 逻辑：当前时间 < 04:00 → study_day = 前一天；否则 = 当天

2. **修改所有使用 study_day 的地方**
   - `LearningStateManager.getState()` 和 `transition()`
   - `DailyTargetPoolManager.getOrCreateToday()`
   - `SummaryModule.createDailySummary()`
   - `VocabularyThemeLesson` 的"今日"判断

3. **在设置中暴露学习日边界配置**
   - 在 `app_settings` 表中新增 `study_day_boundary_hour` key，默认值 4
   - 允许用户在设置页面调整（3/4/5/自然日）

4. **验证**
   - 模拟时间 03:00，确认返回前一天日期
   - 模拟时间 23:30 开始学习，02:00 结束，确认属于同一天

**涉及文件**：
- `src/main/services/learning-state-manager.ts`（`getStudyDay` 函数）
- `src/main/services/daily-target-pool-manager.ts`（使用 `getStudyDay`）
- `src/main/services/summary-module.ts`（使用 `getStudyDay`）
- `src/main/services/vocabulary-theme-lesson.ts`（使用 `getStudyDay`）
- `src/renderer/src/pages/SettingsPage.tsx`（边界配置 UI）

---

### 第 9 项：消息分页加载

**目标**：聊天页面默认只加载最近消息，历史消息按需分页加载，避免长期使用后渲染卡顿。设计文档要求：默认加载 50-100 条，长会话使用虚拟列表，永不渲染超过 200 条。

**前置条件**：`ChatRepository.getMessages()` 已存在。

**步骤**：

1. **后端分页查询**
   - 修改 `ChatRepository.getMessages(sessionId, options)`
   - 新增参数：`{ limit: number, offset: number, before?: number }`
   - `before` 用于游标分页

2. **前端 MessageList 分页逻辑**
   - 初始加载时只获取最近 50 条消息
   - 当用户滚动到顶部时，加载更多历史消息
   - 使用"加载更多"按钮或自动加载
   - 保持滚动位置不跳动

3. **长 Markdown 回复折叠**
   - 超过一定长度的 AI 回复，默认折叠，点击展开

4. **验证**
   - 在一个有 200 条消息的会话中测试
   - 确认初始只加载 50 条
   - 滚动到顶部确认加载更多
   - 确认性能无卡顿

**涉及文件**：
- `src/main/repositories/chat.repository.ts`（分页查询）
- `src/preload/index.ts`（分页 IPC）
- `src/renderer/src/components/MessageList.tsx`（滚动加载、折叠）
- `src/renderer/src/pages/ChatPage.tsx`（初始化逻辑）

---

### 第 10 项：Prompt 版本管理

**目标**：每次修改 prompt 时记录版本，便于追踪效果变化、回退失败版本。

**前置条件**：`prompt_versions` 表已存在（Migration 1），`PromptBuilder` 已存在。

**步骤**：

1. **创建 PromptVersionManager 服务**
   - 文件：`src/main/services/prompt-version-manager.ts`
   - 方法：`createVersion`、`getActiveVersion`、`setActiveVersion`、`getVersionHistory`

2. **在 PromptBuilder 中集成版本管理**
   - 从 `prompt_versions` 表读取当前激活的 prompt 版本
   - 不再使用硬编码字符串

3. **初始化默认 prompt 版本**
   - 应用首次启动时，将当前硬编码的 prompt 写入 `prompt_versions` 表
   - 标记为 `is_active = 1`

4. **在 AI 日志中关联 prompt 版本**
   - 在 `ai_request_logs` 中记录使用的 prompt 版本 ID

5. **验证**
   - 确认首次启动后 `prompt_versions` 表有默认记录
   - 修改一个 prompt 并创建新版本
   - 确认 AI 回复使用新版本的 prompt

**涉及文件**：
- `src/main/services/prompt-version-manager.ts`（新建）
- `src/main/services/prompt-builder.ts`（读取版本）
- `src/main/services/ai-logger.ts`（记录版本 ID）
- `src/main/db/database.ts`（初始化默认版本）

---

## Week 5-8：用户体验与产品完善

### 第 11 项：输出质量检查（Output Lint）

**目标**：AI 生成回复后做轻量检查，防止客服式回复、过度鼓励、连续反问等低质量问题。

**步骤**：

1. **创建 OutputLinter 服务**
   - 检查维度：客服式开场、过度鼓励、连续反问、未回答用户问题
   - `lint(reply: string, context: LintContext): LintResult`
   - 对于可修复的问题（如客服式开场），直接删除

2. **在 AIOrchestrator 中集成**
   - AI 回复后，先经过 OutputLinter 检查
   - 如果不通过，用 cleanedReply 替换原始回复

**涉及文件**：
- `src/main/services/output-linter.ts`（新建）
- `src/main/services/ai-orchestrator.ts`（集成 lint）

---

### 第 12 项：测试集评估

**目标**：准备固定测试样例，每次修改 prompt/模型后可以批量验证回复质量。

**步骤**：

1. **创建测试集文件**：`src/main/testing/test-cases.json`，10-20 个测试用例
2. **创建测试运行器**：`src/main/testing/test-runner.ts`
3. **在设置页面添加"运行测试"按钮**

**涉及文件**：
- `src/main/testing/test-cases.json`（新建）
- `src/main/testing/test-runner.ts`（新建）
- `src/renderer/src/pages/SettingsPage.tsx`（测试按钮）

---

### 第 13 项：导出完整数据包

**目标**：支持导出完整数据包（数据库 + 设置 + 文件），用于换电脑或重装。

**步骤**：

1. **在 BackupService 中新增 `exportFullPackage` 方法**
   - 复制 SQLite 数据库文件、用户设置、导入的文件
   - 打包为 zip 文件

2. **前端添加导出按钮**（在设置页面）

**涉及文件**：
- `src/main/services/backup-service.ts`（`exportFullPackage` 方法）
- `src/renderer/src/pages/SettingsPage.tsx`（导出按钮）

---

### 第 14 项：PDF/DOCX 解析

**目标**：支持 PDF 和 DOCX 文件的内容提取和解析。

**步骤**：

1. **添加依赖**：`npm install pdf-parse mammoth`
2. **在 FileIngestionEngine 中添加 PDF/DOCX 解析**
3. **更新前端文件选择器**，允许选择 PDF/DOCX

**涉及文件**：
- `src/main/services/file-ingestion-engine.ts`（PDF/DOCX 解析）
- `package.json`（添加依赖）
- `src/renderer/src/components/MessageInput.tsx`（文件类型）

---

### 第 15 项：数据库恢复入口

**目标**：支持从备份恢复数据库，完成备份恢复闭环。

**步骤**：

1. **在 BackupService 中新增 `restoreBackup` 方法**
   - 校验备份文件完整性
   - 自动备份当前数据库（作为恢复前快照）
   - 停止后台任务、关闭数据库连接、替换文件、重新打开、运行 migration

2. **前端添加恢复入口**
   - 在设置页面的备份列表中，每个备份项添加"恢复"按钮
   - 点击后弹出确认对话框

**涉及文件**：
- `src/main/services/backup-service.ts`（`restoreBackup` 方法）
- `src/renderer/src/pages/SettingsPage.tsx`（恢复按钮和确认对话框）

---

## 实施顺序总结

```
Day 1-3（最小可用体验）
  ├── 1. 文件导入自动入库流水线 ← 没有词汇库，一切不可用
  └── 2. Job Queue Handler 注册 ← 后台任务基础设施

Week 1-2（核心学习闭环）
  ├── 3. 每日总结自动生成触发
  ├── 4. 每周复盘自动生成触发
  ├── 5. AI 失败重试机制
  ├── 6. Context Budget Manager
  └── 7. FSRS 复习算法

Week 3-4（系统可靠性）
  ├── 8. 跨午夜学习日边界（4am）
  ├── 9. 消息分页加载
  └── 10. Prompt 版本管理

Week 5-8（用户体验与产品完善）
  ├── 11. 输出质量检查
  ├── 12. 测试集评估
  ├── 13. 导出完整数据包
  ├── 14. PDF/DOCX 解析
  └── 15. 数据库恢复入口
```

---

## 前端待完成工作清单

以下基于设计文档（source-full-design.md）与当前前端代码的逐项对比。当前前端有 11 个源文件、4 个组件、3 个页面，与设计目标差距显著。

### 一、布局架构（当前最大差距）

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| 三栏布局 | 左侧历史会话栏 + 中间对话区 + 右侧可收起仪表盘 | 三 Tab 切换（对话/仪表盘/设置），同一时间只能看一个 | P0 |
| 右侧可收起仪表盘 | 默认收起，展开显示学习时间、状态、快捷操作 | 独立 Tab 页面，无法与对话同时显示 | P1 |
| 左侧历史会话栏 | 轻量图标栏或会话列表，可浏览/切换历史会话 | 完全缺失，无会话切换功能 | P1 |
| 设置改为弹窗 | 设置以 Modal 弹窗覆盖当前页面，不离开对话 | 独立 Tab 页面，离开对话才能设置 | P2 |

**实施建议**：这是最大的结构性改动，建议在 Week 1-2 完成。改完后所有后续 UI 工作都基于新布局。

---

### 二、对话页面（核心体验）

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| 消息分页/虚拟列表 | 默认加载 50-100 条，滚动加载更多，永不渲染超 200 条 | 一次性加载 100 条，无分页，无虚拟列表 | P1 |
| 流式 AI 回复 | 逐 token 显示，打字机效果 | 等待完整响应后一次性显示，中间只显示"正在输入"动画 | P1 |
| AI 重试按钮 | AI 失败时保留用户消息，显示重试入口 | 只有错误横幅和关闭按钮，无重试 | P1 |
| 文件附件随消息发送 | 文件作为消息附件，可加文字说明一起发送 | 点"+"立即触发文件选择并独立导入，与消息分离 | P1 |
| 长 Markdown 折叠 | 超长 AI 回复默认折叠，点击展开 | 全部展开，无折叠 | P2 |
| 发送中打断 | AI 回复中用户可发送新消息，中断当前回复 | 无此逻辑，发送按钮在 loading 时禁用 | P2 |
| 学习时间实时显示 | 当前会话计时器、今日累计时间 | 完全缺失 | P2 |

---

### 三、Slash 命令系统

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| 独立 SlashCommandMenu 组件 | 独立组件，可扩展，可能有图标/分类 | 内嵌在 MessageInput 中，硬编码 8 个命令 | P2 |
| 完整命令列表 | /背单词, /复习, /长难句, /语法纠错, /自由聊天, /今日计划, /无限学习, /总结, /设置语言, /错词 | 只有前 8 个，缺少 /设置语言 和 /错词 | P2 |
| /settings 命令 | 可通过 /settings 打开设置 | 缺失 | P3 |

---

### 四、仪表盘

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| 学习时间统计 | 本次学习时间（实时）、今日、本周、累计 | 完全缺失 | P1 |
| 极简设计 | 只显示时间和轻量状态，不显示复杂统计 | 显示了词汇统计、token 用量、系统健康等大量信息 | P2 |
| 周复盘摘要 | 显示最近一次周复盘的关键指标 | 有列表但格式简单，无 WeeklyReviewView 组件 | P2 |
| 词汇进度卡片 | 各状态词汇数量、今日新学/复习数 | 有基础词汇统计，缺今日新学/复习数 | P2 |

---

### 五、词汇教学显示

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| 5 种教学形式标签 | 故事/讨论/知识分享/考研小短文/易混词对比，显示当前形式 | 完全缺失 | P2 |
| 词汇详情卡片 | 音标、词性、中英文释义、AI 讲解、例句、搭配、同义词/反义词、记忆技巧 | IPC API 已定义但 UI 完全未调用 | P2 |
| 主题课流程展示 | AI 告知主题和词数 → 语境引出 → 解释 → 练习 → 小测 | 无专门展示，全靠对话文本 | P3 |

---

### 六、确认与安全

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| 破坏性操作确认弹窗 | delete/overwrite/bulk_update/clear/reset 等操作需二次确认 | 备份删除无确认直接执行；聊天中有 confirmation-bar 但仅限 AI 检测的操作 | P1 |
| 通用确认对话框组件 | 可复用的 ConfirmDialog 组件 | 缺失，各处各自处理 | P1 |

---

### 七、会话管理

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| 会话列表 | 左侧栏显示历史会话，可切换 | IPC API（getSessions/createSession）已定义但 UI 未调用 | P1 |
| 会话类型标识 | free_chat/word_learning/word_review/long_sentence/grammar_correction/mixed/infinite_learning | 数据库有 session_type 字段但 UI 未显示 | P2 |
| 会话标题 | AI 自动生成会话标题 | 数据库有 title 字段但 UI 未显示 | P2 |

---

### 八、休息提醒

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| 60-90 分钟休息提醒 | AI 在对话中轻量询问是否继续，不强制打断 | 完全缺失 | P3 |
| 表现下降提醒 | 连续答错/回复变短时，AI 建议先总结 | 完全缺失 | P3 |

---

### 九、周复盘视图

| 项目 | 设计要求 | 当前状态 | 优先级 |
|------|---------|---------|--------|
| WeeklyReviewView 组件 | 独立组件，展示词汇进展、语法改善、长难句能力变化、薄弱点趋势、下周建议 | 只在 DashboardPage 中以简单列表展示 | P2 |
| 周复盘触发入口 | 仪表盘按钮或 /周复盘 命令 | 缺失 | P3 |

---

### 十、缺失的组件清单（设计文档明确要求但不存在）

| 组件名 | 用途 | 优先级 | 组件来源 |
|--------|------|--------|----------|
| `SlashCommandMenu` | 独立的斜杠命令菜单组件 | P2 | 自己写 |
| `MinimalDashboard` / `DashboardPanel` | 右侧可收起仪表盘 | P1 | 自己写 |
| `SettingsModal` | 设置弹窗（替代 SettingsPage） | P2 | untitledui `modal` |
| `WeeklyReviewView` | 周复盘详情视图 | P2 | 自己写 |
| `ConfirmDialog` | 通用破坏性操作确认弹窗 | P1 | untitledui `modal` |
| `SessionSidebar` / `HistorySidebar` | 左侧历史会话栏 | P1 | untitledui `sidebar-navigation-base` |
| `LearningTimer` | 学习时间实时计时器 | P2 | 自己写 |
| `VocabDetailCard` | 词汇详情卡片（音标、释义、例句等） | P2 | 自己写 |
| `TeachingFormatBadge` | 当前教学形式标签 | P3 | 自己写 |

---

### 前端工作优先级排序

**P0（阻塞核心体验，Week 1 必须完成）**：
1. 三栏布局改造（左会话栏 + 中对话 + 右仪表盘）
2. 会话列表与切换功能 ← `untitledui add sidebar-navigation-base --yes`
3. 破坏性操作确认弹窗组件 ← `untitledui add modal --yes`

**P1（核心体验，Week 1-2 完成）**：
4. 消息分页加载 / 滚动加载更多 ← 自己写
5. 流式 AI 回复（打字机效果）← 自己写
6. AI 重试按钮 ← 自己写
7. 文件附件随消息发送（改造 "+" 按钮行为）← 自己写
8. 学习时间实时显示 ← 自己写
9. 右侧可收起仪表盘（极简版）← 自己写

**P2（体验增强，Week 3-4 完成）**：
10. 设置改为 Modal 弹窗 ← `untitledui add modal --yes`（复用确认弹窗组件）
11. SlashCommandMenu 独立组件 + 完整命令列表 ← 自己写
12. 词汇详情卡片 ← 自己写
13. 教学形式标签显示 ← 自己写
14. WeeklyReviewView 组件 ← 自己写
15. 仪表盘增强（今日新学/复习数、周复盘摘要）← 自己写
16. 长 Markdown 折叠 ← 自己写
17. 会话类型标识和标题显示 ← 自己写

**P3（锦上添花，Week 5+ 完成）**：
18. 发送中打断 ← 自己写
19. 休息提醒显示 ← 自己写
20. /settings 命令 ← 自己写
21. 周复盘触发入口 ← 自己写
