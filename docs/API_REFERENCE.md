# API Reference

## MCP Tools

This document provides a complete reference for all MCP tools exposed by the Obsidian MCP Server.

> **Per-property examples:** All tool input schemas include per-property `examples` arrays (JSON Schema 2020-12) to help LLM clients construct accurate tool calls.

---

## Core Operations

### `read_note`

Read the complete contents of a note including frontmatter and body.

**Input:**
```typescript
{
  path: string;          // Path relative to vault root (e.g., "folder/note.md")
  vault?: string;        // Vault name (optional if only one vault configured)
}
```

**Output:**
```typescript
{
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  links: Array<{
    type: "wikilink" | "embed";
    target: string;
    alias: string | null;
  }>;
  metadata: {
    size: number;
    modified: string;  // ISO 8601 timestamp
  };
}
```

**Example:**
```json
{
  "path": "daily/2024-01-15.md",
  "frontmatter": {
    "title": "Daily Note",
    "tags": ["daily", "journal"]
  },
  "content": "# Daily Note\n\nToday's tasks...",
  "links": [
    { "type": "wikilink", "target": "Project A", "alias": null }
  ],
  "metadata": {
    "size": 1234,
    "modified": "2024-01-15T10:30:00Z"
  }
}
```

---

### `create_note`

Create a new note in the vault with frontmatter and content.

**Input:**
```typescript
{
  path: string;                    // Path for new note (e.g., "daily/2024-01-15.md")
  content: string;                 // Main content (markdown)
  frontmatter?: {                  // YAML frontmatter
    title?: string;
    tags?: string[];               // Must be array for Obsidian v1.9+
    aliases?: string[];
    [key: string]: any;
  };
  vault?: string;
  open_in_obsidian?: boolean;      // Open after creation (default: false)
}
```

**Output:**
```typescript
{
  success: boolean;
  path: string;
  method: "api" | "filesystem";
  message: string;
  cache_warning?: boolean;         // Present if filesystem fallback used
}
```

**Notes:**
- Uses `PUT /vault/{path}` when API available
- Falls back to filesystem write if API unavailable
- Filesystem writes may desync Obsidian cache; consider opening note to refresh

---

### `edit_note`

Edit an existing note with support for targeted insertions.

**Input:**
```typescript
{
  path: string;
  content: string;                 // Content to insert or replacement content
  mode?: "append" | "prepend" | "replace" | "heading";  // Default: "append"
  heading?: string;                // Target heading (when mode="heading")
  vault?: string;
}
```

**Modes:**
- `append`: Add to end of file
- `prepend`: Add to beginning (after frontmatter)
- `replace`: Replace entire content
- `heading`: Insert under specific heading (requires API)

**Output:**
```typescript
{
  success: boolean;
  path: string;
  method: "api" | "filesystem";
}
```

**Notes:**
- When API available: Uses `PATCH /vault/{path}` with v3+ headers
- When API unavailable: Reads file, modifies AST, writes back

---

### `delete_note`

Delete a note from the vault.

**Input:**
```typescript
{
  path: string;
  vault?: string;
  confirm: boolean;                // Must be true to confirm deletion
}
```

**Output:**
```typescript
{
  success: boolean;
  path: string;
  method: "api" | "filesystem";
}
```

**Notes:**
- Requires explicit confirmation
- Uses `DELETE /vault/{path}` when API available

---

## Discovery Operations

### `list_notes`

List all notes in vault or folder with optional filtering.

**Input:**
```typescript
{
  folder?: string;                 // Folder to list (omit for entire vault)
  vault?: string;
  filter?: {
    tag?: string;                  // Filter by tag
    modified_since?: string;       // ISO date
    pattern?: string;              // Filename pattern (glob)
  };
  include_metadata?: boolean;      // Include file metadata (default: false)
  cursor?: string;                 // Pagination cursor from previous response (omit for first page)
}
```

**Output:**
```typescript
{
  notes: Array<{
    path: string;
    name: string;
    folder: string;
    metadata?: {
      size: number;
      modified: string;
      created: string;
    };
  }>;
  total: number;
  nextCursor?: string;             // Pass to next call for the following page; absent on last page
}
```

> **Pagination:** `total` is always the full unpaginated count. Pass `nextCursor` back as `cursor` on the next call to retrieve subsequent pages. Server-side page size is 50.

---

### `search_notes`

Search vault content using Obsidian's search or filesystem grep.

**Input:**
```typescript
{
  query: string;                   // Search query (supports Obsidian syntax)
  vault?: string;
  mode?: "obsidian" | "filesystem"; // Default: "filesystem" (falls back to filesystem if Obsidian API is unavailable)
  cursor?: string;                 // Pagination cursor from previous response (omit for first page)
}
```

