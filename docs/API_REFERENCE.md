# API Reference

## MCP Tools

This document provides a complete reference for all MCP tools exposed by the Obsidian MCP Server.

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
}
```

---

### `search_notes`

Search vault content using Obsidian's search or filesystem grep.

**Input:**
```typescript
{
  query: string;                   // Search query (supports Obsidian syntax)
  vault?: string;
  mode?: "obsidian" | "filesystem"; // Default: "filesystem" (falls back to filesystem if Obsidian API is unavailable)
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
}
```

---

## Advanced Operations

### `move_note`

Move or rename a note (emulated via copy + delete).

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

