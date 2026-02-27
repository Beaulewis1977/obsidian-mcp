# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Vitest 2.0.0
- Config: `vitest.config.ts`
- Test environment: `node`
- Global test functions enabled: `globals: true`

**Assertion Library:**
- Vitest built-in expect API (compatible with Jest)

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:ui       # Run tests with UI dashboard
npm run test:coverage # Run tests with coverage report (v8 provider, html output)
```

## Test File Organization

**Location:**
- Co-located in `__tests__` subdirectories next to source code
- Pattern: `src/module/__tests__/module.test.ts`
- Examples:
  - `src/utils/__tests__/logger.test.ts`
  - `src/utils/__tests__/validators.test.ts`
  - `src/utils/__tests__/errors.test.ts`
  - `src/utils/__tests__/rate-limiter.test.ts`
  - `src/tools/__tests__/handlers.integration.test.ts`

**Naming:**
- Unit tests: `[module].test.ts`
- Integration tests: `[module].integration.test.ts`
- Suffix: `.test.ts` (not `.spec.ts`)

**Structure:**
```
src/
├── utils/
│   ├── logger.ts
│   ├── errors.ts
│   └── __tests__/
│       ├── logger.test.ts
│       ├── errors.test.ts
│       └── validators.test.ts
├── tools/
│   ├── handlers.ts
│   └── __tests__/
│       └── handlers.integration.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Module Name', () => {
  describe('Feature/Function Name', () => {
    it('should do specific behavior', () => {
      // Arrange
      // Act
      // Assert
      expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
      expect(result).toEqual(expected);
    });
  });

  describe('Another Feature', () => {
    // More tests
  });
});
```

**Patterns:**
- Setup with `beforeEach()`: Clear mocks, reset state
  ```typescript
  beforeEach(() => {
    vi.clearAllMocks();
  });
  ```
- Teardown with `afterEach()`: Cleanup resources (less common in this codebase)
- Each describe block focuses on one function or feature
- Tests organized hierarchically: top-level feature groups, then specific behavior

**Assertion Patterns:**
```typescript
// Direct value checks
expect(result.valid).toBe(false);
expect(error).toContain('traversal');

// Object structure validation
expect(result.content).toHaveLength(1);
expect(result.content[0].type).toBe('text');

// Array/object matching
expect(TOOL_CLASSIFICATIONS.read_note.operationType).toBe('read');

// Error handling
expect(() => logger.info('Test')).not.toThrow();

// Async assertions
expect(await promise).resolves.toBe(value);
```

## Mocking

**Framework:** Vitest `vi` utility
- `vi.mock()`: Mock entire modules
- `vi.fn()`: Create spy functions
- `vi.mocked()`: Type-safe access to mocked functions
- `vi.clearAllMocks()`: Reset all mocks between tests

**Patterns:**
```typescript
// Mock entire filesystem module
vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  noteExists: vi.fn(),
}));

// Type-safe access to mocked functions
const mockReadNote = vi.mocked(readNote);

// Mock implementation with resolved value
mockReadNote.mockResolvedValue({
  path: 'test.md',
  frontmatter: { title: 'Test' },
  content: 'Content'
});

// Mock rejection
mockReadNote.mockRejectedValue(new Error('Note not found'));

// Verify calls
expect(mockReadNote).toHaveBeenCalledWith(process.cwd(), 'test.md');

// Mock with implementation
const mockConsume = vi.fn().mockImplementation(() => ({
  consume: vi.fn(),
  get: vi.fn(),
}));
```

**What to Mock:**
- Filesystem operations: `fs/promises`, vault-reader, vault-writer
- External APIs: ObsidianAPIClient, rate-limiter-flexible
- Platform-specific code: process.spawner for opening Obsidian
- Heavy dependencies: remark parser, zod schema validation (not mocked - validated directly)

**What NOT to Mock:**
- Core utilities: error utilities, validators, logger (may use in assertions or let run)
- Business logic being tested: validation functions, error classification functions
- Type definitions and enums

## Fixtures and Factories

**Test Data:**
```typescript
// Simple mock objects inline
const mockConfig = {
  version: '1.0',
  vaults: [{
    name: 'test',
    path: process.cwd(),
    default: true,
  }],
  rate_limiting: { enabled: false },
};

