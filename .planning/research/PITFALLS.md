# Pitfalls Research

**Domain:** TypeScript MCP Server — Dynamic Tool Registry, Spec Modernization, Cross-Platform Exec
**Researched:** 2026-02-26
**Confidence:** HIGH — all five domains verified against SDK source (node_modules), official MCP spec (modelcontextprotocol.io/specification/2025-11-25), and gray-matter GitHub issues

---

## Critical Pitfalls

### Pitfall 1: MCP SDK 0.6.1 Has No outputSchema, structuredContent, or annotations

**What goes wrong:**
The project requires MCP 2025-11-25 spec modernization (F-HIGH-01) including `outputSchema`, `structuredContent`, and `annotations` on all 13 existing tools. However, the installed SDK is `@modelcontextprotocol/sdk@0.6.1`, which does not have these fields. Verified by direct inspection: `ToolSchema.shape` contains only `{ name, description, inputSchema }` and `CallToolResultSchema.shape` contains only `{ _meta, content, isError }`. The `structuredContent` and `outputSchema` fields were added in the 1.x SDK releases tracking the 2025-06-18 and 2025-11-25 spec. The npm latest is `1.27.1`.

**Why it happens:**
The project config has `"@modelcontextprotocol/sdk": "^0.6.0"` pinned at a pre-1.0 version. The spec modernization task was written against the 2025-11-25 MCP spec, but no SDK upgrade was scoped alongside it.

**How to avoid:**
Before implementing any `outputSchema`/`structuredContent`/`annotations` code, upgrade the SDK to `^1.0.0` (or pin a specific 1.x version for stability). The SDK 1.x is a major version with breaking changes — do not assume the 0.6.1 → 1.x upgrade is drop-in. Audit changed method signatures, especially `Server` constructor options, `ToolSchema` shape, and `CallToolResultSchema`. Run the TypeScript compiler to surface breakage immediately after upgrading.

**Warning signs:**
- TypeScript error: `Property 'outputSchema' does not exist on type 'Tool'`
- TypeScript error: `Property 'structuredContent' does not exist on type 'CallToolResult'`
- `getToolDefinitions()` compiles and runs but clients never see `outputSchema` or `annotations` in the response — silent failure

**Phase to address:**
Wave 1 (MCP modernization) — must upgrade SDK before writing any 2025-11-25 spec code. SDK upgrade should be its own commit with full TypeScript compilation check before any feature work begins.

---

### Pitfall 2: outputSchema Validation Blocks isError Responses in SDK 1.x

**What goes wrong:**
In SDK versions that support `outputSchema`, the server-side SDK validates the response's `structuredContent` against the declared `outputSchema` before the response reaches the client. If a tool declares `outputSchema` and the handler returns `{ isError: true, content: [...] }` (an error response), the SDK throws a schema validation error rather than forwarding the error to the client. The tool appears to have crashed rather than returning a user-readable error.

**Why it happens:**
SDK issue #654 confirmed this behavior: the server-side validation runs before checking `isError`, so error responses with `null` or missing `structuredContent` fail validation. The client-side SDK correctly checks `isError` first, creating an asymmetry. This was fixed in SDK PR #655, but the fix may not be in all 1.x patch versions.

**How to avoid:**
After upgrading to SDK 1.x, verify the exact version includes the #655 fix. When declaring `outputSchema`, always return a structuredContent payload shaped to match the schema even for partial results. For error paths, the safest approach is: (a) return `isError: true` with a valid-schema `structuredContent` that includes an error description field, or (b) do not declare `outputSchema` until confirmed the target SDK version has the fix and Claude Code honors `isError` over schema validation.

**Warning signs:**
- Integration test calls a tool that has `outputSchema`, simulates a failure condition, and the test sees an SDK-level error instead of an `isError: true` response
- Tools that work in the happy path silently fail to report errors after `outputSchema` is added

**Phase to address:**
Wave 1 (MCP modernization) — write at least one integration test per tool that exercises the error path after adding `outputSchema`, not just the success path.

---

### Pitfall 3: Rate Limiter Instantiated Per-Call Resets Window on Every Request

**What goes wrong:**
The current `handleToolCall` in `src/tools/index.ts` line 129 instantiates `new RateLimitManager(config.rate_limiting)` on every call. Because `RateLimiterMemory` initializes its state in the constructor, each instantiation creates a fresh in-memory counter. The effect is that rate limiting is completely non-functional — every call begins with zero usage count and every call passes.

