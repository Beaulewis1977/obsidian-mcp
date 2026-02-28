# Roadmap: Obsidian MCP Server — Milestone 2

## Overview

Milestone 2 takes a working 13-tool server and makes it the best Obsidian MCP implementation available: spec-compliant, cross-platform, efficiently lazy-loaded, and expanded to 24 tools. The four phases follow a hard dependency chain — bugs and SDK upgrade first, registry architecture second, lazy loading third, polish and extended tools last. Nothing in a later wave can safely be built without the earlier wave being complete and tested.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Quality Foundation** - Fix critical bugs, upgrade SDK, modernize to MCP 2025-11-25 spec, add missing test coverage
- [x] **Phase 2: Registry + Link Tools** - Replace static switch dispatch with ToolRegistry architecture, add 4 high-value link/graph tools (completed 2026-02-27)
- [x] **Phase 3: Lazy Loading** - Add discover_tools + enable_tool meta-tools, wire config-gated lazy loading for 80%+ token reduction (completed 2026-02-28)
- [x] **Phase 4: Extended Tools + Polish** - Add 5 extended tools, per-property input examples, pagination, and final docs (completed 2026-02-28)

## Phase Details

### Phase 1: Quality Foundation
**Goal**: The existing 13 tools run on the upgraded SDK, pass MCP 2025-11-25 spec compliance, have no active bugs, and are fully covered by integration tests — creating a safe foundation for all expansion work
**Depends on**: Nothing (first phase)
**Requirements**: SDK-01, BUG-01, BUG-02, BUG-03, BUG-04, SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, TEST-01, TEST-02 (coverage obligation for Phase 1 new tests)
**Success Criteria** (what must be TRUE):
  1. Server starts and all 13 existing tools respond correctly after upgrading to `@modelcontextprotocol/sdk@^1.27.1`
  2. A test that calls any tool 2x the per-minute rate limit is correctly rejected (rate limiter functions as a true singleton, not per-call)
  3. `open_in_obsidian` executes successfully on native Windows without invoking `which` or `command -v`
  4. All 13 tools emit `outputSchema`, `structuredContent`, and `annotations` fields; `get_daily_note` returns `path` consistently; `create_note` produces no date corruption in frontmatter
  5. `handlers2.ts` tools each have at least one integration test covering a success path and a failure path; the pre-commit hook (`tsc --noEmit` + `vitest --run` + `tsup`) passes clean
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — SDK upgrade to 1.27.1, extend ToolAnnotations + ServerConfig types, fix API docs drift
- [x] 01-02-PLAN.md — Fix all 4 bugs: rate limiter singleton, Windows exe detection, frontmatter serialization, get_daily_note path field
- [x] 01-03-PLAN.md — Add outputSchema + annotations to all 13 tool definitions
- [x] 01-04-PLAN.md — Add structuredContent to all 13 handler success responses
- [x] 01-05-PLAN.md — handlers2 integration test suite + full pre-commit gate verification

### Phase 2: Registry + Link Tools
**Goal**: Static switch dispatch is replaced by a `ToolRegistry` class; four new link/graph tools are registered and usable; the architecture is validated and ready for lazy-loading wiring
**Depends on**: Phase 1
**Requirements**: REGX-01, REGX-02, REGX-03, LINK-01, LINK-02, LINK-03, LINK-04
**Success Criteria** (what must be TRUE):
  1. `ToolRegistry` (`src/tools/registry.ts`) exists with `Map<string, ToolRegistration>` + `Set<string>` architecture; all 13 existing tools are registered through it and behave identically to before
  2. `get_link_graph` returns a directed graph of all vault notes with nodes, edges, and stats; `find_orphans` returns notes with no incoming and no outgoing links
  3. `search_tags` returns all tags used in the vault with per-tag usage counts; `get_outgoing_links` returns all wikilinks from a specified note
  4. The pre-commit hook passes clean; all 4 new tools have success + failure integration tests
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — ToolRegistry class + buildRegistry() factory + dispatch migration from switch to registry
- [x] 02-02-PLAN.md — Link graph utility + 4 new link/graph tool handlers + Zod schemas + registry registration
- [x] 02-03-PLAN.md — Integration tests for all 4 link tools + full pre-commit gate verification

