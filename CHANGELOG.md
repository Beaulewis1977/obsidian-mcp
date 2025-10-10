# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Obsidian MCP Server
- Complete CRUD operations for Obsidian notes
- 13 MCP tools for comprehensive vault management
- Sophisticated multi-tier rate limiting system
- Real-time file watching with change notifications
- Dual-access architecture (API + filesystem fallback)
- Cross-platform support (Windows, macOS, Linux, WSL)
- Comprehensive test suite with 80%+ coverage
- Production-ready error handling and logging

### Tools Implemented
- `read_note` - Read note with frontmatter, content, and links
- `create_note` - Create new notes with templates
- `edit_note` - Edit notes with multiple modes (append, prepend, replace, heading)
- `delete_note` - Delete notes with confirmation
- `list_notes` - List notes with filtering (tags, dates, patterns)
- `search_notes` - Full-text search across vault
- `move_note` - Move or rename notes
- `update_frontmatter` - Update note metadata
- `get_daily_note` - Get or create daily notes
- `open_in_obsidian` - Open notes in Obsidian app
- `get_backlinks` - Find all backlinks to a note
- `create_folder` - Create vault folders
- `get_vault_stats` - Get vault statistics

### Features
- **Rate Limiting**: Multi-tier (global, read/write, tool-specific) with graceful degradation
- **File Watching**: Real-time vault monitoring with configurable intervals
- **Security**: Path traversal prevention, API key redaction, input validation
- **Testing**: Comprehensive unit and integration tests across all components
- **CI/CD**: GitHub Actions workflows for testing, linting, and releases

## [1.0.0] - 2025-01-XX

Initial production release.

