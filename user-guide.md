# Obsidian MCP Server User Guide

## Windows Workflow

1. **Open PowerShell** and set the working directory:
   ```powershell
   Set-Location 'D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server'
   ```
2. **Install dependencies** (only needed on first setup or after package updates):
   ```powershell
   npm install
   ```
3. **Build the server**:
   ```powershell
   npm run build
   ```
4. **Set environment variables for this session**:
   ```powershell
   $env:CONFIG_PATH = 'D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server\config.json'
   $env:OBSIDIAN_API_KEY = <'api-key'>
   $env:NODE_ENV = 'production'
   $env:LOG_LEVEL = 'silent'
   ```
5. **Launch the MCP server**:
   ```powershell
   node .\dist\index.js
   ```
   Leave this window running while testing tools.

### MCP client JSON (Windows)
```json
"obsidian-server": {
  "type": "stdio",
  "command": "node",
  "args": [
    "d:/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/dist/index.js"
  ],
  "env": {
    "CONFIG_PATH": "d:/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json",
    "OBSIDIAN_API_KEY": <'api-key'>
    "NODE_ENV": "production",
    "LOG_LEVEL": "silent"
  }
}
```

## WSL Workflow

1. **Open WSL terminal** and change to the project directory:
   ```bash
   cd /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server
   ```
2. **Install Linux dependencies** (run once, or when modules change):
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. **Build the server**:
   ```bash
   npm run build
   ```
4. **Export environment variables** in the same shell:
   ```bash
   export CONFIG_PATH=/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json
   export OBSIDIAN_API_KEY=<'api-key'>
   export NODE_ENV=production
  **This is crucial:** always run `npm run build` inside WSL after removing `node_modules` so the Linux build of Rollup is available.
- `open_in_obsidian` on WSL relies on `wslview` or `xdg-open`. Install `wslu` (`sudo apt install wslu`) if not present. If both commands are missing, the fallback still uses `cmd.exe` with the Windows protocol handler (requires Obsidian open on the host).
- For vault-only launches on WSL, the current implementation still expects a native Obsidian executable. Future enhancement: add a URI fallback in `openInObsidian()` when `findObsidianExecutable()` returns `null`.


  "obsidian-server": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/dist/index.js"
      ],
      "env": {
        "CONFIG_PATH": "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json",
        "OBSIDIAN_API_KEY": <'api-key'>
        "NODE_ENV": "production",
        "LOG_LEVEL": "silent"
      }
    },


Refer to `docs/TEST_RESULTS_PHASE2.md` for detailed validation outcomes on both Windows and WSL.
