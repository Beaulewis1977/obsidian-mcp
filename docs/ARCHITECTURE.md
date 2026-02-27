# Architecture

## System Overview

The Obsidian MCP Server is a Model Context Protocol server that enables AI assistants to interact with Obsidian vaults through a dual-access architecture: Obsidian Local REST API (primary) and direct filesystem operations (fallback).

## Core Principles

1. **API-First for Most Writes:** Write operations (create, edit, delete) prioritize the Obsidian REST API to maintain app cache consistency. Exceptions: `move_note`, `update_frontmatter`, and `create_folder` are filesystem-only operations.
2. **Filesystem for Reads:** Read operations use direct filesystem access for speed and reliability
3. **Graceful Fallback:** When API is unavailable, API-capable operations fall back to filesystem. `open_in_obsidian` falls back from app spawn to URI protocol.
4. **Cross-Platform:** Seamless operation on Windows native and WSL environments
5. **Security-First:** Path validation, API key protection, and safe defaults

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Clients                              │
│  (Claude Code CLI, Cursor, Windsurf, Zed, Claude Desktop)      │
└────────────────────────┬────────────────────────────────────────┘
                         │ stdio/JSON-RPC 2.0
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Obsidian MCP Server                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Core MCP Layer                                         │   │
│  │  - Tool Registry & Dispatcher                           │   │
│  │  - Schema Validation (Zod)                              │   │
│  │  - Error Handling & Logging                             │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │                                         │
│  ┌─────────────────────┴───────────────────────────────────┐   │
│  │  Dual Access Layer                                      │   │
│  │  ┌──────────────────┐    ┌──────────────────────────┐  │   │
│  │  │ Obsidian API     │    │ Filesystem Operations    │  │   │
│  │  │ (Primary)        │    │ (Fallback)               │  │   │
│  │  │ - REST API calls │    │ - Direct file read/write │  │   │
│  │  │ - URI protocol   │    │ - Chokidar monitoring    │  │   │
│  │  │ - Command exec   │    │ - Markdown parsing       │  │   │
│  │  └──────────────────┘    └──────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                        │                                         │
│  ┌─────────────────────┴───────────────────────────────────┐   │
│  │  Platform Abstraction Layer                             │   │
│  │  - Path conversion (Windows ↔ WSL)                      │   │
│  │  - Process spawning (cross-platform)                    │   │
│  │  - Environment detection                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
    ┌───────────────┐         ┌──────────────┐
    │ Obsidian App  │         │ Vault Files  │
    │ (via API/URI) │         │ (.md, .json) │
    └───────────────┘         └──────────────┘
```

## Component Layers

### 1. Core MCP Layer

**Responsibilities:**
- MCP protocol implementation (stdio transport)
- Tool registration and dispatching
- Input validation using Zod schemas
- Error handling and response formatting
- Structured logging with pino

**Key Files:**
- `src/index.ts` - Server initialization
- `src/tools/index.ts` - Tool registry
- `src/tools/schemas.ts` - Zod validation schemas

### 2. Dual Access Layer

#### Obsidian API Client (Primary)

**Responsibilities:**
- REST API communication with Obsidian Local REST API plugin
- Authentication (Bearer token)
- Availability checking
- Error handling and retry logic

**Operations:**
- `PUT /vault/{path}` - Create/replace notes
- `POST /vault/{path}` - Append to notes
- `PATCH /vault/{path}` - Targeted edits with v3+ headers
- `DELETE /vault/{path}` - Delete notes
- `POST /open/{filename}` - Open notes in Obsidian
- `GET /search/` - Search vault content

**Key Files:**
- `src/obsidian/api-client.ts`
- `src/obsidian/uri-handler.ts`

#### Filesystem Operations (Fallback)

**Responsibilities:**
- Direct file I/O when API unavailable
- Markdown parsing and frontmatter extraction
- File watching for change detection
- Directory traversal for listing

**Key Files:**
- `src/filesystem/vault-reader.ts`
- `src/filesystem/vault-writer.ts`
- `src/filesystem/vault-watcher.ts`
- `src/filesystem/markdown-parser.ts`

### 3. Platform Abstraction Layer

**Responsibilities:**
- Windows ↔ WSL path conversion using `wslpath`
- Cross-platform process spawning
- Environment detection (Windows native vs WSL)
- Platform-specific configuration

**Key Files:**
- `src/platform/path-converter.ts`
- `src/platform/process-spawner.ts`
- `src/platform/detector.ts`

### 4. Utilities

**Responsibilities:**
- Path validation and security
- Logging configuration
- Error types and handlers
- Rate limiting (optional)

**Key Files:**
- `src/utils/validators.ts`
- `src/utils/logger.ts`
- `src/utils/errors.ts`

## Data Flow Patterns

### Create Note Flow

```
1. MCP Client → create_note tool
2. Validate input (path, content, frontmatter)
3. Check API availability
4. If API available:
   a. Construct full markdown with frontmatter
   b. PUT /vault/{path} to Obsidian API
   c. Return success
