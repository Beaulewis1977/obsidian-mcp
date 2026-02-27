# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** MCP Server with Layered Architecture

This is a Model Context Protocol (MCP) server that exposes Obsidian vault operations through a standardized protocol. The architecture follows a clear separation of concerns with distinct layers for configuration, tool routing, filesystem operations, platform abstraction, and external API integration.

**Key Characteristics:**
- Layered architecture with clear separation of concerns (MCP protocol → Tools → Filesystem/API → Platform)
- Single entry point (`src/index.ts`) that initializes server and manages tool lifecycle
- Schema-driven tool validation using Zod
- Dual data access patterns: filesystem-first with optional Obsidian API fallback
- Cross-cutting concerns handled via middleware (rate limiting, logging, error handling)

## Layers

**MCP Protocol Layer:**
- Purpose: Implements Model Context Protocol server interface, handles client communication
- Location: `src/index.ts`
- Contains: Server initialization, transport setup (stdio), request/response handlers
- Depends on: Tools, Config, Logger, Platform detection
- Used by: External MCP clients via stdio

**Tool Routing Layer:**
- Purpose: Maps incoming tool requests to handlers, performs validation, manages rate limiting
- Location: `src/tools/index.ts`, `src/tools/handlers.ts`, `src/tools/handlers2.ts`
- Contains: Tool definitions (13 tools), request validation via Zod schemas, tool dispatch logic
- Depends on: Filesystem layer, API client, validators, rate limiter, error handlers
- Used by: MCP Protocol layer for tool execution

**Filesystem Layer:**
- Purpose: Direct vault access via file operations
- Location: `src/filesystem/vault-reader.ts`, `src/filesystem/vault-writer.ts`, `src/filesystem/vault-watcher.ts`, `src/filesystem/markdown-parser.ts`
- Contains: File I/O operations, markdown parsing, file watching, metadata extraction
- Depends on: Node.js fs/promises, gray-matter, remark for parsing, chokidar for watching
- Used by: Tool handlers for data persistence, API client as fallback

**Obsidian API Layer:**
- Purpose: Optional remote API integration for vault operations
- Location: `src/obsidian/api-client.ts`
- Contains: HTTP client, retry logic, availability checking, SSL/TLS configuration
- Depends on: node-fetch, https module
- Used by: Tool handlers (read operations preferentially use API if available)

**Platform Layer:**
- Purpose: OS-specific abstractions for path handling, process execution, file watching
- Location: `src/platform/detector.ts`, `src/platform/path-converter.ts`, `src/platform/process-spawner.ts`
- Contains: Platform detection (Windows/WSL/Linux), path separator handling, Obsidian application launcher, URI opening
- Depends on: is-wsl, execa for process spawning
- Used by: Tool handlers, vault watcher, config loader

**Configuration Layer:**
- Purpose: Loads and merges server configuration from multiple sources
- Location: `src/config/index.ts`
- Contains: Config loading, environment variable substitution, defaults, vault registry
- Depends on: dotenv for environment loading, filesystem
- Used by: Every other layer for runtime configuration

**Utilities & Cross-Cutting Concerns:**
- Purpose: Shared functions for logging, error handling, validation, rate limiting
- Location: `src/utils/logger.ts`, `src/utils/errors.ts`, `src/utils/validators.ts`, `src/utils/rate-limiter.ts`
- Contains: Structured logging (Pino), error response formatting, path validation, multi-tier rate limiting
- Depends on: Pino logger, rate-limiter-flexible, Zod
- Used by: All layers

**Types & Schemas:**
- Purpose: Centralized type definitions and validation schemas
- Location: `src/types/index.ts`, `src/tools/schemas.ts`
- Contains: TypeScript interfaces for vault/config/notes, Zod validation schemas for tool inputs
- Depends on: Zod
- Used by: All layers for type safety and runtime validation

## Data Flow

**Tool Execution (Read):**

1. Client sends `read_note` request to MCP server via stdio
2. MCP Protocol layer invokes `handleToolCall()` with tool name and arguments
3. Rate limiter checks allowance for operation (global, operation-type, and tool-specific limits)
4. Tool handler (handlers.ts) receives validated input via Zod schema
5. `getVault()` resolves vault from name or default
6. **Attempt 1 (API):** If Obsidian API enabled and available, fetch note via `ObsidianAPIClient`
7. **Attempt 2 (Filesystem):** Read note via `readNote()` from filesystem
8. `parseMarkdown()` extracts frontmatter (gray-matter), content, and wiki/markdown links (remark)
9. Response formatted and returned to client

**Tool Execution (Write):**

1. Client sends `create_note`/`edit_note`/`delete_note` request
2. MCP Protocol layer invokes `handleToolCall()` with validation
3. Rate limiter checks stricter limits for write operations
4. Tool handler validates paths and vault state
5. Performs filesystem operation via `writeNote()` or `deleteNote()`
6. Creates parent directories if needed
7. Returns success response with operation details

**Vault Watching:**

1. Server startup initializes `createVaultWatcher()` for each vault if file_watching enabled
2. Chokidar watches vault path with configurable polling (native on Linux/Mac, polling on Windows/WSL)
3. File change events (add/change/unlink) logged via logger
4. Optional callback `onChange()` hook available for future client notifications
5. Graceful shutdown closes all watchers on SIGINT/SIGTERM

