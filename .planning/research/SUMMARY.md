# Project Research Summary

**Project:** Obsidian MCP Server — Milestone 2 (Modernization + Tool Expansion)
**Domain:** TypeScript MCP Server — Vault Knowledge Management
**Researched:** 2026-02-26
**Confidence:** HIGH (all four research areas verified against official sources)

## Executive Summary

This project modernizes and expands an existing 13-tool MCP server for Obsidian vault management. The server currently runs on `@modelcontextprotocol/sdk@0.6.1` — a pre-v1 API that predates the MCP 2025-11-25 specification. Milestone 2 has two parallel objectives: (1) upgrade to spec compliance including `outputSchema`, `structuredContent`, and tool annotations, and (2) expand the tool surface from 13 to approximately 24 tools with a lazy-loading architecture that reduces LLM token overhead by 80-85%. These objectives are sequentially dependent — spec modernization and bug fixes must land before tool expansion begins.

The recommended approach is to treat this milestone in four waves with a hard quality gate before any new tools ship. Wave 1 resolves critical bugs and performs the SDK major-version upgrade (`0.6.1` to `1.27.1`). Wave 2 builds the tool registry infrastructure (replacing the current static switch dispatch) and adds the highest-value new tools. Wave 3 adds the lazy-loading meta-tools (`discover_tools`, `enable_tool`) that unlock token footprint reduction. Wave 4 is a polish pass covering pagination, supplementary tools, and documentation. This ordering is dictated by hard dependency chains: the tool registry must exist before lazy loading can be wired, and the SDK must be upgraded before `outputSchema` can be declared on any tool.

The key risk is the SDK major-version upgrade. The `0.6.1` to `1.x` transition is not a drop-in bump — the `Server` constructor API, `ToolSchema` shape, and `CallToolResult` shape all change. Additionally, the v1 SDK ships a higher-level `McpServer` class that changes the recommended tool registration pattern entirely. Three existing bugs (rate limiter per-call instantiation, Windows native exec detection, gray-matter date corruption) must also be fixed in Wave 1. These bugs are currently undetected in CI because test coverage for `handlers2.ts` tools does not exist. Fixing the bugs and adding that test coverage before any refactor work begins is the only safe path.

---

## Key Findings

### Recommended Stack

The stack itself is sound and requires minimal changes. The only mandatory change is upgrading `@modelcontextprotocol/sdk` from `^0.6.0` to `^1.27.1`. All other dependencies (TypeScript 5.3.3, Node.js >=18, Zod 3.x, gray-matter, remark/unified, dayjs, pino, execa, chokidar) remain unchanged and are confirmed compatible with the v1 SDK.

The v1 SDK introduces `McpServer` as the recommended high-level class. It accepts Zod schemas directly in `registerTool()` (eliminating manual `zodToJsonSchema()` calls at the registration callsite), natively supports `outputSchema`, `annotations`, and `structuredContent`, and automatically emits `notifications/tools/list_changed` when `RegisteredTool.enable()` or `disable()` is called. The `registerTool()` return value is a `RegisteredTool` object that serves as the handle for the lazy-loading enable/disable lifecycle. Critically, all tools should be registered (some disabled) before `server.connect()` to avoid SDK Issue #893, a confirmed P2 bug where post-connect `registerTool()` calls throw a capability initialization error.

**Core technologies:**
- `@modelcontextprotocol/sdk@^1.27.1`: MCP protocol implementation — mandatory upgrade; only version with `outputSchema`, `annotations`, `structuredContent`, and native `RegisteredTool.enable()/disable()` API
- `TypeScript@^5.3.3`: type safety — unchanged; v1 SDK ships full types for all new fields
- `zod@^3.22.4`: schema definition — unchanged; v1 SDK accepts Zod schemas directly in `registerTool()`
- `gray-matter@^4.0.3`: frontmatter parse/serialize — unchanged library, but usage must be corrected (js-yaml JSON_SCHEMA to prevent date auto-casting; `matter.stringify` as canonical write path)
- `rate-limiter-flexible@^5.0.3`: rate limiting — unchanged library, but instantiation pattern must be fixed (module-level singleton, not per-call)

### Expected Features

Research confirms a hard three-tier structure for this milestone:

