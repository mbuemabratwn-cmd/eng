# Architecture Reference

> Source: `ai_english_learning_app_design_doc_fixed(1).md`  
> Generated: 2026-05-21

This document defines the architecture strategy for implementation.

Codex must treat this as the architecture reference, but it should implement features in the order defined by `PHASES.md`.

Key architecture constraints:

- React renderer is UI-only.
- Electron main process owns local capabilities.
- SQLite is the source of truth.
- Repositories are the only SQL-writing layer.
- AI can suggest state updates, but domain engines must validate them.
- User messages must be saved before AI calls.
- Long-running work must go through the job queue.
- The app is designed for 18 months of near-daily use.

---

## 16. 架构策略审查结论

本章开始进入开发架构设计阶段。

前面的产品设计已经基本确定：

```text
本地自用
考研英语 AI 陪练
PC 端常驻软件
自然语言对话为主入口
AI 主导学习流程
每日目标池 + learning block
每日词汇主题课
词汇状态长期记录
长难句训练
语法纠错
ai_memory_summary 长期记忆摘要
Electron + React + SQLite + AI API
```

因此，后续开发设计的目标不是继续堆功能，而是把这个产品做成一个：

```text
本地优先
长期运行稳定
学习事件可追踪
AI 调度可控
数据库是事实来源
前端不卡顿
后续可扩展
```

的桌面 AI 学习系统。

---

### 16.1 对当前策略是否有 100% 信心

不能说对最终实现效果有绝对 100% 信心。

原因：

```text
1. AI 模型输出存在不稳定性
2. 文件解析质量会受文件格式影响
3. SQLite 后期性能取决于索引和查询设计
4. Electron 性能取决于前端渲染和进程职责划分
5. Prompt 效果需要测试集验证
6. 学习算法需要真实使用数据不断调整
```

但可以说：

```text
对当前“大架构方向”有事实上的高信心。
```

原因：

```text
1. 当前产品是个人本地自用，不需要复杂云端架构。
2. Electron + React 适合快速构建 ChatGPT 式桌面界面。
3. SQLite 适合长期保存本地词汇、学习事件和对话记录。
4. AI API 适合承担讲解、生成、判断和总结任务。
5. learning_events + ai_memory_summary 可以避免 AI 每次全量读取数据库。
6. Prompt 模块化可以避免系统提示词越来越臃肿。
7. learning block 比传统“课程开始/结束”更符合真实使用方式。
```

因此，当前策略的判断是：

```text
不需要推翻技术路线。
不需要转向云端架构。
不需要第一版上多 Agent。
不需要第一版做复杂统计后台。
应该进入架构落地阶段。
```

---
## 17. 架构设计总目标

本程序最终不应该只是：

```text
一个会聊天的英语学习页面
```

而应该是：

```text
一个本地运行的 AI 英语教师系统
```

它应具备以下能力：

```text
1. 用户可以长期打开 PC 端软件持续学习。
2. AI 能根据历史记录和当前状态安排学习。
3. 每次学习行为都能写入数据库。
4. 词汇、长难句、语法错误、学习时间都有事实记录。
5. AI 每次回复前只读取必要上下文，不全量读库。
6. AI 回复后能产生结构化学习事件，而不是只输出一段自然语言。
7. 软件运行几个月后，数据越来越多但不明显变慢。
8. 前端、数据库、AI 调度、Prompt、文件处理彼此解耦。
9. 出现 API 失败、文件解析失败、AI JSON 失败时不丢用户数据。
10. 后续新增学习模式时，不需要重写整个系统。
```

一句话总结：

```text
数据库负责事实。
程序负责调度。
AI 负责判断与表达。
前端负责交互。
```

---
## 18. 第一版总体架构

第一版采用以下总体架构：

```text
Electron Desktop App
│
├── Renderer Process：React UI
│   ├── ChatPage
│   ├── MessageList
│   ├── MessageInput
│   ├── SlashCommandMenu
│   ├── AttachmentButton
│   ├── MinimalDashboard
│   ├── SettingsModal
│   └── WeeklyReviewView
│
├── Preload / IPC Bridge
│   └── 安全暴露有限 API 给 React
│
└── Main Process / Local Service Layer
    ├── AppController
    ├── AI Orchestrator
    ├── Prompt Builder
    ├── Context Retriever
    ├── Lesson Planner
    ├── Vocabulary Engine
    ├── Review Scheduler
    ├── Sentence Engine
    ├── Grammar Engine
    ├── Memory Engine
    ├── File Ingestion Service
    ├── Learning Block Manager
    ├── Daily Target Pool Manager
    ├── Weekly Review Service
    ├── Job Queue
    ├── Repository Layer
    └── SQLite Database
```

核心原则：

```text
React 不直接访问 SQLite。
React 不直接拼 Prompt。
React 不直接决定词汇状态。
React 不直接处理文件解析。
React 只负责界面展示和用户输入。
```

业务逻辑应放在 Electron main process 或本地 service layer 中。

---
## 19. 分层职责设计

### 19.1 React Renderer 层

React 只负责用户界面。

主要职责：

```text
1. 展示聊天消息
2. 展示 AI 流式回复
3. 接收用户输入
4. 支持文件上传入口
5. 支持 "/" 命令菜单
6. 展示轻量仪表盘
7. 展示本次学习时间和累计学习时间
8. 展示设置弹窗
9. 展示每周复盘
```

React 不负责：

```text
1. 查询 SQLite
2. 决定今日学习计划
3. 决定词汇状态
4. 拼接 AI prompt
5. 解析 AI 返回的学习事件
6. 更新 ai_memory_summary
7. 处理文件入库
```

React 调用能力时，只能通过 IPC 请求 main process。

示例：

```ts
window.appApi.sendMessage(payload)
window.appApi.uploadFile(file)
window.appApi.getCurrentLearningState()
window.appApi.getWeeklyReview()
window.appApi.updateSetting(key, value)
```

---

### 19.2 IPC Bridge 层

IPC 层负责隔离前端和本地能力。

原则：

```text
只暴露有限、明确、安全的 API。
不把 Node.js、fs、数据库连接直接暴露给 React。
```

建议 IPC API：

```text
chat:sendMessage
chat:regenerateMessage
chat:getMessages
chat:getSessionList

learning:getCurrentState
learning:getDailyTargetPool
learning:getActiveBlock
learning:endCurrentBlock
learning:requestSummary

file:upload
file:getFileStatus

settings:get
settings:update

review:getWeeklyReview
```

---

### 19.3 AppController

AppController 是主进程入口协调器。

职责：

```text
1. 接收 IPC 请求
2. 调用对应 service
3. 管理错误返回
4. 保证用户输入先写库再调用 AI
5. 保证长任务进入后台 job queue
```

AppController 不应包含复杂业务逻辑，只做调度。

---

### 19.4 AI Orchestrator

AI Orchestrator 是整个系统的 AI 调度中枢。

它负责决定：

```text
1. 本轮用户输入属于什么 intent
2. 当前处于什么 learning mode
3. 是否需要创建或更新 learning block
4. 是否需要读取每日目标池
5. 是否需要检索词汇、语法、长难句上下文
6. 使用哪个 prompt 模板
7. 调用哪个 AI provider
8. 如何解析 AI 返回结果
9. 哪些事件需要写入数据库
10. 哪些任务应该异步处理
```

AI Orchestrator 不直接写 SQL，而是通过 Repository 层写库。

---

### 19.5 Prompt Builder

Prompt Builder 负责组装 AI 请求。

Prompt 不应写成一个巨大的字符串，而应拆成模块：

```text
global_system_prompt
mode_prompt
student_state
ai_memory_summary
retrieved_context
current_task_context
output_schema
style_examples
```

不同学习模式只替换对应 mode_prompt。

例如：

```text
word_theme_mode_prompt
word_review_mode_prompt
long_sentence_mode_prompt
grammar_correction_mode_prompt
free_chat_mode_prompt
summary_mode_prompt
```

这样后续修改长难句模式时，不会影响词汇主题课。

---

### 19.6 Context Retriever

Context Retriever 负责在 AI 回复前按需读取数据库。

读取顺序：

```text
1. 当前会话最近消息
2. 当前 learning block
3. 今日 daily target pool
4. ai_memory_summary
5. 当前模式相关数据
6. 本轮输入相关词汇 / 长难句 / 语法记录
```

原则：

```text
不全量读取数据库。
不把全部历史聊天塞进 prompt。
长期信息优先读 ai_memory_summary。
原始记录只按需补查。
```

示例：

```text
用户问某个单词
→ 查询 vocabulary_words + user_word_progress + 最近 word_review_events

用户练长难句
→ 查询 long_sentences + long_sentence_analysis + user_sentence_progress

用户自由聊天
→ 查询 grammar_issue_summary + expression memory

用户要求总结
→ 查询 learning_events + learning_blocks + today target pool
```

---

### 19.7 Lesson Planner

Lesson Planner 负责每日目标池。

它不等于传统每日课程，而是生成当天学习方向。

职责：

```text
1. 判断当前学习日
2. 判断是否已有 daily target pool
3. 根据 weak 词、待复习词、长期记忆生成建议
4. 生成今日词汇主题
5. 确定新词数量和重点精学词数量
6. 安排长难句训练目标
7. 根据用户口述调整目标池
```

默认策略：

```text
每日推荐学习时长：60 分钟
每日新词：45-60 个
重点精学词：20-25 个
早期默认重点：词汇 + 长难句
```

Lesson Planner 需要尊重用户输入：

```text
今天只学 20 分钟
今天只复习
今天别学新词
今天只练长难句
今天无限学习
```

---

### 19.8 Daily Target Pool Manager

Daily Target Pool Manager 管理每日目标池的生命周期。

职责：

```text
1. 按学习日边界创建 target pool
2. 记录今日计划内容
3. 记录哪些目标已开始
4. 记录哪些目标已完成
5. 记录未完成内容如何处理
6. 支持用户当天多次回来继续学习
```

学习日边界：

```text
默认凌晨 4 点
```

这用于处理深夜学习：

```text
23:00 到凌晨 2:00 仍算前一天学习延续。
```

---

### 19.9 Learning Block Manager

Learning Block Manager 负责记录一段连续有效学习。

learning block 不是课程，不需要用户点开始/结束。

开始条件：

```text
用户发送有效学习消息
用户回答练习题
用户开始复习
用户请求讲解
用户上传材料并要求处理
```

结束条件：

```text
用户说“停一下”
用户说“今天到这里”
用户说“总结一下”
45 分钟无有效互动
AI 完成阶段总结
```

注意：

```text
learning block 只是记录边界，不打断用户体验。
```

---

### 19.10 Vocabulary Engine

Vocabulary Engine 负责词汇系统。

职责：

```text
1. 选出今日新词
2. 选出重点精学词
3. 选出普通泛熟词
4. 选出待复习词
5. 选出 weak 词
6. 生成词汇主题
7. 安排词汇题型
8. 更新 user_word_progress
9. 写入 word_review_events
10. 判断 recognition / recall / context / usage 表现
```

建议词汇掌握不要只用一个 mastery_score。

第一版可以保留 mastery_score，但内部逐步支持：

```text
recognition_score：看到英文能认出
recall_score：看到中文能想起英文
context_score：在句子里能理解
usage_score：自己能正确使用
```

mastery_score 作为综合分。

---

### 19.11 Review Scheduler

Review Scheduler 负责复习调度。

第一版采用：

```text
FSRS-inspired 简化算法
+ AI 语义弱点判断
```

职责：

```text
1. 根据 next_review_at 选到期词
2. 根据 weak 状态提前复习
3. 根据题型权重调整间隔
4. 根据用户错误类型调整复习方式
5. 根据连续遗忘降低新词量建议
```

复习调度不应完全交给 AI。

正确职责划分：

```text
算法负责时间调度。
AI 负责判断语义弱点。
程序负责最终写入数据库。
```

---

### 19.12 Sentence Engine

Sentence Engine 负责长难句系统。

职责：

```text
1. 选择或生成长难句
2. 优先使用真题或用户材料
3. AI 生成句子必须标记 created_by_ai
4. 保存 long_sentences
5. 保存 long_sentence_analysis
6. 保存 user_sentence_progress
7. 抽取暴露出的语法和词汇弱点
```

长难句来源优先级：

```text
1. 真题句子
2. 用户上传材料
3. 已保存长难句
4. AI 生成补充句子
```

AI 生成内容不能冒充真题。

---

