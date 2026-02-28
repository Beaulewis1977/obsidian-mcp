import { z } from 'zod';

/** Coerce "true"/"false" strings to boolean (common from CLI/bash clients) */
const coerceBool = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      if (val === 'true') return true;
      if (val === 'false') return false;
    }
    return val;
  },
  z.boolean()
);

/** Coerce JSON strings to objects (common from CLI/bash clients) */
const coerceRecord = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  },
  z.record(z.any())
);

/**
 * Zod schemas for tool input validation
 */

export const ReadNoteSchema = z.object({
  path: z.string().min(1).describe('Path to the note relative to vault root (e.g., "folder/note.md")'),
  vault: z.string().optional().describe('Vault name (optional if only one vault configured)')
});

export const CreateNoteSchema = z.object({
  path: z.string().min(1).describe('Path for the new note (e.g., "folder/note.md")'),
  content: z.string().describe('Main content of the note (markdown)'),
  frontmatter: coerceRecord.optional().describe('YAML frontmatter (optional)'),
  vault: z.string().optional().describe('Vault name (optional)'),
  open_in_obsidian: coerceBool.default(false).describe('Open the note in Obsidian after creation')
});

export const EditNoteSchema = z.object({
  path: z.string().min(1).describe('Path to the note to edit'),
  content: z.string().describe('Content to insert or replacement content'),
  mode: z.enum(['append', 'prepend', 'replace', 'heading']).default('append')
    .describe('Edit mode: append, prepend, replace, or insert under heading'),
  heading: z.string().optional().describe('Target heading (when mode=heading)'),
  vault: z.string().optional().describe('Vault name (optional)')
});

export const DeleteNoteSchema = z.object({
  path: z.string().min(1).describe('Path to the note to delete'),
  vault: z.string().optional().describe('Vault name (optional)'),
  confirm: coerceBool.describe('Must be true to confirm deletion')
});

export const ListNotesSchema = z.object({
  folder: z.string().optional().describe('Folder to list (omit for entire vault)'),
  vault: z.string().optional().describe('Vault name (optional)'),
  filter: z.object({
    tag: z.string().optional().describe('Filter by tag'),
    modified_since: z.string().optional().describe('ISO date (e.g., "2024-01-01")'),
    pattern: z.string().optional().describe('Filename pattern (glob)')
  }).optional().describe('Optional filters'),
  include_metadata: coerceBool.default(false).describe('Include file metadata')
});

export const SearchNotesSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  vault: z.string().optional().describe('Vault name (optional)'),
  mode: z.enum(['obsidian', 'filesystem']).default('filesystem')
    .describe('Search mode: obsidian (API) or filesystem')
});

export const MoveNoteSchema = z.object({
  source_path: z.string().min(1).describe('Current path of the note'),
  target_path: z.string().min(1).describe('New path for the note'),
  vault: z.string().optional().describe('Vault name (optional)'),
  update_links: coerceBool.default(false).describe('Update wikilinks (not implemented in MVP)')
});

export const UpdateFrontmatterSchema = z.object({
  path: z.string().min(1).describe('Path to the note'),
  vault: z.string().optional().describe('Vault name (optional)'),
  updates: coerceRecord.describe('Key-value pairs to update in frontmatter'),
  merge: coerceBool.default(true).describe('Merge (true) or replace (false) frontmatter')
});

export const GetDailyNoteSchema = z.object({
  date: z.string().optional().describe('Date in YYYY-MM-DD format (default: today)'),
  vault: z.string().optional().describe('Vault name (optional)'),
  create_if_missing: coerceBool.default(true).describe('Create the daily note if it does not exist')
});

export const OpenInObsidianSchema = z.object({
  path: z.string().optional().describe('Path to note to open (optional, opens vault if omitted)'),
  vault: z.string().optional().describe('Vault name (optional)')
});

export const GetBacklinksSchema = z.object({
  path: z.string().min(1).describe('Path to the note'),
  vault: z.string().optional().describe('Vault name (optional)')
});

export const CreateFolderSchema = z.object({
  path: z.string().min(1).describe('Path for the new folder'),
  vault: z.string().optional().describe('Vault name (optional)')
});

export const GetVaultStatsSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)')
});

// ─── Link / Graph tool schemas ───────────────────────────────────────────────

export const GetLinkGraphSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)'),
  folder: z.string().optional().describe('Limit graph to a specific folder (optional)'),
});

export const FindOrphansSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)'),
  type: z.enum(['full', 'no_outgoing', 'no_incoming']).default('full')
    .describe('Orphan type: full (no links at all), no_outgoing (no outgoing links), no_incoming (no incoming links)'),
});

export const SearchTagsSchema = z.object({
  vault: z.string().optional().describe('Vault name (optional)'),
  query: z.string().optional().describe('Filter tags by prefix or substring (optional)'),
});

export const GetOutgoingLinksSchema = z.object({
  path: z.string().min(1).describe('Path to the note'),
  vault: z.string().optional().describe('Vault name (optional)'),
  include_embeds: coerceBool.default(true).describe('Include ![[embed]] links'),
  resolve: coerceBool.default(false).describe('Check if each link target exists in vault'),
});

// --- Meta-tool schemas (Phase 3 lazy loading) ---

export const DiscoverToolsSchema = z.object({
  query: z.string().optional()
    .describe('Filter tools by keyword (searches name and description)'),
  category: z.string().optional()
    .describe('Filter by category name (e.g. "Core CRUD", "Graph", "Meta")'),
});

export const EnableToolSchema = z.object({
  tool_name: z.string().min(1)
    .describe('Name of the tool to enable in the current session'),
});

// Type exports
export type ReadNoteInput = z.infer<typeof ReadNoteSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type EditNoteInput = z.infer<typeof EditNoteSchema>;
export type DeleteNoteInput = z.infer<typeof DeleteNoteSchema>;
export type ListNotesInput = z.infer<typeof ListNotesSchema>;
export type SearchNotesInput = z.infer<typeof SearchNotesSchema>;
export type MoveNoteInput = z.infer<typeof MoveNoteSchema>;
export type UpdateFrontmatterInput = z.infer<typeof UpdateFrontmatterSchema>;
export type GetDailyNoteInput = z.infer<typeof GetDailyNoteSchema>;
export type OpenInObsidianInput = z.infer<typeof OpenInObsidianSchema>;
export type GetBacklinksInput = z.infer<typeof GetBacklinksSchema>;
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;
export type GetVaultStatsInput = z.infer<typeof GetVaultStatsSchema>;
export type GetLinkGraphInput = z.infer<typeof GetLinkGraphSchema>;
export type FindOrphansInput = z.infer<typeof FindOrphansSchema>;
export type SearchTagsInput = z.infer<typeof SearchTagsSchema>;
export type GetOutgoingLinksInput = z.infer<typeof GetOutgoingLinksSchema>;
export type DiscoverToolsInput = z.infer<typeof DiscoverToolsSchema>;
export type EnableToolInput = z.infer<typeof EnableToolSchema>;
