# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**Obsidian REST API:**
- Service: Obsidian (local application)
- What it's used for: Direct vault manipulation (create, edit, delete notes)
- SDK/Client: Custom `ObsidianAPIClient` class
- Auth: Bearer token via `api_key` in config
- Implementation: `src/obsidian/api-client.ts`
- Endpoints:
  - `PUT /vault/{path}` - Create or replace note
  - `POST /vault/{path}` - Append to note
  - `PATCH /vault/{path}` - Edit note with targeted insertion
  - `DELETE /vault/{path}` - Delete note
  - `POST /open/{path}` - Open note in Obsidian
  - `GET /search/?query=...` - Search vault
  - `GET /` - Availability check
- Timeout: Configurable, default 5000ms
- Retry Logic:
  - Max retries: 2 (configurable)
  - Exponential backoff: 1s initial, max 10s
  - No retry on auth/client errors
  - AbortSignal timeout support

**Optional AI APIs (Development/CodeRabbit):**
- OpenAI - For CodeRabbit AI reviews
  - Env var: `OPENAI_API_KEY`
- Anthropic - For Claude development
  - Env var: `ANTHROPIC_API_KEY`
- Google AI - For Gemini development
  - Env var: `GOOGLE_AI_API_KEY`
- CodeRabbit - AI code review integration
  - Webhook secret: `CODERABBIT_WEBHOOK_SECRET`
- Note: Not directly integrated into server core functionality

## Data Storage

**File Storage:**
- Primary: Local filesystem only
  - Vault path: Configured in `~/.obsidian-mcp/config.json` or `CONFIG_PATH`
  - Format: Markdown files (.md)
  - Access: Via `src/filesystem/vault-reader.ts` and `src/filesystem/vault-writer.ts`
  - File watching: Via chokidar (`src/filesystem/vault-watcher.ts`)

**No Database:**
- Server is stateless
- Configuration stored in JSON files
- No persistent data storage beyond file system

**Caching:**
- In-memory only
- Rate limiting state: Memory backend (default) or Redis backend
- API availability check: Cached in `ObsidianAPIClient` class

## Authentication & Identity

**Auth Provider:**
- Custom bearer token auth to Obsidian API
- Configuration:
  - `url`: Obsidian vault URL (localhost or remote)
  - `api_key`: Bearer token (required)
  - `verify_ssl`: SSL verification toggle (default: false)
- Implementation: `src/obsidian/api-client.ts`
- Token stored in config file or environment variable (`${ENV_VAR_NAME}` syntax supported)

**No External Auth Services:**
- No OAuth, SAML, or third-party identity providers
- Server assumes single user/vault access
- No user management built-in

## Monitoring & Observability

**Logging:**
- Framework: Pino (JSON logging)
- Levels: trace, debug, info, warn, error, fatal
- Configurable via: `LOG_LEVEL` environment variable (default: info)
- Transport: pino-pretty for development (colored, readable output)
- Redaction: Sensitive fields automatically redacted
  - Redacts: API keys, Authorization headers, all secrets in nested objects
  - Implementation: `src/utils/logger.ts`
- Output: Stdout (structured JSON or pretty-printed)

**Error Tracking:**
- No external service integration
- Errors logged to Pino with context
- Error codes defined: `src/types/index.ts` (ERROR_CODES object)
- Error types:
  - File operations (NOT_FOUND, ALREADY_EXISTS, etc.)
  - Configuration errors
  - API errors (UNAVAILABLE, AUTH_FAILED, TIMEOUT)
  - Validation errors (ZOD_ERROR)
  - Rate limit errors

**Vault File Monitoring:**
- Real-time file change detection
- Framework: chokidar
- Events: change, add, unlink (delete)
- Callback: Optional onChange handler
- Logging: File changes logged with path and event type
- Configuration: `FILE_WATCHING_ENABLED` (default: true)

## Rate Limiting & Resource Control

**Rate Limiting:**
- Framework: rate-limiter-flexible
- Backends: Memory (default) or Redis
- Tiers:
  1. Global: All requests (default: 1000 req/min, 10000 req/hour)
  2. Operation-type: Read vs write (default: 600/100 req/min)
  3. Tool-specific: Per-tool limits (e.g., edit_note: 30 req/min)
- Configuration: `src/utils/rate-limiter.ts`
- Environment vars: `RATE_LIMITING_*`
- Graceful degradation: Warn at 80% of limit, optional request queuing

**Redis Rate Limiting (Optional):**
- Connection: `RATE_LIMITING_REDIS_HOST`, `RATE_LIMITING_REDIS_PORT`, `RATE_LIMITING_REDIS_PASSWORD`
- Default: localhost:6379
- Status: Not yet fully implemented (throws error if Redis backend selected)

**Request Queuing:**
- Optional: `RATE_LIMITING_QUEUE_REQUESTS=true`
- Max queue size: `RATE_LIMITING_QUEUE_SIZE` (default: 100)
- Timeout: `RATE_LIMITING_QUEUE_TIMEOUT` (default: 30000ms)

## CI/CD & Deployment

