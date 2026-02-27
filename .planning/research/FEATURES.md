# Feature Research

**Domain:** MCP Server — Obsidian Vault Knowledge Management (Milestone 2)
**Researched:** 2026-02-26
**Confidence:** HIGH (MCP spec sourced from official docs; Obsidian tool patterns verified against multiple OSS implementations)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features every quality MCP server must have. Missing these makes the server feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Valid input schemas on all tools | LLMs reject or misuse tools without clear typed schemas | LOW | Already present; ensure `additionalProperties: false` and proper `required` arrays |
| Consistent error shapes | Clients must parse errors reliably; text-only errors are opaque | LOW | Current `createErrorResponse` returns text JSON; add `structuredContent` error shape |
| Stable tool output shapes | LLMs cannot chain tools if output fields change between branches | MEDIUM | F-MED-02 is exact failure: `notePath` vs `path` on `get_daily_note` |
| Rate limiting that actually works | Without process-scoped state, server allows unbounded calls | LOW | F-CRIT-01: move `RateLimitManager` to module-level singleton |
| Cross-platform launch (Windows/Linux/WSL) | Single-user servers run on developer machines across all platforms | MEDIUM | F-CRIT-02: filesystem check for absolute paths, not `which`; URI fallback |
| Correct docs matching runtime defaults | Stale docs erode trust and cause LLM tool-call failures | LOW | F-HIGH-03: `search_notes` default is `filesystem` in schema but `obsidian` in docs |
| Full-text search across vault | Users treating MCP as knowledge base need this immediately | MEDIUM | Already implemented; pagination needed for large vaults |
| CRUD operations on notes | Read, write, edit, delete — the baseline before anything else | MEDIUM | Already implemented (13 tools) |
| Frontmatter serialization correctness | Malformed YAML corrupts notes silently | LOW | F-MED-01: replace manual string interpolation with `matter.stringify` universally |
| Test coverage for all shipped tools | Tools without tests break silently across refactors | MEDIUM | F-MED-03: `handlers2.ts` tools have no integration tests |

### Differentiators (Competitive Advantage)

