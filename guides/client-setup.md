# Obsidian MCP Client Setup (Windows & WSL)

This guide explains how to connect the Obsidian MCP server to popular MCP clients and IDEs across Windows and WSL, including dual vault configuration, startup scripts, and the `claude mcp add` command.

---

## Table of Contents
1. [Dual Vault Configuration (Windows + WSL)](#dual-vault-configuration-windows--wsl)
2. [Starting the MCP Server](#starting-the-mcp-server)
3. [Claude Code Setup](#claude-code-setup)
4. [Claude Desktop Setup](#claude-desktop-setup)
5. [Other Clients (Cursor, Windsurf, Zed)](#other-clients)
6. [Troubleshooting](#troubleshooting)

---

## Dual Vault Configuration (Windows + WSL)

The `config.json` supports multiple vaults, allowing you to work seamlessly across Windows and WSL environments pointing to the same physical vault.

### Example config.json with Dual Vaults

```json
{
  "version": "1.0",
  "vaults": [
    {
      "name": "recipes-windows",
      "path": "D:\\obsidian\\Obsidian\\Recipe",
      "default": true,
      "obsidian_api": {
        "enabled": true,
        "url": "http://127.0.0.1:27123",
        "verify_ssl": false,
        "api_key": "${OBSIDIAN_API_KEY}"
      }
    },
    {
      "name": "recipes-wsl",
      "path": "/mnt/d/obsidian/Obsidian/Recipe",
      "default": false,
      "obsidian_api": {
        "enabled": true,
        "url": "http://127.0.0.1:27123",
        "verify_ssl": false,
        "api_key": "${OBSIDIAN_API_KEY}"
      }
    }
  ]
}
```

**Key Points:**
- Both vaults point to the **same physical location** but use different path formats
- `recipes-windows` uses Windows backslash paths (default when running from Windows)
- `recipes-wsl` uses WSL forward slash paths (use when running from WSL)
- Set `default: true` on the vault you use most often
- MCP tools can specify which vault to use via the `vault` parameter
- The `${OBSIDIAN_API_KEY}` placeholder gets replaced by the environment variable

**Path Mapping:**
```text
Windows:  D:\obsidian\Obsidian\Recipe
WSL:      /mnt/d/obsidian/Obsidian/Recipe
          └── Same physical files, different path format
```

---

## Starting the MCP Server

### Windows PowerShell Script

Save this as `start-server.ps1` in the server directory:

```powershell
# Start Obsidian MCP Server (Windows)
# Location: D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server

# 1. Change into the server directory
Set-Location 'D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server'

# 2. Ensure the latest build artifacts exist
npm run build

# 3. Set required environment variables for this session
$env:CONFIG_PATH = 'D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server\config.json'
$env:OBSIDIAN_API_KEY = '80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9'
$env:NODE_ENV = 'production'
$env:LOG_LEVEL = 'silent'

# 4. Verify that variables are set correctly
Write-Host "Environment Variables:"
Write-Host "  CONFIG_PATH: $env:CONFIG_PATH"
Write-Host "  OBSIDIAN_API_KEY: $($env:OBSIDIAN_API_KEY.Substring(0,8))..."
Write-Host "  NODE_ENV: $env:NODE_ENV"
Write-Host "  LOG_LEVEL: $env:LOG_LEVEL"

# 5. Start the MCP server
Write-Host "`nStarting MCP server..."
node .\start-server.mjs
```

**Run it:**
```powershell
.\start-server.ps1
```

---

### WSL Bash Script

Save this as `start-server.sh` in the server directory:

```bash
#!/bin/bash
# Start Obsidian MCP Server (WSL)
# Location: /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server

# 1. Change into the server directory
cd /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server

# 2. Ensure the latest build artifacts exist
npm run build

# 3. Set required environment variables for this session
export CONFIG_PATH=/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json
export OBSIDIAN_API_KEY=80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9
export NODE_ENV=production
export LOG_LEVEL=silent

# 4. Verify that variables are set correctly
echo "Environment Variables:"
echo "  CONFIG_PATH: $CONFIG_PATH"
echo "  OBSIDIAN_API_KEY: ${OBSIDIAN_API_KEY:0:8}..."
echo "  NODE_ENV: $NODE_ENV"
echo "  LOG_LEVEL: $LOG_LEVEL"

# 5. Start the MCP server
echo -e "\nStarting MCP server..."
node ./start-server.mjs
```

**Make it executable and run:**
```bash
chmod +x start-server.sh
./start-server.sh
```

---

### Running in Background (Optional)

**Windows (PowerShell):**
```powershell
Start-Process powershell -ArgumentList "-File start-server.ps1" -WindowStyle Hidden
```

**WSL (Bash):**
```bash
nohup ./start-server.sh > /dev/null 2>&1 &
echo $! > server.pid  # Save PID for later
```

**Stop background server:**
```bash
kill $(cat server.pid)
```

---

## Claude Code Setup

### Method 1: Using `claude mcp add` Command

Claude Code provides a convenient CLI command to add MCP servers.

#### Workspace Scope (Current Project Only)
```bash
claude mcp add obsidian-server node \
  /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/dist/index.js
```

#### User Scope (Global - All Projects)
```bash
claude mcp add --scope user obsidian-server node \
  /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/dist/index.js
```

**Notes:**
- This creates/updates `.claude/code/mcp.config.json` (workspace) or global config (user)
- You'll still need to set environment variables (see Method 2)
- Use `dist/index.js` for direct execution or `start-server.mjs` for wrapper script

---

### Method 2: Manual `.mcp.json` Configuration

Create `.claude/code/mcp.config.json` in your workspace root:

#### Option A: Using start-server.mjs (Recommended)
```json
{
  "servers": {
    "obsidian-server": {
      "command": "node",
      "args": [
        "${workspaceFolder}/code_artifacts/obsidian-mcp-server/start-server.mjs"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "silent",
        "CONFIG_PATH": "${workspaceFolder}/code_artifacts/obsidian-mcp-server/config.json",
        "OBSIDIAN_API_KEY": "${env:OBSIDIAN_API_KEY}"
      },
      "cwd": "${workspaceFolder}/code_artifacts/obsidian-mcp-server"
    }
  }
}
```

#### Option B: Using dist/index.js (Direct)
```json
{
  "servers": {
    "obsidian-server": {
      "command": "node",
      "args": [
        "${workspaceFolder}/code_artifacts/obsidian-mcp-server/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "silent",
        "CONFIG_PATH": "${workspaceFolder}/code_artifacts/obsidian-mcp-server/config.json",
        "OBSIDIAN_API_KEY": "${env:OBSIDIAN_API_KEY}"
      },
      "cwd": "${workspaceFolder}/code_artifacts/obsidian-mcp-server"
    }
  }
}
```

**Set the environment variable:**

**Windows:**
```powershell
$env:OBSIDIAN_API_KEY = "80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9"
```

**WSL/Linux:**
```bash
export OBSIDIAN_API_KEY="80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9"
```

**Or add to your shell profile** (`~/.bashrc` or `~/.zshrc`):
```bash
echo 'export OBSIDIAN_API_KEY="your-key-here"' >> ~/.bashrc
source ~/.bashrc
```

---

## Claude Desktop Setup

**Config file location:** `%APPDATA%\Anthropic\Claude\mcp_config.json`

```json
{
  "mcpServers": {
    "obsidian-server": {
      "command": "node",
      "args": [
        "D:\\dev\\obsidian-mcp-2\\code_artifacts\\obsidian-mcp-server\\start-server.mjs"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "silent",
        "CONFIG_PATH": "D:\\dev\\obsidian-mcp-2\\code_artifacts\\obsidian-mcp-server\\config.json",
        "OBSIDIAN_API_KEY": "80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9"
      }
    }
  }
}
```

**Important:**
- Use double backslashes (`\\`) for Windows paths in JSON
- Restart Claude Desktop after editing the config
- **Security:** Keep your API key secure; don't commit it to version control

---

## Other Clients

### Cursor IDE

**Config file:** `%APPDATA%\Cursor\mcp\servers.json`

```json
{
  "obsidian-server": {
    "command": "node",
    "args": [
      "D:\\dev\\obsidian-mcp-2\\code_artifacts\\obsidian-mcp-server\\start-server.mjs"
    ],
    "env": {
      "NODE_ENV": "production",
      "LOG_LEVEL": "silent",
      "CONFIG_PATH": "D:\\dev\\obsidian-mcp-2\\code_artifacts\\obsidian-mcp-server\\config.json",
      "OBSIDIAN_API_KEY": "80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9"
    }
  }
}
```

Cursor automatically restarts servers when the config changes.

---

### Windsurf

**Config file:** `%APPDATA%\Windsurf\mcp_config.json`

Same structure as Claude Desktop. Ensure `LOG_LEVEL=silent` to avoid noisy panels.

---

### Zed Editor

**Config file:**
- **Windows:** `%APPDATA%\Zed\mcp\servers.json`
- **Linux/WSL:** `~/.config/zed/mcp/servers.json`

**WSL Example:**
```json
{
  "obsidian-server": {
    "command": "node",
    "args": [
      "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/start-server.mjs"
    ],
    "env": {
      "NODE_ENV": "production",
      "LOG_LEVEL": "silent",
      "CONFIG_PATH": "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json",
      "OBSIDIAN_API_KEY": "80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9"
    },
    "workingDirectory": "/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server"
  }
}
```

---

## Troubleshooting

### Server Not Picking Up Config Changes

**Problem:** Updated `config.json` but still seeing old vault paths or settings.

**Solution:** The MCP server caches configuration on startup. You must restart it:
1. Stop the running server (Ctrl+C in terminal, or kill the process)
2. Restart using your startup script or client
3. For Claude Desktop/Cursor: Restart the entire application

---

### Path Validation Errors

**Error:** `"Invalid path: resolved path is outside vault boundary"`

**Causes:**
1. **Wrong vault selected:** Using Windows paths in WSL or vice versa
2. **Case sensitivity:** WSL is case-sensitive; ensure `Recipe` vs `recipe` matches
3. **Config not loaded:** Server using default config instead of your `config.json`

**Solutions:**
1. Explicitly specify vault in tool calls: `"vault": "recipes-wsl"` or `"vault": "recipes-windows"`
2. Check that `CONFIG_PATH` environment variable is set correctly
3. Verify vault path exists: `ls /mnt/d/obsidian/Obsidian/Recipe` (WSL) or `dir D:\obsidian\Obsidian\Recipe` (Windows)

---

### No Notes Found in Vault

**Problem:** `get_vault_stats` returns 0 notes, but you know there are files.

**Causes:**
1. Wrong vault path in config
2. Permission issues
3. Server running from wrong environment (Windows vs WSL)

**Verify the vault:**
```bash
# WSL
find /mnt/d/obsidian/Obsidian/Recipe -name "*.md" -type f | wc -l

# Windows PowerShell
(Get-ChildItem -Path "D:\obsidian\Obsidian\Recipe" -Filter *.md -Recurse).Count
```

**Solution:**
- Update `config.json` with the correct path
- Ensure the vault in use matches your environment (use `recipes-wsl` when in WSL)
- Restart the server after config changes

---

### Environment Variables Not Working

**Problem:** `${OBSIDIAN_API_KEY}` not being replaced, or `CONFIG_PATH` not found.

**Solutions:**

**For terminal/shell:**
```bash
# Verify variables are set
echo $CONFIG_PATH
echo $OBSIDIAN_API_KEY

# If not set, export them
export OBSIDIAN_API_KEY="your-key"
export CONFIG_PATH="/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/config.json"
```

**For Claude Code:**
- Use `${env:VARIABLE_NAME}` syntax in `.mcp.json`
- Set variables in your shell profile before starting VS Code
- Or hardcode values in the config (less secure)

**For Claude Desktop:**
- Must hardcode values in `mcp_config.json` (desktop app doesn't inherit shell environment)
- Store securely and don't commit to version control

---

### Which Vault Am I Using?

**Check via MCP tool:**
```json
// Call get_vault_stats without specifying vault
// Returns the default vault info
{
  "vault": "recipes-windows",  // ← Shows which vault is active
  "note_count": 45,
  ...
}
```

**Change default vault:**
Edit `config.json` and set `"default": true` on the vault you want to use.

---

### WSL-Specific Issues

**Obsidian REST API Connection:**
- Obsidian runs on Windows, API listens on `127.0.0.1:27123`
- WSL can access Windows localhost automatically (no special config needed)
- If connection fails, check Windows Firewall settings

**File Permissions:**
- Files on `/mnt/d` may have odd permissions from Windows
- Usually not an issue for reading, but watch for write errors
- MCP server needs read access to vault, write access for creating/editing notes

**Case Sensitivity:**
- Windows is case-insensitive: `Recipe` = `recipe`
- WSL is case-sensitive: `Recipe` ≠ `recipe`
- Ensure your paths match the exact casing of folders/files

---

## Windows vs WSL Quick Reference

| Aspect | Windows | WSL |
|--------|---------|-----|
| **Path format** | `D:\obsidian\Obsidian\Recipe` | `/mnt/d/obsidian/Obsidian/Recipe` |
| **Path separator** | Backslash `\` | Forward slash `/` |
| **Set env var** | `$env:VAR = "value"` | `export VAR="value"` |
| **Config JSON escaping** | `"D:\\obsidian\\Obsidian\\Recipe"` | `"/mnt/d/obsidian/Obsidian/Recipe"` |
| **Case sensitivity** | No | Yes |
| **Vault to use** | `recipes-windows` | `recipes-wsl` |
| **Script extension** | `.ps1` (PowerShell) | `.sh` (Bash) |

---

## Security Best Practices

1. **API Keys:** Store in environment variables, not in version control
2. **Use .env files:** For local development, create `.env` in server directory:
   ```bash
   OBSIDIAN_API_KEY=your-key-here
   CONFIG_PATH=/path/to/config.json
   ```
3. **Gitignore:** Ensure `.env`, `config.json`, and any files with keys are in `.gitignore`
4. **Local API only:** Keep `verify_ssl: false` only for local Obsidian REST API (localhost)

---

## Next Steps

1. **Test your setup:** Use the MCP Inspector to verify tools are working
   ```bash
   npx @modelcontextprotocol/inspector node dist/index.js
   ```

2. **Check logs:** If issues occur, remove `LOG_LEVEL=silent` to see detailed output

3. **Explore tools:** Try `get_vault_stats`, `list_notes`, and `read_note` to verify connectivity

4. **Read other guides:**
   - `guides/terminal-commands.md` - Command reference and examples
   - `guides/logging-behavior.md` - Understanding log levels and output

---

## Support

- **Issues:** Report at [GitHub Issues](https://github.com/YOUR_USERNAME/obsidian-mcp-server/issues)
- **Docs:** See `README.md` and other guides in `guides/` folder
- **MCP Protocol:** <https://modelcontextprotocol.io/>
