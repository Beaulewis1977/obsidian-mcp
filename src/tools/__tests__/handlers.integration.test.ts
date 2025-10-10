import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleReadNote, handleCreateNote, handleListNotes } from '../handlers.js';

// Mock filesystem operations
vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  noteExists: vi.fn(),
}));

vi.mock('../../filesystem/vault-writer.js', () => ({
  writeNote: vi.fn(),
}));

// Import after mocking to get the mocked versions
import { readNote, listNotes, noteExists } from '../../filesystem/vault-reader.js';
import { writeNote } from '../../filesystem/vault-writer.js';

const mockReadNote = vi.mocked(readNote);
const mockListNotes = vi.mocked(listNotes);
const mockNoteExists = vi.mocked(noteExists);
const mockWriteNote = vi.mocked(writeNote);

describe('Tool Handlers Integration Tests', () => {
  // Use process.cwd() for the vault path to ensure it's a valid absolute path
  const mockConfig = {
    version: '1.0',
    vaults: [
      {
        name: 'test',
        path: process.cwd(),
        default: true,
      }
    ],
    rate_limiting: {
      enabled: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleReadNote', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should successfully read an existing note', async () => {
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

      mockReadNote.mockResolvedValue(mockNote);

      const result = await handleReadNote(mockConfig, {
        path: 'test',
        vault: 'test',
      });

      expect(result.isError).toBeUndefined(); // Success responses don't have isError property
      expect(result.content[0].text).toContain('Test Note');
      expect(result.content[0].text).toContain('Test Content');
      expect(mockReadNote).toHaveBeenCalledWith(process.cwd(), 'test.md');
    });

    it('should handle note not found', async () => {
      mockReadNote.mockRejectedValue(new Error('Note not found'));

      const result = await handleReadNote(mockConfig, {
        path: 'nonexistent',
        vault: 'test',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Note not found');
    });

    it('should handle filesystem errors', async () => {
      mockReadNote.mockRejectedValue(new Error('Permission denied'));

      const result = await handleReadNote(mockConfig, {
        path: 'test',
        vault: 'test',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Permission denied');
    });
  });

  describe('handleCreateNote', () => {
    it('should successfully create a new note', async () => {
      mockNoteExists.mockResolvedValue(false);
      mockWriteNote.mockResolvedValue(undefined);

      const result = await handleCreateNote(mockConfig, {
        path: 'new-note',
        content: 'New note content',
        frontmatter: { title: 'New Note' },
      });

      expect(result.isError).toBeUndefined(); // Success responses don't have isError
      expect(result.content[0].text).toContain('success');
      expect(result.content[0].text).toContain('new-note.md');
      expect(mockWriteNote).toHaveBeenCalledWith(process.cwd(), 'new-note.md', {
        frontmatter: { title: 'New Note' },
        content: 'New note content',
      });
    });

    it('should handle duplicate note creation', async () => {
      mockNoteExists.mockResolvedValue(true);

      const result = await handleCreateNote(mockConfig, {
        path: 'existing-note',
        content: 'Content',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('already exists');
      expect(result.content[0].text).toContain('NOTE_ALREADY_EXISTS');
    });

    it('should handle filesystem write errors', async () => {
      mockNoteExists.mockResolvedValue(false);
      mockWriteNote.mockRejectedValue(new Error('Disk full'));

      const result = await handleCreateNote(mockConfig, {
        path: 'test-note',
        content: 'Content',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Disk full');
      expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
    });

    it('should create note with default frontmatter', async () => {
      mockNoteExists.mockResolvedValue(false);
      mockWriteNote.mockResolvedValue(undefined);

      await handleCreateNote(mockConfig, {
        path: 'simple-note',
        content: 'Simple content',
      });

      expect(mockWriteNote).toHaveBeenCalledWith(process.cwd(), 'simple-note.md', {
        frontmatter: {},
        content: 'Simple content',
      });
    });
  });

  describe('handleListNotes', () => {
    it('should successfully list notes in vault', async () => {
      const mockNotes = [
        { name: 'note1.md', path: 'note1.md', metadata: { size: 100 } },
        { name: 'note2.md', path: 'note2.md', metadata: { size: 200 } },
        { name: 'subfolder/note3.md', path: 'subfolder/note3.md', metadata: { size: 150 } },
      ];

      mockListNotes.mockResolvedValue(mockNotes);

      const result = await handleListNotes(mockConfig, {
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('note1.md');
      expect(result.content[0].text).toContain('note2.md');
      expect(result.content[0].text).toContain('subfolder/note3.md');
      expect(result.content[0].text).toContain('"total": 3');
      expect(mockListNotes).toHaveBeenCalledWith(process.cwd(), undefined, undefined);
    });

    it('should list notes in specific folder', async () => {
      const mockNotes = [
        { name: 'daily/2024-01-01.md', path: 'daily/2024-01-01.md' },
        { name: 'daily/2024-01-02.md', path: 'daily/2024-01-02.md' },
      ];

      mockListNotes.mockResolvedValue(mockNotes);

      await handleListNotes(mockConfig, {
        folder: 'daily',
        vault: 'test',
      });

      expect(mockListNotes).toHaveBeenCalledWith(process.cwd(), 'daily', undefined);
    });

    it('should handle filesystem errors during listing', async () => {
      mockListNotes.mockRejectedValue(new Error('Permission denied'));

      const result = await handleListNotes(mockConfig, {
        vault: 'test',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Permission denied');
      expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
    });

    it('should filter notes by tag', async () => {
      const mockNotes = [
        { name: 'note1.md', path: 'note1.md' },
        { name: 'note2.md', path: 'note2.md' },
      ];

      mockListNotes.mockResolvedValue(mockNotes);
      mockReadNote
        .mockResolvedValueOnce({
          path: 'note1.md',
          frontmatter: { tags: ['important'] },
          content: 'Note 1',
        })
        .mockResolvedValueOnce({
          path: 'note2.md',
          frontmatter: { tags: ['draft'] },
          content: 'Note 2',
        });

      const result = await handleListNotes(mockConfig, {
        filter: { tag: 'important' },
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      // Should only return note1.md since it has the 'important' tag
      expect(result.content[0].text).toContain('note1.md');
      expect(result.content[0].text).not.toContain('note2.md');
    });

    it('should filter notes by modification date', async () => {
      const mockNotes = [
        { name: 'old.md', path: 'old.md', metadata: { modified: '2023-01-01T00:00:00.000Z' } },
        { name: 'new.md', path: 'new.md', metadata: { modified: '2024-01-01T00:00:00.000Z' } },
      ];

      mockListNotes.mockResolvedValue(mockNotes);

      const result = await handleListNotes(mockConfig, {
        filter: { modified_since: '2023-06-01T00:00:00.000Z' },
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      // Should only return new.md since it's newer than the filter date
      expect(result.content[0].text).toContain('new.md');
      expect(result.content[0].text).not.toContain('old.md');
    });

    it('should filter notes by pattern', async () => {
      const mockNotes = [
        { name: 'project-alpha.md', path: 'project-alpha.md' },
        { name: 'project-beta.md', path: 'project-beta.md' },
        { name: 'personal-note.md', path: 'personal-note.md' },
      ];

      mockListNotes.mockResolvedValue(mockNotes);

      const result = await handleListNotes(mockConfig, {
        filter: { pattern: 'project-*' },
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      // Should only return project files
      expect(result.content[0].text).toContain('project-alpha.md');
      expect(result.content[0].text).toContain('project-beta.md');
      expect(result.content[0].text).not.toContain('personal-note.md');
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle Zod validation errors', async () => {
      // This would be tested by passing invalid input that fails schema validation
      // For now, we'll test the error handling structure
      const result = await handleReadNote(mockConfig, {
        path: '', // Invalid empty path
      } as any);

      // The schema validation should catch this and return an error
      expect(result.isError).toBe(true);
    });

    it('should handle vault not found', async () => {
      const configWithoutVault = {
        ...mockConfig,
        vaults: [],
      };

      const result = await handleReadNote(configWithoutVault, {
        path: 'test',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No vault configured');
    });

    it('should handle specified vault not found', async () => {
      const result = await handleReadNote(mockConfig, {
        path: 'test',
        vault: 'nonexistent',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No vault configured or specified vault not found');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large note content', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB of content
      const mockNote = {
        path: 'large.md',
        frontmatter: {},
        content: largeContent,
        metadata: { size: 100000 },
      };

      mockReadNote.mockResolvedValue(mockNote);

      const result = await handleReadNote(mockConfig, {
        path: 'large',
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain(largeContent);
    });

    it('should handle many notes in listing', async () => {
      const manyNotes = Array.from({ length: 1000 }, (_, i) => ({
        name: `note-${i}.md`,
        path: `note-${i}.md`,
        metadata: { size: 100 },
      }));

      mockListNotes.mockResolvedValue(manyNotes);

      const result = await handleListNotes(mockConfig, {
        vault: 'test',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('"total": 1000');
    });
  });
});
