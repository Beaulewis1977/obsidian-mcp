# Phase 1: Quality Foundation — Research

**Researched:** 2026-02-27
**Domain:** MCP SDK migration, spec modernization, bug fixes, Windows platform, Vitest integration testing
**Confidence:** HIGH (verified against SDK source, official docs, and live code inspection)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SDK-01 | Server runs on `@modelcontextprotocol/sdk@^1.27.1` | SDK migration patterns documented; import paths verified compatible; API shape confirmed |
| BUG-01 | Rate limiter is a process-level singleton | Singleton pattern is a module-level variable; RateLimitManager already works correctly when shared |
| BUG-02 | `open_in_obsidian` works on native Windows without `which`/`command -v` | `fs.existsSync` pattern verified; `C:\Program Files\Obsidian\Obsidian.exe` confirmed on test machine |
| BUG-03 | `create_note` uses `matter.stringify` for frontmatter serialization | `matter.stringify` default behavior verified safe (wraps date strings in single quotes); JSON_SCHEMA mode actually removes quotes (counter-intuitive — avoid it) |
| BUG-04 | `get_daily_note` returns `path` consistently | Branch inconsistency confirmed: existing-note branch uses `notePath:`, create branch uses `path:` |
| SPEC-01 | All 13 tools declare `outputSchema` | Wire format is plain JSON Schema with `type: "object"`; added to `ToolDefinition` shape |
| SPEC-02 | All 13 tools return `structuredContent` | Added alongside existing `content[0].text`; no breakage; format is `Record<string, unknown>` |
| SPEC-03 | All 13 tools declare `annotations` | 4 fields: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`; all optional booleans |
| SPEC-04 | `search_notes` docs match runtime behavior | Confirmed: schema default is `"filesystem"`, not `"obsidian"` as docs claim; architecture doc write-path claim is inaccurate |
| SPEC-05 | Spec ambiguities resolved | `enable_tool` uses `tool_name` required field; `get_link_graph` has two modes; `ServerConfig` needs `lazy_loading` + `always_loaded_tools` fields |
| TEST-01 | `handlers2.ts` tools have integration tests | 7 handlers need new test file; existing pattern in `handlers.integration.test.ts` is the template |
| TEST-02 | All new Phase 1 tests have success + failure paths | Same pattern as existing tests; Vitest `vi.mock()` + `vi.mocked()` approach is established |
</phase_requirements>

---

## Summary

Phase 1 requires upgrading the MCP SDK from 0.6.1 to 1.27.1, a jump of roughly 20 major-increment minor versions within the v1.x line. Despite the large version gap, the upgrade is **lower risk than expected**: the import paths remain identical (`@modelcontextprotocol/sdk/server/index.js`, `/server/stdio.js`, `/types.js`), the low-level `Server` class and its `setRequestHandler(ZodSchema, handler)` pattern still works, and the Zod schema names (`ListToolsRequestSchema`, `CallToolRequestSchema`) are unchanged. The primary behavioral change in 1.27.1 is that the SDK now validates tool call results against `CallToolResultSchema`— meaning the return value from `handleToolCall` must be a valid object with a `content` array.

The MCP 2025-11-25 spec additions (SPEC-01, SPEC-02, SPEC-03) are purely additive: add `outputSchema` and `annotations` to tool definitions, add `structuredContent` to handler returns alongside the existing `content[0].text`. The SDK does NOT validate `structuredContent` against `outputSchema` when using the low-level `Server` class (only `McpServer.registerTool` does this). PR #655 (skip output validation on `isError: true`) was merged and is in 1.27.1 — confirmed closed 2025-06-24.

The four bug fixes are mechanical and localized: (BUG-01) hoist `RateLimitManager` instantiation from inside `handleToolCall` to module-level singleton; (BUG-02) replace `which(absolutePath)` with `fs.existsSync(absolutePath)` for Windows paths; (BUG-03) replace the manual frontmatter string interpolation in `handlers.ts` API path with `matter.stringify()` — the existing `stringifyMarkdown()` utility in `markdown-parser.ts` already does this correctly; (BUG-04) normalize `get_daily_note` to always return `path:` (not `notePath:`).

**Primary recommendation:** Upgrade the SDK first (task 1), confirm all 13 tools still work, then add spec fields additively (tasks 2–4), fix the 4 bugs (task 5), and add `handlers2.ts` integration tests last (task 6). Each step is independently verifiable.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | `^1.27.1` | MCP protocol implementation — Server, transport, schemas | Official SDK; 1.27.1 is latest stable 1.x; 2.x monorepo split not needed yet |
| `gray-matter` | `^4.0.3` | Frontmatter parse/serialize | Already in project; `matter.stringify` is the correct serialization path |
| `js-yaml` | (transitive via gray-matter) | YAML engine for gray-matter | Used to override parse engine; DEFAULT schema (not JSON_SCHEMA) is correct for stringify |
| `vitest` | `^2.0.0` | Test framework | Already configured; `vi.mock()` hoisting works correctly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rate-limiter-flexible` | `^5.0.3` | Rate limiting counters | Keep existing; fix is lifecycle (singleton), not library |
| `execa` | `^8.0.1` | Shell command execution | Keep for URI opening; replace `which` calls with `fs.existsSync` for absolute paths |
| `is-wsl` | `^3.1.0` | WSL detection | Keep for WSL branch in process-spawner |
| `zod-to-json-schema` | `^3.22.4` | Convert Zod → JSON Schema for low-level `Server` tool registration | Keep for `inputSchema`; also use for `outputSchema` definitions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Low-level `Server` class | `McpServer.registerTool()` | `McpServer` does automatic schema validation and is the recommended path, but migrating the entire dispatch mechanism to `registerTool()` is Phase 2 scope (ToolRegistry refactor). In Phase 1, keep low-level `Server` — it is fully functional in 1.27.1. |
| `matter.stringify` default | `matter.stringify` with js-yaml JSON_SCHEMA | JSON_SCHEMA mode removes quotes from date strings (`date: 2024-01-15` unquoted), which YAML 1.1 parsers re-read as Date objects. Default mode wraps dates in single quotes — this is the safe behavior. Do NOT use JSON_SCHEMA for stringify. |

