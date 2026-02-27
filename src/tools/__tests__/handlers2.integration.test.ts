import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks MUST be declared before imports of the mocked modules
vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  noteExists: vi.fn(),
}));

vi.mock('../../filesystem/vault-writer.js', () => ({
  writeNote: vi.fn(),
  moveNote: vi.fn(),
  createFolder: vi.fn(),
}));

vi.mock('../../platform/process-spawner.js', () => ({
  openInObsidian: vi.fn(),
  openURI: vi.fn(),
}));

// Import handlers AFTER mock declarations
import {
  handleMoveNote,
  handleUpdateFrontmatter,
  handleGetDailyNote,
  handleOpenInObsidian,
  handleGetBacklinks,
  handleCreateFolder,
  handleGetVaultStats,
} from '../handlers2.js';

// Import buildRegistry + rate-limiter helpers for behavioral test
import { buildRegistry, getRateLimiter, _resetRateLimiterForTests } from '../index.js';
import { ERROR_CODES } from '../../types/index.js';

// Import mocked dependencies
import { readNote, listNotes, noteExists } from '../../filesystem/vault-reader.js';
import { writeNote, moveNote, createFolder } from '../../filesystem/vault-writer.js';
import { openInObsidian, openURI } from '../../platform/process-spawner.js';

const mockReadNote = vi.mocked(readNote);
const mockListNotes = vi.mocked(listNotes);
const mockNoteExists = vi.mocked(noteExists);
const mockWriteNote = vi.mocked(writeNote);
const mockMoveNote = vi.mocked(moveNote);
const mockCreateFolder = vi.mocked(createFolder);
const mockOpenInObsidian = vi.mocked(openInObsidian);
const mockOpenURI = vi.mocked(openURI);

const mockConfig = {
  version: '1.0',
  vaults: [{ name: 'test', path: process.cwd(), default: true }],
  rate_limiting: { enabled: false },
};

const mockNote = {
  path: 'test.md',
  frontmatter: { title: 'Test', tags: ['test'] },
  content: '# Test\n\nContent.',
  links: [],
  metadata: {
    size: 100,
    created: '2024-01-01T00:00:00.000Z',
    modified: '2024-01-01T00:00:00.000Z',
  },
};

