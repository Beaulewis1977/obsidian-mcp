# Review Findings and Fix Decisions

This document tracks all review findings, the agreed fix for each item, and verification status.

## How to use this log

1. Review findings in priority order (Critical -> High -> Medium).
2. For each finding, confirm the fix decision.
3. Implement the agreed change.
4. Mark verification results before closing the item.

Status values:
- `open`: not addressed yet
- `decided`: fix approach approved
- `implemented`: code/doc changes made
- `verified`: tests/manual validation passed
- `closed`: complete

---

## Finding Inventory

| ID | Severity | Title | Status | Decision |
|---|---|---|---|---|
| F-CRIT-01 | Critical | Rate limiting resets per tool call (non-persistent in memory backend) | decided | Use a process-scoped shared `RateLimitManager` |
| F-CRIT-02 | Critical | `open_in_obsidian` reliability issue on native Windows | decided | Use cross-platform executable detection for Windows/Linux + URI fallback |
| F-HIGH-01 | High | Missing MCP 2025 modernization (`outputSchema`, annotations, structured outputs) | decided | Additive migration: add `outputSchema` + annotations + `structuredContent` while keeping text content temporarily |
| F-HIGH-02 | High | Lazy loading/discovery architecture not implemented | decided | Defer implementation until new feature planning is complete, then deliver phased rollout |
| F-HIGH-03 | High | Docs and runtime behavior drift | open | pending |
| F-MED-01 | Medium | `create_note` API path frontmatter interpolation risk | open | pending |
| F-MED-02 | Medium | `get_daily_note` response shape inconsistency | open | pending |
| F-MED-03 | Medium | Uneven test coverage for `handlers2.ts` paths | open | pending |
| F-MED-04 | Medium | Spec ambiguities (tool contracts/config semantics) | open | pending |

---

## F-CRIT-01 - Rate limiting resets per tool call

### Summary
A new `RateLimitManager` instance is created inside `handleToolCall` for every request. With the in-memory backend, this resets counters per call and prevents effective cross-request throttling.

### Evidence
- Manager creation occurs inside request path:
  - `src/tools/index.ts` (`handleToolCall`): rate limiter instantiated in function scope.
- Tool classifications and intended policy exist, but persistence depends on manager lifecycle:
  - `src/utils/rate-limiter.ts` (classification and enforcement model).

### Root cause
Rate limiter lifecycle is request-scoped instead of process-scoped.

### Recommended fix (proposed)
Use a single shared `RateLimitManager` instance for server lifetime.

Implementation approach:
1. Initialize `RateLimitManager` once (module-level singleton or startup-injected dependency).
2. Reuse that instance in every `handleToolCall` invocation.
3. Keep existing key composition (`vaultName:toolName`) and operation/tool-level checks unchanged.
4. Add/adjust tests to assert limits are enforced across sequential calls.

### Suggested implementation notes
- Preferred location for initialization:
  - Either at module load in `src/tools/index.ts`, or
  - In `src/index.ts` during bootstrap and pass down (dependency injection).
- If config can vary by runtime reload, expose a controlled re-init path rather than per-call construction.

### Verification checklist
- [ ] Configure a very low limit (for example, 2 calls/minute) for a test tool.
- [ ] Call same tool 3+ times within window.
- [ ] Confirm call 3 is rate-limited.
- [ ] Confirm behavior is stable across multiple tool types.
- [ ] Run full quality gates (`npm run lint`, `npm run test`, `npm run build`).

### Decision log
- Decision: **approved** - Use a process-scoped shared `RateLimitManager`.
- Owner: User
- Target release: next patch
- Notes: In-memory backend is acceptable for current single-user/single-process use. If scaling to multi-user across multiple server instances, migrate to Redis backend for shared counters.

---

### F-CRIT-02 - `open_in_obsidian` reliability on native Windows

### Summary
Executable detection uses Unix command lookup for absolute Windows executable paths. On native Windows this can fail to detect a valid Obsidian install and cause `open_in_obsidian` app-launch mode to fail with "Obsidian executable not found".

### Evidence
- Executable candidates include absolute Windows paths:
  - `src/platform/process-spawner.ts` (`findObsidianExecutable`) candidate list contains `C:\Program Files\...\Obsidian.exe`.
- Non-WSL candidate verification uses `which` against those absolute paths:
  - `src/platform/process-spawner.ts`: `execa('which', [candidate])` in non-WSL branch.

### Root cause
Path existence and command discovery are mixed together. Absolute filesystem paths should be validated via filesystem checks, not shell PATH lookup commands.

### Recommended fix (proposed)
Use platform-appropriate executable discovery:

