import { describe, it, expect } from 'vitest';
import {
  CreateNoteSchema,
  DeleteNoteSchema,
  ListNotesSchema,
  MoveNoteSchema,
  UpdateFrontmatterSchema,
  GetDailyNoteSchema,
  GetOutgoingLinksSchema,
  AddVaultSchema,
  RemoveVaultSchema,
} from '../schemas.js';

describe('Schema coercion', () => {
  describe('boolean string coercion', () => {
    it('should coerce "true" string to true', () => {
      const result = CreateNoteSchema.parse({
        path: 'test.md',
        content: 'hello',
        open_in_obsidian: 'true' as unknown as boolean,
      });
      expect(result.open_in_obsidian).toBe(true);
    });

    it('should coerce "false" string to false', () => {
      const result = CreateNoteSchema.parse({
        path: 'test.md',
        content: 'hello',
        open_in_obsidian: 'false' as unknown as boolean,
      });
      expect(result.open_in_obsidian).toBe(false);
    });

    it('should pass through native booleans unchanged', () => {
      const result = DeleteNoteSchema.parse({
        path: 'test.md',
        confirm: true,
      });
      expect(result.confirm).toBe(true);
    });

    it('should reject invalid boolean strings', () => {
      expect(() =>
        DeleteNoteSchema.parse({ path: 'test.md', confirm: 'yes' })
      ).toThrow();
      expect(() =>
        DeleteNoteSchema.parse({ path: 'test.md', confirm: '1' })
      ).toThrow();
      expect(() =>
        DeleteNoteSchema.parse({ path: 'test.md', confirm: '' })
      ).toThrow();
    });

    it('should coerce booleans across all schemas with boolean fields', () => {
      // ListNotesSchema.include_metadata
      const list = ListNotesSchema.parse({ include_metadata: 'true' as unknown as boolean });
      expect(list.include_metadata).toBe(true);

      // MoveNoteSchema.update_links
      const move = MoveNoteSchema.parse({
        source_path: 'a.md',
        target_path: 'b.md',
        update_links: 'true' as unknown as boolean,
      });
      expect(move.update_links).toBe(true);

      // UpdateFrontmatterSchema.merge
      const fm = UpdateFrontmatterSchema.parse({
        path: 'test.md',
        updates: { key: 'val' },
        merge: 'false' as unknown as boolean,
      });
      expect(fm.merge).toBe(false);

      // GetDailyNoteSchema.create_if_missing
      const daily = GetDailyNoteSchema.parse({
        create_if_missing: 'false' as unknown as boolean,
      });
      expect(daily.create_if_missing).toBe(false);

      // GetOutgoingLinksSchema.include_embeds + resolve
      const links = GetOutgoingLinksSchema.parse({
        path: 'test.md',
        include_embeds: 'false' as unknown as boolean,
        resolve: 'true' as unknown as boolean,
      });
      expect(links.include_embeds).toBe(false);
      expect(links.resolve).toBe(true);

      // AddVaultSchema.create_folder and .default
      const addTrue = AddVaultSchema.parse({
        name: 'my-vault',
        path: '/vaults/my-vault',
        create_folder: 'true' as unknown as boolean,
        default: 'false' as unknown as boolean,
      });
      expect(addTrue.create_folder).toBe(true);
      expect(addTrue.default).toBe(false);

      const addFalse = AddVaultSchema.parse({
        name: 'my-vault',
        path: '/vaults/my-vault',
        create_folder: 'false' as unknown as boolean,
        default: 'true' as unknown as boolean,
      });
      expect(addFalse.create_folder).toBe(false);
      expect(addFalse.default).toBe(true);

      // RemoveVaultSchema.delete_folder and .confirm
      const remove = RemoveVaultSchema.parse({
        name: 'my-vault',
        delete_folder: 'true' as unknown as boolean,
        confirm: 'true' as unknown as boolean,
      });
      expect(remove.delete_folder).toBe(true);
      expect(remove.confirm).toBe(true);

      const removeNoDelete = RemoveVaultSchema.parse({
        name: 'my-vault',
        delete_folder: 'false' as unknown as boolean,
        confirm: 'false' as unknown as boolean,
      });
      expect(removeNoDelete.delete_folder).toBe(false);
      expect(removeNoDelete.confirm).toBe(false);
    });
  });

  describe('record/object string coercion', () => {
    it('should coerce JSON string to object for frontmatter', () => {
      const result = CreateNoteSchema.parse({
        path: 'test.md',
        content: 'hello',
        frontmatter: '{"tags":["a","b"],"draft":true}' as unknown as Record<string, unknown>,
      });
      expect(result.frontmatter).toEqual({ tags: ['a', 'b'], draft: true });
    });

    it('should coerce JSON string to object for updates', () => {
      const result = UpdateFrontmatterSchema.parse({
        path: 'test.md',
        updates: '{"key":"val"}' as unknown as Record<string, unknown>,
      });
      expect(result.updates).toEqual({ key: 'val' });
    });

    it('should pass through native objects unchanged', () => {
      const result = CreateNoteSchema.parse({
        path: 'test.md',
        content: 'hello',
        frontmatter: { tags: ['a'] },
      });
      expect(result.frontmatter).toEqual({ tags: ['a'] });
    });

    it('should reject invalid JSON strings', () => {
      expect(() =>
        UpdateFrontmatterSchema.parse({
          path: 'test.md',
          updates: '{not valid json' as unknown as Record<string, unknown>,
        })
      ).toThrow();
    });
  });
});
