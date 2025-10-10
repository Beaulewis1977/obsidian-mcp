# Testing Strategy: Obsidian MCP Server - Production Readiness

## Overview

This document outlines the comprehensive testing strategy for achieving production readiness. The strategy covers unit testing, integration testing, platform-specific testing, performance testing, and end-to-end testing across multiple MCP clients.

**Testing Goals:**
- Achieve 85%+ code coverage
- Validate cross-platform compatibility (Windows, WSL)
- Verify performance targets
- Ensure MCP client compatibility
- Validate error handling and recovery

---

## Test Pyramid

```
           ┌──────────────────┐
           │   E2E Tests      │  5% - MCP client integration
           │   (16-22 hours)  │
           ├──────────────────┤
           │ Integration Tests│  20% - Tool handlers, API client
           │   (22-30 hours)  │
           ├──────────────────┤
           │   Unit Tests     │  75% - Utilities, validators
           │   (14-20 hours)  │
           └──────────────────┘
```

---

## Unit Testing

### Scope
Test individual functions and classes in isolation.

### Coverage Target
90%+ for utilities and core components

### Test Files Structure
```
src/
├── config/
│   └── __tests__/
│       ├── validator.test.ts
│       ├── migration.test.ts
│       └── loader.test.ts
├── utils/
│   └── __tests__/
│       ├── validators.test.ts (✅ Exists - 16 tests)
│       ├── logger.test.ts (✅ Exists - 15 tests)
│       ├── rate-limiter.test.ts (✅ Exists - 20 tests)
│       ├── errors.test.ts (✅ Exists - 9 tests)
│       └── metrics.test.ts (NEW)
├── platform/
│   └── __tests__/
│       ├── detector.test.ts (NEW)
│       ├── path-converter.test.ts (NEW)
│       └── process-spawner.test.ts (NEW)
└── filesystem/
    └── __tests__/
        ├── markdown-parser.test.ts (NEW)
        ├── vault-reader.test.ts (NEW)
        ├── vault-writer.test.ts (NEW)
        └── vault-watcher.test.ts (NEW)
```

### Key Test Cases

#### Configuration Validator Tests
```typescript
describe('Configuration Validator', () => {
  it('should accept valid configuration', () => {
    const config = createValidConfig();
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });
  
  it('should reject configuration with invalid vault path', () => {
    const config = createConfigWithInvalidPath();
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('VAULT_PATH_NOT_FOUND');
  });
  
  it('should reject configuration with duplicate vault names', () => {
    const config = createConfigWithDuplicateNames();
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('unique');
  });
  
  it('should reject configuration with multiple default vaults', () => {
    const config = createConfigWithMultipleDefaults();
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });
});
```

#### Path Validator Tests (Enhanced)
```typescript
describe('Path Validators', () => {
  describe('validatePath', () => {
    it('should accept valid relative paths', () => {
      expect(validatePath('notes/test.md', '/vault')).toEqual({ valid: true });
      expect(validatePath('folder/subfolder/note.md', '/vault')).toEqual({ valid: true });
    });
    
    it('should reject paths with parent directory traversal', () => {
      const result = validatePath('../other-vault/note.md', '/vault');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('traversal');
    });
    
    it('should reject absolute paths', () => {
      const result = validatePath('/etc/passwd', '/vault');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('absolute');
    });
    
    it('should reject paths outside vault boundary', () => {
      const result = validatePath('../../system/file', '/vault');
      expect(result.valid).toBe(false);
    });
  });
});
```

#### Metrics Collector Tests
```typescript
describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  
  beforeEach(() => {
    collector = new MetricsCollector({ aggregationInterval: 1000 });
  });
  
  afterEach(() => {
    collector.stop();
  });
  
  it('should record operation metrics', () => {
    collector.record({
      operation: 'read_note',
      vault: 'test',
      startTime: 1000,
      endTime: 1050,
      duration: 50,
      success: true
    });
    
    const metrics = collector.getMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].operation).toBe('read_note');
  });
  
  it('should calculate percentiles correctly', () => {
    // Record 100 operations with varying durations
    for (let i = 0; i < 100; i++) {
      collector.record({
        operation: 'read_note',
        vault: 'test',
        startTime: i * 100,
        endTime: i * 100 + i,
        duration: i,
        success: true
      });
    }
    
    const metrics = collector.getMetrics();
    expect(metrics[0].latency.p50).toBeCloseTo(50, 5);
    expect(metrics[0].latency.p95).toBeCloseTo(95, 5);
  });
});
```

