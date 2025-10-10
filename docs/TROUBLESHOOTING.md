# Troubleshooting Guide

## Common Issues and Solutions

---

## Server Issues

### Server Won't Start

**Symptoms:**
- MCP client reports server connection failed
- No output when running server manually
- Error messages about missing modules

**Diagnostic Steps:**

1. **Check Node.js version:**
   ```bash
   node --version  # Should be 18.0.0 or higher
   ```

2. **Verify installation:**
   ```bash
   npm list @modelcontextprotocol/sdk
   ```

3. **Check for errors:**
   ```bash
   node dist/index.js 2>&1 | tee server.log
   ```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Node.js too old | Install Node.js 18+ from nodejs.org |
| Missing dependencies | Run `npm install` |
| Build not up to date | Run `npm run build` |
| Invalid config JSON | Validate JSON syntax in config file |
| Missing config file | Create `~/.obsidian-mcp/config.json` |

**Quick Fix:**
```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
npm run build

# Test server
node dist/index.js
```

---

### Server Starts But Tools Not Available

**Symptoms:**
- Server connects but no tools appear in MCP client
- Empty tool list

**Diagnostic Steps:**

1. **Check server logs:**
   - Look for tool registration messages
   - Check for initialization errors

2. **Verify MCP client configuration:**
   - Ensure correct command path
   - Check environment variables

**Solutions:**

- Restart MCP client after server changes
- Verify server is using stdio transport
- Check for errors in tool registration code

---

## Obsidian API Issues

### API Not Connecting

**Symptoms:**
- "Obsidian API unavailable" messages
- All operations fall back to filesystem
- Connection timeout errors

**Diagnostic Steps:**

1. **Test API manually:**
   ```bash
   curl -k -H "Authorization: Bearer YOUR_API_KEY" \
     https://127.0.0.1:27124/vault/
   ```

2. **Check plugin status:**
   - Open Obsidian Settings → Community Plugins
   - Verify "Local REST API" is installed and enabled
   - Check plugin settings for port and HTTPS

3. **Verify API key:**
   - Compare key in config with key in Obsidian plugin settings
   - Check for extra spaces or newlines

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Plugin not enabled | Enable Local REST API plugin in Obsidian |
| Wrong API key | Copy correct key from plugin settings |
| Wrong port | Check plugin settings (default: 27124 HTTPS, 27123 HTTP) |
| Firewall blocking | Temporarily disable firewall to test |
| Obsidian not running | Launch Obsidian application |
| Wrong URL scheme | Use `https://` for HTTPS, `http://` for HTTP |

**Configuration Check:**
```json
{
  "obsidian_api": {
    "enabled": true,
    "url": "https://127.0.0.1:27124",  // Match plugin settings
    "api_key": "${OBSIDIAN_API_KEY}",  // From environment
    "verify_ssl": false                 // For self-signed certs
  }
}
```

---

### SSL Certificate Errors

**Symptoms:**
- "SSL certificate verification failed"
- "UNABLE_TO_VERIFY_LEAF_SIGNATURE"

**Solution:**

Set `verify_ssl: false` for localhost connections:

```json
{
  "obsidian_api": {
    "url": "https://127.0.0.1:27124",
    "verify_ssl": false  // Required for self-signed certs
  }
}
```

**Note:** Only disable SSL verification for localhost. For remote connections, use valid certificates.

---

## Path and Filesystem Issues

### Path Errors on WSL

**Symptoms:**
- "File not found" with correct-looking paths
- Path format errors
- Permission denied on valid paths

**Diagnostic Steps:**

1. **Check path format:**
   ```bash
   # WSL path
   /home/username/vault/note.md
   
   # Windows path from WSL
   /mnt/c/Users/username/vault/note.md
   
   # Windows native path
   C:\Users\username\vault\note.md
   ```

2. **Test path conversion:**
   ```bash
   wslpath -w /mnt/c/Users/username/vault
   # Output: C:\Users\username\vault
   
   wslpath -u 'C:\Users\username\vault'
   # Output: /mnt/c/Users/username/vault
   ```

**Solutions:**

- **For WSL config:** Use Linux-style paths (`/home/...` or `/mnt/c/...`)
- **For Windows config:** Use Windows-style paths (`C:\Users\...`)
- Ensure vault path in config matches your environment

**Example WSL Config:**
```json
{
  "vaults": [
    {
      "name": "MyVault",
      "path": "/home/username/obsidian-vault",  // Linux FS (preferred)
      // OR
      "path": "/mnt/c/Users/username/Documents/ObsidianVault"  // Windows FS
    }
  ]
}
```

---

### Path Traversal Rejected

**Symptoms:**
- "Invalid path: path traversal detected"
- Operations fail with security error

**Cause:**
Path validation is rejecting potentially unsafe paths.

**Valid Paths:**
- ✅ `folder/note.md`
- ✅ `daily/2024/01/note.md`
- ✅ `note.md`

**Invalid Paths:**
- ❌ `../other-vault/note.md` (traversal)
- ❌ `/absolute/path/note.md` (absolute)
- ❌ `folder/../../../etc/passwd` (traversal)

**Solution:**
Use relative paths within the vault only.