**Output:**
```typescript
{
  results: Array<{
    path: string;
    matches: Array<{
      line: number;
      text: string;
      context?: string;
    }>;
  }>;
  total: number;
  nextCursor?: string;             // Pass to next call for the following page; absent on last page
}
```

> **Pagination:** `total` is always the full unpaginated count. Pass `nextCursor` back as `cursor` on the next call to retrieve subsequent pages. Server-side page size is 50.

---

## Advanced Operations

### `move_note`

Move or rename a note (filesystem rename/move).

**Input:**
```typescript
{
  source_path: string;
  target_path: string;
  vault?: string;
  update_links?: boolean;          // NOT IMPLEMENTED (default: false)
}
```

**Output:**
```typescript
{
  success: boolean;
  source_path: string;
  target_path: string;
  warning?: string;                // Warning about link updates
}
```

**Notes:**
- **Filesystem only** — Obsidian REST API has no move/rename endpoint
- Implemented as a filesystem rename/move (`fs.rename`) — atomic on same-volume moves
- Does NOT update wikilinks automatically
- Link-safe rename is a Post-MVP feature

---

### `update_frontmatter`

Update specific frontmatter fields without modifying content.

**Input:**
```typescript
{
  path: string;
  vault?: string;
  updates: Record<string, any>;    // Key-value pairs to update
  merge?: boolean;                 // Merge (true) or replace (false) - default: true
}
```

**Output:**
```typescript
{
  success: boolean;
  path: string;
  frontmatter: Record<string, any>; // Updated frontmatter
}
```

**Notes:**
- **Filesystem only** — Uses read-modify-write via `gray-matter` (no frontmatter endpoint in Obsidian REST API)

---

### `get_daily_note`

Get or create daily note for specified date.

**Input:**
```typescript
{
  date?: string;                   // YYYY-MM-DD format (default: today)
  vault?: string;
  create_if_missing?: boolean;     // Default: true
}
```

**Output:**
```typescript
{
  path: string;
  created: boolean;                // True if note was created
  content?: string;                // Content if note exists
}
```

---

## Graph Tools

### `get_link_graph`

Get a directed graph of all notes in the vault showing links between them, with graph statistics.

**Input:**
```typescript
{
  vault?: string;   // Vault name (optional)
  folder?: string;  // Limit graph to a specific folder (optional)
}
```

**Output:**
```typescript
{
  vault: string;
  stats: {
    note_count: number;
    edge_count: number;
    density: number;
  };
  nodes: Array<{ path: string; name: string; folder: string; tags: string[]; incoming: string[]; outgoing: string[] }>;
  edges: Array<{ source: string; target: string }>;
}
```

**Example:**
```json
{
  "vault": "Personal",
  "stats": { "note_count": 3, "edge_count": 2, "density": 0.33 },
  "nodes": [
    { "path": "A.md", "name": "A", "folder": "", "tags": [], "incoming": [], "outgoing": ["B.md"] }
  ],
  "edges": [{ "source": "A.md", "target": "B.md" }]
}
```

---

### `find_orphans`

Find notes with no incoming and/or no outgoing links (orphaned notes).

**Input:**
```typescript
{
  vault?: string;
  type?: "full" | "no_outgoing" | "no_incoming";  // Default: "full"
}
```

**Output:**
```typescript
{
  vault: string;
  type: string;
  orphans: Array<{ path: string; name: string; folder: string; tags: string[] }>;
  total: number;
  total_notes: number;
}
```

---

### `search_tags`

Search for tags used across the vault with per-tag usage counts. Supports cursor pagination.

**Input:**
```typescript
{
  vault?: string;
  query?: string;   // Filter tags by prefix or substring (optional)
  cursor?: string;  // Pagination cursor from previous response (omit for first page)
}
```

**Output:**
```typescript
{
  vault: string;
  tags: Array<{ tag: string; count: number; notes: string[] }>;
  total: number;       // Full count of matching tags (not page count)
  query?: string;
  nextCursor?: string; // Pass to next call; absent on last page
}
```

> **Pagination:** Page size is 50. See `list_notes` pagination note for usage.

---

### `get_outgoing_links`

Get all outgoing wikilinks and embeds from a specific note.

**Input:**
```typescript
{
  path: string;             // Path to the note
  vault?: string;
  include_embeds?: boolean; // Include ![[embed]] links (default: true)
  resolve?: boolean;        // Check if each link target exists in vault (default: false)
}
```