1. For absolute path candidates, check file existence directly (`fs.access` / `existsSync`).
2. Reserve command discovery (`where`/`which`/`command -v`) for bare command names only.
3. Add common per-user Windows install location (`%LOCALAPPDATA%\\Programs\\Obsidian\\Obsidian.exe`) to candidate list.
4. Add Linux discovery coverage (absolute candidates like `/usr/bin/obsidian`, `/usr/local/bin/obsidian`, `/snap/bin/obsidian`, plus bare `obsidian` command lookup).
5. Keep current WSL launch logic intact.
6. Add resilience: for vault-only open mode, use URI fallback (`obsidian://open?vault=...`) if native spawn fails.

### Verification checklist
- [ ] Native Windows: `open_in_obsidian` with vault only succeeds.
- [ ] Native Windows: `open_in_obsidian` with note path succeeds.
- [ ] WSL behavior remains unchanged.
- [ ] If app spawn fails, fallback path (if implemented) works and returns clear metadata.
- [ ] Run full quality gates (`npm run lint`, `npm run test`, `npm run build`).

### Decision log
- Decision: **approved** - Implement cross-platform executable detection for Windows and Linux, with URI fallback for vault-open failures.
- Owner: User
- Target release: next patch
- Notes: Prioritize reliable native behavior on Windows today while keeping Linux-compatible discovery for future users.

---

## Next findings (to fill as we review)

### F-HIGH-01 - MCP 2025 modernization gaps

### Summary
The current tool contract is still first-generation (`name`, `description`, `inputSchema`) and response payloads are mostly JSON encoded into text. This does not meet the MCP 2025-11-25 modernization target documented in the expansion spec (`outputSchema`, `annotations`, and schema-aligned `structuredContent`).

### Evidence
- Current tool definition model has no `outputSchema` or `annotations` fields:
  - `src/tools/index.ts` (`ToolDefinition` includes only `name`, `description`, `inputSchema`).
- Existing tool registrations provide only `inputSchema`:
  - `src/tools/index.ts` (`getToolDefinitions()` entries).
- Typical handler responses serialize result objects into text content instead of structured content:
  - `src/tools/handlers.ts` (`read_note` response uses `text: JSON.stringify(note, null, 2)`).
- Standardized errors are also text-serialized JSON:
  - `src/utils/errors.ts` (`createErrorResponse`).
- Spec requires modernization for all tools:
  - `docs/TOOL_EXPANSION_SPEC.md` section "Tool Annotations & outputSchema Modernization".

### Root cause
The current implementation was built around text-first MCP responses and does not yet have typed output contracts or per-tool annotation metadata in the registry.

### Recommended fix (proposed)
Adopt a staged, additive migration:

1. Extend tool metadata with `outputSchema` and `annotations` for all existing tools.
2. Introduce typed result models per tool and return `structuredContent` that matches each `outputSchema`.
3. Keep `content` text during transition for compatibility with older clients.
4. Add response-shape tests that validate `structuredContent` against expected schemas.
5. After compatibility window, decide whether to trim duplicated text payloads.

### Verification checklist
- [ ] Every tool exposes `outputSchema` and `annotations` in `ListTools`.
- [ ] Success responses include schema-conformant `structuredContent`.
- [ ] Error responses follow a consistent structured error shape.
- [ ] Existing clients continue working during additive migration.
- [ ] Run full quality gates (`npm run lint`, `npm run test`, `npm run build`).

### Decision log
- Decision: **approved** - Use additive migration (`outputSchema` + annotations + `structuredContent`) while keeping text `content` during transition.
- Owner: User
- Target release: next patch series
- Notes: Favor low-risk rollout and backward compatibility first; remove duplicated text payload later if no client breakage.

---

### F-HIGH-02 - Lazy loading/discovery not implemented

### Summary
The server currently exposes all tools at connect time and uses a static dispatcher. The progressive disclosure design in the spec (`discover_tools`, `enable_tool`, dynamic enablement, `list_changed`) is not implemented yet.

### Evidence
- `ListTools` always returns full tool array from `getToolDefinitions()`:
  - `src/index.ts` (`server.setRequestHandler(ListToolsRequestSchema, ...)`).
- `getToolDefinitions()` currently returns all existing tools unconditionally:
  - `src/tools/index.ts` (`getToolDefinitions` static array).
- Tool execution is static switch dispatch with fixed cases only:
  - `src/tools/index.ts` (`switch (toolName)` in `handleToolCall`).
- No meta-tools (`discover_tools`, `enable_tool`) in current registry.
- Spec expects session-scoped dynamic enablement and `notifications/tools/list_changed`:
  - `docs/TOOL_EXPANSION_SPEC.md` section "Progressive Disclosure / Lazy Loading".

### Root cause
The current architecture is static-first (compile-time tool inventory and switch-based dispatch), while lazy loading requires runtime tool registry state and session-aware enablement.

