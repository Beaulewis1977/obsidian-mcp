# Design Document: Obsidian MCP Server - Production Readiness & Advanced Tools

## Overview

This design document outlines the technical approach for implementing both:
- **Phase 3:** Production readiness improvements (existing 13 tools)
- **Phase 4:** Advanced tool additions (42+ new tools)

### Phase 3 Focus (Production Readiness)

1. **Testing Infrastructure** - Comprehensive test suites for platform validation
2. **Feature Completion** - Finishing Phase 2 features and enhancing reliability
3. **Observability** - Monitoring, logging, and documentation improvements

### Phase 4 Focus (Advanced Tools)

1. **Graph Operations** - Knowledge graph analysis and link discovery
2. **Template System** - Advanced template support with variables
3. **Advanced Search** - Complex filtering and fuzzy matching
4. **Canvas Operations** - Programmatic canvas manipulation
5. **Bulk Operations** - Multi-note operations for efficiency
6. **Additional Tools** - Attachments, Dataview, History, Workspaces, Plugins

The design maintains backward compatibility with existing deployments while adding robust testing, validation, monitoring capabilities, and advanced features.

---

## Architecture

### High-Level Architecture

The improvements build upon the existing dual-access architecture without requiring structural changes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Testing & Validation Layer (NEW)             │
│  - Platform-specific test suites                                │
│  - Performance benchmarking                                      │
│  - MCP client compatibility tests                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────────────┐
│                   Observability Layer (ENHANCED)                │
│  - Structured logging with context                              │
│  - Performance metrics collection                               │
│  - Health check endpoints                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────────────┐
│                   Existing MCP Server Core                      │
│  (No structural changes - enhancements only)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Enhancements


#### 1. Configuration Validation Module (NEW)

**Purpose:** Validate configuration files using Zod schemas before server startup

**Components:**
- `src/config/validator.ts` - Zod schema definitions for config validation
- `src/config/migration.ts` - Config version migration utilities
- `src/config/defaults.ts` - Default configuration values

**Key Features:**
- Validate vault paths exist and are accessible
- Validate API key format
- Validate rate limiting parameters
- Provide detailed error messages with suggestions
- Support config version migration

#### 2. Platform Testing Framework (NEW)

**Purpose:** Automated testing across Windows native and WSL environments

**Components:**
- `tests/platform/windows-native.test.ts` - Windows-specific tests
- `tests/platform/wsl-linux-fs.test.ts` - WSL with Linux filesystem tests
- `tests/platform/wsl-windows-fs.test.ts` - WSL with Windows filesystem tests
- `tests/platform/helpers.ts` - Platform detection and test utilities

**Key Features:**
- Detect current platform automatically
- Skip tests not applicable to current platform
- Test path conversion utilities
- Test file watching on different filesystems
- Test process spawning cross-platform

#### 3. Performance Benchmarking Suite (NEW)

**Purpose:** Measure and validate performance targets

**Components:**
- `tests/performance/benchmark.ts` - Performance test runner
- `tests/performance/fixtures/` - Test vaults with varying sizes
- `tests/performance/metrics.ts` - Metrics collection and reporting

**Key Features:**
- Generate test vaults (100, 500, 1000, 5000 notes)
- Measure operation latency (p50, p95, p99)
- Measure throughput (requests/second)
- Measure resource usage (CPU, memory)
- Generate performance reports


#### 4. MCP Client Compatibility Tests (NEW)

**Purpose:** Validate compatibility with all major MCP clients

**Components:**
- `tests/clients/claude-desktop.test.ts` - Claude Desktop integration tests
- `tests/clients/cursor.test.ts` - Cursor integration tests
- `tests/clients/windsurf.test.ts` - Windsurf integration tests
- `tests/clients/zed.test.ts` - Zed integration tests
- `tests/clients/mcp-protocol.test.ts` - MCP protocol compliance tests

**Key Features:**
- Test stdio transport initialization
- Test tool discovery
- Test tool execution
- Test error handling
- Validate response formats

#### 5. Enhanced Observability (ENHANCED)

**Purpose:** Improve logging, metrics, and monitoring capabilities

**Components:**
- `src/utils/metrics.ts` - Performance metrics collection
- `src/utils/health.ts` - Health check utilities
- Enhanced `src/utils/logger.ts` - Structured logging with context

**Key Features:**
- Operation timing metrics
- Rate limit usage metrics
- Error rate tracking
- Resource usage monitoring
- Structured log context (request ID, vault, tool)

#### 6. Documentation Generator (NEW)

**Purpose:** Automatically generate documentation from code

