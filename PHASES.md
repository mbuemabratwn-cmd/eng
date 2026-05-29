# PHASES

Follow these phases in order. Do not jump ahead.

## Phase 0: Repository audit and setup

Goal:
Prepare the codebase for implementation.

Tasks:
- Inspect existing files.
- Create or update project structure.
- Add docs references.
- Add PROGRESS.md and DECISIONS.md if missing.
- Do not implement product logic yet.

Validation:
- Project structure exists.
- package.json exists or is created.
- PROGRESS.md updated.

---

## Phase 1: Electron + React + TypeScript foundation

Goal:
Create the desktop app foundation.

Tasks:
- Set up Electron main process.
- Set up preload bridge.
- Set up React renderer.
- Set up TypeScript.
- Set up Vite or equivalent build tooling.
- Add basic app window.
- Add placeholder ChatPage.

Validation:
- App starts locally.
- Renderer loads.
- No direct Node access in renderer.
- Typecheck passes.

---

## Phase 2: SQLite, migrations, and repository layer

Goal:
Create local database foundation.

Tasks:
- Add SQLite.
- Add migration runner.
- Create schema_migrations.
- Add initial migrations for:
  - app_settings
  - chat_sessions
  - chat_messages
  - learning_blocks
  - learning_events
  - jobs
  - ai_request_logs
  - prompt_versions
- Add repository layer.
- Repositories are the only layer that writes SQL.

Validation:
- Clean database initializes.
- Migrations run once and are idempotent.
- Typecheck passes.

---

## Phase 3: IPC bridge and chat minimal loop

Goal:
Implement safe renderer-main communication and chat storage.

Tasks:
- Expose safe IPC APIs:
  - chat.sendMessage
  - chat.getMessages
  - learning.getCurrentState
  - settings.get
  - settings.update
- Implement ChatPage.
- Implement MessageList.
- Implement MessageInput.
- Save user message before AI call.
- Save assistant message after response.
- Use mock AI provider if no real API key exists.
- Reload messages after app restart.

Validation:
- User can send message.
- Message persists in SQLite.
- Assistant placeholder response appears.
- Messages reload after restart.
- Typecheck passes.

---

## Phase 4: Job Queue, logging, and failure handling

Goal:
Add long-term reliability foundation.

Tasks:
- Implement jobs table.
- Implement JobQueue service.
- Add ai_request_logs.
- Add basic error logging.
- Add failure behavior:
  - user message remains saved if AI fails
  - AI failure creates log entry
  - failed jobs can be retried
- Add structured error boundaries in renderer.

Validation:
- Failed mock AI request does not delete user message.
- Job can be created, marked running, done, failed.
- Typecheck passes.

---

## Phase 5: Learning State Manager and learning blocks

Goal:
Implement the state foundation for continuous learning.

Tasks:
- Implement Learning State Manager.
- Support:
  - study_day
  - active_chat_session
  - active_learning_block
  - current_learning_task
  - teacher_mode
  - active_task
  - interrupted_task_stack
  - persistence_policy
- Implement learning block start/end.
- Use 4 AM study day boundary.
- Auto-end inactive block after configured timeout.
- Add learning.getCurrentState IPC.

Validation:
- Sending a learning message creates or resumes a learning block.
- Learning state persists or can be reconstructed.
- 4 AM boundary logic is covered by tests if test framework exists.
- Typecheck passes.

---

## Phase 6: Intent Router and action safety

Goal:
Add safe intent classification and destructive action protection.

Tasks:
- Implement rule-based Intent Router.
- Detect:
  - direct_answer_request
  - summary_request
  - stop_or_pause_request
  - mode_switch_request
  - file_with_instruction
  - manual_state_override
  - destructive_action_request
- Implement destructive_action_guard.
- Implement persistence_policy mapping.
- Add unknown_intent fallback.

Validation:
- Strong commands are recognized.
- Destructive commands require confirmation.
- "不要入库" maps to transient_only or message_only.
- Typecheck passes.

---

## Phase 7: AI Orchestrator v0.1 and structured payload

Goal:
Create the AI orchestration pipeline.

Tasks:
- Implement AI Orchestrator as flow coordinator.
- Add Prompt Builder.
- Add Context Retriever.
- Add Context Budget Manager.
- Add Structured Output Parser.
- Add Action Validator.
- Add AI provider interface.
- Use mock provider if no API key.
- Keep AI actions as suggestions only.

Validation:
- User message flows through orchestrator.
- Prompt is built from modules.
- Mock structured_payload is parsed.
- Invalid action is rejected.
- Reply still displays when structured_payload fails.
- Typecheck passes.

---

## Phase 8: Vocabulary schema and VocabularyEngine v0.1

Goal:
Implement vocabulary data foundation.

Tasks:
- Add migrations for:
  - vocabulary_words
  - vocabulary_ai_notes
  - user_word_progress
  - word_review_events
- Add indexes.
- Implement VocabularyRepository.
- Implement VocabularyEngine v0.1:
  - add/import words
  - get word progress
  - record word review
  - apply validated word update suggestion
- Add scores:
  - mastery_score
  - recognition_score
  - recall_score
  - context_score
  - usage_score