**Output:**
```typescript
{
  source: string;
  links: Array<{ type: "wikilink" | "embed"; target: string; alias: string | null; exists?: boolean }>;
  total: number;
  broken_count: number;
}
```

---

## Meta Tools (Lazy Loading)

> By default the server starts with only `discover_tools` and `enable_tool` enabled (lazy loading). Use `discover_tools` to browse available tools, then `enable_tool` to activate the ones you need.

### `discover_tools`

List all available tools with name, category, description, and enabled status.

**Input:**
```typescript
{
  query?: string;    // Filter by keyword in name or description (optional)
  category?: string; // Filter by category name, e.g. "Graph" (optional)
}
```

**Output:**
```typescript
{
  tools: Array<{ name: string; category: string; description: string; enabled: boolean }>;
  categories: string[];
  total: number;
  enabled_count: number;
  total_enabled: number;
}
```

---

### `enable_tool`

Enable a tool for the current session. Returns the full tool schema for immediate use.

**Input:**
```typescript
{
  tool_name: string;  // Name of the tool to enable
}
```

**Output:**
```typescript
{
  enabled: string[];      // Tool names now enabled (may include tool_name)
  already_enabled: boolean;
  schema: object;         // Full JSON Schema for the tool — usable without awaiting notifications/tools/list_changed
}
```

---

## Vault Management

### `add_vault`

Create and register a new Obsidian vault (creates folder on disk, registers in obsidian.json and MCP config).

**Input:**
```typescript
{
  name: string;            // Unique display name
  path: string;            // Absolute path on disk
  create_folder?: boolean; // Create folder if it doesn't exist (default: true)
  default?: boolean;       // Set as default vault (default: false)
  obsidian_api?: {
    enabled: boolean;
    url: string;           // e.g. "http://localhost:27123"
    api_key?: string;
  };
}
```

**Output:**
```typescript
{
  success: boolean;
  vault_name: string;
  path: string;
  folder_created: boolean;
  obsidian_registered: boolean;
  mcp_registered: boolean;
  note?: string;
}
```

---

### `remove_vault`

Unregister a vault from Obsidian and MCP config. Cannot remove the last vault or the default vault.

**Input:**
```typescript
{
  name: string;            // Vault display name
  delete_folder?: boolean; // Delete folder from disk (default: false)
  confirm: true;           // Must be explicitly true — cannot be omitted
}
```

**Output:**
```typescript
{
  success: boolean;
  vault_name: string;
  path: string;
  folder_deleted: boolean;
  obsidian_unregistered: boolean;
  mcp_unregistered: boolean;
}
```

---

### `list_vaults`

List all configured vaults with disk status, Obsidian registration status, and note counts.

**Input:**
```typescript
{}  // No parameters
```

**Output:**
```typescript
{
  vaults: Array<{
    name: string;
    path: string;
    default: boolean;
    exists_on_disk: boolean;
    registered_in_obsidian: boolean;
    note_count: number;
    obsidian_api_enabled: boolean;
  }>;
  total: number;
}
```

---

## Extended Tools

### `manage_tags`

Add or remove tags from one or more notes in a single operation. Handles partial success — notes that cannot be found are reported in results without aborting the operation.

**Input:**
```typescript
{
  vault?: string;
  paths: string[];   // One or more note paths (relative to vault root)
  add?: string[];    // Tags to add
  remove?: string[]; // Tags to remove
}
```

At least one of `add` or `remove` must be provided.

**Output:**
```typescript
{
  modified: Array<{
    path: string;
    tags_before: string[];
    tags_after: string[];
    tags_added: string[];
    tags_removed: string[];
    changed: boolean;
    error?: string;  // Present if this note could not be processed
  }>;
  total_modified: number;
}
```

---

### `archive_note`

Move a note to a configurable archive folder, optionally stamping an `archived_date` field in the frontmatter. Fails if the archive target path already exists.

**Input:**
```typescript
{
  vault?: string;
  path: string;                        // Note to archive
  archive_folder?: string;             // Default: "_archive"
  add_date?: boolean;                  // Stamp archived_date in frontmatter (default: true)
}
```

**Output:**
```typescript
{
  success: boolean;
  original_path: string;
  archive_path: string;
  archived_date?: string;  // ISO date (YYYY-MM-DD), present when add_date=true
}
```

---

### `extract_links`

Extract all link types from a note: wikilinks, embeds, markdown links, and bare external URLs. Returns each occurrence with its line number (where available).

**Input:**
```typescript
{
  vault?: string;
  path: string;
  types?: Array<"wikilink" | "embed" | "markdown" | "external">;  // Filter (omit for all)
}
```

