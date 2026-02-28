---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-02-28T05:36:39.869Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in-progress
last_updated: "2026-02-28T05:31:00Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** Claude can reliably read, write, organize, and navigate Obsidian notes through a spec-compliant, efficient MCP interface.
**Current focus:** Phase 3.1 complete — add_vault, remove_vault, list_vaults registered + tested, 153 tests passing; Phase 4 (extended tools + polish) is next

## Current Position

Phase: 3.1 of 4 (Vault Management Tools) — complete
Plan: 2 of 2 completed in current phase (03.1-01 and 03.1-02 complete)
Status: Phase 3.1 complete — all 3 vault management tools registered in buildRegistry(), 10 integration tests, 153 tests total passing
Last activity: 2026-02-27 — Phase 3.1 plan 02 executed (3 min)

Progress: [████████░░] 80% (3.1/4 phases complete, 12 plans executed)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 11 min
- Total execution time: 0.92 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-quality-foundation | 5 | 60 min | 12 min |
| 02-registry-link-tools | 3 | 12 min | 4 min |
| 03-lazy-loading | 2 | 5 min | 2.5 min |

**Recent Trend:**
- Last 10 plans: 35m, 7m, 5m, 5m, 8m, 4m, 3m, 5m, 4m, 1m
- Trend: fast (additive pattern implementation)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: SDK 0.6.1 → 1.27.1 upgrade is a major-version break; audit Server constructor, ToolSchema shape, CallToolResult shape after upgrading
- [Pre-Phase 1]: All tools must be registered before `server.connect()` to avoid SDK Issue #893 (post-connect registration capability bug)
- [Pre-Phase 1]: `outputSchema` + `isError: true` may cause SDK validation failure — include error field in every `outputSchema` as safe fallback; verify PR #655 fix status in 1.27.1
- [Pre-Phase 1]: `enable_tool` response includes full tool schema in body (fallback for clients without `list_changed` support, e.g., Claude Desktop)
- [Pre-Phase 1]: `onToolListChanged` fired without await to prevent race between enable_tool response and notification delivery
- [01-01]: tsconfig.json moduleResolution changed from "node" to "bundler" — MCP SDK 1.27.1 types.d.ts imports zod/v4 ExpandRecursively<T>; "node" resolution caused OOM; "bundler" completes in <1s
- [01-01]: lint script uses `node --max-old-space-size=16384 ./node_modules/typescript/bin/tsc --noEmit` to ensure reliable tsc execution
- [01-01]: ToolResponse = CallToolResult kept as alias; structuredContent already available via SDK 1.27.1 (no manual augmentation needed)
- [Phase 01-quality-foundation]: BUG-01 already fixed before plan execution — module-level _rateLimiter singleton was in place
- [Phase 01-quality-foundation]: BUG-02: existsSync for absolute path exe detection; LOCALAPPDATA Squirrel path added for Windows
- [Phase 01-quality-foundation]: BUG-03: stringifyMarkdown (existing utility) used for frontmatter serialization in create_note API path
- [Phase 01-quality-foundation]: BUG-04: spread ...note before path: notePath override to avoid TS2783 duplicate key; output identical
- [01-03]: outputSchema type literal 'object' enforced in ToolDefinition interface shape; error:string included in all 13 schemas per isError defense-in-depth
- [01-03]: move_note destructive=true (removes source file); get_daily_note idempotent=false (creates file on first call for a date); open_in_obsidian openWorld=true (launches external app)
- [Phase 01]: Spread order in get_daily_note: { ...note, path: notePath } not { path: notePath, ...note } — Note type has path field, putting explicit key before spread causes TS2783
- [Phase 01]: handlers2.ts handleOpenInObsidian: named payload variables per branch (apiPayload, uriPayload, vaultPayload) to avoid variable shadowing across 3 success return paths
- [01-05]: Rate limiter behavioral test uses handleToolCall from index.ts (not handler directly) — rate limiting is applied at dispatch level, handlers bypass it if called directly
- [01-05]: Full RateLimitConfig structure required for behavioral test (limits.global/read/write, graceful) — simplified per_minute:2 shape does not match interface
- [02-01]: ToolRegistry as plain Map + Set — no event emitters, middleware, or DI; dispatch() returns null for unknown/disabled tools (caller converts to error response)
- [02-01]: Rate limiting moved from handleToolCall to CallToolRequestSchema handler in src/index.ts — registry dispatch is routing-only
- [02-01]: alwaysLoaded and category fields set on all 13 tools now for Phase 3 lazy loading compatibility; buildRegistry() calls enableAll() as final step after all register() calls
- [02-02]: parseWikilinks uses regex NOT remark-wiki-link v2.0.1 — library stores [[Note|Alias]] as literal "Note|Alias" and ignores ![[embed]]; regex handles all 5 Obsidian formats correctly
- [02-02]: buildVaultGraph uses sequential for...of reads, not Promise.all — avoids opening 1000+ file handles simultaneously on large vaults
- [02-02]: nameToPath shortest-path-wins: sort notes by path.length ascending before building basename lookup Map
- [02-02]: handleGetLinkGraph folder filter: full-vault graph build with nameToPath for cross-folder link resolution correctness
- [Phase 02]: 19 integration tests cover all 4 link handlers — buildVaultGraph only creates edges for resolved vault notes (image.png embed is correctly absent from edges)
- [03-01]: buildRegistry(lazyLoading=true) default — lazy mode on by default; existing tests using dispatch() must call buildRegistry(false) for backward compat
- [03-01]: handleDiscoverTools/handleEnableTool return sync ToolResponse, wrapped in Promise.resolve() at registration site — handler type expects Promise<ToolResponse>
- [03-01]: categories field in discover_tools computed from ALL tools (unfiltered) so full category index always shown regardless of query/category filter applied to tools list
- [03-01]: sendToolListChanged fire-and-forget: void Promise.resolve().then().catch() pattern — prevents response/notification race + silences "Not connected" in test environments
- [03-02]: Server created before buildRegistry() so server ref is captured in enable_tool handler closure at registration time
- [03-02]: lazyLoading = config.lazy_loading !== false — undefined defaults to true (lazy on by default)
- [03-02]: oninitialized hook guarded by lazyLoading flag — no-op in non-lazy mode; prevents stale session state on client reconnect
- [03-02]: vi.waitFor() used for fire-and-forget sendToolListChanged assertion in tests — avoids flaky setTimeout-based polling
- [03.1-01]: obsidian-config.ts uses atomic rename (tmp file in same dir) to avoid partial-write corruption on NTFS/ext4
- [03.1-01]: getActiveConfigPath() iterates getConfigPaths() and returns first accessible path — fixes split-brain where saveConfig() always wrote to ~/.obsidian-mcp/config.json regardless of which config was loaded
- [03.1-01]: WSL Obsidian config path derived from os.homedir().split('/').pop() for Windows username — no env var dependency
- [03.1-01]: handleRemoveVault guards: confirm:true required, last vault blocked, default vault blocked — all guard via createErrorResponse (no throws)
- [03.1-02]: handlers-vault.test.ts uses vi.mock('fs/promises') with { default: { ... } } shape to match default import in handlers-vault.ts
- [03.1-02]: makeMockConfig() factory function (not const) ensures fresh config per test — prevents cross-test mutation from Object.assign(config, reloaded)
- [03.1-02]: 3 vault tools registered under 'Vault Management' category with alwaysLoaded: false — tool count is now 22 (20 feature + 2 meta)

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Vault Management Tools (URGENT)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: SDK 1.27.1 `McpServer` vs low-level `Server` API difference needs confirmation before writing migration code — does `McpServer` support all existing dispatch patterns?
- [Phase 3]: Claude Desktop does not support `notifications/tools/list_changed`; confirm this does not break `enable_tool` flow (response body schema fallback is the mitigation)

## Session Continuity

Last session: 2026-02-27
Stopped at: Phase 3.1 plan 02 complete — vault tool registry wiring + integration tests (4d949d2, 104ca6f, c7de828)
Resume file: None
