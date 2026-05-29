# Coding Rules

These rules override convenience. Follow them even if a shortcut seems faster.

## Layering

1. React renderer must be UI-only.
2. React renderer must not access SQLite, fs, environment secrets, or Node APIs directly.
3. Local capabilities must go through preload IPC APIs.
4. Electron main process owns:
   - SQLite
   - file system
   - AI calls
   - background jobs
   - migrations
   - backups
5. Business logic must live in services, managers, engines, or repositories.
6. Repositories are the only layer that writes SQL.

## Database

1. All schema changes must go through migrations.
2. Do not manually mutate schema outside migrations.
3. User messages must be saved before any AI call.
4. AI failure must not delete or modify saved user messages.
5. Multi-table updates must use transactions.
6. Current state tables must be traceable to event tables.
7. Add indexes for long-term use.
8. Do not do full-table scans for normal chat or AI context retrieval.

## AI

1. AI replies are not the source of truth.
2. AI can suggest updates, but engines validate updates.
3. `structured_payload` must be validated before any action.
4. If parsing fails, show the reply but do not update learning state.
5. Use mock AI provider if no real API key is available.
6. Do not hardcode API keys.
7. Record AI request logs.
8. Prompt templates should be versioned.
9. Context must be budgeted and trimmed.

## State

1. Learning State Manager is the only owner of current learning state.
2. Other modules cannot directly mutate global learning state.
3. Use `StateManager.transition(event)` for state changes.
4. Use `persistence_policy` to control what can be saved.
5. Respect user instructions like "不要入库", "只讲一下", and "直接告诉我".

## Safety

1. Destructive actions require explicit confirmation.
2. Examples of destructive actions:
   - delete
   - clear
   - reset
   - overwrite
   - mark_all
   - import_replace
   - restore_backup
3. Before destructive actions, create a backup where possible.
4. Unknown intent defaults to safe behavior:
   - answer current question if possible
   - do not import
   - do not delete
   - do not bulk update
   - ask a specific clarification only if necessary

## UI

1. Chat messages must be paginated or virtualized.
2. Do not render entire history at once.
3. Long Markdown replies should be lazy-rendered or collapsible if needed.
4. Keep dashboard minimal.
5. Do not build complex admin UI in MVP.

## Jobs

1. Long-running tasks must go through Job Queue.
2. Jobs must be retryable.
3. Jobs should be idempotent where possible.
4. Same resource should not have conflicting concurrent jobs.
5. Use `resource_key`, unique keys, or locks where needed.

## File handling

1. v0.1 supports txt, csv, md.
2. PDF, DOCX, XLSX should be placeholders or unsupported in v0.1.
3. Large files must be chunked.
4. Do not put entire large files into AI prompt.
5. Use `file_hash` for dedupe.

## Testing and validation

For every phase:

1. Run typecheck.
2. Run lint if configured.
3. Run tests if configured.
4. Start app if possible.
5. Update PROGRESS.md.
6. Commit if git is available and validation passes.