Features that distinguish this server from the 10+ existing Obsidian MCP implementations. These align with the "spec-compliant, efficient, navigable vault" core value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Lazy loading via `discover_tools` / `enable_tool` | Reduces token footprint from ~10,000-12,000 tokens to ~800-1,000 tokens (80-85% reduction) — directly addresses LLM context budget | HIGH | Requires tool registry (Map + Set), `listChanged` capability, session-scoped enablement; config-gated for backward compat |
| `outputSchema` + `structuredContent` on all tools | Machines can validate responses; LLMs get type hints; enables downstream chaining | HIGH | MCP 2025-11-25 spec feature — no other Obsidian MCP server has this fully implemented |
| Tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) | Clients like ChatGPT and Cursor use these to present safe vs. dangerous tools differently; reduces user friction for read-only operations | LOW | Pure metadata; 4 annotation fields per tool per spec |
| `input_examples` on all tools | Directly improves LLM tool-call accuracy; reduces hallucinated parameter values | LOW | JSON Schema 2020-12 `examples` keyword on each property; annotation only, no validation impact |
| Vault link graph (`get_link_graph`) | Most Obsidian MCP servers stop at backlinks; a full bidirectional graph with stats enables AI-driven vault analysis impossible otherwise | HIGH | Requires graph-building utility shared across link tools; consider pagination for 1000+ note vaults |
| Orphan detection (`find_orphans`) | Vault hygiene use case — AI can surface forgotten notes without user manually browsing | MEDIUM | Depends on graph utility from `get_link_graph` |
| Outgoing links (`get_outgoing_links`) | Completes the link pair with `get_backlinks`; enables "what does this note connect to" queries | LOW | Reuses existing remark wikilink pipeline |
| Tag taxonomy exploration (`search_tags`) | Lets AI navigate vault by tag vocabulary before touching notes; better than `get_vault_stats` alone | LOW | Scan frontmatter + inline `#tag` occurrences; normalize casing |
| Detailed link extraction (`extract_links`) | Wikilinks + embeds + external URLs + anchors in one call; richer than `get_outgoing_links` | MEDIUM | Reuses remark pipeline; categorizes by link type |
| Pagination on list operations | Prevents context overflow for large vaults; spec-compliant cursor design | MEDIUM | `list_notes`, `search_notes`, `search_tags` — MCP cursor pattern: opaque `nextCursor` string |
| `manage_tags` bulk tag operations | Saves multiple `update_frontmatter` calls; natural for "tag all these notes as reviewed" workflows | MEDIUM | Operates on multiple paths; idempotent |
| `archive_note` | Safer alternative to delete; adds `archived_date` to frontmatter automatically | LOW | Wraps `move_note` + `update_frontmatter` logic |
| Weekly note support (`get_weekly_note`) | Natural companion to `get_daily_note`; users with weekly review workflows need this | LOW | Mirror of `get_daily_note` pattern; ISO week format `YYYY-Www` |
| Template listing (`list_templates`) | Prerequisite for AI-driven template creation; surfaces available templates without vault browsing | LOW | Directory listing of template folder; extract variable names from content |
| `notifications/tools/list_changed` emission | Required for lazy loading to work with clients that respect it (Cursor, GitHub Copilot); Claude Desktop does not yet support this | MEDIUM | TypeScript SDK `server.sendNotification` or `tool.enable()` / `tool.disable()` built-in — SDK handles notification automatically when using McpServer high-level API; note: Claude Desktop does NOT currently support this notification |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but should be deliberately excluded from this milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Wikilink auto-update on `move_note` | Moving notes breaks all links; auto-update seems obvious | Requires full vault scan + write to potentially hundreds of files; catastrophic failure mode if pattern matching is wrong; Obsidian itself does this in-app only | Document the limitation prominently; provide `extract_links` + `get_backlinks` so the LLM can perform targeted updates manually |
| Real-time file watching → push notifications to client | Vault changes should notify Claude automatically | `notifications/tools/list_changed` is not the right channel for content changes; MCP has no server-push content subscription primitive in 2025-11-25 spec; file watcher code exists but emits logs only | Keep file watcher for cache invalidation only; do not expose change events through MCP |
| Redis-backed rate limiting | Multi-process rate limiting seems like a natural upgrade | Obsidian MCP is single-user/single-process by design; Redis adds an external service dependency with no real benefit for the use case | In-memory singleton is the right answer; document that Redis would be needed only for a shared multi-user deployment |
| Bulk operations (`organize_notes`, `bulk_update_metadata`) | AI batch processing of many notes seems powerful | Unbounded write operations; partial failure leaves vault in undefined state; no rollback; context window cannot hold verification of 100+ operations | Defer to milestone 3; design with dry-run mode and explicit confirmation |
| `create_from_template` with variable substitution | Natural extension of `list_templates` | Variable extraction from arbitrary template syntax is fragile; Obsidian Templater has its own syntax distinct from Handlebars/Mustache; implementation risk high | Provide `list_templates` to surface available templates; let the LLM read and manually substitute variables using `create_note` |
| Canvas file support (`get_canvas`) | Obsidian canvas is a visual knowledge tool | Canvas JSON format is complex; rapidly evolving; not needed for note-taking workflows | Defer; canvas is a specialized use case that warrants its own tool design |
| Export to HTML/PDF (`export_note`) | Sharing notes outside Obsidian | Requires pandoc or a browser headless engine as runtime dependency; not appropriate for an MCP server | Defer; out of scope for vault navigation |

---

## Feature Dependencies

```
[Rate limiter singleton (F-CRIT-01)]
    └──enables──> [Reliable rate limiting for all tools]

[matter.stringify canonical serializer (F-MED-01)]
    └──enables──> [create_note frontmatter correctness]
                      └──enables──> [manage_tags frontmatter writes]
                                        └──enables──> [archive_note frontmatter]

[Shared graph-building utility]
    └──required by──> [get_link_graph]
    └──required by──> [find_orphans]
    └──required by──> [get_outgoing_links] (partial reuse of link parser)

[get_link_graph]
    └──enhances──> [find_orphans] (find_orphans delegates to graph data)

[MCP 2025-11-25 outputSchema + annotations (F-HIGH-01)]
    └──required by──> [All new tools must launch with outputSchema]
    └──required by──> [structuredContent in all tool responses]
    └──blocks──> [Clients that validate outputSchema will reject non-conformant responses]

[Tool registry (Map + Set)]
    └──required by──> [discover_tools]
    └──required by──> [enable_tool]
    └──required by──> [notifications/tools/list_changed]
    └──required by──> [lazy_loading config gate]

[discover_tools]
    └──enables──> [enable_tool] (user calls discover first, then enable)

[enable_tool]
    └──triggers──> [notifications/tools/list_changed]

[handlers2.ts integration tests (F-MED-03)]
    └──must precede──> [New tool expansion] (regression safety)

[F-MED-02 get_daily_note normalization]
    └──must precede──> [get_weekly_note] (weekly note should follow same output contract)

[F-MED-04 spec ambiguity resolution]
    └──must precede──> [get_link_graph implementation] (start_note + max_depth contract)
    └──must precede──> [enable_tool implementation] (tool_name vs category exclusivity)
```