### Recommended fix (proposed)
Implement lazy loading in phases to reduce risk:

1. Introduce a central registry model (`allTools` map + `enabledTools` set per session).
2. Add meta-tools (`discover_tools`, `enable_tool`) as always-enabled tools.
3. Update `ListTools` to return only enabled tools.
4. Replace static switch dispatch with registry-based dispatch.
5. Emit `notifications/tools/list_changed` after enable operations.
6. Add config gate `lazy_loading` for backward compatibility (`false` => current behavior).

### Verification checklist
- [ ] Fresh session with `lazy_loading=true` returns only meta-tools initially.
- [ ] `discover_tools` returns lightweight discoverability info (no full schemas).
- [ ] `enable_tool` makes selected tool available via `ListTools` in-session.
- [ ] `list_changed` notification is emitted on enable events.
- [ ] `lazy_loading=false` preserves full upfront tool list behavior.
- [ ] Run full quality gates (`npm run lint`, `npm run test`, `npm run build`).

### Decision log
- Decision: **approved** - Defer lazy loading implementation until new feature planning is complete.
- Owner: User
- Target release: post-feature-planning phase
- Notes: Keep current full-tool loading behavior for now. Implement phased lazy-loading rollout after planned feature set is finalized.

---

### F-HIGH-03 - Docs/runtime drift

### Summary
Several docs describe behavior that does not exactly match current runtime behavior. This increases onboarding friction, causes incorrect expectations for tool defaults, and makes future migration planning harder.

### Evidence
- `search_notes` default mode mismatch:
  - `docs/API_REFERENCE.md` says default mode is `"obsidian"`.
  - `src/tools/schemas.ts` sets default mode to `"filesystem"`.
- Architecture statement says all writes are API-first:
  - `docs/ARCHITECTURE.md` principle 1 states API-first writes.
  - `src/tools/handlers2.ts` shows write operations that are filesystem-only (`move_note`, `update_frontmatter`).

### Root cause
Documentation is manually maintained and not continuously validated against schema defaults and handler behavior.

### Recommended fix (proposed)
1. Define source of truth: tool schemas + handler behavior in code.
2. Immediately align docs for known drift points (search mode default, write-path exceptions).
3. Add a lightweight docs-consistency check in CI for schema defaults and documented defaults.
4. Add explicit "implementation caveats" blocks in docs where behavior intentionally differs by tool.

### Best-practice notes
- Prefer generated/templated API docs from Zod schemas where possible.
- Treat architecture principles as "default behavior with exceptions," then list exceptions explicitly.
- Add a release checklist item: "Docs checked for behavior drift" before merges.

### Verification checklist
- [ ] API reference defaults match `src/tools/schemas.ts` defaults.
- [ ] Architecture write-path claims match actual handler behavior.
- [ ] Drift check (or scripted spot check) runs in CI.
- [ ] Run full quality gates (`npm run lint`, `npm run test`, `npm run build`).

### Decision log
- Decision: **pending**
- Owner: _TBD_
- Target release: _TBD_
- Notes: Recommend addressing this in same patch window as F-HIGH-01 migration to avoid double doc churn.

---

### F-MED-01 - `create_note` frontmatter interpolation risk

### Summary
`create_note` API-first path builds YAML frontmatter via manual string interpolation. This can produce invalid or non-idiomatic YAML for complex values and creates inconsistent formatting between API and filesystem code paths.

### Evidence
- Manual frontmatter construction in API path:
  - `src/tools/handlers.ts` builds `fullContent` using template strings and `JSON.stringify` per value.
- A dedicated markdown serializer already exists and uses `gray-matter`:
  - `src/filesystem/markdown-parser.ts` uses `matter.stringify` for frontmatter serialization.

### Root cause
Two serialization paths exist: one robust (`matter.stringify`) and one ad hoc (manual YAML string assembly).

### Recommended fix (proposed)
1. Replace manual frontmatter string interpolation with shared serializer usage (`matter.stringify` via utility).
2. Keep create behavior consistent between API and filesystem paths.
3. Add regression tests for arrays, nested objects, booleans, nulls, and multiline strings.

### Best-practice notes
- Never hand-roll YAML formatting when a parser/serializer is already in use.
- Use one canonical serialization utility across all write paths.
- Add fixture-based round-trip tests for frontmatter edge cases.

### Verification checklist
- [ ] API create path correctly serializes complex frontmatter values.
- [ ] Filesystem and API path output are semantically equivalent.
- [ ] Existing create-note tests still pass.
- [ ] Run full quality gates (`npm run lint`, `npm run test`, `npm run build`).

### Decision log
- Decision: **pending**
- Owner: _TBD_
- Target release: _TBD_
- Notes: Good candidate for a low-risk, early patch.

---

