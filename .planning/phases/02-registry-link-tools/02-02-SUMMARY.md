---
phase: 02-registry-link-tools
plan: "02"
subsystem: api
tags: [link-graph, wikilink-parser, graph-builder, tag-extraction, mcp, typescript]

requires:
  - phase: 02-registry-link-tools
    plan: "01"
    provides: ToolRegistry class + buildRegistry() factory with 13 tools registered

provides:
  - 4 new link/graph tools registered in ToolRegistry (LINK-01 through LINK-04)
  - Shared wikilink parser (parseWikilinks) handling all 5 Obsidian link formats via regex
  - Vault-wide directed graph builder (buildVaultGraph) with sequential reads
  - Tag extraction utility (extractInlineTags) covering inline #tags
  - Handlers for get_link_graph, find_orphans, search_tags, get_outgoing_links

affects:
  - 03-lazy-loading (Phase 3 — all 4 new tools have alwaysLoaded: true + category: "Graph" set)

tech-stack:
  added: []
  patterns:
    - "parseWikilinks: regex-based (/(!?)\\[\\[([^\\]]+)\\]\\]/g), NOT remark-wiki-link — correctly handles all 5 Obsidian formats"
    - "buildVaultGraph: nameToPath Map (shortest path wins on basename collision), sequential for...of reads (no Promise.all)"
    - "Graph builder accepts listNotesFn/readNoteFn as parameters (not direct imports) for testability"
    - "handlers-link.ts: structuredContent alongside content[0].text on all 4 handlers (MCP 2025-11-25 compliance)"
    - "getVault() helper duplicated from handlers2.ts — intentional per plan scope (refactor is Phase 3 concern)"

key-files:
  created:
    - src/tools/link-graph.ts
    - src/tools/handlers-link.ts
  modified:
    - src/tools/schemas.ts
    - src/tools/index.ts

key-decisions:
  - "parseWikilinks uses dedicated regex, NOT remark-wiki-link v2.0.1 — v2.0.1 stores pipe-alias links as literal 'Note|Alias' and ignores ![[embed]] entirely (Phase 2 research Pitfall 1)"
  - "buildVaultGraph uses sequential for...of with await, not Promise.all — avoids opening 1000+ file handles simultaneously on large vaults (Phase 2 research Pitfall 3)"
  - "nameToPath shortest-path-wins strategy for basename collision: sort noteList by path.length ascending before building Map (Phase 2 research Pitfall 4)"
  - "frontmatter tags normalized: strip leading # if present (some Obsidian setups include # in YAML tags) (Phase 2 research Pitfall 5)"
  - "handleGetLinkGraph scoped listing with full-vault nameToPath: when folder filter provided, listNotes is scoped but graph resolver uses full vault for correct cross-folder link resolution"

duration: 3min
completed: 2026-02-27
---

# Phase 02 Plan 02: Link Tools Implementation Summary

**4 link/graph tools (get_link_graph, find_orphans, search_tags, get_outgoing_links) implemented with regex wikilink parser, sequential vault graph builder, and tag extraction — all registered in ToolRegistry bringing total to 17 tools**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-27T22:32:17Z
- **Completed:** 2026-02-27T22:35:31Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Created `src/tools/link-graph.ts` with `parseWikilinks` (regex, all 5 Obsidian formats), `extractInlineTags` (inline `#tag` regex with deduplication), and `buildVaultGraph` (single-pass sequential vault walk, nameToPath resolution, reverse-edge incoming fill)
- Added 4 Zod schemas to `src/tools/schemas.ts`: `GetLinkGraphSchema`, `FindOrphansSchema`, `SearchTagsSchema`, `GetOutgoingLinksSchema` with inferred TypeScript types
- Created `src/tools/handlers-link.ts` with all 4 handlers: `handleGetLinkGraph` (graph + stats), `handleFindOrphans` (full/no_incoming/no_outgoing filter), `handleSearchTags` (frontmatter + inline, query filter, count sort), `handleGetOutgoingLinks` (parse + optional resolve)
- Updated `src/tools/index.ts` to import 4 new handlers and schemas, register all 4 new tools — total registry now at 17 tools
- All 97 existing tests pass; pre-commit hook (tsc + vitest + tsup) passes clean on both commits

## Task Commits

Each task was committed atomically:

1. **Task 1: Create link-graph utility and add Zod schemas for 4 new tools** - `0990670` (feat)
2. **Task 2: Create link tool handlers and register in ToolRegistry** - `6fe7b47` (feat)

## Files Created/Modified

- `src/tools/link-graph.ts` — `parseWikilinks`, `extractInlineTags`, `buildVaultGraph`; `ParsedWikilink`, `GraphNode`, `VaultGraph` interfaces (230 lines)
- `src/tools/handlers-link.ts` — `handleGetLinkGraph`, `handleFindOrphans`, `handleSearchTags`, `handleGetOutgoingLinks` (330 lines)
- `src/tools/schemas.ts` — 4 new Zod schemas + type exports appended
- `src/tools/index.ts` — 4 new imports + 4 registry.register() calls; total 17 registrations

## Decisions Made

- `parseWikilinks` uses a dedicated regex (`/(!?)\[\[([^\]]+)\]\]/g`) rather than `remark-wiki-link` v2.0.1 — the library incorrectly stores `[[Note|Alias]]` as the literal value `"Note|Alias"` (unparsed) and completely ignores `![[embed]]` syntax. Regex handles all 5 Obsidian formats correctly in 10 lines.
- `buildVaultGraph` uses sequential `for...of` with `await` rather than `Promise.all` — prevents opening hundreds of concurrent file handles on large vaults.
- `nameToPath` lookup built after sorting notes by path length ascending — when two notes share the same basename, the shortest (most canonical) path wins.
- Frontmatter tags are normalized by stripping any leading `#` prefix — some Obsidian vaults include `#` in YAML tag arrays, others do not. Normalization ensures consistent tag names.
- `handleGetLinkGraph` with `folder` input passes a scoped `listNotes` call but uses the full-vault `nameToPath` for link resolution — ensures cross-folder links are resolved correctly even in folder-scoped graph views.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 17 tools are registered and enabled; Phase 3 lazy loading can selectively set `alwaysLoaded: false` on the 14 non-meta tools
- The 4 new tools have `category: 'Graph'` set — Phase 3 can filter by category for lazy load grouping
- No blockers

## Self-Check

Files exist:
- `src/tools/link-graph.ts` — FOUND
- `src/tools/handlers-link.ts` — FOUND
- `.planning/phases/02-registry-link-tools/02-02-SUMMARY.md` — FOUND

Commits:
- `0990670` — FOUND
- `6fe7b47` — FOUND

## Self-Check: PASSED
