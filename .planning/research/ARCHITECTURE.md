# Architecture Research

**Domain:** MCP Server with Dynamic Tool Registry (Lazy Loading)
**Researched:** 2026-02-26
**Confidence:** HIGH — all SDK claims verified directly against installed source at `node_modules/@modelcontextprotocol/sdk@1.27.1`

---

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                     MCP CLIENT (Claude Code)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  ListTools  │  │   CallTool   │  │  ToolListChanged handler  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────────────────────┘ │
└─────────┼────────────────┼─────────────────────────────────────── ┘
          │  stdio (JSON-RPC)          ^ notification (one-way)
┌─────────┼────────────────┼───────────┼───────────────────────────┐
│         ▼                ▼           │   MCP SERVER (index.ts)    │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │            Server (SDK: @modelcontextprotocol/sdk)       │      │
│  │  setRequestHandler(ListToolsRequestSchema, ...)          │      │
│  │  setRequestHandler(CallToolRequestSchema, ...)           │      │
│  │  sendToolListChanged()  ──────────────────────────────► │      │
│  └──────────────────────────┬──────────────────────────────┘      │
│                             │                                      │
│  ┌──────────────────────────▼──────────────────────────────┐      │
│  │                  ToolRegistry (new module)               │      │
│  │  allTools:     Map<string, ToolRegistration>             │      │
│  │  enabledTools: Set<string>                               │      │
│  │  getEnabledDefinitions() → ToolDefinition[]              │      │
│  │  enableTool(name) / enableCategory(category)             │      │
│  │  isEnabled(name) → boolean                               │      │
│  └──────────────────────────┬──────────────────────────────┘      │
│                             │                                      │
│  ┌──────────────────────────▼──────────────────────────────┐      │
│  │              Tool Handlers (handlers.ts, handlers2.ts)   │      │
│  │  handleReadNote / handleCreateNote / etc.                │      │
│  └──────────────────────────┬──────────────────────────────┘      │
│                             │                                      │
│  ┌──────────────────────────▼──────────────────────────────┐      │
│  │              Filesystem + Obsidian API Layer             │      │
│  └─────────────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| `src/index.ts` | Server lifecycle, transport, handler registration; owns `server` instance | Must pass `server` (or callback) to registry so handlers can call `sendToolListChanged()` |
| `src/tools/registry.ts` (new) | Holds `Map<string, ToolRegistration>` + `Set<string>` of enabled tools; exposes `enable`, `getEnabled`, `getAll` | Session-scoped state lives here |
| `src/tools/index.ts` | Rewired: delegates ListTools to `registry.getEnabledDefinitions()`, CallTool dispatches only enabled tools | Replaces `getToolDefinitions()` and switch dispatch |
| `src/tools/meta-tools.ts` (new) | `discover_tools` and `enable_tool` handler implementations | Must call registry + trigger `sendToolListChanged()` |
| `src/tools/handlers.ts` | Existing tool handler functions — unchanged | |
| `src/tools/handlers2.ts` | Existing tool handler functions — unchanged | |

---

## SDK API: notifications/tools/list_changed

**Confidence: HIGH — read directly from `node_modules/@modelcontextprotocol/sdk@1.27.1/dist/server/index.d.ts` and `index.js`.**

### Exact Method

```typescript
// Declared on the Server class:
sendToolListChanged(): Promise<void>

// Implementation (from index.js line 175-177):
async sendToolListChanged() {
  return this.notification({ method: "notifications/tools/list_changed" });
}
```

This calls the underlying `Protocol.notification()` method, which sends a JSON-RPC notification with `method: "notifications/tools/list_changed"` and no params. The method is fire-and-forget (one-way, no response expected).

### Capability Declaration Requirement

The SDK guards `sendToolListChanged()` with a capability check. From `index.js` line 70-73:

```javascript
case "notifications/tools/list_changed":
  if (!this._capabilities.tools) {
    throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
  }
```

The check is `!this._capabilities.tools` — it only requires `tools` to be a truthy object, NOT `tools.listChanged`. The current server already passes this:

```typescript
// src/index.ts — current code, already sufficient
const server = new Server(
  { name: 'obsidian-mcp-server', version: '1.0.0' },
  {
    capabilities: {
      tools: {},  // This alone satisfies the capability check
    },
  }
);
```