### 19.13 Grammar Engine

Grammar Engine 负责语法错误和表达问题。

职责：

```text
1. 记录 grammar_error_events
2. 更新 grammar_issue_summary
3. 判断错误严重程度
4. 判断是否应该即时纠正
5. 判断是否进入阶段总结
6. 判断是否需要专项训练
```

自由聊天中不应每句都纠错。

默认规则：

```text
严重错误即时纠正。
小错误阶段总结。
重复错误进入 grammar_issue_summary。
```

---

### 19.14 Memory Engine

Memory Engine 负责长期记忆摘要。

职责：

```text
1. 从 learning_events 中提炼长期模式
2. 更新 ai_memory_summary
3. 维护 memory_type
4. 记录 evidence_event_ids
5. 维护 confidence
6. 避免一次错误永久标签化
7. 在用户表现变好时降低 confidence
```

记忆更新不应阻塞当前对话。

建议放入后台任务：

```text
memory:update_after_block
memory:update_daily_summary
memory:update_weekly_review
```

---

### 19.15 File Ingestion Service

File Ingestion Service 负责文件上传和解析。

第一版建议优先支持：

```text
txt
csv
md
```

谨慎支持：

```text
pdf
docx
xlsx
```

原因：

```text
txt / md 解析简单
csv 适合词库导入
pdf / docx / xlsx 解析质量和工程复杂度更高
```

文件处理流程：

```text
1. 用户上传文件
2. 保存 file_records
3. 解析为 text_chunks
4. AI 判断文件用途
5. 如果用户指令明确，直接创建处理任务
6. 如果不明确，简短询问
7. 后台 job 执行入库或抽取
```

不要把整个大文件直接塞进 prompt。

---

### 19.16 Job Queue

Job Queue 负责后台任务。

需要后台执行的任务：

```text
文件解析
词库导入
AI 生成词汇解释
AI 生成长难句解析
每日总结
每周复盘
ai_memory_summary 更新
批量计算复习时间
批量更新掌握分
```

第一版可以用 SQLite 表实现简单任务队列。

任务状态：

```text
pending
running
done
failed
cancelled
```

任务字段：

```text
id
type
payload
status
attempts
error
created_at
updated_at
```

---

### 19.17 Repository Layer

Repository Layer 负责所有数据库访问。

原则：

```text
业务层不直接写 SQL。
所有数据访问通过 repository。
```

建议按领域拆分：

```text
ChatRepository
VocabularyRepository
WordProgressRepository
ReviewEventRepository
SentenceRepository
GrammarRepository
LearningEventRepository
LearningBlockRepository
DailyTargetRepository
MemoryRepository
FileRepository
JobRepository
SettingsRepository
```

这样后续数据库表结构变化时，不需要到处改业务代码。

---
## 20. 核心运行流程

### 20.1 用户发送普通消息流程

```text
1. React 捕获用户输入
2. 通过 IPC 发送给 main process
3. AppController 接收请求
4. ChatRepository 先保存 user message
5. LearningBlockManager 判断是否开启 learning block
6. IntentDetector 判断用户意图
7. ContextRetriever 读取必要上下文
8. PromptBuilder 构造 AI 请求
9. AI Orchestrator 调用 AI API
10. AI 回复流式返回前端
11. ChatRepository 保存 assistant message
12. StructuredOutputParser 解析学习事件和状态更新
13. LearningEventRepository 写入 learning_events
14. 相关 engine 更新词汇 / 语法 / 长难句状态
15. 如有需要，创建 memory update job
```

关键原则：

```text
用户消息必须先写库，再调用 AI。
AI 失败不能导致用户消息丢失。
```

---

### 20.2 每日第一次有效学习流程

```text
1. 用户发送学习相关消息
2. 系统判断当前学习日
3. 查询是否已有 daily target pool
4. 如果没有，则 LessonPlanner 生成目标池
5. 读取待复习词、weak 词、ai_memory_summary
6. 生成今日词汇主题和长难句建议
7. 保存 daily_target_pool
8. AI 用自然语言告诉用户今日建议
```

注意：

```text
不是打开 App 就强行生成计划。
而是第一次有效学习行为触发。
```

---

### 20.3 每日词汇主题课流程

```text
1. LessonPlanner 请求 VocabularyEngine 选词
2. VocabularyEngine 选出 45-60 个新词
3. 选出 20-25 个重点精学词
4. 结合 weak 词和到期词生成主题
5. PromptBuilder 构造词汇主题课 prompt
6. AI 生成故事 / 讨论 / 短文 / 易混词对比
7. 用户互动回答
8. 系统记录 word_review_events
9. VocabularyEngine 更新 user_word_progress
10. 不稳的词进入后续复习
```

---

### 20.4 长难句训练流程

```text
1. SentenceEngine 根据今日目标和用户弱点选句
2. 优先从真题 / 用户材料 / 已保存句子中选
3. 不够时 AI 生成补充句子
4. AI 引导用户猜大意或找主干
5. 用户回答
6. AI 判断理解情况
7. 保存 user_sentence_progress
8. 抽取 grammar_weaknesses 和 vocabulary_weaknesses
9. 写入 learning_events
10. 必要时更新 grammar_issue_summary 或 word_progress
```

---

### 20.5 总结流程

触发方式：

```text
用户说“总结一下”
用户说“今天到这里”
learning block 自动结束
学习日结束
每周复盘
```

流程：

```text
1. 查询当前 learning block
2. 查询相关 learning_events
3. 查询词汇、语法、长难句表现
4. AI 生成轻量总结
5. 保存 block summary 或 daily summary
6. 创建 memory update job
7. 必要时更新 ai_memory_summary
```

---
## 21. AI 输出结构设计

AI 不应只返回自然语言。

建议 AI 返回结构化结果：

```json
{
  "reply": "展示给用户看的回复",
  "detected_intent": "word_theme_learning",
  "current_mode": "guide",
  "next_best_action": "ask_word_guess",
  "learning_events": [
    {
      "event_type": "word_reviewed",
      "target_type": "word",
      "target_id": 123,
      "result": "partially_correct",
      "score": 0.6,
      "metadata": {
        "question_type": "context_guess",
        "weakness": "confused_with_similar_word"
      }
    }
  ],
  "word_updates": [
    {
      "word_id": 123,
      "suggested_status": "weak",
      "reason": "用户在语境中混淆 adapt/adopt"
    }
  ],
  "grammar_updates": [],
  "memory_update_candidates": [],
  "should_end_block": false
}
```

前端只展示：

```text
reply
```

程序处理其他字段。

注意：

```text
AI 只给建议。
程序负责验证和写库。
```

---
## 22. 关键架构原则

### 22.1 数据库是事实来源

不能把 AI 回复当成事实来源。

正确关系：

```text
SQLite = 事实来源
AI = 判断和生成工具
程序 = 调度和验证者
```

例如：

```text
AI 可以建议把某个词标记为 weak。
但是否写入 weak，由 VocabularyEngine 根据规则判断。
```

---

### 22.2 原始事件和当前状态分离

每次学习行为都要保存原始事件。

例如：

```text
word_review_events 保存每次练词。
user_word_progress 保存当前状态。
```

不要只更新当前状态。

否则后期无法解释：

```text
这个词为什么变 weak？
这个语法点为什么进入长期记忆？
AI 为什么今天安排这个主题？
```

---

### 22.3 当前上下文和长期记忆分离

AI 每次回复前不应读取全部历史。

正确结构：

```text
最近消息：解决当前语境
daily target pool：解决今天学什么
learning block：解决当前学习段
ai_memory_summary：解决长期画像
retrieved_context：解决本轮相关材料
```

---

### 22.4 同步交互和后台任务分离

用户发送消息后的主路径要尽量短。

同步路径：

```text
保存消息
读取必要上下文
调用 AI
流式回复
保存结果
```

后台路径：

```text
文件解析
批量入库
记忆更新
每周复盘
复杂总结
批量生成 AI 解释
```

---

### 22.5 任何 AI 输出都要可降级

AI 可能出现：

```text
JSON 格式错误
字段缺失
学习事件解析失败
返回内容过长
没有按 prompt 执行
```

必须有 fallback：

```text
1. reply 正常展示
2. 结构化部分解析失败时不写状态更新
3. 记录 ai_output_parse_failed 事件
4. 必要时后台重试解析
```

用户不能因为结构化解析失败而看不到回复。

---
## 23. 第一轮漏洞审查

### 漏洞 1：把产品做成传统课程系统

风险：

```text
如果架构围绕“开始课程 / 结束课程”设计，会和用户真实使用方式冲突。
```

修复：

```text
采用 daily target pool + learning block。
学习块只是记录边界，不是课程边界。
```

结论：

```text
已修复。
```

---

### 漏洞 2：React 直接承担业务逻辑

风险：

```text
React 组件里直接查库、拼 prompt、判断词汇状态，会导致后期不可维护。
```

修复：

```text
React 只负责 UI。
所有业务逻辑放入 main process / service layer。
通过 IPC 调用。
```

结论：

```text
已修复。
```

---

### 漏洞 3：AI 直接修改数据库

风险：

```text
AI 可能误判、幻觉、输出不稳定。
如果直接让 AI 决定状态，会污染学习记录。
```

修复：

```text
AI 只输出建议。
程序通过 Engine + Repository 验证后写库。
所有状态变化必须有 learning_events 支撑。
```

结论：

```text
已修复。
```

---

### 漏洞 4：每轮回复读取过多数据

风险：

```text
学习时间越长，数据库越大。
如果每次全量读取，会越来越慢，prompt 也会越来越长。
```

修复：

```text
ContextRetriever 按需读取。
长期信息读 ai_memory_summary。
原始记录只按当前词、句子、语法点补查。
```

结论：

```text
已修复。
```

---

### 漏洞 5：learning block 和 chat_session 混淆

风险：

```text
chat_session 是对话容器。
learning block 是学习行为时间段。
二者如果混在一起，会导致时间统计和总结混乱。
```

修复：

```text
保留 chat_sessions / chat_messages。
新增或强化 learning_blocks。
learning_events 可关联 session_id 和 block_id。
```

结论：

```text
需要在数据库 schema 阶段落地 block_id。
```

---

### 漏洞 6：文件上传过早做太重

风险：

```text
PDF / docx / xlsx 解析复杂，容易拖慢第一版。
```

修复：

```text
第一版优先 txt / csv / md。
pdf / docx / xlsx 留接口，第二阶段增强。
文件解析进入 job queue，不阻塞对话。
```

结论：

```text
已修复。
```

---

### 漏洞 7：Prompt 越写越长

风险：

```text
所有规则塞进 system prompt，会难维护、互相冲突、成本高。
```

修复：

```text
Prompt Builder 模块化：
global_system_prompt
mode_prompt
student_state
ai_memory_summary
retrieved_context
output_schema
style_examples
```

结论：

```text
已修复。
```

---

### 漏洞 8：词汇掌握只用 mastery_score

风险：

```text
一个总分无法区分会认、会想起、能在语境理解、能主动使用。
```

修复：

```text
保留 mastery_score。
逐步增加 recognition_score、recall_score、context_score、usage_score。
第一版可先在 metadata 中记录，后续升级为正式字段。
```

结论：

```text
已修复。
```

---

### 漏洞 9：旧版数据库设计和新版数据库设计并存

风险：

```text
文档中第 5 章是早期数据库初稿，第 11 章是更真实的 SQLite 初稿。
如果开发时两套都参考，会混乱。
```

修复：

```text
以第 11 章为数据库设计基准。
第 5 章只保留为早期需求参考。
后续 schema 设计基于第 11 章继续演化。
```

结论：

```text
已修复。
```

---

### 漏洞 10：课前检查和常驻软件冲突

风险：

```text
如果按“打开软件”触发课前检查，常驻 PC 端场景下不准确。
```

修复：

```text
改为当天第一次有效学习行为触发。
不是打开 App 触发。
```

结论：

```text
已修复。
```

---

### 漏洞 11：AI 结构化输出失败

风险：

```text
AI 回复能看，但 JSON 解析失败，导致学习事件无法写库。
```

修复：

```text
reply 和 structured payload 分离。
structured payload 失败时，先展示 reply。
记录 parse_failed event。
必要时后台重试提取结构化事件。
```

结论：

```text
已修复。
```

---

### 漏洞 12：长期记忆变成贴标签

风险：

```text
AI 可能因为一次错误就长期认定用户某方面很差。
```

修复：

