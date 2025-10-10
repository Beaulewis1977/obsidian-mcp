# Testing Checklist

## Overview

This checklist ensures comprehensive testing across all features, platforms, and MCP clients before release.

---

## Unit Tests

### Core MCP Layer

- [ ] Tool registration and dispatching
- [ ] Input validation with Zod schemas
- [ ] Error handling and response formatting
- [ ] Logging configuration and output

### Obsidian API Client

- [ ] API availability checking
- [ ] Authentication with Bearer token
- [ ] PUT /vault/{path} for create/replace
- [ ] POST /vault/{path} for append
- [ ] PATCH /vault/{path} with v3+ headers
- [ ] DELETE /vault/{path}
- [ ] POST /open/{filename}
- [ ] Error handling and retry logic
- [ ] Fallback to filesystem when API unavailable

### Filesystem Operations

- [ ] Read note with frontmatter parsing
- [ ] Write note with frontmatter
- [ ] Directory traversal for listing
- [ ] File watching with chokidar
- [ ] Markdown parsing with remark
- [ ] Wikilink extraction
- [ ] Heading extraction

### Platform Abstraction

- [ ] Windows ↔ WSL path conversion
- [ ] Platform detection (Windows vs WSL)
- [ ] Process spawning (cross-platform)
- [ ] URI protocol handling

### Utilities

- [ ] Path validation (reject `..` and absolute paths)
- [ ] Path traversal prevention
- [ ] API key redaction in logs
- [ ] Error type handling

---

## Integration Tests

### Tool Operations

#### read_note
- [ ] Read note with frontmatter
- [ ] Read note without frontmatter
- [ ] Read note with wikilinks
- [ ] Read note with embeds
- [ ] Handle missing note
- [ ] Handle invalid path

#### create_note
- [ ] Create note via API
- [ ] Create note via filesystem (fallback)
- [ ] Create note with frontmatter
- [ ] Create note with tags array
- [ ] Create note in subfolder
- [ ] Handle duplicate note
- [ ] Open note after creation

#### edit_note
- [ ] Append to note via API
- [ ] Prepend to note via API
- [ ] Replace note content via API
- [ ] Insert under heading via API (PATCH)
- [ ] Edit via filesystem (fallback)
- [ ] Handle missing note
- [ ] Handle missing heading

#### delete_note
- [ ] Delete note via API
- [ ] Delete note via filesystem (fallback)
- [ ] Require confirmation
- [ ] Handle missing note

#### list_notes
- [ ] List entire vault
- [ ] List specific folder
- [ ] Filter by tag
- [ ] Filter by modified date
- [ ] Filter by pattern (glob)
- [ ] Include metadata

#### search_notes
- [ ] Search via Obsidian API
- [ ] Search via filesystem grep
- [ ] Handle no results
- [ ] Handle special characters in query

#### move_note
- [ ] Move note to different folder
- [ ] Rename note in same folder
- [ ] Handle missing source
- [ ] Handle existing target
- [ ] Verify link update warning

#### update_frontmatter
- [ ] Update single field
- [ ] Update multiple fields
- [ ] Merge with existing frontmatter
- [ ] Replace frontmatter
- [ ] Handle missing note

#### get_daily_note
- [ ] Get today's daily note
- [ ] Get specific date's daily note
- [ ] Create daily note if missing
- [ ] Handle existing daily note

---

## Platform-Specific Tests

### Windows Native

- [ ] All tools functional
- [ ] Path handling correct (backslashes)
- [ ] Obsidian executable launch
- [ ] URI protocol handling
- [ ] File watching (native events)
- [ ] API connection to localhost

### WSL

#### Linux Filesystem Vault
- [ ] All tools functional
- [ ] Path handling correct (forward slashes)
- [ ] Obsidian executable launch (Windows app)
- [ ] URI protocol handling (cmd.exe)
- [ ] File watching (native events)
- [ ] API connection to localhost

#### Windows Filesystem Vault (/mnt/c)
- [ ] All tools functional
- [ ] Path conversion (WSL ↔ Windows)
- [ ] Obsidian executable launch
- [ ] URI protocol handling
- [ ] File watching (polling mode)
- [ ] API connection to localhost

---

## MCP Client Compatibility

### Claude Desktop

- [ ] Server starts successfully
- [ ] All tools visible in tool list
- [ ] read_note works
- [ ] create_note works
- [ ] edit_note works
- [ ] Error messages displayed correctly
- [ ] Logs accessible