No change to the `Server` constructor is needed to enable `sendToolListChanged()`.

### Calling the Method

`sendToolListChanged()` must be called on the `server` instance, which lives in `main()`'s closure in `index.ts`. The tool registry cannot call it directly without a reference.

Two valid patterns:

**Pattern A — Pass callback at registry construction (recommended):**

```typescript
// src/index.ts
const registry = new ToolRegistry({
  lazyLoading: config.lazy_loading ?? true,
  onToolListChanged: () => server.sendToolListChanged(),
});
```

**Pattern B — Pass server reference to registry:**

```typescript
// Less clean — creates circular dependency concern
registry.setServer(server);
```

Pattern A is preferred. The callback is set up after `server` is constructed but before `server.connect(transport)`, so the closure captures the correct reference.

---

## Session State vs Global State

**Confidence: HIGH — verified from SDK source and stdio transport architecture.**

### How stdio MCP servers work

An MCP server using `StdioServerTransport` has **exactly one client connection per process**. The transport reads from `process.stdin` and writes to `process.stdout`. When the client disconnects, the process either exits or waits for a new connection on the same stdio pair.

In practice, each Claude Code session spawns the MCP server as a fresh child process. This means:

- **There is only ever one active client connection per server process.**
- **Session state IS process-level state.**
- A `Set<string>` of enabled tools on the `ToolRegistry` singleton is effectively session-scoped because each session gets a new process.

### Implications

| Question | Answer |
|----------|--------|
| Do enabled tools persist across sessions? | No — each session is a new process, registry starts fresh |
| Is there a multi-connection problem? | No — stdio is single-connection by design |
| Do we need per-connection state isolation? | No — global module-level state is session-scoped |
| Should the registry be a class instance or module singleton? | Module-level singleton is fine; constructor approach is cleaner for testing |

**Conclusion:** Treat the `ToolRegistry` as a process-level singleton. Initialize it once in `main()`, pass it to handlers. No session ID tracking, no connection multiplexing is needed for the stdio transport.

---

## Registry Structure

### Concrete TypeScript Design

```typescript
// src/tools/registry.ts

export interface ToolRegistration {
  name: string;
  category: string;
  description: string;                    // One-line description for discover_tools
  definition: ToolDefinition;             // Full schema for ListTools response
  handler: (config: ServerConfig, args: any) => Promise<ToolResponse>;
  alwaysLoaded: boolean;                  // true for discover_tools, enable_tool
}

export interface RegistryOptions {
  lazyLoading: boolean;
  onToolListChanged?: () => Promise<void>; // callback to server.sendToolListChanged()
}

export class ToolRegistry {
  private allTools: Map<string, ToolRegistration> = new Map();
  private enabledTools: Set<string> = new Set();
  private options: RegistryOptions;

  constructor(options: RegistryOptions) {
    this.options = options;
  }

  register(registration: ToolRegistration): void {
    this.allTools.set(registration.name, registration);
    if (registration.alwaysLoaded || !this.options.lazyLoading) {
      this.enabledTools.add(registration.name);
    }
  }

  enable(toolName: string): ToolRegistration | undefined {
    const tool = this.allTools.get(toolName);
    if (!tool) return undefined;
    this.enabledTools.add(toolName);
    return tool;
  }

  enableCategory(category: string): ToolRegistration[] {
    const enabled: ToolRegistration[] = [];
    for (const tool of this.allTools.values()) {
      if (tool.category === category) {
        this.enabledTools.add(tool.name);
        enabled.push(tool);
      }
    }
    return enabled;
  }

  isEnabled(toolName: string): boolean {
    return this.enabledTools.has(toolName);
  }

  getEnabledDefinitions(): ToolDefinition[] {
    return Array.from(this.enabledTools)
      .map(name => this.allTools.get(name)!)
      .filter(Boolean)
      .map(r => r.definition);
  }

  getAllSummaries(): ToolSummary[] {
    return Array.from(this.allTools.values()).map(r => ({
      name: r.name,
      category: r.category,
      description: r.description,
      enabled: this.enabledTools.has(r.name),
    }));
  }

  async dispatch(config: ServerConfig, toolName: string, args: any): Promise<ToolResponse> {
    const tool = this.allTools.get(toolName);
    if (!tool) throw new Error(`Unknown tool: ${toolName}`);
    if (!this.enabledTools.has(toolName)) throw new Error(`Tool not enabled: ${toolName}. Call enable_tool first.`);
    return tool.handler(config, args);
  }
}
```

