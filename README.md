# Obsidian MCP Server

[![CI](https://github.com/Beaulewis1977/obsidian-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Beaulewis1977/obsidian-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)](https://github.com/Beaulewis1977/obsidian-mcp)

A production-ready Model Context Protocol (MCP) server that enables AI assistants to interact with Obsidian vaults through a sophisticated dual-access architecture.

## ✨ Features

### Core Operations (P0 - Essential)
- ✅ **Read notes** with frontmatter, content, links, and metadata
- ✅ **Create notes** with YAML frontmatter and content
- ✅ **Edit notes** with multiple modes (append, prepend, replace, heading-based)
- ✅ **Delete notes** with confirmation

### Search & Discovery (P1 - Important)
- ✅ **List notes** with filtering by folder, tag, date, or pattern
- ✅ **Search notes** using full-text search (Obsidian API or filesystem)
- ✅ **Get backlinks** to find all notes linking to a specific note
- ✅ **Vault statistics** (note count, tags, links, size)

### Organization (P1 - Important)
- ✅ **Move/rename notes** (with link update warnings)
- ✅ **Update frontmatter** without modifying content
- ✅ **Create folders** in vault structure

### Advanced Features (P1-P2)
- ✅ **Daily notes** with configurable date formats
- ✅ **Open in Obsidian** via API or URI protocol
- ✅ **Dual-access model**: Obsidian REST API (primary) + filesystem (fallback)
- ✅ **Cross-platform**: Windows native and WSL support
- ✅ **Smart retry logic** with exponential backoff
- ✅ **Rate limiting** (configurable)
- ✅ **Large file handling** with warnings
- ✅ **File watching** with platform-specific optimizations
- ✅ **Security**: Path validation, API key protection

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org/))
- **Obsidian** with **Local REST API** plugin enabled
- **API Key** from Obsidian (Settings → Community Plugins → Local REST API)

### Installation

```bash
# Clone or download this repository
cd obsidian-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

1. **Create configuration file** at `~/.obsidian-mcp/config.json`:

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
      }
    }
  ]
}
```

2. **Set environment variable** in `.env` file:

```bash
OBSIDIAN_API_KEY=your-api-key-here
LOG_LEVEL=info
```

3. **Test the server**:

```bash
node dist/index.js
```

You should see:
```
[timestamp] INFO: Configuration loaded
[timestamp] INFO: Obsidian MCP Server started successfully
```

Press `Ctrl+C` to stop.

### MCP Client Setup

#### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["D:\\path\\to\\obsidian-mcp-server\\dist\\index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Important:** Use the **absolute path** to `dist/index.js` in your installation directory.

Restart Claude Desktop completely.

#### Other MCP Clients

This server works with any MCP-compatible client:
- **Cursor**: Similar configuration in `.cursor/mcp.json`
- **Windsurf**: Configuration in editor settings
- **Zed**: Configuration in `~/.config/zed/settings.json`

## 📚 Available Tools

### Core CRUD Operations

| Tool | Description |
|------|-------------|
| `read_note` | Read note with frontmatter, content, and links |
| `create_note` | Create new note with optional frontmatter |
| `edit_note` | Edit note (append/prepend/replace/heading-based) |
| `delete_note` | Delete note (requires confirmation) |

### Discovery & Search

| Tool | Description |
|------|-------------|
| `list_notes` | List notes with optional filters |
| `search_notes` | Full-text search across vault |
| `get_backlinks` | Find all notes linking to a note |
| `get_vault_stats` | Get vault statistics |

### Organization

