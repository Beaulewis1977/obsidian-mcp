# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- TypeScript 5.3.3 - All source code and configuration
- JavaScript - Build system and CLI utilities (`.mjs` files)
- Markdown - Documentation and vault content

**Environment:**
- Node.js >=18.0.0 - Runtime requirement
- ESM (ES Module) - Module system

## Runtime

**Environment:**
- Node.js 18+ (specified in `package.json` engines field)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.27.1 - Model Context Protocol server implementation
  - Provides Server, StdioServerTransport, and request/response handling
  - Located: `src/index.ts`

**Build/Dev:**
- tsup 8.0.0 - TypeScript bundler
  - Config: `tsup.config.ts`
  - Entry point: `src/index.ts`
  - Output: ESM bundle to `dist/`
  - Includes source maps and TypeScript definitions

- TypeScript 5.3.3 - Type checking and compilation
  - Config: `tsconfig.json`
  - Strict mode enabled
  - Target: ES2022 with ES2022 lib
  - No unused locals/parameters checking enabled

**Testing:**
- vitest 2.0.0 - Test runner
  - Config: `vitest.config.ts`
  - Environment: Node.js
  - Coverage: v8 provider with HTML reports
  - Run: `npm test`, `npm test:ui`, `npm test:coverage`

**Linting/Formatting:**
- No direct ESLint/Prettier config found - relies on TypeScript strict mode

**Git Hooks:**
- husky 9.1.7 - Git hooks manager
  - Runs: `npm run lint && npm test -- --run` on pre-commit

## Key Dependencies

**Critical:**

- @modelcontextprotocol/sdk 1.27.1 - MCP protocol implementation
  - Bundled into final distribution
  - Core to server functionality

- chokidar 4.0.0 - File system watcher
  - Detects changes in Obsidian vaults
  - Supports polling for WSL Windows filesystem detection
  - Located: `src/filesystem/vault-watcher.ts`

- node-fetch 3.3.2 - HTTP client
  - Fetch API for Node.js
  - Used for Obsidian REST API calls
  - Located: `src/obsidian/api-client.ts`

- dotenv 16.4.5 - Environment variable loader
  - Loads .env configuration
  - Located: `src/config/index.ts`

- pino 9.0.0 - JSON logging framework
  - Structured logging with redaction of sensitive data
  - Transport: pino-pretty (dev only) for readable output
  - Redacts: Authorization headers, API keys, secrets
  - Located: `src/utils/logger.ts`

**Utilities:**

- gray-matter 4.0.3 - YAML frontmatter parser
  - Extracts frontmatter from markdown files
  - Located: `src/filesystem/markdown-parser.ts`

- unified 11.0.4 - Text processing ecosystem
  - AST-based markdown processing
  - Used with: remark-parse, remark-wiki-link

- remark 15.0.1 - Markdown processor
  - Core remark processor

- remark-parse 11.0.0 - Remark markdown parser
  - Parses markdown to AST
  - Located: `src/filesystem/markdown-parser.ts`

- remark-wiki-link 2.0.1 - Wiki link plugin for remark
  - Processes Obsidian-style [[wiki links]]
  - Located: `src/filesystem/markdown-parser.ts`

- rate-limiter-flexible 5.0.3 - Rate limiting library
  - Supports memory and Redis backends
  - Multiple tiers: global, operation-type, tool-specific
  - Located: `src/utils/rate-limiter.ts`

- zod 3.22.4 - Schema validation
  - Type-safe runtime validation
  - Located: `src/tools/schemas.ts`

- zod-to-json-schema 3.22.4 - JSON Schema generation
  - Converts Zod schemas to JSON Schema for MCP tools

- execa 8.0.1 - Process execution
  - Execute external commands (open Obsidian application)
  - Located: `src/platform/process-spawner.ts`

- is-wsl 3.1.0 - WSL detection
  - Detects if running in WSL environment
  - Used for platform-specific behavior
  - Located: `src/platform/detector.ts`, `src/filesystem/vault-watcher.ts`

- dayjs 1.11.10 - Date/time library
  - Date manipulation and formatting
  - Lightweight alternative to moment.js

**Development Only:**

- @types/node 20.11.0 - Node.js type definitions

- @vitest/ui 2.0.0 - Vitest UI for test visualization
  - Run: `npm run test:ui`

- pino-pretty 11.0.0 - Pino transport for readable logging
  - Only loaded in non-production environments
  - Colorized, human-readable output

- husky 9.1.7 - Git hooks manager
  - Pre-commit: type checking and tests

## Configuration

**Environment Variables:**
- Loaded from `.env` file via dotenv
- Example: `.env.example` provided
- Key configurations:
  - `MCP_PORT`: Server port (default: 13800)
  - `CONFIG_PATH`: Custom config.json location
  - `LOG_LEVEL`: Logging verbosity (default: info)
  - `RATE_LIMITING_*`: Rate limiting settings
  - `FILE_WATCHING_ENABLED`: File watcher toggle
  - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`: Optional AI keys
  - `NODE_ENV`: Development/production mode

**File Configuration:**
- Primary: `~/.obsidian-mcp/config.json` (user home directory)
- Fallback: `./config.json` (current/parent directory)
- Custom: `CONFIG_PATH` environment variable
- Format: JSON with vault paths and optional Obsidian API config

**Build Configuration:**
- `tsup.config.ts` - Bundle configuration
  - Entry: `src/index.ts`
  - Format: ESM only
  - Target: Node 18
  - Includes: Source maps, type definitions
  - External: @modelcontextprotocol/sdk (not bundled)

**TypeScript Configuration:**
- `tsconfig.json`
  - Target: ES2022
  - Module: ES2022
  - Strict mode enabled
  - Include: `src/**/*`
  - Exclude: `node_modules`, `dist`, test files

**Test Configuration:**
- `vitest.config.ts`
  - Global test utilities enabled
  - Node.js environment
  - Coverage: v8 provider

## Platform Requirements

**Development:**
- Node.js >=18.0.0
- npm for package management
- Git (for husky hooks)
- TypeScript knowledge (strict mode enabled)

**Production:**
- Node.js >=18.0.0 runtime
- Obsidian installation (for API integration)
- Optional: Redis server (if using Redis rate limiting backend)
- File system access (reads/writes to vault directories)
- Network access (for optional Obsidian API calls)

**Platform-Specific Features:**
- WSL Support: Detects and handles Windows filesystem paths in WSL environment
  - Special handling for file watching (polling on Windows FS from WSL)
  - Path conversion utilities in `src/platform/path-converter.ts`
  - Process spawning adapted for WSL in `src/platform/process-spawner.ts`
- Windows/macOS/Linux: Native file watching via chokidar
- HTTPS support with configurable SSL verification

---

*Stack analysis: 2026-02-26*
