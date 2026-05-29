# AUTONOMY RULES

You are allowed to work autonomously.

Do not ask the user for clarification unless there is a hard blocker.

When unsure, choose the safest implementation that preserves future flexibility.

## Hard blockers

Stop and report only if:

1. A real API key or secret is required and no mock path is possible.
2. A destructive operation would delete, overwrite, or reset user data.
3. A dependency cannot be installed.
4. Tests cannot pass after repeated repair attempts.
5. Product requirements directly conflict.
6. The environment prevents starting or validating the app.

## Allowed assumptions

If the AI provider key is missing, implement a mock AI provider and a provider interface.

If a feature requires a future module, create a typed interface and a stub.

If the product document is too broad, follow PHASES.md first.

If there is conflict between older and newer requirements:

1. PHASES.md wins for implementation order.
2. docs/architecture.md wins for architecture.
3. docs/coding-rules.md wins for code rules.
4. docs/mvp-scope.md wins for MVP scope.
5. docs/product-design.md is the product reference.

## Forbidden behavior

Do not put business logic in React components.

Do not let React access SQLite, fs, environment secrets, or Node APIs directly.

Do not hardcode API keys.

Do not implement unrelated features outside the current phase.

Do not skip migrations.

Do not write directly to the database outside repositories.

Do not make AI structured output directly mutate user learning state without validation.

Do not remove user data without explicit confirmation.

## Self-review loop

For every phase:

1. Run typecheck.
2. Run lint if configured.
3. Run tests if configured.
4. Start the app if possible.
5. Review changed files.
6. Fix failures.
7. Repeat until validation passes or a hard blocker occurs.
8. Update PROGRESS.md.
9. Commit changes if git is available and validation passes.

## Git rule

If this is a git repository, after each completed phase:

1. Run validation commands.
2. Update PROGRESS.md.
3. Commit changes with:
   `phase <number>: <summary>`

Do not commit if validation fails.
