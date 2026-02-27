# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Untyped AST Traversal in Markdown Parser:**
- Issue: `extractLinks()` function in `src/filesystem/markdown-parser.ts` uses `any` type for AST node traversal instead of proper AST types from the unified/remark ecosystem
- Files: `src/filesystem/markdown-parser.ts` (lines 41-44, 74)
- Impact: Loss of type safety when parsing markdown AST. Potential for runtime errors if plugin output changes structure or if malformed nodes are encountered
- Fix approach: Import proper AST types from remark/unified (e.g., `Node`, `Parent` from `unist`). Create typed interfaces for `wikiLink` and other custom node types

**Overly Permissive Any Types in Core Files:**
- Issue: `src/index.ts` line 97 uses `any[]` for vaultWatchers and line 74 catches errors as `any`. `src/tools/index.ts` uses `any` for inputSchema (line 44) and args (line 126)
- Files: `src/index.ts`, `src/tools/index.ts`
- Impact: Loss of type safety in tool handling and error processing. Makes it harder to understand what tool arguments are expected
- Fix approach: Create proper types for VaultWatcher array (use actual Chokidar watcher type). Type tool args based on their schemas. Use specific error types instead of `any`

**Console.log Statements Left in Tests:**
- Issue: `src/utils/__tests__/validators.test.ts` contains 6 console.log() debug statements (lines with explicit logging)
- Files: `src/utils/__tests__/validators.test.ts`
- Impact: Debug output pollutes test runs and might confuse CI logs
- Fix approach: Remove all console.log statements from tests. Use vitest debug utilities if logging is needed for test development

**Missing Rate Limiter Redis Client Implementation:**
- Issue: `src/utils/rate-limiter.ts` line 67 calls `this.createRedisClient()` but method is not shown in partial file read
- Files: `src/utils/rate-limiter.ts`
- Impact: Redis backend configuration appears to be incomplete - unclear if Redis client factory actually exists
- Fix approach: Verify Redis client initialization is properly implemented with connection pooling and error handling

## Security Considerations

**JSON.parse Without Validation Schema:**
- Risk: Configuration loading in `src/config/index.ts` line 103 uses plain JSON.parse() without prior schema validation
- Files: `src/config/index.ts` (lines 102-103)
- Current mitigation: Configuration is merged with defaults afterward, which provides some fallback protection
- Recommendations:
  - Validate config JSON with Zod schema BEFORE merging (you already use Zod elsewhere)
  - Catch JSONSyntaxError specifically and provide better error messages
  - Add strict mode parsing that rejects unknown fields

**Environment Variable Substitution Pattern Potential Issue:**
- Risk: `src/config/index.ts` line 132 substitutes environment variables in API keys via `substituteEnvVar()` (function not shown in reads). If implementation uses string replacement without proper parsing, could have edge cases
- Files: `src/config/index.ts`
- Current mitigation: Only substitutes API key field (limited scope)
- Recommendations:
  - Document the exact substitution syntax (e.g., does it handle `${VAR:-default}` syntax?)
  - Validate substituted values are non-empty before accepting config
  - Add logging (without values) when env vars are substituted

**Obsidian REST API Key in Logs:**
- Risk: `src/obsidian/api-client.ts` line 328 logs search results which could include sensitive data from vault
- Files: `src/obsidian/api-client.ts` (lines 328)
- Current mitigation: Only logs result count, not actual content
- Recommendations:
  - Never log API keys or auth headers (already not doing this)
  - Be cautious logging any vault content in production
  - Add log level filtering to prevent search results from appearing in debug logs

**Path Traversal Mitigation Could Have Edge Cases:**
- Risk: `src/utils/validators.ts` implements path validation with string-based checks, particularly the trailing separator logic (lines 47-49)
- Files: `src/utils/validators.ts` (lines 47-62)
- Current mitigation: Uses `path.resolve()` and normalized path comparison. Handles Windows paths by converting to forward slashes
- Recommendations:
  - The empty path case has special debug logging (line 53) - ensure this edge case is tested comprehensively
  - Consider using `path.relative()` as an additional check to ensure path doesn't resolve outside vault
  - Add tests for symlinks and junction points on Windows