```text
memory 必须带 evidence、confidence、last_seen、status。
一次错误只进 recent_issue。
多次出现才进 stable_patterns。
表现改善后降低 confidence。
```

结论：

```text
已修复。
```

---

### 漏洞 13：长期运行后前端聊天页面变慢

风险：

```text
几个月聊天记录很多，如果一次性渲染全部消息，会卡顿。
```

修复：

```text
消息分页加载。
当前会话只渲染最近窗口。
历史消息使用虚拟列表。
Prompt 不依赖完整聊天历史，而依赖 summary。
```

结论：

```text
已修复。
```

---

### 漏洞 14：没有统一错误恢复机制

风险：

```text
API 失败、网络失败、软件崩溃、文件解析失败时可能丢数据。
```

修复：

```text
用户消息先写库。
AI 请求失败不删除用户消息。
后台任务可重试。
数据库写入用 transaction。
关键事件写 learning_events。
```

结论：

```text
已修复。
```

---
## 24. 修复后的架构信心判断

经过上述漏洞修复后，当前架构策略没有明显结构性阻塞问题。

但仍不能说：

```text
最终效果 100% 保证成功。
```

更准确的判断是：

```text
在当前产品目标、技术路线和第一版范围下，
这套大架构已经达到可以进入详细设计的成熟度。
```

接下来应该继续推进：

```text
1. 模块目录结构
2. SQLite 可执行 schema
3. Repository 接口
4. AI Orchestrator 详细流程
5. Prompt 模板
6. structured output schema
7. IPC API 设计
8. 前端页面组件结构
9. MVP 开发任务拆分
```

---
## 25. 长期使用压力模型

本项目不是短期 Demo，而是预计会在考研前持续使用一年半左右。

因此，架构设计不能只考虑第一版能否跑通，还需要考虑：

```text
用户几乎每天使用
PC 端软件可能长期打开
学习数据持续增长
聊天记录持续增长
词汇复习事件持续增长
AI 长期记忆持续更新
数据库需要长期可靠保存
软件升级不能破坏旧数据
```

按一年半使用估算，系统可能产生的数据规模：

```text
词汇基础表：5,000 - 30,000 条
word_review_events：100,000 - 500,000 条
learning_events：100,000 - 500,000 条
chat_messages：30,000 - 100,000 条
long_sentences：1,000 - 10,000 条
grammar_error_events：几千到几万条
weekly_reviews：70 - 90 条
```

这些规模对 SQLite 来说可以承受，但前提是：

```text
必须有索引
必须分页加载
必须有摘要压缩
必须避免全表扫描
必须避免每轮都读大量历史
必须有备份和恢复机制
```

长期使用下，真正的风险不是 SQLite 不够用，而是：

```text
查询设计不当
前端一次性渲染太多
AI 上下文越塞越长
复习任务越积越多
没有备份恢复
没有迁移系统
没有日志排查问题
```

---
## 26. 长期耐久性架构

在原有架构基础上，需要新增一层长期耐久性模块。

新增模块：

```text
BackupService
MigrationManager
DatabaseHealthService
ContextBudgetManager
PromptVersionManager
AIRequestLogger
ReviewLoadManager
ArchiveAndCompactionService
```

这些模块不一定直接展示给用户，但会决定软件能否稳定用一年半。

完整架构应调整为：

```text
Electron Desktop App
│
├── Renderer Process：React UI
│
├── Preload / IPC Bridge
│
└── Main Process / Local Service Layer
    ├── AppController
    ├── AI Orchestrator
    ├── Prompt Builder
    ├── Context Retriever
    ├── Context Budget Manager
    ├── Lesson Planner
    ├── Daily Target Pool Manager
    ├── Learning Block Manager
    ├── Vocabulary Engine
    ├── Review Scheduler
    ├── Review Load Manager
    ├── Sentence Engine
    ├── Grammar Engine
    ├── Memory Engine
    ├── File Ingestion Service
    ├── Job Queue
    ├── Backup Service
    ├── Migration Manager
    ├── Database Health Service
    ├── Prompt Version Manager
    ├── AI Request Logger
    ├── Archive And Compaction Service
    ├── Repository Layer
    └── SQLite Database
```

核心目标：

```text
短期能跑
长期不慢
数据不乱
崩溃不丢
升级可迁移
AI 出错可恢复
复习压力可控制
```

---
## 27. 性能预算与验收标准

第一版需要明确性能目标，避免后期无边界膨胀。

### 27.1 启动性能

目标：

```text
冷启动：3-8 秒内可接受
热启动：3 秒左右
启动时不做大量 AI 请求
启动时不全量扫描数据库
启动时不自动生成复杂周报或大总结
```

启动时只做必要检查：

```text
加载应用设置
打开数据库
检查 migration
恢复未完成后台任务
读取最近会话摘要
读取当前学习日状态
```

不应在启动时做：

```text
全量词汇统计
全量学习事件扫描
自动分析所有历史
自动重新计算所有复习计划
```

---

### 27.2 聊天体验性能

目标：

```text
用户消息发送后立即显示
AI 回复必须支持流式输出
普通本地状态读取 < 200ms
普通数据库查询 < 100ms
后台任务不能卡住输入框
文件解析不能阻塞聊天
```

用户发送消息时，主路径应尽量短：

```text
保存用户消息
读取必要上下文
构造 prompt
调用 AI
流式展示回复
保存 assistant message
解析结构化结果
写入学习事件
```

复杂任务放到后台：

```text
文件解析
批量入库
AI 生成词汇扩展解释
长难句批量分析
每日总结
每周复盘
记忆摘要更新
```

---

### 27.3 数据库规模目标

第一版至少应能稳定支持：

```text
词汇：30,000 条
chat_messages：100,000 条
learning_events：500,000 条
word_review_events：500,000 条
long_sentences：10,000 条
使用时间：18 个月以上
```

这要求：

```text
关键字段必须建索引
常用列表必须分页
统计数据尽量增量计算
长期总结依赖 summary，不依赖全量原始记录
```

---

### 27.4 前端渲染目标

聊天页面不允许一次性渲染全部历史消息。

规则：

```text
默认只加载最近 50-100 条消息
历史消息分页加载
长会话使用虚拟列表
不一次渲染超过 200 条消息
长 Markdown 回复可以折叠或懒渲染
旧学习块通过摘要进入上下文
```

否则几个月后，聊天页面会明显卡顿。

---

### 27.5 AI 调用性能目标

AI 调用应受上下文预算控制。

规则：

```text
不把完整聊天历史传给 AI
不把完整学习事件传给 AI
不把完整文件内容传给 AI
不把所有词汇状态传给 AI
不把所有 grammar_error_events 传给 AI
```

AI 每轮只应收到：

```text
最近必要消息
当前 learning block 状态
今日目标池
相关 ai_memory_summary
本轮相关词汇 / 句子 / 语法记录
必要的 retrieved_context
```

---
## 28. Context Budget Manager

Context Budget Manager 负责控制每轮 AI 请求的上下文长度。

它的目标是：

```text
让 AI 够用
但不让 prompt 无限膨胀
```

默认上下文组成：

```text
1. global_system_prompt
2. mode_prompt
3. student_state
4. ai_memory_summary
5. current_daily_target_pool
6. active_learning_block_summary
7. 最近消息
8. retrieved_context
9. output_schema
```

### 28.1 上下文预算规则

建议第一版规则：

```text
最近消息：最多 10-20 条
ai_memory_summary：每类最多 1-3 条
word_review_events：当前词最近 5-20 条
grammar_issue_summary：只传活跃问题
long_sentence_progress：只传当前相关句子或最近少量记录
文件内容：必须 chunk，不直接整篇传
```

如果上下文超出预算，按优先级裁剪：

```text
1. 保留当前用户输入
2. 保留当前学习模式
3. 保留当前任务相关数据
4. 保留最相关 ai_memory_summary
5. 裁剪较旧消息
6. 裁剪低置信度记忆
7. 裁剪无关 retrieved_context
```

---

### 28.2 上下文摘要策略

旧聊天和旧学习块不应长期以原文形式进入 prompt。

应使用摘要：

```text
chat_session.summary
learning_block.summary
daily_summary
weekly_review
ai_memory_summary
```

原则：

```text
当前对话靠最近消息
长期连续性靠摘要
事实追溯靠数据库
```

---
## 29. 数据库索引策略

长期使用下，索引是性能底线。

### 29.1 learning_events 索引

`learning_events` 会成为统一学习时间线，因此必须索引。

建议索引：

```sql
CREATE INDEX idx_learning_events_created_at
ON learning_events(created_at);

CREATE INDEX idx_learning_events_event_type_created_at
ON learning_events(event_type, created_at);

CREATE INDEX idx_learning_events_target
ON learning_events(target_type, target_id);

CREATE INDEX idx_learning_events_session_id
ON learning_events(session_id);

CREATE INDEX idx_learning_events_block_id
ON learning_events(block_id);

CREATE INDEX idx_learning_events_study_day
ON learning_events(study_day);
```

说明：

```text
created_at：用于时间线和总结
event_type：用于筛选事件类型
target_type + target_id：用于追踪某个词或句子
session_id：用于会话内复盘
block_id：用于学习块总结
study_day：用于每日总结和周复盘
```

---

### 29.2 word_review_events 索引

`word_review_events` 可能是增长最快的表。

建议索引：

```sql
CREATE INDEX idx_word_review_events_word_id_created_at
ON word_review_events(word_id, created_at);

CREATE INDEX idx_word_review_events_session_id
ON word_review_events(session_id);

CREATE INDEX idx_word_review_events_block_id
ON word_review_events(block_id);

CREATE INDEX idx_word_review_events_question_type
ON word_review_events(question_type);

CREATE INDEX idx_word_review_events_created_at
ON word_review_events(created_at);

CREATE INDEX idx_word_review_events_is_correct
ON word_review_events(is_correct);
```

常用查询：

```text
某个词最近 N 次记录
今天练过哪些词
本周 weak 词表现
某种题型错误率
```

禁止设计成：

```text
每次查询某个词的全部历史记录
每次复盘都全表扫描
```

---

### 29.3 user_word_progress 索引

建议索引：

```sql
CREATE INDEX idx_user_word_progress_status
ON user_word_progress(status);

CREATE INDEX idx_user_word_progress_next_review_at
ON user_word_progress(next_review_at);

CREATE INDEX idx_user_word_progress_mastery_score
ON user_word_progress(mastery_score);

CREATE INDEX idx_user_word_progress_updated_at
ON user_word_progress(updated_at);
```

常用查询：

```text
到期复习词
weak 词
低掌握分词
最近更新词
```

---

### 29.4 chat_messages 索引

建议索引：

```sql
CREATE INDEX idx_chat_messages_session_created
ON chat_messages(session_id, created_at);

CREATE INDEX idx_chat_messages_created_at
ON chat_messages(created_at);
```

规则：

```text
聊天消息必须分页加载。
不允许一次性加载全部消息。
```

---

### 29.5 grammar 和 long_sentence 索引

建议索引：

```sql
CREATE INDEX idx_grammar_error_events_issue_type_created
ON grammar_error_events(issue_type, created_at);

CREATE INDEX idx_grammar_issue_summary_status
ON grammar_issue_summary(status);

CREATE INDEX idx_long_sentences_source_type
ON long_sentences(source_type);

CREATE INDEX idx_long_sentences_difficulty
ON long_sentences(difficulty_level);

CREATE INDEX idx_user_sentence_progress_sentence_id
ON user_sentence_progress(sentence_id);

CREATE INDEX idx_user_sentence_progress_practiced_at
ON user_sentence_progress(practiced_at);
```

---
## 30. 数据备份与恢复

备份恢复是长期自用软件的 P0 功能。

如果用户使用一年半，最不能接受的是：

```text
电脑损坏
数据库损坏
误删数据
软件升级破坏旧数据
换电脑时无法迁移
```

因此，第一版需要支持 BackupService。

---

### 30.1 自动备份策略

建议默认：

```text
每日自动备份一次 SQLite 数据库
保留最近 7 天每日备份
每周保留 1 份周备份
每月保留 1 份月备份
```

备份内容：

```text
SQLite 数据库文件
用户设置
prompt 版本记录
导入文件元数据
必要的本地资源索引
```

备份文件格式：

```text
backup_YYYY-MM-DD_HH-mm.zip
```

备份目录：

```text
默认放在应用数据目录
允许用户在设置中修改 backup path
```

---

### 30.2 手动备份

