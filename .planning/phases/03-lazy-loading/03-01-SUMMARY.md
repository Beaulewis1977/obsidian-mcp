---
phase: 03-lazy-loading
plan: "01"
subsystem: tools
tags: [lazy-loading, registry, meta-tools, schemas, handlers]
dependency_graph:
  requires: []
  provides: [registry-reset, discover-tools-handler, enable-tool-handler, buildRegistry-lazy]
  affects: [src/index.ts, integration-tests-phase3]
tech_stack:
  added: []
  patterns: [fire-and-forget-notification, lazy-registry-init, closure-capture-server-ref]
key_files:
  created:
    - src/tools/handlers-meta.ts
  modified:
    - src/tools/registry.ts
    - src/tools/schemas.ts
    - src/tools/index.ts
    - src/tools/__tests__/handlers2.integration.test.ts
decisions:
  - "buildRegistry(lazyLoading=true) default: lazy mode on by default; callers wanting all-enabled must pass false"
  - "handleDiscoverTools/handleEnableTool return ToolResponse (sync) wrapped in Promise.resolve() at registration site"
  - "fire-and-forget sendToolListChanged: void Promise.resolve().then().catch() pattern prevents race + silences test disconnection errors"
  - "categories from ALL tools (unfiltered) so discover_tools always shows full category index regardless of query/category filter"
  - "handlers2 rate-limiter test: buildRegistry(false) so dispatch() finds create_folder enabled — backward compat fix"
metrics:
  duration_minutes: 4
  completed_date: "2026-02-28"
  tasks_completed: 3
  files_modified: 5
  files_created: 1
---

# Phase 3 Plan 01: Lazy Loading Core — Registry + Meta-Tools Summary

Implemented lazy loading core: ToolRegistry session-reset, Zod schemas for meta-tools, discover_tools/enable_tool handlers, and buildRegistry() rewrite gating tool enablement on the lazy_loading flag.

## What Was Built

### Task 1: resetToAlwaysLoaded() + Meta-tool Schemas

**`src/tools/registry.ts`** — Added `resetToAlwaysLoaded()` method to `ToolRegistry`:
- Clears the `enabled` Set
- Re-adds only tools where `alwaysLoaded: true`
- Called on client reconnect when lazy_loading is active (Phase 3 server wiring, Plan 02)

**`src/tools/schemas.ts`** — Added two new Zod schemas:
- `DiscoverToolsSchema`: optional `query` (keyword search) + optional `category` (exact match)
- `EnableToolSchema`: required `tool_name: string.min(1)`
- Type exports: `DiscoverToolsInput`, `EnableToolInput`

### Task 2: handlers-meta.ts

Created `src/tools/handlers-meta.ts` with two exported handler functions:

**`handleDiscoverTools(registry, config, args)`**:
- Maps all registered tools to `{name, category, description, enabled}` objects
- Supports optional keyword filter (`query`) — case-insensitive search on name + description
- Supports optional category filter — case-insensitive exact match
- `categories` field computed from ALL tools (unfiltered) — always shows full category index
- Returns `{tools, categories, total, enabled_count}` as text + structuredContent

**`handleEnableTool(registry, server, config, args)`**:
- Looks up tool by name; returns `VALIDATION_ERROR` with `discover_tools` suggestion for unknowns
- Calls `registry.enable(tool_name)`
- Fires `server.sendToolListChanged()` fire-and-forget (void + .catch guard)
- Returns `{enabled, already_enabled, schema: fullToolDefinition}` — satisfies LAZY-05 (no extra round-trip)

### Task 3: buildRegistry() rewrite

**`src/tools/index.ts`**:
- Signature: `buildRegistry(lazyLoading: boolean = true, server?: Server): ToolRegistry`
- All 17 feature tools changed from `alwaysLoaded: true` to `alwaysLoaded: false`
- Registered `discover_tools` (category: Meta, alwaysLoaded: true)
- Registered `enable_tool` (category: Meta, alwaysLoaded: true, captures `server` via closure)
- `enableAll()` only called when `!lazyLoading` (backward compat mode)

## Verification

- `grep -c "alwaysLoaded: false" src/tools/index.ts` = **17** (all feature tools)
- `grep -c "alwaysLoaded: true," src/tools/index.ts` = **2** (meta-tools only)
- `grep "resetToAlwaysLoaded" src/tools/registry.ts` = method confirmed present
- `npx tsc --noEmit` = **0 errors**
- `npm test -- --run` = **116/116 tests pass**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] handlers2 integration test: buildRegistry() call broke dispatch()**

- **Found during:** Task 3 verification (test run)
- **Issue:** `handlers2.integration.test.ts` rate-limiter behavioral test called `buildRegistry()` (no args) expecting `create_folder` to be enabled via dispatch. With new default `lazyLoading=true`, feature tools are NOT in the enabled Set, so `dispatch()` returns `null`. Test then crashed reading `null.isError`.
- **Fix:** Changed `buildRegistry()` to `buildRegistry(false)` in the test — backward compat mode preserves all-tools-enabled behavior for the dispatch-based test.
- **Files modified:** `src/tools/__tests__/handlers2.integration.test.ts`
- **Commit:** d53625b (included in Task 3 commit)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | 71ff418 | feat(03-01): add resetToAlwaysLoaded() to ToolRegistry + DiscoverToolsSchema/EnableToolSchema |
| 2    | ead7a63 | feat(03-01): create handlers-meta.ts with handleDiscoverTools + handleEnableTool |
| 3    | d53625b | feat(03-01): rewrite buildRegistry() with lazy loading + register meta-tools |

## Self-Check: PASSED