| Tool | Description |
|------|-------------|
| `move_note` | Move/rename note (⚠️ doesn't update links) |
| `update_frontmatter` | Update note frontmatter |
| `create_folder` | Create folder in vault |

### Advanced

| Tool | Description |
|------|-------------|
| `get_daily_note` | Get or create daily note |
| `open_in_obsidian` | Open note/vault in Obsidian |

## 🔧 Configuration

### Vault Configuration

Example with all options:

```json
{
  "version": "1.0",
  "vaults": [
    {
      "name": "MyVault",
      "path": "/path/to/vault",
      "default": true,
      "obsidian_api": {
        "enabled": true,
        "url": "https://127.0.0.1:27124",
        "api_key": "${OBSIDIAN_API_KEY}",
        "verify_ssl": false,
        "timeout": 5000,
        "retry": {
          "enabled": true,
          "max_retries": 2,
          "initial_delay": 1000,
          "max_delay": 10000
        },
        "fallback_to_filesystem": true
      },
      "daily_notes": {
        "folder": "daily",
        "date_format": "YYYY-MM-DD",
        "template": null
      }
    }
  ],
  "rate_limiting": {
    "enabled": true,
    "api": {
      "requests_per_minute": 100
    },
    "filesystem": {
      "operations_per_minute": 500
    }
  },
  "file_watching": {
    "enabled": true,
    "polling": {
      "interval": 1000,
      "binary_interval": 2000
    },
    "stability_threshold": 2000
  },
  "limits": {
    "max_file_size": 10485760,
    "warning_threshold": 1048576
  }
}
```

### Environment Variables

```bash
# Required
OBSIDIAN_API_KEY=your-api-key-here

# Optional
LOG_LEVEL=info                    # debug, info, warn, error
FILE_WATCHING_ENABLED=true        # Enable file watching
RATE_LIMITING_ENABLED=true        # Enable rate limiting
CONFIG_PATH=/custom/config.json   # Custom config path
```

## 🔒 Security

### Critical Security Features

✅ **API Key Protection**: Stored in environment variables only, never in code  
✅ **Path Validation**: Prevents directory traversal attacks  
✅ **SSL Configuration**: Accepts self-signed certs for localhost only  
✅ **Input Validation**: All inputs validated with Zod schemas  
✅ **Log Redaction**: Sensitive data automatically redacted  

### ⚠️ Important Notes

- **No Built-in Backups**: This server does NOT maintain backups
- **Required**: Use Obsidian Sync, Git, or cloud backup
- **Link Updates**: Moving/renaming notes does NOT auto-update wikilinks
- **Concurrent Writes**: Avoid simultaneous edits from multiple clients

## 📊 Performance & Limits

### File Size Limits
- **< 1MB**: Normal performance
- **1-10MB**: Warning issued, may be slow
- **> 10MB**: Rejected (likely not a markdown note)

### Rate Limits (Configurable)
- API operations: **100 requests/minute**
- Filesystem operations: **500 operations/minute**

### File Watching Performance
- **Windows Native**: Native events (best performance)
- **WSL + Linux filesystem**: Native events (best performance)
- **WSL + Windows filesystem**: Polling mode (1s delay)

## 🌐 Cross-Platform Support

### Windows Native
```json
{
  "path": "C:\\Users\\username\\vault"
}
```

### WSL (Linux Filesystem - Recommended)
```json
{
  "path": "/home/username/vault"
}
```

### WSL (Windows Filesystem)
```json
{
  "path": "/mnt/c/Users/username/vault"
}
```

**Note**: For best performance in WSL, use Linux filesystem (`/home/...`) instead of Windows filesystem (`/mnt/c/...`).

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Build and watch
npm run dev

# Run tests
npm test

# Type check
npm run lint
```

## 📖 Documentation

- **[SETUP.md](./docs/SETUP.md)** - Detailed setup guide
- **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - Complete API documentation
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture
- **[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - Common issues
- **[DATA_SAFETY.md](./docs/DATA_SAFETY.md)** - Backup recommendations

## ⚠️ Known Limitations

1. **Link Updates**: Moving/renaming notes does NOT automatically update wikilinks
   - **Solution**: Use Obsidian's "Update internal links" command after moving

2. **Concurrent Writes**: Multiple clients writing to same note may cause conflicts
   - **Solution**: Avoid simultaneous edits

3. **File Watching (WSL)**: Windows filesystem requires polling with 1-second delay
   - **Solution**: Use Linux filesystem for better performance

## 🐛 Troubleshooting

### "API unavailable"
- Check Obsidian is running
- Verify Local REST API plugin is enabled
- Check API key is correct
- Test: `curl -k -H "Authorization: Bearer YOUR_KEY" https://127.0.0.1:27124/vault/`

### "Configuration file not found"
- Create `~/.obsidian-mcp/config.json`
- Or set `CONFIG_PATH` environment variable
- See example configs in `examples/` directory

### "Path validation failed"
- Use relative paths only (no `..` or absolute paths)
- Ensure path is within vault boundary

See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for more solutions.

## 🗺️ Roadmap

### ✅ Phase 1-3 (MVP - Complete)
- Core CRUD operations
- Obsidian API integration
- Cross-platform support
- Daily notes
- Search & discovery
- Rate limiting & security

### 🚧 Phase 4 (Future Enhancements)
- Template system with Templater integration
- Graph operations
- Canvas file support
- Dataview query integration
- Advanced caching
- Performance optimizations

## 📝 License

MIT License - See [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP protocol implementation
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) - Obsidian integration
- And many other excellent open-source libraries

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/obsidian-mcp-server/issues)
- **Documentation**: See `docs/` directory
- **Examples**: See `examples/` directory

---

**Built with ❤️ for the Obsidian and MCP communities**