### Dependency Notes

- **Graph utility must precede `get_link_graph`, `find_orphans`:** Both tools share the same vault-walk + adjacency-list logic. Build once as a shared module, not twice.
- **MCP modernization (F-HIGH-01) must precede new tool additions:** Adding new tools without `outputSchema` grows technical debt; build the pattern once and apply to all new tools at creation time.
- **`handlers2.ts` test gap (F-MED-03) should precede new tool expansion:** Without integration test parity on existing tools, a refactor for lazy loading will break silently.
- **`notifications/tools/list_changed` depends on `enable_tool`:** The notification is emitted as a side effect of enable operations; no notification channel without the registry architecture in place.
- **`discover_tools` + `enable_tool` conflict with `lazy_loading: false` mode:** When lazy loading is disabled, all tools are in the enabled set immediately; `discover_tools` still works (lists all as enabled) but `enable_tool` is a no-op. Design must handle this gracefully.
- **Pagination for `list_notes`, `search_notes`, `search_tags` is independent:** Cursor-based pagination (`nextCursor` opaque token) can be added without touching other features; add in polish wave.

---

## MVP Definition

This is Milestone 2 — the server already ships. MVP here means "what must be done before adding any new tools."

### Launch With (Wave 1 — Quality Foundation)

These are blockers. Do not ship new tools until these are resolved.

- [x] F-CRIT-01: Rate limiter singleton — prevents rate limiting from working at all
- [x] F-CRIT-02: `open_in_obsidian` native Windows fix — broken for the primary target platform
- [x] F-HIGH-01: MCP 2025-11-25 modernization (`outputSchema`, `annotations`, `structuredContent`) — all new tools must launch conformant; retrofitting later is high-effort
- [x] F-HIGH-03: Docs/runtime alignment — stale docs cause LLM tool-call failures
- [x] F-MED-01: `matter.stringify` everywhere — prevents silent YAML corruption
- [x] F-MED-02: `get_daily_note` field name normalization — required before `get_weekly_note` copies the same pattern
- [x] F-MED-03: `handlers2.ts` integration tests — regression safety for refactor waves
- [x] F-MED-04: Spec ambiguity resolution — unambiguous contracts before implementation

### Add After Foundation (Waves 2-4 — New Capability)

- [ ] `get_link_graph` — highest value new tool; enables vault-level AI reasoning
- [ ] `find_orphans` — natural vault hygiene companion; shares graph utility
- [ ] `search_tags` — fills tag exploration gap; low complexity
- [ ] `get_outgoing_links` — completes the backlinks/outgoing link pair
- [ ] `discover_tools` + `enable_tool` — lazy loading meta-tools; token reduction is the single biggest quality-of-life improvement for LLM usage
- [ ] Tool registry architecture replacing static switch dispatch
- [ ] `manage_tags` — multi-note tag management
- [ ] `archive_note` — safe alternative to delete
- [ ] `extract_links` — detailed link type breakdown
- [ ] `get_weekly_note` — weekly review workflow support
- [ ] `list_templates` — prerequisite for future template creation

### Future Consideration (Milestone 3+)

