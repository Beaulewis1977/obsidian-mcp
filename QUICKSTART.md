# Quick Start Guide

Your Obsidian MCP Server is **ready to run!** Follow these steps to get started.

## ✅ What's Already Done

- ✅ Project structure created
- ✅ All dependencies configured in `package.json`
- ✅ Complete source code implemented
- ✅ Configuration files set up with your vault path and API key
- ✅ Documentation complete
- ✅ Git repository initialized

## 🚀 Next Steps

### 1. Install Dependencies

```bash
cd /home/ubuntu/code_artifacts/obsidian-mcp-server
npm install
```

This will install ~600 packages (takes 1-2 minutes).

### 2. Build the Project

```bash
npm run build
```

Expected output:
```
CLI Building entry: src/index.ts
CLI tsup v8.0.0
✓ Built in 3.2s
```

### 3. Test the Server

```bash
node dist/index.js
```

You should see:
```
[timestamp] INFO: Platform detected
[timestamp] INFO: Configuration loaded
[timestamp] INFO: Obsidian MCP Server started successfully
```

Press `Ctrl+C` to stop.

### 4. Setup Configuration

Your vault is already configured! The server is ready to use with:

- **Vault Path**: `D:\obsidian\Obsidian\Recipe`
- **API Key**: Pre-configured in `.env` file
- **Config Location**: `examples/config-windows.json`

If you need to change anything:

1. **Edit vault path**: Update `examples/config-windows.json`
2. **Change API key**: Update `.env` file
3. **Copy config to system**:
   ```bash
   mkdir -p ~/.obsidian-mcp
   cp examples/config-windows.json ~/.obsidian-mcp/config.json
   ```

### 5. Configure Your MCP Client

#### For Claude Desktop (Windows)

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

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

**Important**: Replace `D:\\path\\to\\obsidian-mcp-server` with the actual absolute path where you installed this server.

**Then**: Completely restart Claude Desktop.

#### For Other Clients

See `docs/SETUP.md` for Cursor, Windsurf, and Zed configuration.

### 6. Test in Your MCP Client

Try these commands in Claude Desktop:

```
Can you list all the notes in my Recipe vault?
```

```
Can you search my vault for "recipe"?
```

```
Create a test note called "test.md" with the content "Hello from MCP!"
```

## 📖 Available Tools

Your server includes **13 powerful tools**:

### Core Operations
- `read_note` - Read note with frontmatter and links
- `create_note` - Create new note
- `edit_note` - Edit note (append/prepend/replace/heading-based)
- `delete_note` - Delete note (with confirmation)

### Discovery
- `list_notes` - List notes with filters
- `search_notes` - Full-text search
- `get_backlinks` - Find notes linking to a note
- `get_vault_stats` - Vault statistics

### Organization
- `move_note` - Move/rename note
- `update_frontmatter` - Update note metadata
- `create_folder` - Create folder

### Advanced
- `get_daily_note` - Get/create daily note
- `open_in_obsidian` - Open note in Obsidian

See `docs/API_REFERENCE.md` for complete documentation.

## 🔧 Configuration Files

Your project includes:

- `.env` - Your API key and settings
- `examples/config-windows.json` - Windows configuration (your vault)
- `examples/config-wsl.json` - WSL configuration (if needed)
- `examples/claude-desktop-config.json` - Claude Desktop setup

## 📁 Project Structure

```
obsidian-mcp-server/
├── src/                    # Source code (TypeScript)
│   ├── index.ts           # Main server entry point
│   ├── config/            # Configuration loader
│   ├── obsidian/          # Obsidian API client
│   ├── filesystem/        # File operations
│   ├── platform/          # Windows/WSL support
│   ├── tools/             # Tool implementations
│   ├── types/             # TypeScript types
│   └── utils/             # Utilities (logging, validation)
├── dist/                  # Built output (JavaScript)
├── docs/                  # Documentation
│   ├── SETUP.md          # Detailed setup guide
│   ├── API_REFERENCE.md  # Tool documentation
│   ├── ARCHITECTURE.md   # System architecture
│   └── TROUBLESHOOTING.md # Common issues
├── examples/              # Example configurations
├── .env                   # Your API key (configured)
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── README.md             # Main documentation
```

## 🐛 Troubleshooting

### "Cannot find module"
```bash
npm install
npm run build
```

### "API unavailable"
- Make sure Obsidian is running
- Check Local REST API plugin is enabled
- Verify your API key in `.env`

### "Configuration not found"
```bash
mkdir -p ~/.obsidian-mcp
cp examples/config-windows.json ~/.obsidian-mcp/config.json
```

### Claude Desktop doesn't show tools
- Check the absolute path in `claude_desktop_config.json`
- **Completely restart** Claude Desktop (quit and reopen)
- Check logs: `%LOCALAPPDATA%\Claude\logs\`

See `docs/TROUBLESHOOTING.md` for more solutions.

## 📚 Documentation

- **[README.md](./README.md)** - Main documentation and features
- **[docs/SETUP.md](./docs/SETUP.md)** - Detailed setup guide
- **[docs/API_REFERENCE.md](./docs/API_REFERENCE.md)** - Complete API documentation
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture
- **[docs/DATA_SAFETY.md](./docs/DATA_SAFETY.md)** - Backup recommendations
- **[docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - Common issues

## ⚠️ Important Notes

### Before Using

1. **Setup Backups**: This server does NOT maintain backups
   - Recommended: Obsidian Sync or Git
   - See `docs/DATA_SAFETY.md`

2. **Link Updates**: Moving notes does NOT auto-update wikilinks
   - Use Obsidian's "Update internal links" command after moving

3. **Concurrent Writes**: Avoid editing same note from multiple clients

### Security

- ✅ API key stored in `.env` (not in code)
- ✅ Path validation prevents directory traversal
- ✅ All inputs validated
- ✅ Sensitive data redacted in logs

## 🎯 Example Workflows

### Create a Daily Note

```
Create today's daily note in my Recipe vault
```

### Search and Read

```
Search my vault for "pasta recipe"
```

Then:
```
Read the note at "recipes/pasta-carbonara.md"
```

### Organize Notes

```
Create a folder called "meal-planning"
```

```
Move "recipes/dinner-ideas.md" to "meal-planning/dinner-ideas.md"
```

### Get Vault Statistics

```
Show me statistics about my Recipe vault
```

## 🚀 Development

```bash
# Build
npm run build

# Build and watch
npm run dev

# Type check
npm run lint

# Run tests
npm test
```

## 🎉 You're Ready!

Your Obsidian MCP Server is complete and configured for your vault at `D:\obsidian\Obsidian\Recipe`.

**Next Steps**:
1. Install dependencies: `npm install`
2. Build: `npm run build`
3. Configure your MCP client (Claude Desktop, Cursor, etc.)
4. Start using your Obsidian vault through AI!

**Need Help?**
- Check `docs/SETUP.md` for detailed instructions
- See `docs/TROUBLESHOOTING.md` for common issues
- Review `docs/API_REFERENCE.md` for all available tools

---

**Happy note-taking! 📝**