5. If API unavailable (fallback):
   a. Write file directly to filesystem
   b. Optionally open in Obsidian to refresh cache
   c. Return success with cache warning
```

### Edit Note Flow (Optimized)

```
Branch 1: API available
1. MCP Client → edit_note with heading target
2. PATCH /vault/{path} with v3+ headers
3. Return success

Branch 2: API unavailable
1. Read file from filesystem
2. Parse markdown AST
3. Locate insertion point
4. Write modified content
5. Return success
```

### Read Note Flow

```
1. MCP Client → read_note
2. Validate and resolve path
3. Read file directly (fs.readFile)
4. Parse frontmatter (gray-matter)
5. Extract links and headings (remark)
6. Return structured content
```

## Security Architecture

### Path Validation

All path inputs are validated to prevent traversal attacks:
- Reject paths containing `..`
- Reject absolute paths
- Verify resolved path is within vault boundary
- Log rejected attempts

### API Key Handling

- Store in environment variables only
- Never log in plain text
- Redact in structured logs
- Transmit only over HTTPS (or localhost)

### HTTPS Configuration

- Accept self-signed certificates for localhost only
- Verify SSL for remote connections
- Configurable per-vault

## Cross-Platform Considerations

### Windows Native

- Direct filesystem access: `C:\Users\username\vault`
- Obsidian executable: `C:\Program Files\Obsidian\Obsidian.exe`
- REST API: `https://127.0.0.1:27124`
- Standard Windows path separators

### WSL

- Preferred: Linux filesystem `/home/user/vault`
- Alternative: Windows filesystem `/mnt/c/Users/username/vault`
- Obsidian executable: `/mnt/c/Program Files/Obsidian/Obsidian.exe`
- Path conversion via `wslpath`
- File watching requires polling for Windows filesystems

## Performance Considerations

### Optimization Strategies

1. **Read Operations:** Direct filesystem access (no API overhead)
2. **File Watching:** Native events on Linux, polling on Windows FS from WSL
3. **Caching:** Future enhancement for frequently accessed notes
4. **Lazy Loading:** Future enhancement for large vaults

### Scalability

- Tested with vaults up to 1000+ notes
- File watching configurable (can be disabled)
- Rate limiting available for production deployments

## Error Handling Strategy

### Error Classification

1. **User Errors:** Invalid input, note not found → Return with `isError: true`
2. **Configuration Errors:** Missing vault, invalid API key → Helpful message
3. **System Errors:** Filesystem errors, network errors → Log details, return generic message

### Fallback Behavior

- API unavailable → Filesystem operations
- Filesystem write → Suggest opening note to refresh cache
- All errors include actionable suggestions

## Technology Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript with strict mode
- **MCP SDK:** `@modelcontextprotocol/sdk` v1.27.1
- **Markdown:** gray-matter, remark, unified
- **File Watching:** chokidar
- **Logging:** pino
- **Validation:** Zod
- **Build:** tsup (esbuild)
- **Testing:** vitest

---

**Related Documents:**
- [Main Blueprint](compass_artifact_wf-fe9f07c2-63af-4612-9659-b34a1053148a_text_markdown.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [API Reference](API_REFERENCE.md)
- [Testing Checklist](TESTING_CHECKLIST.md)
- [Troubleshooting](TROUBLESHOOTING.md)