---

## Integration Testing

### Scope
Test interactions between components and external systems.

### Coverage Target
80%+ for tool handlers and API client

### Test Files Structure
```
tests/
└── integration/
    ├── tools/
    │   ├── read-note.test.ts
    │   ├── create-note.test.ts
    │   ├── edit-note.test.ts
    │   ├── delete-note.test.ts
    │   ├── list-notes.test.ts
    │   ├── search-notes.test.ts
    │   └── ... (all 13 tools)
    ├── api-client/
    │   ├── availability.test.ts
    │   ├── retry-logic.test.ts
    │   └── fallback.test.ts
    └── file-watching/
        ├── native-events.test.ts
        └── polling-mode.test.ts
```

### Key Test Cases

#### Tool Integration Tests
```typescript
describe('read_note Integration', () => {
  let testVault: string;
  let config: ServerConfig;
  
  beforeEach(async () => {
    testVault = await createTestVault('./test-vault', 10);
    config = createTestConfig(testVault);
  });
  
  afterEach(async () => {
    await cleanupTestVault(testVault);
  });
  
  it('should read note with frontmatter', async () => {
    const result = await handleReadNote(config, {
      path: 'note-0.md'
    });
    
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('frontmatter');
    expect(result.content[0].text).toContain('content');
  });
  
  it('should return error for non-existent note', async () => {
    const result = await handleReadNote(config, {
      path: 'non-existent.md'
    });
    
    expect(result.isError).toBe(true);
    const error = JSON.parse(result.content[0].text);
    expect(error.code).toBe('NOTE_NOT_FOUND');
    expect(error.suggestion).toBeTruthy();
  });
});
```

#### API Client Integration Tests
```typescript
describe('ObsidianAPIClient Integration', () => {
  let client: ObsidianAPIClient;
  let mockServer: MockAPIServer;
  
  beforeEach(() => {
    mockServer = createMockAPIServer();
    client = new ObsidianAPIClient({
      url: mockServer.url,
      api_key: 'test-key',
      timeout: 5000
    });
  });
  
  afterEach(() => {
    mockServer.close();
  });
  
  it('should retry on 5xx errors', async () => {
    mockServer.respondWith(500, 'Internal Server Error');
    mockServer.respondWith(500, 'Internal Server Error');
    mockServer.respondWith(200, 'Success');
    
    await expect(client.createNote('test.md', 'content')).resolves.not.toThrow();
    expect(mockServer.requestCount).toBe(3);
  });
  
  it('should not retry on 4xx errors', async () => {
    mockServer.respondWith(404, 'Not Found');
    
    await expect(client.createNote('test.md', 'content')).rejects.toThrow();
    expect(mockServer.requestCount).toBe(1);
  });
  
  it('should fallback to filesystem when API unavailable', async () => {
    mockServer.close(); // Simulate API unavailable
    
    const result = await handleCreateNote(config, {
      path: 'test.md',
      content: 'test content'
    });
    
    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text);
    expect(response.method).toBe('filesystem');
    expect(response.cache_warning).toBe(true);
  });
});
```

---

## Platform-Specific Testing

### Scope
Validate cross-platform compatibility on Windows native and WSL.

### Coverage Target
90%+ pass rate on each platform

### Test Files Structure
```
tests/
└── platform/
    ├── helpers.ts
    ├── windows-native.test.ts
    ├── wsl-linux-fs.test.ts
    └── wsl-windows-fs.test.ts
```