设置里需要提供：

```text
立即备份
打开备份目录
导出完整数据包
```

导出完整数据包可以用于：

```text
换电脑
重装系统
手动存档
```

---

### 30.3 恢复机制

恢复流程：

```text
1. 用户选择备份文件
2. 系统校验备份完整性
3. 当前数据库先自动备份一份
4. 停止后台任务
5. 替换数据库
6. 运行 migration 检查
7. 重启应用或重新加载数据
```

恢复时必须避免：

```text
直接覆盖当前库且没有回滚
恢复失败导致新旧数据都损坏
```

---

### 30.4 数据库完整性检查

DatabaseHealthService 负责定期检查：

```text
数据库是否可打开
PRAGMA integrity_check 是否通过
数据库大小
主要表行数
最近备份时间
是否存在失败 migration
是否存在长期 failed jobs
```

如果发现风险，轻量提醒用户：

```text
数据库最近还没有备份，建议备份一次。
```

不建议频繁打扰。

---
## 31. Migration Manager

数据库结构一定会变化，因此必须从第一版开始支持 migration。

新增表：

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT,
  applied_at TEXT NOT NULL
);
```

规则：

```text
所有数据库结构变化必须通过 migration。
不允许开发过程中手动随意改线上用户数据库。
每次启动检查 migration 版本。
升级前自动备份数据库。
migration 失败时停止启动主流程，并提示恢复。
```

Migration 文件命名：

```text
001_initial_schema.sql
002_add_learning_blocks.sql
003_add_ai_request_logs.sql
004_add_backup_metadata.sql
```

---
## 32. AI Request Logger 与 Prompt 版本管理

AI 调用是系统最不稳定的部分之一，需要记录日志。

新增表：

```text
ai_request_logs
prompt_versions
```

---

### 32.1 ai_request_logs

建议字段：

```text
id
provider
model
prompt_type
global_prompt_version
mode_prompt_version
output_schema_version
input_tokens_estimate
output_tokens_estimate
latency_ms
status
error_message
request_created_at
response_completed_at
related_session_id
related_block_id
related_message_id
```

用途：

```text
排查 AI 为什么慢
排查哪次请求失败
排查哪个 prompt 版本效果不好
估算 API 成本
发现模型切换后的质量变化
```

---

### 32.2 prompt_versions

建议字段：

```text
id
prompt_name
version
content
description
created_at
is_active
```

每次重要 prompt 修改都应该新增版本，而不是直接覆盖。

需要版本化的内容：

```text
global_system_prompt
word_theme_mode_prompt
word_review_mode_prompt
long_sentence_mode_prompt
grammar_correction_mode_prompt
free_chat_mode_prompt
summary_prompt
output_schema_prompt
```

好处：

```text
一年后可以追溯某条 AI 回复是由哪个 prompt 生成的
可以对比 prompt 修改前后的效果
可以在新 prompt 失效时回退
```

---
## 33. AI 失败与结构化输出降级

AI 输出不稳定是必须接受的事实。

可能失败情况：

```text
API 超时
网络失败
模型返回空内容
模型没有按 JSON schema 返回
reply 正常但 structured payload 错误
结构化字段缺失
模型产生不应写库的错误建议
```

---

### 33.1 基本原则

```text
用户消息不能丢。
用户能看到的 reply 优先。
结构化结果失败时，不污染数据库。
失败要记录日志。
必要时允许重试。
```

---

### 33.2 处理规则

如果 AI API 完全失败：

```text
1. 保留用户消息
2. 显示错误提示
3. 提供“重试”入口
4. 记录 ai_request_logs
5. 不写学习状态更新
```

如果 AI reply 成功，但 structured output 失败：

```text
1. 正常展示 reply
2. 不执行 word_updates / grammar_updates
3. 写入 ai_output_parse_failed learning_event
4. 后台可尝试二次解析
```

如果 AI 建议状态更新，但依据不足：

```text
1. 不直接写入最终状态
2. 记录为 update_candidate
3. 由对应 Engine 根据规则判断
```

---
## 34. Review Load Manager

长期每天学习 45-60 个新词，会产生复习压力。

如果没有复习负载控制，可能出现：

```text
每日到期复习词过多
weak 词越积越多
用户连续遗忘
AI 仍然不断安排新词
学习压力爆炸
```

因此，需要 Review Load Manager。

---

### 34.1 需要监控的指标

```text
due_review_count：今日到期复习词数量
weak_word_count：当前 weak 词数量
review_debt：未完成复习债务
forget_rate_7d：最近 7 天遗忘率
new_word_pressure：新词压力
daily_learning_time_7d：最近 7 天学习时间
```

---

### 34.2 调整规则

建议规则：

```text
1. 如果 due_review_count 过高，减少新词数量。
2. 如果 weak_word_count 过高，优先安排 weak 词专项复习。
3. 如果 forget_rate_7d 过高，进入巩固日。
4. 如果用户最近学习时间不足，减少新词，保留核心复习。
5. 如果用户表现稳定，再恢复 45-60 个新词。
```

示例：

```text
如果今天到期复习词超过 180 个，
则新词从 50 个降到 30 个，
重点精学词从 22 个降到 12-15 个。
```

```text
如果最近 7 天 weak 词持续增加，
则安排一天“巩固日”，不大量上新词。
```

---

### 34.3 与 AI 的关系

Review Load Manager 不应完全交给 AI。

正确分工：

```text
程序计算复习压力指标。
AI 负责用自然语言解释为什么调整。
程序决定新词和复习数量的安全范围。
AI 在范围内安排具体主题和讲法。
```

---
## 35. 数据归档与压缩

长期使用后，原始记录会很多。

这些记录不能删除，但也不应该每次都参与上下文。

因此需要 ArchiveAndCompactionService。

---

### 35.1 聊天历史压缩

规则：

```text
当前会话保留最近消息
旧 learning block 生成 block summary
旧 daily 生成 daily summary
旧 weekly 生成 weekly review
```

AI 回复时优先读取：

```text
最近消息
block summary
daily summary
weekly review
ai_memory_summary
```

而不是全部原文。

---

### 35.2 学习事件压缩

原始 learning_events 保留。

但可以额外生成聚合表：

```text
daily_summaries
weekly_reviews
monthly_stats
word_performance_snapshots
```

这些表用于：

```text
快速展示
快速复盘
快速生成上下文
减少全表统计
```

---

### 35.3 建议新增表

```text
daily_summaries
weekly_reviews
monthly_stats
word_performance_snapshots
```

`daily_summaries` 字段示例：

```text
id
study_day
summary
new_words_count
review_words_count
weak_words_count
long_sentences_count
main_issues
next_suggestions
created_at
updated_at
```

`weekly_reviews` 字段示例：

```text
id
week_start
week_end
summary
vocabulary_progress
weak_patterns
long_sentence_progress
grammar_progress
next_week_suggestions
created_at
updated_at
```

---
## 36. 文件导入长期管理

文件上传是对话附件，但长期使用时仍需要管理来源。

否则一年后会不知道：

```text
哪些词来自哪个文件
哪些长难句来自哪个文件
哪些文件解析失败
哪些文件只是临时材料
哪些文件已经入库
```

---

### 36.1 建议新增表

```text
file_records
file_chunks
file_ingestion_jobs
source_links
```

`file_records` 字段示例：

```text
id
filename
file_type
file_size
file_hash
storage_path
upload_time
status
user_instruction
created_at
updated_at
```

`file_chunks` 字段示例：

```text
id
file_id
chunk_index
content
token_estimate
created_at
```

`source_links` 字段示例：

```text
id
source_type
source_id
file_id
chunk_id
created_at
```

用途：

```text
词汇可以追溯来源文件
长难句可以追溯来源段落
文件解析失败可以重试
用户可以知道哪些材料已处理
```

---

### 36.2 第一版文件支持范围

第一版优先支持：

```text
txt
csv
md
```

谨慎支持：

```text
pdf
docx
xlsx
```

原因：

```text
txt / md 简单稳定
csv 适合词库导入
pdf / docx / xlsx 解析质量和工程复杂度更高
```

pdf / docx / xlsx 可以保留接口，但不作为第一版核心闭环。

---
## 37. 长期使用下的 MVP 优先级修正

从一年半使用角度，第一版 MVP 需要加入一些工程基础能力。

### 37.1 P0：必须做

```text
AI 主对话
每日目标池
learning block
词汇基础表
user_word_progress
word_review_events
learning_events
ai_memory_summary
每日词汇主题课
长难句训练
每日轻总结
每周复盘
数据库 migration
自动备份 / 手动备份
关键表索引
消息分页 / 虚拟列表
AI 请求日志
后台 job queue
Context Budget Manager
structured output fallback
```

---

### 37.2 P1：强烈建议

```text
Prompt 版本管理
数据库健康检查
复习负载控制
daily_summaries
weekly_reviews
file_records / file_chunks
数据库恢复入口
失败 job 重试
```

---

### 37.3 P2：后续增强

```text
本地全文搜索 FTS
语义检索 / embedding
更完整的自动评估测试集
数据归档 UI
云备份
多模型 provider
PDF / docx / xlsx 高质量解析
语音输入
作文批改
完整真题题库系统
```

---
## 38. 长期使用审查结论

从性能角度：

```text
当前技术路线可以支撑一年半使用。
但必须补充索引、分页、上下文预算、后台任务、备份恢复和日志。
```

从功能完整度角度：

```text
学习功能已经较完整。
但长期使用所需的工程耐久性能力还必须补齐。
```

从风险角度：

```text
如果不补这些长期设计，前 1-2 个月可能没问题；
3-6 个月后可能出现聊天变慢、复习负载变重、总结变慢；
12-18 个月后可能出现数据维护、备份恢复、升级迁移和问题排查困难。
```

最终判断：

```text
不需要推翻现有架构。
但需要把长期耐久性架构作为第一版底层能力的一部分。
```

这个程序最终要达到的不是：

```text
能跑的 AI 学习 App
```

而是：

```text
能稳定陪用户用到考研前的本地 AI 学习系统
```
## 39. 模块协作策略总原则

本阶段开始细化各小模块之间的功能逻辑和冲突处理策略。

本产品不是传统课程软件，也不是普通聊天工具，而是一个长期运行的本地 AI 英语学习系统。用户可能在任何时刻进行任意操作，例如：

```text
正在背词时突然问语法
正在练长难句时要求直接答案
AI 正在流式回复时用户又发新消息
早上学了一部分，晚上继续
晚上 11 点开始学到凌晨
上传文件但说不要入库
说“这个词我已经会了”
说“以后多考我这个词”
说“今天不想学新词”
说“总结一下”
说“清空今天记录”
AI 返回了自然语言回复，但结构化 JSON 解析失败
后台正在生成总结，用户又开始新学习
```

因此，系统不能依赖穷举所有场景来保持稳定。

更合理的策略是：

```text
用状态轴描述当前情况
用 Learning State Manager 管理状态
用 Intent Router 识别用户意图
用任务栈处理临时打断
用优先级规则解决模块冲突
用 persistence_policy 控制写库范围
用 learning_events 记录事实
用 Engine 层验证 AI 建议
用 Job Queue 处理后台任务
用 fallback 处理失败和未知情况
```

核心原则：

```text
1. 数据安全优先于一切学习流程。
2. 用户明确指令优先于 AI 主动计划。
3. 当前用户问题优先于每日目标池。
4. 复习负载安全优先于新词扩张。
5. 当前事实优先于长期记忆。
6. AI 可以建议，但不能直接修改核心数据库状态。
7. 所有重要状态变化必须有事件依据。
8. 用户消息必须先保存，再调用 AI。
9. 未知情况默认安全处理，不做破坏性写库。
10. 系统不追求一次设计覆盖所有可能，而是通过日志和事件不断修正规则。
```

---
## 40. 核心状态轴设计

系统不应只维护一个 `current_mode`。  
为了处理真实使用中的复杂情况，需要拆成多个状态轴。

这些状态轴由 `Learning State Manager` 集中管理，其他模块不能随意修改全局状态。

---

### 40.1 时间状态轴

用于判断学习属于哪一天、哪一段、哪一次会话。

```text
study_day：学习日，默认凌晨 4 点切换
chat_session：对话容器
learning_block：一段连续有效学习
daily_target_pool：当天目标池
```

说明：

```text
chat_session 不等于 learning_block。
chat_session 是聊天记录容器。
learning_block 是学习行为时间段。
daily_target_pool 是当天学习方向。
```

一个用户可能：

```text
一个 chat_session 跨多个 learning block
同一天产生多个 learning block
一个 learning block 跨过自然日 0 点
```

因此，系统不能用“打开软件 / 关闭软件”判断学习边界。

---

### 40.2 用户意图状态轴

用于判断用户当前消息想做什么。

推荐 `intent_type`：

```text
ask_question
answer_question
learning_answer
learning_request
mode_switch_request
stop_or_pause_request
summary_request
direct_answer_request
paste_single_word
paste_word_list
paste_sentence
paste_article
file_with_instruction
free_chat_message
correction_request
settings_request
manual_state_override
destructive_action_request
unknown_intent
```

用户意图回答的是：

```text
用户现在想干什么？
```

其中，部分强指令必须优先用规则识别，不能完全交给 AI 猜。

例如：

```text
总结一下
今天到这里
直接告诉我
先别入库
继续
停一下
这个词我会了
以后多考我
清空
删除
覆盖
重置
```

---

### 40.3 学习任务状态轴

用于判断当前正在做什么学习任务。

```text
current_learning_task:
- none
- daily_plan
- word_theme_learning
- word_review
- long_sentence
- grammar_correction
- free_chat
- file_processing
- summary
- weekly_review
```

学习任务回答的是：

```text
系统当前正在带用户学什么？
```

---

### 40.4 教学行为状态轴

用于判断 AI 此刻应该怎么教。

```text
teacher_mode:
- guide
- explain
- answer
- review
- chat
```

教学行为回答的是：

```text
AI 这轮应该引导、讲解、直接回答、复习，还是聊天？
```

注意：

```text
current_learning_task 和 teacher_mode 不是同一个概念。
```

示例：

```text
current_learning_task = long_sentence
teacher_mode = guide
```

表示：

```text
当前在练长难句，AI 正在引导用户。
```

如果用户说：

```text
别引导了，直接翻译。
```

则变成：

```text
current_learning_task = long_sentence
teacher_mode = answer
```

任务没变，但教学行为变了。

---

### 40.5 内容来源状态轴

用于判断学习材料来自哪里。

```text
content_source:
- built_in_vocab
- real_exam
- ai_generated
- user_pasted
- uploaded_file
- imported_csv
- previous_mistake
```

作用：

```text
区分真题和 AI 生成
区分用户上传材料和系统内置材料
区分临时材料和已入库材料
保留词汇、长难句、文章的来源
```

原则：

```text
AI 生成内容不能冒充真题。
用户上传内容需要保留来源。
正式入库内容需要可追溯。
```

---

### 40.6 持久化策略状态轴

原来的 `write_scope` 容易不够精细，因此改为：

```text
persistence_policy
```

推荐枚举：

```text
transient_only
message_only
event_only
update_progress
durable_import
memory_update_allowed
```

含义：

1. `transient_only`  
   - 只作为本轮临时上下文使用。
   - 不入长期学习库。
   - 适合用户说“只讲一下，不要记录”。

2. `message_only`  
   - 只保存聊天消息。
   - 不写学习事件，不更新进度。

3. `event_only`  
   - 保存学习事件。
   - 不更新长期掌握状态。
   - 适合临时练习或不确定结果。

4. `update_progress`  
   - 允许更新用户学习进度。
   - 例如词汇状态、语法弱点、长难句表现。

5. `durable_import`  
   - 正式导入长期数据库。
   - 例如导入词库、长难句库、阅读材料。

6. `memory_update_allowed`  
   - 允许更新长期记忆摘要。
   - 通常用于总结、复盘、稳定模式识别。

重要规则：

```text
用户明确说“不要入库”“只临时用”“先别记录”时，
AI structured_payload 不能覆盖该策略。
```

---
## 41. Learning State Manager

`Learning State Manager` 是当前学习状态的唯一来源。

它负责管理：

```text
study_day
active_chat_session
active_learning_block
daily_target_pool
current_learning_task
teacher_mode
active_task
interrupted_task_stack
persistence_policy
content_source
```

其他模块不能直接修改这些全局状态。

所有状态变化都必须通过：

```text
StateManager.transition(event)
```

来完成。

---

### 41.1 为什么需要 Learning State Manager

如果没有统一状态管理，容易出现状态漂移。

例如：

```text
Intent Router 认为用户在 word_review
Daily Target Pool 认为还在 word_theme_learning
AI Orchestrator 认为 teacher_mode = guide
前端显示还在 long_sentence
```

这会导致：

```text
AI 回复不一致
数据库写入错误
前端状态显示混乱
学习总结不准确
```

因此，状态更新必须集中处理。

---

### 41.2 State Transition 示例

示例 1：用户要求直接答案

```json
{
  "event": "USER_REQUEST_DIRECT_ANSWER",
  "from": {
    "current_learning_task": "long_sentence",
    "teacher_mode": "guide"
  },
  "to": {
    "current_learning_task": "long_sentence",
    "teacher_mode": "answer"
  }
}
```

示例 2：背词时临时问语法

```json
{
  "event": "USER_INTERRUPTS_WITH_GRAMMAR_QUESTION",
  "from": {
    "active_task": "word_theme_learning"
  },
  "to": {
    "active_task": "grammar_explanation",
    "interrupted_task_stack": ["word_theme_learning"]
  }
}
```

示例 3：用户说今天到这里

```json
{
  "event": "USER_REQUEST_SUMMARY_AND_STOP",
  "to": {
    "teacher_mode": "review",
    "current_learning_task": "summary",
    "should_end_active_block": true
  }
}
```

---
## 42. 任务栈与打断恢复机制

自然语言学习中，用户经常会临时打断当前任务。

例如：

```text
正在学词 → 突然问语法
正在练长难句 → 要求查一个单词
正在自由聊天 → 让 AI 总结一下刚才的错误
正在文件处理 → 临时问今天学了多久
```

如果系统没有任务栈，就无法自然恢复原任务。

---

### 42.1 active_task

`active_task` 表示当前正在执行的任务。

示例：

```json
{
  "task_type": "word_theme_learning",
  "theme": "影响与结果",
  "focused_words_done": 12,
  "focused_words_total": 22,
  "ordinary_words_touched": 25
}
```

---

### 42.2 interrupted_task_stack

当用户临时切换任务时，原任务进入任务栈。

示例：

```json
{
  "active_task": {
    "task_type": "grammar_explanation",
    "question": "这里为什么不能用 which？"
  },
  "interrupted_task_stack": [
    {
      "task_type": "word_theme_learning",
      "theme": "影响与结果",
      "focused_words_done": 12,
      "focused_words_total": 22
    }
  ]
}
```

临时任务完成后，AI 可以自然询问：

```text
这个语法点讲完了。要不要回到刚才“影响与结果”那组词？
```

---

### 42.3 打断规则

用户当前问题优先。

系统不应强行说：

```text
我们先继续背词。
```

更合理：

```text
这个问题先解决，因为它会影响你理解这句话。讲完后我们再回到刚才那组词。
```

如果用户不想回去，原任务保留到 daily_target_pool 的未完成项中。

---
## 43. 用户输入处理总流程

每条用户输入都应走统一流程。

```text
1. React 捕获输入
2. IPC 发送给 main process
3. ChatRepository 保存 user message
4. LearningBlockManager 判断是否开启或延续 learning block
5. Intent Router 识别 intent_type
6. 检查是否为强指令或破坏性操作
7. Learning State Manager 执行状态转移
8. 判断 persistence_policy
9. Context Retriever 读取必要上下文
10. Context Budget Manager 裁剪上下文
11. Prompt Builder 构造 AI 请求
12. AI Orchestrator 调用 AI
13. 前端流式展示 reply
14. ChatRepository 保存 assistant message
15. Structured Output Parser 解析结构化结果
16. Action Validator 校验允许动作
17. LearningEventRepository 写入 learning_events
18. 对应 Engine 验证并更新状态
19. 必要时创建后台 job
```

硬性要求：

```text
用户消息必须先写库，再调用 AI。
AI 失败不能导致用户消息丢失。
结构化结果失败不能污染学习状态。
```

---
## 44. 模块冲突仲裁规则

当多个模块都想控制下一步时，使用统一优先级。

---

### 44.1 总优先级

从高到低：

```text
P0：数据安全与系统稳定
P1：破坏性操作确认
P2：用户明确指令
P3：当前用户问题的直接回答需求
P4：Review Load Guardrail
P5：当前 learning block 连续性
P6：当前学习任务
P7：每日目标池
P8：复习调度建议
P9：长期记忆建议
P10：AI 主动拓展建议
```

解释：

```text
数据安全永远第一。
破坏性操作必须确认。
用户明确说的话优先于 AI 计划。
当前问题优先于长期学习安排。
复习负载安全优先于新词扩张。
每日目标池是建议，不是强制任务。
长期记忆只能辅助，不应覆盖当前事实。
```

---

### 44.2 Review Load Guardrail

复习负载不是普通建议，而是安全护栏。

如果出现：

```text
due_review_count 过高
weak_word_count 过高
forget_rate_7d 过高
review_debt 持续增加
```

则 Lesson Planner 必须减少新词量。

示例：

```text
原计划：今天学 55 个新词。
实际：今天到期复习词 210 个，weak 词持续增加。
调整：新词降到 25-30 个，优先复习和巩固。
```

AI 可以解释调整原因，但不能绕过该护栏。

---

### 44.3 用户明确要求直接答案

当前状态：

```text
current_learning_task = long_sentence
teacher_mode = guide
```

用户说：

```text
别引导了，直接翻译。
```

仲裁结果：

```text
teacher_mode = answer
current_learning_task 保持 long_sentence
AI 直接给答案
不继续追问
答案后补一个简短迁移线索
```

---

### 44.4 背词过程中突然问语法

当前状态：

```text
current_learning_task = word_theme_learning
```

用户问：

```text
这里为什么不能用 which？
```

仲裁结果：

```text
当前用户问题优先
active_task 切换到 grammar_explanation
原 word_theme_learning 进入 interrupted_task_stack
回答后询问是否回到词汇主题
```

---

### 44.5 长期记忆与当前表现冲突

长期记忆：

```text
用户容易找不到主干
```

当前表现：

```text
用户连续 3 次准确找到主干
```

仲裁结果：

```text
当前表现优先
降低该记忆 confidence
不要继续用“你容易找不到主干”的方式指导用户
```

---
## 45. 小模块功能逻辑细化

### 45.1 Chat Module

职责：

```text
保存消息
读取消息
分页加载消息
支持流式 assistant 回复
支持重新生成
支持消息关联 learning_events
```

不负责：

```text
判断学习模式
更新词汇状态
生成每日计划
解析文件
```

关键规则：

```text
聊天消息是原始记录。
学习状态必须通过 learning_events 和各 progress 表体现。
```

---

### 45.2 Intent Router

职责：

```text
识别用户意图
判断是否打断当前任务
判断是否为强指令
判断是否为破坏性操作
决定下一步目标模块
建议 teacher_mode
建议 persistence_policy
```

输入：

```text
用户消息
附件信息
当前 active_task
当前 learning block
最近消息
显式命令
```

输出：

```json
{
  "intent_type": "direct_answer_request",
  "should_interrupt_current_task": true,
  "target_module": "SentenceEngine",
  "suggested_teacher_mode": "answer",
  "persistence_policy": "event_only",
  "is_destructive_action": false
}
```

强指令优先用规则识别：

```text
总结一下
今天到这里
直接告诉我
先别入库
继续
停一下
这个词我会了
以后多考我
```

破坏性操作也必须规则识别：

```text
清空
删除
覆盖
重置
全部标记
替换导入
```

---

### 45.3 Daily Target Pool Module

职责：

```text
创建每日目标池
更新每日目标池
记录今日目标进度
处理未完成内容
根据用户口述调整目标
```

关键规则：

```text
每日目标池是建议，不是锁死任务。
用户可以随时改。
目标池不等于课程。
```

每日目标池状态：

```text
planned
in_progress
partially_done
done
carried_over
cancelled
```

---

### 45.4 Learning Block Module

职责：

```text
创建 learning block
结束 learning block
记录 block 内学习事件
生成 block summary
统计 block 学习时间
```

关键规则：

```text
learning block 是行为记录边界，不是用户必须感知的课程边界。
```

结束条件：

```text
用户明确说停
用户请求总结
45 分钟无有效学习互动
系统完成阶段总结
```

后台自动结束 block 时，不应打扰用户。

---

### 45.5 AI Orchestrator

职责：

```text
编排 AI 相关流程
调用 Intent Router
调用 Context Retriever
调用 Prompt Builder
调用 AI Client
调用 Structured Output Parser
分发结果给对应 Engine
```

AI Orchestrator 是流程编排器，不是业务规则中心。

它不应该直接：

```text
写 SQL
更新词汇状态
更新语法弱点
修改长期记忆
直接导入文件
```

这些必须交给对应 Engine 或 Service。

---

### 45.6 Vocabulary Engine

职责：

```text
选词
分组
安排词汇主题课
记录词汇练习
更新词汇状态
处理用户手动标记
判断 weak
合并同词多来源 evidence
```

冲突情况：

```text
用户说会了，但最近仍频繁答错
用户说多考我，但复习负载很高
AI 判断 weak，但证据不足
同一个词同时出现在主题课、复习队列和长难句中
```

处理策略：

```text
用户手动标记作为强信号，但不一定完全覆盖系统判断。
系统可以调整复习频率，而不是只改 status。
同一天同词多来源出现时合并记录。
AI 判断 weak 必须有 evidence。
```

同词优先级：

```text
weak > due_review > key_word_in_sentence > new_word > incidental_word
```

---

### 45.7 Review Scheduler 与 Review Load Manager

Review Scheduler 职责：

```text
选择到期复习词
计算 next_review_at
根据表现调整 interval
```

Review Load Manager 职责：

```text
监控复习压力
控制新词数量上限
判断是否进入巩固日
防止 review debt 爆炸
```

关键规则：

```text
复习债务优先于新词扩张。
due_review_count 过高时自动减少新词。
weak_word_count 过高时安排巩固日。
```

---

### 45.8 Sentence Engine

职责：

```text
选择长难句
生成或读取解析
记录用户理解情况
更新长难句弱点
联动词汇和语法模块
```

冲突情况：

```text
AI 生成句子与真题句子优先级冲突
用户上传句子但系统想练内置句子
长难句暴露词汇问题和语法问题
```

处理策略：

```text
用户当前材料优先。
真题优先于 AI 生成。
AI 生成必须标记 created_by_ai。
长难句暴露的问题写 learning_events，再由 VocabularyEngine / GrammarEngine 分别更新。
```

---

### 45.9 Grammar Engine

职责：

```text
记录语法错误
判断严重程度
决定是否即时纠正
更新 grammar_issue_summary
触发专项训练
```

冲突情况：

```text
自由聊天要流畅，但语法错误需要纠正。
```

处理策略：

```text
严重错误即时轻量纠正。
小错误阶段总结。
重复错误进入 grammar_issue_summary。
自由聊天中不逐句打断。
```

---

### 45.10 Memory Engine

职责：

```text
更新 ai_memory_summary
生成 stable_patterns
维护 confidence
降低过期记忆权重
```

冲突情况：

```text
一次错误是否应进入长期记忆？
旧记忆是否仍然可信？
```

处理策略：

```text
一次错误只进 recent_issue。
同类问题 2-3 次以上才进入 stable_patterns。
必须带 evidence_event_ids。
用户连续表现好时降低 confidence。
长期未出现的问题不主动提起。
```

---

### 45.11 File Ingestion Module

职责：

```text
保存文件记录
解析文件
分块
识别用途
执行导入或临时学习
记录来源
```

冲突情况：

```text
用户上传文件但没说明用途
用户上传文件并说不要入库
文件很大，AI 无法一次处理
后台正在导入同一文件
```

处理策略：

```text
用户说明优先。
无说明时 AI 简短确认。
大文件必须 chunk。
同一文件用 file_hash 去重。
同一文件不能同时执行多个导入 job。
第一版优先 txt / csv / md。
不要直接把整个文件塞进 prompt。
```

---

### 45.12 Summary Module

职责：

```text
生成 block summary
生成 daily summary
生成 weekly review
触发 memory update job
```

冲突情况：

```text
用户正在继续学习，系统到时间想总结。
后台正在总结，用户又开始新学习。
```

处理策略：

```text
不打断当前学习。
自动总结可以后台生成。
总结基于 snapshot。
新学习进入后续事件。
必要时 summary 标记为 stale。
```

---

### 45.13 Job Queue Module

职责：

```text
管理后台任务
重试失败任务
避免阻塞主对话
记录任务状态
处理任务去重和资源锁
```

任务类型：

```text
file_parse
vocab_import
memory_update
daily_summary
weekly_review
ai_note_generation
sentence_analysis_generation
backup
database_health_check
```

规则：

```text
同类任务避免重复创建。
任务必须可重试。
任务失败不影响聊天主流程。
同一资源的任务必须加锁或合并。
```

---
## 46. 并发与流式回复规则

真实使用中，用户可能在 AI 回复过程中继续输入。

需要明确并发规则。

---

### 46.1 主 AI 回复流

第一版建议：

```text
同一个 chat_session 同一时间只允许一个主 AI 回复流。
```

如果用户在 AI 正在回复时继续输入，可以选择：

```text
cancel_current_response
queue_after_current
```

第一版默认策略：

```text
用户新输入打断当前 AI 回复。
当前回复标记为 cancelled 或 partial。
新消息进入新的处理流程。
```

---

### 46.2 后台任务并发

后台 job 可以并发，但必须遵守资源锁。

规则：

```text
同一个文件不能同时导入两次。
同一个 learning block 不能同时生成两个 summary。
同一周不能同时生成多个 weekly review。
同一个 memory_type 不能并发写入冲突更新。
```

解决方式：

```text
resource_key
unique job key
transaction
upsert
job status lock
```

---

### 46.3 总结 snapshot

总结任务必须基于 snapshot。

例如：

```text
weekly_review_job 创建时记录 week_start / week_end / event_id 范围。
```

如果生成过程中用户继续学习，新事件不进入当前总结。

必要时标记：

```text
summary_status = stale
```

后续可重新生成。

---
## 47. AI 输出动作权限设计

AI 返回的 structured_payload 不能想写什么就写什么。

必须按当前模式限制允许动作。

---

### 47.1 AllowedActionsByMode

示例：

```text
word_theme_learning:
- create_word_review_event
- suggest_word_update
- create_learning_event
- create_weak_candidate

