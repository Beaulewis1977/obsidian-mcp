# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
obsidian-mcp-server/
├── src/                          # Source code
│   ├── index.ts                  # MCP server entry point
│   ├── config/                   # Configuration management
│   │   └── index.ts              # Config loading and defaults
│   ├── tools/                    # Tool definitions and handlers
│   │   ├── index.ts              # Tool registration and routing
│   │   ├── schemas.ts            # Zod validation schemas
│   │   ├── handlers.ts           # Tool handlers (read operations)
│   │   ├── handlers2.ts          # Tool handlers (write/misc operations)
│   │   └── __tests__/            # Integration tests
│   ├── filesystem/               # Vault file operations
│   │   ├── vault-reader.ts       # Read files and list notes
│   │   ├── vault-writer.ts       # Write and delete files
│   │   ├── vault-watcher.ts      # File change monitoring
│   │   └── markdown-parser.ts    # Frontmatter and link extraction
│   ├── obsidian/                 # Remote API integration
│   │   └── api-client.ts         # Obsidian API HTTP client
│   ├── platform/                 # Platform-specific code
│   │   ├── detector.ts           # OS and WSL detection
│   │   ├── path-converter.ts     # Path handling
│   │   └── process-spawner.ts    # Process execution and app launch
│   ├── types/                    # Type definitions
│   │   └── index.ts              # Interfaces for config, notes, responses
│   └── utils/                    # Utility functions
│       ├── logger.ts             # Pino-based logging
│       ├── errors.ts             # Error response formatting
│       ├── validators.ts         # Path and input validation
│       ├── rate-limiter.ts       # Multi-tier rate limiting
│       └── __tests__/            # Utility unit tests
├── dist/                         # Compiled output (generated)
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── tsup.config.ts                # Build configuration
├── .env.example                  # Environment variable template
├── config.json                   # Example vault configuration
├── README.md                     # User documentation
├── .github/workflows/            # GitHub Actions CI/CD
├── docs/                         # Additional documentation
├── examples/                     # Usage examples
├── guides/                       # Setup guides
└── .planning/                    # GSD planning documents
```

## Directory Purposes

**src/:**
- Purpose: All source TypeScript code, compiled by tsup to dist/
- Contains: 24 TypeScript files across 8 subdirectories
- Key files: Entry point (index.ts), 13 exported tools, type system, all utilities

**src/config/:**
- Purpose: Configuration loading and merging
- Contains: Single file that handles config file discovery, env var substitution, defaults
- Key files: `config/index.ts` (loadConfig, getDefaultVault, getVaultByName, saveConfig)

**src/tools/:**
- Purpose: Tool definitions, schemas, and handlers
- Contains: 13 tools (read_note, create_note, edit_note, delete_note, list_notes, search_notes, move_note, update_frontmatter, get_daily_note, open_in_obsidian, get_backlinks, create_folder, get_vault_stats)
- Key files:
  - `tools/index.ts`: Tool registration and dispatch (getToolDefinitions, handleToolCall)
  - `tools/schemas.ts`: Zod validation schemas for all tools
  - `tools/handlers.ts`: Handlers for read operations (handleReadNote, handleListNotes, etc.)
  - `tools/handlers2.ts`: Handlers for write/misc operations (handleMoveNote, handleDeleteNote, etc.)

**src/filesystem/:**
- Purpose: All vault file I/O operations
- Contains: File reading/writing, directory traversal, file watching, markdown parsing
- Key files:
  - `vault-reader.ts`: readNote, listNotes, searchNotes, noteExists
  - `vault-writer.ts`: writeNote, deleteNote, moveNote, createFolder
  - `vault-watcher.ts`: createVaultWatcher with chokidar
  - `markdown-parser.ts`: parseMarkdown (gray-matter + remark), stringifyMarkdown

**src/obsidian/:**
- Purpose: Remote Obsidian API integration
- Contains: Single HTTP client with retry logic, availability checking, auth support
- Key files: `api-client.ts` (ObsidianAPIClient class)

**src/platform/:**
- Purpose: OS-specific abstractions
- Contains: Platform detection, path conversion, process execution
- Key files:
  - `detector.ts`: detectPlatform (returns PlatformInfo)
  - `path-converter.ts`: Utility functions for path handling
  - `process-spawner.ts`: openInObsidian, openURI using execa

**src/types/:**
- Purpose: Centralized TypeScript interfaces
- Contains: Types for configuration (ServerConfig, VaultConfig, etc.), notes (Note, Link, etc.), errors
- Key files: `types/index.ts` (all interfaces and ERROR_CODES enum)

**src/utils/:**
- Purpose: Shared utility functions and middleware
- Contains: Logging, error handling, validation, rate limiting
- Key files:
  - `logger.ts`: Pino logger with redaction
  - `errors.ts`: createErrorResponse, error type checkers
  - `validators.ts`: validatePath, ensureMarkdownExtension
  - `rate-limiter.ts`: RateLimitManager with multi-tier support

**dist/:**
- Purpose: Compiled JavaScript output
- Generated by: tsup build process
- Contains: Single bundle (index.js), declaration files, source maps
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**
- `src/index.ts`: Process entry point (#!/usr/bin/env node), initializes server and manages lifecycle
- `dist/index.js`: Compiled executable, directly runnable via `npm start`

**Configuration:**
- `config.json`: Example vault configuration in project root
- `.env.example`: Example environment variables
- `tsconfig.json`: TypeScript compiler options (ES2022, strict mode, no unused locals)
- `tsup.config.ts`: Build config (esm format, single bundle, external MCP SDK)

**Core Logic:**
- `src/tools/index.ts`: Tool routing and rate limiting orchestration
- `src/filesystem/vault-reader.ts`: File reading with size validation (10MB limit)
- `src/filesystem/vault-writer.ts`: File writing with directory creation
- `src/filesystem/markdown-parser.ts`: Frontmatter extraction and link parsing
- `src/obsidian/api-client.ts`: HTTP client with retry logic

**Testing:**
- `src/tools/__tests__/handlers.integration.test.ts`: Integration tests for tool handlers
- `src/utils/__tests__/`: Unit tests for error, logger, rate-limiter, validators

## Naming Conventions

**Files:**
- `index.ts`: Barrel exports or main module file in directory
- `handlers.ts`, `handlers2.ts`: Tool request handlers (split by operation type)
- `*-parser.ts`: Parsing and extraction utilities
- `*-reader.ts`: Read-only filesystem operations
- `*-writer.ts`: Write filesystem operations
- `*-watcher.ts`: File watching/monitoring
- `*-client.ts`: External service client
- `*-limiter.ts`: Rate limiting logic
- `.test.ts`, `.spec.ts`: Test files

**Directories:**
- `src/[feature]/`: Feature-specific code (filesystem, tools, config, etc.)
- `__tests__/`: Co-located test directories near source
- `src/utils/`: Cross-cutting utilities used by multiple modules

## Where to Add New Code

**New Tool/Feature:**
- Schema definition: `src/tools/schemas.ts` (add new Zod schema)
- Handler: `src/tools/handlers.ts` or `src/tools/handlers2.ts` (implement handler function)
- Registration: `src/tools/index.ts` (add to getToolDefinitions() and handleToolCall() switch)
- Type: Add to `src/types/index.ts` if creating new data structure
- Test: `src/tools/__tests__/handlers.integration.test.ts`

**New Utility/Helper:**
- Shared helpers: `src/utils/[domain].ts` (e.g., `src/utils/validators.ts`)
- Platform-specific code: `src/platform/[concern].ts`
- Configuration helpers: `src/config/index.ts`
- Type definitions: `src/types/index.ts`
- Tests: `src/utils/__tests__/[domain].test.ts`

**New External Integration:**
- API client: `src/[service-name]/api-client.ts` (following obsidian/api-client pattern)
- Configuration types: Add to `src/types/index.ts` (extend ServerConfig if needed)
- Config loading: Extend `src/config/index.ts` if new external service config needed

**New Test:**
- Unit test for utility: `src/utils/__tests__/[domain].test.ts`
- Integration test for tool: `src/tools/__tests__/handlers.integration.test.ts`
- Test configuration: Tests use Vitest, see `vitest.config.*` if needed (not currently present)

## Special Directories

**dist/:**
- Purpose: Compiled output
- Generated: Yes (build artifact)
- Committed: No (in .gitignore)
- How to regenerate: `npm run build`

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (package manager)
- Committed: No (in .gitignore)
- How to regenerate: `npm install`

**.planning/codebase/:**
- Purpose: GSD planning documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by GSD agents)
- Committed: Yes (tracked in git)
- How to maintain: Run `/gsd:map-codebase` with appropriate focus

**.github/workflows/:**
- Purpose: GitHub Actions CI/CD pipelines
- Contains: Build, test, lint, and deploy workflows
- Committed: Yes (tracked in git)

**examples/:**
- Purpose: Usage examples and sample scripts
- Contains: MCP client examples, configuration examples
- Committed: Yes (tracked in git)

**docs/:**
- Purpose: Additional documentation beyond README
- Contains: API documentation, architecture diagrams, setup guides
- Committed: Yes (tracked in git)

## Module Dependencies

**Dependency Graph (simplified):**

```
src/index.ts (entry)
  ├─ src/config/index.ts
  ├─ src/tools/index.ts
  │   ├─ src/tools/handlers.ts
  │   │   ├─ src/filesystem/vault-reader.ts
  │   │   ├─ src/obsidian/api-client.ts
  │   │   └─ src/utils/*
  │   ├─ src/tools/handlers2.ts
  │   │   ├─ src/filesystem/vault-*
  │   │   ├─ src/platform/process-spawner.ts
  │   │   └─ src/utils/*
  │   ├─ src/utils/rate-limiter.ts
  │   └─ src/tools/schemas.ts
  ├─ src/filesystem/vault-watcher.ts
  ├─ src/platform/detector.ts
  └─ src/utils/logger.ts
```

**External Dependencies:**
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `chokidar`: File watching
- `dayjs`: Date parsing
- `dotenv`: Environment loading
- `execa`: Process spawning
- `gray-matter`: Frontmatter parsing
- `is-wsl`: WSL detection
- `node-fetch`: HTTP client
- `pino`: Logging
- `rate-limiter-flexible`: Rate limiting
- `remark`, `remark-parse`, `remark-wiki-link`, `unified`: Markdown parsing

## Imports Pattern

**Circular Imports:** None detected (acyclic dependency graph)

**Path Imports:**
- Relative imports used throughout (e.g., `import { logger } from '../utils/logger.js'`)
- No path aliases configured in tsconfig.json
- All imports include `.js` extension for ES modules

**Export Patterns:**
- Named exports for utilities and helpers
- Default exports from barrel files (index.ts)
- Type-only imports for TypeScript interfaces

---

*Structure analysis: 2026-02-26*
