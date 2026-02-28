---
phase: 03-lazy-loading
plan: "02"
subsystem: server-wiring
tags: [lazy-loading, integration-tests, server, oninitialized, listChanged]
dependency_graph:
  requires: [registry-reset, discover-tools-handler, enable-tool-handler, buildRegistry-lazy]
  provides: [server-lazy-wiring, lazy-loading-integration-tests]
  affects: [src/index.ts, test-suite]
tech_stack:
  added: []
  patterns: [listChanged-capability, oninitialized-session-reset, vitest-integration-tests]
key_files:
  created:
    - src/tools/__tests__/lazy-loading.integration.test.ts
  modified:
    - src/index.ts
decisions:
  - "Server created before buildRegistry() so server ref is captured in enable_tool handler closure"
  - "lazyLoading = config.lazy_loading !== false — undefined defaults to true (lazy on by default)"
  - "oninitialized hook calls resetToAlwaysLoaded() guarded by lazyLoading flag — no-op in non-lazy mode"
  - "vi.waitFor() used for fire-and-forget sendToolListChanged assertion — avoids flaky async timing"
metrics:
  duration_minutes: 1
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 1
  files_created: 1
---

# Phase 3 Plan 02: Server Wiring + Integration Tests Summary

Server entry point wired for lazy loading (listChanged capability, lazyLoading flag, oninitialized reset) and 17 integration tests added covering all 5 LAZY-* requirements — full pre-commit gate passes clean.

## What Was Built

### Task 1: src/index.ts — Three targeted changes

**Change 1: `tools: { listChanged: true }` capability**

Server now declares to MCP clients that it emits `notifications/tools/list_changed`. This is essential for clients (like Cursor) that listen for tool list changes after `enable_tool` fires `sendToolListChanged`.

**Change 2: Server created before buildRegistry()**

Moved the `new Server(...)` block above `buildRegistry()` so the server reference is available to pass into `buildRegistry(lazyLoading, server)`. The `server` ref is captured in the `enable_tool` handler closure at registration time.

```typescript
const lazyLoading = config.lazy_loading !== false;  // default true when undefined
const registry = buildRegistry(lazyLoading, server);
```

**Change 3: `server.oninitialized` session-reset hook**

Added after `buildRegistry()` and before `setRequestHandler` calls:

```typescript
server.oninitialized = () => {
  if (lazyLoading) {
    registry.resetToAlwaysLoaded();
  }
};
```

Prevents stale session state on client reconnect — when a client disconnects and reconnects, the enabled Set returns to only meta-tools (discover_tools + enable_tool). This is the mitigation for Pitfall 4 from RESEARCH.md.

### Task 2: lazy-loading.integration.test.ts — 17 tests covering all LAZY-* requirements

File: `src/tools/__tests__/lazy-loading.integration.test.ts` (241 lines)

**Test coverage by requirement:**

| Requirement | Description | Test count |
|-------------|-------------|-----------|
| LAZY-01 | discover_tools returns all tools with correct fields | 5 tests |
| LAZY-02 | enable_tool enables tool + fires sendToolListChanged | 4 tests |
| LAZY-03 | lazy=true gives exactly 2 tools at session start | 3 tests |
| LAZY-04 | lazy=false gives all 19 tools at session start | 2 tests |
| LAZY-05 | enable_tool response includes full inputSchema + outputSchema | 1 test (combined with LAZY-02) |
| resetToAlwaysLoaded | Session reset clears feature tools, restores 2 meta-tools | 1 test |
| server undefined | enable_tool works gracefully with no server ref | 1 test |

**Key test patterns used (matching project conventions):**
- Parse JSON from `result.content[0].text` (project standard)
- `as any` for mockConfig and mockServer (project standard)
- Plain object mock server: `{ sendToolListChanged: vi.fn().mockResolvedValue(undefined) }`
- `vi.waitFor()` for fire-and-forget notification assertion (avoids fragile setTimeout)
- `beforeEach(() => { registry = buildRegistry(true); })` for fresh state per test

## Verification

```
grep "listChanged: true" src/index.ts        ✓ capability declared
grep "resetToAlwaysLoaded" src/index.ts      ✓ session reset wired
grep "buildRegistry(lazyLoading" src/index.ts ✓ config flag passed
npm test -- --run                            ✓ 133/133 tests pass (116 + 17 new)
npx tsc --noEmit                             ✓ 0 type errors
npm run build                                ✓ tsup build success
```

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | e439a01 | feat(03-02): wire index.ts — listChanged capability, lazyLoading flag, oninitialized reset |
| 2    | eafcc41 | test(03-02): add lazy-loading integration tests covering all LAZY-* requirements |

## Self-Check: PASSED

- FOUND: src/index.ts
- FOUND: src/tools/__tests__/lazy-loading.integration.test.ts
- FOUND commit: e439a01
- FOUND commit: eafcc41
- `listChanged: true` present in src/index.ts
- `resetToAlwaysLoaded` present in src/index.ts
- `buildRegistry(lazyLoading` present in src/index.ts
- 133/133 tests pass