**Components:**
- `scripts/generate-docs.ts` - Documentation generation script
- `scripts/validate-docs.ts` - Documentation validation script
- `scripts/update-status.ts` - Update implementation status markers

**Key Features:**
- Extract tool definitions from code
- Generate API reference from schemas
- Update implementation status badges
- Validate documentation links
- Check code-documentation alignment

---

## Data Models

### Configuration Schema (ENHANCED)


```typescript
import { z } from 'zod';

// Vault configuration schema
const VaultConfigSchema = z.object({
  name: z.string().min(1, 'Vault name cannot be empty'),
  path: z.string().min(1, 'Vault path cannot be empty'),
  default: z.boolean().default(false),
  obsidian_api: z.object({
    enabled: z.boolean(),
    url: z.string().url('Invalid API URL'),
    api_key: z.string().min(10, 'API key too short'),
    verify_ssl: z.boolean().default(false),
    timeout: z.number().min(1000).max(30000).optional(),
    retry: z.object({
      enabled: z.boolean().default(true),
      max_retries: z.number().min(0).max(5).default(2),
      initial_delay: z.number().min(100).max(5000).default(1000),
      max_delay: z.number().min(1000).max(30000).default(10000)
    }).optional()
  }).optional()
});

// Rate limiting schema
const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(true),
  backend: z.enum(['memory', 'redis']).default('memory'),
  redis: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    password: z.string().optional()
  }).optional(),
  limits: z.object({
    global: z.object({
      requests_per_minute: z.number().min(1).max(10000),
      requests_per_hour: z.number().min(1).max(100000)
    }),
    read: z.object({
      requests_per_minute: z.number().min(1).max(10000),
      requests_per_hour: z.number().min(1).max(100000)
    }),
    write: z.object({
      requests_per_minute: z.number().min(1).max(1000),
      requests_per_hour: z.number().min(1).max(10000)
    }),
    tools: z.record(z.object({
      requests_per_minute: z.number().min(1).max(1000).optional(),
      requests_per_hour: z.number().min(1).max(10000).optional()
    })).optional()
  }),
  graceful: z.object({
    warn_at_percentage: z.number().min(50).max(100).default(80),
    queue_requests: z.boolean().default(false),
    max_queue_size: z.number().min(1).max(1000).default(100),
    queue_timeout_ms: z.number().min(1000).max(60000).default(30000)
  }).optional()
});

// File watching schema
const FileWatchingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  polling: z.object({
    interval: z.number().min(100).max(5000).default(1000),
    binary_interval: z.number().min(100).max(10000).default(2000)
  }),
  stability_threshold: z.number().min(100).max(10000).default(2000),
  ignored_patterns: z.array(z.string()).optional()
});

// Main server configuration schema
const ServerConfigSchema = z.object({
  version: z.string(),
  vaults: z.array(VaultConfigSchema).min(1, 'At least one vault must be configured'),
  rate_limiting: RateLimitConfigSchema.optional(),
  file_watching: FileWatchingConfigSchema.optional(),
  limits: z.object({
    max_file_size: z.number().min(1024).max(100 * 1024 * 1024),
    warning_threshold: z.number().min(1024).max(10 * 1024 * 1024)
  }).optional(),
  features: z.object({
    backup_on_delete: z.boolean().default(false),
    advisory_locking: z.boolean().default(false)
  }).optional()
}).refine(
  (config) => {
    // Ensure only one default vault
    const defaultVaults = config.vaults.filter(v => v.default);
    return defaultVaults.length <= 1;
  },
  { message: 'Only one vault can be marked as default' }
).refine(
  (config) => {
    // Ensure unique vault names
    const names = config.vaults.map(v => v.name);
    return names.length === new Set(names).size;
  },
  { message: 'Vault names must be unique' }
);
```

### Performance Metrics Model (NEW)

```typescript
interface PerformanceMetrics {
  operation: string;
  vault: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: {
    fileSize?: number;
    noteCount?: number;
    cacheHit?: boolean;
  };
}

interface AggregatedMetrics {
  operation: string;
  count: number;
  successRate: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: number; // requests per second
}
```

### Test Result Model (NEW)

```typescript
interface PlatformTestResult {
  platform: 'windows' | 'wsl-linux' | 'wsl-windows';
  testSuite: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: Array<{
    test: string;
    error: string;
    stack?: string;
  }>;
}

interface PerformanceBenchmarkResult {
  vaultSize: number; // number of notes
  operation: string;
  metrics: {
    latency: { p50: number; p95: number; p99: number };
    throughput: number;
    resourceUsage: {
      cpu: number; // percentage
      memory: number; // MB
    };
  };
  passed: boolean;
  target: {
    latency?: number;
    throughput?: number;
  };
}
```