word_review:
- create_word_review_event
- update_review_schedule
- suggest_word_update
- create_learning_event

long_sentence:
- create_sentence_progress
- create_learning_event
- suggest_vocabulary_weakness
- suggest_grammar_weakness

grammar_correction:
- create_grammar_error_event
- update_grammar_issue_summary_candidate
- create_learning_event

free_chat:
- create_light_grammar_feedback
- create_expression_feedback
- create_limited_learning_event

summary:
- create_block_summary
- create_daily_summary
- suggest_memory_update

file_processing:
- create_file_record
- create_import_candidate
- create_file_chunk
```

不允许：

```text
free_chat 模式下大规模更新词汇状态。
summary 模式下导入文件。
word_theme_learning 模式下直接覆盖用户长期记忆。
file_processing 模式下无确认删除旧词库。
```

---

### 47.2 Action Validator

所有 structured_payload 都必须经过 Action Validator。

验证内容：

```text
字段是否完整
枚举是否合法
target_id 是否存在
action 是否被当前模式允许
是否违反 persistence_policy
是否涉及破坏性操作
是否有 evidence
是否需要用户确认
```

失败时：

```text
保留 reply
不执行 action
写入 validation_failed event
必要时创建后台重试或人工确认提示
```

---
## 48. 破坏性操作保护

用户可能要求：

```text
清空词库
删除今天记录
把所有 weak 词标为掌握
覆盖导入这个 CSV
重置所有进度
删除全部聊天
```

这些属于破坏性操作。

规则：

```text
任何 destructive_action 必须二次确认。
AI 不能直接执行。
前端需要展示明确确认信息。
执行前自动备份。
执行后写 learning_events 或 system_events。
```

破坏性操作包括：

```text
delete
overwrite
bulk_update
clear
reset
mark_all
import_replace
restore_backup
```

示例：

```text
用户：把所有 weak 词都标成掌握。

