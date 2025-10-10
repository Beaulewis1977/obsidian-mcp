# Requirements Document: Obsidian MCP Server - Production Readiness Improvements

## Introduction

This document outlines the requirements for bringing the Obsidian MCP Server from its current state (70% production ready) to full production readiness (100%). The improvements focus on three critical areas identified in the audit:

1. **Platform Testing & Validation** - Ensure cross-platform reliability
2. **Feature Completion & Testing** - Complete Phase 2 features and comprehensive testing
3. **Documentation Alignment** - Sync documentation with actual implementation

These improvements will enable the server to handle production workloads with large vaults (1000+ notes) across multiple platforms (Windows native, WSL) and MCP clients (Claude Desktop, Cursor, Windsurf, Zed).

---

## Requirements

### Requirement 1: Platform Testing & Validation

**User Story:** As a developer deploying the MCP server, I want comprehensive platform testing so that I can confidently deploy on Windows native or WSL without encountering platform-specific bugs.

#### Acceptance Criteria

1. WHEN the server is deployed on Windows native THEN all 13 tools SHALL function correctly with backslash path separators
2. WHEN the server is deployed on WSL with Linux filesystem THEN all 13 tools SHALL function correctly with forward slash path separators
3. WHEN the server is deployed on WSL with Windows filesystem (/mnt/c) THEN path conversion SHALL work correctly using wslpath utility
4. WHEN file watching is enabled on Windows native THEN native file system events SHALL be used
5. WHEN file watching is enabled on WSL with Windows filesystem THEN polling mode SHALL be used with configurable interval
6. WHEN Obsidian executable is launched from WSL THEN Windows app path SHALL be correctly converted and executed
7. WHEN platform-specific tests are run THEN at least 90% SHALL pass on each supported platform
8. WHEN path conversion fails THEN the system SHALL log detailed error information and provide actionable suggestions

---

### Requirement 2: Core Feature Validation

**User Story:** As an end user, I want all documented tools to work reliably so that I can integrate the MCP server into my daily workflow without encountering unexpected failures.

#### Acceptance Criteria

1. WHEN read_note is called with valid path THEN note content, frontmatter, links, and metadata SHALL be returned within 50ms
2. WHEN create_note is called with API available THEN note SHALL be created via Obsidian API and cache SHALL remain consistent
3. WHEN create_note is called with API unavailable THEN note SHALL be created via filesystem and cache warning SHALL be returned
4. WHEN edit_note is called with mode="heading" and API available THEN content SHALL be inserted under specified heading using PATCH
5. WHEN edit_note is called with API unavailable THEN content SHALL be modified via filesystem with AST parsing
6. WHEN delete_note is called without confirm=true THEN operation SHALL be rejected with clear error message
7. WHEN list_notes is called on vault with 1000+ notes THEN results SHALL be returned within 2 seconds
8. WHEN search_notes is called with API unavailable THEN filesystem-based search SHALL be used as fallback
9. WHEN move_note is called THEN warning about wikilinks not being updated SHALL be included in response
10. WHEN get_daily_note is called with date parameter THEN note for specified date SHALL be returned or created
11. WHEN open_in_obsidian is called THEN note SHALL open in Obsidian app via API or URI protocol fallback
12. WHEN any tool encounters an error THEN structured error response SHALL include error code, details, and actionable suggestion

---

### Requirement 3: API Fallback Reliability

**User Story:** As a user working with Obsidian closed, I want filesystem fallback to work seamlessly so that I can still perform operations when the API is unavailable.

#### Acceptance Criteria

1. WHEN Obsidian API is unavailable THEN availability check SHALL complete within 2 seconds
2. WHEN write operation uses filesystem fallback THEN cache warning SHALL be included in response
3. WHEN read operation is performed THEN filesystem SHALL always be used regardless of API availability
4. WHEN API becomes unavailable mid-operation THEN retry logic SHALL attempt 2 retries with exponential backoff
5. WHEN API returns 5xx error THEN retry logic SHALL be triggered
6. WHEN API returns 4xx error THEN no retry SHALL be attempted and error SHALL be returned immediately
7. WHEN filesystem fallback is used for write operations THEN suggestion to open note in Obsidian SHALL be provided
8. WHEN both API and filesystem operations fail THEN detailed error with recovery steps SHALL be returned