**Why it happens:**
The class was built with constructor-injection for the config, which is a clean pattern, but the call-site instantiation means the state-holding object is garbage collected between calls. The config object is available every call via `handleToolCall(config, ...)` so it felt natural to construct the limiter there — but this silently neutralizes the feature.

**How to avoid:**
Instantiate `RateLimitManager` once at module level or in `main()` and pass the instance (or a factory) to `handleToolCall`. The idiomatic Node.js/ESM pattern is to export a module-level singleton: `export const rateLimiter = new RateLimitManager(loadConfig().rate_limiting)`. But since config is async, the cleaner approach for this codebase is to construct the `RateLimitManager` in `main()` after config loads and pass it into the registry or as a closure. Rate limiting must be a process-scope singleton — there is exactly one client per stdio process.

**Warning signs:**
- Rate limiter unit test passes but rate limiting never triggers in integration
- Adding verbose logging inside `checkRateLimit()` shows counter always starts at `0/60` regardless of request volume
- `get_vault_stats` called 200 times/minute with no 429 response

**Phase to address:**
Wave 1 (bug fixes) — F-CRIT-01. This is the first fix to land because it unblocks correct rate limit behavior for all subsequent testing.

---

### Pitfall 4: sendToolListChanged Fires Before enable_tool Response Reaches Client (Race)

**What goes wrong:**
If `sendToolListChanged()` is awaited synchronously inside the `enable_tool` handler's return path (before the `CallToolResult` is sent on the wire), the client can receive the `notifications/tools/list_changed` notification, call `ListTools`, and start calling newly-enabled tools — all before it receives the `enable_tool` result. Clients that aggressively act on `list_changed` (Claude Code does re-list tools on this notification) may call a newly-enabled tool while `enable_tool` is technically still in-flight from the JSON-RPC perspective.

**Why it happens:**
`sendToolListChanged()` uses the same underlying JSON-RPC transport as responses. On a stdio transport, both the response and the notification go to stdout in sequence. If the notification is written before the response (because the handler awaits the notification call before returning), the notification arrives first. The MCP spec defines notifications as one-way — the client is not required to wait for a response to complete before processing a notification.

**How to avoid:**
The ARCHITECTURE.md research already documents the correct pattern: fire the notification callback without awaiting it from inside the handler, and do not block the response on it. The pattern is:
```typescript
handler: async (config, args) => {
  const result = await handleEnableTool(registry, args);
  options.onToolListChanged?.().catch(err => logger.warn({ err }, 'list_changed failed'));
  return result;  // response and notification go out concurrently, response first
}
```
Do not use `await options.onToolListChanged?.()` before `return result`.

**Warning signs:**
- Integration test: call `enable_tool`, immediately call the newly-enabled tool — it sometimes returns "Tool not enabled" error (timing-dependent flakiness)
- Adding `await` before `sendToolListChanged()` then seeing test failures that pass when you remove the `await`

**Phase to address:**
Wave 3 (lazy loading) — wire the `onToolListChanged` callback in `index.ts` using the non-blocking pattern from the start. Do not add an `await` and "fix it later."

---

### Pitfall 5: Windows Native Platform Detection: `which` Does Not Exist

**What goes wrong:**
`process-spawner.ts`'s `commandExists()` function calls `execa('command', ['-v', command], { shell: true })` and `findObsidianExecutable()` calls `execa('which', [candidate])`. The `command` built-in and `which` are Unix/POSIX shell utilities. On `process.platform === 'win32'` (native Windows, not WSL), neither `command -v` nor `which` exists in cmd.exe or PowerShell. These calls throw `ENOENT` or a shell error, which the `catch` block silently swallows — every candidate returns false, `findObsidianExecutable()` returns `null`, and `openInObsidian()` throws "Obsidian executable not found."

**Why it happens:**
The code handles WSL correctly with `isWSL` branching, but does not branch for `process.platform === 'win32'`. The is-wsl package reports `isWSL = false` on native Windows, so the WSL path is skipped, and the code falls through to the native-app path which still uses Unix path-testing commands.

**How to avoid:**
For native Windows (`process.platform === 'win32'`), use Node.js `fs.access()` (or `fs.stat()`) to test candidate paths instead of shelling out to `which`. This is also faster and more reliable than spawning a shell process. The fixed pattern:
```typescript
import { access } from 'fs/promises';

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; }
  catch { return false; }
}
```
Then replace `commandExists()` and the `which`-based lookup with `pathExists(candidate)` for all platforms. The candidates list already has Windows-specific absolute paths (`C:\Program Files\Obsidian\Obsidian.exe`) — they just need to be tested with `fs.access` not `which`.

