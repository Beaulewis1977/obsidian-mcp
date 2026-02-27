---
phase: 01-quality-foundation
plan: "01"
subsystem: api
tags: [mcp-sdk, typescript, zod, tsconfig, types]

# Dependency graph
requires: []
provides:
  - "@modelcontextprotocol/sdk@1.27.1 installed and type-verified"
  - "ToolAnnotations interface (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)"
  - "ServerConfig.lazy_loading and ServerConfig.always_loaded_tools optional fields"
  - "ToolResponse inherits structuredContent from CallToolResult (SDK 1.27.1)"
  - "Accurate API_REFERENCE.md: search_notes defaults to filesystem backend"
  - "Documented write-path exceptions: move_note, update_frontmatter, create_folder are filesystem-only"
affects:
  - "02-quality-foundation"  # tool annotations used in plan 03 (ToolDefinition extension)
  - "03-quality-foundation"  # lazy_loading/always_loaded_tools used in Phase 3
  - "all-plans"              # tsc compilation fix affects all subsequent type checks

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "moduleResolution: bundler — required for MCP SDK 1.27.1 types.d.ts (zod/v4 imports)"
    - "lint script uses node --max-old-space-size=16384 for tsc (MCP SDK types memory requirement)"

key-files:
  created: []
  modified:
    - "package.json"
    - "tsconfig.json"
    - "src/types/index.ts"
    - "docs/API_REFERENCE.md"

key-decisions:
  - "moduleResolution changed from 'node' to 'bundler': MCP SDK 1.27.1 types.d.ts imports zod/v4 with ExpandRecursively<T> recursive types; 'node' resolution caused TypeScript OOM; 'bundler' resolves exports field correctly and completes in <1 second"
  - "lint script uses node --max-old-space-size=16384 ./node_modules/typescript/bin/tsc: avoids npx overhead and sets memory for reliable compilation"
  - "ToolResponse = CallToolResult kept as-is: structuredContent is automatically available via SDK 1.27.1's CallToolResult type (no manual augmentation needed)"
  - "ToolAnnotations placed after ToolInfo interface: logical grouping with related tool type definitions"

patterns-established:
  - "All MCP type extensions go in src/types/index.ts (not in src/tools/index.ts)"
  - "SDK type aliases (ToolResponse = CallToolResult) kept minimal — rely on SDK for spec compliance"

requirements-completed: [SDK-01, SPEC-04, SPEC-05]

# Metrics
duration: 35min
completed: 2026-02-27
---

# Phase 1 Plan 01: SDK Upgrade and Type Extensions Summary

**MCP SDK upgraded to 1.27.1 with ToolAnnotations (4 hint fields), ServerConfig lazy-loading fields, and corrected API documentation for filesystem-default search and write-path exceptions**

## Performance

- **Duration:** 35 min
- **Started:** 2026-02-27T15:15:29Z
- **Completed:** 2026-02-27T15:50:42Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments

- SDK `@modelcontextprotocol/sdk@1.27.1` verified installed; TypeScript compilation fixed and passing (exit 0, <1s)
- `ToolAnnotations` interface exported from `src/types/index.ts` with `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` fields (MCP 2025-11-25 spec)
- `ServerConfig` extended with `lazy_loading?: boolean` and `always_loaded_tools?: string[]` (Phase 3 foundation)
- `docs/API_REFERENCE.md` corrected: `search_notes` default is `"filesystem"` (matches runtime schema); write-path exceptions documented for `move_note`, `update_frontmatter`, `create_folder`

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade SDK and verify TypeScript compilation** - `873d688` (feat)
2. **Task 2: Extend core types for MCP 2025-11-25 spec** - `3abf3f1` (feat)
3. **Task 3: Fix docs/API_REFERENCE.md search_notes default and write-path exceptions** - `ea6a5af` (docs)

**Plan metadata:** (see final metadata commit)

## Files Created/Modified

- `package.json` - SDK already at ^1.27.1; updated lint script to `node --max-old-space-size=16384 ./node_modules/typescript/bin/tsc --noEmit`
- `tsconfig.json` - Changed `moduleResolution` from `"node"` to `"bundler"` to fix TypeScript OOM
- `src/types/index.ts` - Added `ToolAnnotations` interface (lines 90-95); added `lazy_loading?` and `always_loaded_tools?` to `ServerConfig` (lines 119-120)
- `docs/API_REFERENCE.md` - Fixed search_notes default (line 212); added Write-Path Exceptions section; fixed move_note Notes; added update_frontmatter Notes

## Decisions Made