### Registration Pattern for Existing Tools

```typescript
// src/tools/index.ts — after registry migration

import { ToolRegistry } from './registry.js';

export function buildRegistry(options: RegistryOptions): ToolRegistry {
  const registry = new ToolRegistry(options);

  // Meta-tools — always loaded
  registry.register({
    name: 'discover_tools',
    category: 'Meta',
    description: 'List all available tools with name, category, description, and enabled status',
    alwaysLoaded: true,
    definition: {
      name: 'discover_tools',
      description: '...',
      inputSchema: zodToJsonSchema(DiscoverToolsSchema),
    },
    handler: (config, args) => handleDiscoverTools(registry, args),
  });

  registry.register({
    name: 'enable_tool',
    category: 'Meta',
    description: 'Enable a tool by name or category so it appears in tool listings',
    alwaysLoaded: true,
    definition: {
      name: 'enable_tool',
      description: '...',
      inputSchema: zodToJsonSchema(EnableToolSchema),
    },
    handler: async (config, args) => {
      const result = await handleEnableTool(registry, args);
      await options.onToolListChanged?.();
      return result;
    },
  });

  // Feature tools — lazy-loaded
  registry.register({
    name: 'read_note',
    category: 'Core CRUD',
    description: 'Read note content, frontmatter, links, and metadata',
    alwaysLoaded: false,
    definition: {
      name: 'read_note',
      description: '...',
      inputSchema: zodToJsonSchema(ReadNoteSchema),
    },
    handler: (config, args) => handleReadNote(config, ReadNoteSchema.parse(args)),
  });
  // ... all other tools follow the same pattern

  return registry;
}
```

### Wiring in index.ts

```typescript
// src/index.ts — updated main()

const server = new Server(
  { name: 'obsidian-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }  // No change needed
);

const registry = buildRegistry({
  lazyLoading: config.lazy_loading ?? true,
  onToolListChanged: () => server.sendToolListChanged(),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = registry.getEnabledDefinitions();
  logger.debug({ toolCount: tools.length }, 'Tools listed');
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return registry.dispatch(config, name, args || {});
});
```

---

## Data Flow

### Tool Enable Flow (Happy Path)

```text
Client calls enable_tool({ tool_name: "get_link_graph" })
  │
  ▼
registry.enable("get_link_graph")
  → enabledTools.add("get_link_graph")
  → returns ToolRegistration
  │
  ▼
options.onToolListChanged()
  → server.sendToolListChanged()
  → Protocol.notification({ method: "notifications/tools/list_changed" })
  → JSON-RPC notification sent on stdout
  │
  ▼
enable_tool returns { enabled: ["get_link_graph"], schema: { ... } }
  │
  ▼
Client receives notification, calls ListTools
  → registry.getEnabledDefinitions() includes "get_link_graph" now
  → Client adds get_link_graph to its available tools
  │
  ▼
Client calls get_link_graph({ ... })
  → registry.dispatch() routes to handleGetLinkGraph
```

### Lazy Loading Disabled (Backward Compatible)

```text
config.lazy_loading = false
  │
  ▼
buildRegistry({ lazyLoading: false, ... })
  → every register() call also adds to enabledTools
  → getEnabledDefinitions() returns all 24 tools
  → behavior identical to current system
```

---

## Architectural Patterns

### Pattern 1: Registry as Singleton, callback for server coupling

**What:** ToolRegistry holds all state; `index.ts` passes a callback arrow function that closes over the `server` instance. Registry never imports from `index.ts`.

**When to use:** When a subsystem needs to trigger server-level behavior but shouldn't depend on the server.

**Trade-offs:** Slightly indirect. The alternative (passing `server` directly to registry) creates a tighter coupling and makes testing harder.

**Example:**
```typescript
// index.ts
const registry = buildRegistry({
  lazyLoading: true,
  onToolListChanged: () => server.sendToolListChanged(),
});
```

### Pattern 2: enable_tool returns the full schema immediately