---

### Requirement 4: Large Vault Performance

**User Story:** As a user with a large vault (1000+ notes), I want operations to complete quickly so that the MCP server doesn't slow down my AI assistant interactions.

#### Acceptance Criteria

1. WHEN read_note is called THEN operation SHALL complete within 50ms for notes up to 1MB
2. WHEN list_notes is called on vault with 1000 notes THEN operation SHALL complete within 2 seconds
3. WHEN list_notes is called on vault with 5000 notes THEN operation SHALL complete within 5 seconds
4. WHEN search_notes is called on vault with 1000 notes THEN operation SHALL complete within 5 seconds
5. WHEN file watching is enabled on vault with 1000+ notes THEN CPU usage SHALL remain below 10%
6. WHEN file watching is enabled on vault with 1000+ notes THEN memory usage SHALL remain below 200MB
7. WHEN concurrent read operations are performed THEN throughput SHALL scale linearly up to 10 concurrent requests
8. WHEN rate limiting is triggered THEN graceful degradation SHALL occur with warning messages at 80% threshold

---

### Requirement 5: Configuration Validation

**User Story:** As a system administrator, I want configuration validation so that invalid configurations are caught early with clear error messages.

#### Acceptance Criteria

1. WHEN configuration file is loaded THEN Zod schema validation SHALL be performed
2. WHEN vault path is invalid THEN validation error SHALL specify which vault and suggest correction
3. WHEN API key format is invalid THEN validation error SHALL explain expected format
4. WHEN rate limiting configuration is invalid THEN validation error SHALL specify which parameter and valid range
5. WHEN multiple vaults are configured with same name THEN validation error SHALL be raised
6. WHEN no default vault is specified and multiple vaults exist THEN validation error SHALL be raised
7. WHEN file watching polling interval is below 100ms THEN validation warning SHALL be issued
8. WHEN configuration version is incompatible THEN migration suggestion SHALL be provided

---

### Requirement 6: File Watching Stability

**User Story:** As a user with file watching enabled, I want the watcher to be stable and performant so that it doesn't impact system resources or miss file changes.

#### Acceptance Criteria

1. WHEN file watching is enabled THEN watcher SHALL initialize within 1 second
2. WHEN file is created in vault THEN change event SHALL be detected within stability threshold (2 seconds)
3. WHEN file is modified in vault THEN change event SHALL be detected within stability threshold
4. WHEN file is deleted in vault THEN change event SHALL be detected within stability threshold
5. WHEN file watching is enabled on Windows filesystem from WSL THEN polling mode SHALL be automatically selected
6. WHEN file watching is enabled on Linux filesystem from WSL THEN native events SHALL be used
7. WHEN file watching encounters error THEN watcher SHALL log error and continue monitoring other files
8. WHEN server shuts down THEN all file watchers SHALL be closed gracefully within 2 seconds
9. WHEN file watching is disabled in config THEN no watchers SHALL be initialized
10. WHEN large batch of files changes simultaneously THEN events SHALL be debounced to prevent flooding

---

### Requirement 7: MCP Client Compatibility

**User Story:** As a user of various AI assistants, I want the MCP server to work reliably with all major MCP clients so that I can use my preferred tool.

#### Acceptance Criteria

1. WHEN server is configured with Claude Desktop THEN all 13 tools SHALL be visible in tool list
2. WHEN server is configured with Cursor THEN all 13 tools SHALL be visible and functional
3. WHEN server is configured with Windsurf THEN all 13 tools SHALL be visible and functional
4. WHEN server is configured with Zed THEN all 13 tools SHALL be visible and functional
5. WHEN tool is called from any client THEN response format SHALL be compatible with MCP protocol
6. WHEN error occurs THEN error message SHALL be displayed correctly in client UI
7. WHEN server starts THEN stdio transport SHALL establish connection within 2 seconds
8. WHEN client disconnects THEN server SHALL clean up resources and log disconnection

---

### Requirement 8: Documentation Alignment