- [ ] `bulk_update_metadata` — deferred; requires dry-run + confirmation design
- [ ] `organize_notes` — deferred; catastrophic failure surface without rollback
- [ ] `create_from_template` — deferred; variable syntax fragility
- [ ] `find_broken_links` — valuable but lower priority than graph analysis
- [ ] `get_canvas` — specialized use case; canvas format is evolving
- [ ] `export_note` — requires heavy runtime dependencies

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Rate limiter singleton (F-CRIT-01) | HIGH | LOW | P0 |
| `open_in_obsidian` Windows fix (F-CRIT-02) | HIGH | LOW | P0 |
| MCP 2025-11-25 modernization (F-HIGH-01) | HIGH | HIGH | P0 |
| Docs alignment (F-HIGH-03) | MEDIUM | LOW | P0 |
| `matter.stringify` everywhere (F-MED-01) | MEDIUM | LOW | P0 |
| `get_daily_note` field normalization (F-MED-02) | MEDIUM | LOW | P0 |
| `handlers2.ts` integration tests (F-MED-03) | HIGH | MEDIUM | P0 |
| Spec ambiguity resolution (F-MED-04) | HIGH | LOW | P0 |
| `get_link_graph` | HIGH | HIGH | P1 |
| `find_orphans` | HIGH | MEDIUM | P1 |
| `search_tags` | HIGH | LOW | P1 |
| `get_outgoing_links` | HIGH | LOW | P1 |
| Lazy loading (discover_tools + enable_tool) | HIGH | HIGH | P1 |
| Tool registry architecture | HIGH | HIGH | P1 |
| `notifications/tools/list_changed` | MEDIUM | MEDIUM | P1 |
| `manage_tags` | MEDIUM | MEDIUM | P2 |
| `archive_note` | MEDIUM | LOW | P2 |
| `extract_links` | MEDIUM | MEDIUM | P2 |
| `get_weekly_note` | MEDIUM | LOW | P2 |
| `list_templates` | MEDIUM | LOW | P2 |
| `input_examples` on all tools | MEDIUM | LOW | P2 |
| Pagination (`list_notes`, `search_notes`, `search_tags`) | MEDIUM | MEDIUM | P2 |
| `API_REFERENCE.md` update | LOW | LOW | P2 |

**Priority key:**
- P0: Must resolve before any new tools ship (quality gate)
- P1: Core new capability for this milestone
- P2: Polish and extended capability; adds real value but not blocking

---

## MCP Spec Feature Reference (2025-11-25)

Research-verified field names and behaviors from official MCP spec documentation.

### Tool Definition Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | 1-128 chars; `[A-Za-z0-9_\-.]`; no spaces |
| `title` | string | No | Human-readable display name |
| `description` | string | No | When/why to use the tool |
| `inputSchema` | JSON Schema object | Yes | Must not be `null`; `{type:"object",additionalProperties:false}` for no-param tools |
| `outputSchema` | JSON Schema object | No | 2025-11-25 addition; if present, `structuredContent` MUST conform |
| `annotations` | ToolAnnotations | No | 2025-11-25 addition; untrusted by clients unless server is trusted |
| `icons` | Icon[] | No | Display icons for UI |

### ToolAnnotations Fields (Confidence: HIGH — official spec)

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `readOnlyHint` | boolean | — | Tool does not modify environment |
| `destructiveHint` | boolean | — | Tool may perform destructive updates (meaningful only when `readOnlyHint: false`) |
| `idempotentHint` | boolean | — | Repeated calls with same args have no additional effect |
| `openWorldHint` | boolean | — | Tool interacts with external entities beyond vault |

### Tool Result Fields

| Field | Type | Notes |
|-------|------|-------|
| `content` | ContentBlock[] | Always present; text, image, audio, resource_link, resource |
| `structuredContent` | object | New in 2025-11-25; must conform to `outputSchema` if defined |
| `isError` | boolean | True for tool execution errors (distinct from protocol errors) |

### Backward Compatibility Rule (Confidence: HIGH — official spec)

"For backwards compatibility, a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block."

This means: add `structuredContent` without removing the existing `content[0].text = JSON.stringify(...)` pattern. Keep both during the transition window.

### Pagination (Confidence: HIGH — official spec)

- Cursor-based; opaque string token
- Request: `{ cursor?: string }` on `tools/list`, `list_notes`, `search_notes`
- Response: `{ results: [...], nextCursor?: string }`
- Clients MUST NOT parse or modify cursor values
- Absent `nextCursor` = end of results
- Invalid cursor SHOULD return error code `-32602`

### `notifications/tools/list_changed` (Confidence: HIGH — spec; MEDIUM — client support)

- Server declares `capabilities.tools.listChanged: true` at connect time
- Server sends notification after tool registry changes
- TypeScript SDK (`McpServer` high-level API): calling `tool.enable()` / `tool.disable()` automatically emits notification
- **Client support reality:** Claude Desktop does NOT currently support this notification. GitHub Copilot and Cursor do. Design for future support — ship the capability now.
- Debounce pattern available in SDK: `debouncedNotificationMethods: ['notifications/tools/list_changed']` to batch rapid changes

### `input_examples` / `examples` in JSON Schema (Confidence: HIGH — JSON Schema 2020-12 spec)

