# Codex Build Docs

This folder contains Codex-ready documents for building the AI English learning desktop app.

## Recommended usage

In Codex CLI, run from the project root:

```text
/goal Read GOAL.md, PHASES.md, AUTONOMY_RULES.md, docs/coding-rules.md, docs/architecture.md, and docs/product-design.md. Execute PHASES.md from Phase 0 to Phase 17 autonomously. For each phase, implement only the phase scope, run validation, self-review, fix failures, update PROGRESS.md and DECISIONS.md, then continue to the next phase. Do not ask me for input unless there is a hard blocker, missing secret, destructive operation, dependency failure, or contradictory requirement. If no real AI API key is available, use a mock AI provider and continue. Stop only when all phases are completed or a hard blocker is documented.
```

## File guide

- `GOAL.md` — overall autonomous goal.
- `PHASES.md` — phased implementation plan.
- `AUTONOMY_RULES.md` — rules for working without user input.
- `PLAN.md` — short execution guide.
- `PROGRESS.md` — progress log template.
- `DECISIONS.md` — implementation decision log.
- `docs/product-design.md` — human-facing product reference.
- `docs/architecture.md` — architecture reference.
- `docs/mvp-scope.md` — frozen MVP scope.
- `docs/coding-rules.md` — implementation rules.
- `docs/ai-contracts.md` — AI structured output and validation contract.
- `docs/source-full-design.md` — original full fixed design doc for reference.

## Priority order if documents conflict

1. `PHASES.md` for implementation order.
2. `docs/coding-rules.md` for code rules.
3. `docs/mvp-scope.md` for MVP scope.
4. `docs/architecture.md` for architecture.
5. `docs/ai-contracts.md` for AI behavior contracts.
6. `docs/product-design.md` for product intent.
7. `docs/source-full-design.md` for background only.
