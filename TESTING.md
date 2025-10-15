# Testing the Obsidian MCP Server

## Why I Can't Test Directly

I (Claude Code) cannot directly invoke MCP tools from other servers in this context because:

1. **MCP tools are session-specific**: They're only available when Claude Code is running in a directory where the MCP server is configured
2. **Current directory matters**: The Obsidian MCP server is configured for `/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server` only
3. **Tool namespace**: MCP tools from external servers appear with the prefix `mcp__<servername>__<toolname>`, but they're not available in all contexts

## How YOU Can Test

### Method 1: Ask Me in a New Session

1. Navigate to the server directory:
   ```bash
   cd /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server
   ```

2. Start a new Claude Code session there (or we continue this one)

3. Ask me to use the tools:
   - "List all notes in my recipes vault"
   - "Search my vault for 'pasta'"
   - "Show me vault statistics"
   - "Read the note at <path>"

### Method 2: Use MCP Inspector (GUI)

The MCP Inspector provides a visual interface to test your server:

```bash
cd /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server
npx @modelcontextprotocol/inspector node dist/index.js
```

Then open http://localhost:5173 in your browser and you can:
- See all available tools
- Test each tool with different parameters
- View responses in real-time

### Method 3: Test with Claude Desktop

If you have Claude Desktop configured (separate from Claude Code):

1. Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server/dist/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

2. Restart Claude Desktop
3. Ask Claude to list notes, search, etc.

### Method 4: Manual stdio Test

You can manually test the server via stdin/stdout:

```bash
cd /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server

# Start the server
node dist/index.js

# In another terminal, send MCP protocol messages:
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | nc localhost <port>
```

## Available Tools to Test

Based on the documentation, the server provides these tools:

### Core Operations
- `read_note` - Read a note with frontmatter and links
- `create_note` - Create a new note
- `edit_note` - Edit an existing note
- `delete_note` - Delete a note

### Discovery
- `list_notes` - List all notes with optional filters
- `search_notes` - Full-text search across vault
- `get_backlinks` - Find notes linking to a specific note
- `get_vault_stats` - Get vault statistics

### Organization
- `move_note` - Move or rename a note
- `update_frontmatter` - Update note metadata
- `create_folder` - Create a new folder

### Advanced
- `get_daily_note` - Get or create today's daily note
- `open_in_obsidian` - Open a note in Obsidian app

## Quick Test Commands

Once in the correct directory with Claude Code, try:

```
List all notes in my recipes vault
```

```
Show me statistics about my vault
```

```
Search for notes containing "recipe"
```

## Verifying Server is Working

Check server health:
```bash
cd /mnt/d/dev/obsidian-mcp-2/code_artifacts/obsidian-mcp-server
claude mcp list
```

Should show:
```
✓ obsidian-server: Connected
```

## Troubleshooting

If tests fail:

1. **Check server builds**:
   ```bash
   npm run build
   ```

2. **Check environment**:
   ```bash
   cat .env  # Verify OBSIDIAN_API_KEY is set
   ```

3. **Test server manually**:
   ```bash
   node dist/index.js
   # Should start without errors
   ```

4. **Check Obsidian API**:
   ```bash
   curl -k -H "Authorization: Bearer $OBSIDIAN_API_KEY" http://127.0.0.1:27123/vault/
   # Should return vault info (if Obsidian is running)
   ```
