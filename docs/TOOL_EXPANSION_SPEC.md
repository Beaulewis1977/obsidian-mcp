# Obsidian MCP Server: Tool Expansion Specification

**Version**: 2.0
**Date**: 2026-02-27
**Status**: Draft — Pending Implementation
**Scope**: New tool definitions, lazy loading architecture, and modernization to MCP 2025-11-25 spec

---

## Table of Contents

1. [Current State](#1-current-state)
2. [New Tools — High Priority](#2-new-tools--high-priority)
3. [New Tools — Medium Priority](#3-new-tools--medium-priority)
4. [New Tools — Low Priority (Future)](#4-new-tools--low-priority-future)
5. [Tool Annotations & outputSchema Modernization](#5-tool-annotations--outputschema-modernization)
6. [Progressive Disclosure / Lazy Loading](#6-progressive-disclosure--lazy-loading)
7. [Implementation Order](#7-implementation-order)
8. [Appendix: Full Tool Inventory](#appendix-full-tool-inventory)

---

## 1. Current State

### Implemented Tools (13)

| # | Tool | Category | Description |
|---|------|----------|-------------|
| 1 | `read_note` | Core CRUD | Read note content, frontmatter, links, metadata |
| 2 | `create_note` | Core CRUD | Create note with frontmatter and content |
| 3 | `edit_note` | Core CRUD | Edit note (append, prepend, replace, heading) |
| 4 | `delete_note` | Core CRUD | Delete note with confirmation |
| 5 | `list_notes` | Discovery | List notes with filtering (tag, date, pattern) |
| 6 | `search_notes` | Discovery | Full-text search across vault |
| 7 | `move_note` | Organization | Move/rename note (no auto link update) |
| 8 | `update_frontmatter` | Metadata | Update YAML frontmatter fields |
| 9 | `get_daily_note` | Daily Notes | Get or create daily note |
| 10 | `open_in_obsidian` | App Integration | Open note/vault in Obsidian |
| 11 | `get_backlinks` | Links | Find notes linking to a specific note |
| 12 | `create_folder` | Organization | Create folder in vault |
| 13 | `get_vault_stats` | Discovery | Vault statistics (note count, tags, etc.) |

### What's Missing

Comparing against the original requirements (`obsidian_mcp_requirements.md`), the following planned tools were never built:

- **Graph & link analysis** — `analyze_link_graph`, `get_outgoing_links`, `extract_links`
- **Tag operations** — `search_tags`, `find_orphans`
- **Batch operations** — `organize_notes`, `bulk_update_metadata`, `archive_note`
- **Template support** — `list_templates`, `create_from_template`, `apply_template`
- **Convenience shortcuts** — `add_tags`, `remove_tags`, `set_aliases`, `get_weekly_note`

### Current Architecture Limitations

- **No lazy loading** — All 13 tool schemas sent to client on every `ListTools` request
- **No `outputSchema`** — Not conformant with MCP 2025-11-25 spec
- **No tool annotations** — Missing `readOnlyHint`, `destructiveHint`, etc.
- **No `input_examples`** — Could improve LLM tool-call accuracy significantly
- **No pagination** — `list_notes` and `search_notes` return unbounded results

### Token Footprint Estimate (Current)

At ~400-500 tokens per tool definition:
- **Current (13 tools)**: ~5,500-6,500 tokens
- **After expansion (~20 tools)**: ~8,500-10,000 tokens
- **With lazy loading**: ~1,000-1,500 tokens (2 meta-tools always loaded)

---

## 2. New Tools — High Priority

These provide the most value and fill the biggest gaps in the current tool set.

---

### 2.1 `get_link_graph`

**Category**: Links & Graph
**Priority**: P1
**Method**: Filesystem
**Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: Build and return the vault's link graph — all notes as nodes, all wikilinks as directed edges. Enables AI to reason about vault structure, find clusters, and understand relationships.

#### Input Schema

```typescript
const GetLinkGraphSchema = z.object({
  vault: z.string().optional()
    .describe("Vault name (optional, uses default)"),
  scope: z.enum(["full", "folder"]).default("full")
    .describe("Graph scope: entire vault or specific folder"),
  folder: z.string().optional()
    .describe("Folder path when scope is 'folder'"),
  include_orphans: z.boolean().default(true)
    .describe("Include notes with zero connections"),
  max_depth: z.number().int().min(1).max(10).optional()
    .describe("Max link traversal depth from a starting note (omit for full graph)")
});
```

#### Output Schema

```typescript
const GetLinkGraphOutput = z.object({
  vault: z.string(),
  stats: z.object({
    total_nodes: z.number(),
    total_edges: z.number(),
    orphan_count: z.number(),
    avg_connections: z.number(),
    most_connected: z.array(z.object({
      path: z.string(),
      connections: z.number()
    })).max(10)
  }),
  nodes: z.array(z.object({
    path: z.string(),
    name: z.string(),
    folder: z.string(),
    outgoing_count: z.number(),
    incoming_count: z.number(),
    tags: z.array(z.string()).optional()
  })),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    type: z.enum(["wikilink", "embed", "markdown"])
  }))
});
```

#### Input Examples

```typescript
input_examples: [
  // Full vault graph
  {},

  // Graph for a specific project folder
  {
    scope: "folder",
    folder: "Monetization",
    include_orphans: false
  },

  // Focused subgraph from a starting note
  {
    vault: "recipes",
    max_depth: 2,
    include_orphans: false
  }
]
```

#### Implementation Notes

- Walk all `.md` files, parse wikilinks/embeds using existing remark pipeline
- Build adjacency list in memory, compute stats before returning
- For large vaults (1000+ notes), consider streaming or pagination
- Cache graph data, invalidate on file watcher events

---

### 2.2 `find_orphans`

**Category**: Discovery
**Priority**: P1
**Method**: Filesystem
**Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: Find notes with no incoming or outgoing links. Essential for vault maintenance — orphans often represent forgotten or unintegrated content.

#### Input Schema

```typescript
const FindOrphansSchema = z.object({
  vault: z.string().optional()
    .describe("Vault name (optional)"),
  type: z.enum(["full", "no_incoming", "no_outgoing"]).default("full")
    .describe("full = no links at all, no_incoming = nothing links to it, no_outgoing = links to nothing"),
  exclude_folders: z.array(z.string()).optional()
    .describe("Folders to exclude (e.g. ['templates', 'daily'])"),
  include_metadata: z.boolean().default(false)
    .describe("Include file size and modification date")
});
```

#### Output Schema

```typescript
const FindOrphansOutput = z.object({
  vault: z.string(),
  orphans: z.array(z.object({
    path: z.string(),
    name: z.string(),
    folder: z.string(),
    type: z.enum(["full", "no_incoming", "no_outgoing"]),
    size: z.number().optional(),
    modified: z.string().optional()
  })),
  total: z.number(),
  vault_total: z.number(),
  orphan_percentage: z.number()
});
```

#### Input Examples

```typescript
input_examples: [
  // Find all orphans
  {},

  // Only notes nothing links to (dead ends)
  {
    type: "no_incoming",
    exclude_folders: ["templates", "daily", "attachments"]
  },

  // Orphans with metadata for triage
  {
    vault: "project-notes",
    include_metadata: true
  }
]
```

#### Implementation Notes

- Depends on graph data from `get_link_graph` — share the graph-building logic
- Exclude `.obsidian/` and attachment folders by default

---

### 2.3 `search_tags`

**Category**: Discovery
**Priority**: P1
**Method**: Filesystem
**Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: List all tags used in the vault with usage counts. Enables tag-based vault exploration and organization.

#### Input Schema

```typescript
const SearchTagsSchema = z.object({
  vault: z.string().optional()
    .describe("Vault name (optional)"),
  query: z.string().optional()
    .describe("Filter tags by substring match"),
  sort: z.enum(["name", "count"]).default("count")
    .describe("Sort by tag name or usage count"),
  include_notes: z.boolean().default(false)
    .describe("Include list of note paths per tag")
});
```

#### Output Schema

```typescript
const SearchTagsOutput = z.object({
  vault: z.string(),
  tags: z.array(z.object({
    tag: z.string(),
    count: z.number(),
    notes: z.array(z.string()).optional()
  })),
  total_tags: z.number(),
  total_tagged_notes: z.number()
});
```

#### Input Examples

```typescript
input_examples: [
  // List all tags sorted by most used
  {},

  // Search for tags containing "recipe"
  {
    query: "recipe",
    include_notes: true
  },

  // Alphabetical tag listing
  {
    vault: "project-notes",
    sort: "name"
  }
]
```

#### Implementation Notes

- Scan frontmatter `tags` arrays and inline `#tag` occurrences
- Both YAML frontmatter tags and inline hashtags should be captured
- Normalize: strip `#` prefix, lowercase for matching

---

### 2.4 `get_outgoing_links`

**Category**: Links
**Priority**: P1
**Method**: Filesystem
**Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: Get all links FROM a specific note — the complement to `get_backlinks`. Together they provide complete link context for any note.

#### Input Schema

```typescript
const GetOutgoingLinksSchema = z.object({
  vault: z.string().optional()
    .describe("Vault name (optional)"),
  path: z.string().min(1)
    .describe("Path to the note"),
  resolve: z.boolean().default(true)
    .describe("Check if target notes actually exist"),
  include_embeds: z.boolean().default(true)
    .describe("Include ![[embed]] links")
});
```

#### Output Schema

```typescript
const GetOutgoingLinksOutput = z.object({
  source: z.string(),
  links: z.array(z.object({
    target: z.string(),
    type: z.enum(["wikilink", "embed", "markdown"]),
    alias: z.string().nullable(),
    exists: z.boolean().optional(),
    line: z.number().optional()
  })),
  total: z.number(),
  broken_count: z.number().optional()
});
```

#### Input Examples

```typescript
input_examples: [
  // Basic outgoing links
  { path: "MASTER-BUILD-PLAN.md" },

  // Check for broken links
  {
    path: "Monetization/Monetization strategy.md",
    resolve: true,
    include_embeds: false
  }
]
```

#### Implementation Notes

- Reuse existing remark wikilink parser from `readNote`
- `resolve: true` checks `fs.access()` on each target — useful for finding broken links
- Report line numbers for each link occurrence

---

## 3. New Tools — Medium Priority

These add real value but can be composed from existing tools. Build after high-priority tools.

---

### 3.1 `manage_tags`

**Category**: Metadata
**Priority**: P2
**Method**: Filesystem
**Annotations**: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: Add or remove tags from one or more notes. More convenient than `update_frontmatter` for tag-specific operations.

#### Input Schema

```typescript
const ManageTagsSchema = z.object({
  vault: z.string().optional(),
  paths: z.array(z.string().min(1)).min(1)
    .describe("Note paths to modify"),
  add: z.array(z.string()).optional()
    .describe("Tags to add"),
  remove: z.array(z.string()).optional()
    .describe("Tags to remove"),
});
```

#### Output Schema

```typescript
const ManageTagsOutput = z.object({
  modified: z.array(z.object({
    path: z.string(),
    tags_added: z.array(z.string()),
    tags_removed: z.array(z.string()),
    current_tags: z.array(z.string())
  })),
  total_modified: z.number()
});
```

#### Input Examples

```typescript
input_examples: [
  // Add tags to multiple notes
  {
    paths: ["Ideas/Avatars.md", "Ideas/Recipe ideas social links and videos and images.md"],
    add: ["feature", "v2"]
  },

  // Remove and add in one operation
  {
    paths: ["Monetization/Monetization strategy.md"],
    add: ["reviewed", "q1-2026"],
    remove: ["draft"]
  }
]
```

---

### 3.2 `archive_note`

**Category**: Organization
**Priority**: P2
**Method**: Filesystem
**Annotations**: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: Move a note to an archive folder, optionally adding an archived date to frontmatter. Safer than delete for notes you might need later.

#### Input Schema

```typescript
const ArchiveNoteSchema = z.object({
  vault: z.string().optional(),
  path: z.string().min(1)
    .describe("Note path to archive"),
  archive_folder: z.string().default("_archive")
    .describe("Archive folder path"),
  add_date: z.boolean().default(true)
    .describe("Add archived_date to frontmatter")
});
```

#### Output Schema

```typescript
const ArchiveNoteOutput = z.object({
  original_path: z.string(),
  archive_path: z.string(),
  archived_date: z.string().optional()
});
```

---

### 3.3 `extract_links`

**Category**: Links
**Priority**: P2
**Method**: Filesystem
**Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: Detailed link extraction from a single note — wikilinks, embeds, external URLs, and heading anchors. More detailed than `get_outgoing_links` (includes external URLs and anchors).

#### Input Schema

```typescript
const ExtractLinksSchema = z.object({
  vault: z.string().optional(),
  path: z.string().min(1),
  types: z.array(z.enum(["wikilink", "embed", "markdown", "external"])).optional()
    .describe("Filter by link type (omit for all)")
});
```

#### Output Schema

```typescript
const ExtractLinksOutput = z.object({
  path: z.string(),
  links: z.object({
    wikilinks: z.array(z.object({
      target: z.string(),
      alias: z.string().nullable(),
      line: z.number()
    })),
    embeds: z.array(z.object({
      target: z.string(),
      line: z.number()
    })),
    markdown_links: z.array(z.object({
      text: z.string(),
      url: z.string(),
      line: z.number()
    })),
    external_urls: z.array(z.object({
      url: z.string(),
      text: z.string().nullable(),
      line: z.number()
    }))
  }),
  summary: z.object({
    total: z.number(),
    wikilinks: z.number(),
    embeds: z.number(),
    markdown: z.number(),
    external: z.number()
  })
});
```

---

### 3.4 `get_weekly_note`

**Category**: Daily Notes
**Priority**: P2
**Method**: Hybrid
**Annotations**: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: Get or create a weekly note, similar to `get_daily_note`.

#### Input Schema

```typescript
const GetWeeklyNoteSchema = z.object({
  vault: z.string().optional(),
  week: z.string().optional()
    .describe("ISO week in YYYY-Www format (e.g. '2026-W09'). Defaults to current week."),
  create_if_missing: z.boolean().default(true)
});
```

---

### 3.5 `list_templates`

**Category**: Templates
**Priority**: P2
**Method**: Filesystem
**Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`

**Purpose**: List available templates in the vault's template folder.

#### Input Schema

```typescript
const ListTemplatesSchema = z.object({
  vault: z.string().optional(),
  template_folder: z.string().default("templates")
    .describe("Templates folder path (default: 'templates')")
});
```

#### Output Schema

```typescript
const ListTemplatesOutput = z.object({
  templates: z.array(z.object({
    path: z.string(),
    name: z.string(),
    variables: z.array(z.string()).optional()
  })),
  total: z.number()
});
```

---

## 4. New Tools — Low Priority (Future)

These are valuable but can wait. Listed here for completeness.

| Tool | Category | Description |
|------|----------|-------------|
| `bulk_update_metadata` | Metadata | Update frontmatter across multiple notes matching a filter |
| `organize_notes` | Organization | Batch move/rename notes by criteria (date, tag, etc.) |
| `create_from_template` | Templates | Create note from a template with variable substitution |
| `get_canvas` | App Integration | Read Obsidian `.canvas` files |
| `export_note` | App Integration | Export note to HTML or PDF |
| `set_aliases` | Metadata | Set note aliases in frontmatter |
| `find_broken_links` | Links | Find all wikilinks pointing to non-existent notes vault-wide |

---

## 5. Tool Annotations & outputSchema Modernization

Per MCP spec 2025-11-25, all tools should have `outputSchema` and `annotations`. This applies to both new and existing tools.

### Annotations for All Existing Tools

| Tool | readOnly | destructive | idempotent | openWorld |
|------|----------|-------------|------------|-----------|
| `read_note` | true | false | true | false |
| `create_note` | false | false | false | false |
| `edit_note` | false | false | false | false |
| `delete_note` | false | **true** | true | false |
| `list_notes` | true | false | true | false |
| `search_notes` | true | false | true | false |
| `move_note` | false | false | false | false |
| `update_frontmatter` | false | false | true | false |
| `get_daily_note` | false | false | true | false |
| `open_in_obsidian` | true | false | true | **true** |
| `get_backlinks` | true | false | true | false |
| `create_folder` | false | false | true | false |
| `get_vault_stats` | true | false | true | false |

### outputSchema Requirement

Every tool must define an `outputSchema` so clients can validate and parse responses. This is a **breaking change** to the current implementation but required for spec conformance.

**Migration approach**: Add `outputSchema` to each tool definition in `getToolDefinitions()`. The `structuredContent` field in responses must match the declared schema.

---

## 6. Progressive Disclosure / Lazy Loading

### Why

After this expansion, the server will have **18-23 tools**. At ~400-500 tokens per tool, that's **8,000-11,500 tokens** consumed before any conversation starts.

With lazy loading, only **2 meta-tools** are loaded initially (~800-1,000 tokens). Remaining tools load on demand. **Estimated savings: 80-85%**.

### Architecture: Server-Side Discovery Pattern

This pattern works with any MCP client (Claude Code, Cursor, Windsurf, etc.) without requiring client-side changes.

#### Tool Categories

| Category | Tools | Always Loaded |
|----------|-------|---------------|
| **Meta** | `discover_tools`, `enable_tool` | Yes |
| **Core CRUD** | `read_note`, `create_note`, `edit_note`, `delete_note` | No |
| **Discovery** | `list_notes`, `search_notes`, `search_tags`, `find_orphans`, `get_vault_stats` | No |
| **Links & Graph** | `get_backlinks`, `get_outgoing_links`, `get_link_graph`, `extract_links` | No |
| **Organization** | `move_note`, `create_folder`, `archive_note` | No |
| **Metadata** | `update_frontmatter`, `manage_tags` | No |
| **Daily/Templates** | `get_daily_note`, `get_weekly_note`, `list_templates` | No |
| **App Integration** | `open_in_obsidian` | No |

#### Meta-Tool 1: `discover_tools`

Always loaded. Returns lightweight tool summaries — name, category, one-line description, enabled status. Does NOT return full schemas.

```typescript
// Input
{
  query?: string,    // Keyword search across names and descriptions
  category?: string  // Filter by category
}

// Output
{
  tools: [
    {
      name: "get_link_graph",
      category: "Links & Graph",
      description: "Build and return the vault's link graph with nodes, edges, and statistics",
      enabled: false
    },
    // ...
  ],
  categories: ["Core CRUD", "Discovery", "Links & Graph", ...],
  total: 20,
  enabled: 2
}
```

#### Meta-Tool 2: `enable_tool`

Always loaded. Enables a discovered tool, dynamically registering it so its full schema appears in subsequent `ListTools` responses. Emits `notifications/tools/list_changed` so clients refresh their tool list.

```typescript
// Input
{
  tool_name: string,     // Single tool to enable
  // OR
  category?: string      // Enable all tools in a category
}

// Output
{
  enabled: ["get_link_graph"],
  schema: { /* full JSON schema for the tool */ }
}
```

#### Implementation Flow

```
Client connects
  │
  ├─ ListTools → returns only: discover_tools, enable_tool
  │
  ├─ Agent calls discover_tools({ query: "graph" })
  │   └─ Returns: [{ name: "get_link_graph", ... }, { name: "get_backlinks", ... }]
  │
  ├─ Agent calls enable_tool({ tool_name: "get_link_graph" })
  │   ├─ Server dynamically registers get_link_graph
  │   ├─ Server emits notifications/tools/list_changed
  │   └─ Returns: full schema for get_link_graph
  │
  ├─ Agent calls get_link_graph({ vault: "recipes" })
  │   └─ Returns: graph data
  │
  └─ Session ends, all tools deregistered
```

#### Key Implementation Details

1. **Tool Registry** — Internal `Map<string, ToolDefinition>` holds all tools. Separate `Set<string>` tracks which are enabled.

2. **`list_changed` Notification** — After `enable_tool`, emit `notifications/tools/list_changed` so Claude Code refreshes its tool list without reconnecting.

3. **Category Enable** — `enable_tool({ category: "Core CRUD" })` enables all 4 CRUD tools at once for convenience.

4. **Session State** — Enabled tools persist for the session only. Each new connection starts with only meta-tools.

5. **Backward Compatibility** — Add a config option `lazy_loading: true|false`. When `false`, all tools load upfront (current behavior). Default to `true` for new installs.

#### Config Addition

```json
{
  "version": "1.0",
  "lazy_loading": true,
  "always_loaded_tools": ["discover_tools", "enable_tool"],
  "vaults": [...]
}
```

---

## 7. Implementation Order

### Wave 1: Foundation (Do First)

| Step | Task | Rationale |
|------|------|-----------|
| 1.1 | Add `outputSchema` to all 13 existing tools | Spec compliance, required before adding new tools |
| 1.2 | Add `annotations` to all 13 existing tools | Spec compliance |
| 1.3 | Build shared graph-building utility | Shared by `get_link_graph`, `find_orphans`, `get_outgoing_links` |

### Wave 2: High-Priority Tools

| Step | Task | Dependencies |
|------|------|--------------|
| 2.1 | Implement `get_link_graph` | Graph utility (1.3) |
| 2.2 | Implement `find_orphans` | Graph utility (1.3) |
| 2.3 | Implement `search_tags` | None |
| 2.4 | Implement `get_outgoing_links` | Existing remark parser |

### Wave 3: Lazy Loading

| Step | Task | Dependencies |
|------|------|--------------|
| 3.1 | Create tool registry + meta-tools | Wave 1 complete |
| 3.2 | Migrate existing tools to registry | 3.1 |
| 3.3 | Add `list_changed` notification | 3.2 |
| 3.4 | Add config option + backward compat | 3.2 |
| 3.5 | Test with Claude Code | 3.3, 3.4 |

### Wave 4: Medium-Priority Tools

| Step | Task | Dependencies |
|------|------|--------------|
| 4.1 | Implement `manage_tags` | None |
| 4.2 | Implement `archive_note` | None |
| 4.3 | Implement `extract_links` | Existing remark parser |
| 4.4 | Implement `get_weekly_note` | Existing `get_daily_note` pattern |
| 4.5 | Implement `list_templates` | None |

### Wave 5: Polish

| Step | Task |
|------|------|
| 5.1 | Add `input_examples` to all tools |
| 5.2 | Add pagination to `list_notes`, `search_notes`, `search_tags` |
| 5.3 | Rebuild `dist/` and test all tools end-to-end |
| 5.4 | Update API_REFERENCE.md |

---

## Appendix: Full Tool Inventory

Complete inventory after all waves are implemented.

| # | Tool | Category | Priority | Status |
|---|------|----------|----------|--------|
| 1 | `discover_tools` | Meta | P0 | New |
| 2 | `enable_tool` | Meta | P0 | New |
| 3 | `read_note` | Core CRUD | P0 | Existing |
| 4 | `create_note` | Core CRUD | P0 | Existing |
| 5 | `edit_note` | Core CRUD | P0 | Existing |
| 6 | `delete_note` | Core CRUD | P0 | Existing |
| 7 | `list_notes` | Discovery | P0 | Existing |
| 8 | `search_notes` | Discovery | P0 | Existing |
| 9 | `search_tags` | Discovery | P1 | **New** |
| 10 | `find_orphans` | Discovery | P1 | **New** |
| 11 | `get_vault_stats` | Discovery | P0 | Existing |
| 12 | `get_link_graph` | Links & Graph | P1 | **New** |
| 13 | `get_backlinks` | Links & Graph | P0 | Existing |
| 14 | `get_outgoing_links` | Links & Graph | P1 | **New** |
| 15 | `extract_links` | Links & Graph | P2 | **New** |
| 16 | `move_note` | Organization | P0 | Existing |
| 17 | `create_folder` | Organization | P0 | Existing |
| 18 | `archive_note` | Organization | P2 | **New** |
| 19 | `update_frontmatter` | Metadata | P0 | Existing |
| 20 | `manage_tags` | Metadata | P2 | **New** |
| 21 | `get_daily_note` | Daily/Templates | P0 | Existing |
| 22 | `get_weekly_note` | Daily/Templates | P2 | **New** |
| 23 | `list_templates` | Daily/Templates | P2 | **New** |
| 24 | `open_in_obsidian` | App Integration | P0 | Existing |

**Total**: 24 tools (13 existing + 2 meta + 9 new feature tools)

---

*End of specification.*