**Must have (quality gate — Wave 1):**
- Rate limiter singleton fix (F-CRIT-01) — currently non-functional; every call instantiates a fresh counter
- `open_in_obsidian` Windows native exec detection fix (F-CRIT-02) — `which` does not exist on Win32; use `fs.access`
- MCP 2025-11-25 spec modernization: `outputSchema`, `structuredContent`, `annotations` on all tools (F-HIGH-01)
- `matter.stringify` as canonical frontmatter serializer on all write paths (F-MED-01) with js-yaml JSON_SCHEMA
- `get_daily_note` output field normalization `notePath` → `path` (F-MED-02)
- `handlers2.ts` integration test coverage — regression safety before any refactor (F-MED-03)
- Docs/runtime alignment for `search_notes` default backend (F-HIGH-03)

**Should have (core new capability — Waves 2-3):**
- `get_link_graph` — full bidirectional directed graph; highest-value new tool; enables vault-level AI reasoning unavailable in any competing implementation
- `find_orphans` — vault hygiene; shares graph utility with `get_link_graph`
- `get_outgoing_links` — completes the backlinks/outgoing pair
- `search_tags` — tag taxonomy exploration before touching notes
- `discover_tools` + `enable_tool` — lazy-loading meta-tools reducing LLM token footprint from ~12,000 to ~1,000 tokens (80-85% reduction); unique differentiator across all competing Obsidian MCP implementations
- Tool registry architecture replacing static switch dispatch

**Polish (Wave 4):**
- `manage_tags`, `archive_note`, `extract_links`, `get_weekly_note`, `list_templates`
- `input_examples` per-property (JSON Schema 2020-12 `examples` keyword)
- Cursor-based pagination on `list_notes`, `search_notes`, `search_tags`

**Defer to Milestone 3+:**
- `bulk_update_metadata`, `organize_notes` — require dry-run + rollback design
- `create_from_template` — variable substitution syntax is fragile
- `get_canvas` — canvas JSON format is evolving
- `export_note` — requires heavy external runtime dependencies (pandoc/headless browser)
- Wikilink auto-update on `move_note` — catastrophic failure surface without vault-wide transaction support

**Key insight from competitor analysis:** No competing Obsidian MCP implementation has implemented `outputSchema`, `structuredContent`, or `annotations`. Lazy loading is also unique. These are genuine differentiation opportunities, not checkbox compliance work.

### Architecture Approach

The architecture shifts from a static switch-dispatch pattern to a registry-based pattern. A new `ToolRegistry` class (Map<string, ToolRegistration> + Set<string> of enabled names) becomes the central dispatcher. All tools — existing and new — register into this registry at startup, with non-meta tools disabled when `lazy_loading: true`. The `ListTools` handler returns only enabled tool definitions; `CallTool` dispatches through the registry which guards against calling disabled tools.

The SDK upgrade enables using `McpServer.registerTool()` instead of the current `server.setRequestHandler()` pattern. The returned `RegisteredTool` objects serve as handles for the lazy-loading lifecycle, and the SDK automatically emits `notifications/tools/list_changed` on `enable()`/`disable()` calls — no manual `sendToolListChanged()` call is needed in the happy path.

**Major components:**
1. `src/tools/registry.ts` (new) — `ToolRegistry` class with `Map<string, ToolRegistration>`, `Set<string>` enabled set, `enable()`, `enableCategory()`, `getEnabledDefinitions()`, `dispatch()` methods; process-level singleton instantiated in `main()`
2. `src/tools/meta-tools.ts` (new) — `discover_tools` and `enable_tool` handler implementations; `discover_tools` always enabled, `enable_tool` triggers the `onToolListChanged` callback (non-blocking fire-and-forget pattern to avoid race with response delivery)
3. `src/tools/index.ts` (rewritten) — `buildRegistry()` factory replaces `getToolDefinitions()` + switch dispatch; all 13 existing tools plus new tools registered here
4. `src/index.ts` (modified) — constructs registry with `onToolListChanged` callback, rewires `ListTools`/`CallTool` handlers; `McpServer` replaces `Server`
5. `src/tools/handlers.ts`, `handlers2.ts` (unchanged) — handler function signatures stay as-is; registry wraps them

### Critical Pitfalls

1. **SDK 0.6.1 lacks outputSchema/structuredContent/annotations entirely** — the 0.6.1 → 1.x upgrade is a major version break, not a patch. Audit `Server` constructor, `ToolSchema` shape, and `CallToolResult` shape after upgrading; run `tsc --noEmit` to zero TypeScript errors before writing any new feature code. Upgrade in its own isolated commit.