---

## File Watching Issues

### File Watching Not Working (WSL)

**Symptoms:**
- Changes in Obsidian not detected by server
- File watcher not triggering
- No change notifications

**Cause:**
WSL2 inotify doesn't work reliably with Windows filesystem (`/mnt/c`).

**Solution:**

Enable polling mode:

```bash
# Environment variable
export CHOKIDAR_USEPOLLING=true
export CHOKIDAR_INTERVAL=1000

# Or in config.json
{
  "features": {
    "file_watching": true,
    "use_polling": true,
    "polling_interval": 1000
  }
}
```

**Performance Note:**
Polling uses more CPU. For better performance, use Linux filesystem (`/home/...`) for vault.

---

### High CPU Usage from File Watcher

**Symptoms:**
- Server process using high CPU
- System slowdown

**Solutions:**

1. **Increase polling interval:**
   ```json
   {
     "features": {
       "polling_interval": 2000  // Check every 2 seconds instead of 1
     }
   }
   ```

2. **Disable file watching:**
   ```json
   {
     "features": {
       "file_watching": false
     }
   }
   ```

3. **Move vault to Linux filesystem (WSL):**
   - Better performance with native inotify
   - No polling required

---

## MCP Client Issues

### Claude Desktop Can't Find Server

**Symptoms:**
- Server not listed in Claude Desktop
- Connection errors in Claude Desktop logs

**Diagnostic Steps:**

1. **Check config location:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Verify config syntax:**
   ```json
   {
     "mcpServers": {
       "obsidian": {
         "command": "node",
         "args": ["C:\\absolute\\path\\to\\dist\\index.js"],
         "env": {
           "OBSIDIAN_API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

3. **Check logs:**
   - macOS: `~/Library/Logs/Claude/mcp-server-obsidian.log`
   - Windows: `%LOCALAPPDATA%\Claude\logs\`

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Relative path used | Use absolute path to `dist/index.js` |
| Wrong Node.js path | Use `which node` to get correct path |
| Permission denied | Run `chmod +x dist/index.js` |
| Syntax error in JSON | Validate JSON (no trailing commas) |

---

### WSL Server from Windows Claude Desktop

**Configuration:**

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "wsl.exe",
      "args": [
        "bash",
        "-c",
        "cd /home/username/obsidian-mcp-server && node dist/index.js"
      ],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Notes:**
- Use `wsl.exe` as command
- Provide full WSL path in bash command
- Ensure Node.js installed in WSL

---

## Cache and Sync Issues

### Obsidian Cache Desync

**Symptoms:**
- New notes not appearing in Obsidian search
- Links not updating
- Tags not recognized

**Cause:**
Filesystem writes bypass Obsidian's cache.

**Solutions:**

1. **Use API for writes:**
   - Ensure `prefer_api: true` in config
   - Verify API is available

2. **Refresh cache after filesystem writes:**
   - Open the note in Obsidian
   - Or restart Obsidian

3. **Enable auto-open:**
   ```json
   {
     "features": {
       "auto_open_notes": true  // Opens notes after creation
     }
   }
   ```

---

## Performance Issues

### Slow Operations on Large Vaults

**Symptoms:**
- list_notes takes >10 seconds
- search_notes times out
- High memory usage

**Solutions:**

1. **Use filters:**
   ```typescript
   // Instead of listing entire vault
   list_notes({ folder: "specific-folder" })
   
   // Use date filters
   list_notes({ filter: { modified_since: "2024-01-01" } })
   ```

2. **Disable file watching:**
   ```json
   {
     "features": {
       "file_watching": false
     }
   }
   ```

3. **Future enhancement:** Enable caching (Post-MVP)

---

## Debugging Tips

### Enable Debug Logging

```bash
# Environment variable
export LOG_LEVEL=debug

# Or in config
{
  "logging": {
    "level": "debug",
    "file": "~/.obsidian-mcp/server.log"
  }
}
```

### Test Server Manually

```bash
# Run server directly
node dist/index.js

# With debug output
LOG_LEVEL=debug node dist/index.js 2>&1 | tee debug.log
```

### Use MCP Inspector

```bash
# Install inspector
npm install -g @modelcontextprotocol/inspector

# Run server with inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Getting Help

### Before Reporting Issues

- [ ] Check this troubleshooting guide
- [ ] Review server logs
- [ ] Test with minimal configuration
- [ ] Verify prerequisites (Node.js version, Obsidian plugin)

### Information to Include

When reporting issues, include:

1. **Environment:**
   - OS (Windows native / WSL)
   - Node.js version
   - Obsidian version
   - MCP client (Claude Desktop, Cursor, etc.)

2. **Configuration:**
   - Sanitized config file (remove API keys)
   - Environment variables

3. **Logs:**
   - Server logs (with debug level)
   - MCP client logs
   - Error messages

4. **Steps to Reproduce:**
   - Minimal example
   - Expected vs actual behavior

---

**Related Documents:**
- [Main Blueprint](compass_artifact_wf-fe9f07c2-63af-4612-9659-b34a1053148a_text_markdown.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [API Reference](API_REFERENCE.md)
- [Testing Checklist](TESTING_CHECKLIST.md)