### F-MED-02 - `get_daily_note` response shape inconsistency

### Summary
`get_daily_note` returns different key names for the same concept depending on branch (`notePath` when found vs `path` when created). This complicates client parsing and conflicts with schema-first design goals.

### Evidence
- Existing-note branch returns `notePath`.
- Create-if-missing branch returns `path`.
- Both represent the note path for the same tool contract.

### Root cause
Branch-specific payload objects were added incrementally without a single normalized output contract.

### Recommended fix (proposed)
1. Normalize on one field name (recommend `path`).
2. Add a dedicated output schema for `get_daily_note` and enforce it in both branches.
3. Preserve backward compatibility temporarily by including deprecated alias if needed.

### Best-practice notes
- One tool should have one stable output contract across all execution branches.
- Use contract tests to validate response keys, not only value presence.
- Deprecate old keys with a documented removal timeline.

### Verification checklist
- [ ] Existing note branch returns normalized shape.
- [ ] Create branch returns identical key set (except value differences).
- [ ] Any temporary alias field behavior is documented.
- [ ] Run full quality gates (`npm run lint`, `npm run test`, `npm run build`).

### Decision log
- Decision: **pending**
- Owner: _TBD_
- Target release: _TBD_
- Notes: Align this with F-HIGH-01 output-schema rollout.

---

### F-MED-03 - Uneven `handlers2.ts` test coverage

### Summary
Current integration testing is concentrated on handlers from `handlers.ts`. The second handler module (`handlers2.ts`) contains multiple production tools with little/no dedicated integration coverage.

### Evidence
- Only one tools integration test file exists:
  - `src/tools/__tests__/handlers.integration.test.ts`
- That suite imports handlers from `../handlers.js` only.
- No dedicated `handlers2` integration test file is present under `src/tools/__tests__`.

### Root cause
Test suite evolved around initial core tools; later tools were added without proportional integration test expansion.

### Recommended fix (proposed)
1. Add a new integration test suite focused on `handlers2.ts` tools.
2. Cover happy path + key error/fallback paths for each tool:
   - `move_note`, `update_frontmatter`, `get_daily_note`, `open_in_obsidian`, `get_backlinks`, `create_folder`, `get_vault_stats`.
3. Mock platform/API boundaries explicitly for deterministic tests.
4. Add response-shape assertions to support F-HIGH-01 migration.

### Best-practice notes
- Maintain test parity: each exported handler should have at least one success + one failure test.
- Keep integration tests deterministic by isolating filesystem/platform side effects with mocks.
- Add coverage thresholds for tool modules to prevent future drift.

### Verification checklist
- [ ] New `handlers2` integration suite exists and runs in CI.
- [ ] All `handlers2` tool paths have baseline success/failure coverage.
- [ ] Response-shape assertions included for modernization readiness.
- [ ] Run full quality gates (`npm run lint`, `npm run test`, `npm run build`).

### Decision log
- Decision: **pending**
- Owner: _TBD_
- Target release: _TBD_
- Notes: Recommend completing this before broad tool expansion to reduce regression risk.

---

### F-MED-04 - Spec ambiguities

### Summary
Some sections in `TOOL_EXPANSION_SPEC.md` are directionally good but underspecified for implementation, which can cause inconsistent behavior across contributors.

### Evidence
- `enable_tool` input allows `tool_name` and/or `category` but does not strictly define exclusivity/requiredness.
- `get_link_graph` includes `max_depth` wording that implies traversal from a start node, but no start-node input is defined.
- Spec introduces config keys (`lazy_loading`, `always_loaded_tools`) not yet represented in `ServerConfig` typing.

### Root cause
Spec is roadmap-oriented and needs stricter contract definitions before implementation.

### Recommended fix (proposed)
1. Formalize ambiguous tool inputs using strict schema patterns (e.g., discriminated union / xor).
2. Clarify graph modes:
   - full graph mode (no traversal root), and
   - traversal mode (requires `start_note` + `max_depth`).
3. Extend `ServerConfig` type and validation to include new lazy-loading config keys with defaults.
4. Add one canonical example request/response per ambiguous tool path.

### Best-practice notes
- Treat spec docs as executable contracts: each schema must be machine-validated.
- Avoid comments that imply behavior not represented in schema fields.
- Keep a short "Decision Record" section in spec when semantics change.

### Verification checklist
- [ ] `enable_tool` input contract is unambiguous and schema-enforced.
- [ ] `get_link_graph` mode semantics are explicit and testable.
- [ ] Config typing and runtime validation include all documented keys.
- [ ] Spec examples pass validation against implemented schemas.

### Decision log
- Decision: **pending**
- Owner: _TBD_
- Target release: _TBD_
- Notes: Should be resolved before implementing any new high-priority tools from the spec.