**Installation (upgrade):**
```bash
npm install @modelcontextprotocol/sdk@^1.27.1
```

---

## Architecture Patterns

### Pattern 1: SDK Upgrade — Keep Low-Level Server, Add Spec Fields

**What:** Upgrade the package, then extend `ToolDefinition` to include `outputSchema` and `annotations`, and update `handleToolCall` return shapes to include `structuredContent`.

**When to use:** Phase 1 only. Phase 2 replaces with `ToolRegistry` + `McpServer.registerTool`.

**Import paths in 1.27.1 (unchanged from 0.6.1):**
```typescript
// Source: verified from 1.27.1 package dist/esm/ structure
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
```

**Extended ToolDefinition shape (src/tools/index.ts):**
```typescript
// Source: derived from types.js ToolAnnotationsSchema in SDK 1.27.1
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  // New fields for MCP 2025-11-25 spec:
  outputSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  annotations?: ToolAnnotations;
}
```

**CallToolResult shape in 1.27.1 (verified from SDK types.js):**
```typescript
// Source: CallToolResultSchema in @modelcontextprotocol/sdk/types.js v1.27.1
interface CallToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; ... } | ...>;
  structuredContent?: Record<string, unknown>; // NEW: must match outputSchema
  isError?: boolean;
}
```

### Pattern 2: Rate Limiter Singleton

**What:** Move `RateLimitManager` instantiation from inside `handleToolCall` (per-request) to module scope (process lifetime).

**When to use:** Always — rate limiters depend on in-memory state that must persist across calls.

```typescript
// Source: Fix for BUG-01 (F-CRIT-01)
// In src/tools/index.ts — module level (NOT inside handleToolCall)
let _rateLimiter: RateLimitManager | null = null;

export function initRateLimiter(config: RateLimitConfig): void {
  _rateLimiter = new RateLimitManager(config);
}

export async function handleToolCall(
  config: ServerConfig,
  toolName: string,
  args: any
): Promise<ToolResponse> {
  // Use the module-level singleton, initialized from src/index.ts on startup
  const rateLimiter = _rateLimiter;
  // ... rest of handler
}
```

