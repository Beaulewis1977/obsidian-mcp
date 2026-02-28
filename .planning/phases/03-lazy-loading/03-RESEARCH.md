# Phase 3: Lazy Loading - Research

**Researched:** 2026-02-27
**Domain:** MCP server-side lazy tool loading — ToolRegistry session state, meta-tools, SDK notifications
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAZY-01 | `discover_tools` meta-tool — returns all registered tools with name, category, description, enabled status; always enabled | ToolRegistry.getAll() already returns all registrations; handler reads .category and .alwaysLoaded fields |
| LAZY-02 | `enable_tool` meta-tool — enables a named tool in the current session; emits `notifications/tools/list_changed` (non-blocking fire-and-forget) | ToolRegistry.enable(name) is already implemented; SDK `server.sendToolListChanged()` is the exact API; fire-and-forget pattern documented in Code Examples |
| LAZY-03 | When `lazy_loading: true` (default), only `discover_tools` and `enable_tool` are enabled at session start | buildRegistry() flow: register all tools → conditionally call enableAll() OR only enable alwaysLoaded tools based on config.lazy_loading |
| LAZY-04 | When `lazy_loading: false`, all tools enabled at session start (backward-compat) | buildRegistry() already calls enableAll(); keep that path; gate it behind config check |
| LAZY-05 | `enable_tool` response includes full tool schema so clients without list_changed support can use immediately | ToolRegistry.getRegistration(name).definition already contains the full tool definition including inputSchema and outputSchema |

</phase_requirements>

---

## Summary

Phase 3 implements progressive disclosure: by default, the MCP server advertises only `discover_tools` and `enable_tool` to clients at session start (~1,000 tokens), cutting the tool context budget by 80-85% vs. the fully-expanded 24-tool surface. Clients call `discover_tools` to enumerate available tools and `enable_tool` to dynamically register specific tools — after which a `notifications/tools/list_changed` notification signals the client to refresh its tool list.

The infrastructure for this phase is nearly complete from Phase 2. `ToolRegistry` already has `enable()`, `enableAll()`, `getAll()`, `getEnabledDefinitions()`, and `getRegistration()`. All 17 existing tools already carry `category` and `alwaysLoaded` fields. `ServerConfig` already has the `lazy_loading?: boolean` field. The missing work is: (1) change `buildRegistry()` to respect `lazy_loading` config, (2) add the two meta-tools with their handlers, (3) update the server capability declaration, (4) wire fire-and-forget `sendToolListChanged()` in the `enable_tool` handler.

The MCP SDK `@modelcontextprotocol/sdk` v1.27.1 (installed) exposes `server.sendToolListChanged()` directly on the low-level `Server` class. This method internally calls `this.notification({ method: 'notifications/tools/list_changed' })`. The underlying `notification()` throws `'Not connected'` if the transport is not attached — meaning the fire-and-forget MUST wrap the call in a void try-catch. The server also MUST declare `capabilities: { tools: { listChanged: true } }` (adding the `listChanged` sub-field) so MCP clients know to expect the notification.

**Primary recommendation:** Keep the existing low-level `Server` class (not `McpServer`). Add `listChanged: true` to the tools capability. Implement `discover_tools` and `enable_tool` handlers directly in a new `src/tools/handlers-meta.ts`. Change `buildRegistry()` to accept a `lazyLoading: boolean` parameter and skip `enableAll()` when true. Call `server.sendToolListChanged()` fire-and-forget in `enable_tool` by capturing the server reference in a closure and wrapping with `void Promise.resolve().then(() => server.sendToolListChanged()).catch(() => {})`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.27.1 (installed) | MCP server, `sendToolListChanged()`, notification dispatch | Already integrated; `sendToolListChanged()` is the exact API for this feature |
| `zod` | Already installed | Input schema validation for `discover_tools` + `enable_tool` | Project standard; all other tools use Zod for schema validation |
| `zod-to-json-schema` | Already installed | Convert Zod schemas to JSON Schema for `enable_tool` response payload | Already used for all 17 tool inputSchema conversions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | Already installed | Testing the meta-tool handlers and lazy-loading behavior | Same test framework as Phases 1 and 2 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `server.sendToolListChanged()` | `server.notification({ method: 'notifications/tools/list_changed' })` | The convenience method is cleaner; both work since the `tools` capability is already declared |
| Global registry state | Per-connection registry instances | Session state is global (single-user stdio transport); per-connection would require transport session ID tracking that the current architecture does not support |