AI 不应直接执行。
系统应回复：

这会批量修改你的词汇进度，可能影响后续复习计划。你确定要把全部 weak 词标记为 mastered 吗？
```

---
## 49. 数据写入一致性策略

所有状态更新必须通过统一写入层。

---

### 49.1 写入原则

```text
1. 用户消息先写库。
2. AI 回复后写 assistant message。
3. 学习行为写 learning_events。
4. 当前状态表由对应 Engine 更新。
5. 多表更新使用 transaction。
6. AI 原始建议和最终写库结果要区分。
```

---

### 49.2 事件优先

状态变化必须有事件来源。

例如：

```text
user_word_progress.status 从 reviewing 变为 weak
```

必须能追溯到：

```text
word_review_events
learning_events
AI feedback
用户回答
状态更新规则
```

否则不应直接修改状态。

---

### 49.3 幂等性

后台任务必须尽量幂等。

例如：

```text
同一个 file_import job 重试，不应重复导入同一批单词。
同一个 weekly_review job 重试，不应生成多份同周复盘。
同一个 memory_update job 重试，不应重复增加 confidence。
```

解决方式：

```text
file_hash
unique key
job_id
source_links
upsert
resource_key
```

---
## 50. 未知场景处理策略

系统不追求穷举所有可能输入。

当出现未知情况时，默认策略：

```text
1. 不丢用户消息。
2. 不自动污染数据库。
3. 优先回答用户当前问题。
4. 涉及入库、删除、覆盖、重置时先确认。
5. 记录 unknown_intent 或 unresolved_case。
6. 后续根据日志优化规则。
```

如果 AI 不确定用户意图，可以轻量追问：

```text
你是想让我直接讲一下，还是要把它加入后续复习？
```

追问必须具体，不要泛泛问：

```text
你想怎么处理？
```

---
## 51. MVP 与长期增强的边界

本策略完整版本较重，第一版需要分层实现。

---

### 51.1 MVP 必须实现的稳定内核

```text
Learning State Manager 简化版
Intent Router 简化版
active_task
interrupted_task_stack 简化版
persistence_policy
用户消息先写库
AI 流式回复
structured_payload 基础验证
learning_events
VocabularyEngine 统一更新词汇状态
LearningBlockManager
DailyTargetPoolManager
Review Load Guardrail 简化版
Job Queue 简化版
destructive_action 二次确认
```

---

### 51.2 MVP 可以简化的部分

```text
任务栈先只支持一层打断
AllowedActionsByMode 先覆盖核心模式
Review Load Manager 先用简单阈值
Memory confidence 衰减先用简单规则
Job Queue 先用 SQLite 表 + 单进程调度
output lint 先做轻量版本
```

---

### 51.3 后续增强

```text
多层任务栈
更复杂状态机可视化
更细粒度 action 权限
更完整并发任务调度
更复杂复习负载模型
自动测试集
AI 回复质量评分
全文搜索
语义检索
```

---
## 52. 第三轮漏洞审查

### 漏洞 1：AI Orchestrator 变成上帝模块

风险：

```text
AI Orchestrator 管太多，最后变成新的混乱中心。
```

修复：

```text
AI Orchestrator 只做流程编排。
业务规则拆给 Intent Router、State Manager、Context Retriever、Prompt Builder、Parser 和各 Engine。
```

结论：

```text
已修复。
```

---

### 漏洞 2：状态轴过多导致状态漂移

风险：

```text
多个模块各自修改状态，导致状态不一致。
```

修复：

```text
Learning State Manager 作为唯一状态来源。
所有状态变化通过 StateManager.transition()。
```

结论：

```text
已修复。
```

---

### 漏洞 3：用户打断后无法回到原任务

风险：

```text
临时问答打断每日词汇主题课后，系统忘记原进度。
```

修复：

```text
使用 active_task + interrupted_task_stack。
临时任务结束后可恢复或询问是否回到原任务。
```

结论：

```text
已修复。
```

---

### 漏洞 4：复习负载优先级不够高

风险：

```text
每日目标池仍然不断安排新词，导致复习债务爆炸。
```

修复：

```text
Review Load Guardrail 高于 Daily Target Pool。
每日计划生成前必须检查复习压力。
```

结论：

```text
已修复。
```

---

### 漏洞 5：write_scope 不够细

风险：

```text
无法表达临时学习、只保存消息、保存事件但不入长期库等区别。
```

修复：

```text
改为 persistence_policy：
transient_only / message_only / event_only / update_progress / durable_import / memory_update_allowed。
```

结论：

```text
已修复。
```

---

### 漏洞 6：并发与流式回复未定义

风险：

```text
用户在 AI 回复中继续输入，或后台任务并发操作同一资源。
```

修复：

```text
同一 chat_session 同时只允许一个主 AI 回复流。
后台 job 使用 resource_key 和锁。
summary 基于 snapshot。
```

结论：

```text
已修复。
```

---

### 漏洞 7：AI structured_payload 越权更新

风险：

```text
AI 在错误模式下返回不该执行的数据库更新。
```

修复：

```text
AllowedActionsByMode + Action Validator。
不同模式只能执行允许动作。
```

结论：

```text
已修复。
```

---

### 漏洞 8：破坏性操作被误执行

风险：

```text
用户一句话导致清空、覆盖、重置等危险操作。
```

修复：

```text
destructive_action_guard。
所有破坏性操作必须二次确认，执行前自动备份。
```

结论：

```text
已修复。
```

---

### 漏洞 9：MVP 实现过重

风险：

```text
完整策略太复杂，导致第一版迟迟做不出来。
```

修复：

```text
拆分 MVP 稳定内核和后续增强。
第一版只实现必要机制的简化版。
```

结论：

```text
已修复。
```

---
## 53. 修复后的模块协作策略结论

本系统不靠穷举所有用户场景来保证稳定。

系统靠以下机制处理复杂情况：

```text
状态轴
Learning State Manager
Intent Router
任务栈
优先级仲裁
persistence_policy
AllowedActionsByMode
Action Validator
统一写入层
learning_events
Job Queue
失败降级
长期摘要压缩
```

最终策略：

```text
1. 用多个状态轴描述当前情况。
2. 用 Learning State Manager 作为当前状态唯一来源。
3. 用任务栈处理用户临时打断。
4. 用统一优先级解决模块冲突。
5. 用 Review Load Guardrail 防止复习压力失控。
6. 用 persistence_policy 防止错误入库。
7. 用 AI Orchestrator 编排流程，但不承载全部业务规则。
8. 用 structured_payload 表达 AI 建议。
9. 用 AllowedActionsByMode 限制 AI 可执行动作。
10. 用 Action Validator 验证结构化输出。
11. 用各 Engine 决定最终写库。
12. 用 learning_events 记录所有重要事实。
13. 用 Job Queue 处理后台任务。
14. 用 destructive_action_guard 保护危险操作。
15. 用 fallback 保证 AI 或解析失败时系统仍稳定。
```

信心判断：

```text
不能保证真实开发零 bug。
不能保证 AI 永远按预期输出。
不能穷举用户所有可能行为。

