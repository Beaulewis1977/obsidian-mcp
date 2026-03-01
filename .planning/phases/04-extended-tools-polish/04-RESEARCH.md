# Phase 4: Extended Tools + Polish - Research

**Researched:** 2026-02-28
**Domain:** MCP tool implementation — TypeScript/Zod/vitest, Obsidian REST API, JSON Schema 2020-12
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| XTND-01 | `manage_tags` — add or remove tags across one or more notes in a single operation | Frontmatter read-modify-write pattern confirmed via `handleUpdateFrontmatter`; `readNote`+`writeNote` are the right primitives |
| XTND-02 | `archive_note` — move note to configurable archive folder with optional frontmatter date stamp | `moveNote` (fs.rename) already used by `handleMoveNote`; `update_frontmatter` pattern shows frontmatter mutation approach |
| XTND-03 | `extract_links` — return all link types from a note (wikilinks, embeds, external URLs, anchors) | `parseWikilinks` utility already exists; external URL regex needed; markdown link regex needed |
| XTND-04 | `get_weekly_note` — get or create weekly note for given date (mirrors `get_daily_note`) | `handleGetDailyNote` in `handlers2.ts` is the direct template; `dayjs` already a dependency for ISO week math |
| XTND-05 | `list_templates` — list available templates in vault's configured template folder | `listNotes(vault.path, folder)` is the right primitive; folder defaults to "templates" |
| PLSH-01 | All tools declare per-property `examples` arrays (JSON Schema 2020-12) on input schema fields | `zodToJsonSchema` (Zod v3) does not natively emit `examples`; post-process approach confirmed |
| PLSH-02 | `list_notes` supports cursor-based pagination (`nextCursor` opaque token) | MCP pagination spec confirmed; offset-based cursor (base64-encoded integer) is the right approach since Obsidian REST API has no native pagination |
| PLSH-03 | `search_notes` supports cursor-based pagination | Same cursor approach as PLSH-02 |
| PLSH-04 | `search_tags` supports cursor-based pagination | Same cursor approach as PLSH-02 |
| PLSH-05 | `API_REFERENCE.md` documents all tools including Milestone 2 additions | Manual update required; format already established in docs/API_REFERENCE.md |
</phase_requirements>

---

## Summary

Phase 4 adds five medium-priority tools and three polish items to a mature, well-tested registry. All five tools follow patterns already established in prior phases: each lives in a dedicated handler file (or extends an existing one), registers via `buildRegistry()` in `src/tools/index.ts`, has a Zod schema in `src/tools/schemas.ts`, and needs success+failure integration tests. The tools are all filesystem-first (no Obsidian REST API endpoints exist for tags, archiving, weekly notes, or template listing), which simplifies implementation considerably.

The two hardest problems in this phase are the **per-property `examples` arrays** (PLSH-01) and **cursor pagination** (PLSH-02–04). For `examples`: `zod-to-json-schema` v3 does not natively add `examples` to per-property schemas; the correct approach is to define a `withExamples()` post-processing helper that takes the `zodToJsonSchema` output and merges a per-property examples map into it. For pagination: the Obsidian REST API does not paginate natively, so the server must collect all results then slice using an offset cursor encoded as a base64 string.

**Primary recommendation:** Follow the established handler-per-file pattern (create `handlers-extended.ts`), use `withExamples()` as a thin wrapper around `zodToJsonSchema`, and implement pagination as pure server-side offset slicing with `btoa`/`atob`-encoded JSON cursors — no new dependencies needed.

---

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | ^3.22.4 (installed) | Schema definition + validation | All existing schemas use it; `ZodSchema.parse()` is the dispatch contract |
| `zod-to-json-schema` | ^3.22.4 (installed) | Convert Zod schemas to JSON Schema | All 22 existing tools use it; output is the `inputSchema` fed to MCP SDK |
| `gray-matter` | ^4.0.3 (installed) | Frontmatter read/write | Used in `stringifyMarkdown` via `markdown-parser.ts`; `manage_tags` and `archive_note` need it |
| `dayjs` | ^1.11.10 (installed) | Date arithmetic | `get_weekly_note` needs ISO week (`YYYY-[W]WW`) format; `get_daily_note` already uses dayjs |
| `vitest` | ^2.0.0 (installed) | Test framework | All existing tests use it; pre-commit hook requires `vitest --run` |

