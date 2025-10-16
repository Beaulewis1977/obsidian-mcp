# Obsidian MCP Server

<div align="center">

**🤖 AI-Powered Obsidian Integration | 🚀 Production Ready | 📚 Knowledge Management**

[![CI](https://github.com/Beaulewis1977/obsidian-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Beaulewis1977/obsidian-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)](https://github.com/Beaulewis1977/obsidian-mcp)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 👨‍💻 About the Developer

**Designed and made by Beau Lewis**  
📧 **blewisxx@gmail.com**

> *"I enjoy creating open‑source projects that help people. If this project was helpful to you and you’d like to help the cause, please do!"*

<div align="center">
  <strong>Support My Work:</strong><br>
  Venmo: <a href="https://venmo.com/beauintulsa">@beauintulsa</a> |
  Ko‑fi: <a href="https://ko-fi.com/beaulewis">ko-fi.com/beaulewis</a><br>
  Repo: <a href="https://github.com/Beaulewis1977/obsidian-mcp">github.com/Beaulewis1977/obsidian-mcp</a>
</div>

---

## 🌟 What is Obsidian MCP Server?

A **production-ready Model Context Protocol (MCP) server** that enables AI assistants (Claude, ChatGPT, etc.) to interact with your Obsidian vaults through a sophisticated dual-access architecture.

**Think of it as a bridge** between your AI assistant and your personal knowledge base in Obsidian, allowing AI to read, write, search, and organize your notes seamlessly.

### 🎯 Key Benefits

- **🔍 Smart Search**: AI can find and analyze your notes instantly
- **✍️ Content Creation**: Generate new notes with proper formatting
- **🔗 Knowledge Discovery**: Find connections between ideas
- **📊 Vault Analytics**: Understand your knowledge base structure
- **🤖 AI Workflow Integration**: Use AI to enhance your PKM system

### 🏗️ Architecture Highlights

- **Dual-Access Model**: Obsidian REST API (primary) + filesystem (fallback)
- **Cross-Platform**: Windows native and WSL support
- **Rate Limiting**: Configurable limits with graceful degradation
- **File Watching**: Real-time vault change detection
- **Security First**: Path validation, API key protection, error handling

## ✨ Features

### 🔧 **13 Powerful Tools Available**

#### **Core Operations** 📝
- **`read_note`** - Read notes with full metadata, frontmatter, and content
- **`create_note`** - Create new notes with YAML frontmatter
- **`edit_note`** - Modify notes with multiple modes (append, prepend, replace, heading-based)
- **`delete_note`** - Delete notes with confirmation

#### **Search & Discovery** 🔍
- **`list_notes`** - Browse vault with filtering (folder, tag, date, pattern)
- **`search_notes`** - Full-text search via Obsidian API or filesystem
- **`get_backlinks`** - Find all notes linking to a specific note
- **`get_vault_stats`** - Vault analytics (count, tags, links, size)

#### **Organization** 📁
- **`move_note`** - Move/rename notes (with link update warnings)
- **`update_frontmatter`** - Modify metadata without touching content
- **`create_folder`** - Create new folders in vault structure

#### **Advanced Features** ⚡
- **`get_daily_note`** - Daily notes with configurable date formats
- **`open_in_obsidian`** - Open notes directly in Obsidian app

### 🛡️ **Enterprise-Grade Features**

#### **Security & Reliability**
- **Path Validation**: Prevents directory traversal attacks
- **API Key Protection**: Secure credential handling
- **Error Recovery**: Graceful fallback to filesystem when API fails
- **Rate Limiting**: Multi-tier limits (global, per-operation, per-tool)
- **Request Queuing**: Handles traffic spikes gracefully

#### **Performance & Scalability**
- **File Watching**: Real-time vault change detection
- **Smart Caching**: Optimized for large vaults
- **Cross-Platform**: Windows native + WSL support
- **Connection Pooling**: Efficient API usage

#### **Developer Experience**
- **TypeScript**: Full type safety throughout
- **Comprehensive Tests**: 78 tests, 80%+ coverage
- **CI/CD Pipeline**: Automated quality gates
- **CodeRabbit Integration**: AI-powered code review

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** ([Download](https://nodejs.org/))
- **Obsidian** with **Local REST API** plugin enabled
- **API Key** from Obsidian (Settings → Community Plugins → Local REST API)

### Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/Beaulewis1977/obsidian-mcp.git
cd obsidian-mcp

# 2. Install dependencies
npm install

# 3. Create your configuration file (see below)
#    Save as %USERPROFILE%/.obsidian-mcp/config.json (Windows)
#    or ~/.obsidian-mcp/config.json (macOS/Linux)
#    Alternatively, set CONFIG_PATH to point to your config file.

# 4. Build the project
npm run build

# 5. Start the server
node dist/index.js
# Or with a helper that prints guidance if not yet built:
# node start-server.mjs
```

### Configuration

This server is configured via a JSON file. Environment variables can supplement settings but do not replace the need to define vaults.

#### Where the server looks for config
- `CONFIG_PATH` environment variable (if set)
- `%USERPROFILE%/.obsidian-mcp/config.json` (Windows) or `~/.obsidian-mcp/config.json`
- `./config.json` (current working directory)
- `../config.json` (parent directory)

#### Minimal config example
```json
{
  "version": "1.0",
  "vaults": [
    {
      "name": "main",
      "path": "/path/to/your/vault",
      "default": true,
      "obsidian_api": {
        "enabled": true,
        "url": "http://127.0.0.1:27123",
        "verify_ssl": false,
        "api_key": "${OBSIDIAN_API_KEY}",
        "timeout": 5000,
        "retry": { "enabled": true, "max_retries": 2, "initial_delay": 1000, "max_delay": 10000 },
        "fallback_to_filesystem": true
      },
      "daily_notes": { "folder": "daily", "date_format": "YYYY-MM-DD", "template": null }
    }
  ]
}
```

#### Extended config (rate limiting, file watching, limits, features)
```json
{
  "version": "1.0",
  "vaults": [ { "name": "main", "path": "/path/to/your/vault", "default": true, "obsidian_api": { "enabled": true, "url": "http://127.0.0.1:27123", "verify_ssl": false, "api_key": "${OBSIDIAN_API_KEY}", "timeout": 5000, "retry": { "enabled": true, "max_retries": 2, "initial_delay": 1000, "max_delay": 10000 }, "fallback_to_filesystem": true }, "daily_notes": { "folder": "daily", "date_format": "YYYY-MM-DD", "template": null } } ],
  "rate_limiting": {
    "enabled": true,
    "limits": {
      "global": { "requests_per_minute": 1000, "requests_per_hour": 10000 },
      "read": { "requests_per_minute": 600, "requests_per_hour": 6000 },
      "write": { "requests_per_minute": 100, "requests_per_hour": 1000 },
      "tools": {
        "edit_note": { "requests_per_minute": 30 },
        "delete_note": { "requests_per_minute": 20 },
        "move_note": { "requests_per_minute": 25 },
        "search_notes": { "requests_per_minute": 60 },
        "get_backlinks": { "requests_per_minute": 100 }
      }
    },
    "graceful": { "warn_at_percentage": 80, "queue_requests": false, "max_queue_size": 100, "queue_timeout_ms": 30000 }
  },
  "file_watching": { "enabled": true, "polling": { "interval": 1000, "binary_interval": 2000 }, "stability_threshold": 2000 },
  "limits": { "max_file_size": 10485760, "warning_threshold": 1048576 },
  "features": { "backup_on_delete": false, "advisory_locking": false }
}
```

#### Useful environment variables
- `CONFIG_PATH`: Absolute path to your config JSON.
- `OBSIDIAN_API_KEY`: Used when `obsidian_api.api_key` is set to `${OBSIDIAN_API_KEY}`.
- `LOG_LEVEL`: One of `trace|debug|info|warn|error|fatal`.
- `RATE_LIMITING_*`, `FILE_WATCHING_ENABLED`: Optional toggles; see `.env.example`.

### AI Assistant Integration

#### **Claude Desktop**
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/obsidian-mcp/dist/index.js"]
    }
  }
}
```

#### **Other MCP-Compatible Tools**
The server implements the full MCP protocol and works with any MCP-compatible AI assistant.

## 📚 Documentation

- [📖 **API Reference**](docs/API_REFERENCE.md) - Complete tool documentation
- [🏗️ **Architecture Guide**](docs/ARCHITECTURE.md) - System design details
- [🔒 **Security Guide**](docs/DATA_SAFETY.md) - Security considerations
- [🚀 **Setup Guide**](SETUP_GUIDE.md) - Detailed installation steps
- [🧪 **Testing Guide**](docs/TESTING_CHECKLIST.md) - Quality assurance
- [🔧 **Troubleshooting**](docs/TROUBLESHOOTING.md) - Common issues and solutions

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch from `develop`
3. **Make** your changes with tests
4. **Test** thoroughly (`npm run lint && npm run test`)
5. **Submit** a pull request to `develop`
6. **CodeRabbit** will review automatically
7. **Merge** after approval

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with ❤️ for the Obsidian and MCP communities.

---

<div align="center">
  <strong>⭐ If this project helps you, please consider starring the repository!</strong>
</div>
