---
phase: 04-extended-tools-polish
plan: 02
subsystem: tools
tags: [handlers, tags, archive, links, weekly-notes, templates, vitest]

requires:
  - phase: 04-01
    provides: ManageTagsSchema, ArchiveNoteSchema, ExtractLinksSchema, GetWeeklyNoteSchema, ListTemplatesSchema in schemas.ts
provides:
  - handlers-extended.ts with 5 production-ready handlers (handleManageTags, handleArchiveNote, handleExtractLinks, handleGetWeeklyNote, handleListTemplates)
  - 14 integration tests covering success and failure paths for all 5 handlers
affects:
  - 04-03 (tool registration in index.ts needs these handlers)
  - 04-04 (any further polish or final integration)

tech-stack:
  added: []
  patterns:
    - Native ISO week computation using Thursday-based algorithm (no dayjs isoWeek plugin)
    - Sequential for...of loops for multi-note operations (safe for large vaults)
    - Partial success pattern for batch operations (per-note results, not abort-on-error)
    - ENOENT catch-and-return-empty for optional folders (list_templates)

key-files:
  created:
    - src/tools/handlers-extended.ts
    - src/tools/__tests__/handlers-extended.test.ts
  modified: []

key-decisions:
  - "native ISO week computation instead of dayjs isoWeek plugin — dayjs().format('YYYY-[W]WW') produces literal 'WWW', not the ISO week number; native Date math gives correct YYYY-Www output"
  - "moveNote called as moveNote(vault.path, sourcePath, targetPath) — the actual vault-writer.ts signature is 3-arg, not the 2-absolute-path form described in the plan"
  - "handleListTemplates ENOENT: listNotes internally swallows ENOENT (returns empty array); catching thrown ENOENT from above enables the intended empty-list-not-error behavior"
  - "handleManageTags uses sequential for...of loop per plan guidance — avoids concurrent fs operations on multi-note batch"

patterns-established:
  - "Partial success pattern: batch handlers accumulate results per item rather than aborting on first failure"
  - "Vault helper: getVault(config, vaultName?) throws on missing vault, try/catch at handler level converts to createErrorResponse"

requirements-completed: [XTND-01, XTND-02, XTND-03, XTND-04, XTND-05]

duration: 5min
completed: 2026-02-28
---

# Phase 4 Plan 02: Extended Tool Handlers Summary

**5 new tool handlers (manage_tags, archive_note, extract_links, get_weekly_note, list_templates) with 14 integration tests covering partial success, ENOENT empty-list, and all error paths**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T23:06:00Z
- **Completed:** 2026-02-28T23:10:21Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- handleManageTags: add/remove tags on multiple notes with partial success — invalid paths recorded in results, not abort
- handleArchiveNote: move note to archive folder with ENOENT check, collision guard, and optional archived_date frontmatter
- handleExtractLinks: regex-based extraction of wikilinks, embeds, markdown links, and bare external URLs with line numbers
- handleGetWeeklyNote: get-or-create weekly note by ISO week string using native Thursday-based ISO 8601 week computation
- handleListTemplates: lists notes in templates folder; returns empty list (not error) when folder missing
- 14 integration tests: all passing, full suite 186 tests passing with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement handlers-extended.ts (5 handlers)** - `3fa08de` (feat — committed by parallel 04-03 agent which picked up the untracked file)
2. **Task 2: Write integration tests for all 5 handlers** - `5769c59` (test)

## Files Created/Modified

- `src/tools/handlers-extended.ts` - 5 new tool handlers exported as named async functions
- `src/tools/__tests__/handlers-extended.test.ts` - 14 integration tests with vi.mock for vault-reader, vault-writer, link-graph

## Decisions Made

- **Native ISO week computation:** `dayjs().format('YYYY-[W]WW')` produces the literal string `2026-WWW` because `W` is not a special dayjs token. Implemented native `currentISOWeek()` using Thursday-based ISO 8601 algorithm instead.
- **moveNote signature:** Actual signature is `moveNote(vaultPath, sourcePath, targetPath)` — 3 args with relative paths. Plan described 2 absolute paths. Used correct implementation.
- **ENOENT in handleListTemplates:** `listNotes` internally catches ENOENT and returns an empty array; the handler catches thrown ENOENT from the `listNotes` call to surface the informational note field.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed moveNote call signature**
- **Found during:** Task 1 (handleArchiveNote implementation)
- **Issue:** Plan described `fsMoveNote(absoluteSrc, absoluteTarget)` (2 absolute paths). Actual vault-writer.ts signature is `moveNote(vaultPath, sourcePath, targetPath)` (3 args with relative paths).
- **Fix:** Used `moveNote(vault.path, notePath, archivePath)` with relative source and archive paths.
- **Files modified:** src/tools/handlers-extended.ts
- **Verification:** TypeScript compiled clean; archive note test passes
- **Committed in:** 3fa08de

**2. [Rule 1 - Bug] Replaced dayjs ISO week format with native computation**
- **Found during:** Task 1 (handleGetWeeklyNote implementation)
- **Issue:** `dayjs().format('YYYY-[W]WW')` returns `2026-WWW` (literal W characters), not ISO week `2026-W09`. dayjs requires the `isoWeek` plugin for actual ISO week numbers which is not installed.
- **Fix:** Implemented `currentISOWeek()` using native Date mathematics (Thursday-based ISO 8601 algorithm).
- **Files modified:** src/tools/handlers-extended.ts
- **Verification:** Node.js test confirmed output `2026-W09`; weekly note tests pass
- **Committed in:** 3fa08de

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both auto-fixes required for correctness. No scope creep.

## Issues Encountered

- Parallel agent (04-03) committed `handlers-extended.ts` as part of its own pagination commit (`3fa08de`) before Task 1's explicit commit could be recorded. The file content was identical — no functional impact. Task 2 (tests) committed cleanly as `5769c59`.

## Next Phase Readiness

- handlers-extended.ts exports all 5 handlers ready for registration in src/index.ts or a registry builder
- All 5 handlers follow the established ToolResponse pattern and are TypeScript-clean
- 186 tests passing; no regressions in existing functionality

## Self-Check: PASSED

- FOUND: src/tools/handlers-extended.ts
- FOUND: src/tools/__tests__/handlers-extended.test.ts
- FOUND: .planning/phases/04-extended-tools-polish/04-02-SUMMARY.md
- FOUND commit: 3fa08de (handlers-extended.ts — committed with parallel 04-03 agent)
- FOUND commit: 5769c59 (handlers-extended.test.ts — 14 tests)

---
*Phase: 04-extended-tools-polish*
*Completed: 2026-02-28*
