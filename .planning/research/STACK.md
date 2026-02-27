# Stack Research

**Domain:** MCP Server (TypeScript/Node.js) — Milestone 2 modernization and expansion
**Researched:** 2026-02-26
**Confidence:** HIGH (core SDK facts verified against official spec and GitHub; LOW only where noted)

---

## Executive Summary

The existing server uses `@modelcontextprotocol/sdk@^0.6.0` — the pre-v1 API that predates the MCP 2025-11-25 spec. The upgrade to `^1.x` (currently `1.27.1`) is a **significant migration**, not a patch bump. The v1 SDK ships `McpServer` (a high-level class) alongside the original low-level `Server` class. The v1 `McpServer.registerTool()` API natively supports `outputSchema`, `annotations`, `structuredContent`, and automatic `notifications/tools/list_changed` emission — these are not add-ons; they are first-class features of the v1 SDK.

The lazy-loading architecture (`discover_tools` / `enable_tool` meta-tools) maps cleanly onto the SDK's built-in `RegisteredTool.enable()` / `RegisteredTool.disable()` pattern. The SDK automatically sends `notifications/tools/list_changed` when a tool's enabled state changes — the server does not need to call `sendToolListChanged()` manually for this case.

One confirmed bug in the SDK (Issue #893) is relevant: `McpServer` may throw "Cannot register capabilities after connecting to transport" on post-connect `registerTool()` calls. The workaround is to register a single placeholder tool before `connect()` to force early capability initialization. This is a documented P2 issue open as of Feb 2026.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@modelcontextprotocol/sdk` | `^1.27.1` | MCP protocol implementation | Only SDK that natively supports MCP 2025-11-25 `outputSchema`, `structuredContent`, `annotations`, `listChanged`, and the `registerTool()` high-level API with `enable()`/`disable()` on returned `RegisteredTool` objects. The existing `^0.6.0` lacks all of these. Upgrade is mandatory. |
| TypeScript | `^5.3.3` (keep) | Type safety | Already in use. No change needed. The v1 SDK ships full TypeScript types for `outputSchema`, `annotations`, and `structuredContent`. |
| Node.js | `>=18.0.0` (keep) | Runtime | Already constrained correctly. No change. |
| `zod` | `^3.22.4` (keep) | Schema definition | The v1 SDK `registerTool()` API accepts Zod schemas directly for both `inputSchema` and `outputSchema` — no manual `zodToJsonSchema()` conversion needed at the registration callsite. Zod schemas passed to `registerTool()` are converted internally by the SDK. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod-to-json-schema` | `^3.22.4` (keep, but scope narrows) | JSON Schema conversion | Still needed if any code path manually constructs tool definitions outside `McpServer.registerTool()`. With v1 `McpServer`, this library is no longer needed at tool registration — the SDK handles Zod-to-JSON-Schema conversion internally. Keep in `package.json` but evaluate whether it can be removed after migration. |
| `gray-matter` | `^4.0.3` (keep) | YAML frontmatter parse/stringify | `matter.stringify()` must become the canonical frontmatter serializer in all write paths. Already used in `markdown-parser.ts`; must be extended to `create_note`. |
| `remark` / `remark-parse` / `remark-wiki-link` / `unified` | Current (keep) | Wikilink parsing | Existing remark pipeline reused by new link tools (`get_outgoing_links`, `get_link_graph`, `extract_links`). No changes needed. |
| `dayjs` | `^1.11.10` (keep) | Date handling | Used in `get_daily_note`, `get_weekly_note`. Keep. |
| `rate-limiter-flexible` | `^5.0.3` (keep) | Rate limiting | Must be instantiated as a module-level singleton (fix F-CRIT-01), not per-call. Library choice is sound; the bug is in usage pattern. |
| `pino` | `^9.0.0` (keep) | Structured logging | No change. |
| `execa` | `^8.0.1` (keep) | Shell exec for `open_in_obsidian` | Keep. Cross-platform exec detection (F-CRIT-02) is a usage-layer fix, not a library change. |
| `is-wsl` | `^3.1.0` (keep) | WSL detection | Keep. |
| `chokidar` | `^4.0.0` (keep) | Filesystem watching | Keep. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest` `^2.0.0` | Test runner | Keep. Add integration tests for `handlers2.ts` tools (F-MED-03). All new tools require success + failure integration tests before merge. |
| `tsup` `^8.0.0` | ESM bundler | Keep. No changes required. |
| `husky` `^9.1.7` | Pre-commit hooks | Keep. Pre-commit hook (`tsc --noEmit` + `vitest --run` + `tsup`) must stay green. |
| `typescript` `^5.3.3` | Compiler | Keep. |

---

## The SDK Upgrade in Detail

### What `^0.6.0` → `^1.x` Actually Means

The existing server uses the **low-level `Server` API** from v0:

```typescript
// Current pattern (v0 style — must be replaced)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
const server = new Server({ name, version }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => { ... });
server.setRequestHandler(CallToolRequestSchema, async (request) => { ... });
```

The v1 SDK ships `McpServer` as the recommended high-level class. The low-level `Server` class still exists in v1 but is a lower-level escape hatch.

### v1 `McpServer.registerTool()` API

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer(
  { name: 'obsidian-mcp-server', version: '1.0.0' },
  {
    capabilities: {
      tools: { listChanged: true }  // Required for notifications/tools/list_changed
    }
  }
);

// registerTool() returns a RegisteredTool object
const readNoteTool = server.registerTool(
  'read_note',
  {
    title: 'Read Note',
    description: 'Read note content, frontmatter, links, and metadata',
    annotations: {
      readOnlyHint: true,        // Does not modify vault
      idempotentHint: true,      // Safe to call repeatedly
      destructiveHint: false     // No destructive effects
    },
    inputSchema: z.object({
      vault: z.string().describe('Vault name'),
      path: z.string().describe('Note path relative to vault root'),
    }),
    outputSchema: z.object({
      path: z.string(),
      content: z.string(),
      frontmatter: z.record(z.unknown()).optional(),
      links: z.array(z.string()),
      backlinks: z.array(z.string()),
    })
  },
  async ({ vault, path }) => {
    const result = await handleReadNote({ vault, path });
    return {
      // Backward compat: keep text content for older clients
      content: [{ type: 'text', text: JSON.stringify(result) }],
      // New: structured content for 2025-11-25 spec clients
      structuredContent: result
    };
  }
);
```

### `outputSchema` Contract Rules

From the 2025-11-25 spec (HIGH confidence, verified against official docs):

1. If `outputSchema` is provided, servers **MUST** return `structuredContent` conforming to that schema.
2. If `isError: true` is set, `structuredContent` validation is **skipped** (fixed in SDK PR #655).
3. For backward compatibility, tools with `structuredContent` **SHOULD** also return the JSON-serialized string in a `content[0].type: 'text'` block.

### Tool Annotations (2025-11-25 spec)

Annotation fields and their semantics (HIGH confidence, verified against official spec):

| Annotation | Type | Meaning |
|------------|------|---------|
| `readOnlyHint` | `boolean` | Tool does not modify environment. Use for all read-only vault tools. |
| `destructiveHint` | `boolean` | Tool may perform destructive updates (e.g., delete). Use for `delete_note`. |
| `idempotentHint` | `boolean` | Repeated calls with same args have no additional effect. |
| `openWorldHint` | `boolean` | Tool interacts with external entities (e.g., network, external apps). Use for `open_in_obsidian`. |

Clients treat annotations as **hints only** — they must not be trusted for security decisions.

Annotation mapping for existing tools:

| Tool | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
|------|-------------|-----------------|----------------|---------------|
| `read_note` | true | false | true | false |
| `create_note` | false | false | false | false |
| `edit_note` | false | false | false | false |
| `delete_note` | false | true | false | false |
| `list_notes` | true | false | true | false |
| `search_notes` | true | false | true | false |
| `move_note` | false | false | false | false |
| `update_frontmatter` | false | false | false | false |
| `get_daily_note` | false | false | false | false |
| `open_in_obsidian` | true | false | true | true |
| `get_backlinks` | true | false | true | false |
| `create_folder` | false | false | true | false |
| `get_vault_stats` | true | false | true | false |

### `notifications/tools/list_changed` — How It Actually Works

The v1 `McpServer` emits `notifications/tools/list_changed` **automatically** when:
- `registerTool()` is called at runtime (after connect)
- `registeredTool.enable()` is called
- `registeredTool.disable()` is called
- `registeredTool.remove()` is called

The server **does not** need to call `sendToolListChanged()` manually in the lazy-loading enable/disable flow. The SDK handles it.

To declare support, set `capabilities.tools.listChanged: true` in `McpServer` constructor.

### Lazy Loading Implementation Pattern

The `RegisteredTool` object returned by `registerTool()` exposes:

```typescript
interface RegisteredTool {
  enable(): void;    // Makes tool visible in tools/list + sends notification
  disable(): void;   // Hides tool from tools/list + sends notification
  remove(): void;    // Removes tool entirely from registry + sends notification
  update(updates: Partial<ToolConfig>): void;  // Updates tool metadata
}
```

**Recommended lazy-loading architecture** for this project:

```typescript
// At server startup: register ALL tools but disable those not in initial set
const toolRegistry = new Map<string, RegisteredTool>();

for (const toolDef of ALL_TOOL_DEFINITIONS) {
  const registered = server.registerTool(toolDef.name, toolDef.config, toolDef.handler);
  if (!INITIALLY_ENABLED_TOOLS.has(toolDef.name)) {
    registered.disable();  // Hidden from tools/list, SDK auto-emits notification
  }
  toolRegistry.set(toolDef.name, registered);
}

// enable_tool meta-tool implementation
async function handleEnableTool({ name }: { name: string }) {
  const tool = toolRegistry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  tool.enable();  // SDK auto-emits notifications/tools/list_changed
  return { content: [{ type: 'text', text: `Tool '${name}' enabled` }] };
}
```

**IMPORTANT**: The `discover_tools` / `enable_tool` meta-tools should themselves always be enabled (never disabled) to allow discovery and activation.

### Known SDK Pitfall: Issue #893 — Post-Connect Registration

**Symptom**: Calling `registerTool()` after `server.connect(transport)` may throw "Cannot register capabilities after connecting to transport."

**Root cause**: `McpServer` lazily registers capabilities on first `registerTool()` call. If `connect()` runs first with no tools registered, later registrations fail.

**Workaround** (LOW confidence — issue is P2 open as of Feb 2026, may be fixed by implementation time):

```typescript
// Register and immediately disable a sentinel tool before connect()
// to force capability initialization
const sentinel = server.registerTool('__init__', { description: 'init' }, async () => ({
  content: [{ type: 'text', text: '' }]
}));
sentinel.disable();

await server.connect(transport);

// Now safe to register tools dynamically
```

**Alternative**: Register all tools (disabled or enabled) before `connect()`. This is the cleaner design and avoids the issue entirely. The lazy-loading architecture can register all tools upfront (some disabled) before connection.

---

## Installation

```bash
# Upgrade MCP SDK (major version bump from 0.6 to 1.x)
npm install @modelcontextprotocol/sdk@^1.27.1

# All other dependencies remain unchanged
# No new packages needed for outputSchema/structuredContent/annotations/listChanged
# (all are built into the v1 SDK)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `McpServer` (high-level v1 API) | Low-level `Server` class | Only when needing raw JSON-RPC control unavailable through `McpServer`. Not needed here — `McpServer` covers all milestone requirements. |
| Enable/disable via `RegisteredTool.disable()` | Custom `tools/list` handler filtering | The custom filter approach requires reimplementing what the SDK provides for free. Only use if `RegisteredTool.enable/disable` has bugs that block progress. |
| Register all tools upfront (some disabled) | Register tools lazily on demand | On-demand registration risks Issue #893 (post-connect capability error). Upfront registration with disable() is safer and simpler. |
| `McpServer.registerTool()` with Zod `outputSchema` | Manual JSON Schema construction | Manual construction adds complexity and bypasses SDK type safety. The SDK accepts Zod directly. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@modelcontextprotocol/sdk@^0.6.0` | Pre-v1 API. No `registerTool()`, no `outputSchema`, no `annotations`, no automatic `listChanged` notifications. `Server.setRequestHandler()` pattern requires reimplementing everything the v1 high-level API provides. | `^1.27.1` |
| `server.setRequestHandler(ListToolsRequestSchema, ...)` for tool dispatch | v0 pattern. Requires manual tool routing, no automatic enable/disable, no SDK-managed notifications. | `McpServer.registerTool()` |
| Calling `sendToolListChanged()` manually in enable/disable flow | Redundant — `RegisteredTool.enable()` and `disable()` emit the notification automatically. Double-emitting causes unnecessary client re-fetches. | Let the SDK handle it |
| Separate `McpServer` instances per tool category | Overcomplicated. A single `McpServer` with a `Map<string, RegisteredTool>` registry is the correct pattern. | Single `McpServer` with tool registry |
| `zod-to-json-schema` at tool registration callsite | The v1 SDK accepts Zod schemas directly in `registerTool()`. Manual conversion is redundant and duplicates internal SDK logic. | Pass Zod schema directly to `registerTool()` |

---

## Stack Patterns by Variant

**If `lazy_loading: true` (default):**
- Register ALL tools before `connect()`, with non-meta tools disabled
- `discover_tools` and `enable_tool` are always enabled
- `enable_tool` calls `toolRegistry.get(name).enable()`
- SDK auto-emits `notifications/tools/list_changed`
- Client re-fetches `tools/list` and gets the expanded set

**If `lazy_loading: false` (backward compat mode):**
- Register ALL tools before `connect()`, all enabled
- Do not register `discover_tools` or `enable_tool` meta-tools
- Behavior identical to current v0 server (from client's perspective)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@modelcontextprotocol/sdk@^1.27.1` | Node.js `>=18.0.0` | Verified in SDK release notes |
| `@modelcontextprotocol/sdk@^1.27.1` | `zod@^3.22.4` | SDK accepts Zod v3 schemas in `registerTool()` |
| `@modelcontextprotocol/sdk@^1.27.1` | `typescript@^5.3.3` | Full TypeScript support, types ship with SDK |
| `@modelcontextprotocol/sdk@^1.x` | `@modelcontextprotocol/sdk@^0.6.0` (client) | Server at v1 is backward compatible with older clients — additive `structuredContent` alongside `content` text is the compatibility mechanism |

---

## Sources

- **HIGH confidence** — [MCP 2025-11-25 Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — `outputSchema`, `structuredContent`, `annotations`, `listChanged` fields and requirements verified here
- **HIGH confidence** — [TypeScript SDK server.md docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — `registerTool()` API with `outputSchema`, `structuredContent`, `annotations` code examples verified
- **HIGH confidence** — [SDK Issue #1132 (Tool List Changed)](https://github.com/modelcontextprotocol/typescript-sdk/issues/1132) — Confirms `mcpServer.sendToolListChanged()`, `mcpServer.registerTool()` automatic notification, and client handler pattern
- **HIGH confidence** — [SDK Issue #898 (Unregister Tools)](https://github.com/modelcontextprotocol/typescript-sdk/issues/898) — Confirms `RegisteredTool.remove()`, `RegisteredTool.update()` exist and are the resolution
- **HIGH confidence** — [SDK Issue #654 (structuredContent blocks error)](https://github.com/modelcontextprotocol/typescript-sdk/issues/654) — Confirms PR #655 fix: `isError: true` skips `outputSchema` validation
- **MEDIUM confidence** — [SDK Issue #893 (post-connect registration bug)](https://github.com/modelcontextprotocol/typescript-sdk/issues/893) — Confirms the capability-registration timing pitfall; fix status as of Feb 2026 is P2/open
- **MEDIUM confidence** — [WebSearch synthesis: RegisteredTool enable/disable](https://github.com/modelcontextprotocol/typescript-sdk) — `RegisteredTool.enable()` / `RegisteredTool.disable()` confirmed to auto-emit `listChanged`; verified across multiple search results
- **MEDIUM confidence** — [npm @modelcontextprotocol/sdk versions](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — Latest version `1.27.1` confirmed (published Feb 24, 2026)
- **MEDIUM confidence** — [MCP 2025-11-25 release blog](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — Spec release context
- **LOW confidence** — [Vercel AI Issue #11441](https://github.com/vercel/ai/issues/11441) — Third-party SDK support for `structuredContent`/`outputSchema`; useful for ecosystem awareness but not authoritative for implementation

---

*Stack research for: Obsidian MCP Server — Milestone 2 (MCP modernization + lazy loading)*
*Researched: 2026-02-26*