**Output:**
```typescript
{
  path: string;
  wikilinks: Array<{ type: "wikilink"; target: string; alias: string | null }>;
  embeds: Array<{ type: "embed"; target: string }>;
  markdown_links: Array<{ text: string; url: string; line: number }>;
  external_urls: Array<{ url: string; text: null; line: number }>;
  total: number;
}
```

---

### `get_weekly_note`

Get or create the weekly note for a given ISO week. Mirrors `get_daily_note` for weekly periodic notes.

**Input:**
```typescript
{
  vault?: string;
  week?: string;                // YYYY-Www format, e.g. "2026-W09" (default: current week)
  week_folder?: string;         // Default: "weekly"
  date_format?: string;         // dayjs format for filename (default: "YYYY-[W]WW")
  create_if_missing?: boolean;  // Create the note if it does not exist (default: true)
}
```

**Output:**
```typescript
{
  path: string;
  created: boolean;
  week: string;
  frontmatter: Record<string, any>;
  content: string;
}
```

---

### `list_templates`

List available template notes in the vault's configured templates folder. Returns an empty list (not an error) if the folder does not exist.

**Input:**
```typescript
{
  vault?: string;
  template_folder?: string;  // Default: "templates"
}
```

**Output:**
```typescript
{
  templates: Array<{ path: string; name: string }>;
  total: number;
  template_folder: string;
  note?: string;  // Info message when folder was not found
}
```

---

## Obsidian Local REST API Integration

### API Endpoints Used

| Operation | Method | Endpoint | Notes |
|-----------|--------|----------|-------|
| Create/Replace | PUT | `/vault/{path}` | Idempotent create/replace |
| Append | POST | `/vault/{path}` | Append content |
| Edit (targeted) | PATCH | `/vault/{path}` | With v3+ headers |
| Delete | DELETE | `/vault/{path}` | Remove note |
| Open | POST | `/open/{filename}` | Open in Obsidian |
| Search | GET | `/search/` | Query vault |

### Write-Path Exceptions

Most write operations prefer the Obsidian REST API when available and fall back to the filesystem. The following tools are **filesystem-only** and never use the API:

**Exceptions:**
- `move_note` — filesystem only (no move/rename endpoint in Obsidian REST API)
- `update_frontmatter` — filesystem only (read-modify-write using `gray-matter`)
- `create_folder` — filesystem only (no folder-creation endpoint in Obsidian REST API)

### PATCH Headers (v3+)

Modern header set for targeted edits:

```typescript
{
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'text/markdown',
  'Operation': 'insert',              // insert, replace, delete
  'Target-Type': 'heading',           // heading, block, line
  'Target': 'Daily Notes',            // Target identifier
  'Create-Target-If-Missing': 'true', // Create if missing
  'Trim-Target-Whitespace': 'true',   // Trim whitespace
  'Apply-If-Content-Preexists': 'false' // Conditional apply
}
```

### Authentication

All API requests require Bearer token authentication:

```typescript
headers: {
  'Authorization': `Bearer ${OBSIDIAN_API_KEY}`
}
```

Store API key in environment variables, never in code.

---

## Error Responses

All tools return errors in a consistent format:

```typescript
{
  error: string;                   // Error message
  details: string;                 // Detailed explanation
  suggestion?: string;             // Actionable suggestion
  code: string;                    // Error code
}
```

### Common Error Codes

- `NOTE_NOT_FOUND` - Note does not exist
- `INVALID_PATH` - Path validation failed
- `API_UNAVAILABLE` - Obsidian API not accessible
- `PERMISSION_DENIED` - Filesystem permission error
- `INVALID_FRONTMATTER` - Frontmatter parsing failed
- `VAULT_NOT_FOUND` - Vault not configured

---

## Configuration

### Vault Configuration

```json
{
  "vaults": [
    {
      "name": "MyVault",
      "path": "/absolute/path/to/vault",
      "default": true,
      "obsidian_api": {
        "enabled": true,
        "url": "https://127.0.0.1:27124",
        "api_key": "${OBSIDIAN_API_KEY}",
        "verify_ssl": false
      }
    }
  ]
}
```

### Feature Flags

```json
{
  "features": {
    "file_watching": true,
    "auto_open_notes": false,
    "prefer_api": true,
    "fallback_to_filesystem": true
  }
}
```

---

**Related Documents:**
- [Main Blueprint](compass_artifact_wf-fe9f07c2-63af-4612-9659-b34a1053148a_text_markdown.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [Testing Checklist](TESTING_CHECKLIST.md)
- [Troubleshooting](TROUBLESHOOTING.md)