**State Management:**

- **Configuration:** Loaded once at startup from file system or defaults, merged with environment overrides
- **Rate Limit State:** Maintained in memory (default) or Redis backend, keyed per vault/tool
- **Vault Watchers:** Array of active watchers maintained in main() closure for cleanup
- **Logger Context:** Structured logging with redacted sensitive fields (API keys, auth tokens)
- **API Client Cache:** Availability cached per ObsidianAPIClient instance (force=false)

## Key Abstractions

**VaultConfig:**
- Purpose: Represents a single Obsidian vault configuration
- Examples: `src/types/index.ts` (VaultConfig interface), `src/config/index.ts` (loading/retrieval)
- Pattern: Loaded from JSON config, supports multiple vaults per server, API configuration per vault

**Note:**
- Purpose: Unified representation of a markdown file with parsed metadata
- Examples: `src/types/index.ts` (Note interface), `src/filesystem/vault-reader.ts` (creation), `src/filesystem/markdown-parser.ts` (parsing)
- Pattern: Frontmatter (gray-matter), content body, extracted links (wiki/markdown), file metadata

**ToolResponse:**
- Purpose: Standardized response format for all tool operations
- Examples: `src/types/index.ts` (ToolResponse type alias), `src/utils/errors.ts` (error responses)
- Pattern: JSON-formatted content array + optional isError flag, compatible with MCP CallToolResult

**ObsidianAPIClient:**
- Purpose: HTTP client abstraction for remote Obsidian API interaction
- Examples: `src/obsidian/api-client.ts`
- Pattern: Singleton per vault, implements retry logic, caches availability, supports custom SSL/auth

**RateLimitManager:**
- Purpose: Multi-tier rate limiting (global, operation-type, tool-specific)
- Examples: `src/utils/rate-limiter.ts`, used in `src/tools/index.ts`
- Pattern: Three nested limiters (global → operation-type → tool), memory or Redis backend, graceful degradation with warnings

## Entry Points

**Process Entry:**
- Location: `src/index.ts` (shebang: `#!/usr/bin/env node`)
- Triggers: `npm start` or direct `node dist/index.js` execution
- Responsibilities: Load config, detect platform, create MCP server, register handlers, initialize watchers, handle graceful shutdown

**Tool Request Entry:**
- Location: `src/index.ts` line 65 (CallToolRequestSchema handler)
- Triggers: Client sends CallToolRequest via stdio
- Responsibilities: Route to `handleToolCall()`, catch errors, return formatted response

**Configuration Entry:**
- Location: `src/config/index.ts`
- Triggers: Server startup (called from main())
- Responsibilities: Load from file system, merge defaults, substitute environment variables

## Error Handling

**Strategy:** Hierarchical error handling with specific error codes and user-facing suggestions

**Patterns:**

- **Validation Errors:** Caught at Zod parse stage in tool handlers, return `VALIDATION_ERROR` with details
- **File Not Found:** Caught in filesystem layer (ENOENT), mapped to `NOTE_NOT_FOUND` error code
- **Permission Denied:** Caught in filesystem layer (EACCES), mapped to `PERMISSION_DENIED` error code
- **API Errors:** Caught in ObsidianAPIClient, categorized as auth (401/403), client (4xx), or server (5xx) errors
- **Rate Limit Exceeded:** Checked before tool execution, returns `RATE_LIMIT_EXCEEDED` with wait time
- **Large Files:** Detected on read, adds warning to Note object, throws error if exceeds 10MB limit
- **Path Validation:** All tool paths validated against vault root before filesystem access, prevents directory traversal

Error responses always include:
- `error`: Human-readable error message
- `details`: Technical details for debugging
- `code`: Machine-readable error code (from ERROR_CODES enum)
- `suggestion`: (Optional) Actionable guidance for user
- `recovery`: (Optional) Fallback information

## Cross-Cutting Concerns

**Logging:**
- Framework: Pino (structured JSON logging)
- Configuration: `src/utils/logger.ts`
- Features: Contextual child loggers, sensitive field redaction (API keys, auth headers), configurable levels (LOG_LEVEL env var)
- Pattern: All major operations logged at info/debug level, errors at error level

**Validation:**
- Framework: Zod for schema definition and runtime validation
- Location: `src/tools/schemas.ts` (tool input schemas), `src/utils/validators.ts` (path validation)
- Pattern: Schema-first approach, validation errors caught and mapped to user-friendly responses

**Authentication:**
- Approach: Optional per-vault Obsidian API authentication via API key
- Configuration: `vault.obsidian_api.api_key` (can reference env var via `${ENV_VAR_NAME}`)
- Pattern: Fallback to filesystem access if API unavailable or disabled

**Rate Limiting:**
- Implementation: Tiered rate limiting (global → operation-type → tool-specific)
- Backends: In-memory (default) or Redis
- Configuration: `src/config/index.ts` with sensible defaults (100 writes/min, 600 reads/min)
- Pattern: Check before tool execution, return warning at 80% of limit, queue or reject on limit exceeded

---

*Architecture analysis: 2026-02-26*
