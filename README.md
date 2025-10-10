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

**Designed and built by Beau Lewis**  
📧 **blewisxx@gmail.com**

> *"I love creating apps that help people be more productive and organized. If this helped you and you'd like to help me continue making these tools, consider a donation!"*

<div align="center">
  <strong>Support My Work:</strong><br>
  <a href="https://venmo.com/beauintulsa">@beauintulsa</a> |
  <a href="https://ko-fi.com/beaulewis">ko-fi.com/beaulewis</a>
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

# 3. Configure your vault
cp .env.example .env
# Edit .env with your vault path and API key

# 4. Build the project
npm run build

# 5. Start the server
npm start
```

### Configuration

**Option 1: Environment Variables** (Recommended)
```bash
# .env file
OBSIDIAN_VAULT_PATH=/path/to/your/vault
OBSIDIAN_API_KEY=your-obsidian-api-key
MCP_PORT=13800
```

**Option 2: JSON Configuration**
```json
// config.json
{
  "vaults": [{
    "name": "main",
    "path": "/path/to/your/vault",
    "obsidian_api": {
      "enabled": true,
      "url": "http://localhost:27124",
      "api_key": "your-api-key"
    }
  }]
}
```

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
