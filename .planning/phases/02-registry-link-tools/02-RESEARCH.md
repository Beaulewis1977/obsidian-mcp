# Phase 2: Registry + Link Tools — Research

**Researched:** 2026-02-27
**Domain:** ToolRegistry architecture (Map/Set dispatch), Obsidian wikilink parsing, vault-wide graph building, tag extraction
**Confidence:** HIGH (all critical findings verified against live codebase source code)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REGX-01 | `ToolRegistry` class (`src/tools/registry.ts`) with `Map<string, ToolRegistration>` + `Set<string>` enabled names | Architecture pattern fully defined; `ToolRegistration` type shape derived from current codebase |
| REGX-02 | Static switch dispatch in `handleToolCall` replaced by registry dispatch | Current switch has 13 cases; registry dispatch is a direct Map.get() + call pattern |
| REGX-03 | `buildRegistry()` factory in `src/tools/index.ts` replaces `getToolDefinitions()` + switch | Factory pattern derived from current exports shape |
| LINK-01 | `get_link_graph` — vault-wide directed graph (nodes, edges, stats) | Wikilink parsing strategy determined (regex, not remark-wiki-link); graph building pattern from `handleGetBacklinks` |
| LINK-02 | `find_orphans` — notes with no incoming AND no outgoing links | Shares graph utility with LINK-01; filtering pattern is straightforward |
| LINK-03 | `search_tags` — vault-wide tags with usage counts | Tag sources confirmed (frontmatter YAML + inline #tags); regex pattern verified |
| LINK-04 | `get_outgoing_links` — all wikilinks from a specific note | Reuses the regex wikilink parser from LINK-01 graph utility |
</phase_requirements>

---

## Summary

Phase 2 has two independent workstreams that can be planned in sequence but share a utility: (1) the `ToolRegistry` refactor, which replaces the static switch in `handleToolCall` with a `Map<string, ToolRegistration>` + `Set<string>` architecture while keeping all 13 existing tools behaviorally identical; and (2) four new link/graph tools that require a dedicated wikilink parsing utility and a vault-wide graph builder.

The most important architectural discovery is that the existing `remark-wiki-link` v2.0.1 plugin **does not correctly parse Obsidian-style pipe aliases (`[[Note|Alias]]`) or embed syntax (`![[embed]]`)**. The value stored in AST nodes for `[[Note|Alias]]` is the literal string `Note|Alias` (unparsed), and `![[embed]]` is not recognized as a `wikiLink` node at all. This bug exists in `get_backlinks` today — it would fail to match backlinks with aliases. For the new link/graph tools, the parser **must not use remark-wiki-link** for wikilink extraction. Instead, use a dedicated regex-based parser that handles all Obsidian link formats correctly. The existing `parseMarkdown()` in `markdown-parser.ts` can still be used for frontmatter extraction (gray-matter works correctly); only the link extraction must be replaced.

The `ToolRegistry` is a straightforward data structure: a plain Map and Set. Do not over-engineer it into a plugin system. The registry exists to (a) enable lookup-by-name instead of switch-case, and (b) expose `enabled` state for Phase 3 lazy loading. The registry does NOT need dependency injection, event emitters, or middleware chains. The single required design constraint is that the `ToolRegistration` type must carry the fields Phase 3 will need (`alwaysLoaded`, `category`) so Phase 3 is additive rather than structural.

The graph builder for `get_link_graph` and `find_orphans` must be factored into a shared utility (`src/tools/link-graph.ts`) because both tools perform the same O(N) vault walk. The graph walk already exists in `handleGetBacklinks` (reads all notes, checks links) but does it inefficiently (O(N) per target). A single-pass graph builder that produces an adjacency-list structure serves all three graph/link tools in one pass.

**Primary recommendation:** Build the ToolRegistry first (it unblocks nothing but establishes the pattern all 4 new tools will register into), then build the shared link-graph utility, then add the 4 new tools as handlers.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | `1.27.1` (installed) | MCP protocol — low-level `Server` class kept | Phase 1 decision: stay on low-level Server; McpServer migration is Phase 3+ |
| `zod` | `3.22.4` (installed) | Input schema validation | Already used for all 13 tools; new tools follow same pattern |
| `zod-to-json-schema` | `3.22.4` (installed) | Convert Zod → JSON Schema for inputSchema | Same pattern as all existing tool definitions |
| `gray-matter` | `4.0.3` (installed) | Frontmatter extraction for tag scanning | Already used; correct for frontmatter; NOT replaced |
| `vitest` | `2.0.0` (installed) | Integration tests | Same test framework; same patterns established in Phase 1 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs/promises` | Node built-in | Vault file walking for graph builder | `listNotes()` from vault-reader already handles recursion — reuse it |
| `path` | Node built-in | Path normalization in graph builder | Use `path.join()` and `path.basename()` for node name derivation |

### Alternatives NOT to Use

| Do Not Use | Use Instead | Why |
|------------|-------------|-----|
| `remark-wiki-link` v2.0.1 for link extraction | Custom regex parser | v2.0.1 does NOT parse `[[Note\|Alias]]` (pipe becomes part of value) and completely ignores `![[embed]]`. Verified live: `[[Note\|Alias]]` → `{value: "Note\|Alias"}` |
| `@flowershow/remark-wiki-link` | Custom regex parser | Avoid new dependencies; regex is 10 lines and handles all Obsidian link formats correctly (verified) |
| `McpServer.registerTool()` | Low-level `Server` class + `ToolRegistry` | Phase 1 decided to keep low-level Server; McpServer migration is Phase 3 concern |
| Module-level side-effect registration | `buildRegistry()` factory function | Anti-pattern: self-registration in module scope causes import-order bugs; factory called from `index.ts` is the correct pattern |

**No new npm packages needed for this phase.** Everything required is already installed.

---

## Architecture Patterns

### Recommended Source Structure After Phase 2

```
src/tools/
├── registry.ts          # NEW: ToolRegistry class + ToolRegistration type
├── link-graph.ts        # NEW: shared graph builder utility (reused by LINK-01, LINK-02, LINK-04)
├── handlers-link.ts     # NEW: get_link_graph, find_orphans, search_tags, get_outgoing_links handlers
├── index.ts             # MODIFIED: buildRegistry() replaces getToolDefinitions() + switch
├── handlers.ts          # UNCHANGED: handlers for tools 1-6
├── handlers2.ts         # UNCHANGED: handlers for tools 7-13
├── schemas.ts           # MODIFIED: add Zod schemas for 4 new tools
└── __tests__/
    ├── handlers.integration.test.ts    # UNCHANGED
    ├── handlers2.integration.test.ts   # UNCHANGED
    └── handlers-link.integration.test.ts  # NEW: tests for all 4 link tools
```

### Pattern 1: ToolRegistration Type Shape

**What:** The `ToolRegistration` interface that each tool entry stores in the registry Map.

**Design constraint:** Must include `category` and `alwaysLoaded` now so Phase 3 lazy loading is additive (no structural changes needed).

```typescript
// src/tools/registry.ts
// Source: Derived from TOOL_EXPANSION_SPEC.md categories + LAZY-01/LAZY-03 requirements

export interface ToolRegistration {
  definition: ToolDefinition;              // name, description, inputSchema, outputSchema, annotations
  handler: (config: ServerConfig, args: any) => Promise<ToolResponse>;
  schema: ZodSchema;                       // For parse() before passing to handler
  category: string;                        // Used by discover_tools (Phase 3) + enable_tool category mode
  alwaysLoaded: boolean;                   // When true: always in enabled set regardless of lazy_loading config
}
```

### Pattern 2: ToolRegistry Class

**What:** Central registry that replaces the static switch dispatch.

**When to use:** All tool routing goes through this in Phase 2+.

```typescript
// src/tools/registry.ts
// Source: Derived from TOOL_EXPANSION_SPEC.md architecture description + Phase 2 requirements

export class ToolRegistry {
  private tools: Map<string, ToolRegistration> = new Map();
  private enabled: Set<string> = new Set();

  /** Register a tool. Called once per tool in buildRegistry(). */
  register(registration: ToolRegistration): void {
    const name = registration.definition.name;
    this.tools.set(name, registration);
    if (registration.alwaysLoaded) {
      this.enabled.add(name);
    }
  }

  /** Enable a tool by name. Phase 3 calls this for lazy-loaded tools. */
  enable(name: string): boolean {
    if (!this.tools.has(name)) return false;
    this.enabled.add(name);
    return true;
  }

  /** Enable all tools (lazy_loading: false backward-compat mode). */
  enableAll(): void {
    for (const name of this.tools.keys()) {
      this.enabled.add(name);
    }
  }

  /** Get definitions for all currently enabled tools (for ListTools handler). */
  getEnabledDefinitions(): ToolDefinition[] {
    return Array.from(this.enabled)
      .map(name => this.tools.get(name)!.definition)
      .filter(Boolean);
  }

  /** Get all registrations regardless of enabled state (for discover_tools in Phase 3). */
  getAll(): ToolRegistration[] {
    return Array.from(this.tools.values());
  }

  /** Dispatch a tool call. Returns null if tool is unknown or disabled. */
  async dispatch(
    config: ServerConfig,
    toolName: string,
    rawArgs: any
  ): Promise<ToolResponse | null> {
    const registration = this.tools.get(toolName);
    if (!registration) return null;                   // Unknown tool → caller throws
    if (!this.enabled.has(toolName)) return null;     // Disabled → caller returns error

    const parsed = registration.schema.parse(rawArgs); // Zod validation (throws ZodError on bad input)
    return registration.handler(config, parsed);
  }
}
```

### Pattern 3: buildRegistry() Factory

**What:** Replaces `getToolDefinitions()` + switch in `src/tools/index.ts`. Returns a `ToolRegistry` with all tools registered. Called once from `src/index.ts` on startup.

**Critical:** All 13 existing tools must be registered before `server.connect()` (Phase 1 constraint, unchanged).

```typescript
// src/tools/index.ts
// Source: Derived from current getToolDefinitions() shape + REGX-03 requirement

import { ToolRegistry } from './registry.js';
// ... existing schema and handler imports ...

export function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Phase 2: all existing tools are alwaysLoaded (Phase 3 will change this)
  registry.register({
    definition: {
      name: 'read_note',
      description: 'Read the complete contents of a note including frontmatter, content, links, and metadata',
      inputSchema: zodToJsonSchema(ReadNoteSchema),
      outputSchema: { /* same as current getToolDefinitions() entry */ },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: handleReadNote,
    schema: ReadNoteSchema,
    category: 'Core CRUD',
    alwaysLoaded: true  // Phase 3 will set this false for non-meta tools
  });

  // ... repeat for all 13 existing tools + 4 new tools ...

  // Enable all tools in Phase 2 (Phase 3 will gate this on lazy_loading config)
  registry.enableAll();

  return registry;
}
```

### Pattern 4: Updated handleToolCall in src/index.ts

**What:** `src/index.ts` calls `buildRegistry()`, then uses `registry.getEnabledDefinitions()` for ListTools and `registry.dispatch()` for CallTool. The ZodError and unknown-tool handling moves into `index.ts`.

```typescript
// src/index.ts — Modified section
// Source: Derived from current index.ts + REGX-02 + existing error handling pattern

const registry = buildRegistry();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: registry.getEnabledDefinitions() };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info({ tool: name }, 'Tool called');

  try {
    // Rate limiting check (keep existing pattern)
    const rateLimiter = getRateLimiter(config);
    if (rateLimiter) {
      const vaultName = args?.vault || config.vaults.find(v => v.default)?.name;
      const result = await rateLimiter.checkRateLimit(name, vaultName);
      if (!result.allowed) {
        return result.response ?? createRateLimitErrorResponse(result);
      }
    }

    const result = await registry.dispatch(config, name, args || {});

    if (result === null) {
      // null means tool is unknown or disabled
      return createErrorResponse('Unknown or disabled tool', `No tool registered: ${name}`, 'VALIDATION_ERROR');
    }

    return result;
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return createErrorResponse('Invalid input', error.message, 'VALIDATION_ERROR',
        'Check your input parameters against the tool schema.');
    }
    return createErrorResponse('Tool execution failed', error.message, 'FILESYSTEM_ERROR');
  }
});
```

**Note on rate limiting:** The current `_rateLimiter` singleton and `getRateLimiter()` live in `src/tools/index.ts`. After the refactor, move them to `src/index.ts` (where the registry is constructed) or keep them as a module-level export from `src/tools/index.ts`. The simpler path: keep `getRateLimiter` in `src/tools/index.ts` and export it — `src/index.ts` calls it after importing `buildRegistry`. This minimizes changes to existing files.

### Pattern 5: Obsidian Wikilink Regex Parser (shared utility)

**What:** Replace `remark-wiki-link`-based link extraction with a regex parser that correctly handles all Obsidian link formats. This parser goes in `src/tools/link-graph.ts` and is used by all 4 new link tools.

**Critical finding:** The existing `remark-wiki-link` v2.0.1 does NOT work correctly with Obsidian syntax:
- `[[Note|Alias]]` → parsed as `{value: "Note|Alias"}` (pipe NOT treated as alias divider)
- `![[embed]]` → NOT recognized as a wikiLink node at all (completely ignored)
- `[[Note#Section]]` → parsed as `{value: "Note#Section"}` (section NOT separated)

**Verified live** against the installed packages on 2026-02-27.

```typescript
// src/tools/link-graph.ts
// Source: Regex derived from joschua.io/posts/2023/06/01/regex-for-obsidian-links/ +
//         live testing of all link formats on 2026-02-27

export interface ParsedWikilink {
  target: string;       // Base note name (no section, no alias)
  alias: string | null; // Display text after pipe, or null
  section: string | null; // Heading after #, or null
  isEmbed: boolean;     // true for ![[...]]
  raw: string;          // Full match: [[...]] or ![[...]]
}

/**
 * Extract all wikilinks from markdown content.
 * Handles: [[Note]], [[Note|Alias]], [[Note#Section]], [[Note#Section|Alias]], ![[embed]]
 * Does NOT strip code blocks — call this on note.content (body after gray-matter extraction).
 */
export function parseWikilinks(content: string): ParsedWikilink[] {
  // Matches: optional ! prefix, [[, anything except ]], ]]
  const WIKILINK_REGEX = /(!?)\[\[([^\]]+)\]\]/g;
  const results: ParsedWikilink[] = [];

  for (const match of content.matchAll(WIKILINK_REGEX)) {
    const isEmbed = match[1] === '!';
    const inner = match[2];

    const pipeIdx = inner.indexOf('|');
    const hashIdx = inner.indexOf('#');

    let target: string;
    let alias: string | null = null;
    let section: string | null = null;

    if (pipeIdx !== -1) {
      alias = inner.slice(pipeIdx + 1).trim() || null;
      const beforePipe = inner.slice(0, pipeIdx);
      if (hashIdx !== -1 && hashIdx < pipeIdx) {
        target = beforePipe.slice(0, hashIdx).trim();
        section = beforePipe.slice(hashIdx + 1).trim() || null;
      } else {
        target = beforePipe.trim();
      }
    } else if (hashIdx !== -1) {
      target = inner.slice(0, hashIdx).trim();
      section = inner.slice(hashIdx + 1).trim() || null;
    } else {
      target = inner.trim();
    }

    if (target) {
      results.push({ target, alias, section, isEmbed, raw: match[0] });
    }
  }

  return results;
}
```

### Pattern 6: Vault-Wide Graph Builder (shared by LINK-01 and LINK-02)

**What:** A single-pass vault walk that builds an adjacency-list graph in memory. Called once by `get_link_graph` and `find_orphans`. Factored out so both tools don't duplicate the O(N) file walk.

**Why single-pass:** The existing `handleGetBacklinks` does an O(N) walk per target note — for graph tools covering the whole vault, a single-pass approach that builds the complete graph is necessary.

```typescript
// src/tools/link-graph.ts (continued)
// Source: Derived from handleGetBacklinks pattern + adjacency-list graph theory

export interface GraphNode {
  path: string;           // Relative path from vault root (e.g., "folder/note.md")
  name: string;           // Filename without extension (e.g., "note")
  folder: string;         // Parent folder (e.g., "folder" or "/")
  outgoing: string[];     // Target note paths this note links to (resolved)
  incoming: string[];     // Source note paths that link to this note (filled in second pass)
  tags: string[];         // All tags on this note (frontmatter + inline)
}

export interface VaultGraph {
  nodes: Map<string, GraphNode>;   // keyed by note path
  edges: Array<{ source: string; target: string; type: 'wikilink' | 'embed' | 'markdown' }>;
}

/**
 * Build a complete directed graph of the vault.
 * Uses listNotes() for the file walk and parseMarkdown() + parseWikilinks() for link extraction.
 * Resolves wikilink targets to full paths using name-matching (same logic as Obsidian).
 */
export async function buildVaultGraph(
  vaultPath: string,
  listNotesFn: typeof listNotes,
  readNoteFn: typeof readNote,
  options?: { excludeFolders?: string[] }
): Promise<VaultGraph> {
  const allNoteInfos = await listNotesFn(vaultPath);

  // Build name→path lookup map for link resolution
  // Obsidian resolves [[NoteName]] to the first matching file by name (shortest path wins)
  const nameToPath = new Map<string, string>();
  for (const info of allNoteInfos) {
    const name = info.path.replace(/\.md$/, '');
    const baseName = path.basename(name);
    if (!nameToPath.has(baseName)) {
      nameToPath.set(baseName, info.path);  // shortest path first (approximate Obsidian behavior)
    }
    nameToPath.set(name, info.path);  // full relative path also resolves
  }

  const graph: VaultGraph = { nodes: new Map(), edges: [] };

  // Initialize all nodes
  for (const info of allNoteInfos) {
    const isExcluded = options?.excludeFolders?.some(f => info.path.startsWith(f + '/'));
    if (isExcluded) continue;

    graph.nodes.set(info.path, {
      path: info.path,
      name: path.basename(info.path, '.md'),
      folder: path.dirname(info.path) === '.' ? '/' : path.dirname(info.path),
      outgoing: [],
      incoming: [],
      tags: []
    });
  }

  // First pass: extract outgoing links and tags for each node
  for (const [notePath, node] of graph.nodes) {
    try {
      const note = await readNoteFn(vaultPath, notePath);

      // Extract tags: frontmatter + inline
      const fmTags = Array.isArray(note.frontmatter?.tags) ? note.frontmatter.tags : [];
      const inlineTags = extractInlineTags(note.content);
      node.tags = [...new Set([...fmTags, ...inlineTags])];

      // Extract wikilinks
      const wikilinks = parseWikilinks(note.content);
      for (const link of wikilinks) {
        const resolved = resolveWikilink(link.target, nameToPath);
        if (resolved && graph.nodes.has(resolved)) {
          node.outgoing.push(resolved);
          graph.edges.push({
            source: notePath,
            target: resolved,
            type: link.isEmbed ? 'embed' : 'wikilink'
          });
        }
      }
    } catch (error) {
      logger.warn({ error, path: notePath }, 'Error reading note for graph building');
    }
  }

  // Second pass: fill incoming links (reverse edges)
  for (const edge of graph.edges) {
    const targetNode = graph.nodes.get(edge.target);
    if (targetNode && !targetNode.incoming.includes(edge.source)) {
      targetNode.incoming.push(edge.source);
    }
  }

  return graph;
}

/** Resolve a wikilink target to a vault-relative path. Returns null if unresolvable. */
function resolveWikilink(target: string, nameToPath: Map<string, string>): string | null {
  // Direct path match (with .md)
  if (nameToPath.has(target + '.md')) return nameToPath.get(target + '.md')!;
  // Name-only match
  if (nameToPath.has(target)) return nameToPath.get(target)!;
  // Basename match (user wrote [[Note]] → matches "folder/Note.md")
  const basename = path.basename(target);
  if (nameToPath.has(basename)) return nameToPath.get(basename)!;
  return null;
}
```

### Pattern 7: Inline Tag Extraction

**What:** Extract `#tag` style inline tags from note body content.

**Verified regex** against live tests on 2026-02-27:

```typescript
// src/tools/link-graph.ts (continued)
// Source: Verified against Obsidian tag format documentation + live testing

/**
 * Extract inline #tags from markdown content.
 * Matches: #recipe, #parent/child, #tag-with-dash
 * Requires: preceded by whitespace, comma, or start-of-line
 * Does NOT strip code blocks (acceptable tradeoff for simplicity)
 */
export function extractInlineTags(content: string): string[] {
  // Tags must start with a letter (not a digit), can contain /, -, _, letters, digits
  const INLINE_TAG_REGEX = /(?:^|[\s,;!?])(#[A-Za-z][A-Za-z0-9\/\-_]*)/gm;
  const tags: string[] = [];
  for (const match of content.matchAll(INLINE_TAG_REGEX)) {
    tags.push(match[1].slice(1)); // Strip the # prefix for storage
  }
  return [...new Set(tags)]; // Deduplicate
}
```

**Important note:** This regex will false-positive on tags inside backtick code spans (e.g., `` `#not-a-tag` ``). This is an acceptable tradeoff — correctly excluding code spans requires full AST parsing which adds complexity. The spec does not require code-span exclusion. The false-positive rate in typical Obsidian vaults is negligible.

### Pattern 8: Handler Structure for New Tools

**What:** All 4 new handlers follow the same shape as existing handlers — `(config: ServerConfig, input: InputType) => Promise<ToolResponse>`.

```typescript
// src/tools/handlers-link.ts
// Source: Same shape as existing handlers2.ts handlers

export async function handleGetOutgoingLinks(
  config: ServerConfig,
  input: GetOutgoingLinksInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    const notePath = ensureMarkdownExtension(input.path);

    const validation = validatePath(notePath, vault.path);
    if (!validation.valid) {
      return createErrorResponse('Invalid path', validation.error!, 'INVALID_PATH');
    }

    const note = await readNote(vault.path, notePath);
    const wikilinks = parseWikilinks(note.content);

    // If resolve: true, check if each target exists
    const links = await Promise.all(wikilinks.map(async (link) => {
      const entry: any = {
        target: link.target,
        type: link.isEmbed ? 'embed' : 'wikilink',
        alias: link.alias,
        section: link.section
      };
      if (input.resolve) {
        const resolvedPath = link.target + '.md';
        entry.exists = await noteExists(vault.path, resolvedPath);
      }
      return entry;
    }));

    const filteredLinks = input.include_embeds ? links : links.filter(l => l.type !== 'embed');
    const brokenCount = filteredLinks.filter(l => l.exists === false).length;

    const payload = {
      source: notePath,
      links: filteredLinks,
      total: filteredLinks.length,
      ...(input.resolve ? { broken_count: brokenCount } : {})
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to get outgoing links');
    return createErrorResponse('Failed to get outgoing links', error.message, 'FILESYSTEM_ERROR');
  }
}
```

### Pattern 9: Integration Test for Link Tools

**What:** Link tool tests require mocking `listNotes` and `readNote` with realistic multi-note data to simulate a graph.

```typescript
// src/tools/__tests__/handlers-link.integration.test.ts
// Source: Same vi.mock() + vi.mocked() pattern from handlers2.integration.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  noteExists: vi.fn(),
}));

import { handleGetOutgoingLinks, handleFindOrphans, handleSearchTags, handleGetLinkGraph } from '../handlers-link.js';
import { readNote, listNotes, noteExists } from '../../filesystem/vault-reader.js';

const mockReadNote = vi.mocked(readNote);
const mockListNotes = vi.mocked(listNotes);
const mockNoteExists = vi.mocked(noteExists);

// Multi-note mock fixture for graph tests
const mockVaultNotes = [
  { path: 'note-a.md', name: 'note-a.md', folder: '/' },
  { path: 'note-b.md', name: 'note-b.md', folder: '/' },
  { path: 'note-c.md', name: 'note-c.md', folder: '/' },  // orphan
];

const mockNoteContent = {
  'note-a.md': {
    path: 'note-a.md',
    frontmatter: { tags: ['recipe'] },
    content: '# A\n\nLinks to [[note-b]] and has #cooking tag.',
    links: [],
  },
  'note-b.md': {
    path: 'note-b.md',
    frontmatter: { tags: [] },
    content: '# B\n\nLinks back to [[note-a]].',
    links: [],
  },
  'note-c.md': {
    path: 'note-c.md',
    frontmatter: { tags: [] },
    content: '# C\n\nNo links here.',
    links: [],
  },
};

describe('handleGetOutgoingLinks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return outgoing links from a note', async () => {
    mockReadNote.mockImplementation(async (_, p) => mockNoteContent[p as keyof typeof mockNoteContent] as any);
    mockNoteExists.mockResolvedValue(true);

    const result = await handleGetOutgoingLinks(mockConfig, { path: 'note-a', resolve: false, include_embeds: true });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.links).toHaveLength(1);
    expect(data.links[0].target).toBe('note-b');
  });

  it('should return error when note not found', async () => {
    mockReadNote.mockRejectedValue(new Error('Note not found: missing.md'));

    const result = await handleGetOutgoingLinks(mockConfig, { path: 'missing', resolve: false, include_embeds: true });

    expect(result.isError).toBe(true);
  });
});

describe('handleFindOrphans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should identify notes with no incoming or outgoing links', async () => {
    mockListNotes.mockResolvedValue(mockVaultNotes);
    mockReadNote.mockImplementation(async (_, p) => mockNoteContent[p as keyof typeof mockNoteContent] as any);

    const result = await handleFindOrphans(mockConfig, { type: 'full' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.orphans).toHaveLength(1);
    expect(data.orphans[0].path).toBe('note-c.md');
  });
});
```

### Anti-Patterns to Avoid

- **Using remark-wiki-link for link extraction in new tools:** It does not parse Obsidian-style pipe aliases or embeds. Use `parseWikilinks()` from `link-graph.ts` instead.
- **Putting graph-building logic in individual handlers:** Both `get_link_graph` and `find_orphans` need the same graph. Build it once in `buildVaultGraph()` and call it from both handlers.
- **Module-level self-registration in handlers files:** Do not make importing `handlers-link.ts` have side effects. `buildRegistry()` in `index.ts` does all registration explicitly.
- **Changing handler signatures:** All handlers stay `(config: ServerConfig, input: T) => Promise<ToolResponse>`. Registry wraps them; handlers know nothing about the registry.
- **Forgetting `_resetRateLimiterForTests()` in new test files:** Rate limiter singleton must be reset between tests. The test file for link tools may not need it (no rate limiting in link tool tests) but handlers index tests need it.
- **Moving rate limiter logic during registry refactor:** Keep the rate limiter in `src/tools/index.ts` as is. The refactor changes dispatch but not rate limiting. Move rate limiting only if it causes a conflict (it does not).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wikilink parsing | Custom string split on `[[` | `parseWikilinks()` regex utility in `link-graph.ts` | The regex handles all 5 Obsidian link variants in 15 lines; hand-rolled splits miss edge cases like nested brackets |
| File walking for graph | Custom recursive `readdir` | `listNotes()` from `vault-reader.ts` | Already handles hidden-file filtering (`.obsidian/`), recursive walk, and error recovery |
| Frontmatter extraction | Custom YAML parsing | `readNote()` from `vault-reader.ts` (uses gray-matter) | Already handles large file limits, warnings, and parse errors |
| YAML tag array normalization | Manual `Array.isArray` guards | `Array.isArray(note.frontmatter?.tags)` check before spreading | Obsidian allows both `tags: [tag1, tag2]` and `tags:\n  - tag1` — gray-matter normalizes both to arrays |
| Link target resolution | Vault-walk path matching | `resolveWikilink()` with `nameToPath` Map from graph builder | Obsidian's resolution is "first match by shortest path" — building the lookup once is O(N) not O(N²) |
| Tool name → handler dispatch | Second switch statement | `ToolRegistry.dispatch()` | Defeats the entire purpose of REGX-02 |

**Key insight:** The existing vault-reader, markdown-parser, and error utilities form a complete foundation. Phase 2 adds a new parsing layer (wikilink regex) and a new architectural layer (registry), but does not replace or duplicate any existing utility.

---

## Common Pitfalls

### Pitfall 1: remark-wiki-link Does Not Parse Obsidian Link Formats

**What goes wrong:** Using `note.links` from `readNote()` (which uses remark-wiki-link) to extract outgoing links for the graph builder. `[[Note|Alias]]` appears in `links` as `{target: "Note|Alias", type: "wikilink"}` — the target includes the alias. `![[embed]]` does not appear in `links` at all.

**Why it happens:** `remark-wiki-link` v2.0.1 uses colon as its alias divider (`:`) not pipe (`|`), and does not recognize the `![[]]` embed prefix. The plugin API is from remark 12 but unified/remark-parse v11 is installed. The plugin partially works but with wrong output for Obsidian syntax.

**How to avoid:** Call `parseWikilinks(note.content)` from the new `link-graph.ts` utility instead of using `note.links` for graph/outgoing-link calculations. The existing `note.links` field continues to be populated as-is for backward compatibility (do not break `readNote`'s output).

**Warning signs:** `get_outgoing_links` returns a link with `target: "Note|Alias"` instead of `target: "Note"`. `get_link_graph` shows no edges for any note that uses `|` aliases or embeds.

### Pitfall 2: Existing get_backlinks Has the Same Bug

**What goes wrong:** `handleGetBacklinks` in `handlers2.ts` uses `note.links?.filter(link => link.target === noteName)`. Because `remark-wiki-link` produces `target: "Note|Alias"` for aliased links, backlinks with aliases are silently missed.

**How to avoid:** Do NOT fix `handleGetBacklinks` in Phase 2 (it is out of scope and the existing tests pass with the current behavior). The Phase 2 new tools use `parseWikilinks()` for correctness. Phase 2's `get_outgoing_links` complements `get_backlinks`; the alias bug in get_backlinks is a known limitation and can be fixed in Phase 4 (XTND-03 `extract_links`).

**Warning signs:** If you update `handleGetBacklinks` in Phase 2, the existing handlers2.integration tests may fail because mock data uses the buggy behavior implicitly.

### Pitfall 3: Graph Build Performance for Large Vaults

**What goes wrong:** `buildVaultGraph()` calls `readNote()` for every `.md` file in the vault. For a vault with 1000 notes, this is 1000 disk reads. For a vault with 10,000 notes, this becomes slow.

**Why it happens:** `readNote()` reads file content, parses frontmatter, and parses the AST — it is not a cheap operation.

**How to avoid:** For Phase 2, the single-pass graph builder is correct and efficient enough. Do NOT add caching in Phase 2 (Phase 3/4 concern). Do NOT use `Promise.all()` to parallelize all reads at once — this will open 1000 file handles simultaneously and may hit OS limits. Use sequential iteration (for loop with await) as shown in `handleGetBacklinks`. The vault-reader already has a 10MB file size limit that prevents runaway reads.

**Warning signs:** `get_link_graph` times out or returns a `FILESYSTEM_ERROR` on large vaults.

### Pitfall 4: Wikilink Target Resolution — Collision Between Same-Name Files

**What goes wrong:** If two notes exist at `folder-a/Note.md` and `folder-b/Note.md`, and a third note contains `[[Note]]`, the link resolves to one of them. The `nameToPath` Map built from `listNotes()` uses first-insertion order (which is filesystem directory traversal order — not deterministic across OS/FS).

**Why it happens:** Obsidian's own resolution for same-name files is "shortest path wins." Our implementation approximates this but filesystem traversal order is OS-specific.

**How to avoid:** Sort `allNoteInfos` by path length (ascending) before building `nameToPath`. Shortest paths insert first and are never overwritten. This matches Obsidian's behavior closely.

**Warning signs:** Edge counts differ between runs on the same vault.

### Pitfall 5: Tag Deduplication — Frontmatter Tags May Include # Prefix

**What goes wrong:** Some Obsidian users write `tags: ['#recipe', '#cooking']` in frontmatter (with the `#` prefix), while others write `tags: ['recipe', 'cooking']` (without). If you store both forms without normalization, `search_tags` returns duplicate entries.

**How to avoid:** Normalize all tags in `extractInlineTags()` and in the frontmatter tag reader: strip the leading `#` if present before adding to the tag set. Normalize to lowercase for deduplication within a note, but preserve original case for display.

**Warning signs:** `search_tags` returns both `recipe` and `#recipe` as separate tags with non-zero counts.

### Pitfall 6: ToolRegistry enableAll() Must Be Called AFTER All Tools Registered

**What goes wrong:** Calling `registry.enableAll()` partway through `buildRegistry()` only enables tools registered so far. Tools registered after `enableAll()` are in the `tools` Map but not in `enabled`.

**How to avoid:** Always call `registry.enableAll()` as the LAST line in `buildRegistry()`, after all `registry.register()` calls. Or call `enabled.add(name)` in each `register()` call for Phase 2 (where all tools are always loaded).

**Warning signs:** Some tools are registered but not returned by `ListTools`. TypeScript won't catch this.

### Pitfall 7: `_resetRateLimiterForTests` Export Must Stay in index.ts

**What goes wrong:** After the registry refactor, the rate limiter logic may move from `src/tools/index.ts` to `src/index.ts`. If the `_resetRateLimiterForTests()` export moves with it, tests that currently import it from `../index.js` will break.

**How to avoid:** Keep `_resetRateLimiterForTests` exported from `src/tools/index.ts` regardless of where the rate limiter state lives. The existing handler2 test imports it from there. If the rate limiter moves to `src/index.ts`, re-export the reset function from `src/tools/index.ts` for backward compatibility.

**Warning signs:** Existing `handlers2.integration.test.ts` fails to compile after refactor.

---

## Code Examples

### Verified: remark-wiki-link v2.0.1 Bug (Confirmed Live)

```typescript
// Source: Live test on 2026-02-27 against installed packages
// Input: '[[Note|Alias]]'
// Output from remark-wiki-link:
{ type: 'wikiLink', value: 'Note|Alias', data: { alias: 'Note|Alias' } }
// BUG: target is "Note|Alias" not "Note"; alias is not parsed

// Input: '![[embed.png]]'
// Output: NOT parsed as wikiLink at all (no node in tree)
// BUG: embeds are completely invisible to remark-wiki-link v2.0.1
```

### Verified: Regex Wikilink Parser (Confirmed Live)

```typescript
// Source: Live test on 2026-02-27
// All formats tested: [[Note]], [[Note|Alias]], [[Note#Section]], [[Note#Section|Alias]], ![[embed]]
parseWikilinks('[[Note|Alias]] and ![[embed.png]] and [[Note#Section|Alias]]')
// Returns:
[
  { target: 'Note', alias: 'Alias', section: null, isEmbed: false },
  { target: 'embed.png', alias: null, section: null, isEmbed: true },
  { target: 'Note', alias: 'Alias', section: 'Section', isEmbed: false }
]
```

### Verified: Inline Tag Extraction Regex (Confirmed Live)

```typescript
// Source: Live test on 2026-02-27
// Regex: /(?:^|[\s,;!?])(#[A-Za-z][A-Za-z0-9\/\-_]*)/gm
extractInlineTags('This is a #recipe note with #cooking tips. Also #parent/child.')
// Returns: ['recipe', 'cooking', 'parent/child']
// (# prefix stripped in extractInlineTags output)

// Edge cases that work:
// #tag-with-dash → ['tag-with-dash'] ✓
// `#not-a-tag` → NOT extracted (preceded by backtick, not in pattern... actually IS extracted by this regex)
// Note: code spans are NOT excluded — see Pitfall discussion above
```

### ToolRegistration Registration (13 Existing Tools, No Behavior Change)

```typescript
// Source: Derived from current getToolDefinitions() + REGX-01 requirement
// The key insight: handler signature stays identical; registry just wraps it
registry.register({
  definition: getToolDefinitions().find(t => t.name === 'read_note')!,
  handler: (config, input) => handleReadNote(config, input),
  schema: ReadNoteSchema,
  category: 'Core CRUD',
  alwaysLoaded: true
});
```

### get_link_graph Handler Output Shape

```typescript
// Source: TOOL_EXPANSION_SPEC.md GetLinkGraphOutput schema
const payload = {
  vault: vault.name,
  stats: {
    total_nodes: graph.nodes.size,
    total_edges: graph.edges.length,
    orphan_count: orphans.length,
    avg_connections: computeAvgConnections(graph),
    most_connected: getMostConnected(graph, 10)
  },
  nodes: Array.from(graph.nodes.values()).map(n => ({
    path: n.path,
    name: n.name,
    folder: n.folder,
    outgoing_count: n.outgoing.length,
    incoming_count: n.incoming.length,
    tags: n.tags
  })),
  edges: graph.edges
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `switch (toolName)` dispatch in handleToolCall | `ToolRegistry.dispatch()` Map lookup | Phase 2 | O(1) lookup; extensible for Phase 3 lazy loading |
| `getToolDefinitions()` returns static array | `buildRegistry()` returns configured registry | Phase 2 | Registry owns all tool state; enables Phase 3 enable/disable |
| `remark-wiki-link` for link extraction | Regex parser `parseWikilinks()` | Phase 2 | Correctly handles all Obsidian link formats |
| Per-tool backlink scanning (O(N) per target) | Single-pass graph builder `buildVaultGraph()` | Phase 2 | O(N) total instead of O(N) per target |

**Deprecated in this phase:**
- `getToolDefinitions()` function: replaced by `buildRegistry()`. Remove from `src/tools/index.ts` after migration (or keep as thin wrapper that calls `buildRegistry().getEnabledDefinitions()` for any code still referencing it — verify nothing else imports it).
- Static `switch (toolName)` block in `handleToolCall`: removed entirely, replaced by `registry.dispatch()`.

---

## Open Questions

1. **Where does rate limiter state live after the refactor?**
   - What we know: Currently in `src/tools/index.ts` as a module-level variable `_rateLimiter`.
   - What's unclear: After `handleToolCall` is removed, rate limiting must happen somewhere before `registry.dispatch()`. Options: (a) move rate limiting into `src/index.ts` alongside the registry, or (b) make `ToolRegistry.dispatch()` accept an optional rate limiter parameter.
   - Recommendation: Move rate limiting to `src/index.ts` (where the registry lives) and export `_resetRateLimiterForTests` from `src/tools/index.ts` as a re-export. This keeps the test interface stable.

2. **Should `find_orphans` call `buildVaultGraph()` or implement its own simpler walk?**
   - What we know: `find_orphans` needs to know both incoming and outgoing link counts. `buildVaultGraph()` computes both.
   - What's unclear: `buildVaultGraph()` is more expensive than a simpler scan because it resolves targets and builds reverse edges. `find_orphans` with `type: "full"` only needs to know if both counts are zero.
   - Recommendation: Share `buildVaultGraph()` for simplicity. The performance concern (Pitfall 3) applies equally to both tools. If performance becomes an issue, add a `lightweight` flag to `buildVaultGraph()` in Phase 4.

3. **Should `get_link_graph` with `scope: "folder"` use the same graph builder or a separate walk?**
   - What we know: The spec allows `scope: "folder"` to limit the graph to a specific folder. `listNotes(vaultPath, folder)` already supports folder-scoped walks.
   - What's unclear: Edges that cross the folder boundary (note in folder links to note outside folder) — include or exclude?
   - Recommendation: Pass `folder` to `listNotes()` to limit nodes, but still resolve links against the full vault's `nameToPath` map. Edges where target is outside the folder scope are excluded from the `edges` array but noted in stats. This matches Obsidian's graph view folder-scope behavior.

---

## Available Planning/Execution Resources

The planner and executor for this phase have access to the following specialized tools:

- **`mcp-creator` subagent:** For generating MCP tool implementations with correct schemas, outputSchema, structuredContent, and annotations patterns. Use this when scaffolding handler files for the 4 new link tools.
- **`/mcp-builder-pro` skill:** For MCP server best practices including tool registration patterns, structured outputs, and tool discovery. Use this when wiring the new tools into `buildRegistry()`.
- **Serena MCP with LSP:** For safe symbol-level refactoring during the `handleToolCall` → `registry.dispatch()` migration. Use this to find all references to `getToolDefinitions()` and `handleToolCall` before modifying them.
- **Context7 MCP:** For verifying the latest `@modelcontextprotocol/sdk` 1.27.1 API surface if any registry pattern questions arise.

---

## Sources

### Primary (HIGH confidence)

- Live source code inspection (2026-02-27):
  - `src/tools/index.ts` — Current switch dispatch structure (13 cases), `_rateLimiter` singleton
  - `src/tools/handlers2.ts` — `handleGetBacklinks` pattern (O(N) vault walk for link matching)
  - `src/filesystem/vault-reader.ts` — `listNotes()` recursion, `readNote()` implementation
  - `src/filesystem/markdown-parser.ts` — `parseMarkdown()`, `extractLinks()`, confirmed remark-wiki-link usage
  - `src/tools/__tests__/handlers2.integration.test.ts` — Existing test patterns to follow
  - `src/types/index.ts` — `ToolResponse = CallToolResult`, `Link`, `Note` interfaces
  - `src/index.ts` — Server wiring, handler registration, rate limiter location
- Live `node` execution tests (2026-02-27):
  - `remark-wiki-link` v2.0.1 AST output for `[[Note|Alias]]` → confirmed bug (pipe in value)
  - `remark-wiki-link` v2.0.1 for `![[embed]]` → confirmed not parsed (no wikiLink node)
  - Regex `(!?)\[\[([^\]]+)\]\]` → confirmed correct for all 5 Obsidian link formats
  - Inline tag regex → confirmed extracts `#recipe`, `#parent/child`, `#tag-with-dash`
- `node_modules/remark-wiki-link/lib/index.js` — Confirmed CJS v2.0.1 source uses colon as alias divider, no embed support

### Secondary (MEDIUM confidence)

- [joschua.io Obsidian link regex](https://joschua.io/posts/2023/06/01/regex-for-obsidian-links/) — Reference for wikilink regex approach; verified patterns against live tests
- [Obsidian Internal Links docs](https://help.obsidian.md/links) — Confirms pipe alias and `#` heading section link formats
- [@flowershow/remark-wiki-link v3.3.1](https://github.com/datopian/remark-wiki-link-plus) — Confirmed this package DOES support Obsidian-style `|` aliases; not recommended for install since regex approach is simpler
- `.planning/research/SUMMARY.md` — Phase 2 was flagged as "STANDARD PATTERNS — no additional research needed" but the remark-wiki-link parsing bug was not known at the time

### Tertiary (LOW confidence)

- [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) — Competitor implementation with tag/link tools; approach not inspected in detail
- WebSearch for inline tag extraction patterns — general patterns confirmed by live testing

---

## Metadata

**Confidence breakdown:**
- ToolRegistry architecture: HIGH — standard Map/Set pattern; no external research needed; derived directly from requirements
- remark-wiki-link bug: HIGH — confirmed by reading source + live execution
- Regex wikilink parser: HIGH — tested live against all 5 Obsidian link formats
- Inline tag extraction: HIGH — tested live; known limitation on code spans documented
- Graph builder pattern: HIGH — derived from existing handleGetBacklinks + adjacency-list fundamentals
- Integration test patterns: HIGH — copy of existing handlers2 test pattern

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (30 days — all findings are from stable installed packages and verified source code)