## Performance Bottlenecks

**Markdown AST Parsing on Every Read:**
- Problem: `src/filesystem/vault-reader.ts` calls `parseMarkdown()` for every note read, which involves full AST parsing even if links aren't needed
- Files: `src/filesystem/vault-reader.ts` (line 34)
- Cause: Eager parsing of all markdown. For large notes (1MB+) with complex markup, this is expensive
- Improvement path:
  - Add optional parameter to `readNote()` to skip link extraction (e.g., `skipLinkParsing: boolean`)
  - Cache parsed AST for recently accessed notes (LRU cache in memory)
  - Consider lazy parsing of links only when `get_backlinks` is called

**Rate Limiter Memory Accumulation:**
- Problem: `src/utils/rate-limiter.ts` uses `RateLimiterMemory` backend by default, which accumulates state in process memory
- Files: `src/utils/rate-limiter.ts` (line 71)
- Cause: Long-running server process will accumulate rate limit state. No automatic cleanup of old keys mentioned
- Improvement path:
  - Rate limiter library should handle this, but verify memory growth over time
  - Consider Redis backend for multi-process deployments
  - Monitor memory usage in production

**Vault Watcher Recursively Watching All Markdown Files:**
- Problem: `src/filesystem/vault-watcher.ts` line 39 watches `${vaultPath}/**/*.md` which recursively monitors every markdown file
- Files: `src/filesystem/vault-watcher.ts` (line 39)
- Cause: Large vaults (10k+ notes) could experience performance degradation from file watching overhead
- Improvement path:
  - Make polling interval configurable per vault size
  - Add option to watch only specific folders instead of entire vault
  - Implement debouncing for rapid file changes

## Fragile Areas

**Cross-Platform Path Handling Complexity:**
- Files: `src/utils/validators.ts`, `src/platform/detector.ts`, `src/filesystem/vault-watcher.ts`
- Why fragile: Path handling logic exists in multiple places (Windows path conversion, WSL detection, forward slash normalization). Changes to one could break others
- Safe modification:
  - Create centralized `PathNormalizer` utility class
  - Add comprehensive cross-platform tests for Windows, WSL, and Linux paths
  - Test with paths containing spaces, unicode characters, and special characters
- Test coverage: Validators test exists but coverage unclear for all edge cases

**Tool Handler Dispatch:**
- Files: `src/tools/index.ts` - tool handler lookup and dispatch logic
- Why fragile: Tool names are magic strings matched against handler functions. No compile-time verification that all defined tools have handlers
- Safe modification:
  - Create enum of tool names instead of string literals
  - Use TypeScript const assertion to ensure tool registry and handlers map matches
  - Add runtime validation in handler registration
- Test coverage: Integration tests exist but handlers2.ts duplication suggests incomplete refactoring

**Configuration Merging Strategy:**
- Files: `src/config/index.ts` (lines 106-125)
- Why fragile: Deep merging of nested config objects is done manually with spread operator, not recursive merge. Could lose nested defaults if structure changes
- Safe modification:
  - Use a library like `deepmerge` or `lodash.merge` for reliable nested merging
  - Add schema validation after merging to catch incomplete configs
  - Document expected config structure clearly
- Test coverage: No visible config validation tests

## Scaling Limits

**Single-Process Rate Limiting:**
- Current capacity: Rate limiter uses in-process memory storage. Suitable for single instance only
- Limit: Will not work correctly in multi-process or distributed setups. Each process has independent rate limit state
- Scaling path:
  - Implement Redis backend (code structure already supports this)
  - Document single-process limitation clearly
  - Provide migration guide to Redis for production deployments

**File Watching Overhead:**
- Current capacity: Chokidar file watching scales to thousands of files but becomes slower as vault grows
- Limit: Vaults with 50k+ notes may experience lag in change detection
- Scaling path:
  - Implement folder-level filtering
  - Add option to disable file watching for read-only deployments
  - Consider webhook-based change notification from Obsidian API instead of filesystem polling

