# PLAN

This file is a short execution guide for Codex.

For complete phase definitions, use `PHASES.md`.

## Execution order

1. Read `GOAL.md`.
2. Read `AUTONOMY_RULES.md`.
3. Read `docs/coding-rules.md`.
4. Read `docs/mvp-scope.md`.
5. Read `docs/architecture.md`.
6. Use `docs/product-design.md` as product reference.
7. Follow `PHASES.md` phase by phase.

## Do not

- Do not implement the whole product in one pass.
- Do not ask the user for normal implementation choices.
- Do not skip validation.
- Do not skip PROGRESS.md updates.
- Do not skip migrations.
- Do not put business logic in React.

## Phase loop

For each phase:

1. Read phase.
2. Implement phase scope.
3. Run validation.
4. Self-review.
5. Fix failures.
6. Update PROGRESS.md.
7. Update DECISIONS.md if needed.
8. Commit if git is available and validation passes.
9. Continue.

## Final result

At the end, the MVP should be locally runnable and have:

- desktop app shell
- chat persistence
- SQLite migrations
- learning state
- daily target pool
- vocabulary engine v0.1
- long sentence engine v0.1
- grammar engine v0.1
- summaries and memory v0.1
- safe file ingestion v0.1
- backup and health foundation