### Cursor

- [ ] Server starts successfully
- [ ] All tools visible
- [ ] Basic operations work
- [ ] Error handling correct

### Windsurf

- [ ] Server starts successfully
- [ ] All tools visible
- [ ] Basic operations work
- [ ] Error handling correct

### Zed

- [ ] Server starts successfully
- [ ] All tools visible
- [ ] Basic operations work
- [ ] Error handling correct

---

## Security Tests

### Path Validation

- [ ] Reject `../` traversal attempts
- [ ] Reject absolute paths
- [ ] Reject paths outside vault boundary
- [ ] Log rejected attempts
- [ ] Return safe error messages

### API Key Handling

- [ ] API key not logged in plain text
- [ ] Authorization header redacted in logs
- [ ] API key loaded from environment
- [ ] API key not in config files

### HTTPS Handling

- [ ] Accept self-signed for localhost
- [ ] Verify SSL for remote (if applicable)
- [ ] Configurable per vault

---

## Performance Tests

### Large Vault (1000+ notes)

- [ ] list_notes completes in <5 seconds
- [ ] search_notes completes in <10 seconds
- [ ] File watching doesn't consume excessive CPU
- [ ] Memory usage reasonable (<200MB)

### Concurrent Operations

- [ ] Multiple read operations
- [ ] Multiple write operations
- [ ] Mixed read/write operations

---

## Error Handling Tests

### User Errors

- [ ] Invalid path → Clear error message
- [ ] Note not found → Helpful suggestion
- [ ] Invalid frontmatter → Parsing error details
- [ ] Missing confirmation → Require explicit confirm

### Configuration Errors

- [ ] Vault not found → Setup instructions
- [ ] Invalid API key → Check configuration
- [ ] API not configured → Fallback message

### System Errors

- [ ] Filesystem permission denied → Clear message
- [ ] Network error (API) → Fallback behavior
- [ ] Process spawn failure → Helpful error

---

## Regression Tests

### After Each Change

- [ ] All existing tests still pass
- [ ] No new console errors
- [ ] No performance degradation
- [ ] Documentation updated

---

## Pre-Release Checklist

### Code Quality

- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Code coverage >80%

### Documentation

- [ ] README complete
- [ ] API reference accurate
- [ ] Setup guide tested
- [ ] Troubleshooting guide complete
- [ ] Example configurations provided

### Security

- [ ] Security review completed
- [ ] No API keys in code
- [ ] Path validation comprehensive
- [ ] Logging safe (no secrets)

### Compatibility

- [ ] Windows native tested
- [ ] WSL tested (both filesystem types)
- [ ] All MCP clients tested
- [ ] Node.js 18+ verified

### Performance

- [ ] Large vault tested (1000+ notes)
- [ ] File watching optimized
- [ ] No memory leaks
- [ ] Startup time <2 seconds

---

## Test Environments

### Required Setups

1. **Windows Native**
   - Windows 10/11
   - Node.js 18+
   - Obsidian with Local REST API plugin
   - Test vault with 100+ notes

2. **WSL (Linux FS)**
   - WSL2 Ubuntu
   - Node.js 18+
   - Vault in `/home/user/vault`
   - Obsidian (Windows app)

3. **WSL (Windows FS)**
   - WSL2 Ubuntu
   - Node.js 18+
   - Vault in `/mnt/c/Users/username/vault`
   - Obsidian (Windows app)

### Test Data

- [ ] Sample vault with varied content
- [ ] Notes with frontmatter
- [ ] Notes with wikilinks
- [ ] Notes with embeds
- [ ] Nested folder structure
- [ ] Daily notes
- [ ] Large notes (>10KB)

---

## Automated Testing

### CI/CD Pipeline

- [ ] Unit tests run on commit
- [ ] Integration tests run on PR
- [ ] Platform-specific tests (if possible)
- [ ] Code coverage reporting
- [ ] Linting and type checking

### Test Scripts

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- tests/tools/

# Run in watch mode
npm test -- --watch
```

---

**Related Documents:**
- [Main Blueprint](compass_artifact_wf-fe9f07c2-63af-4612-9659-b34a1053148a_text_markdown.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [API Reference](API_REFERENCE.md)
- [Troubleshooting](TROUBLESHOOTING.md)