### Platform Detection
```typescript
export function detectTestPlatform(): 'windows' | 'wsl-linux' | 'wsl-windows' {
  if (process.platform === 'win32') {
    return 'windows';
  }
  
  if (isWSL) {
    const testPath = process.env.TEST_VAULT_PATH || process.cwd();
    return testPath.startsWith('/mnt/') ? 'wsl-windows' : 'wsl-linux';
  }
  
  throw new Error('Unsupported platform');
}

export function skipUnlessPlatform(platform: string) {
  const current = detectTestPlatform();
  return current === platform ? test : test.skip;
}
```

### Key Test Cases

#### Windows Native Tests
```typescript
describe('Windows Native Platform', () => {
  const platform = skipUnlessPlatform('windows');
  
  platform('should handle backslash paths correctly', async () => {
    const vault = 'C:\\temp\\test-vault';
    await createTestVault(vault, 10);
    
    const result = await handleReadNote(config, {
      path: 'notes\\test.md'
    });
    
    expect(result.isError).toBe(false);
    await cleanupTestVault(vault);
  });
  
  platform('should use native file watching', async () => {
    const vault = 'C:\\temp\\test-vault';
    const watcher = createVaultWatcher(vault, { enabled: true });
    
    const events: string[] = [];
    watcher.on('change', (path) => events.push(path));
    
    // Create a file
    await fs.writeFile(`${vault}\\new-note.md`, 'content');
    
    // Wait for event
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(events).toContain('new-note.md');
    await watcher.close();
  });
});
```

#### WSL Tests
```typescript
describe('WSL Linux Filesystem', () => {
  const platform = skipUnlessPlatform('wsl-linux');
  
  platform('should handle forward slash paths', async () => {
    const vault = '/home/user/test-vault';
    await createTestVault(vault, 10);
    
    const result = await handleReadNote(config, {
      path: 'notes/test.md'
    });
    
    expect(result.isError).toBe(false);
  });
  
  platform('should launch Windows Obsidian app', async () => {
    const spawned = await spawnObsidian('/mnt/c/Program Files/Obsidian/Obsidian.exe');
    expect(spawned).toBeTruthy();
  });
});

describe('WSL Windows Filesystem', () => {
  const platform = skipUnlessPlatform('wsl-windows');
  
  platform('should convert paths using wslpath', async () => {
    const linuxPath = '/mnt/c/Users/test/vault';
    const windowsPath = await convertToWindowsPath(linuxPath);
    
    expect(windowsPath).toBe('C:\\Users\\test\\vault');
  });
  
  platform('should use polling mode for file watching', async () => {
    const vault = '/mnt/c/temp/test-vault';
    const watcher = createVaultWatcher(vault, {
      enabled: true,
      polling: { interval: 1000 }
    });
    
    expect(watcher.options.usePolling).toBe(true);
  });
});
```

---

## Performance Testing

### Scope
Validate performance targets with various vault sizes.

### Performance Targets
- Read operations: <50ms (p95)
- List 1000 notes: <2s (p95)
- Search 1000 notes: <5s (p95)
- Memory usage: <200MB
- CPU usage (idle): <10%

### Test Files Structure
```
tests/
└── performance/
    ├── benchmark.ts
    ├── fixtures/
    │   ├── generate-vault.ts
    │   └── cleanup.ts
    └── metrics.ts
```

### Key Test Cases

#### Performance Benchmarks
```typescript
describe('Performance Benchmarks', () => {
  const vaultSizes = [100, 500, 1000, 5000];
  
  for (const size of vaultSizes) {
    describe(`Vault with ${size} notes`, () => {
      let vaultPath: string;
      
      beforeAll(async () => {
        vaultPath = await createTestVault(`./perf-vault-${size}`, size);
      });
      
      afterAll(async () => {
        await cleanupTestVault(vaultPath);
      });
      
      it('should read notes within target latency', async () => {
        const measurements = [];
        
        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          await handleReadNote(config, { path: `note-${i % size}.md` });
          const end = performance.now();
          measurements.push(end - start);
        }
        
        const p95 = calculatePercentile(measurements, 95);
        expect(p95).toBeLessThan(50);
      });
      
      it('should list notes within target latency', async () => {
        const start = performance.now();
        await handleListNotes(config, {});
        const end = performance.now();
        
        const duration = end - start;
        const target = size <= 1000 ? 2000 : 5000;
        expect(duration).toBeLessThan(target);
      });
    });
  }
});
```