2. **`outputSchema` declared + `isError: true` response causes SDK validation failure** — the server-side SDK validates `structuredContent` against `outputSchema` before checking `isError`, so error responses fail schema validation. Verify the target SDK version includes PR #655 fix; write integration tests that exercise error paths on every tool with `outputSchema`, not just the happy path.

3. **Rate limiter per-call instantiation silently disables rate limiting** — `new RateLimitManager(config)` inside `handleToolCall` creates a fresh counter on every request. Fix: instantiate once in `main()` and pass as a singleton. Verify with an integration test that makes 2x the allowed requests per minute and asserts the excess is rate-limited.

4. **`sendToolListChanged` race with `enable_tool` response** — awaiting the notification before returning the tool result means the client can receive `list_changed`, call `ListTools`, and call the newly-enabled tool before `enable_tool`'s response is acknowledged. Fix: fire the `onToolListChanged` callback without `await` so both the response and notification travel to the client concurrently, with the response first.

5. **gray-matter silently converts `date: 2024-01-15` to a JavaScript `Date` object** — js-yaml's default schema auto-casts ISO 8601 date strings. When re-serialized via `matter.stringify`, the field becomes `2024-01-15T00:00:00.000Z`, corrupting daily note frontmatter. Fix: configure js-yaml to use `JSON_SCHEMA` at all `matter()` parse call sites as part of the `matter.stringify` migration in Wave 1.

6. **Windows native `which`/`command -v` throws ENOENT on Win32** — `process-spawner.ts` uses POSIX shell utilities for executable detection that don't exist on native Windows (distinct from WSL). Fix: replace all `which`/`command -v` calls with `fs.access()` checks against absolute candidate paths; fall through to the URI-based open (`rundll32.exe`) when no executable is found.

---

## Implications for Roadmap

Based on research, the dependency chains enforce a four-wave structure. Waves cannot be reordered: the quality gate (Wave 1) must clear before the registry (Wave 2) can be built, and the registry must exist before lazy loading (Wave 3) can be wired.

### Phase 1: Quality Foundation (Wave 1 — Bug Fixes + SDK Upgrade)

**Rationale:** Three critical bugs (rate limiter, Windows exec, date corruption) are currently invisible in CI because `handlers2.ts` integration tests don't exist. The SDK upgrade is a mandatory prerequisite for all spec modernization work. No new tools should ship on a broken foundation.

**Delivers:** A spec-compliant, cross-platform, correctly rate-limited server with `outputSchema`, `annotations`, and `structuredContent` on all 13 existing tools. Full integration test coverage on `handlers2.ts`.

**Addresses:** F-CRIT-01, F-CRIT-02, F-HIGH-01, F-HIGH-03, F-MED-01, F-MED-02, F-MED-03, F-MED-04

**Avoids:** SDK #893 (register all tools before connect), Pitfall 1 (SDK lacks spec fields), Pitfall 3 (rate limiter reset), Pitfall 5 (Windows exec failure), Pitfall 6 (date corruption)

**Research flag:** NEEDS RESEARCH — the SDK 0.6.1 → 1.x migration specifics (McpServer vs Server API surface changes) should be confirmed against actual SDK source before writing migration code. The `McpServer` vs low-level `Server` choice has downstream implications for all tool registration patterns.

### Phase 2: Registry Architecture + High-Value New Tools (Wave 2)

**Rationale:** The tool registry is the structural backbone of the entire expansion. Building it before adding new tools means every new tool goes through the same registration pattern from day one, avoiding a second refactor pass. High-value new tools (`get_link_graph`, `find_orphans`, `search_tags`, `get_outgoing_links`) deliver immediate user value and validate the registry architecture before the more complex lazy-loading wiring in Wave 3.

**Delivers:** `ToolRegistry` class with `Map`/`Set` architecture; `buildRegistry()` factory replacing switch dispatch; graph utility shared by `get_link_graph` and `find_orphans`; 4 new tools registered and enabled by default.

**Addresses:** Tool registry architecture, `get_link_graph`, `find_orphans`, `search_tags`, `get_outgoing_links`

**Implements:** `registry.ts` (new), `meta-tools.ts` skeleton, `index.ts` rewrite, graph utility module

**Avoids:** Anti-pattern 3 (module-level self-registration side effects), Anti-pattern 1 (notification race)

**Research flag:** STANDARD PATTERNS — Map/Set registry architecture is well-documented. No additional research needed for Wave 2 tool implementations (remark pipeline already exists; graph utility is a standard adjacency-list build).