**API Fallback Without Circuit Breaker:**
- Current capacity: Falls back to filesystem when API unavailable, but doesn't track API health
- Limit: Repeated API failures cause continuous timeout delays as fallback is attempted for every request
- Scaling path:
  - Implement circuit breaker pattern for API client
  - Cache API availability status with TTL (e.g., 5 minutes)
  - Add exponential backoff for failed API calls

## Dependencies at Risk

**MCP SDK Version Pinned to ^0.6.0:**
- Risk: SDK is still in early 0.x phase. Minor version updates could introduce breaking changes
- Current version: `@modelcontextprotocol/sdk: ^0.6.0` in `package.json`
- Impact: Minor SDK updates could break server without warning if they change protocol implementation
- Migration plan:
  - Pin to specific version `0.6.0` instead of `^0.6.0` until SDK reaches 1.0
  - Set up bot monitoring for SDK updates
  - Test thoroughly before updating
  - Document any SDK version compatibility notes

**Gray-Matter Used for YAML Parsing:**
- Risk: Gray-matter hasn't been updated in some time. Consider alternatives for YAML parsing
- Current: `gray-matter: ^4.0.3`
- Impact: If security issues found in YAML parsing, no updates available
- Migration plan:
  - Monitor for security advisories
  - Evaluate `markdown-it` or `markdown-it-front-matter` as alternatives
  - Test frontmatter parsing before migration

## Missing Critical Features

**No Backup/Recovery Mechanism:**
- Problem: delete_note permanently removes files with no recovery option or backup
- Blocks: Users cannot safely use delete_note in production without external backup system
- Recommendation: Add optional backup-before-delete feature (already exists as config `features.backup_on_delete` but appears disabled)

**No Conflict Resolution for Concurrent Writes:**
- Problem: If multiple clients write to same note simultaneously, last-write-wins (no merging or conflict detection)
- Blocks: Multi-user scenarios or AI + human editing conflicts
- Recommendation: Implement advisory locking (config option exists but appears disabled). Add version tracking with timestamps

**No Vault Lock/Sync Status:**
- Problem: No way to know if vault is currently syncing or locked by Obsidian
- Blocks: Write operations could fail silently or cause sync conflicts
- Recommendation: Add tool to check vault lock status via Obsidian API before write operations

## Test Coverage Gaps

**Integration Tests for API Fallback:**
- What's not tested: Behavior when Obsidian API is unavailable and server falls back to filesystem
- Files: `src/tools/__tests__/handlers.integration.test.ts` (mocks are not testing real fallback paths)
- Risk: Fallback logic could fail in production without warning
- Priority: High

**Rate Limiter Under Load:**
- What's not tested: Behavior when rate limits are actually exceeded (graceful degradation, queue behavior)
- Files: `src/utils/__tests__/rate-limiter.test.ts` - actual test coverage unclear
- Risk: Rate limiting could fail under high load when most needed
- Priority: High

**Cross-Platform Path Validation:**
- What's not tested: Path validation on actual Windows, WSL, and Linux filesystems (tests run on CI platform only)
- Files: `src/utils/__tests__/validators.test.ts` - test uses process.cwd() but may not test real path traversal scenarios
- Risk: Path traversal vulnerability could exist on untested platform
- Priority: High

**Large File Handling:**
- What's not tested: Behavior with files approaching 10MB limit (actual file size limit not exercised)
- Files: `src/filesystem/vault-reader.ts` line 24 enforces 10MB limit but not tested
- Risk: Large file handling could fail or timeout unexpectedly
- Priority: Medium

**Markdown Parser Edge Cases:**
- What's not tested: Malformed markdown, deeply nested structures, unusual frontmatter
- Files: `src/filesystem/markdown-parser.ts`
- Risk: Parser could throw unhandled errors on edge case input
- Priority: Medium

---

*Concerns audit: 2026-02-26*