#### Resource Usage Tests
```typescript
describe('Resource Usage', () => {
  it('should maintain memory usage below 200MB', async () => {
    const vault = await createTestVault('./large-vault', 1000);
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform 100 operations
    for (let i = 0; i < 100; i++) {
      await handleReadNote(config, { path: `note-${i}.md` });
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    
    expect(memoryIncrease).toBeLessThan(200);
  });
  
  it('should maintain CPU usage below 10% when idle', async () => {
    const vault = await createTestVault('./watched-vault', 1000);
    const watcher = createVaultWatcher(vault, { enabled: true });
    
    // Wait for watcher to stabilize
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const cpuUsage = await measureCPUUsage(1000);
    expect(cpuUsage).toBeLessThan(10);
    
    await watcher.close();
  });
});
```

---

## MCP Client Compatibility Testing

### Scope
Validate compatibility with all major MCP clients.

### Test Files Structure
```
tests/
└── clients/
    ├── claude-desktop.test.ts
    ├── cursor.test.ts
    ├── windsurf.test.ts
    ├── zed.test.ts
    └── mcp-protocol.test.ts
```

### Key Test Cases

#### Client Integration Tests
```typescript
describe('Claude Desktop Integration', () => {
  let server: MCPServer;
  let client: MCPClient;
  
  beforeEach(async () => {
    server = await startServer();
    client = await connectClient('claude-desktop');
  });
  
  afterEach(async () => {
    await client.disconnect();
    await server.stop();
  });
  
  it('should list all 13 tools', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveLength(13);
    expect(tools.map(t => t.name)).toContain('read_note');
    expect(tools.map(t => t.name)).toContain('create_note');
  });
  
  it('should execute read_note successfully', async () => {
    const result = await client.callTool('read_note', {
      path: 'test.md'
    });
    
    expect(result.isError).toBe(false);
    expect(result.content).toBeTruthy();
  });
  
  it('should display error messages correctly', async () => {
    const result = await client.callTool('read_note', {
      path: 'non-existent.md'
    });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('NOTE_NOT_FOUND');
  });
});
```

---

## Test Execution

### Local Development
```bash
# Run all unit tests
npm test

# Run unit tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- src/utils/__tests__/validators.test.ts

# Run with coverage
npm run test:coverage
```

### CI/CD Pipeline
```bash
# Run all tests
npm run test:ci

# Run platform-specific tests
npm run test:platform

# Run performance tests
npm run test:performance

# Run E2E tests
npm run test:e2e
```

### Test Execution Matrix

| Test Type | Frequency | Duration | Environment |
|-----------|-----------|----------|-------------|
| Unit Tests | Every commit | <1 min | Local + CI |
| Integration Tests | Every PR | 2-5 min | Local + CI |
| Platform Tests | Before release | 10-15 min | CI (multi-platform) |
| Performance Tests | Weekly | 15-30 min | CI (dedicated runner) |
| E2E Tests | Before release | 20-30 min | CI (multi-client) |

---

## Test Data Management

### Test Vault Generation
```typescript
/**
 * Generate test vault with specified characteristics
 */
export async function createTestVault(
  path: string,
  noteCount: number,
  options: {
    withFrontmatter?: boolean;
    withLinks?: boolean;
    withTags?: boolean;
    avgNoteSize?: number; // KB
  } = {}
): Promise<string> {
  await fs.mkdir(path, { recursive: true });
  
  for (let i = 0; i < noteCount; i++) {
    const content = generateNoteContent(i, options);
    await fs.writeFile(`${path}/note-${i}.md`, content);
  }
  
  return path;
}

function generateNoteContent(
  index: number,
  options: any
): string {
  let content = '';
  
  if (options.withFrontmatter) {
    content += '---\n';
    content += `title: Note ${index}\n`;
    if (options.withTags) {
      content += `tags: [tag-${index % 10}, category-${index % 5}]\n`;
    }
    content += '---\n\n';
  }
  
  content += `# Note ${index}\n\n`;
  content += `This is test note number ${index}.\n\n`;
  
  if (options.withLinks) {
    const linkTarget = (index + 1) % noteCount;
    content += `See also: [[note-${linkTarget}]]\n`;
  }
  
  // Pad to target size
  if (options.avgNoteSize) {
    const targetSize = options.avgNoteSize * 1024;
    while (content.length < targetSize) {
      content += 'Lorem ipsum dolor sit amet. ';
    }
  }
  
  return content;
}
```

---

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
  
  platform-tests:
    strategy:
      matrix:
        os: [windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:platform
  
  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:performance
      - uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: performance-report.json
```