---

## Component Design

### 1. Configuration Validator

**File:** `src/config/validator.ts`

**Purpose:** Validate configuration before server startup

**Key Functions:**

```typescript
/**
 * Validate configuration against schema
 */
export async function validateConfig(config: unknown): Promise<ValidationResult> {
  try {
    const validated = ServerConfigSchema.parse(config);
    
    // Additional validation
    await validateVaultPaths(validated.vaults);
    await validateApiConnections(validated.vaults);
    
    return { valid: true, config: validated };
  } catch (error) {
    return {
      valid: false,
      errors: formatValidationErrors(error)
    };
  }
}

/**
 * Validate vault paths exist and are accessible
 */
async function validateVaultPaths(vaults: VaultConfig[]): Promise<void> {
  for (const vault of vaults) {
    const exists = await fs.access(vault.path).then(() => true).catch(() => false);
    if (!exists) {
      throw new ValidationError(
        `Vault path does not exist: ${vault.path}`,
        'VAULT_PATH_NOT_FOUND',
        `Create the directory or update the path in configuration`
      );
    }
  }
}

/**
 * Test API connections (optional, with timeout)
 */
async function validateApiConnections(vaults: VaultConfig[]): Promise<void> {
  for (const vault of vaults) {
    if (vault.obsidian_api?.enabled) {
      try {
        await testApiConnection(vault.obsidian_api, 2000);
      } catch (error) {
        // Log warning but don't fail validation
        logger.warn({ vault: vault.name, error }, 'API connection test failed');
      }
    }
  }
}
```


### 2. Platform Testing Framework

**File:** `tests/platform/helpers.ts`

**Purpose:** Utilities for platform-specific testing

**Key Functions:**

```typescript
/**
 * Detect current platform
 */
export function detectTestPlatform(): 'windows' | 'wsl-linux' | 'wsl-windows' {
  if (process.platform === 'win32') {
    return 'windows';
  }
  
  if (isWSL) {
    // Check if test vault is on Windows filesystem
    const testPath = process.env.TEST_VAULT_PATH || process.cwd();
    if (testPath.startsWith('/mnt/')) {
      return 'wsl-windows';
    }
    return 'wsl-linux';
  }
  
  throw new Error('Unsupported platform for testing');
}

/**
 * Skip test if not on specified platform
 */
export function skipUnlessPlatform(platform: string) {
  const current = detectTestPlatform();
  if (current !== platform) {
    return test.skip;
  }
  return test;
}

/**
 * Create test vault with specified number of notes
 */
export async function createTestVault(
  path: string,
  noteCount: number,
  options?: {
    withFrontmatter?: boolean;
    withLinks?: boolean;
    withTags?: boolean;
  }
): Promise<void> {
  await fs.mkdir(path, { recursive: true });
  
  for (let i = 0; i < noteCount; i++) {
    const notePath = `${path}/note-${i}.md`;
    const content = generateNoteContent(i, options);
    await fs.writeFile(notePath, content);
  }
}

/**
 * Clean up test vault
 */
export async function cleanupTestVault(path: string): Promise<void> {
  await fs.rm(path, { recursive: true, force: true });
}
```

**Test Structure:**

```typescript
// tests/platform/windows-native.test.ts
describe('Windows Native Platform', () => {
  const platform = skipUnlessPlatform('windows');
  
  platform('should handle backslash paths', async () => {
    const vault = await createTestVault('C:\\temp\\test-vault', 10);
    // Test operations with backslash paths
  });
  
  platform('should use native file watching', async () => {
    // Test file watching with native events
  });
  
  platform('should launch Obsidian executable', async () => {
    // Test process spawning
  });
});
```

### 3. Performance Benchmarking

**File:** `tests/performance/benchmark.ts`

**Purpose:** Measure and validate performance targets

**Key Functions:**

