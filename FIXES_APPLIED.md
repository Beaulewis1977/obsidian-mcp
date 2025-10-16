# Fixes Applied to Obsidian MCP Server

## Date: 2025-10-10

## Issues Found and Fixed

### 1. **Build Configuration Issue - Dynamic Require Error**
**Problem:** Server was failing with `Error: Dynamic require of "fs" is not supported`

**Root Cause:** The tsup bundler was trying to use ESM format but had `noExternal` configuration that was causing gray-matter and other dependencies to use dynamic requires, which don't work in ESM.

**Fix Applied:**
- Changed `tsup.config.ts` to use `bundle: true` instead of manually specifying `noExternal` packages
- This allows tsup to properly bundle all dependencies and handle the ESM/CJS interop correctly
- Kept `format: ['esm']` and `type: "module"` for modern Node.js compatibility

**Files Changed:**
- `tsup.config.ts`: Replaced `noExternal` array with `bundle: true`

### 2. **Missing Environment Variable**
**Problem:** OBSIDIAN_API_KEY was commented out in .env file

**Fix Applied:**
- Uncommented the OBSIDIAN_API_KEY line in `.env`

**Files Changed:**
- `.env`: Line 94 uncommented

## Testing Results

✅ **Server now starts successfully** with output:
```text
[INFO] Platform detected
[INFO] Configuration loaded
[INFO] Vault watcher initialized
[INFO] Obsidian MCP Server started successfully
```

## Cross-Platform Compatibility

These fixes maintain compatibility with:
- ✅ Windows (native)
- ✅ WSL (Windows Subsystem for Linux)
- ✅ Linux
- ✅ macOS

The ESM format with proper bundling works across all platforms because:
1. Node.js 18+ has excellent ESM support on all platforms
2. All dependencies are properly bundled into a single file
3. No platform-specific code paths were changed

## How to Run

1. **Build the server** (if not already built):
   ```bash
   npm run build
   ```

2. **Run the server**:
   ```bash
   node dist/index.js
   ```

3. **Use with Claude Desktop**:
   Add to your `claude_desktop_config.json`:
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

## Configuration

The server is configured via:
- **Config file**: `config.json` (or path specified in `CONFIG_PATH` env var)
- **Environment**: `.env` file with OBSIDIAN_API_KEY

Current vault configuration in `config.json`:
- Vault name: `recipes`
- Vault path: `D:\dev\obsidian\obsidian\recipe`
- API URL: `http://127.0.0.1:27123`

## Rollback Instructions

If these changes cause issues on Windows, you can rollback:

```bash
# Revert to previous tsup config
git diff tsup.config.ts  # Review changes
git checkout HEAD -- tsup.config.ts

# Rebuild
npm run build
```

The key changes were minimal and safe:
- Only changed bundling strategy in tsup.config.ts
- Uncommented an environment variable
- No source code changes

## Next Steps

1. Test with your MCP client (Claude Desktop, Cursor, etc.)
2. Verify all tools work correctly
3. Check that Obsidian API connection works (requires Obsidian running with Local REST API plugin)