---

## Success Criteria

- [ ] Unit test coverage ≥90%
- [ ] Integration test coverage ≥80%
- [ ] All platform tests passing (≥90%)
- [ ] All performance targets met
- [ ] All 4 MCP clients tested and working
- [ ] CI/CD pipeline green
- [ ] No critical bugs in test results

---

**Document Version:** 1.0  
**Date:** January 2025  
**Status:** Ready for Implementation


---

## Phase 4: Advanced Tools Testing

### Overview

Phase 4 adds 42+ advanced tools that require specialized testing approaches beyond the Phase 3 testing strategy.

**Prerequisites:** Phase 3 testing complete

---

### Additional Test Categories

#### Graph Operations Testing

**Scope:** Test graph algorithms and analysis tools

**Test Files:**
```
tests/
└── phase4/
    └── graph/
        ├── builder.test.ts
        ├── algorithms.test.ts
        ├── centrality.test.ts
        └── clustering.test.ts
```

**Key Test Cases:**

```typescript
describe('Graph Operations', () => {
  describe('get_graph_data', () => {
    it('should build graph from vault notes', async () => {
      const vault = await createTestVault('./graph-vault', 100, {
        withLinks: true
      });
      
      const result = await handleGetGraphData(config, {});
      const graph = JSON.parse(result.content[0].text);
      
      expect(graph.nodes).toHaveLength(100);
      expect(graph.edges.length).toBeGreaterThan(0);
    });
    
    it('should complete within 10s for 1000 notes', async () => {
      const vault = await createTestVault('./large-graph', 1000, {
        withLinks: true
      });
      
      const start = performance.now();
      await handleGetGraphData(config, {});
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10000);
    });
  });
  
  describe('analyze_note_centrality', () => {
    it('should calculate centrality metrics', async () => {
      const result = await handleAnalyzeNoteCentrality(config, {
        path: 'hub-note.md'
      });
      
      const metrics = JSON.parse(result.content[0].text);
      expect(metrics.degree_centrality).toBeGreaterThan(0);
      expect(metrics.betweenness_centrality).toBeDefined();
      expect(metrics.closeness_centrality).toBeDefined();
    });
  });
});
```

**Performance Targets:**
- Graph building: <10s for 1000 notes
- Shortest path: <1s for any two notes
- Centrality calculation: <5s per note
- Cluster detection: <15s for 1000 notes

---

#### Template System Testing

**Scope:** Test template parsing and variable substitution

**Test Files:**
```
tests/
└── phase4/
    └── templates/
        ├── parser.test.ts
        ├── engine.test.ts
        └── variables.test.ts
```

**Key Test Cases:**

```typescript
describe('Template System', () => {
  describe('apply_template', () => {
    it('should substitute built-in variables', async () => {
      const template = `
---
title: {{title}}
date: {{date}}
---

# {{title}}

Created on {{date}} at {{time}}
      `;
      
      const result = await handleApplyTemplate(config, {
        template: 'test-template',
        target_path: 'new-note.md',
        variables: {
          title: 'Test Note'
        }
      });
      
      const note = await readNote('new-note.md');
      expect(note.content).toContain('Test Note');
      expect(note.content).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
    });
    
    it('should handle missing variables gracefully', async () => {
      const result = await handleApplyTemplate(config, {
        template: 'template-with-vars',
        target_path: 'note.md',
        variables: {} // Missing required variables
      });
      
      expect(result.isError).toBe(true);
      const error = JSON.parse(result.content[0].text);
      expect(error.code).toBe('MISSING_VARIABLES');
    });
  });
});
```