### Phase 3: Lazy Loading (Wave 3)

**Rationale:** Lazy loading is the single highest-impact quality-of-life improvement for LLM usage — it reduces context window usage by 80-85%. It requires the registry to already be wired (Wave 2) and the `onToolListChanged` callback to be connected to the server. Building this after the registry exists means the implementation is additive (add `enable()` calls to existing registry entries) rather than architectural.

**Delivers:** `discover_tools` and `enable_tool` meta-tools always enabled; all other tools disabled by default when `lazy_loading: true`; `notifications/tools/list_changed` emitted on enable operations; `lazy_loading: false` backward-compat mode that restores current all-tools-always-enabled behavior.

**Addresses:** `discover_tools`, `enable_tool`, `notifications/tools/list_changed`, tool registry `alwaysLoaded` flag, config `lazy_loading` field

**Avoids:** Pitfall 4 (notification race — fire `onToolListChanged` without await), SDK Issue #893 (register all tools before connect, disable rather than skip)

**Research flag:** NEEDS RESEARCH — client support for `notifications/tools/list_changed` is known to vary (Claude Desktop does not support it; Cursor and GitHub Copilot do). The `enable_tool` response should include the full tool schema in its body as a fallback so clients that don't process the notification can still use the enabled tool. This design decision should be validated against the actual Claude Code notification handling before finalizing the `enable_tool` response shape.

### Phase 4: Polish + Extended Tools (Wave 4)

**Rationale:** These features add real value but have no blocking dependencies on anything else and can be delivered incrementally without risk to the core architecture.

**Delivers:** `manage_tags`, `archive_note`, `extract_links`, `get_weekly_note`, `list_templates`; per-property `examples` arrays on all tool input schemas; cursor-based pagination on `list_notes`, `search_notes`, `search_tags`; `API_REFERENCE.md` updated to reflect all new tools.

**Addresses:** P2 features from prioritization matrix

**Avoids:** Anti-feature: `create_from_template` variable substitution (deferred); anti-feature: bulk operations without dry-run (deferred)

**Research flag:** STANDARD PATTERNS — all Wave 4 tools follow established patterns from Waves 1-3. Pagination uses the standard MCP cursor pattern (opaque `nextCursor` token). No additional research needed.

### Phase Ordering Rationale

- **Wave 1 first** because three active bugs are invisible to CI (no integration tests on `handlers2.ts`) and the SDK upgrade is a mandatory prerequisite for all spec work. Building new tools before fixing these bugs would require a second refactor pass.
- **Registry before lazy loading** because lazy loading is a configuration layer on top of the registry — it cannot be wired without the `ToolRegistration.alwaysLoaded` field and `enabledTools` Set already existing.
- **High-value tools in Wave 2** rather than Wave 4 because `get_link_graph` and `find_orphans` share a graph utility that must be built once. Building it in Wave 2 means Wave 3 and Wave 4 tools that depend on it (e.g., `find_orphans`) are not blocked.
- **Polish tools last** because they are genuinely independent and deferring them reduces scope risk for the core delivery.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (SDK upgrade):** The `McpServer` vs low-level `Server` API difference has broad implications. Specifically: does `McpServer` support all the existing tool-dispatch patterns, or does it require a full rewrite of `index.ts`? The STACK.md research covers the high-level API but implementation details should be confirmed against the installed v1 SDK source before migration begins.
- **Phase 3 (lazy loading):** Client behavior when `notifications/tools/list_changed` is received but the client does not support it needs to be confirmed for Claude Desktop specifically. The `enable_tool` response schema (does it include the full tool schema in the body?) should be decided before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 2 (registry + new tools):** Map/Set registry is a standard data structure. The remark wikilink pipeline already exists. Graph building (adjacency list from file system walk) is standard.
- **Phase 4 (polish):** All tools follow established patterns. MCP cursor pagination is well-specified.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SDK v1 API verified against official docs and GitHub; version 1.27.1 confirmed on npm Feb 24 2026; all other dependencies confirmed unchanged and compatible |
| Features | HIGH | MCP 2025-11-25 spec sourced from official docs; feature set verified against multiple OSS Obsidian MCP implementations; table stakes / differentiator split is well-supported by competitor analysis |
| Architecture | HIGH | SDK source read directly from node_modules; `sendToolListChanged()` implementation, capability guard logic, and `ToolSchema` shape all verified at the source level; registry pattern is standard |
| Pitfalls | HIGH | Five of seven pitfalls verified directly from source code (`src/tools/index.ts`, `src/platform/process-spawner.ts`, `node_modules` SDK source); two from official GitHub issues with clear reproduction paths |