- JSON Schema 2020-12 keyword: `examples` (array)
- Annotation only — does not affect validation
- Can be placed at schema level or on individual property definitions
- MCP `inputSchema` defaults to JSON Schema 2020-12 when no `$schema` field is present
- The TOOL_EXPANSION_SPEC uses `input_examples` as a top-level field name (not a standard JSON Schema keyword); recommend aligning with JSON Schema standard `examples` property on each input property for maximum compatibility, OR keeping `input_examples` as a documentation-only convention in the description field
- **Decision needed:** `examples` per-property (JSON Schema standard) vs `input_examples` top-level (custom, non-standard) — recommend per-property `examples` arrays since they live with the field they document

---

## Competitor Feature Analysis

Based on research of active Obsidian MCP server implementations (February 2026).

| Feature | dp-veritas/mcp-obsidian-tools | cyanheads/obsidian-mcp-server | Epistates/turbovault | Our Approach |
|---------|------------------------------|-------------------------------|---------------------|--------------|
| Backlinks | `obsidian_backlinks` | Yes | Partial | `get_backlinks` (existing) |
| Outgoing links | No | Partial | No | `get_outgoing_links` (new) |
| Full link graph | No | No | Orphan + hub detection | `get_link_graph` full directed graph |
| Orphan detection | No | No | `detect_orphans` | `find_orphans` with type filter |
| Tag search | `obsidian_list_tags` (with count) | Yes | No | `search_tags` (existing `get_vault_stats` + new dedicated tool) |
| Lazy loading | No | No | No | `discover_tools` + `enable_tool` (differentiator) |
| outputSchema | No | No | No | All tools (MCP 2025-11-25 compliance) |
| Tool annotations | No | No | No | All tools (MCP 2025-11-25 compliance) |
| Pagination | No | No | No | `list_notes`, `search_notes`, `search_tags` |
| Weekly notes | No | No | No | `get_weekly_note` |
| Template listing | No | No | No | `list_templates` |
| Multi-vault support | No | No | No | Yes (existing architecture) |
| Windows native | Partial | No explicit support | No | Yes (F-CRIT-02 fix) |

**Observation:** No competing Obsidian MCP server has implemented MCP 2025-11-25 spec features (`outputSchema`, `structuredContent`, `annotations`). Lazy loading is also unique. This is a genuine differentiation opportunity, not just spec compliance checkbox work.

---

## Sources

- [MCP Specification 2025-11-25 — Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — HIGH confidence
- [MCP Specification 2025-11-25 — Pagination](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/pagination) — HIGH confidence
- [MCP TypeScript SDK — notifications/tools/list_changed](https://github.com/modelcontextprotocol/typescript-sdk) — HIGH confidence; client support reality from GitHub discussion #76 — MEDIUM confidence
- [MCP Schema TypeScript source 2025-11-25](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2025-11-25/schema.ts) — HIGH confidence; `ToolAnnotations` fields confirmed
- [JSON Schema 2020-12 — examples keyword](https://www.learnjsonschema.com/2020-12/meta-data/examples/) — HIGH confidence
- [Dynamic Tool Discovery in MCP — Speakeasy](https://www.speakeasy.com/mcp/tool-design/dynamic-tool-discovery) — MEDIUM confidence
- [Lazy Loading MCP Tools — ByteBridge Medium](https://bytebridge.medium.com/managing-mcp-servers-at-scale-the-case-for-gateways-lazy-loading-and-automation-06e79b7b964f) — MEDIUM confidence; token reduction figures
- [m365-core-mcp Lazy Loading Implementation](https://github.com/DynamicEndpoints/m365-core-mcp/blob/main/LAZY_LOADING_COMPLETE.md) — MEDIUM confidence; pattern reference
- [dp-veritas/mcp-obsidian-tools](https://github.com/dp-veritas/mcp-obsidian-tools) — MEDIUM confidence; competitor tool survey
- [Obsidian Graph MCP](https://github.com/drewburchfield/obsidian-graph-mcp) — MEDIUM confidence; competitor graph implementation
- [Writing great tool schemas for MCP — MCP Bundles](https://www.mcpbundles.com/blog/2025/05/06/writing-great-tool-schemas) — MEDIUM confidence; input_examples best practice
- Internal project documents: `docs/TOOL_EXPANSION_SPEC.md`, `docs/FINDINGS_FIX_DECISIONS.md`, `src/tools/index.ts` — HIGH confidence (primary source)

---

*Feature research for: Obsidian MCP Server — Milestone 2 (Vault Tool Expansion)*
*Researched: 2026-02-26*