```typescript
/**
 * Run performance benchmark suite
 */
export async function runBenchmarks(
  vaultSizes: number[] = [100, 500, 1000, 5000]
): Promise<BenchmarkReport> {
  const results: PerformanceBenchmarkResult[] = [];
  
  for (const size of vaultSizes) {
    const vaultPath = await createTestVault(`./test-vault-${size}`, size);
    
    // Benchmark read operations
    results.push(await benchmarkOperation('read_note', vaultPath, {
      iterations: 100,
      target: { latency: 50 }
    }));
    
    // Benchmark list operations
    results.push(await benchmarkOperation('list_notes', vaultPath, {
      iterations: 10,
      target: { latency: size <= 1000 ? 2000 : 5000 }
    }));
    
    // Benchmark search operations
    results.push(await benchmarkOperation('search_notes', vaultPath, {
      iterations: 10,
      target: { latency: 5000 }
    }));
    
    await cleanupTestVault(vaultPath);
  }
  
  return generateReport(results);
}

/**
 * Benchmark specific operation
 */
async function benchmarkOperation(
  operation: string,
  vaultPath: string,
  options: BenchmarkOptions
): Promise<PerformanceBenchmarkResult> {
  const measurements: number[] = [];
  const startMemory = process.memoryUsage().heapUsed;
  const startCpu = process.cpuUsage();
  
  for (let i = 0; i < options.iterations; i++) {
    const start = performance.now();
    await executeOperation(operation, vaultPath);
    const end = performance.now();
    measurements.push(end - start);
  }
  
  const endMemory = process.memoryUsage().heapUsed;
  const endCpu = process.cpuUsage(startCpu);
  
  return {
    operation,
    vaultSize: await countNotes(vaultPath),
    metrics: {
      latency: calculatePercentiles(measurements),
      throughput: options.iterations / (sum(measurements) / 1000),
      resourceUsage: {
        cpu: (endCpu.user + endCpu.system) / 1000000,
        memory: (endMemory - startMemory) / 1024 / 1024
      }
    },
    passed: checkTargets(measurements, options.target)
  };
}
```

### 4. Enhanced Logging

**File:** `src/utils/logger.ts` (ENHANCED)

**Purpose:** Add structured logging with context

**Enhancements:**

```typescript
import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// Request context storage
const requestContext = new AsyncLocalStorage<RequestContext>();

interface RequestContext {
  requestId: string;
  tool?: string;
  vault?: string;
  startTime: number;
}

/**
 * Create logger with context
 */
export function createLogger() {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname
      })
    },
    mixin: () => {
      const context = requestContext.getStore();
      return context ? {
        requestId: context.requestId,
        tool: context.tool,
        vault: context.vault
      } : {};
    },
    redact: {
      paths: ['*.api_key', '*.password', 'headers.authorization'],
      censor: '[REDACTED]'
    }
  });
}

/**
 * Run operation with request context
 */
export function withRequestContext<T>(
  context: Partial<RequestContext>,
  fn: () => Promise<T>
): Promise<T> {
  const fullContext: RequestContext = {
    requestId: generateRequestId(),
    startTime: Date.now(),
    ...context
  };
  
  return requestContext.run(fullContext, async () => {
    try {
      const result = await fn();
      logOperationComplete(fullContext);
      return result;
    } catch (error) {
      logOperationError(fullContext, error);
      throw error;
    }
  });
}

/**
 * Log operation completion with timing
 */
function logOperationComplete(context: RequestContext) {
  const duration = Date.now() - context.startTime;
  logger.info({
    duration,
    tool: context.tool,
    vault: context.vault
  }, 'Operation completed');
}
```

### 5. Metrics Collection

**File:** `src/utils/metrics.ts` (NEW)

**Purpose:** Collect and aggregate performance metrics

**Key Functions:**

```typescript
/**
 * Metrics collector
 */
export class MetricsCollector {
  private metrics: PerformanceMetrics[] = [];
  private aggregationInterval: NodeJS.Timeout;
  
  constructor(private options: MetricsOptions = {}) {
    this.aggregationInterval = setInterval(
      () => this.aggregate(),
      options.aggregationInterval || 60000
    );
  }
  
  /**
   * Record operation metric
   */
  record(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Trim old metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }
  
  /**
   * Aggregate metrics by operation
   */
  private aggregate(): AggregatedMetrics[] {
    const grouped = groupBy(this.metrics, 'operation');
    
    return Object.entries(grouped).map(([operation, metrics]) => ({
      operation,
      count: metrics.length,
      successRate: metrics.filter(m => m.success).length / metrics.length,
      latency: calculatePercentiles(metrics.map(m => m.duration)),
      throughput: metrics.length / (this.options.aggregationInterval! / 1000)
    }));
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): AggregatedMetrics[] {
    return this.aggregate();
  }
  
  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
  }
  
  /**
   * Stop collection
   */
  stop(): void {
    clearInterval(this.aggregationInterval);
  }
}

// Global metrics collector
export const metrics = new MetricsCollector();
```

---

## Error Handling

### Enhanced Error Response Structure

