# Obsidian MCP Server — Milestone 2

## What This Is

A TypeScript/Node.js MCP server that lets Claude interact with Obsidian vaults — reading, writing, organizing, and navigating notes. The server currently has 13 working tools. This milestone fixes 9 quality findings, modernizes the server to MCP spec 2025-11-25, adds 11 new tools, and introduces progressive lazy loading to reduce token footprint by ~80%.

## Core Value

Claude can reliably read, write, organize, and navigate Obsidian notes through a spec-compliant, efficient MCP interface.

## Requirements

### Validated

<!-- Existing tools — shipped and working. -->

- ✓ `read_note` — read note content, frontmatter, links, metadata
- ✓ `create_note` — create note with frontmatter and content
- ✓ `edit_note` — edit note (append, prepend, replace, heading)
- ✓ `delete_note` — delete note with confirmation
- ✓ `list_notes` — list notes with filtering (tag, date, pattern)
- ✓ `search_notes` — full-text search across vault
- ✓ `move_note` — move/rename note
- ✓ `update_frontmatter` — update YAML frontmatter fields
- ✓ `get_daily_note` — get or create daily note
- ✓ `open_in_obsidian` — open note/vault in Obsidian app
- ✓ `get_backlinks` — find notes linking to a specific note
- ✓ `create_folder` — create folder in vault
- ✓ `get_vault_stats` — vault statistics

### Active

**Bug fixes & quality:**
- [ ] F-CRIT-01: Rate limiter made process-scoped singleton (currently resets per call)
- [ ] F-CRIT-02: `open_in_obsidian` works on native Windows (cross-platform exec detection + URI fallback)
- [ ] F-HIGH-01: MCP 2025-11-25 modernization — `outputSchema`, `annotations`, `structuredContent` on all 13 existing tools
- [ ] F-HIGH-03: Docs aligned with runtime behavior (search mode default, write-path exceptions)
- [ ] F-MED-01: `create_note` frontmatter uses `matter.stringify` instead of manual string interpolation
- [ ] F-MED-02: `get_daily_note` response normalized to consistent field names (`path` in all branches)
- [ ] F-MED-03: Integration test coverage for all `handlers2.ts` tools
- [ ] F-MED-04: TOOL_EXPANSION_SPEC ambiguities resolved (enable_tool contract, get_link_graph modes, ServerConfig typing)

**New tools — P1 (Wave 2):**
- [ ] `get_link_graph` — vault-wide link graph (nodes, edges, stats)
- [ ] `find_orphans` — notes with no incoming or outgoing links
- [ ] `search_tags` — list all vault tags with usage counts
- [ ] `get_outgoing_links` — links FROM a specific note (complement to get_backlinks)

**Lazy loading — P0 (Wave 3):**
- [ ] `discover_tools` — meta-tool: list all tools with name/category/description/enabled status
- [ ] `enable_tool` — meta-tool: dynamically register a tool into the session
- [ ] Tool registry architecture (Map + Set) replacing static switch dispatch
- [ ] `notifications/tools/list_changed` emitted after enable operations
- [ ] Config gate: `lazy_loading: true|false` (backward compatible)

**New tools — P2 (Wave 4):**
- [ ] `manage_tags` — add/remove tags across one or more notes
- [ ] `archive_note` — move note to archive folder with optional frontmatter date
- [ ] `extract_links` — detailed link extraction (wikilinks, embeds, external URLs, anchors)
- [ ] `get_weekly_note` — get or create weekly note (mirrors get_daily_note)
- [ ] `list_templates` — list available templates in vault template folder

**Polish (Wave 5):**
- [ ] `input_examples` added to all tools
- [ ] Pagination for `list_notes`, `search_notes`, `search_tags`
- [ ] `API_REFERENCE.md` updated to match final implementation

### Out of Scope

- Low-priority tools from spec: `bulk_update_metadata`, `organize_notes`, `create_from_template`, `get_canvas`, `export_note`, `set_aliases`, `find_broken_links` — deferred to next milestone
- Redis/multi-process rate limiting backend — in-memory is fine for single-user/single-process use
- F-HIGH-02 (lazy loading) is NOT deferred — it is delivered as Wave 3 in this milestone

## Context

- Stack: TypeScript, Node.js 18+, `@modelcontextprotocol/sdk`, `zod`, `gray-matter`, `remark`, `vitest`, `tsup`
- Build: `tsup` ESM build; pre-commit hook runs tsc + vitest + build
- Two handler modules: `handlers.ts` (core tools) and `handlers2.ts` (later tools — less test coverage)
- Platform support: Windows native, WSL2, Linux
- Rate limiter is currently instantiated per-call inside `handleToolCall` — must become a module-level singleton
- Existing remark wikilink pipeline in `readNote` can be reused for new link tools
- `gray-matter` (`matter.stringify`) is already used in `markdown-parser.ts` for frontmatter — must be used in all write paths

## Constraints

- **Compatibility**: MCP modernization must be additive — keep `content` text during transition, add `structuredContent` alongside
- **Backward compat**: `lazy_loading: false` must preserve current full-tool-list behavior
- **Tests**: All new tools must have at least success + failure integration tests before merge
- **Quality gate**: Pre-commit hook (`tsc --noEmit` + `vitest --run` + `tsup`) must pass on every commit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rate limiter: module-level singleton | Per-call instantiation defeats rate limiting | — Pending |
| MCP modernization: additive rollout | Keep backward compat with older clients | — Pending |
| Lazy loading: config-gated (default true) | Preserve existing behavior for users who rely on full tool list | — Pending |
| `matter.stringify` as canonical frontmatter serializer | Eliminate two-path inconsistency in create_note | — Pending |
| `get_daily_note` normalizes to `path` field | One stable output contract across branches | — Pending |
| `get_link_graph` full vs traversal modes explicit | Resolves F-MED-04 spec ambiguity | — Pending |

---
*Last updated: 2026-02-26 after initialization*