**Hosting:**
- Deployment: Not specified (server runs on user's machine or server)
- Execution model: Stdio-based (Standard Input/Output)
- Output: Distribution-ready bundle in `dist/` directory

**Build Pipeline:**
- Build command: `npm run build`
- Output: `dist/index.js` (ESM)
- Entrypoint: `#!/usr/bin/env node` shebang in built file
- Executable: Can be run as `node dist/index.js` or installed globally

**Pre-commit Hooks:**
- Tool: husky
- Command: `npm run lint && npm test -- --run`
- Actions: Type check + test suite
- Git hooks: `.husky/` directory

**GitHub Integration:**
- CodeRabbit config: `.coderabbit.yaml` (AI code review tool)
- GitHub Actions: Presumed (`.github/` directory exists)
- License: MIT

## Environment Configuration

**Required Environment Variables:**
- None strictly required (all have defaults)

**Important Environment Variables:**
- `MCP_PORT` - Server port (default: 13800)
- `LOG_LEVEL` - Logging verbosity (default: info)
- `CONFIG_PATH` - Custom config file path
- `NODE_ENV` - Environment (production/development)

**Rate Limiting Configuration:**
- `RATE_LIMITING_ENABLED` (default: true)
- `RATE_LIMITING_BACKEND` - memory or redis (default: memory)
- `RATE_LIMITING_GLOBAL_RPM` / `RATE_LIMITING_GLOBAL_RPH`
- `RATE_LIMITING_READ_RPM` / `RATE_LIMITING_READ_RPH`
- `RATE_LIMITING_WRITE_RPM` / `RATE_LIMITING_WRITE_RPH`
- `RATE_LIMITING_QUEUE_REQUESTS` (default: false)
- `RATE_LIMITING_QUEUE_SIZE` (default: 100)
- `RATE_LIMITING_QUEUE_TIMEOUT` (default: 30000)

**Redis Configuration (if using Redis backend):**
- `RATE_LIMITING_REDIS_HOST` (default: localhost)
- `RATE_LIMITING_REDIS_PORT` (default: 6379)
- `RATE_LIMITING_REDIS_PASSWORD` (optional)

**File Watching Configuration:**
- `FILE_WATCHING_ENABLED` (default: true)
- `CHOKIDAR_USEPOLLING` - Force polling mode

**API Keys (Optional):**
- `OPENAI_API_KEY` - For CodeRabbit reviews
- `ANTHROPIC_API_KEY` - For Claude development
- `GOOGLE_AI_API_KEY` - For Gemini development
- `CODERABBIT_WEBHOOK_SECRET` - For webhook validation

**Vault Configuration:**
- `OBSIDIAN_VAULT_PATH` - Default vault path (if not in config.json)
- `OBSIDIAN_API_KEY` - API key for Obsidian REST API

**Secrets Storage:**
- `.env` file (not committed to git)
- Environment-specific variants: `.env.development`, `.env.production`
- Recommended: Use secret manager for production

## Webhooks & Callbacks

**Incoming:**
- CodeRabbit webhook (optional) - Receives code review feedback
- No other webhook endpoints implemented

**Outgoing:**
- None implemented
- File change notifications: Internal only (logged, not broadcast)
- MCP notifications: Code comments suggest potential future implementation

## External File Access

**Filesystem Paths:**
- Reads: Markdown files from configured vault path(s)
- Writes: Creates/modifies markdown files in vault
- Watches: Real-time file changes via chokidar
- Maximum file size: 10 MB (configurable)
- Warning threshold: 1 MB (configurable)

**Process Spawning:**
- Obsidian application launcher
- Platform-specific: Windows, macOS, Linux support
- WSL support: Special handling for Windows paths from WSL
- Executable detection: Searches system PATH and common locations

## Configuration File Structure

**Location:** `~/.obsidian-mcp/config.json` or custom via `CONFIG_PATH`

**Example structure:**
```json
{
  "version": "1.0",
  "vaults": [
    {
      "name": "main",
      "path": "/path/to/vault",
      "default": true,
      "obsidian_api": {
        "enabled": true,
        "url": "http://localhost:27123",
        "api_key": "your-api-key",
        "verify_ssl": false,
        "timeout": 5000,
        "fallback_to_filesystem": true,
        "retry": {
          "enabled": true,
          "max_retries": 2,
          "initial_delay": 1000,
          "max_delay": 10000
        }
      },
      "daily_notes": {
        "folder": "Daily Notes",
        "date_format": "YYYY-MM-DD",
        "template": "optional-template-path"
      }
    }
  ],
  "rate_limiting": {
    "enabled": true,
    "backend": "memory",
    "limits": {
      "global": { "requests_per_minute": 1000, "requests_per_hour": 10000 },
      "read": { "requests_per_minute": 600, "requests_per_hour": 6000 },
      "write": { "requests_per_minute": 100, "requests_per_hour": 1000 },
      "tools": {
        "edit_note": { "requests_per_minute": 30 },
        "delete_note": { "requests_per_minute": 20 }
      }
    },
    "graceful": {
      "warn_at_percentage": 80,
      "queue_requests": false,
      "max_queue_size": 100,
      "queue_timeout_ms": 30000
    }
  },
  "file_watching": {
    "enabled": true,
    "polling": { "interval": 1000, "binary_interval": 2000 },
    "stability_threshold": 2000
  },
  "limits": {
    "max_file_size": 10485760,
    "warning_threshold": 1048576
  },
  "features": {
    "backup_on_delete": false,
    "advisory_locking": false
  }
}
```

---

*Integration audit: 2026-02-26*