### Supporting (used by specific tools)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `path` (built-in) | Node.js built-in | Path construction for archive folder | `archive_note` needs `path.join(archive_folder, path.basename(note_path))` |
| `fs/promises` (built-in) | Node.js built-in | Low-level FS access | `list_templates` reads a directory; same as vault management tools |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Post-process `zodToJsonSchema` output | Switch to Zod v4 `z.toJSONSchema()` | Zod v4 is NOT installed and upgrading is a major project-wide change; post-processing is zero-risk |
| Offset cursor (base64 int) | Full result fingerprint cursor | Fingerprinting requires hashing all results; offset is simpler, correct, and stable for immutable in-memory result sets |
| New `handlers-extended.ts` file | Extend `handlers-link.ts` or `handlers2.ts` | Extending existing files makes them too large; consistent with Phase 3.1 creating `handlers-vault.ts` |

**Installation:** No new packages required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/tools/
├── handlers.ts              # Existing: read_note, create_note, edit_note, delete_note, list_notes, search_notes
├── handlers2.ts             # Existing: move_note, update_frontmatter, get_daily_note, open_in_obsidian, get_backlinks, create_folder, get_vault_stats
├── handlers-link.ts         # Existing: get_link_graph, find_orphans, search_tags, get_outgoing_links
├── handlers-meta.ts         # Existing: discover_tools, enable_tool
├── handlers-vault.ts        # Existing: add_vault, remove_vault, list_vaults
├── handlers-extended.ts     # NEW Phase 4: manage_tags, archive_note, extract_links, get_weekly_note, list_templates
├── schemas.ts               # Extended: add 5 new Zod schemas + 5 cursor-extended schemas
├── index.ts                 # Extended: register 5 new tools in buildRegistry(); update tool count test
├── registry.ts              # Unchanged
├── link-graph.ts            # Unchanged
└── __tests__/
    ├── handlers-extended.test.ts   # NEW: integration tests for 5 new tools
    ├── pagination.test.ts          # NEW: cursor pagination tests for list_notes, search_notes, search_tags
    └── (existing test files)
```

### Pattern 1: Handler File Structure (copy from handlers-vault.ts)

**What:** Each handler file exports pure async functions taking `(config: ServerConfig, args: z.infer<typeof Schema>) => Promise<ToolResponse>`.
**When to use:** For every new tool.

```typescript
// Source: src/tools/handlers-vault.ts pattern (verified in codebase)
import type { z } from 'zod';
import { ManageTagsSchema } from './schemas.js';
import type { ServerConfig, ToolResponse } from '../types/index.js';
import { createErrorResponse } from '../utils/errors.js';
import { readNote, listNotes, noteExists } from '../filesystem/vault-reader.js';
import { writeNote } from '../filesystem/vault-writer.js';
import { getDefaultVault, getVaultByName } from '../config/index.js';

function getVault(config: ServerConfig, vaultName?: string) {
  const vault = vaultName ? getVaultByName(config, vaultName) : getDefaultVault(config);
  if (!vault) throw new Error('No vault configured or specified vault not found');
  return vault;
}

