---
phase: 01-quality-foundation
plan: "02"
subsystem: tools
tags: [rate-limiter, process-spawner, frontmatter, gray-matter, handlers, bug-fix]

# Dependency graph
requires:
  - phase: 01-01
    provides: tsc working, SDK upgraded, type extensions in place
provides:
  - Module-level RateLimitManager singleton persisting across tool calls
  - fs.existsSync-based Obsidian executable detection for native Windows and Linux
  - LOCALAPPDATA-based Squirrel install path for Windows user-scoped installs
  - matter.stringify-compatible frontmatter serialization via stringifyMarkdown
  - Consistent path field (not notePath) in all get_daily_note response branches
affects:
  - 01-03
  - 01-04
  - 01-05

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level singleton pattern for rate limiter: let _rateLimiter at module scope, lazy-init in getRateLimiter()"
    - "Filesystem-first exe detection: existsSync for absolute paths, 'which' only for bare command names"
    - "Frontmatter serialization: always use stringifyMarkdown (matter.stringify) — never manual JSON interpolation"

key-files:
  created: []
  modified:
    - src/tools/index.ts
    - src/platform/process-spawner.ts
    - src/tools/handlers.ts
    - src/tools/handlers2.ts

key-decisions:
  - "BUG-01 was already fixed before plan execution — _rateLimiter singleton already at module scope in index.ts; confirmed no new RateLimitManager inside handleToolCall"
  - "BUG-02: replaced execa('which', [candidate]) with existsSync(candidate) for absolute paths; 'which' is a PATH lookup, not a filesystem check — wrong tool for absolute paths"
  - "BUG-02: LOCALAPPDATA-based Squirrel path added as first candidate (most common Windows install); /snap/bin/obsidian added for Linux"
  - "BUG-03: stringifyMarkdown from markdown-parser.ts used (preferred over direct matter.stringify import — reuses existing utility)"
  - "BUG-04: spread ...note before explicit path: notePath override to avoid TS2783 duplicate key error; note.path and notePath are the same value so field order is semantically equivalent"

patterns-established:
  - "Singleton pattern for stateful managers: module-level variable, lazy init function, never construct inside handler"
  - "Executable detection: existsSync for absolute paths, 'which' only for bare names in non-Windows/non-WSL environments"
  - "Frontmatter write path: always use stringifyMarkdown — never build YAML via template literals or JSON.stringify"

requirements-completed: [BUG-01, BUG-02, BUG-03, BUG-04]

# Metrics
duration: 7min
completed: 2026-02-27
---

# Phase 01 Plan 02: Bug Fixes — Rate Limiter, Windows Exe Detection, Frontmatter, Daily Note Path Summary

**Four production bugs fixed: rate limiter singleton confirmed, Windows Obsidian exe detection using existsSync, frontmatter via stringifyMarkdown, and get_daily_note path field normalized**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-27T15:54:56Z
- **Completed:** 2026-02-27T16:02:00Z
- **Tasks:** 2
- **Files modified:** 3 (process-spawner.ts, handlers.ts, handlers2.ts)

## Accomplishments
- BUG-01: Rate limiter singleton already in place — confirmed module-level `_rateLimiter` with `getRateLimiter()` lazy init; no inline `new RateLimitManager()` inside `handleToolCall`
- BUG-02: Replaced `execa('which', [candidate])` with `existsSync(candidate)` in process-spawner.ts; added LOCALAPPDATA Squirrel path, `/snap/bin/obsidian`, and bare-command fallback for non-Windows
- BUG-03: Replaced manual template literal frontmatter interpolation with `stringifyMarkdown()` from existing markdown-parser utility
- BUG-04: Changed `notePath: notePath` to `path: notePath` in get_daily_note existing-note branch; restructured spread to avoid TS2783 duplicate key error

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix rate limiter singleton (BUG-01) and Windows executable detection (BUG-02)** - `6ca1ff5` (fix)
2. **Task 2: Fix frontmatter serialization (BUG-03) and get_daily_note path field (BUG-04)** - `8f1ddaf` (fix)

**Plan metadata:** (pending — final commit hash assigned after SUMMARY commit)

## Files Created/Modified
- `src/tools/index.ts` - Confirmed: module-level `_rateLimiter` singleton, `getRateLimiter()` used in `handleToolCall` (no changes needed)
- `src/platform/process-spawner.ts` - `existsSync(candidate)` replaces `execa('which', [candidate])`; LOCALAPPDATA path added; `/snap/bin/obsidian` added; bare-command fallback block added
- `src/tools/handlers.ts` - `stringifyMarkdown` import added; `fullContent` assignment updated to use `stringifyMarkdown({ frontmatter, content })`
- `src/tools/handlers2.ts` - `path: notePath` (was `notePath: notePath`) in existing-note branch; spread order restructured to `{...note, path: notePath, created: false}`

## Decisions Made
- BUG-01 was already fixed in plan 01-01 or pre-existing — the singleton pattern was already correct. No code change required for this bug.
- For BUG-04, the `note` object from `readNote()` already contains a `path` field equal to `notePath`. Spreading `...note` first then overriding `path: notePath` explicitly avoids TypeScript TS2783 "specified more than once" error while producing semantically identical JSON output.
- Used `stringifyMarkdown` (existing utility) over direct `matter.stringify` import for BUG-03 — reuses the established utility rather than duplicating logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS2783 duplicate key error in handlers2.ts**
- **Found during:** Task 2 (BUG-04 fix)
- **Issue:** Initial fix put `path: notePath` before `...note` spread; `note.path` also exists so TypeScript reported TS2783 "specified more than once"
- **Fix:** Restructured object literal: spread `...note` first, then override `path: notePath` and `created: false` after; TypeScript accepts last-wins override when spread comes first
- **Files modified:** src/tools/handlers2.ts
- **Verification:** `tsc --noEmit` passes, all 78 tests pass
- **Committed in:** `8f1ddaf` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — type error from duplicate key)
**Impact on plan:** Minor restructuring of object literal. Output is semantically identical. No scope creep.

## Issues Encountered
- BUG-01 was already fixed before plan execution (likely applied during plan 01-01 or pre-existing from repository state). Verification confirmed the singleton pattern was correct; no code change was required.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four active production bugs resolved
- Rate limiting is now functional (singleton persists across calls)
- `open_in_obsidian` will correctly detect Obsidian on native Windows (LOCALAPPDATA path, existsSync check)
- `create_note` API path produces valid YAML frontmatter for dates, arrays, and nested objects
- `get_daily_note` returns consistent `path` field in both existing and created branches
- Ready for Plan 03 (test coverage for fixed bugs)

---
*Phase: 01-quality-foundation*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/tools/index.ts
- FOUND: src/platform/process-spawner.ts
- FOUND: src/tools/handlers.ts
- FOUND: src/tools/handlers2.ts
- FOUND: .planning/phases/01-quality-foundation/01-02-SUMMARY.md
- FOUND commit: 6ca1ff5 (Task 1)
- FOUND commit: 8f1ddaf (Task 2)
- Criteria 1: `new RateLimitManager` only inside `getRateLimiter` (line 44) — PASS
- Criteria 2: `existsSync` used in process-spawner.ts (lines 4, 98) — PASS
- Criteria 3: no `which [candidate]` pattern — PASS
- Criteria 4: no `notePath:` in handlers2.ts — PASS
- Criteria 5: `stringifyMarkdown` present in handlers.ts (lines 9, 142) — PASS
