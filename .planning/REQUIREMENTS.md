# Requirements: Obsidian MCP Server — Milestone 2

**Defined:** 2026-02-26
**Core Value:** Claude can reliably read, write, organize, and navigate Obsidian notes through a spec-compliant, efficient MCP interface.

## v1 Requirements

Requirements for Milestone 2. Each maps to a roadmap phase. Ordered by wave (dependency-enforced).

### SDK Upgrade

- [x] **SDK-01**: Server runs on `@modelcontextprotocol/sdk@^1.27.1` (upgraded from `^0.6.1`)

### Bug Fixes

- [x] **BUG-01**: Rate limiter is a process-level singleton — calling 2× the per-minute limit is correctly rejected (F-CRIT-01)
- [x] **BUG-02**: `open_in_obsidian` works on native Windows without requiring `which` or `command -v` (F-CRIT-02)
- [x] **BUG-03**: `create_note` uses `matter.stringify` with js-yaml JSON_SCHEMA for frontmatter serialization — no manual string interpolation, no date corruption (F-MED-01)
- [x] **BUG-04**: `get_daily_note` returns `path` field consistently across all code branches (F-MED-02)

### MCP Spec Modernization

- [x] **SPEC-01**: All 13 existing tools declare `outputSchema` matching their current response shape
- [x] **SPEC-02**: All 13 existing tools return `structuredContent` alongside `content[0].text` (additive, no breakage)
- [x] **SPEC-03**: All 13 existing tools declare `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- [x] **SPEC-04**: `search_notes` documentation matches runtime behavior — default backend and write-path exceptions are accurate (F-HIGH-03)
- [x] **SPEC-05**: All spec ambiguities in TOOL_EXPANSION_SPEC resolved — `enable_tool` contract, `get_link_graph` full vs traversal modes, ServerConfig typing (F-MED-04)

### Test Coverage

- [x] **TEST-01**: `handlers2.ts` tools have integration tests covering at least one success path and one failure path each (F-MED-03)
- [x] **TEST-02**: All new tools in this milestone have integration tests covering success + failure paths

### Tool Registry Architecture

- [ ] **REGX-01**: `ToolRegistry` class (`src/tools/registry.ts`) centralizes all tool registration using `Map<string, ToolRegistration>` + `Set<string>` of enabled names
- [ ] **REGX-02**: Static switch dispatch in `handleToolCall` is replaced by registry dispatch
- [ ] **REGX-03**: `buildRegistry()` factory in `src/tools/index.ts` replaces `getToolDefinitions()` + switch pattern

### Link Graph Tools

- [ ] **LINK-01**: `get_link_graph` — returns vault-wide directed graph (nodes as note paths, edges as wikilinks, graph stats)
- [ ] **LINK-02**: `find_orphans` — returns notes with no incoming AND no outgoing links
- [ ] **LINK-03**: `search_tags` — returns all tags used in the vault with usage counts per tag
- [ ] **LINK-04**: `get_outgoing_links` — returns all wikilinks from a specific note (complement to existing `get_backlinks`)

### Lazy Loading

- [ ] **LAZY-01**: `discover_tools` meta-tool — returns all registered tools with name, category, description, and enabled status; always enabled
- [ ] **LAZY-02**: `enable_tool` meta-tool — enables a named tool in the current session; always enabled; emits `notifications/tools/list_changed` (non-blocking fire-and-forget)
- [ ] **LAZY-03**: When `lazy_loading: true` (default), only `discover_tools` and `enable_tool` are enabled at session start
- [ ] **LAZY-04**: When `lazy_loading: false`, all tools are enabled at session start (backward-compat mode)
- [ ] **LAZY-05**: `enable_tool` response includes the full tool schema so clients without `list_changed` support can use the tool immediately

### Extended Tools

- [ ] **XTND-01**: `manage_tags` — add or remove tags across one or more notes in a single operation
- [ ] **XTND-02**: `archive_note` — move note to a configurable archive folder with optional frontmatter date stamp
- [ ] **XTND-03**: `extract_links` — return all link types from a note (wikilinks, embeds, external URLs, anchors)
- [ ] **XTND-04**: `get_weekly_note` — get or create the weekly note for a given date (mirrors `get_daily_note`)
- [ ] **XTND-05**: `list_templates` — list available templates in the vault's configured template folder

### Polish

- [ ] **PLSH-01**: All tools declare per-property `examples` arrays (JSON Schema 2020-12) on input schema fields
- [ ] **PLSH-02**: `list_notes` supports cursor-based pagination (`nextCursor` opaque token)
- [ ] **PLSH-03**: `search_notes` supports cursor-based pagination
- [ ] **PLSH-04**: `search_tags` supports cursor-based pagination
- [ ] **PLSH-05**: `API_REFERENCE.md` documents all tools including the new Milestone 2 additions

## v2 Requirements

Deferred to Milestone 3+. Acknowledged but not in this roadmap.

### Bulk Operations

- **BULK-01**: `bulk_update_metadata` — update frontmatter fields across multiple notes matching a filter
- **BULK-02**: `organize_notes` — move a set of notes to a folder based on rules

### Template Execution

- **TMPL-01**: `create_from_template` — create note from template with variable substitution

### Canvas & Export

- **CANV-01**: `get_canvas` — read and return canvas JSON (deferred: format is evolving)
- **EXPRT-01**: `export_note` — export note to HTML/PDF (deferred: requires heavy runtime deps)

### Advanced Link Management

- **LNKM-01**: Wikilink auto-update when `move_note` renames a note (deferred: catastrophic failure surface without vault-wide transaction support)
- **LNKM-02**: `find_broken_links` — return wikilinks that point to non-existent notes
- **LNKM-03**: `set_aliases` — manage YAML aliases for a note

## Out of Scope

| Feature | Reason |
|---------|--------|
| Redis/multi-process rate limiting | In-memory rate limiting is sufficient for single-user, single-process use |
| OAuth or multi-user auth | MCP is a single-user local protocol; authentication is out of model |
| Mobile app or REST API | Server is a local MCP server, not a web service |
| Real-time collaborative editing | Out of scope for a vault management tool |

## Traceability

Roadmap created 2026-02-26. All 35 v1 requirements mapped across 4 phases.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SDK-01 | Phase 1 | Pending |
| BUG-01 | Phase 1 | Complete |
| BUG-02 | Phase 1 | Complete |
| BUG-03 | Phase 1 | Complete |
| BUG-04 | Phase 1 | Complete |
| SPEC-01 | Phase 1 | Complete |
| SPEC-02 | Phase 1 | Complete |
| SPEC-03 | Phase 1 | Complete |
| SPEC-04 | Phase 1 | Complete |
| SPEC-05 | Phase 1 | Complete |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1–4 | Complete (Phase 1) |
| REGX-01 | Phase 2 | Pending |
| REGX-02 | Phase 2 | Pending |
| REGX-03 | Phase 2 | Pending |
| LINK-01 | Phase 2 | Pending |
| LINK-02 | Phase 2 | Pending |
| LINK-03 | Phase 2 | Pending |
| LINK-04 | Phase 2 | Pending |
| LAZY-01 | Phase 3 | Pending |
| LAZY-02 | Phase 3 | Pending |
| LAZY-03 | Phase 3 | Pending |
| LAZY-04 | Phase 3 | Pending |
| LAZY-05 | Phase 3 | Pending |
| XTND-01 | Phase 4 | Pending |
| XTND-02 | Phase 4 | Pending |
| XTND-03 | Phase 4 | Pending |
| XTND-04 | Phase 4 | Pending |
| XTND-05 | Phase 4 | Pending |
| PLSH-01 | Phase 4 | Pending |
| PLSH-02 | Phase 4 | Pending |
| PLSH-03 | Phase 4 | Pending |
| PLSH-04 | Phase 4 | Pending |
| PLSH-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after roadmap creation*