- **moduleResolution: "bundler"** — MCP SDK 1.27.1 `types.d.ts` imports `zod/v4` and uses `ExpandRecursively<T>` recursive types. With `moduleResolution: "node"`, TypeScript attempted to load types non-incrementally, creating a circular type expansion loop that consumed >8GB RAM and timed out after 300s. With `"bundler"`, TypeScript correctly follows the package `exports` field, loads only required type slices, and completes in 0.76 seconds.

- **lint script memory allocation** — Using `node --max-old-space-size=16384 ./node_modules/typescript/bin/tsc` instead of `npx tsc`: avoids npx package resolution overhead and explicitly sets 16GB heap ceiling for TypeScript's in-memory type graph. The 16GB limit is conservative — actual usage with bundler resolution is ~500MB.

- **ToolResponse unchanged** — `ToolResponse = CallToolResult` already inherits `structuredContent?: Record<string, unknown>` from the upgraded SDK. Verified in `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts` at lines 2590/2695. No manual augmentation needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript OOM caused by `moduleResolution: "node"` incompatibility with MCP SDK 1.27.1**
- **Found during:** Task 1 (Upgrade SDK and verify TypeScript compilation)
- **Issue:** `tsc --noEmit` crashed with "Ineffective mark-compacts near heap limit" at 4GB, 8GB, and timed out at 300s with 32GB. Root cause: MCP SDK 1.27.1 `types.d.ts` uses `import * as z from 'zod/v4'` and `ExpandRecursively<T>` (a self-referential mapped type) across 8,136 lines of schemas. With `moduleResolution: "node"`, TypeScript uses non-export-aware path resolution, which triggers additional type graph traversal and causes exponential memory growth in recursive type expansion.
- **Fix:** Changed `tsconfig.json` `moduleResolution` from `"node"` to `"bundler"`. With `bundler`, TypeScript follows the SDK's package `exports` field directly, loads `dist/esm/types.d.ts` once, and resolves types incrementally. Completion time: 0.76s with ~500MB memory.
- **Files modified:** `tsconfig.json`
- **Verification:** `node --max-old-space-size=16384 ./node_modules/typescript/bin/tsc --noEmit` exits 0 in <1 second; `npm run lint` exits 0; 78/78 tests pass; `tsup` build succeeds
- **Committed in:** `873d688` (Task 1 commit)

**2. [Rule 3 - Blocking] Updated lint script to use node with memory flag**
- **Found during:** Task 1 (triggered by Fix 1 investigation)
- **Issue:** `tsc --noEmit` in the npm lint script used the system default Node.js memory (typically 1.5GB), which is insufficient even with bundler resolution on some systems.
- **Fix:** Updated `lint` script in `package.json` to `node --max-old-space-size=16384 ./node_modules/typescript/bin/tsc --noEmit`
- **Files modified:** `package.json`
- **Verification:** `npm run lint` exits 0
- **Committed in:** `873d688` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required to unblock TypeScript verification. No scope creep — changes are directly in service of the plan's `tsc --noEmit` done criterion.

## Issues Encountered

- TypeScript OOM: `tsc --noEmit` consumed >8GB RAM and crashed; traced to `ExpandRecursively<T>` recursive mapped type in MCP SDK 1.27.1 `types.d.ts` when used with `moduleResolution: "node"`. Resolved by switching to `"bundler"` resolution (see Deviations).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Types foundation is in place: `ToolAnnotations` ready for Plan 03 (`ToolDefinition` extension)
- `ServerConfig` lazy-loading fields ready for Phase 3 implementation
- TypeScript compilation is fast and reliable — subsequent plans can use `npm run lint` without memory issues
- No blockers for Plan 02 (test infrastructure)

## Self-Check: PASSED

- FOUND: .planning/phases/01-quality-foundation/01-01-SUMMARY.md
- FOUND: src/types/index.ts (ToolAnnotations at line 90, lazy_loading at line 119)
- FOUND: docs/API_REFERENCE.md (filesystem default at line 212, exceptions at lines 337-339)
- FOUND: tsconfig.json (moduleResolution: bundler)
- FOUND: package.json (lint script updated)
- COMMIT 873d688: feat(01-01): upgrade SDK to ^1.27.1 and fix TypeScript compilation
- COMMIT 3abf3f1: feat(01-01): extend core types for MCP 2025-11-25 spec
- COMMIT ea6a5af: docs(01-01): fix API_REFERENCE.md search_notes default and write-path exceptions
- COMMIT 6afca0f: docs(01-01): complete plan 01-01 execution summary and state updates

---
*Phase: 01-quality-foundation*
*Completed: 2026-02-27*
