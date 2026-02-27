---
phase: 01-quality-foundation
plan: "03"
subsystem: tools
tags: [mcp-spec, output-schema, annotations, tool-definitions, mcp-2025-11-25]

# Dependency graph
requires:
  - phase: 01-01
    provides: ToolAnnotations type in src/types/index.ts, tsc working with bundler moduleResolution
  - phase: 01-02
    provides: bug-free handler return shapes (get_daily_note path field, frontmatter serialization)
provides:
  - ToolDefinition interface extended with optional outputSchema and annotations fields
  - All 13 tool definitions with outputSchema (type:object, required fields, error property)
  - All 13 tool definitions with annotations (all 4 hint fields per MCP 2025-11-25 spec)
affects:
  - 01-04
  - 01-05

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "outputSchema at root must be type:object — never array or primitive at top level"
    - "Include error:string in every outputSchema as defense-in-depth (even though isError:true skips validation in SDK 1.27.1)"
    - "Annotations truth table: readOnly=true only for pure reads; destructive=true for delete/move; openWorld=true only for open_in_obsidian"

key-files:
  created: []
  modified:
    - src/tools/index.ts

key-decisions:
  - "outputSchema type must be literal 'object' string (not TypeScript type) — ToolDefinition interface uses type: 'object' literal in the shape"
  - "error property included in all 13 outputSchemas per isError defense-in-depth decision from pre-phase planning"
  - "move_note is destructive=true because it removes the source file (even though a copy exists at target)"
  - "get_daily_note idempotent=false because it creates a new file on first call for a given date (side effect on initial call)"
  - "open_in_obsidian openWorld=true because it launches an external application process"

patterns-established:
  - "outputSchema shape: always type:object at root, properties matching actual handler return fields, required array listing guaranteed fields, error:string in every schema"
  - "Annotations accuracy: derive from tool semantics — reads are readOnly:true, writes/creates are readOnly:false, moves/deletes are destructive:true, idempotent only if identical repeated calls produce no state change"

requirements-completed: [SPEC-01, SPEC-03]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 01 Plan 03: outputSchema + annotations for All 13 Tool Definitions Summary

**MCP 2025-11-25 spec compliance: all 13 tool definitions annotated with typed outputSchema (type:object, required fields, error defense) and 4-field annotations (readOnly, destructive, idempotent, openWorld)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T15:58:00Z
- **Completed:** 2026-02-27T16:00:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Extended `ToolDefinition` interface in `src/tools/index.ts` with optional `outputSchema?` and `annotations?` fields
- Added `ToolAnnotations` import from `../types/index.js` (type added in Plan 01-01)
- Added `outputSchema` to all 13 tool definitions: `type: 'object'` at root, properties matching actual handler return shapes, `required` array, `error: string` in every schema
- Added `annotations` to all 13 tool definitions with all 4 fields: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- `tsc --noEmit` passes (0 errors); all 78 vitest tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ToolDefinition and add outputSchema + annotations to all 13 tools** - `6ce1049` (feat)

**Plan metadata:** (assigned after SUMMARY commit)

## Files Created/Modified
- `src/tools/index.ts` — ToolAnnotations import added; ToolDefinition interface extended with outputSchema? and annotations?; all 13 tool definitions annotated (194 lines added, 14 deleted)

## get_daily_note outputSchema (BUG-04 context)

The `get_daily_note` outputSchema reflects the BUG-04 fix from Plan 02 where the path field was normalized:

```typescript
outputSchema: {
  type: 'object',
  properties: {
    path: { type: 'string' },      // normalized — was notePath before BUG-04
    created: { type: 'boolean' },
    frontmatter: { type: 'object' },
    content: { type: 'string' },
    links: { type: 'array', items: { type: 'object' } },
    metadata: { type: 'object' },
    error: { type: 'string' }
  },
  required: ['path', 'created']
}
```

Both the `existing note` and `newly created` branches now return `path` (not `notePath`), so the outputSchema required field `path` is always guaranteed.

## Decisions Made
- `ToolAnnotations` type was already available in `src/types/index.ts` from Plan 01-01 — no new type work needed
- `outputSchema` shape used object literal type in the interface: `type: 'object'` as a TypeScript string literal type to enforce correct JSON Schema root type
- All 13 schemas include `error: { type: 'string' }` even though `isError: true` responses skip validation in SDK 1.27.1 — this is the defense-in-depth decision from pre-phase planning

## Deviations from Plan

None - plan executed exactly as written. The `ToolDefinition` interface and all 13 tool definitions were already partially in place from a prior execution; verification confirmed they matched the plan spec exactly.

## Issues Encountered
- None. The file already contained the complete implementation from a prior run of this plan. `tsc --noEmit` and `vitest --run` both passed with zero errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 13 tools now declare their output contract via `outputSchema`
- All 13 tools declare behavioral hints via `annotations` — clients can apply safety checks before destructive operations
- Plan 04 can now implement matching `structuredContent` in handler success responses (the `outputSchema` declarations define what shape `structuredContent` must return)
- Plan 05 integration tests can verify both `outputSchema` presence and `annotations` accuracy

---
*Phase: 01-quality-foundation*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/tools/index.ts
- FOUND commit: 6ce1049 (Task 1 — feat(01-03): extend ToolDefinition with outputSchema and annotations for all 13 tools)
- outputSchema count in src/tools/index.ts: 13 tool definitions + 1 interface field = 14 total — PASS
- annotations count in src/tools/index.ts: 13 tool definitions + 1 interface field = 14 total — PASS
- tsc --noEmit: exits 0 — PASS
- vitest --run: 78/78 passed — PASS
- ToolDefinition interface has outputSchema? (line 56) — PASS
- ToolDefinition interface has annotations? (line 61) — PASS
- get_daily_note outputSchema required: ['path', 'created'] — PASS (path field normalized in BUG-04)
