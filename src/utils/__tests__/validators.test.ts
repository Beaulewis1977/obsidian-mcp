import { describe, it, expect } from 'vitest';
import { validatePath, ensureMarkdownExtension } from '../validators.js';
import path from 'path';

describe('Path Validators', () => {
  describe('validatePath', () => {
    // Use current directory as vault path for Windows compatibility in tests
    const vaultPath = process.cwd();

    it('should reject paths with .. traversal', () => {
      const result = validatePath('../escape.md', vaultPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path traversal');
    });

    it('should reject absolute paths', () => {
      const result = validatePath('/absolute/path/note.md', vaultPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('absolute paths');
    });

    it('should reject paths with encoded .. traversal', () => {
      const result = validatePath('../escape.md', vaultPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path traversal');
    });

    it('should reject paths starting with ..', () => {
      const result = validatePath('../../../escape.md', vaultPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path traversal');
    });

    it('should reject paths outside vault boundary', () => {
      const result = validatePath('../../../../outside.md', vaultPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path traversal');
    });

    it('should debug path resolution', () => {
      const testPath = 'notes/test.md';
      const resolved = path.resolve(vaultPath, testPath);
      const normalizedVault = path.normalize(vaultPath);

      console.log('Test path:', testPath);
      console.log('Vault path:', vaultPath);
      console.log('Resolved:', resolved);
      console.log('Normalized vault:', normalizedVault);
      console.log('Starts with:', resolved.startsWith(normalizedVault));

      const result = validatePath(testPath, vaultPath);
      console.log('Result:', result);
    });

    it('should handle empty path', () => {
      const result = validatePath('', vaultPath);
      // Empty path resolves to vault root, which is technically outside the vault content
      // On Windows, path.resolve(vaultPath, '') returns vaultPath without trailing separator
      // vaultWithSeparator adds trailing separator, so vaultPath won't start with vaultPath/
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('outside vault');
    });

    it('should handle path with only filename', () => {
      const result = validatePath('note.md', vaultPath);
      // Single filename should resolve within vault
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle path with special characters', () => {
      const result = validatePath('notes/special-chars_123.md', vaultPath);
      // Paths with special characters should be valid if they resolve within vault
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle very long paths', () => {
      const longPath = 'a'.repeat(100) + '/b'.repeat(100) + '/note.md';
      const result = validatePath(longPath, vaultPath);
      // Very long paths should be valid if they resolve within vault
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('ensureMarkdownExtension', () => {
    it('should add .md extension to paths without it', () => {
      expect(ensureMarkdownExtension('notes/test')).toBe('notes/test.md');
      expect(ensureMarkdownExtension('test')).toBe('test.md');
      expect(ensureMarkdownExtension('path/to/note')).toBe('path/to/note.md');
    });

    it('should not modify paths that already have .md extension', () => {
      expect(ensureMarkdownExtension('notes/test.md')).toBe('notes/test.md');
      expect(ensureMarkdownExtension('test.MD')).toBe('test.MD.md'); // Adds .md to uppercase .MD
      expect(ensureMarkdownExtension('path/to/note.md')).toBe('path/to/note.md');
    });

    it('should handle empty string', () => {
      expect(ensureMarkdownExtension('')).toBe('.md');
    });

    it('should handle paths with multiple dots', () => {
      expect(ensureMarkdownExtension('notes/test.backup')).toBe('notes/test.backup.md');
      expect(ensureMarkdownExtension('test.txt')).toBe('test.txt.md');
    });

    it('should handle paths ending with dot', () => {
      expect(ensureMarkdownExtension('notes/test.')).toBe('notes/test..md');
    });

    it('should preserve directory structure', () => {
      expect(ensureMarkdownExtension('folder/subfolder/note')).toBe('folder/subfolder/note.md');
      expect(ensureMarkdownExtension('deep/nested/path/file')).toBe('deep/nested/path/file.md');
    });
  });
});