Additionally, the URI fallback path (`openURI()`) already handles `process.platform === 'win32'` correctly via `rundll32.exe url.dll,FileProtocolHandler`. Use this fallback more aggressively: if `findObsidianExecutable()` returns null on Windows, fall through to URI-based open rather than throwing.

**Warning signs:**
- `open_in_obsidian` on native Windows always returns "Obsidian executable not found" even when Obsidian is installed
- Test on Windows: `execa('which', ['anything'])` throws `ENOENT`
- The `isWSL` guard handles the WSL case but native Windows is left unguarded

**Phase to address:**
Wave 1 (bug fixes) — F-CRIT-02. Test on Windows native after fixing, not just WSL.

---

### Pitfall 6: gray-matter Silently Converts Date Strings to JavaScript Date Objects on Parse

**What goes wrong:**
gray-matter uses js-yaml as its YAML engine. By default, js-yaml auto-converts unquoted YAML date-format strings (`date: 2024-01-15`) into JavaScript `Date` objects during `matter(content)` parsing. When `stringifyMarkdown()` then calls `matter.stringify(content, frontmatter)`, the js-yaml serializer serializes a `Date` object back as an ISO 8601 timestamp (`2024-01-15T00:00:00.000Z`), not the original `2024-01-15`. This corrupts daily note frontmatter (the `date:` field), `archive_note` date stamps, and any frontmatter with date-formatted values.

**Why it happens:**
js-yaml's default schema (DEFAULT_FULL_SCHEMA) includes the `!!timestamp` type which auto-casts YAML scalars matching ISO 8601 date patterns. This is consistent YAML spec behavior but surprising when you expect round-trip fidelity for plain date strings. The existing code in `handlers2.ts`'s `handleGetDailyNote` writes `date: date.format('YYYY-MM-DD')` as a string — but when that note is later read and re-written (e.g., via `update_frontmatter`), the date passes through `matter()` and becomes a `Date` object silently.

**How to avoid:**
Configure gray-matter to use `js-yaml`'s `JSON_SCHEMA` (or `FAILSAFE_SCHEMA`) instead of the default schema to disable timestamp auto-casting. Pass options at the `matter()` call sites:
```typescript
matter(content, { engines: { yaml: { parse: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) } } })
```
Alternatively, quote date strings on write (`'"2024-01-15"'`) to prevent yaml from treating them as timestamps. The quoting approach is fragile across all write paths — configure the schema once at the parser level.

**Warning signs:**
- `update_frontmatter` on a daily note: `date` field changes from `2024-01-15` to `2024-01-15T00:00:00.000Z`
- Round-trip test: `matter.stringify(matter('---\ndate: 2024-01-15\n---\n').data, ...)` produces ISO timestamp
- `get_daily_note` followed by `read_note` shows different `date` format in frontmatter

**Phase to address:**
Wave 1 (bug fixes) — F-MED-01 (frontmatter serialization fix). Configure the yaml engine at the `matter()` parse call in `markdown-parser.ts` as part of the `matter.stringify` migration, not as a separate fix.

---

### Pitfall 7: matter.stringify Adds a Trailing Newline, Creating Drift on Round-Trips

**What goes wrong:**
gray-matter issue #96 confirmed: `matter.stringify()` unconditionally appends a trailing newline to the output if one does not already exist. When a note that originally had no trailing newline is read, modified, and written back via `writeNote()` → `stringifyMarkdown()` → `matter.stringify()`, the file gains a trailing newline. Repeated round-trips do not keep adding newlines (the check prevents doubling), but the first write after adoption of `matter.stringify` will change files that had no trailing newline. This surfaces as unexpected Git diffs on unrelated files and confuses Obsidian sync systems that checksum file content.

**Why it happens:**
The behavior is intentional in gray-matter — it normalizes line endings. But for an MCP server that only *modifies* specific fields and should leave the rest of the file bit-for-bit identical, this is surprising behavior.

**How to avoid:**
Accept the trailing newline normalization as a one-time migration cost — it is harmless after the first write. Document in code comments that `matter.stringify` adds trailing newlines by design. Do not fight it with string trimming, as that would re-introduce the two-path inconsistency the migration is trying to eliminate. Communicate in test setup: integration tests that compare file content byte-for-byte should allow for trailing newline differences.

**Warning signs:**
- After migrating `create_note` to `matter.stringify`, integration tests that read back the raw file content fail because they check for exact string equality
- Git shows `+\n` diffs on note files that were only opened-and-closed without content changes

