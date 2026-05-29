# MVP Scope

This document freezes the implementation scope for the autonomous Codex build.

## Product target

Build a local-first desktop app for personal postgraduate English learning.

The app should behave like a persistent AI English teacher:

- PC desktop app.
- Chat-first interface.
- AI-guided learning.
- Local SQLite memory.
- Daily target pool.
- Learning blocks.
- Vocabulary theme lessons.
- Long sentence practice.
- Basic grammar correction.
- Daily summaries and weekly reviews.

## MVP must implement

### Foundation

- Electron + React + TypeScript + Vite.
- Main / preload / renderer separation.
- Secure IPC bridge.
- SQLite database.
- Migration system.
- Repository layer.
- Job Queue skeleton.
- AI provider interface with mock provider fallback.
- AI request logging.
- Basic backup / database health foundation.

### Chat

- ChatPage.
- MessageList.
- MessageInput.
- Streaming or simulated streaming assistant reply.
- User message saved before AI call.
- Assistant message saved after response.
- Messages reload after app restart.
- No direct database access from renderer.

### Learning state

- Learning State Manager.
- `study_day` with 4 AM boundary.
- `chat_session`.
- `learning_block`.
- `current_learning_task`.
- `teacher_mode`.
- `active_task`.
- one-level `interrupted_task_stack`.
- `persistence_policy`.

### Daily target pool

- Generated on first effective learning action, not app open.
- Default recommendation:
  - 60 minutes.
  - 45-60 new words.
  - 20-25 focused words.
  - early focus: vocabulary + long sentences.
- Can be adjusted by user input.
- Must respect Review Load Guardrail.

### Vocabulary

- `vocabulary_words`.
- `vocabulary_ai_notes`.
- `user_word_progress`.
- `word_review_events`.
- `mastery_score`.
- `recognition_score`.
- `recall_score`.
- `context_score`.
- `usage_score`.
- VocabularyEngine v0.1.
- Daily vocabulary theme lesson v0.1.

### Long sentence

- `long_sentences`.
- `long_sentence_analysis`.
- `user_sentence_progress`.
- SentenceEngine v0.1.
- AI-generated content marked `created_by_ai`.
- Weakness candidates emitted but not directly applied across modules.

### Grammar

- `grammar_error_events`.
- `grammar_issue_summary`.
- GrammarEngine v0.1.
- Serious errors can be corrected immediately.
- Minor errors can be summarized later.

### Memory and summaries

- `learning_events`.
- `ai_memory_summary`.
- `daily_summaries`.
- `weekly_reviews`.
- SummaryModule v0.1.
- MemoryEngine v0.1.
- Memory update requires evidence.
- Do not create permanent labels from one error.

### Files

- `file_records`.
- `file_chunks`.
- `source_links`.
- txt / csv / md support.
- CSV vocabulary import.
- Respect `persistence_policy`.
- Do not process PDF / DOCX / XLSX in v0.1 beyond placeholder rejection or TODO.

### Safety and reliability

- Database migration.
- Key indexes.
- `ai_request_logs`.
- Prompt version table.
- Destructive action confirmation.
- Structured payload validation.
- Fallback if structured payload parsing fails.
- User data must not be deleted without confirmation.

## MVP must not implement yet

- Full commercial product.
- Multi-user accounts.
- Cloud sync.
- Mobile app.
- Voice input.
- Speech synthesis.
- Full作文批改系统.
- Full真题题库系统.
- Multi-agent architecture.
- Local LLM.
- Complex charts.
- PDF / DOCX / XLSX high-quality parsing.
- Full FSRS implementation.
- Embedding / semantic search.

## Key default values

- Daily new words: 45-60.
- Focused words: 20-25.
- Recommended time: 60 minutes.
- Study day boundary: 4 AM.
- Learning block timeout: 45 minutes of no effective learning interaction.
- Early default focus: vocabulary + long sentence.

## Trigger rules

- Daily target pool is triggered by first effective learning action.
- App open alone must not generate the daily target pool.
- "+" menu is upload-only in v0.1.
- Learning mode is triggered by natural language or slash commands.
- Settings is not inside "+" menu.

## Success definition

The app is a usable v0.1 if:

1. It starts as a desktop app.
2. Chat works and persists.
3. SQLite migrations work.
4. User messages are saved before AI calls.
5. Mock AI provider can run without API key.
6. Daily target pool can be generated.
7. Learning block can start/end.
8. Vocabulary words can be imported and reviewed.
9. A vocabulary theme lesson can run.
10. Long sentence practice can run.
11. Grammar error events can be recorded.
12. Summary and memory candidates can be generated.
13. Structured payload is validated before state updates.
14. Destructive actions require confirmation.
15. Typecheck passes.