### Phase 3: Lazy Loading
**Goal**: Clients that start a session receive only `discover_tools` and `enable_tool` by default, reducing LLM context overhead from ~12,000 to ~1,000 tokens; clients that need the old behavior can set `lazy_loading: false`
**Depends on**: Phase 2
**Requirements**: LAZY-01, LAZY-02, LAZY-03, LAZY-04, LAZY-05
**Success Criteria** (what must be TRUE):
  1. With `lazy_loading: true` (default), `ListTools` returns exactly 2 tools (`discover_tools` and `enable_tool`) at session start
  2. Calling `enable_tool` with a valid tool name enables that tool in the session; the response body includes the full tool schema; `notifications/tools/list_changed` is emitted (non-blocking fire-and-forget, not awaited before the response)
  3. Calling `discover_tools` returns all registered tools — name, category, description, and enabled status — regardless of lazy-loading state
  4. With `lazy_loading: false`, `ListTools` returns all tools at session start (backward-compat behavior unchanged)
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Core implementation: registry resetToAlwaysLoaded(), meta-tool schemas, handlers-meta.ts, buildRegistry rewrite with lazyLoading gate
- [x] 03-02-PLAN.md — Server wiring (listChanged capability, oninitialized hook) + integration tests for all LAZY-* requirements

### Phase 03.1: Vault Management Tools (INSERTED)

**Goal:** Three vault management tools (add_vault, remove_vault, list_vaults) let agents create, remove, and list Obsidian vaults end-to-end — handling folder creation, obsidian.json registration, MCP config.json updates, and in-memory hot-reload — without manual config editing
**Requirements**: VAULT-01, VAULT-02, VAULT-03, VAULT-04, VAULT-05, VAULT-06
**Depends on:** Phase 3
**Success Criteria** (what must be TRUE):
  1. `add_vault` creates folder on disk, registers in obsidian.json and config.json, hot-reloads in-memory config
  2. `remove_vault` unregisters from both configs, optionally deletes folder with double confirmation, refuses to remove last or default vault
  3. `list_vaults` cross-references obsidian.json with config.json, reports disk status and note count per vault
  4. All 3 tools work on Windows native, WSL, macOS, and Linux
  5. Tools are registered in ToolRegistry under "Vault Management" category with alwaysLoaded: false
  6. Pre-commit gate (tsc + vitest + tsup) passes clean with all new tests
**Plans:** 2/2 plans complete

Plans:
- [x] 03.1-01-PLAN.md — Platform layer (obsidian-config.ts), config split-brain fix, Zod schemas, all 3 vault handlers
- [x] 03.1-02-PLAN.md — Registry wiring in buildRegistry(), handler tests, lazy-loading count update, pre-commit gate

### Phase 4: Extended Tools + Polish
**Goal**: Five additional tools are available, all tools carry per-property input examples, high-volume list tools support cursor pagination, and API_REFERENCE.md reflects the full final tool surface
**Depends on**: Phase 3
**Requirements**: XTND-01, XTND-02, XTND-03, XTND-04, XTND-05, PLSH-01, PLSH-02, PLSH-03, PLSH-04, PLSH-05
**Success Criteria** (what must be TRUE):
  1. `manage_tags`, `archive_note`, `extract_links`, `get_weekly_note`, and `list_templates` are registered in the tool registry and callable; each has success + failure integration tests
  2. Every tool's input schema fields include a populated `examples` array (JSON Schema 2020-12 per-property `examples` keyword); no tool uses the old top-level `input_examples` pattern
  3. `list_notes`, `search_notes`, and `search_tags` accept a `cursor` input and return `nextCursor` in their response when more results exist; omitting `cursor` returns the first page
  4. `API_REFERENCE.md` documents all tools including the Milestone 2 additions with accurate parameter descriptions and example responses
**Plans**: 5 plans

Plans:
- [ ] 04-01-PLAN.md — Foundation utilities: withExamples() post-processor, pagination.ts, 5 new Zod schemas + cursor fields on 3 existing schemas
- [ ] 04-02-PLAN.md — 5 new tool handlers in handlers-extended.ts + integration tests
- [ ] 04-03-PLAN.md — Cursor pagination for list_notes, search_notes, search_tags + integration tests
- [ ] 04-04-PLAN.md — Registry wiring: register 5 new tools, apply withExamples to all 27 tools, update tool count test
- [ ] 04-05-PLAN.md — API_REFERENCE.md: document all 27 tools including pagination and new tool sections

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Quality Foundation | 5/5 | Complete | 2026-02-27 |
| 2. Registry + Link Tools | 3/3 | Complete   | 2026-02-27 |
| 3. Lazy Loading | 2/2 | Complete   | 2026-02-28 |
| 3.1. Vault Management Tools | 2/2 | Complete | 2026-02-27 |
| 4. Extended Tools + Polish | 5/5 | Complete   | 2026-02-28 |
