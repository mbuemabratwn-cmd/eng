# GOAL

Build the AI English learning desktop app in autonomous phases.

This project is a local-first desktop app for personal postgraduate English learning.

The goal is to implement the product described in:

- docs/product-design.md
- docs/architecture.md
- docs/mvp-scope.md
- docs/coding-rules.md
- docs/ai-contracts.md

Do not attempt to implement everything in one pass.

Follow `PHASES.md` strictly.

For each phase:

1. Read the phase requirements.
2. Implement only the phase scope.
3. Run validation commands.
4. Review your own changes.
5. Fix issues.
6. Repeat until the phase passes.
7. Update PROGRESS.md.
8. Update DECISIONS.md if any implementation decision was made.
9. Commit changes if this is a git repository and validation passes.
10. Move to the next phase.

Stop only if:

1. A required secret is missing.
2. A destructive operation needs user confirmation.
3. Tests cannot pass after reasonable repair attempts.
4. Requirements are contradictory.
5. The environment prevents progress.

Do not stop just because a phase is large. Split it internally into smaller tasks and continue.