**Overall confidence:** HIGH

### Gaps to Address

- **SDK Issue #893 fix status:** The post-connect `registerTool()` capability bug is listed as P2/open as of Feb 2026. By the time Wave 1 begins implementation, this may be resolved. Check the exact SDK 1.27.1 changelog before deciding whether to use the sentinel-tool workaround or simply register all tools before `connect()` (the cleaner design that avoids the issue entirely regardless of fix status).
- **outputSchema + isError SDK version:** PR #655 fixes the schema validation bypass for `isError: true` responses. The exact 1.x patch version that includes this fix should be confirmed before finalizing the outputSchema strategy. The safe fallback is to return a schema-valid `structuredContent` even for error paths (include an `error` field in every `outputSchema`).
- **`input_examples` naming convention:** The existing `TOOL_EXPANSION_SPEC.md` uses `input_examples` as a top-level field (non-standard). Research recommends using the JSON Schema 2020-12 `examples` keyword per-property instead. This naming decision should be locked before any new tool schemas are written to avoid a second pass.
- **Claude Desktop `list_changed` support timeline:** Claude Desktop does not currently support `notifications/tools/list_changed`. This means the lazy-loading UX depends on `enable_tool`'s response body including the schema — confirm this is the design intent before Wave 3 implementation.

---

## Sources

### Primary (HIGH confidence)
- [MCP 2025-11-25 Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — `outputSchema`, `structuredContent`, `annotations`, `listChanged` requirements
- [MCP 2025-11-25 Pagination Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/pagination) — cursor-based pagination contract
- [TypeScript SDK server.md docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — `registerTool()` API with `outputSchema`, `structuredContent`, `annotations`
- `node_modules/@modelcontextprotocol/sdk@0.6.1/dist/server/index.d.ts` — `sendToolListChanged()` signature
- `node_modules/@modelcontextprotocol/sdk@0.6.1/dist/server/index.js` — `sendToolListChanged()` implementation, capability guard
- `node_modules/@modelcontextprotocol/sdk@0.6.1/dist/types.js` — `ToolSchema.shape`, `CallToolResultSchema.shape` (confirms missing fields)
- `src/tools/index.ts` — per-call RateLimitManager instantiation (direct observation)
- `src/platform/process-spawner.ts` — `which`/`command -v` without Windows guard (direct observation)
- [SDK Issue #654](https://github.com/modelcontextprotocol/typescript-sdk/issues/654) — outputSchema validation blocks isError responses
- [gray-matter Issue #62](https://github.com/jonschlinkert/gray-matter/issues/62) — date auto-cast to JS Date objects
- [gray-matter Issue #96](https://github.com/jonschlinkert/gray-matter/issues/96) — trailing newline in stringify

### Secondary (MEDIUM confidence)
- [SDK Issue #1132](https://github.com/modelcontextprotocol/typescript-sdk/issues/1132) — `sendToolListChanged()`, automatic notification on `registerTool()`
- [SDK Issue #898](https://github.com/modelcontextprotocol/typescript-sdk/issues/898) — `RegisteredTool.remove()`, `RegisteredTool.update()`
- [SDK Issue #893](https://github.com/modelcontextprotocol/typescript-sdk/issues/893) — post-connect registration capability bug; P2 open Feb 2026
- [MCP Discussion #76](https://github.com/orgs/modelcontextprotocol/discussions/76) — client support status for `list_changed`
- [npm @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — version 1.27.1 confirmed Feb 24, 2026
- [Lazy Loading MCP Tools — ByteBridge](https://bytebridge.medium.com/managing-mcp-servers-at-scale-the-case-for-gateways-lazy-loading-and-automation-06e79b7b964f) — token reduction figures (80-85%)
- [dp-veritas/mcp-obsidian-tools](https://github.com/dp-veritas/mcp-obsidian-tools), [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) — competitor feature survey
- [JSON Schema 2020-12 examples keyword](https://www.learnjsonschema.com/2020-12/meta-data/examples/) — `input_examples` vs `examples` per-property

### Tertiary (LOW confidence)
- [Vercel AI Issue #11441](https://github.com/vercel/ai/issues/11441) — third-party SDK support for `structuredContent`/`outputSchema`; ecosystem awareness only

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
