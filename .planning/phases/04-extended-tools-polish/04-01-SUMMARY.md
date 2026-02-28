---
phase: 04-extended-tools-polish
plan: 01
subsystem: api
tags: [zod, typescript, pagination, json-schema, mcp]

# Dependency graph
requires:
  - phase: 03.1-vault-management
    provides: schemas.ts patterns, handler patterns, registry patterns for Phase 4 tools
provides:
  - withExamples() post-processor in schema-utils.ts (JSON Schema 2020-12 per-property examples)
  - encodeCursor/decodeCursor/paginate/PAGE_SIZE cursor pagination utilities in pagination.ts
  - 5 new Zod schemas: ManageTagsSchema, ArchiveNoteSchema, ExtractLinksSchema, GetWeeklyNoteSchema, ListTemplatesSchema
  - cursor field on ListNotesSchema, SearchNotesSchema, SearchTagsSchema
  - Type exports for all 5 new schemas
affects:
  - 04-02 (imports ManageTagsSchema, ArchiveNoteSchema, ExtractLinksSchema, GetWeeklyNoteSchema, ListTemplatesSchema)
  - 04-03 (imports paginate() for list_notes, search_notes, search_tags handlers)
  - 04-04 (imports withExamples() for index.ts registry registrations)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - withExamples() post-processor: zodToJsonSchema output + per-property examples map = JSON Schema 2020-12 annotations without Zod v4
    - offset-based cursor pagination: base64(JSON({offset})) — opaque to clients, server-side slicing, stable for immutable in-memory result sets
    - coerceBool reuse: all boolean fields in new schemas use existing coerceBool for CLI/bash string coercion

key-files:
  created:
    - src/tools/schema-utils.ts
    - src/tools/pagination.ts
    - src/tools/__tests__/schema-utils.test.ts
    - src/tools/__tests__/pagination.test.ts
  modified:
    - src/tools/schemas.ts

key-decisions:
  - "withExamples() spreads property objects (not deep-clone) — safe since zodToJsonSchema returns a new plain object per call"
  - "PAGE_SIZE = 50 hardcoded — configurable later if needed, not worth a config option now"
  - "decodeCursor() returns null (not throws) for invalid cursors; paginate() falls back to offset=0 on null decode"
  - "GetWeeklyNoteSchema adds week_folder and date_format as input params (not VaultConfig fields) — avoids VaultConfig schema change in Plan 01"
  - "schema-utils.ts and pagination.test.ts were pre-written before Plan 01 execution (partial prior work); implemented pagination.ts to pass existing tests"

patterns-established:
  - "Pattern: withExamples(zodToJsonSchema(Schema), { prop: [ex1, ex2] }) at every registry.register() inputSchema call"
  - "Pattern: paginate(allItems, args.cursor) in handler, return { ...payload, nextCursor } in response body"
  - "Pattern: cursor?: z.string().optional() added at end of paginated tool schemas"

requirements-completed: [PLSH-01, PLSH-02, PLSH-03, PLSH-04, XTND-01, XTND-02, XTND-03, XTND-04, XTND-05]

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 4 Plan 01: Foundation Files Summary

**Base64 offset cursor pagination + withExamples() JSON Schema post-processor + 5 Zod schemas for manage_tags, archive_note, extract_links, get_weekly_note, list_templates**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T17:02:00Z
- **Completed:** 2026-02-28T17:04:30Z
- **Tasks:** 3
- **Files modified:** 3 created, 1 modified

## Accomplishments

- `withExamples()` post-processor enables JSON Schema 2020-12 per-property examples on all tool inputSchemas without switching to Zod v4
- `paginate<T>()` with base64 cursor supports offset-based pagination for list_notes, search_notes, search_tags — all results collected server-side then sliced
- 5 new Zod schemas fully typed and exported, ready for handlers in Plan 02 and registry wiring in Plan 04

## Task Commits

Each task was committed atomically:

1. **Task 1: schema-utils.ts (withExamples post-processor)** - `84b5cc3` (feat) — pre-committed before Plan 01 run
2. **Task 2: pagination.ts (cursor pagination utilities)** - `94378f6` (feat)
3. **Task 3: schemas.ts (5 new schemas + cursor fields)** - `25fdd91` (feat)

## Files Created/Modified

- `src/tools/schema-utils.ts` — withExamples() post-processor, spreads property objects to avoid shared-reference mutation
- `src/tools/__tests__/schema-utils.test.ts` — 4 tests: injection, no-mutation, safe no-op, no-properties passthrough
- `src/tools/pagination.ts` — encodeCursor, decodeCursor, paginate<T>, PAGE_SIZE=50
- `src/tools/__tests__/pagination.test.ts` — 7 tests: first page, second page, edge cases, malformed cursor, encode/decode roundtrip
- `src/tools/schemas.ts` — cursor field added to ListNotesSchema/SearchNotesSchema/SearchTagsSchema; 5 new schemas + type exports appended

## Decisions Made

- `withExamples()` uses spread (`{ ...schema.properties[propName], examples }`) not deep-clone — sufficient since `zodToJsonSchema` returns a fresh object per call
- `PAGE_SIZE = 50` hardcoded constant — kept simple per research recommendation; configurable via parameter if needed downstream
- `decodeCursor()` returns `null` on any error (never throws); `paginate()` falls back to `offset=0` on null — graceful degradation for malformed cursors
- `GetWeeklyNoteSchema` includes `week_folder` and `date_format` as input parameters rather than requiring a new `weekly_notes` VaultConfig field — avoids schema migration, consistent with `list_templates`'s `template_folder` pattern

## Deviations from Plan

None - plan executed exactly as written. Task 1 (`schema-utils.ts`) was already committed from prior partial work; tests and implementation matched the plan spec exactly.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (`handlers-extended.ts`): All 5 schemas ready to import — ManageTagsInput, ArchiveNoteInput, ExtractLinksInput, GetWeeklyNoteInput, ListTemplatesInput all exported
- Plan 03 (pagination wiring): `paginate()` and `decodeCursor()` ready to import in handlers.ts for list_notes/search_notes/search_tags
- Plan 04 (registry + examples): `withExamples()` ready to wrap all `zodToJsonSchema()` calls in index.ts
- 164 tests passing, TypeScript clean, no regressions

---
*Phase: 04-extended-tools-polish*
*Completed: 2026-02-28*