**Phase to address:**
Wave 1 (bug fixes) — F-MED-01. Update integration tests to use `.trimEnd()` on both sides of content comparisons rather than exact equality.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `content[]` only (skip structuredContent) | Zero migration risk, all clients work | Clients that support 2025-11-25 spec can't use typed output | Acceptable during transition; must add structuredContent eventually |
| Skip SDK upgrade, simulate outputSchema manually | No breaking changes | SDK types won't match; TypeScript will require casting; no validation from SDK | Never — upgrade SDK first |
| Instantiate registry per-call instead of singleton | Simpler code, no lifetime management | Rate limiting breaks; registry state (enabled tools) resets per call | Never — process-level singleton is correct for stdio MCP |
| Use `command -v` for Windows path detection | Works on all Unix | Fails silently on native Windows, no observable error | Never — use `fs.access` universally |
| Leave gray-matter date parsing as-is | No change required | Date fields silently mutate on first re-write; data corruption | Never — configure yaml schema on adoption of matter.stringify |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MCP SDK 0.6.1 → 1.x upgrade | Assume `^0.6.0` → `^1.0.0` is a drop-in bump | Treat as a major version break; audit Server constructor, ToolSchema shape, and CallToolResult shape separately |
| `sendToolListChanged()` + `enable_tool` response | `await sendToolListChanged()` before returning the tool result | Fire notification without await; both the response and notification write to stdout concurrently |
| `outputSchema` declared on tool + `isError: true` response | Error paths return `isError: true` with no `structuredContent` | Verify SDK version includes #655 fix; always return schema-valid `structuredContent` even for errors, or omit `outputSchema` until verified |
| gray-matter on daily notes with `date:` field | Assume `matter().data.date` is a string | It is a `Date` object; configure js-yaml JSON_SCHEMA or normalize on read |
| `execa` on Windows native | Use `which` or `command -v` for path testing | Use `fs.access()` — works on all platforms without shell subprocess |
| `notifications/tools/list_changed` + client support | Assume all clients refresh tools on notification | Claude Code handles it correctly; other clients (LibreChat, Vercel AI SDK as of late 2025) may not. Design so `enable_tool` response is self-sufficient (include schema in response body) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `get_vault_stats` and `get_backlinks` read every note to build the result | Correct results but slow; 5s+ response on vaults with 500+ notes | Already documented in CONCERNS.md; acceptable for Milestone 2 | Vaults with 1000+ notes |
| `get_link_graph` builds full adjacency list in-memory on every call | High memory and CPU on large vaults | Cache the graph with TTL; invalidate on vault watcher events | Vaults with 5000+ notes |
| Registry `getEnabledDefinitions()` iterates the full Map + filters | Negligible for < 50 tools | Acceptable — no optimization needed | Never at current tool count |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `enable_tool` callable by any tool call without auth | Any MCP client can enable any tool in the registry | Acceptable for single-user stdio server — document that this is not a multi-user system |
| `discover_tools` leaks internal tool names even when disabled | Agent discovers what tools exist before enabling them | Intentional by design; not a security concern for local vault access |
| Rate limiter per-call instantiation (F-CRIT-01) | No effective rate limiting = denial of service via rapid fire | Fix with module-level singleton as described in Pitfall 3 |

---

## "Looks Done But Isn't" Checklist

