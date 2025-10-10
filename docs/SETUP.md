# Setup Guide

Complete setup instructions for Obsidian MCP Server on Windows and WSL.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [MCP Client Setup](#mcp-client-setup)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

1. **Node.js 18+**
   - Windows: Download from [nodejs.org](https://nodejs.org/)
   - WSL: Install via nvm or apt
     ```bash
     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
     nvm install 18
     nvm use 18
     ```

2. **Obsidian**
   - Download from [obsidian.md](https://obsidian.md/)
   - Install the **Local REST API** community plugin
   - Enable the plugin and note your API key

3. **MCP Client** (one of):
   - Claude Desktop
   - Cursor
   - Windsurf
   - Zed

### Verify Prerequisites

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm
npm --version
```

## Installation

### Step 1: Download/Clone Repository

```bash
# Option 1: Clone with git
git clone https://github.com/your-repo/obsidian-mcp-server.git
cd obsidian-mcp-server

# Option 2: Download and extract zip
# Then navigate to the directory
cd obsidian-mcp-server
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required dependencies (~600 packages).

### Step 3: Build the Project

```bash
npm run build
```

You should see output like:
```
CLI Building entry: src/index.ts
CLI Using tsconfig: tsconfig.json
CLI tsup v8.0.0
CLI Target: node18
CLI Cleaning output folder
✓ Built in 3.2s
```

## Configuration

### Step 1: Create Configuration Directory

**Windows (PowerShell):**
```powershell
mkdir $env:USERPROFILE\.obsidian-mcp
```

**WSL/Linux/Mac:**
```bash
mkdir -p ~/.obsidian-mcp
```

### Step 2: Create Configuration File

Create `~/.obsidian-mcp/config.json`:

**For Windows:**
```json
{
  "version": "1.0",
  "vaults": [
    {
      "name": "Recipe",
      "path": "D:\\obsidian\\Obsidian\\Recipe",
      "default": true,
      "obsidian_api": {
        "enabled": true,
        "url": "https://127.0.0.1:27124",
        "api_key": "${OBSIDIAN_API_KEY}",
        "verify_ssl": false
      },
      "daily_notes": {
        "folder": "daily",
        "date_format": "YYYY-MM-DD"
      }
    }
  ]
}
```

**For WSL:**
```json
{
  "version": "1.0",
  "vaults": [
    {
      "name": "Recipe",
      "path": "/mnt/d/obsidian/Obsidian/Recipe",
      "default": true,
      "obsidian_api": {
        "enabled": true,
        "url": "https://127.0.0.1:27124",
        "api_key": "${OBSIDIAN_API_KEY}",
        "verify_ssl": false
      },
      "daily_notes": {
        "folder": "daily",
        "date_format": "YYYY-MM-DD"
      }
    }
  ]
}
```

**Note**: The configuration uses `"D:\\obsidian\\Obsidian\\Recipe"` as provided by the user. Update `path` to match your vault location.

### Step 3: Set Environment Variables

Create `.env` file in the project root:

```bash
# Your API key from Obsidian
OBSIDIAN_API_KEY=80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9

# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Optional settings
FILE_WATCHING_ENABLED=true
RATE_LIMITING_ENABLED=true
```

**Important**: Replace with your actual API key from Obsidian:
1. Open Obsidian
2. Go to Settings → Community Plugins
3. Find "Local REST API"
4. Copy the API key

### Step 4: Test the Server

```bash
node dist/index.js
```

Expected output:
```
[10:30:00] INFO: Platform detected
    platform: "win32"
    isWindows: true
    isWSL: false
[10:30:00] INFO: Configuration loaded
    vaults: 1
[10:30:00] INFO: Obsidian MCP Server started successfully
```

Press `Ctrl+C` to stop.

## MCP Client Setup

### Claude Desktop

#### Windows

1. **Locate config file**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Edit the file** (create if doesn't exist):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["D:\\path\\to\\obsidian-mcp-server\\dist\\index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "80ddb28a16d171dd45ae2d5a1addff596044f3119d601b1b178b8c085f412fa9",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Critical**: Replace `D:\\path\\to\\obsidian-mcp-server` with the actual absolute path to your installation.

3. **Completely restart Claude Desktop** (not just reload)

#### macOS

1. **Locate config file**: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. **Edit the file**:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-mcp-server/dist/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

3. **Restart Claude Desktop**

### Cursor

1. **Create/edit**: `.cursor/mcp.json` in your project

2. **Add configuration**:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-mcp-server/dist/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

3. **Restart Cursor**

### Windsurf

Similar to Cursor - see Windsurf documentation for MCP configuration location.

### Zed

1. **Edit settings**: `~/.config/zed/settings.json`

2. **Add MCP configuration** (see Zed documentation for exact format)

## Testing

### Test 1: List Notes

In your MCP client (e.g., Claude Desktop):

```
Can you list all the notes in my Obsidian vault?
```

Expected: List of notes from your Recipe vault.

### Test 2: Read a Note

```
Can you read the note at "path/to/note.md" from my vault?
```

Expected: Full note content with frontmatter.

### Test 3: Create a Note

```
Create a new note called "test-note.md" with the content "This is a test"
```

Expected: Note created successfully, visible in Obsidian.

### Test 4: Search Notes

```
Search my vault for "recipe"
```

Expected: List of notes containing "recipe".

## Troubleshooting

### Server Won't Start

**Problem**: `node dist/index.js` shows errors

**Solutions**:
1. Rebuild: `npm run build`
2. Reinstall: `rm -rf node_modules && npm install`
3. Check Node version: `node --version` (must be 18+)

### "Configuration file not found"

**Problem**: Server can't find config

**Solutions**:
1. Check config exists: `cat ~/.obsidian-mcp/config.json` (WSL/Mac) or `type %USERPROFILE%\.obsidian-mcp\config.json` (Windows)
2. Check JSON syntax (use a JSON validator)
3. Set `CONFIG_PATH` environment variable to absolute path

### "API unavailable"

**Problem**: Server can't connect to Obsidian

**Solutions**:
1. Ensure Obsidian is running
2. Check Local REST API plugin is enabled
3. Verify API key is correct
4. Test manually:
   ```bash
   curl -k -H "Authorization: Bearer YOUR_API_KEY" https://127.0.0.1:27124/vault/
   ```

### Claude Desktop Doesn't Show Tools

**Problem**: Tools not appearing in Claude

**Solutions**:
1. Check Claude logs: `%LOCALAPPDATA%\Claude\logs\` (Windows) or `~/Library/Logs/Claude/` (Mac)
2. Verify absolute path in config
3. **Completely restart Claude Desktop** (quit and reopen, not just reload)
4. Check server starts successfully when run manually

### Path Issues (WSL)

**Problem**: "File not found" errors in WSL

**Solutions**:
1. Use WSL path format: `/mnt/c/...` for Windows drives
2. Or use Linux path: `/home/...` (recommended for performance)
3. Test path conversion:
   ```bash
   wslpath -w /mnt/c/Users/username/vault
   ```

## Advanced Configuration

### Multiple Vaults

```json
{
  "version": "1.0",
  "vaults": [
    {
      "name": "Personal",
      "path": "C:\\Users\\username\\PersonalVault",
      "default": true,
      "obsidian_api": { ... }
    },
    {
      "name": "Work",
      "path": "C:\\Users\\username\\WorkVault",
      "default": false,
      "obsidian_api": { ... }
    }
  ]
}
```

### Custom Daily Notes

```json
{
  "daily_notes": {
    "folder": "journal/daily",
    "date_format": "YYYY/MM/DD",
    "template": "templates/daily.md"
  }
}
```

### Disable Features

```json
{
  "file_watching": {
    "enabled": false
  },
  "rate_limiting": {
    "enabled": false
  }
}
```

## Next Steps

1. ✅ **Read**: [API_REFERENCE.md](./API_REFERENCE.md) - Learn all available tools
2. ✅ **Read**: [DATA_SAFETY.md](./DATA_SAFETY.md) - Set up backups
3. ✅ **Try**: Example workflows in [EXAMPLES.md](./EXAMPLES.md)
4. ✅ **Customize**: Adjust configuration for your needs

## Getting Help

- **Troubleshooting**: See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Issues**: Check server logs and Claude logs
- **Support**: GitHub Issues

---

**Setup complete! 🎉 Your Obsidian MCP Server is ready to use.**