**Installation:** No new dependencies required. All needed packages are installed.

---

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── tools/
│   ├── registry.ts          # ToolRegistry class (unchanged from Phase 2)
│   ├── index.ts             # buildRegistry() — add lazyLoading param
│   ├── handlers-meta.ts     # NEW: handleDiscoverTools + handleEnableTool
│   ├── schemas.ts           # Add DiscoverToolsSchema + EnableToolSchema
│   └── __tests__/
│       └── lazy-loading.integration.test.ts  # NEW: Phase 3 tests
└── index.ts                 # Update capabilities: { tools: { listChanged: true } }
                             # Pass server ref to buildRegistry or handler
```

### Pattern 1: buildRegistry() with lazy_loading gate

**What:** `buildRegistry()` accepts a `lazyLoading` boolean. When `true`, it does NOT call `enableAll()` at the end — the meta-tools get enabled automatically via `alwaysLoaded: true`, while all other tools start disabled.

**When to use:** Every server startup. The `lazy_loading` flag comes from `ServerConfig.lazy_loading` (default: `true`).

**Example:**
```typescript
// Source: src/tools/index.ts — updated buildRegistry signature
export function buildRegistry(lazyLoading: boolean = true): ToolRegistry {
  const registry = new ToolRegistry();

  // Register all existing tools — alwaysLoaded: false for feature tools
  registry.register({
    definition: { name: 'read_note', ... },
    handler: ...,
    schema: ReadNoteSchema,
    category: 'Core CRUD',
    alwaysLoaded: false,   // Changed from true — lazy_loading controls this now
  });

  // ... all other feature tools with alwaysLoaded: false ...

  // Register meta-tools — always enabled regardless of lazy_loading
  registry.register({
    definition: { name: 'discover_tools', ... },
    handler: (config, args) => handleDiscoverTools(registry, config, args),
    schema: DiscoverToolsSchema,
    category: 'Meta',
    alwaysLoaded: true,   // always enabled
  });

  registry.register({
    definition: { name: 'enable_tool', ... },
    handler: (config, args) => handleEnableTool(registry, server, config, args),
    schema: EnableToolSchema,
    category: 'Meta',
    alwaysLoaded: true,   // always enabled
  });

  // Only call enableAll() when lazy_loading is false (backward compat)
  if (!lazyLoading) {
    registry.enableAll();
  }
  // When lazyLoading is true, only alwaysLoaded tools are in enabled Set

  return registry;
}
```

### Pattern 2: enable_tool handler with fire-and-forget notification

**What:** The `enable_tool` handler calls `registry.enable(toolName)`, builds the response with the full tool schema, returns the response, and fires the notification asynchronously. The notification must NOT be awaited before returning the response.

**When to use:** Always — this is the core of LAZY-02 and the spec requirement.

**Example:**
```typescript
// Source: src/tools/handlers-meta.ts
export function handleEnableTool(
  registry: ToolRegistry,
  server: Server,    // captured from main() via closure
  config: ServerConfig,
  args: z.infer<typeof EnableToolSchema>
): ToolResponse {
  const { tool_name } = args;

  const registration = registry.getRegistration(tool_name);
  if (!registration) {
    return createErrorResponse(
      'Tool not found',
      `No tool registered with name: ${tool_name}`,
      'VALIDATION_ERROR',
      `Call discover_tools to see available tool names.`
    );
  }

  const alreadyEnabled = registry.isEnabled(tool_name);
  registry.enable(tool_name);

  // Fire-and-forget: do NOT await; return response immediately
  // Wrap in catch to handle "Not connected" if transport not yet attached
  void Promise.resolve()
    .then(() => server.sendToolListChanged())
    .catch(() => { /* client may not support notifications — silently ignore */ });

  const payload = {
    enabled: [tool_name],
    already_enabled: alreadyEnabled,
    schema: registration.definition,
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}
```

### Pattern 3: discover_tools handler

**What:** Returns lightweight metadata for all registered tools. Uses `registry.getAll()` which already exists. Does NOT return full tool schemas (too large).

**When to use:** Any time a client wants to explore what tools exist.

**Example:**
```typescript
// Source: src/tools/handlers-meta.ts
export function handleDiscoverTools(
  registry: ToolRegistry,
  config: ServerConfig,
  args: z.infer<typeof DiscoverToolsSchema>
): ToolResponse {
  const { query, category } = args;

  let tools = registry.getAll().map(reg => ({
    name: reg.definition.name,
    category: reg.category,
    description: reg.definition.description,
    enabled: registry.isEnabled(reg.definition.name),
  }));

  if (query) {
    const q = query.toLowerCase();
    tools = tools.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  }

  if (category) {
    tools = tools.filter(t =>
      t.category.toLowerCase() === category.toLowerCase()
    );
  }

  const categories = [...new Set(registry.getAll().map(r => r.category))].sort();

  const payload = {
    tools,
    categories,
    total: registry.getAll().length,
    enabled: tools.filter(t => t.enabled).length,
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}
```

### Pattern 4: Server capability update in src/index.ts

**What:** Add `listChanged: true` to the tools capability so the client knows this server emits `notifications/tools/list_changed`. Pass the server reference to the registry or handler closure.

**Example:**
```typescript
// Source: src/index.ts
const server = new Server(
  { name: 'obsidian-mcp-server', version: '1.0.0' },
  {
    capabilities: {
      tools: { listChanged: true },  // ADD listChanged: true
    },
  }
);

// Pass lazy_loading flag from config (default true if unset)
const lazyLoading = config.lazy_loading !== false;
const registry = buildRegistry(lazyLoading, server);  // pass server ref for handler closures
```

### Pattern 5: Passing server reference to meta-tool handlers

**What:** The `enable_tool` handler needs the `server` reference to call `sendToolListChanged()`. Since the `ToolRegistry` handler signature is `(config: ServerConfig, args: any) => Promise<ToolResponse>`, the server reference must be captured via closure at registration time.

**Example:**
```typescript
// In buildRegistry(lazyLoading, server):
registry.register({
  definition: { name: 'enable_tool', ... },
  handler: (config, args) => handleEnableTool(registry, server, config, args),
  // server captured in closure — available when handler is called
  ...
});
```

### Anti-Patterns to Avoid

- **Awaiting sendToolListChanged() before returning the enable_tool response:** This creates a race condition and violates the spec requirement "non-blocking fire-and-forget, not awaited before the response." Always fire-and-forget with `void Promise.resolve().then(...)`.
- **Calling sendToolListChanged() without a try-catch:** The underlying `notification()` throws `'Not connected'` if the server is not yet connected to a transport. This can happen in tests. Always catch silently.
- **Registering meta-tools after buildRegistry() returns:** The `alwaysLoaded` mechanism only works during `register()`. Meta-tools must be registered inside `buildRegistry()` before any branching on `lazyLoading`.
- **Calling enableAll() then disabling non-meta tools:** Unnecessary complexity. The correct approach is to skip `enableAll()` entirely when `lazyLoading: true` — the `alwaysLoaded` flag handles meta-tool enablement during `register()`.
- **Setting `alwaysLoaded: true` on feature tools:** All feature tools (read_note, create_note, etc.) must have `alwaysLoaded: false` for lazy loading to have any effect. Currently in Phase 2 code, all tools have `alwaysLoaded: true`. This must change.
- **Using McpServer instead of Server:** The project uses the low-level `Server` class. `McpServer` has its own `sendToolListChanged()` but the project architecture is built around low-level `Server` with `setRequestHandler`. Don't switch.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sending `notifications/tools/list_changed` | Custom notification dispatch | `server.sendToolListChanged()` | Already implemented in SDK; handles JSON-RPC framing, transport write, and error cases |
| Filtering enabled tools for ListTools | Custom filter logic | `registry.getEnabledDefinitions()` | Already implemented; returns definitions for tools in the enabled Set |
| Getting all tool metadata for discover_tools | Custom iteration | `registry.getAll()` | Already returns full ToolRegistration[] including category and alwaysLoaded |
| Checking if a tool can be enabled | Custom existence check | `registry.getRegistration(name)` | Returns undefined if unknown, populated ToolRegistration if registered |
| Converting Zod schema to JSON Schema for response | Manual schema serialization | `zodToJsonSchema()` (already imported) | Already used in buildRegistry for all tool inputSchemas |

**Key insight:** The ToolRegistry was explicitly designed in Phase 2 for Phase 3 lazy loading. All necessary methods exist. The only new code needed is the handler logic and the buildRegistry wiring.

---

## Common Pitfalls

### Pitfall 1: alwaysLoaded: true on feature tools breaks lazy loading

**What goes wrong:** If any feature tool has `alwaysLoaded: true`, it will be in the enabled Set from the moment it's registered — even when `lazy_loading: true`. `ListTools` would return it at session start, defeating the purpose.

**Why it happens:** Phase 2 set `alwaysLoaded: true` on ALL 17 tools as a temporary measure (per STATE.md decision: "alwaysLoaded and category fields set on all 13 tools now for Phase 3 lazy loading compatibility; buildRegistry() calls enableAll()"). This was intentional for Phase 2 backward compat but must be changed in Phase 3.

**How to avoid:** Change all feature tools to `alwaysLoaded: false`. Only `discover_tools` and `enable_tool` get `alwaysLoaded: true`.

**Warning signs:** After Phase 3 implementation, `ListTools` with `lazy_loading: true` returns more than 2 tools.

### Pitfall 2: sendToolListChanged() throws "Not connected" in tests

**What goes wrong:** Unit tests that call the `enable_tool` handler directly will trigger the fire-and-forget `server.sendToolListChanged()` call. If the mock server has no transport, `notification()` throws `'Not connected'`, causing unhandled Promise rejection noise in tests.

**Why it happens:** The fire-and-forget is async and not awaited. The error propagates as an unhandled rejection after the handler has already returned.

**How to avoid:** Two options: (1) wrap with `.catch(() => {})` (already in the pattern above) — recommended; (2) in tests, mock `server.sendToolListChanged` as a no-op vi.fn().

**Warning signs:** Test output shows "UnhandledPromiseRejectionWarning: Error: Not connected".

### Pitfall 3: Missing listChanged: true in server capabilities

**What goes wrong:** The server can still call `sendToolListChanged()` successfully (the SDK only checks for `tools` capability, not the `listChanged` sub-field), but clients that inspect server capabilities before deciding whether to re-fetch the tool list (e.g., Claude Code) won't know to subscribe to the notification.

**Why it happens:** Forgetting to update the `Server` constructor's capabilities object when adding notification support.

**How to avoid:** Always update `capabilities: { tools: { listChanged: true } }` alongside the notification implementation.

**Warning signs:** Claude Code does not refresh its tool list after calling `enable_tool` even though the notification is sent successfully.

### Pitfall 4: Session state is process-global, not per-connection

**What goes wrong:** If the MCP client disconnects and reconnects, the registry's enabled Set persists from the previous session. The client receives 2 tools via ListTools, but the server internally has many tools enabled.

**Why it happens:** The registry is a process-level singleton. There is no reset-on-reconnect mechanism.

**How to avoid:** Add an `onclose` or `oninitialized` hook that resets the enabled Set to only alwaysLoaded tools. The Server class has `server.oninitialized` callback.

**Implementation:**
```typescript
server.oninitialized = () => {
  if (lazyLoading) {
    registry.resetToAlwaysLoaded();  // New method needed on ToolRegistry
  }
};
```

**Warning signs:** After reconnecting, `ListTools` returns more than 2 tools without any `enable_tool` calls in the new session.

### Pitfall 5: enable_tool with unknown tool_name returns confusing error

**What goes wrong:** If a client calls `enable_tool` with a misspelled or unavailable tool name, the error should guide them to use `discover_tools`. A generic error message is unhelpful.

**Why it happens:** Default error messages don't know about the meta-tool workflow.

**How to avoid:** Include `suggestion: 'Call discover_tools first to see all available tool names.'` in the error response.

### Pitfall 6: discover_tools returns stale enabled state

**What goes wrong:** `discover_tools` must check `registry.isEnabled(name)` for each tool dynamically — not cache it. If the enabled state is computed at registration time, it won't reflect tools enabled during the session.

**Why it happens:** Eager evaluation vs. lazy evaluation of enabled state.

**How to avoid:** Always call `registry.isEnabled(tool.name)` at handler invocation time, not at registration time.

---

## Code Examples

Verified patterns from direct SDK source inspection (v1.27.1 installed):

### Sending the notification (SDK source: server/index.js:433-435)

```typescript
// The SDK implementation of sendToolListChanged():
async sendToolListChanged() {
    return this.notification({ method: 'notifications/tools/list_changed' });
}
// Internally calls notification() which writes to the transport.
// Throws 'Not connected' if no transport is attached.
```

### Correct fire-and-forget call in enable_tool handler

```typescript
// Source: Pattern from SDK + project requirements (non-blocking fire-and-forget)
// CORRECT: fire-and-forget, error swallowed
void Promise.resolve()
  .then(() => server.sendToolListChanged())
  .catch(() => {}); // silence 'Not connected' in tests and edge cases

// WRONG: awaited (blocks response)
await server.sendToolListChanged();

// WRONG: unprotected (throws in tests)
void server.sendToolListChanged();
```

### Zod schema for discover_tools input

```typescript
// Source: project pattern from schemas.ts
import { z } from 'zod';

export const DiscoverToolsSchema = z.object({
  query: z.string().optional()
    .describe('Filter tools by keyword (searches name and description)'),
  category: z.string().optional()
    .describe('Filter by category name (e.g. "Core CRUD", "Graph", "Meta")'),
});
```

### Zod schema for enable_tool input

```typescript
// Source: project pattern + TOOL_EXPANSION_SPEC.md Section 6
export const EnableToolSchema = z.object({
  tool_name: z.string().min(1)
    .describe('Name of the tool to enable in the current session'),
  category: z.string().optional()
    .describe('Enable all tools in this category (alternative to tool_name; if both provided, tool_name takes precedence)'),
});
```

### ToolRegistry.resetToAlwaysLoaded() — new method needed

```typescript
// Source: new method to add to ToolRegistry (src/tools/registry.ts)
// Required for Pitfall 4: session reset on client reconnect
resetToAlwaysLoaded(): void {
  this.enabled.clear();
  for (const [name, reg] of this.tools) {
    if (reg.alwaysLoaded) {
      this.enabled.add(name);
    }
  }
}
```

### Server capability declaration (src/index.ts)

```typescript
// Source: SDK types — ServerCapabilities.tools.listChanged: boolean
const server = new Server(
  { name: 'obsidian-mcp-server', version: '1.0.0' },
  {
    capabilities: {
      tools: { listChanged: true },  // advertise list_changed support to clients
    },
  }
);
```

### buildRegistry signature update

```typescript
// Source: src/tools/index.ts
export function buildRegistry(lazyLoading: boolean = true, server?: Server): ToolRegistry {
  const registry = new ToolRegistry();

  // Feature tools: alwaysLoaded: false
  // ... all 17 existing tools with alwaysLoaded: false ...

  // Meta-tools: alwaysLoaded: true
  registry.register({ ..., category: 'Meta', alwaysLoaded: true }); // discover_tools
  registry.register({ ..., category: 'Meta', alwaysLoaded: true }); // enable_tool

  // Backward compat: enableAll() only when lazy_loading is false
  if (!lazyLoading) {
    registry.enableAll();
  }

  return registry;
}
```

### Verify-by-inspection test patterns

```typescript
// Source: existing test pattern from handlers.integration.test.ts + handlers-link.integration.test.ts
describe('lazy loading — discover_tools', () => {
  it('returns all registered tools with metadata', async () => {
    const result = await handleDiscoverTools(registry, mockConfig, {});
    const payload = JSON.parse(result.content[0].text);
    expect(payload.total).toBe(19); // 17 feature + 2 meta
    expect(payload.enabled).toBe(2); // only meta-tools at session start
  });
});

describe('lazy loading — enable_tool', () => {
  it('enables a registered tool and includes full schema in response', async () => {
    const mockServer = { sendToolListChanged: vi.fn().mockResolvedValue(undefined) };
    const result = await handleEnableTool(registry, mockServer as any, mockConfig, { tool_name: 'read_note' });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.enabled).toContain('read_note');
    expect(payload.schema).toBeDefined();
    expect(payload.schema.name).toBe('read_note');
    expect(registry.isEnabled('read_note')).toBe(true);
  });

  it('returns error for unknown tool name', async () => {
    const mockServer = { sendToolListChanged: vi.fn() };
    const result = await handleEnableTool(registry, mockServer as any, mockConfig, { tool_name: 'nonexistent' });
    expect(result.isError).toBe(true);
  });
});

describe('buildRegistry with lazy_loading: true', () => {
  it('ListTools returns exactly 2 tools at session start', () => {
    const registry = buildRegistry(true);
    const defs = registry.getEnabledDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs.map(d => d.name)).toContain('discover_tools');
    expect(defs.map(d => d.name)).toContain('enable_tool');
  });
});