- [ ] **MCP spec modernization (F-HIGH-01):** After adding `outputSchema` to tool definitions, verify the error path also returns a valid `structuredContent` — not just the happy path
- [ ] **Rate limiter fix (F-CRIT-01):** After making it a singleton, write an integration test that makes 2x the allowed requests and asserts the 2nd batch gets rate-limited — "it compiles" is not sufficient
- [ ] **Cross-platform exec (F-CRIT-02):** After fixing Windows path detection, test on an actual `process.platform === 'win32'` environment (or mock it with `Object.defineProperty(process, 'platform', ...)`) — WSL tests do not cover native Windows
- [ ] **Lazy loading notifications:** After wiring `sendToolListChanged()`, verify the notification is received by the client by inspecting the JSON-RPC stream — the SDK method call succeeds even if no client is connected
- [ ] **gray-matter date round-trip:** After migrating to `matter.stringify`, run a round-trip test: write a note with `date: 2024-01-15` via `create_note`, then `read_note`, then `update_frontmatter` with an unrelated field, then `read_note` again — the `date` value must remain `2024-01-15` not an ISO timestamp
- [ ] **SDK upgrade:** After upgrading from 0.6.1 to 1.x, run `tsc --noEmit` to zero errors before writing any new feature code — the upgrade itself may introduce type errors in existing handlers

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SDK 0.6.1 → 1.x breaks existing code | MEDIUM | Upgrade in its own PR; use TypeScript errors as the guide; test all 13 existing tools end-to-end before starting spec modernization |
| outputSchema causes error responses to fail | LOW | Remove `outputSchema` declarations from the affected tools; verify SDK version; re-add after confirming the fix |
| Rate limiter discovered non-functional in production | LOW | Move instantiation to module level; no data to migrate; new singleton starts fresh (acceptable — rate limit state is ephemeral) |
| gray-matter date corruption discovered after deployment | HIGH | Must read all affected notes, detect Date objects vs strings in frontmatter, re-write using the correct yaml schema; vault-wide migration |
| Windows exec fails silently for all users | MEDIUM | Replace `which`/`command -v` with `fs.access`; already has URI fallback path that works — users are degraded to URI not broken |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SDK 0.6.1 has no outputSchema/structuredContent/annotations | Wave 1 — upgrade SDK first, before any spec work | `tsc --noEmit` passes after upgrade with no type errors |
| outputSchema blocks isError responses | Wave 1 — add error-path integration test per tool | Integration test: tool with outputSchema returns meaningful error on bad input |
| Rate limiter per-call reset | Wave 1 — F-CRIT-01 fix | Integration test: 61 requests to a write tool in 60s; assert request 61 returns rate limit error |
| sendToolListChanged race with enable_tool response | Wave 3 — lazy loading implementation | Integration test: call enable_tool, immediately call the enabled tool in a tight loop; assert zero "Tool not enabled" errors |
| Windows native path detection failure | Wave 1 — F-CRIT-02 fix | Platform-mocked test: `process.platform = 'win32'`, `isWSL = false`; assert `findObsidianExecutable` uses `fs.access` not `which` |
| gray-matter date string → Date object corruption | Wave 1 — F-MED-01 (matter.stringify migration) | Round-trip test: write daily note, read, update unrelated frontmatter field, read again; assert date field is string not ISO timestamp |
| matter.stringify trailing newline drift | Wave 1 — F-MED-01 | Update integration test assertions to use `.trimEnd()` comparison |
| listChanged notification not received by all clients | Wave 3 — lazy loading | Test against Claude Code specifically; design enable_tool to include schema in response body so client does not depend on list_changed to get schema |

---

## Sources

- `node_modules/@modelcontextprotocol/sdk@0.6.1/dist/types.js` — Direct inspection of `ToolSchema.shape` and `CallToolResultSchema.shape` (HIGH confidence, direct source)
- `node_modules/@modelcontextprotocol/sdk@0.6.1/dist/server/index.js` — `sendToolListChanged()` implementation (HIGH confidence, direct source — see ARCHITECTURE.md)
- [MCP 2025-11-25 Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — Exact requirements for `outputSchema`, `structuredContent`, backward compat (HIGH confidence, official spec)
- [SDK Issue #654: structuredContent validation blocks isError](https://github.com/modelcontextprotocol/typescript-sdk/issues/654) — outputSchema/isError race condition (HIGH confidence, official issue tracker)
- [gray-matter Issue #62: Disable date parsing](https://github.com/jonschlinkert/gray-matter/issues/62) — Date auto-cast to JS Date objects (HIGH confidence, official issue tracker)
- [gray-matter Issue #96: Newline logic in stringify](https://github.com/jonschlinkert/gray-matter/issues/96) — Trailing newline behavior in stringify (HIGH confidence, official issue tracker)
- [MCP Discussion #76: Using notifications/tools/list_changed](https://github.com/orgs/modelcontextprotocol/discussions/76) — Client support status for list_changed (MEDIUM confidence, community discussion)
- [Notes on outputSchema in MCP Servers](https://zenn.dev/7shi/articles/20250710-output-schema?locale=en) — Client inconsistency with structuredContent (MEDIUM confidence, community article with verified examples)
- `src/tools/index.ts` — Direct observation of per-call RateLimitManager instantiation (HIGH confidence, direct read)
- `src/platform/process-spawner.ts` — Direct observation of `which`/`command -v` usage without Windows guard (HIGH confidence, direct read)
- `src/tools/handlers.ts` lines 141-141 — Direct observation of manual frontmatter interpolation (HIGH confidence, direct read)

---

*Pitfalls research for: Obsidian MCP Server — Milestone 2 Tool Expansion and Spec Modernization*
*Researched: 2026-02-26*