Validation:
- Words can be inserted.
- Progress can be created and updated.
- Review event can be recorded.
- AI suggestion does not update progress unless validated.
- Typecheck passes.

---

## Phase 9: Daily Target Pool and Review Load Guardrail

Goal:
Implement daily learning planning foundation.

Tasks:
- Add daily_target_pools table.
- Implement DailyTargetPoolManager.
- Implement ReviewLoadManager v0.1.
- Generate daily target pool on first effective learning action, not app open.
- Default:
  - recommended time: 60 minutes
  - new words: 45-60
  - focused words: 20-25
  - early focus: vocabulary + long sentences
- Reduce new words when review load is high.

Validation:
- App opening alone does not generate target pool.
- First learning action generates target pool.
- Review load can reduce new word count.
- Typecheck passes.

---

## Phase 10: Daily vocabulary theme lesson v0.1

Goal:
Implement the first real learning feature.

Tasks:
- Select daily words.
- Split into focused words and ordinary familiarization words.
- Generate a vocabulary theme plan.
- Show theme and word count, not necessarily full word list.
- Use mock AI if needed.
- Record word_review_events from interactions.
- Update progress only through VocabularyEngine.

Validation:
- User can start daily vocabulary theme lesson.
- A theme plan is created.
- Focused word count is 20-25.
- Word review events are saved.
- Typecheck passes.

---

## Phase 11: Long Sentence Engine v0.1

Goal:
Implement basic long sentence training.

Tasks:
- Add long_sentences.
- Add long_sentence_analysis.
- Add user_sentence_progress.
- Implement SentenceEngine v0.1.
- Support AI-generated sentences marked created_by_ai.
- Record user guess and scores.
- Emit vocabulary/grammar weakness candidates only, not direct updates.

Validation:
- User can start long sentence practice.
- Sentence progress is saved.
- AI-generated content is marked.
- Weakness candidates do not directly mutate unrelated modules.
- Typecheck passes.

---

## Phase 12: Grammar Engine v0.1

Goal:
Implement basic grammar correction tracking.

Tasks:
- Add grammar_error_events.
- Add grammar_issue_summary.
- Implement GrammarEngine v0.1.
- Support serious error immediate correction.
- Support minor error summary candidate.
- Do not interrupt free chat for every minor error.

Validation:
- Grammar error can be recorded.
- Summary can be updated from repeated errors.
- Free chat does not trigger excessive interruption.
- Typecheck passes.

---

## Phase 13: Summary, Memory Engine, and reviews

Goal:
Implement summarization and long-term memory foundation.

Tasks:
- Add daily_summaries.
- Add weekly_reviews.
- Add ai_memory_summary.
- Implement SummaryModule.
- Implement MemoryEngine v0.1.
- Update ai_memory_summary only from evidence.
- Store confidence and evidence_event_ids.
- Avoid permanent labels from one error.

Validation:
- Block summary can be created.
- Daily summary can be created.
- Weekly review can be created.
- Memory update requires evidence.
- Typecheck passes.

---

## Phase 14: File ingestion v0.1

Goal:
Implement safe file upload foundation.

Tasks:
- Add file_records.
- Add file_chunks.
- Add source_links.
- Support txt, csv, md.
- Use file_hash for dedupe.
- Do not process pdf/docx/xlsx yet except as unsupported or placeholder.
- Respect persistence_policy:
  - do not import if user says 不要入库
- Create import jobs through JobQueue.

Validation:
- File record is saved.
- Text file is chunked.
- CSV word import works.
- "不要入库" prevents durable import.
- Typecheck passes.

---

## Phase 15: Backup, migration health, and stability pass

Goal:
Make the app safer for long-term use.

Tasks:
- Implement BackupService.
- Add manual backup command.
- Add automatic backup placeholder or scheduler.
- Add DatabaseHealthService.
- Add PRAGMA integrity_check.
- Ensure migration failures are handled safely.
- Add app startup health check.

Validation:
- Manual backup creates a backup file.
- Health check runs.
- Migration state is visible.
- Typecheck passes.

---

## Phase 16: UX integration and MVP review

Goal:
Connect the MVP into a usable flow.

Tasks:
- Improve ChatPage.
- Add minimal dashboard.
- Show current learning state.
- Show active task status.
- Show basic weekly review page.
- Ensure no complex admin UI.
- Run through realistic usage scenarios.

Validation scenarios:
- First learning action creates daily target pool.
- User starts vocabulary theme lesson.
- User interrupts with grammar question.
- User returns to vocabulary task.
- User asks for direct answer.
- User says summary.
- User uploads csv and imports words.
- User says 不要入库 and import is blocked.
- User restarts app and messages persist.
- Typecheck passes.

---

## Phase 17: Final autonomous review

Goal:
Review the entire MVP and fix issues.

Tasks:
- Read PROGRESS.md.
- Run all validation commands.
- Search for TODOs.
- Check coding rules.
- Check no business logic is in React.
- Check no direct SQLite access in renderer.
- Check destructive actions require confirmation.
- Check user messages are saved before AI calls.
- Fix issues.
- Write final summary.

Validation:
- All available tests pass.
- Typecheck passes.
- App starts.
- PROGRESS.md contains final status.