```typescript
interface EnhancedErrorResponse {
  error: string;
  details: string;
  code: string;
  suggestion: string;
  context?: {
    operation: string;
    vault?: string;
    path?: string;
  };
  recovery?: {
    fallback_used?: boolean;
    alternative_method?: string;
    retry_after?: number;
  };
  documentation?: string; // Link to relevant docs
}
```

### Error Categories with Recovery

```typescript
const ERROR_HANDLERS = {
  NOTE_NOT_FOUND: (context) => ({
    error: 'Note not found',
    details: `No note exists at path '${context.path}' in vault '${context.vault}'`,
    code: 'NOTE_NOT_FOUND',
    suggestion: 'Check the path and vault name. Use list_notes to see available notes.',
    documentation: 'https://docs.example.com/errors/note-not-found'
  }),
  
  API_UNAVAILABLE: (context) => ({
    error: 'Obsidian API unavailable',
    details: 'Could not connect to Obsidian Local REST API',
    code: 'API_UNAVAILABLE',
    suggestion: 'Ensure Obsidian is running and Local REST API plugin is enabled',
    recovery: {
      fallback_used: true,
      alternative_method: 'filesystem',
      retry_after: 5000
    },
    documentation: 'https://docs.example.com/errors/api-unavailable'
  }),
  
  RATE_LIMIT_EXCEEDED: (context) => ({
    error: 'Rate limit exceeded',
    details: `Exceeded ${context.limit} requests per ${context.window}`,
    code: 'RATE_LIMIT_EXCEEDED',
    suggestion: 'Wait before making more requests or increase rate limits in configuration',
    recovery: {
      retry_after: context.retryAfter
    },
    documentation: 'https://docs.example.com/configuration/rate-limiting'
  })
};
```

---

## Testing Strategy

### Test Pyramid

```
        ┌─────────────────┐
        │  E2E Tests (5%) │  ← MCP client integration
        ├─────────────────┤
        │ Integration (20%)│  ← Tool handlers, API client
        ├─────────────────┤
        │  Unit Tests (75%)│  ← Utilities, validators, parsers
        └─────────────────┘
```

### Test Coverage Targets

- **Overall:** 85%+
- **Critical paths:** 95%+ (config, validators, API client)
- **Utilities:** 90%+
- **Tool handlers:** 80%+
- **Platform-specific:** 75%+

### Test Execution Strategy

```bash
# Unit tests (fast, run on every commit)
npm test

# Integration tests (medium, run on PR)
npm run test:integration

# Platform tests (slow, run on release)
npm run test:platform

# Performance tests (slow, run weekly)
npm run test:performance

# E2E tests (very slow, run before release)
npm run test:e2e
```

---

## Deployment Strategy

### Pre-Release Checklist

1. ✅ All tests passing (unit, integration, platform)
2. ✅ Performance benchmarks meet targets
3. ✅ Documentation updated and validated
4. ✅ Security audit passed
5. ✅ MCP client compatibility verified
6. ✅ Migration guide prepared
7. ✅ Release notes written

### Rollout Plan

**Phase 1: Alpha Release (Week 1-2)**
- Internal testing
- Small vault testing (<100 notes)
- Single platform (Windows or WSL)
- Limited users

**Phase 2: Beta Release (Week 3-4)**
- Public beta
- Medium vault testing (100-500 notes)
- Multi-platform testing
- Feedback collection

**Phase 3: Production Release (Week 5-6)**
- Full production release
- Large vault support (1000+ notes)
- All platforms supported
- Complete documentation

---

## Performance Optimization

### Caching Strategy (Future)

```typescript
interface CacheConfig {
  enabled: boolean;
  maxSize: number; // MB
  ttl: number; // seconds
  strategy: 'lru' | 'lfu';
}

class NoteCache {
  private cache: Map<string, CachedNote>;
  
  get(path: string): CachedNote | undefined {
    const cached = this.cache.get(path);
    if (cached && !this.isExpired(cached)) {
      return cached;
    }
    return undefined;
  }
  
  set(path: string, note: Note): void {
    this.cache.set(path, {
      note,
      timestamp: Date.now(),
      hits: 0
    });
    this.evictIfNeeded();
  }
  
  invalidate(path: string): void {
    this.cache.delete(path);
  }
}
```

### Resource Management

```typescript
/**
 * Resource limits and monitoring
 */
interface ResourceLimits {
  maxMemory: number; // MB
  maxCpu: number; // percentage
  maxFileHandles: number;
}

class ResourceMonitor {
  private limits: ResourceLimits;
  
  checkLimits(): ResourceStatus {
    const memory = process.memoryUsage().heapUsed / 1024 / 1024;
    const cpu = process.cpuUsage();
    
    return {
      memory: {
        current: memory,
        limit: this.limits.maxMemory,
        percentage: (memory / this.limits.maxMemory) * 100
      },
      warnings: this.generateWarnings(memory, cpu)
    };
  }
}
```

