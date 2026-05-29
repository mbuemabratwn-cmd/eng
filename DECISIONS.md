# DECISIONS

## 2026-05-21 - Build tooling: electron-vite

Decision: Use electron-vite as the build tooling for the Electron + React + TypeScript project.

Reason: electron-vite provides integrated dev/build tooling for Electron with Vite, supporting main/preload/renderer separation out of the box. It handles HMR for renderer and proper bundling for main/preload processes.

Alternatives considered: Manual webpack config, electron-builder alone, electron-forge with Vite plugin.

Impact: Single config file (electron.vite.config.ts) manages all three process builds. Dependencies: electron-vite, @vitejs/plugin-react, vite.

## 2026-05-21 - Database: better-sqlite3

Decision: Use better-sqlite3 for SQLite access.

Reason: Synchronous API is simpler for a desktop app. Well-maintained, good TypeScript support, fast. Architecture requires repositories as the only SQL-writing layer, so a straightforward synchronous driver is ideal.

Alternatives considered: sql.js (wasm-based), knex (query builder), drizzle ORM.

Impact: Direct synchronous SQLite access in main process only. All SQL goes through repository layer.

## 2026-05-21 - TypeScript config: separate configs for node and web

Decision: Use three tsconfig files: base tsconfig.json, tsconfig.node.json (main+preload), tsconfig.web.json (renderer).

Reason: Electron main/preload run in Node.js context while renderer runs in browser context. Different lib and target settings needed.

Alternatives considered: Single tsconfig with conditional flags.

Impact: typecheck:main and typecheck:renderer scripts can validate each context independently.

## 2026-05-21 - Learning state: in-memory state manager with event-driven transitions

Decision: Use an in-memory LearningStateManager with event-driven state transitions, backed by learning_blocks and learning_events tables for persistence.

Reason: The learning state has multiple axes (study_day, task, teacher_mode, active_task, interrupted_task_stack, persistence_policy) that change frequently during a session. An in-memory state machine with transition() is simpler and faster than round-tripping to SQLite on every state change. Block/event data persists to SQLite for durability across restarts.

Alternatives considered: Full SQLite-backed state with reads on every access, Redux-like state container.

Impact: State is lost on app restart but can be reconstructed from the most recent active block. Block timeout (45 min) prevents stale blocks. 4 AM study day boundary resets daily state naturally.

## 2026-05-21 - Frontend style: Structured Tutor Workspace with Apple-like Semantic Color

Decision: Use a structured tutor workspace design with Apple-like semantic color principles for the frontend UI.

Reason: The app is a serious long-term AI English learning workspace that needs to feel calm and focused but not boring. Apple-like semantic color provides clear mode differentiation (green for vocabulary, blue for review, indigo for long sentences, coral for grammar, purple for summary) while maintaining a polished, content-first layout. Chat-first interaction model with lightweight status panel and minimal card usage.

Alternatives considered: Plain neutral design, gamified vocabulary app style, SaaS dashboard style, glassmorphism-heavy design.

Impact: docs/frontend-guidelines.md created with comprehensive design spec. Implementation will use Tailwind CSS for tokens/layout, Radix UI or React Aria for accessibility primitives. No large UI libraries. Future frontend phases should reference this document.