**Performance Targets:**
- Template parsing: <10ms
- Variable substitution: <50ms
- Template application: <100ms

---

#### Advanced Search Testing

**Scope:** Test complex search algorithms

**Test Files:**
```
tests/
└── phase4/
    └── search/
        ├── regex.test.ts
        ├── fuzzy.test.ts
        ├── filters.test.ts
        └── ranking.test.ts
```

**Key Test Cases:**

```typescript
describe('Advanced Search', () => {
  describe('search_by_regex', () => {
    it('should find notes matching regex pattern', async () => {
      const result = await handleSearchByRegex(config, {
        query: 'TODO:\\s+\\[.\\]'
      });
      
      const results = JSON.parse(result.content[0].text);
      expect(results.results.length).toBeGreaterThan(0);
    });
    
    it('should handle invalid regex gracefully', async () => {
      const result = await handleSearchByRegex(config, {
        query: '[invalid(regex'
      });
      
      expect(result.isError).toBe(true);
    });
  });
  
  describe('fuzzy_search', () => {
    it('should return results with similarity scores', async () => {
      const result = await handleFuzzySearch(config, {
        query: 'knowlege base' // Intentional typo
      });
      
      const results = JSON.parse(result.content[0].text);
      expect(results.results[0].similarity).toBeGreaterThan(0.7);
      expect(results.results[0].path).toContain('knowledge');
    });
  });
});
```

**Performance Targets:**
- Regex search: <5s for 1000 notes
- Fuzzy search: <5s for 1000 notes
- Tag combination: <2s for 1000 notes
- Frontmatter search: <3s for 1000 notes

---

#### Canvas Operations Testing

**Scope:** Test canvas file manipulation

**Test Files:**
```
tests/
└── phase4/
    └── canvas/
        ├── parser.test.ts
        ├── builder.test.ts
        └── manipulation.test.ts
```

**Key Test Cases:**

```typescript
describe('Canvas Operations', () => {
  describe('read_canvas', () => {
    it('should parse canvas file correctly', async () => {
      const result = await handleReadCanvas(config, {
        path: 'test-canvas.canvas'
      });
      
      const canvas = JSON.parse(result.content[0].text);
      expect(canvas.nodes).toBeDefined();
      expect(canvas.edges).toBeDefined();
    });
  });
  
  describe('create_canvas', () => {
    it('should create valid canvas file', async () => {
      const result = await handleCreateCanvas(config, {
        path: 'new-canvas.canvas',
        nodes: [
          { id: '1', type: 'text', x: 0, y: 0, width: 200, height: 100 }
        ]
      });
      
      expect(result.isError).toBe(false);
      
      // Verify file is valid JSON
      const content = await fs.readFile('new-canvas.canvas', 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });
});
```

---

#### Bulk Operations Testing

**Scope:** Test multi-note operations

**Test Files:**
```
tests/
└── phase4/
    └── bulk/
        ├── processor.test.ts
        ├── progress.test.ts
        └── safety.test.ts
```

**Key Test Cases:**

```typescript
describe('Bulk Operations', () => {
  describe('bulk_update_frontmatter', () => {
    it('should update multiple notes', async () => {
      const vault = await createTestVault('./bulk-vault', 50);
      
      const result = await handleBulkUpdateFrontmatter(config, {
        filter: { folder: 'test' },
        updates: { status: 'archived' }
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success_count).toBe(50);
      expect(response.failure_count).toBe(0);
    });
    
    it('should require confirmation for >100 notes', async () => {
      const vault = await createTestVault('./large-bulk', 150);
      
      const result = await handleBulkDelete(config, {
        filter: { folder: 'test' },
        confirm: false
      });
      
      expect(result.isError).toBe(true);
      const error = JSON.parse(result.content[0].text);
      expect(error.code).toBe('CONFIRMATION_REQUIRED');
    });
    
    it('should support dry-run mode', async () => {
      const result = await handleBulkUpdateFrontmatter(config, {
        filter: { folder: 'test' },
        updates: { status: 'archived' },
        dry_run: true
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.affected_notes).toBeDefined();
      
      // Verify no actual changes
      const note = await readNote('test/note-1.md');
      expect(note.frontmatter.status).not.toBe('archived');
    });
  });
});
```