---

## Security Considerations

### Enhanced Security Measures

1. **Input Sanitization:**
   - Validate all paths before operations
   - Sanitize user-provided content
   - Prevent command injection in process spawning

2. **API Key Management:**
   - Never log API keys
   - Rotate keys periodically
   - Support multiple key formats

3. **Rate Limiting:**
   - Per-vault rate limits
   - Per-tool rate limits
   - Graceful degradation

4. **Audit Logging:**
   - Log all write operations
   - Log authentication attempts
   - Log rate limit violations

---

## Documentation Updates

### Documentation Structure

```
docs/
├── README.md (✅ Implemented, 🚧 Partial, 📋 Planned)
├── QUICKSTART.md
├── SETUP_GUIDE.md
├── API_REFERENCE.md
├── ARCHITECTURE.md
├── TROUBLESHOOTING.md
├── PERFORMANCE.md (NEW)
├── TESTING.md (NEW)
├── MIGRATION_GUIDE.md (NEW)
└── CONTRIBUTING.md
```

### Auto-Generated Documentation

```typescript
/**
 * Generate API reference from tool definitions
 */
export function generateApiReference(): string {
  const tools = getToolDefinitions();
  
  return tools.map(tool => `
## ${tool.name}

${tool.description}

**Status:** ${getImplementationStatus(tool.name)}

**Input Schema:**
\`\`\`typescript
${JSON.stringify(tool.inputSchema, null, 2)}
\`\`\`

**Example:**
\`\`\`typescript
${getToolExample(tool.name)}
\`\`\`
  `).join('\n\n');
}
```

---

## Migration Path

### Configuration Migration

```typescript
/**
 * Migrate configuration from v1.0 to v2.0
 */
export function migrateConfig(oldConfig: any): ServerConfig {
  // Handle version-specific migrations
  if (oldConfig.version === '1.0') {
    return {
      ...oldConfig,
      version: '2.0',
      // Add new fields with defaults
      file_watching: {
        enabled: true,
        polling: { interval: 1000, binary_interval: 2000 },
        stability_threshold: 2000
      }
    };
  }
  
  return oldConfig;
}
```

---

## Success Metrics

### Key Performance Indicators

1. **Test Coverage:** 85%+
2. **Platform Test Pass Rate:** 90%+
3. **Performance Targets Met:** 100%
4. **MCP Client Compatibility:** 4/4 clients working
5. **Documentation Accuracy:** 100% (no outdated info)
6. **User-Reported Bugs:** <5 critical bugs in first month
7. **Server Uptime:** 99.9%+

---

**Document Version:** 1.0  
**Date:** January 2025  
**Status:** Ready for Review  
**Next Step:** Implementation Tasks


---

## Phase 4: Advanced Tools Design

### Overview

Phase 4 adds 42+ advanced tools across 10 categories, building on the production-ready foundation from Phase 3. The design follows the same architectural patterns established in Phase 3 but extends functionality significantly.

**Prerequisites:** Phase 3 complete (production readiness achieved)

---

### Architecture Extensions

#### Graph Operations Layer (NEW)

**Purpose:** Analyze knowledge graph and discover connections

**Components:**
- `src/graph/builder.ts` - Build graph from vault notes
- `src/graph/algorithms.ts` - Graph algorithms (shortest path, centrality, clustering)
- `src/graph/analyzer.ts` - Graph analysis and metrics

**Key Features:**
- Build graph structure from wikilinks and embeds
- Calculate centrality metrics (degree, betweenness, closeness, PageRank)
- Find shortest paths between notes
- Detect note clusters/communities
- Identify hub notes and orphans

**Libraries:**
- Consider using `graphology` for graph data structures
- Implement custom algorithms for Obsidian-specific needs

**Performance:**
- Target: <10 seconds for 1000-note vaults
- Use caching for frequently accessed graph data
- Lazy loading for large graphs

---

#### Template Engine (NEW)

**Purpose:** Advanced template support with variable substitution

**Components:**
- `src/templates/parser.ts` - Parse template syntax
- `src/templates/engine.ts` - Variable substitution engine
- `src/templates/variables.ts` - Built-in and custom variables

**Key Features:**
- Simple template syntax (avoid Templater complexity)
- Built-in variables: `{{date}}`, `{{time}}`, `{{title}}`
- Custom variable support
- Template validation
- Error handling for missing variables

**Template Syntax:**
```markdown
---
title: {{title}}
date: {{date}}
tags: [{{tags}}]
---