describe('buildRegistry with lazy_loading: false', () => {
  it('ListTools returns all tools at session start', () => {
    const registry = buildRegistry(false);
    const defs = registry.getEnabledDefinitions();
    expect(defs.length).toBeGreaterThan(2);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `getToolDefinitions()` returning all tools | Registry-based `getEnabledDefinitions()` | Phase 2 (complete) | Foundation for lazy loading is in place |
| `enableAll()` unconditionally in buildRegistry() | Conditional `enableAll()` gated by `lazy_loading` flag | Phase 3 (this phase) | Enables the 80% token reduction |
| No meta-tools | `discover_tools` + `enable_tool` | Phase 3 (this phase) | Progressive disclosure workflow |
| No `notifications/tools/list_changed` | `server.sendToolListChanged()` fire-and-forget | Phase 3 (this phase) | Client refreshes tool list without reconnecting |

**Deprecated/outdated:**
- `getToolDefinitions()` function in index.ts: Already marked `@deprecated` in Phase 2. Do not extend it. It exists only for backward compat — leave as-is.
- `alwaysLoaded: true` on feature tools: Set in Phase 2 as temporary placeholder. Must change to `false` in Phase 3 for lazy loading to work.

---

## Open Questions

1. **Should `enable_tool` support enabling an entire category?**
   - What we know: The TOOL_EXPANSION_SPEC.md Section 6 shows `category?: string` as an alternative input. The requirements (LAZY-01 through LAZY-05) only specify single-tool enabling.
   - What's unclear: Whether category-enable is in scope for Phase 3 or deferred.
   - Recommendation: Implement `tool_name` (required) + `category` (optional, lower priority). If both provided, `tool_name` takes precedence. If only `category` provided, enable all tools in that category. This is low implementation cost and adds real UX value. The Zod schema above covers both.

2. **Session reset on client reconnect: is oninitialized the right hook?**
   - What we know: `Server` has `server.oninitialized?: () => void` callback. The MCP spec says the server receives an `initialized` notification from the client after the handshake.
   - What's unclear: Whether this fires on every new connection or only once per server process lifetime.
   - Recommendation: Per MCP spec, the `initialized` notification fires once per connection after the initialization handshake. This IS the right hook for session reset. Use `server.oninitialized = () => { if (lazyLoading) registry.resetToAlwaysLoaded(); }`.

3. **Claude Desktop: does it receive and act on notifications/tools/list_changed?**
   - What we know: STATE.md blocker: "Claude Desktop does not support `notifications/tools/list_changed`; confirm this does not break `enable_tool` flow (response body schema fallback is the mitigation)". The fire-and-forget design means a non-supporting client simply ignores the notification. The `enable_tool` response body INCLUDES the full tool schema (LAZY-05) precisely as the fallback.
   - What's unclear: Whether Claude Desktop errors on receiving an unsolicited notification vs. silently ignores it.
   - Recommendation: The MCP spec states notifications may be issued by servers without subscription. Claude Desktop MUST silently ignore unknown/unsupported notifications per protocol. The response body fallback (LAZY-05) covers the Claude Desktop use case. No action needed beyond the existing design.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (no explicit version in devDependencies — uses workspace install) |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` (same; all tests in one run) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAZY-01 | `discover_tools` returns all registered tools with name, category, description, enabled status | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-01 | `discover_tools` query filter narrows results by keyword | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-01 | `discover_tools` category filter narrows results | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-02 | `enable_tool` enables a named tool in the registry | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-02 | `enable_tool` response includes full tool schema | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-02 | `enable_tool` fires sendToolListChanged (fire-and-forget) | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-02 | `enable_tool` with unknown tool_name returns isError response | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-03 | `buildRegistry(true)` — enabled set contains exactly 2 tools | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-03 | `buildRegistry(true)` — discover_tools and enable_tool are the 2 tools | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-04 | `buildRegistry(false)` — enabled set contains all registered tools | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |
| LAZY-05 | `enable_tool` response payload includes `schema.inputSchema` and `schema.outputSchema` | unit | `npm test -- --run --reporter=verbose` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run` (full suite, all 116+ tests must pass)
- **Phase gate:** Full suite green + `npm run lint` exit 0 before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/tools/__tests__/lazy-loading.integration.test.ts` — covers LAZY-01 through LAZY-05 (all 11 test cases above)
- [ ] No new shared fixtures needed — existing `mockConfig` pattern from handlers.integration.test.ts is sufficient

---

## Sources

### Primary (HIGH confidence)

- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js:433-435` — `sendToolListChanged()` implementation (calls `this.notification({ method: 'notifications/tools/list_changed' })`)
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js:173-195` — `assertNotificationCapability()` confirms `tools: {}` (not just `tools: { listChanged: true }`) is sufficient to call sendToolListChanged without throwing
- `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js:781-784` — `notification()` throws `'Not connected'` when `_transport` is undefined — confirms fire-and-forget MUST catch errors
- `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts:785-787` — `ServerCapabilitiesSchema.tools.listChanged: ZodOptional<ZodBoolean>` — confirms `listChanged: true` is the correct sub-field
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.d.ts:193` — `sendToolListChanged(): Promise<void>` — exact method signature on `Server` class
- `src/tools/registry.ts` — ToolRegistry API: enable(), enableAll(), getAll(), getRegistration(), isEnabled(), getEnabledDefinitions() — all required methods exist
- `src/tools/index.ts` — buildRegistry() structure and all existing tool registrations with `alwaysLoaded: true` (must change to false)
- `src/types/index.ts:119-120` — `ServerConfig.lazy_loading?: boolean` and `always_loaded_tools?: string[]` already typed
- `.planning/STATE.md` (Decisions section) — "alwaysLoaded and category fields set on all 13 tools now for Phase 3 lazy loading compatibility; buildRegistry() calls enableAll() as final step"

### Secondary (MEDIUM confidence)

- `docs/TOOL_EXPANSION_SPEC.md` Section 6 — lazy loading architecture, meta-tool input/output schemas, implementation flow diagram
- `.planning/STATE.md` blocker — "Claude Desktop does not support `notifications/tools/list_changed`; confirm this does not break `enable_tool` flow (response body schema fallback is the mitigation)" — informs design of LAZY-05

### Tertiary (LOW confidence)

- None. All critical findings are verified directly from installed SDK source and project source files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from installed package source code, no external lookup needed
- Architecture: HIGH — `buildRegistry()` + `ToolRegistry` verified directly; SDK notification API verified from source
- Pitfalls: HIGH — "alwaysLoaded: true on feature tools" verified from STATE.md decision log; "Not connected" throw verified from protocol.js source; session reset need identified from MCP protocol semantics

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (MCP SDK 1.27.1 is pinned; stable for 30 days)
