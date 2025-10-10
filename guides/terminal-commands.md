# Obsidian MCP Server Terminal Commands

This reference collects common PowerShell commands for running the Obsidian MCP server on Windows. Adjust paths if your checkout differs.

> **Note**: Commands assume the repository lives at `D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server\`. Replace this with your actual installation directory throughout.

## Environment Preparation
- **Set required variables (per session)**
  ```powershell
  $env:CONFIG_PATH = "D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server\config.json"
  $env:OBSIDIAN_API_KEY = "<your key>"
  ```
- **Optional logging controls**
  ```powershell
  $env:NODE_ENV = "production"
  $env:LOG_LEVEL = "silent"   # prevents STDOUT noise in MCP clients
  ```
- **Verify values**
  ```powershell
  Get-ChildItem env:CONFIG_PATH, env:OBSIDIAN_API_KEY, env:NODE_ENV, env:LOG_LEVEL
  ```

## Installation & Build
- **Install dependencies (pnpm)**
  ```powershell
  pnpm --dir D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server install
  ```
- **Build TypeScript into `dist/`**
  ```powershell
  pnpm --dir D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server run build
  ```

## Server Startup Options
- **Standard launch with STDOUT suppressed**
  ```powershell
  node D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server\start-server.mjs 1>$null
  ```
- **Capture errors to a log while keeping STDOUT quiet**
  ```powershell
  node D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server\start-server.mjs 1>$null 2>server-errors.log
  ```
- **Debug mode (shows full logs, may break MCP clients)**
  ```powershell
  Remove-Item Env:LOG_LEVEL
  node D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server\start-server.mjs
  ```

## Shutdown & Cleanup
- **Stop server**: press `Ctrl+C` in the server window.
- **Clear environment variables** (optional)
  ```powershell
  Remove-Item Env:CONFIG_PATH
  Remove-Item Env:OBSIDIAN_API_KEY
  Remove-Item Env:NODE_ENV
  Remove-Item Env:LOG_LEVEL
  ```

## WSL Variant
Run the server inside WSL (Ubuntu) with equivalent exports:
```bash
export CONFIG_PATH="/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json"
export OBSIDIAN_API_KEY="<your key>"
export NODE_ENV=production
export LOG_LEVEL=silent
node /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/start-server.mjs >/dev/null
```

## Portability Notes
- `start-server.mjs` injects `createRequire` to support bundled dependencies; use it instead of `node dist/index.js` directly.
- MCP clients expect STDOUT to carry JSON-RPC only; redirect or silence logs whenever running under Claude Desktop, Cursor, Windsurf, or similar.
- Store API keys securely; do not hard-code them in scripts checked into source control.
- For long-lived setups, prefer `.env` files kept out of version control or your OS keychain / secrets manager instead of exporting keys manually.