export async function handleManageTags(
  config: ServerConfig,
  args: z.infer<typeof ManageTagsSchema>
): Promise<ToolResponse> {
  try {
    // ... implementation
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    return createErrorResponse('Failed to manage tags', error?.message ?? String(error), 'FILESYSTEM_ERROR');
  }
}
```

### Pattern 2: Registry Registration (copy exactly from index.ts)

**What:** Call `registry.register({ definition, handler, schema, category, alwaysLoaded })` in `buildRegistry()`.
**When to use:** Every new tool must be registered here.

```typescript
// Source: src/tools/index.ts — all 22 existing registrations follow this shape
registry.register({
  definition: {
    name: 'manage_tags',
    description: 'Add or remove tags from one or more notes in a single operation',
    inputSchema: withExamples(zodToJsonSchema(ManageTagsSchema), {
      paths: ['Ideas/Note.md', 'Projects/Plan.md'],
      add: ['feature', 'reviewed'],
      remove: ['draft']
    }),
    outputSchema: {
      type: 'object',
      properties: {
        modified: { type: 'array', items: { type: 'object' } },
        total_modified: { type: 'number' },
        error: { type: 'string' },
      },
      required: ['modified', 'total_modified'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  handler: (config, args) => handleManageTags(config, args),
  schema: ManageTagsSchema,
  category: 'Metadata',
  alwaysLoaded: false,
});
```

### Pattern 3: per-property `examples` via `withExamples()` Post-Processor

**What:** `zodToJsonSchema` (Zod v3) does not emit `examples` arrays. The correct approach is a thin post-processor that merges per-property examples into the generated schema.
**When to use:** All 22 existing tool registrations + 5 new ones. Apply in `buildRegistry()`.

The JSON Schema 2020-12 `examples` keyword applies at any subschema level — including individual property schemas within `properties`. Verified via https://www.learnjsonschema.com/2020-12/meta-data/examples/

```typescript
// Source: JSON Schema 2020-12 spec + zod-to-json-schema analysis (confirmed from research)
// Location: Create src/tools/schema-utils.ts (new utility file)

/**
 * Inject per-property `examples` arrays into a zodToJsonSchema() output.
 * The `examples` keyword is a JSON Schema 2020-12 annotation; it does not affect
 * validation but improves LLM tool-call accuracy by showing concrete values.
 *
 * @param schema - Output of zodToJsonSchema(ZodType)
 * @param propertyExamples - Map of property name → examples array
 * @returns Mutated schema object (safe to mutate since zodToJsonSchema returns a new object)
 */
export function withExamples(
  schema: Record<string, any>,
  propertyExamples: Record<string, any[]>
): Record<string, any> {
  if (schema.properties) {
    for (const [propName, examples] of Object.entries(propertyExamples)) {
      if (schema.properties[propName]) {
        schema.properties[propName] = {
          ...schema.properties[propName],
          examples,
        };
      }
    }
  }
  return schema;
}
```

**Usage at registration site:**

```typescript
// Example for read_note — before: zodToJsonSchema(ReadNoteSchema)
// After:
inputSchema: withExamples(zodToJsonSchema(ReadNoteSchema), {
  path: ['daily/2026-02-28.md', 'Projects/My Project.md'],
  vault: ['Personal', 'Work']
}),
```

**Scope of change:** All 22 existing `registry.register()` calls in `src/tools/index.ts` need their `inputSchema` wrapped with `withExamples(...)`. This is mechanical and safe — `zodToJsonSchema` returns a new plain object each time, so mutation is safe.

### Pattern 4: Cursor Pagination (server-side offset)

**What:** Collect all results, slice by page size, encode offset as base64 cursor.
**When to use:** `list_notes`, `search_notes`, `search_tags` (PLSH-02–04).

The MCP spec defines `nextCursor` as opaque to clients but it can be any stable string. Clients MUST pass it unchanged. Invalid cursors should return -32602. See: https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination

The MCP spec's pagination model is for `tools/list`, `resources/list`, etc. — NOT for individual tool call responses. Tool call pagination (cursor in tool input, `nextCursor` in tool response body) is a community pattern for high-volume tools but is NOT yet in the formal spec. Discussion #799 confirms this is a proposal, not an adopted spec. The implementation adds cursor/nextCursor as fields in the tool's own input/output schema — no MCP-level protocol change is needed.

```typescript
// Source: MCP pagination model + project-specific implementation (research-derived pattern)
// Location: Create src/tools/pagination.ts (new utility file)

const PAGE_SIZE = 50; // Configurable default; keeps response sizes reasonable

/**
 * Encode an integer offset as an opaque base64 cursor token.
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString('base64');
}

/**
 * Decode a cursor token back to an integer offset.
 * Returns null for invalid/malformed cursors.
 */
export function decodeCursor(cursor: string): number | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    if (typeof decoded?.offset !== 'number') return null;
    return decoded.offset;
  } catch {
    return null;
  }
}

/**
 * Paginate an array using an optional opaque cursor.
 * Returns the page slice plus the nextCursor (undefined if last page).
 */
export function paginate<T>(
  items: T[],
  cursor?: string,
  pageSize: number = PAGE_SIZE
): { page: T[]; nextCursor?: string } {
  const offset = cursor ? (decodeCursor(cursor) ?? 0) : 0;
  const page = items.slice(offset, offset + pageSize);
  const nextOffset = offset + page.length;
  const nextCursor = nextOffset < items.length ? encodeCursor(nextOffset) : undefined;
  return { page, nextCursor };
}
```

**Schema changes for pagination:** Each paginated tool's Zod schema gets an optional `cursor` input and the outputSchema adds `nextCursor`:

```typescript
// ListNotesSchema extended (do NOT break existing callers)
export const ListNotesSchema = z.object({
  // ... existing fields unchanged ...
  cursor: z.string().optional().describe('Pagination cursor from previous response (omit for first page)'),
});

// outputSchema addition in registry:
outputSchema: {
  type: 'object',
  properties: {
    notes: { type: 'array', items: { type: 'object' } },
    total: { type: 'number' },
    vault: { type: 'string' },
    nextCursor: { type: 'string', description: 'Pass to next call for the following page; absent on last page' },
    error: { type: 'string' }
  },
  required: ['notes', 'total']
},
```

### Pattern 5: `manage_tags` Frontmatter Read-Modify-Write

**What:** Read note, mutate `frontmatter.tags`, write back using `writeNote`.
**When to use:** `manage_tags` only.

```typescript
// Source: handleUpdateFrontmatter pattern (src/tools/handlers2.ts, verified)
// For each path in args.paths:
const note = await readNote(vault.path, notePath);
const currentTags: string[] = Array.isArray(note.frontmatter.tags)
  ? note.frontmatter.tags
  : (note.frontmatter.tags ? [String(note.frontmatter.tags)] : []);

const tagsAfterRemove = args.remove
  ? currentTags.filter(t => !args.remove!.includes(t))
  : currentTags;

const tagsAfterAdd = args.add
  ? Array.from(new Set([...tagsAfterRemove, ...args.add]))
  : tagsAfterRemove;

note.frontmatter = { ...note.frontmatter, tags: tagsAfterAdd };
await writeNote(vault.path, notePath, note);
```

### Pattern 6: `archive_note` as Move + Optional Frontmatter Update

**What:** Create archive folder if needed, move note via `fsMoveNote`, optionally add `archived_date` to frontmatter.
**When to use:** `archive_note` only.

```typescript
// Source: handleMoveNote pattern (src/tools/handlers2.ts) + handleUpdateFrontmatter
// Step 1: Compute archive path (preserve filename)
const archivePath = path.join(args.archive_folder, path.basename(args.path));

// Step 2: Ensure archive folder exists (moveNote handles mkdir for target dir)
// Step 3: Move
await fsMoveNote(vault.path, notePath, archivePath);

// Step 4 (optional): Add archived_date to frontmatter AT NEW LOCATION
if (args.add_date) {
  const archivedNote = await readNote(vault.path, archivePath);
  archivedNote.frontmatter = {
    ...archivedNote.frontmatter,
    archived_date: dayjs().format('YYYY-MM-DD')
  };
  await writeNote(vault.path, archivePath, archivedNote);
}
```

### Pattern 7: `extract_links` — Extended Link Extraction

**What:** Parse wikilinks + embeds using existing `parseWikilinks`, then add markdown link regex and external URL regex.
**When to use:** `extract_links` only.

```typescript
// Source: parseWikilinks already in src/tools/link-graph.ts
// External URL regex: /https?:\/\/[^\s\)\"\']+/g
// Markdown link regex: /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g
// Line tracking: split content by '\n', process line-by-line

const lines = content.split('\n');
for (let lineNum = 0; lineNum < lines.length; lineNum++) {
  const line = lines[lineNum];
  // Match markdown links: [text](url)
  for (const match of line.matchAll(/\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g)) {
    markdown_links.push({ text: match[1], url: match[2], line: lineNum + 1 });
  }
  // Match bare external URLs (not already captured as markdown links)
  for (const match of line.matchAll(/(?<!\()(https?:\/\/[^\s\)\"\'<>]+)/g)) {
    external_urls.push({ url: match[0], text: null, line: lineNum + 1 });
  }
}
```

### Pattern 8: `get_weekly_note` — Mirror of `get_daily_note`

**What:** Use `dayjs` to parse ISO week string (`YYYY-[W]WW`), derive the Monday of that week, generate path from config.
**When to use:** `get_weekly_note` only.

```typescript
// Source: handleGetDailyNote pattern (src/tools/handlers2.ts, verified)
// dayjs already installed; ISO week parsing:
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
dayjs.extend(isoWeek);

const weekStr = args.week ?? `${dayjs().isoWeekYear()}-W${String(dayjs().isoWeek()).padStart(2, '0')}`;
// Parse: "2026-W09" → Monday of that week
const [yearStr, weekStr2] = weekStr.split('-W');
const monday = dayjs().isoWeekYear(parseInt(yearStr)).isoWeek(parseInt(weekStr2)).startOf('isoWeek');

const weeklyConfig = vault.weekly_notes ?? { folder: 'weekly', date_format: 'YYYY-[W]WW' };
const filename = monday.format(weeklyConfig.date_format) + '.md';
const notePath = `${weeklyConfig.folder}/${filename}`;
```

**IMPORTANT:** `dayjs/plugin/isoWeek` requires importing the plugin module and calling `dayjs.extend(isoWeek)`. Verify the import path is compatible with the project's `moduleResolution: "bundler"` tsconfig.

Alternative (simpler, no plugin needed): manually compute week from the string since the path string can be derived directly from the week input without complex date math. Use the input `YYYY-Www` string directly as the filename.

### Pattern 9: `list_templates` — Simple Directory Listing

**What:** Call `listNotes(vault.path, args.template_folder)` then format the result.
**When to use:** `list_templates` only.

```typescript
// Source: handleListNotes pattern (src/tools/handlers.ts, verified)
const templateNotes = await listNotes(vault.path, args.template_folder);
// If folder doesn't exist, listNotes throws or returns []; catch and return empty list
```

**Edge case:** If the template folder doesn't exist, `listNotes` will throw with a filesystem error. Catch it and return `{ templates: [], total: 0 }` with an info note.

### Anti-Patterns to Avoid

- **Hand-rolling YAML serialization in manage_tags:** Always use `writeNote` + `stringifyMarkdown` which calls `matter.stringify`. Direct frontmatter string manipulation causes YAML corruption (BUG-03 in Phase 1 was exactly this).
- **Using Promise.all for sequential reads:** `buildVaultGraph` intentionally uses sequential `for...of` reads. `manage_tags` over multiple notes should also be sequential to avoid 100+ simultaneous file handles.
- **Keeping remark-wiki-link for any wikilink parsing:** Phase 2 research confirmed it does not handle `[[Note|Alias]]` correctly. Always use the existing `parseWikilinks` function from `link-graph.ts`.
- **Registering tools after `server.connect()`:** Per Phase 1 decision log, all tools must be registered in `buildRegistry()` before `server.connect()` (SDK Issue #893).
- **`cursor` as a query parameter that changes results:** The cursor must NOT change what results are available — it only slices the same deterministic result set. Tests should confirm `cursor=undefined` + `cursor=page2token` together cover all items without duplication.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter serialization | Custom YAML string builder | `writeNote` → `stringifyMarkdown` → `matter.stringify` | BUG-03 was caused by hand-rolled YAML; `gray-matter` handles arrays, dates, booleans correctly |
| Wikilink parsing | Custom regex from scratch | `parseWikilinks` in `src/tools/link-graph.ts` | Already handles all 5 Obsidian link formats including `![[embed]]` and `[[Note#Section|Alias]]` |
| Date-to-week-number arithmetic | Custom date math | `dayjs` with isoWeek plugin | Dayjs handles edge cases around year boundaries, ISO week numbering |
| Base64 encode/decode | `btoa`/`atob` shim | `Buffer.from(str).toString('base64')` and `Buffer.from(str, 'base64').toString('utf-8')` | Node.js Buffer is already available; no browser compat needed |
| Atomically moving a file | `fs.copyFile` + `fs.unlink` | `vault-writer.ts` `moveNote` which uses `fs.rename` | `fs.rename` is atomic on same-volume moves; cross-volume handled by the error path |

**Key insight:** This codebase has good shared utilities. `readNote`, `writeNote`, `listNotes`, `moveNote`, `parseWikilinks`, `createErrorResponse`, and `getVault` are all tested and reusable. The five new tools are composition of these primitives.

---

## Common Pitfalls

### Pitfall 1: `manage_tags` on Multi-Note Paths — First Error Silences Rest

**What goes wrong:** If `paths[0]` fails with NOTE_NOT_FOUND, the error response aborts the whole operation and `paths[1..n]` are never processed.
**Why it happens:** Using `createErrorResponse` on first error exits the handler.
**How to avoid:** Collect per-note results including partial failures. Return a `modified` array with success/error per path, not an early abort. Only return `createErrorResponse` if ALL notes fail (or if vault is not found).
**Warning signs:** Tests that call `manage_tags` with mixed valid/invalid paths and expect partial success.

### Pitfall 2: `examples` Injection Mutates Shared Schema Objects

**What goes wrong:** `zodToJsonSchema` in some versions may return a cached or shared object. Mutating it with `withExamples` could affect other callers.
**Why it happens:** JavaScript object reference semantics.
**How to avoid:** In `withExamples`, always spread the property object: `schema.properties[propName] = { ...schema.properties[propName], examples }`. Alternatively, call `JSON.parse(JSON.stringify(schema))` to deep-clone before mutating — but that is slower. The spread approach is sufficient given that `zodToJsonSchema` returns a new object per call.
**Warning signs:** Two tool definitions sharing the same `inputSchema` object reference.

### Pitfall 3: Cursor Pagination Skips Items If Results Change Between Calls

**What goes wrong:** `list_notes` cursor = offset 50. Between call 1 and call 2, a note is added at index 10. Call 2 returns offset 50–100, skipping the newly inserted note AND the original index-50 note.
**Why it happens:** Offset-based pagination is not stable across mutations.
**How to avoid:** This is an acceptable tradeoff. Document it in the tool description: "Cursor-based pagination reflects vault state at each call — results may shift if notes are added/removed between pages." MCP spec guidance: "Clients MUST NOT assume stable result sets across pagination." This is not a bug to fix.
**Warning signs:** Tests that add notes between paginated calls and expect perfect consistency.

### Pitfall 4: `get_weekly_note` ISO Week Edge Case at Year Boundary

**What goes wrong:** January 1 of a year may belong to ISO week 52 or 53 of the prior year. `dayjs().isoWeekYear()` is NOT the same as `dayjs().year()` in late December/early January.
**Why it happens:** ISO 8601 week numbering starts on Monday; January 1 is often in the last week of the prior year.
**How to avoid:** Use `dayjs().isoWeekYear()` (not `.year()`) when deriving the year component. Or accept the input string as-is for the filename without parsing — if `week: "2026-W01"` is given, the filename is `weekly/2026-W01.md` regardless of what actual date that falls on.
**Warning signs:** Tests for `week: "2026-W01"` returning a 2025 file path.

### Pitfall 5: `archive_note` Collision — Note Already Exists at Archive Path

**What goes wrong:** `_archive/note.md` already exists. `fs.rename` overwrites it silently on Linux (but may fail on Windows).
**Why it happens:** `moveNote` does not check for target existence before calling `fs.rename`.
**How to avoid:** Before calling `moveNote`, check if the archive path already exists with `noteExists`. If it does, either fail with a useful error or append a timestamp to the filename.
**Warning signs:** Test that calls `archive_note` twice on the same-named note.

### Pitfall 6: `list_templates` When Template Folder Does Not Exist

**What goes wrong:** `listNotes(vault.path, 'templates')` throws a filesystem error if the folder doesn't exist.
**Why it happens:** `listNotes` calls `fs.readdir` which throws ENOENT.
**How to avoid:** Wrap in try/catch; return `{ templates: [], total: 0, note: "Template folder 'templates' not found" }` rather than an error response.
**Warning signs:** Test with a vault that has no templates folder returns error instead of empty list.

### Pitfall 7: Tool Count Mismatch in Lazy Loading Test

**What goes wrong:** `lazy-loading.integration.test.ts` line 27 asserts `registry.getAll().length === 22`. After adding 5 new tools, this assertion will fail.
**Why it happens:** The test hardcodes the expected tool count.
**How to avoid:** Update the test assertion to 27 (22 + 5) when adding the new tools to `buildRegistry()`.
**Warning signs:** CI failure on `lazy-loading.integration.test.ts` after new tools are registered.

---

## Code Examples

Verified patterns from official sources:

### JSON Schema 2020-12 per-property examples (verified)

```json
// Source: https://www.learnjsonschema.com/2020-12/meta-data/examples/
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "properties": {
    "path": {
      "type": "string",
      "description": "Path to the note relative to vault root",
      "examples": ["daily/2026-02-28.md", "Projects/My Project.md"]
    },
    "vault": {
      "type": "string",
      "description": "Vault name (optional)",
      "examples": ["Personal", "Work"]
    }
  }
}
```

### MCP cursor pagination request/response (verified)

```json
// Source: https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination
// Initial request (no cursor):
{ "tool_call": "list_notes", "params": { "folder": "daily" } }

// Response with more pages:
{
  "notes": [...50 items...],
  "total": 127,
  "nextCursor": "eyJvZmZzZXQiOjUwfQ=="
}

// Subsequent request:
{ "tool_call": "list_notes", "params": { "folder": "daily", "cursor": "eyJvZmZzZXQiOjUwfQ==" } }

// Final page response (no nextCursor = end):
{ "notes": [...27 items...], "total": 127 }
```

### Zod schema for manage_tags (project-consistent)

```typescript
// Source: schemas.ts pattern from existing tools
export const ManageTagsSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)'),
  paths: z.array(z.string().min(1)).min(1)
    .describe('Paths to notes to modify (e.g., ["folder/note.md"])'),
  add: z.array(z.string()).optional()
    .describe('Tags to add to each note'),
  remove: z.array(z.string()).optional()
    .describe('Tags to remove from each note'),
});

export const ArchiveNoteSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)'),
  path: z.string().min(1).describe('Path to note to archive'),
  archive_folder: z.string().default('_archive')
    .describe('Archive destination folder (default: "_archive")'),
  add_date: coerceBool.default(true)
    .describe('Add archived_date field to frontmatter (default: true)'),
});

export const ExtractLinksSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)'),
  path: z.string().min(1).describe('Path to note'),
  types: z.array(z.enum(['wikilink', 'embed', 'markdown', 'external'])).optional()
    .describe('Filter by link type (omit for all types)'),
});

export const GetWeeklyNoteSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)'),
  week: z.string().optional()
    .describe('ISO week in YYYY-Www format (e.g., "2026-W09"; default: current week)'),
  create_if_missing: coerceBool.default(true)
    .describe('Create the weekly note if it does not exist (default: true)'),
});

export const ListTemplatesSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)'),
  template_folder: z.string().default('templates')
    .describe('Templates folder path relative to vault root (default: "templates")'),
});
```

### Integration test pattern (copy from handlers-vault.test.ts)

```typescript
// Source: src/tools/__tests__/handlers-vault.test.ts (verified)
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  noteExists: vi.fn(),
}));
vi.mock('../../filesystem/vault-writer.js', () => ({
  writeNote: vi.fn().mockResolvedValue(undefined),
  moveNote: vi.fn().mockResolvedValue(undefined),
}));

import { handleManageTags } from '../handlers-extended.js';
import { readNote, listNotes, noteExists } from '../../filesystem/vault-reader.js';
import { writeNote } from '../../filesystem/vault-writer.js';

const mockReadNote = vi.mocked(readNote);
const mockNoteExists = vi.mocked(noteExists);
const mockWriteNote = vi.mocked(writeNote);

function makeMockConfig() {
  return {
    version: '1.0',
    vaults: [{ name: 'test', path: '/vault', default: true }],
    rate_limiting: { enabled: false },
  } as any;
}

describe('handleManageTags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds tags to a note successfully', async () => {
    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue({
      path: 'note.md', frontmatter: { tags: ['existing'] }, content: '# Note', links: [], metadata: {} as any
    });

    const result = await handleManageTags(makeMockConfig(), {
      paths: ['note.md'],
      add: ['new-tag'],
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.total_modified).toBe(1);
    expect(payload.modified[0].tags_added).toEqual(['new-tag']);
    expect(mockWriteNote).toHaveBeenCalled();
  });

  it('returns error when no add or remove specified', async () => {
    const result = await handleManageTags(makeMockConfig(), {
      paths: ['note.md'],
    });
    expect(result.isError).toBe(true);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `input_examples` top-level array on tools | Per-property `examples` arrays (JSON Schema 2020-12) | Phase 4 target | Better LLM tool-call accuracy for individual fields |
| Unbounded list/search responses | Cursor-paginated responses with `nextCursor` | Phase 4 target | Prevents very large response payloads for large vaults |
| No weekly note tool | `get_weekly_note` mirrors `get_daily_note` pattern | Phase 4 target | Completes periodic notes coverage |

**Key insight about `input_examples` vs per-property `examples`:** The TOOL_EXPANSION_SPEC.md uses `input_examples: [...]` as a top-level tool property (separate from `inputSchema`). The requirement PLSH-01 specifies the JSON Schema 2020-12 per-property `examples` keyword inside `inputSchema`. These are different. PLSH-01 requires changing the approach from the spec doc: the final implementation must put `examples` inside each property's schema definition, NOT as a separate `input_examples` field.

**Deprecated/outdated:**
- Top-level `input_examples` key on tool definitions: NOT to be implemented (PLSH-01 requires JSON Schema 2020-12 per-property style)
- `remark-wiki-link` v2.0.1: confirmed broken for pipe aliases in Phase 2 research; use `parseWikilinks` function instead

---

## Open Questions

1. **Does `VaultConfig` need a `weekly_notes` config field?**
   - What we know: `VaultConfig` has `daily_notes?: DailyNotesConfig` (folder + date_format + template). `get_weekly_note` would benefit from an analogous `weekly_notes` config.
   - What's unclear: Whether to add `weekly_notes?: WeeklyNotesConfig` to `VaultConfig` or default to `{ folder: 'weekly', date_format: 'YYYY-[W]WW' }` without a config field.
   - Recommendation: Default without config field for Phase 4 simplicity. The `template_folder` input parameter on `list_templates` shows the pattern of accepting the folder via tool argument. `get_weekly_note` can do the same (`week_folder` optional param).

2. **Page size for pagination — hardcoded or configurable?**
   - What we know: MCP spec says "page size is determined by the server." No config option exists currently.
   - What's unclear: Whether 50 is the right default for `list_notes` on large vaults.
   - Recommendation: Hardcode `PAGE_SIZE = 50` in the pagination utility. Add a comment that this can be made configurable later. Do not add config for it now.

3. **`dayjs/plugin/isoWeek` import compatibility with moduleResolution: "bundler"**
   - What we know: The project uses `moduleResolution: "bundler"` (fixed in Phase 1). The `dayjs` main package imports fine. The plugin path `dayjs/plugin/isoWeek` is a CJS sub-path.
   - What's unclear: Whether `dayjs/plugin/isoWeek.js` resolves correctly with bundler resolution.
   - Recommendation: Test the import early. Alternative: implement the ISO week calculation without the plugin by parsing the `YYYY-Www` string directly and using it as the filename — no date arithmetic needed if the path is purely derived from the input string.

4. **`extract_links` — should it deduplicate links from the same source/target?**
   - What we know: The spec says "all link types from a note." A note could link to the same target multiple times.
   - Recommendation: Do NOT deduplicate. Return every occurrence with its line number. Deduplication can be done by the caller.

---

## Obsidian REST API Analysis

**Verified finding:** The Obsidian Local REST API has NO endpoints for:
- Tags (listing, adding, removing)
- Archive operations (moving notes to a folder)
- Weekly/periodic notes creation
- Template listing

**Verified finding:** The Obsidian Local REST API DOES support periodic notes (daily notes) via its API, but `get_weekly_note` like `get_daily_note` should be implemented filesystem-first for reliability and cross-platform consistency (confirmed by reviewing the `handleGetDailyNote` implementation which uses filesystem directly for most operations).

**Conclusion:** All 5 new tools are **filesystem-only**. No API client calls needed. No `ObsidianAPIClient` usage. This simplifies implementation: no API availability checks, no fallback logic.

---

## Sources

### Primary (HIGH confidence)
- JSON Schema 2020-12 `examples` keyword — https://www.learnjsonschema.com/2020-12/meta-data/examples/ — per-property placement confirmed
- MCP Pagination specification — https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination — cursor model, request/response format, implementation guidelines
- `src/tools/index.ts` (codebase, verified) — all 22 existing tool registrations, `zodToJsonSchema` usage pattern
- `src/tools/handlers-vault.ts` (codebase, verified) — canonical handler pattern for Phase 4 new tools
- `src/tools/handlers2.ts` (codebase, verified) — `handleGetDailyNote` template for `get_weekly_note`
- `src/tools/handlers-link.ts` (codebase, verified) — `handleSearchTags` showing full tag scan pattern
- `src/tools/link-graph.ts` (codebase, verified) — `parseWikilinks` utility confirmed for reuse
- `src/tools/schemas.ts` (codebase, verified) — Zod schema patterns, `coerceBool` utility
- `src/tools/registry.ts` (codebase, verified) — ToolRegistry interface and dispatch contract
- `src/tools/__tests__/handlers-vault.test.ts` (codebase, verified) — integration test pattern with vi.mock

### Secondary (MEDIUM confidence)
- `zod-to-json-schema` README — https://github.com/StefanTerdell/zod-to-json-schema — does not natively support `examples` in Zod v3; `postProcess` callback available as alternative
- MCP tool pagination discussion — https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/799 — tool-level `nextCursor` is a community pattern, not yet spec; confirmed using it in tool response body is appropriate
- Obsidian Local REST API README — https://github.com/coddingtonbear/obsidian-local-rest-api — confirms no tag/archive/template/weekly-note endpoints exist

### Tertiary (LOW confidence)
- Zod v4 `.meta({ examples })` pattern — search results confirm Zod v4 supports it natively, but project uses Zod v3; not applicable
- `dayjs/plugin/isoWeek` bundler compatibility — assumed compatible based on `dayjs` main package working; verify during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools use existing dependencies; no new packages
- Architecture: HIGH — patterns verified directly from codebase files
- New tool implementations: HIGH — all 5 tools are compositions of existing utilities
- `examples` keyword approach: HIGH — JSON Schema spec confirmed per-property placement; post-process approach is the correct Zod v3 solution
- Cursor pagination: HIGH — MCP spec confirms opaque cursor model; offset-based implementation is a proven pattern
- Obsidian REST API gaps: HIGH — confirmed absence of tag/archive/template endpoints via README review
- dayjs isoWeek plugin compatibility: LOW — not verified with this exact tsconfig; flag for implementation to verify early

**Research date:** 2026-02-28
**Valid until:** 2026-04-01 (stable libraries; 30-day window appropriate)