# {{title}}

Created on {{date}} at {{time}}

{{content}}
```

**Performance:**
- Target: <100ms for template application
- Simple string substitution (no complex logic)

---

#### Advanced Search Engine (NEW)

**Purpose:** Complex search beyond simple text matching

**Components:**
- `src/search/regex-engine.ts` - Regex search implementation
- `src/search/fuzzy-matcher.ts` - Fuzzy matching algorithm
- `src/search/query-parser.ts` - Parse complex queries
- `src/search/ranker.ts` - Result ranking and scoring

**Key Features:**
- Regex pattern matching
- Fuzzy search with similarity scores
- Tag combination queries (AND/OR logic)
- Date range filtering
- Frontmatter-based search
- File size and word count filtering

**Algorithms:**
- Levenshtein distance for fuzzy matching
- TF-IDF for relevance scoring
- Regex engine with performance limits

**Performance:**
- Target: <5 seconds for 1000-note vaults
- Index frequently searched fields
- Limit regex complexity to prevent DoS

---

#### Canvas Operations (NEW)

**Purpose:** Programmatic canvas file manipulation

**Components:**
- `src/canvas/parser.ts` - Parse .canvas JSON format
- `src/canvas/builder.ts` - Build canvas structures
- `src/canvas/validator.ts` - Validate canvas format

**Key Features:**
- Read canvas files (nodes, edges, positions)
- Create new canvases
- Add/update/delete nodes
- Add/update/delete edges
- Validate canvas structure

**Canvas Format:**
```typescript
interface Canvas {
  nodes: Array<{
    id: string;
    type: 'text' | 'file' | 'link' | 'group';
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    file?: string;
    color?: string;
  }>;
  edges: Array<{
    id: string;
    fromNode: string;
    toNode: string;
    fromSide?: string;
    toSide?: string;
  }>;
}
```

---

#### Bulk Operations Framework (NEW)

**Purpose:** Efficient multi-note operations

**Components:**
- `src/bulk/processor.ts` - Batch operation processor
- `src/bulk/progress.ts` - Progress reporting
- `src/bulk/validator.ts` - Dry-run and validation

**Key Features:**
- Batch processing with progress updates
- Dry-run mode for safety
- Confirmation requirements for destructive operations
- Partial failure handling
- Rollback capability (optional)

**Safety Measures:**
- Require confirmation for >100 notes
- Support dry-run mode
- Report successes and failures separately
- Log all bulk operations

**Performance:**
- Process notes in batches of 50
- Provide progress updates every 10%
- Timeout protection (max 5 minutes)

---

#### Attachment Management (NEW)

**Purpose:** Organize and maintain media files

**Components:**
- `src/attachments/scanner.ts` - Scan vault for attachments
- `src/attachments/indexer.ts` - Build attachment index
- `src/attachments/analyzer.ts` - Find unused/broken attachments

**Key Features:**
- List all attachments with metadata
- Find attachment references in notes
- Detect unused attachments
- Detect broken links
- Move attachments and update references

**Supported Types:**
- Images: .png, .jpg, .gif, .svg
- Documents: .pdf, .doc, .docx
- Media: .mp3, .mp4, .mov
- Archives: .zip, .tar, .gz

---

### Data Models (Phase 4)

#### Graph Data Model

```typescript
interface GraphNode {
  path: string;
  title: string;
  outgoingLinks: string[];
  incomingLinks: string[];
  metadata?: {
    tags: string[];
    created: Date;
    modified: Date;
  };
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'wikilink' | 'embed';
}

interface Graph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    avgDegree: number;
    density: number;
  };
}

interface CentralityMetrics {
  degree: number;
  betweenness: number;
  closeness: number;
  pagerank: number;
}
```

#### Template Data Model

```typescript
interface Template {
  name: string;
  path: string;
  content: string;
  variables: string[];
  metadata?: {
    description?: string;
    category?: string;
  };
}

interface TemplateVariables {
  // Built-in
  date?: string;
  time?: string;
  title?: string;
  // Custom
  [key: string]: string | undefined;
}
```

#### Search Result Model

```typescript
interface SearchResult {
  path: string;
  title: string;
  matches: Array<{
    line: number;
    text: string;
    context?: string;
  }>;
  score: number; // Relevance score
  similarity?: number; // For fuzzy search
}