// Reusable mock data
const mockNote = {
  path: 'test.md',
  frontmatter: { title: 'Test Note', tags: ['test'] },
  content: '# Test Content\n\nThis is test content.',
  metadata: {
    size: 1024,
    created: '2024-01-01T00:00:00.000Z',
    modified: '2024-01-01T00:00:00.000Z',
  },
};

// Generated test data
const manyNotes = Array.from({ length: 1000 }, (_, i) => ({
  name: `note-${i}.md`,
  path: `note-${i}.md`,
  metadata: { size: 100 },
}));

// Large content for stress testing
const largeContent = 'x'.repeat(100000); // 100KB
```

**Location:**
- Inline in test files - no separate fixture directory
- Mock configuration objects defined at top of test suites
- Reusable test data created with factories inline: `Array.from()`, `vi.fn()`
- Process.cwd() used for vault paths to ensure valid paths across platforms

## Coverage

**Requirements:** Not enforced (no coverage threshold in vitest.config.ts)

**View Coverage:**
```bash
npm run test:coverage  # Generates coverage report
# Output: text, json, html formats in coverage/ directory (default Vitest location)
```

**Coverage Configuration:** `vitest.config.ts` lines 8-12
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.ts']
}
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and modules
- Location: Most tests in `src/utils/__tests__/` and `src/tools/__tests__/`
- Approach: Mock dependencies, test function behavior in isolation
- Examples:
  - `logger.test.ts`: Logger instance creation, structured logging, redaction
  - `errors.test.ts`: Error response creation, error classification functions
  - `validators.test.ts`: Path validation logic, extension handling
  - `rate-limiter.test.ts`: Rate limit checking, tool classification

**Integration Tests:**
- Scope: Tool handlers with mocked filesystem operations
- Location: `src/tools/__tests__/handlers.integration.test.ts`
- Approach: Mock filesystem but test full handler logic
- Examples:
  - `handleReadNote()` with mocked vault-reader
  - `handleCreateNote()` with existence checks
  - `handleListNotes()` with filtering (tag, date, pattern)
  - Error propagation through handler layer

**E2E Tests:**
- Framework: Not implemented
- No end-to-end tests in this codebase
- Focus is on unit and integration testing

## Common Patterns

**Async Testing:**
```typescript
// Promise resolution testing
it('should resolve after specified milliseconds', async () => {
  const start = Date.now();
  await sleep(50);
  const end = Date.now();

  expect(end - start).toBeGreaterThanOrEqual(45);
  expect(end - start).toBeLessThan(100);
});

// Promise rejection testing
it('should reject requests exceeding limits', async () => {
  const mockConsume = vi.fn().mockRejectedValue({
    msBeforeNext: 60000,
    totalHits: 150,
    totalPoints: 100,
  });

  rateLimiter['globalLimiter'].consume = mockConsume;
  const result = await rateLimiter.checkRateLimit('read_note', 'test-vault');

  expect(result.allowed).toBe(false);
  expect(result.waitTime).toBe(60);
});
```

**Error Testing:**
```typescript
// Expectation-based error testing
it('should reject paths with .. traversal', () => {
  const result = validatePath('../escape.md', vaultPath);
  expect(result.valid).toBe(false);
  expect(result.error).toContain('path traversal');
});

// Caught error testing
it('should handle Error objects in log data', () => {
  try {
    throw new Error('Intentional error for testing');
  } catch (error) {
    expect(() => logger.error({ error }, 'Caught error')).not.toThrow();
  }
});

// Error response validation
it('should handle note not found', async () => {
  mockReadNote.mockRejectedValue(new Error('Note not found'));

  const result = await handleReadNote(mockConfig, {
    path: 'nonexistent',
    vault: 'test',
  });

  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain('Note not found');
});
```

**Edge Cases:**
- Null and undefined values: `expect(() => logger.info({ nullValue: null, undefinedValue: undefined }, 'Test')).not.toThrow()`
- Circular references: Tested for graceful handling in logger
- Very large objects: 1000-element arrays, 100KB content strings
- Empty inputs: Empty strings, empty objects, empty arrays
- Platform-specific paths: Windows backslashes vs Unix forward slashes

---

*Testing analysis: 2026-02-26*
