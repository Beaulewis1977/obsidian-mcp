# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- Kebab-case for filenames: `vault-reader.ts`, `api-client.ts`, `markdown-parser.ts`
- Test files use `__tests__` subdirectory: `src/utils/__tests__/logger.test.ts`
- Test files suffix: `.test.ts` (not `.spec.ts`)

**Functions:**
- camelCase for function names: `readNote()`, `getVault()`, `validatePath()`
- Prefixed exports for clarity: `handle*` for tool handlers (`handleReadNote`, `handleCreateNote`), `is*` for boolean checks (`isAuthError()`, `isClientError()`)
- Internal helper functions without prefix: `getVault()`, `getAPIClient()`, `getConfigPaths()`

**Variables:**
- camelCase for all variable declarations: `vaultPath`, `notePath`, `configPath`, `mockConfig`
- UPPERCASE with UNDERSCORES for constants: `FILE_SIZE_LIMITS`, `DEFAULT_CONFIG`, `LOG_LEVEL`, `TOOL_CLASSIFICATIONS`
- Single character acceptable for loop indices: `i` in `Array.from({ length: 1000 }, (_, i) => ...)`

**Types:**
- PascalCase for interfaces and types: `VaultConfig`, `ServerConfig`, `Note`, `FileMetadata`, `PlatformInfo`, `ToolResponse`
- Types imported with `type` keyword: `import type { ServerConfig, VaultConfig } from '../types/index.js'`
- Discriminated unions for error codes: `ERROR_CODES` enum with string constants: `NOTE_NOT_FOUND`, `VAULT_NOT_FOUND`, `INVALID_PATH`

## Code Style

**Formatting:**
- No explicit linter configuration detected (no `.eslintrc`, `.prettierrc`)
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- Imports use ES6 module syntax with `.js` extensions for clarity: `import { logger } from '../utils/logger.js'`
- Spacing: 2-space indentation visible in all files

**Linting:**
- TypeScript compiler used for type checking: `npm run lint` runs `tsc --noEmit`
- No ESLint or Prettier configuration present
- Pre-commit hook enforces lint and test: `"precommit": "npm run lint && npm test -- --run"` in package.json

## Import Organization

**Order:**
1. Node.js built-in modules: `import fs from 'fs/promises'`, `import path from 'path'`, `import os from 'os'`
2. Third-party packages: `import pino from 'pino'`, `import { z } from 'zod'`, `import isWSL from 'is-wsl'`
3. Internal imports with relative paths: `import { logger } from '../utils/logger.js'`, `import { readNote } from '../filesystem/vault-reader.js'`
4. Type imports after value imports: `import type { ServerConfig, VaultConfig } from '../types/index.js'`

**Path Aliases:**
- No path aliases configured in `tsconfig.json` (no baseUrl or paths option)
- All imports use relative paths: `../utils/logger.js`, `../../filesystem/vault-reader.js`

## Error Handling

**Patterns:**
- Custom error utility functions in `src/utils/errors.ts`:
  - `createErrorResponse()`: Wraps errors into MCP-compliant tool responses with standardized structure
  - Classification helpers: `isAuthError()`, `isClientError()`, `isServerError()`, `isRetryableError()`
  - Utility helpers: `formatBytes()`, `sleep()` for retry logic
- Error codes come from `ERROR_CODES` enum: `createErrorResponse(..., 'NOTE_NOT_FOUND')`
- Try-catch blocks with specific error handling:
  ```typescript
  try {
    // operation
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Note not found: ${notePath}`);
    }
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied: ${notePath}`);
    }
    throw error;
  }
  ```
- Zod validation errors caught separately: `if (error.name === 'ZodError')` in `src/index.ts` line 78

## Logging

**Framework:** Pino logger with pretty printing in development

**Configuration:** `src/utils/logger.ts`
- Environment-based log level: `LOG_LEVEL` env var defaults to `'info'`
- Pretty printing enabled for non-production: `process.env.NODE_ENV !== 'production'`
- Redaction configured for sensitive fields: `Authorization`, `api_key`, `apiKey`, vault API keys
- Child loggers created with context: `createLogger({ module: 'test', requestId: '123' })`

**Patterns:**
- Structured logging with data objects: `logger.info({ userId: '123', action: 'test' }, 'User action performed')`
- Error logging includes error object: `logger.error({ error, input }, 'Failed to read note')`
- Debug logs for fine-grained tracing: `logger.debug({ path: notePath, size: stats.size }, 'Note read from filesystem')`
- Warning logs for security issues: `logger.warn({ path: inputPath }, 'Path traversal attempt detected')`

## Comments

**When to Comment:**
- JSDoc comments for exported functions and types:
  ```typescript
  /**
   * Read note from filesystem
   */
  export async function readNote(vaultPath: string, notePath: string): Promise<Note>
  ```
- Inline comments for non-obvious logic:
  ```typescript
  // On Windows, ensure both paths use the same format for comparison
  if (process.platform === 'win32') {
    resolved = resolved.replace(/\\/g, '/');
  }
  ```
- No comments for obvious code:
  ```typescript
  // Bad: Return true if error is auth error - obvious from function name
  // Good: No comment needed, function is self-documenting
  ```

**JSDoc/TSDoc:**
- Single-line JSDoc for simple functions: `/** Detect the current platform */`
- Multi-line JSDoc for complex functions with parameter descriptions
- Describe module purpose at top of file: `/** Obsidian MCP Server */`

## Function Design

**Size:**
- Most functions 20-50 lines of code
- Handler functions typically 30-60 lines with error handling and logging
- Helper utilities 5-20 lines
- Larger functions (100+ lines) broken into smaller helper functions

**Parameters:**
- Use object destructuring for input parameters: `input: ReadNoteInput` where ReadNoteInput is a Zod schema type
- Multiple parameters consolidated into configuration objects: `vault: VaultConfig` rather than multiple vault properties
- Optional parameters marked in types: `vault?: string`

**Return Values:**
- Async functions return Promises: `Promise<ToolResponse>`, `Promise<Note>`, `Promise<void>`
- Union types for flexible returns: `VaultConfig | undefined`
- Structured responses with content and isError: `{ content: [], isError?: true }`

## Module Design

**Exports:**
- Named exports preferred: `export function readNote()`, `export const logger`
- Default exports only for configuration objects: Not used in this codebase
- Index files re-export for barrel pattern: `src/tools/index.ts`, `src/types/index.ts`

**Barrel Files:**
- `src/types/index.ts`: Exports all type definitions
- `src/utils/index.ts`: Not observed - utilities imported directly
- `src/tools/index.ts`: Exports tool handlers and definitions

**Directory Organization by Feature:**
- `src/filesystem/`: File I/O operations (reader, writer, parser, watcher)
- `src/obsidian/`: Obsidian API client integration
- `src/platform/`: Platform detection and utilities
- `src/tools/`: Tool definitions, handlers, and schemas
- `src/utils/`: Cross-cutting concerns (logger, errors, validators, rate-limiter)
- `src/config/`: Configuration loading and management

---

*Convention analysis: 2026-02-26*