**Alternative approach (simpler):** Pass `RateLimitManager` instance as a parameter to `handleToolCall`, initialized once in `src/index.ts`. Either works; module-level singleton avoids changing the function signature.

### Pattern 3: Windows Executable Detection with fs.existsSync

**What:** Replace `execa('which', [absolutePath])` with `fs.existsSync(absolutePath)` for absolute path candidates.

**When to use:** Any absolute filesystem path (Windows-style `C:\...` or Unix `/usr/bin/...`). Only use `which`/`where` for bare command names.

```typescript
// Source: Fix for BUG-02 (F-CRIT-02) — verified against Node.js fs docs
import { existsSync } from 'fs';
import path from 'path';

async function findObsidianExecutable(): Promise<string | null> {
  const localAppData = process.env.LOCALAPPDATA || '';
  const username = process.env.USERNAME || process.env.USER || '';

  const absoluteCandidates = [
    // Windows user-scoped install (most common via Squirrel installer)
    path.join(localAppData, 'Programs', 'Obsidian', 'Obsidian.exe'),
    // Windows machine-wide install (confirmed present on test machine)
    path.join('C:', 'Program Files', 'Obsidian', 'Obsidian.exe'),
    // WSL path to Windows Program Files
    '/mnt/c/Program Files/Obsidian/Obsidian.exe',
    // macOS
    '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
    // Linux absolute
    '/usr/bin/obsidian',
    '/usr/local/bin/obsidian',
    '/snap/bin/obsidian',
  ];

  for (const candidate of absoluteCandidates) {
    if (isWSL && candidate.startsWith('/mnt/c/')) {
      // WSL: use `test -f` for WSL paths
      try {
        await execa('test', ['-f', candidate], { shell: true });
        return candidate;
      } catch { continue; }
    } else {
      // Absolute path: use existsSync (no shell lookup)
      if (existsSync(candidate)) return candidate;
    }
  }

  // Bare command name: use `where` (Windows) or `which` (Unix)
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execa('where', ['obsidian']);
      if (stdout.trim()) return stdout.trim().split('\n')[0].trim();
    } catch { /* not in PATH */ }
  } else if (!isWSL) {
    try {
      const { stdout } = await execa('which', ['obsidian']);
      if (stdout.trim()) return stdout.trim();
    } catch { /* not in PATH */ }
  }

  return null;
}
```

### Pattern 4: Frontmatter Serialization with matter.stringify

**What:** Replace manual string interpolation in the `create_note` API path with `matter.stringify`.

**Critical finding:** Do NOT use `js-yaml JSON_SCHEMA` for stringify. With `JSON_SCHEMA`, `matter.stringify` outputs `date: 2024-01-15` (unquoted), which YAML 1.1 parsers re-read as a JavaScript `Date` object. The default gray-matter behavior outputs `date: '2024-01-15'` (single-quoted string) — this is the correct behavior.