**What:** `enable_tool` returns the full JSON schema for the enabled tool in its response, in addition to triggering `list_changed`. This means the client doesn't have to wait for the ListTools round-trip to get the schema.

**When to use:** Always — reduces one network round-trip for the most common case.

**Trade-offs:** Slightly larger response from `enable_tool`, but avoids one full ListTools call.

**Example:**
```typescript
// From TOOL_EXPANSION_SPEC.md section 6:
// Output: { enabled: ["get_link_graph"], schema: { /* full JSON schema */ } }
```

### Pattern 3: Category batch enabling

**What:** `enable_tool({ category: "Core CRUD" })` enables all tools in that category in one call, emitting one `list_changed` notification.

**When to use:** When the agent knows it will need a full category of tools.

**Trade-offs:** One notification vs N notifications. Always prefer batching.

**Example:**
```typescript
// Single notification for the entire batch
async function handleEnableTool(registry, args) {
  const { tool_name, category } = EnableToolSchema.parse(args);
  const enabled = category
    ? registry.enableCategory(category)
    : [registry.enable(tool_name)].filter(Boolean);

  // onToolListChanged called once by the caller (index.ts registration wrapping)
  return { enabled: enabled.map(t => t.name), schemas: enabled.map(t => t.definition) };
}
```

---

## Component Boundaries

### What Changes in Each File

| File | Change Type | Details |
|------|-------------|---------|
| `src/tools/registry.ts` | New | `ToolRegistry` class, `ToolRegistration` interface |
| `src/tools/index.ts` | Rewritten | `buildRegistry()` replaces `getToolDefinitions()` + switch dispatch |
| `src/tools/meta-tools.ts` | New | `handleDiscoverTools`, `handleEnableTool` implementations |
| `src/index.ts` | Modified | Construct registry, rewire ListTools/CallTool handlers |
| `src/types/index.ts` | Extended | Add `lazy_loading?: boolean` to `ServerConfig` |
| `src/config/index.ts` | Extended | Parse `lazy_loading` from config file, default `true` |
| `src/tools/handlers.ts` | Unchanged | Handler functions stay as-is |
| `src/tools/handlers2.ts` | Unchanged | Handler functions stay as-is |

### What Does NOT Change

- The handler function signatures in `handlers.ts` and `handlers2.ts` — registry wraps them, doesn't modify them
- The Zod schemas in `schemas.ts`
- The transport setup in `index.ts`
- The `Server` constructor options — `capabilities: { tools: {} }` is already sufficient

---

## Build Order Implications

The lazy loading implementation has hard dependencies that enforce build order:

```text
1. Config layer: add lazy_loading field to ServerConfig + loadConfig()
     ↓ (types must exist before registry can be typed)

2. ToolRegistry class (registry.ts) with Map + Set structure
     ↓ (registry must exist before tools can register into it)

3. Meta-tool handlers (meta-tools.ts): discover_tools + enable_tool logic
     ↓ (meta-tools depend on registry API being stable)

4. buildRegistry() function in tools/index.ts — migrate all 13 existing tools
     ↓ (all registrations must be present before wiring)

5. index.ts: wire registry into ListTools/CallTool handlers + onToolListChanged callback
     ↓ (server must be constructed before callback can reference it)

6. Integration test: verify list_changed fires, verify enabled tools appear in ListTools
```

Wave 2 tools (get_link_graph, find_orphans, etc.) can be registered into the registry as they are built — the registry is designed for incremental registration. Each new tool is just a `registry.register({...})` call.

**Critical prerequisite:** The registry must be built before any Wave 3 tasks begin. The registry IS Wave 3 Step 3.1 in the spec. Steps 3.2 through 3.5 all depend on 3.1.

---

## Anti-Patterns

### Anti-Pattern 1: Calling sendToolListChanged() inside the handler return

**What people do:** Emit the notification inside the `enable_tool` handler function body and try to send it before returning the result.

**Why it's wrong:** `sendToolListChanged()` is async. If awaited inside a synchronous handler chain, it may complete before the `enable_tool` result is returned to the client, causing a race where the client receives `list_changed` before it receives the `enable_tool` response. The client may call ListTools before the response has been acknowledged.