describe('handlers2 Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimiterForTests();
  });

  // ---------------------------------------------------------------------------
  // handleMoveNote
  // ---------------------------------------------------------------------------
  describe('handleMoveNote', () => {
    it('should successfully move a note', async () => {
      mockNoteExists
        .mockResolvedValueOnce(true)   // source exists
        .mockResolvedValueOnce(false); // target does not exist
      mockMoveNote.mockResolvedValue(undefined);

      const result = await handleMoveNote(mockConfig as any, {
        vault: 'test',
        source_path: 'source',
        target_path: 'target',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({ success: true });
      expect(parsed.source_path).toBe('source.md');
      expect(parsed.target_path).toBe('target.md');
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({ success: true });
    });

    it('should return NOTE_NOT_FOUND when source note does not exist', async () => {
      mockNoteExists.mockResolvedValueOnce(false); // source not found

      const result = await handleMoveNote(mockConfig as any, {
        vault: 'test',
        source_path: 'nonexistent',
        target_path: 'target',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('NOTE_NOT_FOUND');
    });
  });

  // ---------------------------------------------------------------------------
  // handleUpdateFrontmatter
  // ---------------------------------------------------------------------------
  describe('handleUpdateFrontmatter', () => {
    it('should successfully update frontmatter', async () => {
      mockReadNote.mockResolvedValue({ ...mockNote });
      mockWriteNote.mockResolvedValue(undefined);

      const result = await handleUpdateFrontmatter(mockConfig as any, {
        vault: 'test',
        path: 'test',
        updates: { title: 'Updated' },
        merge: true,
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({ success: true });
      expect(parsed.frontmatter).toBeDefined();
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({ success: true });
    });

    it('should return NOTE_NOT_FOUND when note does not exist', async () => {
      mockReadNote.mockRejectedValue(new Error('Note not found'));

      const result = await handleUpdateFrontmatter(mockConfig as any, {
        vault: 'test',
        path: 'nonexistent',
        updates: { title: 'Updated' },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('NOTE_NOT_FOUND');
    });
  });

  // ---------------------------------------------------------------------------
  // handleGetDailyNote
  // ---------------------------------------------------------------------------
  describe('handleGetDailyNote', () => {
    it('should return existing daily note', async () => {
      mockNoteExists.mockResolvedValue(true);
      mockReadNote.mockResolvedValue({ ...mockNote, path: 'daily/2024-01-01.md' });

      const result = await handleGetDailyNote(mockConfig as any, {
        vault: 'test',
        date: '2024-01-01',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.created).toBe(false);
      expect(parsed.path).toBeDefined();
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({
        path: expect.any(String),
        created: false,
      });
    });

    it('should create daily note when create_if_missing is true', async () => {
      mockNoteExists.mockResolvedValue(false);
      mockWriteNote.mockResolvedValue(undefined);

      const result = await handleGetDailyNote(mockConfig as any, {
        vault: 'test',
        date: '2024-06-15',
        create_if_missing: true,
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.created).toBe(true);
      expect(parsed.path).toBeDefined();
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({
        path: expect.any(String),
        created: true,
      });
    });

    it('should return VALIDATION_ERROR for an invalid date', async () => {
      const result = await handleGetDailyNote(mockConfig as any, {
        vault: 'test',
        date: 'invalid-date',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('VALIDATION_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // handleOpenInObsidian
  // ---------------------------------------------------------------------------
  describe('handleOpenInObsidian', () => {
    it('should open note via URI when no API client is configured', async () => {
      mockOpenURI.mockResolvedValue(undefined);

      const result = await handleOpenInObsidian(mockConfig as any, {
        vault: 'test',
        path: 'some-note',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({ success: true, method: 'uri' });
      expect(parsed.path).toBeDefined();
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({ success: true, method: 'uri' });
    });

    it('should open vault when no path is provided', async () => {
      mockOpenInObsidian.mockResolvedValue(undefined);

      const result = await handleOpenInObsidian(mockConfig as any, {
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({ success: true, method: 'app' });
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({ success: true, method: 'app' });
    });

    it('should fall back to URI when app spawn fails for vault-open', async () => {
      mockOpenInObsidian.mockRejectedValue(new Error('Obsidian executable not found'));
      mockOpenURI.mockResolvedValue(undefined);

      const result = await handleOpenInObsidian(mockConfig as any, {
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({ success: true, method: 'uri' });
      expect(parsed.fallback_reason).toBe('Obsidian executable not found');
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({ success: true, method: 'uri' });
    });

    it('should return PROCESS_SPAWN_FAILED when all open methods fail', async () => {
      mockOpenInObsidian.mockRejectedValue(new Error('Obsidian executable not found'));
      mockOpenURI.mockRejectedValue(new Error('URI open failed'));

      const result = await handleOpenInObsidian(mockConfig as any, {
        vault: 'test',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('PROCESS_SPAWN_FAILED');
    });

    it('should return PROCESS_SPAWN_FAILED when URI fails for note-open', async () => {
      mockOpenURI.mockRejectedValue(new Error('URI protocol not supported'));

      const result = await handleOpenInObsidian(mockConfig as any, {
        vault: 'test',
        path: 'some-note',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('PROCESS_SPAWN_FAILED');
    });
  });

  // ---------------------------------------------------------------------------
  // handleGetBacklinks
  // ---------------------------------------------------------------------------
  describe('handleGetBacklinks', () => {
    it('should return backlinks for a note', async () => {
      mockListNotes.mockResolvedValue([
        { name: 'note-a.md', path: 'note-a.md' },
        { name: 'note-b.md', path: 'note-b.md' },
      ] as any);

      // note-a links to target; note-b does not
      mockReadNote
        .mockResolvedValueOnce({
          ...mockNote,
          path: 'note-a.md',
          links: [{ target: 'target', text: 'target' }],
        })
        .mockResolvedValueOnce({
          ...mockNote,
          path: 'note-b.md',
          links: [],
        });

      const result = await handleGetBacklinks(mockConfig as any, {
        vault: 'test',
        path: 'target',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.backlinks).toHaveLength(1);
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({ total: 1 });
    });

    it('should return FILESYSTEM_ERROR when listNotes fails', async () => {
      mockListNotes.mockRejectedValue(new Error('Permission denied'));

      const result = await handleGetBacklinks(mockConfig as any, {
        vault: 'test',
        path: 'target',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // handleCreateFolder
  // ---------------------------------------------------------------------------
  describe('handleCreateFolder', () => {
    it('should successfully create a folder', async () => {
      mockCreateFolder.mockResolvedValue(undefined);

      const result = await handleCreateFolder(mockConfig as any, {
        vault: 'test',
        path: 'new-folder',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({ success: true });
      expect(parsed.path).toBe('new-folder');
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({ success: true });
    });

    it('should return FILESYSTEM_ERROR when createFolder fails', async () => {
      mockCreateFolder.mockRejectedValue(new Error('Disk full'));

      const result = await handleCreateFolder(mockConfig as any, {
        vault: 'test',
        path: 'new-folder',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // handleGetVaultStats
  // ---------------------------------------------------------------------------
  describe('handleGetVaultStats', () => {
    it('should return vault stats', async () => {
      mockListNotes.mockResolvedValue([
        { name: 'note1.md', path: 'note1.md', metadata: { size: 100 } },
        { name: 'note2.md', path: 'note2.md', metadata: { size: 200 } },
      ] as any);

      mockReadNote
        .mockResolvedValueOnce({
          ...mockNote,
          path: 'note1.md',
          frontmatter: { tags: ['tagA', 'tagB'] },
          links: [{ target: 'note2', text: 'note2' }],
        })
        .mockResolvedValueOnce({
          ...mockNote,
          path: 'note2.md',
          frontmatter: { tags: ['tagB'] },
          links: [],
        });

      const result = await handleGetVaultStats(mockConfig as any, {
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.note_count).toBe(2);
      expect(parsed.unique_tags).toBe(2); // tagA and tagB
      expect(parsed.total_links).toBe(1);
      expect(parsed.tags).toEqual(expect.arrayContaining(['tagA', 'tagB']));
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({
        note_count: expect.any(Number),
      });
    });

    it('should return FILESYSTEM_ERROR when listNotes fails', async () => {
      mockListNotes.mockRejectedValue(new Error('Permission denied'));

      const result = await handleGetVaultStats(mockConfig as any, {
        vault: 'test',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // Rate limiter behavioral test — Phase 1 success criterion #2
  // Verifies BUG-01 fix: singleton RateLimitManager tracks state across calls
  // ---------------------------------------------------------------------------
  describe('rate limiter behavior', () => {
    it('rejects the 3rd call when global per_minute limit is 2', async () => {
      // Full RateLimitConfig with global limit of 2 requests per minute
      const rateLimitedConfig = {
        version: '1.0',
        vaults: [{ name: 'test', path: process.cwd(), default: true }],
        rate_limiting: {
          enabled: true,
          backend: 'memory' as const,
          limits: {
            global: { requests_per_minute: 2, requests_per_hour: 1000 },
            read: { requests_per_minute: 100, requests_per_hour: 1000 },
            write: { requests_per_minute: 2, requests_per_hour: 1000 },
          },
          graceful: {
            warn_at_percentage: 80,
            queue_requests: false,
            max_queue_size: 0,
            queue_timeout_ms: 0,
          },
        },
      };

      // Mock createFolder so the handler itself succeeds when allowed through
      mockCreateFolder.mockResolvedValue(undefined);

      const registry = buildRegistry();

      // Mirrors the rate-limiting logic in src/index.ts CallToolRequestSchema handler
      const call = async () => {
        const rateLimiter = getRateLimiter(rateLimitedConfig as any);
        if (rateLimiter) {
          const rateLimitResult = await rateLimiter.checkRateLimit('create_folder', 'test');
          if (!rateLimitResult.allowed) {
            if (rateLimitResult.response) return rateLimitResult.response;
            const rateLimitPayload = {
              error: 'Rate limit exceeded',
              details: rateLimitResult.warning || 'Too many requests in the current time window',
              code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
              waitTime: rateLimitResult.waitTime,
              suggestion: 'Please wait before making more requests'
            };
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(rateLimitPayload, null, 2) }],
              structuredContent: rateLimitPayload as Record<string, unknown>,
              isError: true
            };
          }
        }
        const result = await registry.dispatch(rateLimitedConfig as any, 'create_folder', {
          vault: 'test',
          path: 'rate-limit-test',
        });
        return result!;
      };

      const result1 = await call();
      const result2 = await call();
      const result3 = await call();

      expect(result1.isError).toBeUndefined();
      expect(result2.isError).toBeUndefined();
      expect(result3.isError).toBe(true);
      expect(result3.content[0].text).toContain('RATE_LIMIT_EXCEEDED');
    });
  });
});