但修正后，这套策略已经覆盖主要结构性风险：
- 模块冲突
- 用户打断
- 状态漂移
- 错误入库
- 复习负载冲突
- AI 结构化输出失败
- 后台任务并发
- 未知意图
- 破坏性操作
- 长期记忆过度影响
- MVP 过重
```
## 54. Learning State Manager 详细设计

Learning State Manager 是当前学习状态的唯一来源。

它不负责教学内容生成，也不负责数据库具体写入。  
它只负责回答一个问题：

```text
当前系统到底处在什么学习状态？
```

如果没有这个模块，后期会出现：

```text
前端显示在背单词
AI 以为在长难句
Daily Target Pool 以为还在今日词汇主题课
Vocabulary Engine 又在执行复习
```

因此，所有和当前状态有关的变化，都必须经过 Learning State Manager。

---

### 54.1 Learning State Manager 职责

职责：

```text
1. 维护当前 study_day
2. 维护 active_chat_session
3. 维护 active_learning_block
4. 维护 current_learning_task
5. 维护 teacher_mode
6. 维护 active_task
7. 维护 interrupted_task_stack
8. 维护 current persistence_policy
9. 维护 current content_source
10. 根据事件执行状态转移
11. 拒绝非法状态转移
12. 输出 student_state 给 AI Orchestrator
```

不负责：

```text
1. 不直接调用 AI
2. 不直接写学习事件
3. 不直接更新词汇状态
4. 不直接生成 prompt
5. 不直接处理文件解析
```

---

### 54.2 State 数据结构

第一版可以使用一个内存状态对象，并定期持久化到数据库。

建议结构：

```json
{
  "study_day": "2026-05-21",
  "active_chat_session_id": 12,
  "active_learning_block_id": 45,

  "current_learning_task": "word_theme_learning",
  "teacher_mode": "guide",

  "active_task": {
    "task_type": "word_theme_learning",
    "task_id": "task_20260521_vocab_theme_001",
    "theme": "影响与结果",
    "status": "in_progress",
    "progress": {
      "focused_words_done": 12,
      "focused_words_total": 22,
      "ordinary_words_touched": 25,
      "ordinary_words_total": 30
    }
  },

  "interrupted_task_stack": [],

  "persistence_policy": "update_progress",
  "content_source": "built_in_vocab",

  "last_user_activity_at": "2026-05-21T20:35:00+09:00",
  "last_state_transition_at": "2026-05-21T20:35:02+09:00"
}
```

---

### 54.3 current_learning_task 枚举

```text
none
daily_plan
word_theme_learning
word_review
long_sentence
grammar_correction
free_chat
file_processing
summary
weekly_review
settings
```

说明：

```text
none：当前没有明确学习任务
daily_plan：正在生成或调整今日目标池
word_theme_learning：每日词汇主题课
word_review：词汇复习
long_sentence：长难句训练
grammar_correction：语法纠错
free_chat：自由聊天练英语
file_processing：文件上传、解析或导入
summary：生成阶段总结或每日总结
weekly_review：每周复盘
settings：设置相关操作
```

---

### 54.4 teacher_mode 枚举

```text
guide
explain
answer
review
chat
```

说明：

```text
guide：引导用户尝试
explain：直接讲解
answer：直接给答案
review：复习和总结
chat：保持自然交流
```

`teacher_mode` 不等于 `current_learning_task`。

示例：

```text
current_learning_task = long_sentence
teacher_mode = guide
```

表示：

```text
正在练长难句，AI 正在引导用户。
```

---

### 54.5 persistence_policy 枚举

```text
transient_only
message_only
event_only
update_progress
durable_import
memory_update_allowed
```

说明：

```text
transient_only：只作为临时上下文，不保存为长期学习材料。
message_only：只保存聊天消息。
event_only：保存学习事件，但不更新长期状态。
update_progress：允许更新学习进度。
durable_import：允许正式导入词库、句库、文件内容。
memory_update_allowed：允许更新长期记忆摘要。
```

---

### 54.6 状态转移事件

所有状态变化都通过事件触发。

推荐事件：

```text
USER_STARTS_LEARNING
USER_REQUESTS_DAILY_PLAN
USER_SWITCHES_MODE
USER_INTERRUPTS_WITH_QUESTION
USER_REQUESTS_DIRECT_ANSWER
USER_REQUESTS_SUMMARY
USER_STOPS_LEARNING
USER_UPLOADS_FILE
USER_REQUESTS_IMPORT
USER_REQUESTS_NO_IMPORT
USER_OVERRIDES_WORD_STATE
AI_FINISHES_REPLY
AI_OUTPUT_PARSE_FAILED
BLOCK_TIMEOUT
BLOCK_SUMMARY_CREATED
REVIEW_LOAD_TOO_HIGH
DESTRUCTIVE_ACTION_REQUESTED
DESTRUCTIVE_ACTION_CONFIRMED
```

---

### 54.7 状态转移规则示例

#### 54.7.1 用户开始今日学习

输入事件：

```text
USER_STARTS_LEARNING
```

当前状态：

```text
current_learning_task = none
active_learning_block = null
```

转移结果：

```text
创建或恢复 study_day
创建 active_learning_block
current_learning_task = daily_plan
teacher_mode = review
```

---

#### 54.7.2 用户在背词时问语法

当前状态：

```text
current_learning_task = word_theme_learning
teacher_mode = guide
active_task = word_theme_learning
```

用户输入：

```text
这里为什么不能用 which？
```

Intent Router 输出：

```text
intent_type = ask_question
target_module = GrammarEngine
should_interrupt_current_task = true
```

状态转移：

```text
active_task 入 interrupted_task_stack
active_task = grammar_explanation
current_learning_task = grammar_correction
teacher_mode = explain
```

语法讲解结束后：

```text
如果用户继续原任务：
  从 interrupted_task_stack 恢复 word_theme_learning

如果用户不继续：
  word_theme_learning 标记为 interrupted
  未完成内容回 daily_target_pool
```

---

#### 54.7.3 用户要求直接答案

当前状态：

```text
current_learning_task = long_sentence
teacher_mode = guide
```

用户输入：

```text
别引导了，直接告诉我。
```

状态转移：

```text
current_learning_task 保持 long_sentence
teacher_mode = answer
```

不改变任务，只改变教学行为。

---

#### 54.7.4 用户说不要入库

用户输入：

```text
这篇文章只讲一下，不要入库。
```

状态转移：

```text
persistence_policy = transient_only 或 message_only
content_source = user_pasted
```

后续 AI structured_payload 即使建议导入，也不能执行 durable_import。

---

#### 54.7.5 复习负载过高

Review Load Manager 发出：

```text
REVIEW_LOAD_TOO_HIGH
```

状态影响：

```text
Daily Target Pool 生成时降低新词量
current_learning_task 不一定立即变化
Lesson Planner 受到 guardrail 限制
```

---

### 54.8 非法状态转移

Learning State Manager 需要拒绝非法状态。

示例：

```text
没有 active_learning_block，却写入 block summary
persistence_policy = transient_only，却执行 durable_import
teacher_mode = guide，但用户明确要求 direct answer
free_chat 模式下大规模批量更新词汇状态
summary 任务中执行文件覆盖导入
```

非法状态转移处理：

```text
1. 拒绝执行
2. 记录 state_transition_rejected
3. 保留用户可见回复
4. 不执行危险写库
```

---
## 55. Intent Router 详细设计

Intent Router 负责识别用户当前输入的真实意图。

它回答的问题是：

```text
用户这句话想让系统做什么？
```

Intent Router 不负责生成最终回复，也不负责写库。  
它只输出路由判断。

---

### 55.1 Intent Router 输入

```json
{
  "user_message": "别引导了，直接翻译。",
  "attachments": [],
  "current_state": {
    "current_learning_task": "long_sentence",
    "teacher_mode": "guide"
  },
  "recent_messages": [],
  "slash_command": null
}
```

---

### 55.2 Intent Router 输出

```json
{
  "intent_type": "direct_answer_request",
  "target_module": "SentenceEngine",
  "should_interrupt_current_task": false,
  "suggested_teacher_mode": "answer",
  "persistence_policy": "event_only",
  "is_destructive_action": false,
  "requires_confirmation": false,
  "confidence": 0.95
}
```

---

### 55.3 Intent 识别优先级

Intent Router 采用：

```text
规则优先
AI 辅助
低置信度时追问
```

优先级：

```text
1. Slash command
2. 明确强指令
3. 破坏性操作关键词
4. 文件附件 + 用户说明
5. 当前学习任务上下文
6. AI 轻量分类
7. unknown_intent fallback
```

---

### 55.4 强指令规则

以下指令不应完全交给 AI 猜。

```text
直接告诉我
别引导了
总结一下
今天到这里
停一下
继续
先别入库
只讲一下
导入这个文件
这个词我会了
以后多考我这个词
今天不要学新词
今天只复习
```

这些指令应由规则优先匹配。

---

### 55.5 破坏性操作识别

以下属于破坏性操作：

```text
清空
删除
覆盖
重置
全部标记
全部改成
替换导入
恢复备份
删除聊天
清空词库
清空学习记录
```

输出必须标记：

```json
{
  "is_destructive_action": true,
  "requires_confirmation": true
}
```

任何破坏性操作都不能直接执行。

---

### 55.6 文件相关 intent

文件上传时，Intent Router 需要结合附件和用户说明判断。

示例：

```text
[上传 csv]
这是我的考研词库，帮我导入。
```

输出：

```json
{
  "intent_type": "file_with_instruction",
  "target_module": "FileIngestionModule",
  "persistence_policy": "durable_import"
}
```

示例：

```text
[上传 pdf]
从里面挑长难句练我，不要入库。
```

输出：

```json
{
  "intent_type": "file_with_instruction",
  "target_module": "FileIngestionModule",
  "persistence_policy": "transient_only"
}
```

---

### 55.7 低置信度处理

如果 Intent Router 置信度低，不应乱执行。

默认策略：

```text
1. 回答当前可确定的问题
2. 不做入库或状态更新
3. 必要时轻量追问
```

好的追问：

```text
你是想让我只讲一下，还是要把它加入后续复习？
```

不好的追问：

```text
你想怎么处理？
```

---
## 56. AI Orchestrator 详细设计

AI Orchestrator 是 AI 流程编排器。

它不应该变成“上帝模块”。  
它只负责把各个模块串起来。

---

### 56.1 AI Orchestrator 职责

```text
1. 接收 AppController 的处理请求
2. 调用 Intent Router
3. 调用 Learning State Manager 执行状态转移
4. 调用 Context Retriever 获取上下文
5. 调用 Context Budget Manager 裁剪上下文
6. 调用 Prompt Builder 构造 AI 请求
7. 调用 AI Client
8. 流式返回 reply 给前端
9. 调用 Structured Output Parser
10. 调用 Action Validator
11. 分发 validated actions 给对应 Engine
12. 创建必要后台 job
```

不负责：

```text
1. 不直接写 SQL
2. 不直接更新词汇状态
3. 不直接更新语法弱点
4. 不直接执行文件导入
5. 不直接修改长期记忆
```

---

### 56.2 主流程伪代码

```ts
async function handleUserMessage(input) {
  const userMessage = await chatRepo.saveUserMessage(input)

  const block = await learningBlockManager.ensureActiveBlock(userMessage)

  const route = await intentRouter.route({
    userMessage,
    currentState: stateManager.getState(),
    attachments: input.attachments
  })

  const transition = await stateManager.transition(route)

  const context = await contextRetriever.retrieve({
    userMessage,
    route,
    state: stateManager.getState()
  })

  const budgetedContext = contextBudgetManager.trim(context)

  const prompt = promptBuilder.build({
    route,
    state: stateManager.getState(),
    context: budgetedContext
  })

  const aiResult = await aiClient.stream(prompt, {
    onToken: sendTokenToRenderer
  })

  const assistantMessage = await chatRepo.saveAssistantMessage(aiResult.reply)

  const parsed = structuredOutputParser.parse(aiResult)

  const validatedActions = actionValidator.validate({
    parsed,
    route,
    state: stateManager.getState()
  })

  await actionDispatcher.dispatch(validatedActions)

  await jobQueue.enqueueFollowUpJobs(validatedActions)

  return assistantMessage
}
```

---

### 56.3 AI Orchestrator 失败处理

#### 56.3.1 AI API 失败

处理：

```text
1. 用户消息已保存
2. 返回错误提示
3. 记录 ai_request_logs
4. 不写学习状态更新
5. 提供重试入口
```

---

#### 56.3.2 structured_payload 解析失败

处理：

```text
1. reply 正常展示
2. 不执行状态更新
3. 写 ai_output_parse_failed 事件
4. 可后台尝试二次解析
```

---

#### 56.3.3 Action Validator 拒绝

处理：

```text
1. reply 正常展示
2. 被拒绝 action 不执行
3. 写 validation_failed 事件
4. 必要时生成安全提示
```

---
## 57. Engine 接口边界设计

Engine 层负责具体业务规则。

所有 AI 建议必须经过 Engine 验证后，才能修改业务状态。

---

### 57.1 VocabularyEngine

#### 57.1.1 职责

```text
选词
分组
安排词汇主题课
记录词汇练习
更新 user_word_progress
判断 weak
处理用户手动标记
合并多来源 evidence
```

#### 57.1.2 接口草案

```ts
interface VocabularyEngine {
  selectDailyWords(input: SelectDailyWordsInput): Promise<DailyWordSelection>

