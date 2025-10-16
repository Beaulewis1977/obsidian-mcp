# Phase 2 Validation Results

## Environment

- **Host**: Windows 11 (PowerShell session)
- **Obsidian vault**: `Obsidian` (path `D:\obsidian\Obsidian\Recipe`)
- **Server branch**: `phase2/hardening`
- **Server startup**:
  - `npm run build`
  - `node .\start-server.mjs`
  - Env: `CONFIG_PATH`, `OBSIDIAN_API_KEY`, `NODE_ENV=production`, `LOG_LEVEL=silent`
- **Obsidian REST API**: Enabled (http://127.0.0.1:27123)
- **Obsidian desktop**: Running with URI core plugin enabled

## Test Matrix (Windows Native)

| Tool | Scenario | Result | Notes |
|------|----------|--------|-------|
| `list_notes` | API available | ✅ Pass | Returned expected directory listing. |
| `read_note` | API available | ✅ Pass | Delivered Markdown + frontmatter. |
| `search_notes` | API mode (`mode=obsidian`) | ✅ Pass | Response includes `api_metadata` with duration/status. |
| `create_note` | API available | ✅ Pass | `method="api"`, warning absent, metadata logged. |
| `edit_note` | Append/replace modes | ✅ Pass | API path succeeded; fallback not triggered. |
| `delete_note` | API available | ✅ Pass | API deletion succeeded; warning returned about irreversibility. |
| `move_note` | Filesystem operation | ✅ Pass | Warned about wikilinks as expected. |
| `update_frontmatter` | Filesystem (no API endpoint) | ✅ Pass | Frontmatter merged successfully. |
| `get_daily_note` | Create-if-missing | ✅ Pass | Note created with default template. |
| `get_backlinks` | Filesystem scan | ✅ Pass | Returned backlinks array. |
| `get_vault_stats` | Filesystem scan | ✅ Pass | Produced counts for notes/tags/links. |
| `create_folder` | Filesystem | ✅ Pass | Folder created in vault path. |
| `open_in_obsidian` | URI launch | ✅ Pass | `method="uri"`, note opened in Obsidian UI. |

## Test Matrix (WSL / Linux Session)

Environment: WSL2 (Ubuntu), same vault mounted at `/mnt/d/obsidian/Obsidian/Recipe`, server launched via `node dist/index.js` with `CONFIG_PATH` pointing to the shared `config.json`.

| Tool | Scenario | Result | Notes |
|------|----------|--------|-------|
| `list_notes` | API available | ✅ Pass | Enumerated 47 notes (post-test). |
| `search_notes` | API mode | ✅ Pass | Returned 19 matches for "test" with API metadata. |
| `read_note` | API available | ✅ Pass | Fetched `MASTER-BUILD-PLAN.md` content. |
| `create_note` | API available | ✅ Pass | Created WSL test note via API. |
| `edit_note` | Append mode | ✅ Pass | Appended content to existing note. |
| `move_note` | Filesystem | ✅ Pass | Moved test note into `MCP Test Folder`. |
| `create_folder` | Filesystem | ✅ Pass | Created `MCP Test Folder`. |
| `update_frontmatter` | Filesystem | ✅ Pass | Frontmatter merge succeeded. |
| `get_daily_note` | Create-if-missing | ✅ Pass | Returned today's note. |
| `get_backlinks` | Filesystem | ✅ Pass | Reported backlink counts. |
| `get_vault_stats` | Filesystem | ✅ Pass | Reflected updated counts. |
| `open_in_obsidian` | URI launch | ⚠️ Expected failure | `powershell.exe` not available inside WSL; feature supported only on Windows host. |

## MCP Configuration Snippets

Example entries for `.claude.json`, Cursor AI, or other MCP clients to reference the built server:

### Windows host

```json
"obsidian-server": {
  "type": "stdio",
  "command": "node",
  "args": [
    "d:/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/dist/index.js"
  ],
  "env": {
    "CONFIG_PATH": "d:/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json",
    "OBSIDIAN_API_KEY": "<your-api-key>",
    "NODE_ENV": "production",
    "LOG_LEVEL": "silent"
  }
}
```

### WSL / Linux session

```json
"obsidian-server": {
  "type": "stdio",
  "command": "node",
  "args": [
    "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/dist/index.js"
  ],
  "env": {
    "CONFIG_PATH": "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json",
    "OBSIDIAN_API_KEY": "<your-api-key>",
    "NODE_ENV": "production",
    "LOG_LEVEL": "silent"
  }
}
```

## Additional Observations

- API-first tools (`create_note`, `edit_note`, `delete_note`, `search_notes`) now return `api_metadata` (status, duration) in responses for traceability.
- `open_in_obsidian` required the vault name in `config.json` to match the Obsidian-registered name (`Obsidian`). After updating and rebuilding, the tool succeeded.
- WSL run validates all core tools; `open_in_obsidian` remains Windows-only until a Linux launcher is added.

## Next Steps

- Repeat matrix for **Windows + API disabled** (verify filesystem fallback warnings and metadata).
- Execute matrix under **WSL / Linux path** configuration (`Obsidian-wsl`) once Obsidian is accessible from that environment.
- Archive raw transcripts/logs from MCP inspector runs for reference if automation is added.