**User Story:** As a new user, I want documentation to accurately reflect the current implementation so that I don't waste time trying to use features that don't exist.

#### Acceptance Criteria

1. WHEN user reads README THEN implementation status SHALL be clearly marked (✅ Implemented, 🚧 Partial, 📋 Planned)
2. WHEN user reads API Reference THEN only implemented tools SHALL be documented as available
3. WHEN user reads Architecture document THEN diagrams SHALL reflect actual code structure
4. WHEN user reads Setup Guide THEN all steps SHALL be tested and verified to work
5. WHEN user reads Implementation Plan THEN phase completion status SHALL be accurate
6. WHEN user encounters feature in documentation THEN implementation status SHALL be clearly indicated
7. WHEN user reads Troubleshooting guide THEN solutions SHALL be tested and verified
8. WHEN new feature is implemented THEN documentation SHALL be updated in same commit

---

### Requirement 9: Error Recovery & Resilience

**User Story:** As a user, I want the server to handle errors gracefully so that temporary issues don't require server restart or manual intervention.

#### Acceptance Criteria

1. WHEN API connection fails THEN server SHALL continue operating with filesystem fallback
2. WHEN filesystem operation fails with EACCES THEN error SHALL include permission troubleshooting steps
3. WHEN filesystem operation fails with ENOENT THEN error SHALL suggest checking path and vault configuration
4. WHEN rate limit is exceeded THEN requests SHALL be queued if queue_requests is enabled
5. WHEN rate limit queue is full THEN clear error message SHALL explain wait time
6. WHEN concurrent write operations conflict THEN last-write-wins SHALL be applied with warning
7. WHEN server encounters unhandled exception THEN error SHALL be logged and graceful error response SHALL be returned
8. WHEN vault watcher fails THEN error SHALL be logged but server SHALL continue operating
9. WHEN configuration reload is triggered THEN server SHALL reload config without restart
10. WHEN memory usage exceeds threshold THEN warning SHALL be logged with suggestion to restart

---

### Requirement 10: Monitoring & Observability

**User Story:** As a system administrator, I want comprehensive logging and metrics so that I can monitor server health and troubleshoot issues effectively.

#### Acceptance Criteria

1. WHEN server starts THEN startup log SHALL include version, platform, and configuration summary
2. WHEN tool is called THEN log SHALL include tool name, vault, and execution time
3. WHEN error occurs THEN log SHALL include error code, stack trace, and context
4. WHEN API key is logged THEN it SHALL be redacted to show only last 4 characters
5. WHEN rate limit warning is triggered THEN log SHALL include current usage and limit
6. WHEN file watching detects change THEN log SHALL include file path, event type, and timestamp
7. WHEN performance threshold is exceeded THEN warning SHALL be logged
8. WHEN log level is set to debug THEN detailed operation logs SHALL be included
9. WHEN log level is set to info THEN only important events SHALL be logged
10. WHEN logs are written THEN structured JSON format SHALL be used for machine parsing

---

## Non-Functional Requirements

### Performance Requirements

1. **Response Time:**
   - Read operations: < 50ms (p95)
   - Write operations: < 200ms (p95)
   - List operations (1000 notes): < 2s (p95)
   - Search operations (1000 notes): < 5s (p95)

2. **Throughput:**
   - Minimum 100 requests/minute per vault
   - Concurrent operations: Support up to 10 simultaneous requests

3. **Resource Usage:**
   - Memory: < 200MB under normal load
   - CPU: < 10% when idle with file watching enabled
   - Disk I/O: Minimize unnecessary reads/writes

### Reliability Requirements

1. **Availability:**
   - Server uptime: 99.9% (excluding planned maintenance)
   - Graceful degradation when API unavailable

2. **Error Handling:**
   - All errors must return structured responses
   - No unhandled exceptions that crash the server
   - Automatic retry for transient failures

3. **Data Integrity:**
   - No data loss during write operations
   - Atomic file operations where possible
   - Backup on delete (optional feature)

### Security Requirements

1. **Authentication:**
   - API keys stored in environment variables only
   - API keys redacted in all logs

2. **Authorization:**
   - Path validation prevents directory traversal
   - Operations restricted to configured vault directories