  createWordTheme(input: CreateWordThemeInput): Promise<WordThemePlan>

  recordWordReview(input: RecordWordReviewInput): Promise<void>

  applyWordUpdateSuggestion(input: WordUpdateSuggestion): Promise<WordUpdateResult>

  handleManualOverride(input: ManualWordOverride): Promise<WordUpdateResult>

  getRelevantWordContext(wordIds: number[]): Promise<WordContext[]>
}
```

#### 57.1.3 关键规则

```text
AI suggested_status 不能直接写入。
weak 必须有 evidence。
用户手动说“会了”是强信号，但不一定直接 mastered。
同一个词同一天多来源出现时合并 evidence。
```

---

### 57.2 ReviewScheduler / ReviewLoadManager

#### 57.2.1 职责

```text
选择到期复习词
计算 next_review_at
监控复习压力
限制新词数量
判断是否进入巩固日
```

#### 57.2.2 接口草案

```ts
interface ReviewScheduler {
  getDueReviews(studyDay: string): Promise<ReviewWord[]>

  updateSchedule(input: ReviewResult): Promise<void>
}

interface ReviewLoadManager {
  getReviewLoad(studyDay: string): Promise<ReviewLoad>

  applyGuardrail(input: DailyPlanDraft): Promise<DailyPlanDraft>
}
```

#### 57.2.3 关键规则

```text
复习压力过高时，必须减少新词。
Review Load Guardrail 高于 Daily Target Pool。
```

---

### 57.3 SentenceEngine

#### 57.3.1 职责

```text
选择长难句
生成或读取解析
记录用户理解情况
抽取词汇和语法弱点候选
```

#### 57.3.2 接口草案

```ts
interface SentenceEngine {
  selectSentence(input: SelectSentenceInput): Promise<LongSentence>

  getOrCreateAnalysis(sentenceId: number): Promise<LongSentenceAnalysis>

  recordSentencePractice(input: SentencePracticeInput): Promise<void>

  extractWeaknessCandidates(input: SentencePracticeInput): Promise<WeaknessCandidate[]>
}
```

#### 57.3.3 关键规则

```text
用户上传材料优先。
真题优先于 AI 生成。
AI 生成句子必须标记 created_by_ai。
长难句暴露出的词汇和语法问题写为候选，不直接跨模块更新。
```

---

### 57.4 GrammarEngine

#### 57.4.1 职责

```text
记录语法错误
判断严重程度
决定是否即时纠正
更新 grammar_issue_summary
触发专项训练候选
```

#### 57.4.2 接口草案

```ts
interface GrammarEngine {
  recordGrammarError(input: GrammarErrorInput): Promise<void>

  updateGrammarSummary(input: GrammarSummaryCandidate): Promise<void>

  getRelevantGrammarContext(input: GrammarContextQuery): Promise<GrammarContext[]>
}
```

#### 57.4.3 关键规则

```text
自由聊天中不逐句纠错。
严重错误即时轻量纠正。
小错误阶段总结。
重复错误才进入长期语法弱点。
```

---

### 57.5 MemoryEngine

#### 57.5.1 职责

```text
更新 ai_memory_summary
维护 evidence_event_ids
维护 confidence
处理记忆衰减
避免贴标签
```

#### 57.5.2 接口草案

```ts
interface MemoryEngine {
  updateAfterBlock(blockId: number): Promise<void>

  updateAfterDailySummary(studyDay: string): Promise<void>

  updateAfterWeeklyReview(weekStart: string): Promise<void>

  getMemoryForPrompt(input: MemoryQuery): Promise<MemorySummary[]>

  decayMemoryConfidence(input: MemoryDecayInput): Promise<void>
}
```

#### 57.5.3 关键规则

```text
一次错误不进入 stable_patterns。
同类问题 2-3 次以上才提高 confidence。
当前表现改善时降低旧记忆 confidence。
```

---

### 57.6 FileIngestionService

#### 57.6.1 职责

```text
保存文件记录
解析文件
分块
判断用途
执行临时学习或正式导入
记录来源链接
```

#### 57.6.2 接口草案

```ts
interface FileIngestionService {
  saveFileRecord(input: FileUploadInput): Promise<FileRecord>

  parseFile(fileId: number): Promise<FileChunk[]>

  classifyFileIntent(input: FileIntentInput): Promise<FileIntentResult>

  createImportJob(input: FileImportInput): Promise<Job>

  linkSource(input: SourceLinkInput): Promise<void>
}
```

#### 57.6.3 关键规则

```text
用户说明优先。
无说明时简短确认。
大文件必须 chunk。
同一文件用 file_hash 去重。
第一版优先 txt / csv / md。
```

---
## 58. structured_payload Schema 初稿

AI 回复应分成：

```text
reply：给用户看的自然语言
structured_payload：给程序处理的结构化建议
```

---

### 58.1 总体结构

```json
{
  "reply": "展示给用户的回复",
  "structured_payload": {
    "detected_intent": "word_theme_learning",
    "teacher_mode": "guide",
    "next_best_action": "ask_word_guess",
    "persistence_policy": "update_progress",
    "actions": [],
    "warnings": []
  }
}
```

---

### 58.2 action 类型

```text
create_learning_event
create_word_review_event
suggest_word_update
create_weak_candidate
create_sentence_progress
suggest_grammar_weakness
create_grammar_error_event
suggest_memory_update
create_summary
create_file_import_candidate
request_user_confirmation
```

---

### 58.3 create_learning_event

```json
{
  "type": "create_learning_event",
  "event_type": "word_reviewed",
  "target_type": "word",
  "target_id": 123,
  "result": "partially_correct",
  "score": 0.6,
  "metadata": {
    "question_type": "context_guess",
    "note": "用户能猜出大意，但和相似词混淆"
  }
}
```

---

### 58.4 suggest_word_update

```json
{
  "type": "suggest_word_update",
  "word_id": 123,
  "suggested_status": "weak",
  "score_delta": -8,
  "dimension_updates": {
    "recognition_score": 0,
    "recall_score": -5,
    "context_score": -10,
    "usage_score": 0
  },
  "reason": "用户在语境中混淆 adapt/adopt",
  "evidence": {
    "event_ids": [991, 992],
    "confidence": 0.72
  }
}
```

规则：

```text
suggest_word_update 不能直接写库。
必须交给 VocabularyEngine 验证。
```

---

### 58.5 create_sentence_progress

```json
{
  "type": "create_sentence_progress",
  "sentence_id": 456,
  "user_guess": "用户的理解",
  "comprehension_score": 0.5,
  "structure_score": 0.4,
  "vocabulary_score": 0.7,
  "detected_weaknesses": {
    "grammar": ["relative_clause"],
    "vocabulary": [123, 124],
    "structure": ["missed_main_verb"]
  }
}
```

---

### 58.6 create_grammar_error_event

```json
{
  "type": "create_grammar_error_event",
  "original_sentence": "I very like this method.",
  "corrected_sentence": "I really like this method.",
  "issue_type": "word_choice",
  "severity": "medium",
  "should_interrupt": true,
  "explanation": "very 通常不直接修饰动词 like"
}
```

---

### 58.7 suggest_memory_update

```json
{
  "type": "suggest_memory_update",
  "memory_type": "long_sentence",
  "summary": "用户最近在多层修饰结构中容易先看从句，导致主干判断变慢。",
  "evidence_event_ids": [101, 102, 103],
  "confidence": 0.68
}
```

规则：

```text
suggest_memory_update 只能进入候选。
MemoryEngine 决定是否写入 ai_memory_summary。
```

---

### 58.8 request_user_confirmation

用于破坏性操作或不确定导入。

```json
{
  "type": "request_user_confirmation",
  "confirmation_type": "destructive_action",
  "message": "这会清空所有 weak 词状态，确定要继续吗？",
  "pending_action": {
    "type": "bulk_update_words",
    "scope": "all_weak_words"
  }
}
```

---
## 59. Action Validator 详细设计

Action Validator 负责验证 AI structured_payload 中的 actions 是否允许执行。

---

### 59.1 验证维度

```text
1. action type 是否合法
2. 当前模式是否允许该 action
3. target_id 是否存在
4. persistence_policy 是否允许写入
5. 是否涉及破坏性操作
6. 是否需要用户确认
7. evidence 是否足够
8. 分数是否在合理范围
9. 枚举值是否合法
10. 是否和用户明确指令冲突
```

---

### 59.2 验证失败处理

如果 action 验证失败：

```text
1. 不执行该 action
2. 保留 AI reply
3. 写 validation_failed learning_event 或 system_event
4. 必要时提示用户
```

示例：

```text
用户说不要入库，
AI 返回 durable_import action。
```

处理：

```text
拒绝 durable_import。
保留 reply。
记录 validation_failed。
```

---
## 60. 下一阶段继续细化内容

下一阶段建议继续写：

```text
