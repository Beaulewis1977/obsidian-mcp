---
phase: 02-registry-link-tools
plan: "01"
subsystem: api
tags: [tool-registry, dispatch, mcp, typescript, zod]

requires:
  - phase: 01-quality-foundation
    provides: SDK 1.27.1 upgrade, ToolResponse = CallToolResult alias, 13 working tools with outputSchema, rate-limiter singleton BUG-01 fix

provides:
  - ToolRegistry class (Map + Set architecture) at src/tools/registry.ts
  - buildRegistry() factory registering all 13 tools with definition, handler, schema, category, alwaysLoaded
  - registry.dispatch() replacing switch-based dispatch in src/index.ts
  - registry.getEnabledDefinitions() replacing getToolDefinitions() for ListTools handler
  - getRateLimiter exported from src/tools/index.ts for use in src/index.ts

affects:
  - 02-02 (link tools — will add new tool registrations via registry.register())
  - 03-lazy-loading (Phase 3 — will use alwaysLoaded + category fields for lazy load semantics)

tech-stack:
  added: []
  patterns:
    - "ToolRegistry: plain Map<string, ToolRegistration> + Set<string> enabled names — no event emitters, no DI"
    - "dispatch() returns null for unknown/disabled tools; caller converts to MCP error response"
    - "dispatch() delegates schema validation to Zod — throws ZodError on bad args, caller handles"
    - "buildRegistry() factory: register all tools THEN call enableAll() as final step"
    - "Rate limiting lives in CallToolRequestSchema handler in src/index.ts (not inside registry)"

key-files:
  created:
    - src/tools/registry.ts
  modified:
    - src/tools/index.ts
    - src/index.ts
    - src/tools/__tests__/handlers2.integration.test.ts

key-decisions:
  - "ToolRegistry as plain Map + Set data structure — no middleware, events, or DI per research design constraints"
  - "dispatch() returns null (not throws) for unknown/disabled tools — cleaner caller-side error handling"
  - "Rate limiting moved from handleToolCall to CallToolRequestSchema handler in src/index.ts — decouples rate limiting from registry dispatch"
  - "getToolDefinitions() kept as @deprecated wrapper to avoid breaking imports; buildRegistry() is the new entry point"
  - "alwaysLoaded and category fields set on all 13 tools now — Phase 3 lazy loading will selectively change these"

patterns-established:
  - "Tool registration pattern: registry.register({ definition, handler, schema, category, alwaysLoaded })"
  - "Server startup: const registry = buildRegistry(); then wire ListTools and CallTool handlers"

requirements-completed: [REGX-01, REGX-02, REGX-03]

duration: 4min
completed: 2026-02-27
---

# Phase 02 Plan 01: Tool Registry Architecture Summary

**ToolRegistry class with Map + Set dispatch replaces switch-based handleToolCall — all 13 tools registered via buildRegistry() factory, rate limiting migrated to src/index.ts handler**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-27T22:25:28Z
- **Completed:** 2026-02-27T22:28:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `src/tools/registry.ts` with `ToolRegistry` class (Map + Set architecture) and `ToolRegistration` interface supporting Phase 3 lazy loading fields (`category`, `alwaysLoaded`)
- Implemented `buildRegistry()` factory in `src/tools/index.ts` registering all 13 existing tools; switch-based `handleToolCall()` removed
- Updated `src/index.ts` to use `registry.getEnabledDefinitions()` for ListTools and `registry.dispatch()` for CallTool with preserved rate limiting behaviour
- All 97 tests pass; pre-commit hook (tsc + vitest + tsup) passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ToolRegistry class and ToolRegistration interface** - `54082ea` (feat)
2. **Task 2: Implement buildRegistry() factory and migrate dispatch to registry** - `e050348` (feat)

**Plan metadata:** _(docs commit to follow)_

## Files Created/Modified

- `src/tools/registry.ts` — ToolRegistry class (register, enable, enableAll, getEnabledDefinitions, getAll, getRegistration, isEnabled, dispatch) and ToolRegistration interface
- `src/tools/index.ts` — buildRegistry() factory with all 13 tools; handleToolCall removed; getRateLimiter exported; getToolDefinitions kept as @deprecated wrapper
- `src/index.ts` — Updated imports, registry instantiation, ListTools + CallTool handlers using registry
- `src/tools/__tests__/handlers2.integration.test.ts` — Rate limiter behavioral test updated to use buildRegistry + getRateLimiter

## Decisions Made

- ToolRegistry as a plain Map + Set — no event emitters, middleware chains, or dependency injection per research design constraints. Simple and explicit.
- `dispatch()` returns `null` for unknown/disabled tools rather than throwing — callers convert to `createErrorResponse` which is cleaner boundary separation.
- Rate limiting logic moved out of `handleToolCall` into the `CallToolRequestSchema` handler in `src/index.ts`. This decouples registry dispatch from rate limiting concern; the registry handles routing only.
- `alwaysLoaded: true` and `category` set on all 13 existing tools now, even though Phase 2 enables all tools. Phase 3 lazy loading will selectively set `alwaysLoaded: false` on non-meta tools.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated rate limiter behavioral test to use buildRegistry + getRateLimiter**
- **Found during:** Task 2 (buildRegistry factory and dispatch migration)
- **Issue:** `handlers2.integration.test.ts` imported `handleToolCall` from `../index.js` which was removed as part of the planned dispatch migration. Test import failed at runtime.
- **Fix:** Replaced `handleToolCall` import with `buildRegistry` + `getRateLimiter`; updated test body to replicate the same rate-limiting + dispatch pattern now used in `src/index.ts` CallToolRequestSchema handler.
- **Files modified:** `src/tools/__tests__/handlers2.integration.test.ts`
- **Verification:** All 97 tests pass including the rate limiter behavioral test.
- **Committed in:** `e050348` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary consequence of removing handleToolCall. Test updated to verify the same behaviour through the new dispatch path. No scope creep.

## Issues Encountered

None beyond the expected test import breakage documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ToolRegistry is in place; Phase 02-02 (link tools) can add new tools via `registry.register()` calls in `buildRegistry()`
- `alwaysLoaded` and `category` fields are ready for Phase 3 lazy loading to act on
- No blockers