**Do this instead:** The `onToolListChanged` callback should be invoked from the registry dispatch wrapper in `index.ts` *after* the handler returns its result, or fire it without awaiting so both the response and the notification are sent concurrently. The SDK's `notification()` call is non-blocking from the client perspective — the notification goes on the wire after the response.

```typescript
// Safe: fire notification after result is prepared, don't block the response
handler: async (config, args) => {
  const result = await handleEnableTool(registry, args);
  // Do not await — let it fire as the response is being returned
  options.onToolListChanged?.().catch(err => logger.warn({ err }, 'list_changed failed'));
  return result;
},
```

### Anti-Pattern 2: Skipping the capability check assumption

**What people do:** Add `tools: { listChanged: true }` to capabilities, thinking it is required.

**Why it's wrong:** The SDK only checks `this._capabilities.tools` exists (truthy). Adding `listChanged: true` is harmless but unnecessary. The extra field advertises to clients that you support list_changed, which is useful for protocol conformance but not required for the method to work.

**Do this instead:** Either leave `tools: {}` (works), or add `tools: { listChanged: true }` for explicitness in the advertised capabilities. Do not change anything else.

### Anti-Pattern 3: Registering tools as module-level side effects

**What people do:** Call `registry.register(...)` at the top level of `handlers.ts` or `schemas.ts` so tools self-register on import.

**Why it's wrong:** Creates implicit import-order dependencies. Makes it impossible to test the registry in isolation. Prevents tree-shaking. The `buildRegistry()` factory function pattern keeps all registrations explicit and co-located.

**Do this instead:** Use the `buildRegistry()` factory in `tools/index.ts`. All registrations happen in one function, called once in `main()`.

### Anti-Pattern 4: Checking client capabilities before sending list_changed

**What people do:** Check `server.getClientCapabilities()` before calling `sendToolListChanged()`, assuming the client must opt in.

**Why it's wrong:** Per the MCP spec, the server advertises that it supports tool list changes (via `capabilities.tools`). The client does not need to opt in — it is expected to handle `notifications/tools/list_changed` if it has called ListTools. Claude Code handles this correctly.

**Do this instead:** Call `server.sendToolListChanged()` unconditionally after enabling tools. The SDK will guard it with the server-side capability check.

---

## Scaling Considerations

This is a single-user, single-process MCP server over stdio. Traditional scaling concerns do not apply. The relevant concerns are:

| Concern | Impact | Approach |
|---------|--------|---------|
| Tool count growth (24 → 50+ tools) | ListTools response size at enable-all | Registry is O(n) on getEnabledDefinitions; acceptable up to hundreds of tools |
| Large vault graph (1000+ notes) | get_link_graph memory | In-memory adjacency list; cache invalidation via vault watcher |
| Concurrent tool calls | N/A | stdio is single-threaded JSON-RPC; calls are serialized |
| Registry state corruption | Impossible with Map/Set | JavaScript single-threaded; no concurrent mutation |

---

## Sources

- `node_modules/@modelcontextprotocol/sdk@1.27.1/dist/server/index.d.ts` — `sendToolListChanged()` signature (HIGH confidence, direct source)
- `node_modules/@modelcontextprotocol/sdk@1.27.1/dist/server/index.js` — `sendToolListChanged()` implementation, capability guard logic (HIGH confidence, direct source)
- `node_modules/@modelcontextprotocol/sdk@1.27.1/dist/shared/protocol.d.ts` — `notification()` base method, `Protocol` class structure (HIGH confidence, direct source)
- `node_modules/@modelcontextprotocol/sdk@1.27.1/dist/types.d.ts` — `ToolSchema`, `ToolListChangedNotificationSchema`, `ServerCapabilities` (HIGH confidence, direct source)
- `src/index.ts` — Current server initialization and handler wiring (direct read)
- `src/tools/index.ts` — Current dispatch pattern (direct read)
- `docs/TOOL_EXPANSION_SPEC.md` Section 6 — Lazy loading design intent and meta-tool contracts (project document)
- `.planning/codebase/ARCHITECTURE.md` — Current architecture layers and state management (project document)
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) — Repository overview, v2 pre-alpha status note (WebSearch, MEDIUM confidence)

---

*Architecture research for: Obsidian MCP Server — Dynamic Tool Registry with Lazy Loading*
*Researched: 2026-02-26*