interface SearchQuery {
  type: 'regex' | 'fuzzy' | 'tag' | 'frontmatter' | 'date';
  query: string;
  filters?: {
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    folder?: string;
  };
}
```

---

### Integration Patterns

#### Tool Registration Pattern

All Phase 4 tools follow the same registration pattern as Phase 3:

```typescript
// src/tools/index.ts
export function getToolDefinitions(): ToolDefinition[] {
  return [
    // Phase 1-3 tools (13 tools)
    ...existingTools,
    
    // Phase 4 tools (42+ tools)
    {
      name: 'get_graph_data',
      description: 'Get complete graph structure with nodes and edges',
      inputSchema: zodToJsonSchema(GetGraphDataSchema)
    },
    {
      name: 'apply_template',
      description: 'Apply template with variable substitution',
      inputSchema: zodToJsonSchema(ApplyTemplateSchema)
    },
    // ... more Phase 4 tools
  ];
}
```

#### Handler Pattern

Phase 4 handlers follow the same pattern:

```typescript
// src/tools/handlers-phase4.ts
export async function handleGetGraphData(
  config: ServerConfig,
  args: GetGraphDataInput
): Promise<ToolResponse> {
  try {
    // 1. Validate input
    const validated = GetGraphDataSchema.parse(args);
    
    // 2. Get vault
    const vault = getVaultByName(config, validated.vault);
    
    // 3. Build graph
    const graph = await buildGraph(vault.path);
    
    // 4. Return result
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(graph, null, 2)
      }]
    };
  } catch (error) {
    return createErrorResponse(error);
  }
}
```

---

### Testing Strategy (Phase 4)

#### Unit Tests

- Graph algorithms (shortest path, centrality, clustering)
- Template parsing and substitution
- Search algorithms (regex, fuzzy, filtering)
- Canvas parsing and manipulation
- Bulk operation processing

#### Integration Tests

- End-to-end tool execution
- Graph building from real vaults
- Template application to notes
- Search across large vaults
- Canvas file operations

#### Performance Tests

- Graph operations with 1000+ notes (<10s)
- Search operations with 1000+ notes (<5s)
- Template application (<100ms)
- Bulk operations with progress reporting

---

### Migration Path

Phase 4 tools are **additive only** - no breaking changes to existing tools:

1. **Backward Compatible:** All Phase 3 tools continue to work
2. **Optional Features:** Phase 4 tools are optional additions
3. **Configuration:** No config changes required
4. **Dependencies:** No new external dependencies (except graph library)

---

### Performance Considerations

#### Graph Operations

- **Caching:** Cache graph structure, rebuild only on changes
- **Lazy Loading:** Load graph data on-demand
- **Incremental Updates:** Update graph incrementally when notes change
- **Memory Management:** Use streaming for very large graphs

#### Search Operations

- **Indexing:** Build search index for frequently searched fields
- **Query Optimization:** Limit regex complexity
- **Result Limiting:** Cap results at 1000 matches
- **Timeout Protection:** 30-second timeout for complex queries

#### Bulk Operations

- **Batch Processing:** Process in batches of 50 notes
- **Progress Reporting:** Update every 10%
- **Error Recovery:** Continue on individual failures
- **Resource Limits:** Max 5-minute execution time

---

### Security Considerations (Phase 4)

#### Graph Operations

- **Path Validation:** Validate all note paths
- **Resource Limits:** Limit graph size to prevent memory exhaustion
- **Timeout Protection:** Prevent infinite loops in algorithms

#### Template System

- **Variable Validation:** Sanitize user-provided variables
- **Path Validation:** Validate template paths
- **Content Sanitization:** Prevent code injection

#### Bulk Operations

- **Confirmation Required:** Require explicit confirmation for >100 notes
- **Dry-Run Mode:** Support safe preview mode
- **Audit Logging:** Log all bulk operations
- **Rate Limiting:** Apply rate limits to bulk operations

---

### Documentation Requirements (Phase 4)

For each new tool category:

1. **User Guide:** How to use the tools
2. **API Reference:** Input/output schemas with examples
3. **Best Practices:** Recommended usage patterns
4. **Limitations:** Known limitations and workarounds
5. **Performance Tips:** Optimization recommendations

New documentation files:

- `GRAPH_OPERATIONS.md` - Graph analysis guide
- `TEMPLATES.md` - Template system guide
- `ADVANCED_SEARCH.md` - Search syntax and examples
- `CANVAS_GUIDE.md` - Canvas manipulation guide
- `BULK_OPERATIONS.md` - Bulk operation safety guide

---

**Document Version:** 2.0  
**Date:** January 2025  
**Status:** Complete (Phase 3 + Phase 4)  
**Next Step:** Implementation