```typescript
// Source: Fix for BUG-03 (F-MED-01)
// WRONG (current API path in handlers.ts):
const fullContent = input.frontmatter
  ? `---\n${Object.entries(input.frontmatter).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n${input.content}`
  : input.content;

// CORRECT (use the existing utility from markdown-parser.ts):
import { stringifyMarkdown } from '../filesystem/markdown-parser.js';

const fullContent = stringifyMarkdown({
  frontmatter: input.frontmatter || {},
  content: input.content
});
// OR directly:
import matter from 'gray-matter';
const fullContent = input.frontmatter && Object.keys(input.frontmatter).length > 0
  ? matter.stringify(input.content, input.frontmatter)
  : input.content;
```

**Verification:** `matter.stringify('content', {date: '2024-01-15'})` produces `date: '2024-01-15'` (quoted, safe). `matter.stringify('content', {date: '2024-01-15'}, {engines: {yaml: {stringify: (o) => yaml.dump(o, {schema: JSON_SCHEMA})}}})` produces `date: 2024-01-15` (unquoted, dangerous).

### Pattern 5: structuredContent Return Pattern

**What:** Every handler returns both `content[0].text` (existing, for backward compat) and `structuredContent` (new, for spec compliance).

**When to use:** All 13 existing tools during this phase.

```typescript
// Source: Derived from CallToolResultSchema in SDK 1.27.1 + SPEC-02 requirement
// Pattern for success responses:
return {
  content: [{
    type: 'text',
    text: JSON.stringify(payload, null, 2)
  }],
  structuredContent: payload  // Same data, no duplication overhead
};

// Pattern for error responses (isError: true → structuredContent not required):
// Keep existing createErrorResponse — it sets isError: true
// PR #655 (merged 2025-06-24) confirmed: SDK skips outputSchema validation when isError: true
```

### Anti-Patterns to Avoid

- **Using `McpServer.registerTool` in Phase 1:** The Phase 2 ToolRegistry refactor will migrate to `McpServer`. Doing it now creates double work and increases Phase 1 risk.
- **Using `JSON_SCHEMA` for gray-matter stringify:** Counterintuitively makes date strings more fragile, not less. Default gray-matter behavior is already safe.
- **Calling `which absolutePath`:** `which` is a PATH lookup command. An absolute path like `C:\Program Files\Obsidian\Obsidian.exe` is never in `PATH`. Use `existsSync`.
- **Registering tools after `server.connect()`:** Issue #893 (still open) means `McpServer` throws on post-connect registration. For low-level `Server`, post-connect `setRequestHandler` may silently fail. All tools must be registered before `connect()`.
- **Returning `structuredContent` without a matching `outputSchema`:** Not an error in the low-level `Server`, but violates the spec. If `outputSchema` is declared, `structuredContent` MUST be present and MUST match.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontmatter YAML serialization | Manual template string assembly | `matter.stringify(content, frontmatter)` | Handles arrays, nested objects, quoting of date-like strings, multiline values — JSON.stringify produces JSON-style YAML that is valid but non-idiomatic and fragile |
| Executable existence check | Spawning `which` or `test -f` subprocesses | `fs.existsSync(path)` or `fs.accessSync(path, fs.constants.X_OK)` | No subprocess overhead, works synchronously, cross-platform for absolute paths |
| Rate limit state | Per-request counter in a local variable | `rate-limiter-flexible` RateLimiterMemory with module-level singleton | `rate-limiter-flexible` handles concurrent requests, reset windows, and multi-tier limits correctly |
| JSON Schema for tool definitions | Hand-write JSON Schema objects | `zodToJsonSchema(ZodSchema)` | Automatically generates correct `$schema`, `type: "object"`, `properties`, `required` fields |

**Key insight:** The pattern of "use what's already in the project, fix the lifecycle/path issues" applies to all four bugs. The libraries are correct; the bug is how they're invoked.

---

## Common Pitfalls

### Pitfall 1: SDK Validation Rejects `content: []` with structuredContent

**What goes wrong:** In 1.27.1, `Server.setRequestHandler('tools/call', ...)` wraps the handler and validates the return against `CallToolResultSchema`. The schema has `content: z.array(ContentBlockSchema).default([])` — it defaults to empty array but must be present. If a handler throws before returning, the SDK catches it and the error surfaces as a protocol error (not a tool error).

**Why it happens:** 1.27.1 added output validation in the `Server.setRequestHandler` override for `tools/call`. This did not exist in 0.6.1.

**How to avoid:** Ensure all handlers always return a valid `{ content: [...] }` object, never throw from the top-level handler function. Use try/catch with `createErrorResponse` (which returns `{ content: [...], isError: true }`) for all error paths.

**Warning signs:** `McpError: Invalid tools/call result` in logs after upgrade.

### Pitfall 2: Issue #893 — Post-Connect Tool Registration Fails on McpServer

**What goes wrong:** Calling `mcpServer.registerTool()` after `await mcpServer.connect(transport)` throws `SdkError: Cannot register capabilities after connecting to transport`.

**Why it happens:** `McpServer` lazily calls `this.server.registerCapabilities()` on first `registerTool` call. `registerCapabilities` forbids post-connect calls.

**How to avoid:** Register all tools BEFORE `server.connect()`. This is already the pattern in `src/index.ts` (tools registered via `setRequestHandler` in constructor scope, before `connect()`).

**Status:** Issue #893 is OPEN as of 1.27.1 (labeled bug, P2, ready for work). No fix in 1.27.1.

**Workaround for Phase 3 (lazy loading):** Use the low-level `Server` class which allows `setRequestHandler` for `tools/list` to be updated at any time, or pre-register all tools before connect and manage the enabled set manually (this is exactly the Phase 2/3 ToolRegistry plan).

### Pitfall 3: outputSchema Must Have `type: "object"` at Root

**What goes wrong:** Adding an `outputSchema` that is not `{ type: "object", properties: {...} }` causes a schema validation error on the MCP spec level (clients validate received tool definitions).

**Why it happens:** MCP spec 2025-11-25 requires `outputSchema` to be a JSON Schema 2020-12 object schema with `type: 'object'` at root — same constraint as `inputSchema`.

**How to avoid:** Always wrap output properties in `{ type: "object", properties: { ... } }`. When using `zodToJsonSchema` on a `z.object()`, the output is automatically correct.

**Warning signs:** Client-side validation error when listing tools; `outputSchema` with `type: "array"` or no `type` field.

### Pitfall 4: gray-matter Date String Corruption

**What goes wrong:** Using `js-yaml` with `JSON_SCHEMA` (or `CORE_SCHEMA`) for `matter.stringify` strips quotes from date-like strings like `2024-01-15`. The resulting YAML `date: 2024-01-15` is re-parsed as a JavaScript `Date` object by any YAML 1.1-compliant parser (gray-matter's default uses `js-yaml` which is YAML 1.2 but still treats bare date strings as dates with DEFAULT_SAFE_SCHEMA).

**Why it happens:** YAML 1.1 spec defines bare dates as the Date type. `JSON_SCHEMA` does not add quotes. The default gray-matter `stringify` uses `dump(data)` which respects YAML quoting rules and wraps strings that look like dates in single quotes.

**How to avoid:** Use `matter.stringify(content, frontmatter)` with no options override. This is tested and safe.

**Warning signs:** Frontmatter `date` field becomes a `Date` object after round-trip; `date.toISOString()` appears in the YAML output.

### Pitfall 5: `which` Fails on Absolute Paths on Windows (Native)

**What goes wrong:** On native Windows, `which` is not available (it's a Unix command). `where` exists but returns a different format. The current code calls `execa('which', [absolutePath])` which fails on Windows native with command-not-found.

**Why it happens:** The code was written for WSL where `which` is available, but `which` resolves command names from `PATH` — not filesystem paths.

**How to avoid:** For absolute path candidates: use `fs.existsSync(path)`. For bare command names on Windows: use `execa('where', [commandName])`. For bare command names on Linux/macOS: use `execa('which', [commandName])`.

**Warning signs:** `open_in_obsidian` throws "Obsidian executable not found" on native Windows even when Obsidian is installed.

---

## Code Examples

### SDK 1.27.1 — Tool List with outputSchema and annotations

```typescript
// Source: Derived from SDK types.js ToolSchema (1.27.1) + SPEC-01/SPEC-03
export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'read_note',
      description: 'Read the complete contents of a note including frontmatter, content, links, and metadata',
      inputSchema: zodToJsonSchema(ReadNoteSchema),
      outputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          frontmatter: { type: 'object' },
          content: { type: 'string' },
          links: { type: 'array', items: { type: 'object' } },
          metadata: { type: 'object' }
        },
        required: ['path', 'content']
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    // ... 12 more tools
  ];
}
```

### SDK 1.27.1 — Handler Return with structuredContent

```typescript
// Source: Derived from CallToolResultSchema in SDK 1.27.1 + SPEC-02
export async function handleReadNote(
  config: ServerConfig,
  input: ReadNoteInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    const note = await readNote(vault.path, ensureMarkdownExtension(input.path));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(note, null, 2)   // Keep for backward compat
      }],
      structuredContent: note as Record<string, unknown>  // NEW: matches outputSchema
    };
  } catch (error: any) {
    // createErrorResponse returns { content: [...], isError: true }
    // isError: true → SDK skips outputSchema validation (PR #655, merged 2025-06-24)
    return createErrorResponse('Failed to read note', error.message, 'FILESYSTEM_ERROR');
  }
}
```

### ToolResponse Type Update

```typescript
// Source: Derived from CallToolResultSchema in SDK 1.27.1
// Update src/types/index.ts:
export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  structuredContent?: Record<string, unknown>;  // NEW
  isError?: boolean;
}
```

### Vitest Integration Test Pattern for handlers2.ts

```typescript
// Source: Based on existing handlers.integration.test.ts pattern
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleMoveNote, handleGetDailyNote } from '../handlers2.js';

vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  noteExists: vi.fn(),
}));

vi.mock('../../filesystem/vault-writer.js', () => ({
  writeNote: vi.fn(),
  moveNote: vi.fn(),
  createFolder: vi.fn(),
}));

vi.mock('../../platform/process-spawner.js', () => ({
  openInObsidian: vi.fn(),
  openURI: vi.fn(),
}));

import { readNote, listNotes, noteExists } from '../../filesystem/vault-reader.js';
import { writeNote, moveNote } from '../../filesystem/vault-writer.js';
import { openInObsidian } from '../../platform/process-spawner.js';

const mockConfig = {
  version: '1.0',
  vaults: [{ name: 'test', path: process.cwd(), default: true }],
  rate_limiting: { enabled: false },
};

describe('handlers2 integration tests', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('handleMoveNote', () => {
    it('should successfully move a note', async () => {
      vi.mocked(noteExists)
        .mockResolvedValueOnce(true)   // source exists
        .mockResolvedValueOnce(false); // target does not exist
      vi.mocked(moveNote).mockResolvedValue(undefined);

      const result = await handleMoveNote(mockConfig, {
        source_path: 'old-note', target_path: 'new-name'
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toMatchObject({ success: true });
    });

    it('should return error when source not found', async () => {
      vi.mocked(noteExists).mockResolvedValueOnce(false);

      const result = await handleMoveNote(mockConfig, {
        source_path: 'nonexistent', target_path: 'new-name'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('NOTE_NOT_FOUND');
    });
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Server` class with manual `setRequestHandler` | `McpServer.registerTool()` with automatic validation | SDK ~1.0 (McpServer introduced) | Phase 2 will migrate; Phase 1 keeps old approach |
| No `outputSchema` in tool definitions | `outputSchema` JSON Schema on every tool | MCP spec 2025-11-25 | Required for spec compliance; Phase 1 adds these |
| No `structuredContent` in results | `structuredContent` matching `outputSchema` | MCP spec 2025-11-25 | Additive — old `content[0].text` stays |
| No `annotations` on tools | `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` | MCP spec 2025-11-25 | Hints for clients; non-breaking to add |
| `which` for executable detection | `fs.existsSync` for absolute paths | Node.js always had this; pattern is just wrong | Fixes Windows native support |

**Deprecated/outdated:**
- `mcpServer.tool()` variadic API: Still works in 1.27.1 but frozen as of 2025-03-26; use `registerTool()` config object API instead (for Phase 2+)
- Manual YAML template string assembly: Non-idiomatic; use `matter.stringify` (fixes BUG-03)

---

## Open Questions

1. **Does 1.27.1 require `capabilities: { tools: { listChanged: true } }` in the Server constructor?**
   - What we know: Current code has `capabilities: { tools: {} }`. The `McpServer` sets `listChanged: true` automatically via `registerCapabilities`. With low-level `Server`, this is set manually.
   - What's unclear: Whether omitting `listChanged` causes any protocol issue when the server later emits `notifications/tools/list_changed` (Phase 3 concern, not Phase 1).
   - Recommendation: Keep `capabilities: { tools: {} }` for Phase 1. Phase 3 will need to add `listChanged: true` when lazy loading is implemented.

2. **Should `ToolResponse` type be extended or should `structuredContent` be added to the existing `content[0].text` response shape?**
   - What we know: `CallToolResultSchema` in 1.27.1 has `structuredContent: z.record(z.string(), z.unknown()).optional()`.
   - What's unclear: Whether TypeScript strict mode will flag the existing `ToolResponse` type after adding `structuredContent`.
   - Recommendation: Add `structuredContent?: Record<string, unknown>` to the `ToolResponse` interface in `src/types/index.ts`. This is additive and non-breaking.

3. **`outputSchema` for error responses: should all outputSchemas include an `error` field?**
   - What we know: PR #655 (merged) confirmed SDK skips outputSchema validation when `isError: true`. Pre-Phase-1 decision says "include error field in every outputSchema as safe fallback."
   - What's unclear: Whether the PR fix is in 1.27.1 specifically — confirmed it was merged 2025-06-24, and 1.27.1 was released 2026-02-24, so YES it is included.
   - Recommendation: Since PR #655 is confirmed in 1.27.1, `isError: true` responses skip schema validation. The "include error field in outputSchema" decision was the safe fallback; it's still harmless to include it but not required. Include an `error` property in each `outputSchema` anyway as documented defense in depth.

---

## Sources

### Primary (HIGH confidence)

- SDK 1.27.1 package source — inspected directly from tarball (`npm pack @modelcontextprotocol/sdk@1.27.1 && tar -xzf ...`)
  - `packages/server/src/server/mcp.ts` — `registerTool` signature, `setToolRequestHandlers`, `validateToolOutput`
  - `packages/core/src/types/types.ts` — `ToolAnnotationsSchema`, `CallToolResultSchema`, `ToolSchema.outputSchema`
  - `packages/server/src/server/server.ts` — `Server.setRequestHandler`, `registerCapabilities` (throws if post-connect)
- GitHub: `modelcontextprotocol/typescript-sdk` — Issue #893 (open, P2), PR #655 (closed/merged 2025-06-24)
- `D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server\node_modules\@modelcontextprotocol\sdk\dist\types.js` — 0.6.1 ToolSchema (confirmed: no `outputSchema`, no `annotations`, no `structuredContent`)
- Live Node.js test — `fs.existsSync('C:\Program Files\Obsidian\Obsidian.exe')` returns `true` on this machine
- Live gray-matter test — default `matter.stringify` wraps date strings in single quotes (safe); JSON_SCHEMA mode removes quotes (unsafe)

### Secondary (MEDIUM confidence)

- `docs/migration-SKILL.md` in typescript-sdk repo — v1→v2 migration mapping (confirms 1.x single-package approach is valid)
- SDK `examples/server/mcpServerOutputSchema.js` — pattern for `structuredContent` in `McpServer.registerTool` responses
- Issue #893 comments — workaround: register dummy tools before `connect()` to force capability registration

### Tertiary (LOW confidence)

- WebSearch for "modelcontextprotocol sdk 0.6 to 1.0 migration" — no authoritative migration guide from 0.6→1.x found (the official migration.md only covers v1→v2). Confidence in 0.6→1.27.1 compatibility based on direct code inspection.

---

## Metadata

**Confidence breakdown:**
- SDK migration path: HIGH — verified from source code, confirmed import paths unchanged, schemas confirmed
- MCP spec wire format: HIGH — verified from SDK 1.27.1 types.js directly
- Issue #893 / PR #655 status: HIGH — confirmed via GitHub API
- BUG-01 (singleton): HIGH — confirmed by reading the bug in source code
- BUG-02 (Windows paths): HIGH — `fs.existsSync` tested live on Windows, Obsidian found at `C:\Program Files\Obsidian\Obsidian.exe`
- BUG-03 (gray-matter): HIGH — tested `matter.stringify` behavior live; JSON_SCHEMA danger confirmed
- BUG-04 (path field): HIGH — confirmed by reading handlers2.ts lines 227 vs 254
- Vitest patterns: HIGH — same as existing test file in project

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (30 days — SDK 1.x is stable; spec is stable)