---

### Phase 4 Test Coverage Targets

| Component | Target Coverage |
|-----------|----------------|
| Graph algorithms | 90%+ |
| Template engine | 85%+ |
| Search algorithms | 85%+ |
| Canvas operations | 80%+ |
| Bulk operations | 90%+ (safety critical) |
| Attachment management | 80%+ |

---

### Phase 4 Performance Benchmarks

```typescript
describe('Phase 4 Performance Benchmarks', () => {
  const vaultSizes = [100, 500, 1000];
  
  for (const size of vaultSizes) {
    describe(`Vault with ${size} notes`, () => {
      it('should build graph within target time', async () => {
        const vault = await createTestVault(`./perf-${size}`, size, {
          withLinks: true
        });
        
        const start = performance.now();
        await handleGetGraphData(config, {});
        const duration = performance.now() - start;
        
        const target = size <= 1000 ? 10000 : 15000;
        expect(duration).toBeLessThan(target);
      });
      
      it('should perform fuzzy search within target time', async () => {
        const start = performance.now();
        await handleFuzzySearch(config, { query: 'test query' });
        const duration = performance.now() - start;
        
        expect(duration).toBeLessThan(5000);
      });
    });
  }
});
```

---

### Phase 4 Integration Tests

#### End-to-End Workflows

```typescript
describe('Phase 4 E2E Workflows', () => {
  it('should create note from template and add to graph', async () => {
    // 1. Create note from template
    const createResult = await handleCreateFromTemplate(config, {
      template: 'project-template',
      path: 'projects/new-project.md',
      variables: { title: 'New Project' }
    });
    
    expect(createResult.isError).toBe(false);
    
    // 2. Verify note in graph
    const graphResult = await handleGetGraphData(config, {});
    const graph = JSON.parse(graphResult.content[0].text);
    
    const node = graph.nodes.find(n => n.path === 'projects/new-project.md');
    expect(node).toBeDefined();
  });
  
  it('should search, bulk update, and verify changes', async () => {
    // 1. Search for notes
    const searchResult = await handleSearchByTag(config, {
      tags: ['old-project']
    });
    
    const results = JSON.parse(searchResult.content[0].text);
    const paths = results.results.map(r => r.path);
    
    // 2. Bulk update
    await handleBulkUpdateFrontmatter(config, {
      filter: { tag: 'old-project' },
      updates: { status: 'archived' }
    });
    
    // 3. Verify changes
    for (const path of paths) {
      const note = await readNote(path);
      expect(note.frontmatter.status).toBe('archived');
    }
  });
});
```

---

### Phase 4 Test Execution

```bash
# Run Phase 4 unit tests
npm run test:phase4

# Run Phase 4 integration tests
npm run test:phase4:integration

# Run Phase 4 performance tests
npm run test:phase4:performance

# Run all Phase 4 tests
npm run test:phase4:all
```

---

### Phase 4 CI/CD Integration

Add to GitHub Actions workflow:

```yaml
phase4-tests:
  runs-on: ubuntu-latest
  needs: [unit-tests, integration-tests]
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - run: npm ci
    - run: npm run test:phase4:all
    - uses: actions/upload-artifact@v3
      with:
        name: phase4-test-results
        path: phase4-test-results.json
```

---

### Phase 4 Success Criteria

Phase 4 testing will be considered complete when:

- [ ] All Phase 4 unit tests passing
- [ ] All Phase 4 integration tests passing
- [ ] Performance benchmarks meet targets
- [ ] Test coverage ≥80% for all Phase 4 tools
- [ ] No critical bugs in Phase 4 features
- [ ] Documentation includes test examples
- [ ] CI/CD pipeline includes Phase 4 tests

---

**Document Version:** 2.0  
**Date:** January 2025  
**Status:** Complete (Phase 3 + Phase 4)  
**Next Step:** Implement Phase 4 tests alongside features