3. **Data Protection:**
   - SSL/TLS for API connections (self-signed accepted for localhost)
   - No sensitive data in error messages

### Compatibility Requirements

1. **Platform Support:**
   - Windows 10/11 (native)
   - WSL2 (Ubuntu, Debian)
   - Node.js 18.0.0 or higher

2. **MCP Client Support:**
   - Claude Desktop
   - Cursor
   - Windsurf
   - Zed

3. **Obsidian Support:**
   - Obsidian latest version
   - Local REST API plugin v1.3.0+

---

## Success Criteria

The production readiness improvements will be considered complete when:

1. ✅ All 10 requirements have acceptance criteria met
2. ✅ Test coverage reaches 85% or higher
3. ✅ All platform-specific tests pass on Windows and WSL
4. ✅ All 4 MCP clients tested and verified working
5. ✅ Performance benchmarks meet or exceed targets
6. ✅ Documentation accurately reflects implementation
7. ✅ Security audit passes with no critical issues
8. ✅ Production deployment guide is complete and tested

---

## Out of Scope

The following items are explicitly out of scope for this requirements document:

1. ❌ Graph operations and link analysis (Phase 4)
2. ❌ Template support beyond basic daily notes (Phase 4)
3. ❌ Plugin integration (Dataview, Templater) (Phase 4)
4. ❌ Canvas file operations (Phase 4)
5. ❌ Sync awareness and conflict resolution (Phase 4)
6. ❌ Web UI for server management (Future)
7. ❌ Multi-user support (Future)
8. ❌ Cloud deployment (Future)

---

## Dependencies

1. **External Dependencies:**
   - Obsidian application with Local REST API plugin
   - Node.js 18+ runtime
   - Platform-specific tools (wslpath for WSL)

2. **Internal Dependencies:**
   - Existing codebase (Phase 1 complete, Phase 2 partial)
   - Test infrastructure (vitest)
   - Build tooling (tsup, TypeScript)

3. **Documentation Dependencies:**
   - Current documentation set (README, Architecture, API Reference, etc.)
   - Example configurations
   - Troubleshooting guides

---

## Assumptions

1. Users have Obsidian installed and configured
2. Users have Local REST API plugin enabled (for API features)
3. Users have basic command-line knowledge
4. Vaults are stored on local filesystem (not network drives)
5. Node.js 18+ is available on target platform
6. Users understand MCP protocol basics

---

## Constraints

1. **Technical Constraints:**
   - Must maintain backward compatibility with existing configurations
   - Must use stdio transport (MCP protocol requirement)
   - Must support self-signed SSL certificates for localhost
   - Cannot modify Obsidian application or plugins

2. **Resource Constraints:**
   - Development time: 4-6 weeks for full production readiness
   - Testing environments: Windows native + WSL required
   - No budget for external services (Redis optional)

3. **Compatibility Constraints:**
   - Must work with Obsidian's existing file format
   - Must respect Obsidian's cache and internal state
   - Must handle Obsidian being closed gracefully

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Platform-specific bugs surface in production | High | Medium | Comprehensive platform testing before release |
| Performance issues with large vaults | High | Medium | Performance benchmarking and optimization |
| API changes in Obsidian plugin | Medium | Low | Maintain filesystem fallback, version pinning |
| MCP client incompatibilities | Medium | Low | Test with all major clients |
| File watching resource consumption | Medium | Medium | Make file watching optional, optimize polling |
| Configuration migration issues | Low | Low | Provide migration guide and validation |

---

## Glossary

- **MCP:** Model Context Protocol - Protocol for AI assistant tool integration
- **Vault:** Obsidian's term for a folder containing markdown notes
- **Frontmatter:** YAML metadata at the beginning of markdown files
- **Wikilink:** Obsidian's internal link format `[[note name]]`
- **WSL:** Windows Subsystem for Linux
- **EARS:** Easy Approach to Requirements Syntax
- **API:** Obsidian Local REST API plugin
- **Stdio:** Standard input/output transport protocol

---

**Document Version:** 1.0  
**Date:** January 2025  
**Status:** Ready for Review  
**Next Step:** Design Document
