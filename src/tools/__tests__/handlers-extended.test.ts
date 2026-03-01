import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks (hoisted before any imports) ──────────────────────────────────────

vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  noteExists: vi.fn(),
}));

vi.mock('../../filesystem/vault-writer.js', () => ({
  writeNote: vi.fn().mockResolvedValue(undefined),
  moveNote: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../link-graph.js', () => ({
  parseWikilinks: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  handleManageTags,
  handleArchiveNote,
  handleExtractLinks,
  handleGetWeeklyNote,
  handleListTemplates,
} from '../handlers-extended.js';
import { readNote, listNotes, noteExists } from '../../filesystem/vault-reader.js';
import { writeNote, moveNote } from '../../filesystem/vault-writer.js';
import { parseWikilinks } from '../link-graph.js';

// ── Typed mock references ────────────────────────────────────────────────────

const mockReadNote = vi.mocked(readNote);
const mockListNotes = vi.mocked(listNotes);
const mockNoteExists = vi.mocked(noteExists);
const mockWriteNote = vi.mocked(writeNote);
const mockMoveNote = vi.mocked(moveNote);
const mockParseWikilinks = vi.mocked(parseWikilinks);

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeMockConfig() {
  return {
    version: '1.0',
    vaults: [{ name: 'test', path: process.cwd(), default: true }],
    rate_limiting: { enabled: false },
  } as any;
}

function makeNote(overrides: Partial<{ path: string; frontmatter: Record<string, any>; content: string }> = {}) {
  return {
    path: overrides.path ?? 'note.md',
    frontmatter: overrides.frontmatter ?? {},
    content: overrides.content ?? '# Test',
    links: [],
    metadata: { size: 100, created: '2026-01-01', modified: '2026-01-01' } as any,
  };
}

// ── handleManageTags ─────────────────────────────────────────────────────────

describe('handleManageTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a tag to a note; result has total_modified=1 and tags_added contains the tag', async () => {
    const config = makeMockConfig();
    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue(makeNote({ frontmatter: { tags: ['existing'] } }));

    const result = await handleManageTags(config, {
      paths: ['notes/note.md'],
      add: ['new-tag'],
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.total_modified).toBe(1);
    expect(payload.modified).toHaveLength(1);
    expect(payload.modified[0].tags_added).toContain('new-tag');
    expect(payload.modified[0].tags_after).toContain('existing');
    expect(payload.modified[0].tags_after).toContain('new-tag');
    expect(payload.modified[0].changed).toBe(true);
    expect(mockWriteNote).toHaveBeenCalled();
  });

  it('returns per-note results for mixed valid/invalid paths; total_modified=1', async () => {
    const config = makeMockConfig();

    // First note exists, second does not
    mockNoteExists.mockImplementation((_vaultPath: string, p: string) =>
      Promise.resolve(!p.includes('missing'))
    );
    mockReadNote.mockResolvedValue(makeNote({ frontmatter: { tags: [] } }));

    const result = await handleManageTags(config, {
      paths: ['valid.md', 'missing.md'],
      add: ['tag1'],
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.modified).toHaveLength(2);
    expect(payload.total_modified).toBe(1);

    const validResult = payload.modified.find((r: any) => r.path === 'valid.md');
    const missingResult = payload.modified.find((r: any) => r.path === 'missing.md');
    expect(validResult.changed).toBe(true);
    expect(missingResult.error).toBe('Note not found');
    expect(missingResult.changed).toBeUndefined();
  });

  it('continues processing remaining notes when one note write fails', async () => {
    const config = makeMockConfig();

    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue(makeNote({ frontmatter: { tags: [] } }));
    mockWriteNote
      .mockRejectedValueOnce(new Error('write failed for first'))
      .mockResolvedValueOnce(undefined);

    const result = await handleManageTags(config, {
      paths: ['first.md', 'second.md'],
      add: ['tag1'],
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.modified).toHaveLength(2);

    const firstResult = payload.modified.find((r: any) => r.path === 'first.md');
    const secondResult = payload.modified.find((r: any) => r.path === 'second.md');
    expect(firstResult.error).toContain('write failed for first');
    expect(secondResult.changed).toBe(true);
    expect(payload.total_modified).toBe(1);
  });

  it('returns isError=true when neither add nor remove is provided', async () => {
    const config = makeMockConfig();

    const result = await handleManageTags(config, {
      paths: ['note.md'],
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('VALIDATION_ERROR');
  });
});

// ── handleArchiveNote ─────────────────────────────────────────────────────────

describe('handleArchiveNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves note to archive and returns archive_path', async () => {
    const config = makeMockConfig();

    // Source exists, archive path does not
    mockNoteExists.mockImplementation((_vaultPath: string, p: string) =>
      Promise.resolve(!p.includes('_archive'))
    );
    mockReadNote.mockResolvedValue(makeNote({ path: '_archive/note.md', frontmatter: {} }));

    const result = await handleArchiveNote(config, {
      path: 'note.md',
      archive_folder: '_archive',
      add_date: true,
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.success).toBe(true);
    expect(payload.original_path).toBe('note.md');
    expect(payload.archive_path).toContain('_archive');
    expect(payload.archived_date).toBeDefined();
    expect(mockMoveNote).toHaveBeenCalledWith(process.cwd(), 'note.md', expect.stringContaining('_archive'));
    expect(mockWriteNote).toHaveBeenCalled();
  });

  it('returns isError=true when source note does not exist', async () => {
    const config = makeMockConfig();
    mockNoteExists.mockResolvedValue(false);

    const result = await handleArchiveNote(config, {
      path: 'nonexistent.md',
      archive_folder: '_archive',
      add_date: false,
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('NOTE_NOT_FOUND');
  });

  it('returns isError=true when archive target already exists', async () => {
    const config = makeMockConfig();

    // Both source and archive path exist
    mockNoteExists.mockResolvedValue(true);

    const result = await handleArchiveNote(config, {
      path: 'note.md',
      archive_folder: '_archive',
      add_date: false,
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('NOTE_ALREADY_EXISTS');
    expect(text).toContain('already exists');
    expect(mockMoveNote).not.toHaveBeenCalled();
  });

  it('returns success with warning when archived_date update fails after move', async () => {
    const config = makeMockConfig();

    // Source exists, archive path does not
    mockNoteExists.mockImplementation((_vaultPath: string, p: string) =>
      Promise.resolve(!p.includes('_archive'))
    );
    mockReadNote.mockResolvedValue(makeNote({ path: '_archive/note.md', frontmatter: {} }));
    mockWriteNote.mockRejectedValueOnce(new Error('disk write failed'));

    const result = await handleArchiveNote(config, {
      path: 'note.md',
      archive_folder: '_archive',
      add_date: true,
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.success).toBe(true);
    expect(payload.original_path).toBe('note.md');
    expect(payload.archive_path).toContain('_archive');
    expect(payload.archived_date).toBeUndefined();
    expect(payload.warning).toContain('failed to set archived_date');
    expect(payload.warning).toContain('disk write failed');
    expect(mockMoveNote).toHaveBeenCalledWith(process.cwd(), 'note.md', expect.stringContaining('_archive'));
  });
});

// ── handleExtractLinks ────────────────────────────────────────────────────────

describe('handleExtractLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct wikilinks and external URLs from note content', async () => {
    const config = makeMockConfig();
    const content = [
      '# My Note',
      '[[OtherNote]] and [[Embed|Alias]]',
      'Visit https://example.com for more info.',
      'Check [link text](https://obsidian.md) here.',
    ].join('\n');

    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue(makeNote({ content }));
    mockParseWikilinks.mockReturnValue([
      { target: 'OtherNote', alias: null, section: null, isEmbed: false, raw: '[[OtherNote]]' },
      { target: 'Embed', alias: 'Alias', section: null, isEmbed: false, raw: '[[Embed|Alias]]' },
    ]);

    const result = await handleExtractLinks(config, { path: 'note.md' });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.wikilinks).toHaveLength(2);
    expect(payload.embeds).toHaveLength(0);
    expect(payload.markdown_links).toHaveLength(1);
    expect(payload.markdown_links[0].url).toBe('https://obsidian.md');
    expect(payload.external_urls.length).toBeGreaterThanOrEqual(1);
    expect(payload.total).toBeGreaterThan(0);
  });

  it('keeps bare URL when same URL also appears in markdown link on the same line', async () => {
    const config = makeMockConfig();
    const content = 'Check [docs](https://example.com) and mirror https://example.com';

    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue(makeNote({ content }));
    mockParseWikilinks.mockReturnValue([]);

    const result = await handleExtractLinks(config, { path: 'note.md' });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.markdown_links).toHaveLength(1);
    expect(payload.markdown_links[0].url).toBe('https://example.com');
    expect(payload.external_urls).toHaveLength(1);
    expect(payload.external_urls[0].url).toBe('https://example.com');
  });

  it('returns isError=true when note does not exist', async () => {
    const config = makeMockConfig();
    mockNoteExists.mockResolvedValue(false);

    const result = await handleExtractLinks(config, { path: 'missing.md' });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('NOTE_NOT_FOUND');
  });
});

// ── handleGetWeeklyNote ───────────────────────────────────────────────────────

describe('handleGetWeeklyNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates weekly note when it does not exist and create_if_missing=true', async () => {
    const config = makeMockConfig();
    mockNoteExists.mockResolvedValue(false);

    const result = await handleGetWeeklyNote(config, {
      week: '2026-W09',
      week_folder: 'weekly',
      date_format: 'YYYY-[W]WW',
      create_if_missing: true,
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.created).toBe(true);
    expect(payload.week).toBe('2026-W09');
    expect(payload.path).toBe('weekly/2026-W09.md');
    expect(mockWriteNote).toHaveBeenCalledWith(
      process.cwd(),
      'weekly/2026-W09.md',
      expect.objectContaining({ frontmatter: { week: '2026-W09' } })
    );
  });

  it('returns existing note with created=false when note already exists', async () => {
    const config = makeMockConfig();
    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue(
      makeNote({ path: 'weekly/2026-W09.md', frontmatter: { week: '2026-W09' }, content: '# Week 9' })
    );

    const result = await handleGetWeeklyNote(config, {
      week: '2026-W09',
      week_folder: 'weekly',
      date_format: 'YYYY-[W]WW',
      create_if_missing: true,
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.created).toBe(false);
    expect(payload.week).toBe('2026-W09');
    expect(payload.content).toBe('# Week 9');
    expect(mockWriteNote).not.toHaveBeenCalled();
  });

  it('returns isError=true for invalid week format', async () => {
    const config = makeMockConfig();

    const result = await handleGetWeeklyNote(config, {
      week: '2026-09',  // Missing 'W' prefix
      week_folder: 'weekly',
      date_format: 'YYYY-[W]WW',
      create_if_missing: true,
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('VALIDATION_ERROR');
    expect(text).toContain('YYYY-Www');
  });

  it('returns isError=true when note missing and create_if_missing=false', async () => {
    const config = makeMockConfig();
    mockNoteExists.mockResolvedValue(false);

    const result = await handleGetWeeklyNote(config, {
      week: '2026-W09',
      week_folder: 'weekly',
      date_format: 'YYYY-[W]WW',
      create_if_missing: false,
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('NOTE_NOT_FOUND');
  });
});

// ── handleListTemplates ───────────────────────────────────────────────────────

describe('handleListTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns templates list with correct total when folder exists', async () => {
    const config = makeMockConfig();
    const fakeTemplates = [
      { name: 'daily.md', path: 'templates/daily.md', folder: 'templates' },
      { name: 'weekly.md', path: 'templates/weekly.md', folder: 'templates' },
      { name: 'project.md', path: 'templates/project.md', folder: 'templates' },
    ];
    mockListNotes.mockResolvedValue(fakeTemplates as any);

    const result = await handleListTemplates(config, { template_folder: 'templates' });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.total).toBe(3);
    expect(payload.templates).toHaveLength(3);
    expect(payload.template_folder).toBe('templates');
    expect(payload.note).toBeUndefined();
  });

  it('returns empty list (not error) when template folder throws ENOENT', async () => {
    const config = makeMockConfig();
    mockListNotes.mockRejectedValue(
      Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
    );

    const result = await handleListTemplates(config, { template_folder: 'templates' });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.total).toBe(0);
    expect(payload.templates).toHaveLength(0);
    expect(payload.note).toContain("templates");
  });
});

// ── Path traversal protection ────────────────────────────────────────────────

describe('path traversal protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function expectTraversalBlocked(result: any) {
    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('INVALID_PATH');
    // No filesystem operations should have been attempted
    expect(mockNoteExists).not.toHaveBeenCalled();
    expect(mockReadNote).not.toHaveBeenCalled();
    expect(mockWriteNote).not.toHaveBeenCalled();
    expect(mockMoveNote).not.toHaveBeenCalled();
    expect(mockListNotes).not.toHaveBeenCalled();
  }

  it('manage_tags rejects paths with ../ traversal', async () => {
    const config = makeMockConfig();
    const result = await handleManageTags(config, {
      paths: ['../../etc/passwd'],
      add: ['pwned'],
    });

    // manage_tags uses partial failure — per-note error, not top-level isError
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.modified[0].error).toContain('path');
    expect(payload.total_modified).toBe(0);
    expect(mockNoteExists).not.toHaveBeenCalled();
    expect(mockReadNote).not.toHaveBeenCalled();
    expect(mockWriteNote).not.toHaveBeenCalled();
  });

  it('manage_tags rejects absolute paths', async () => {
    const config = makeMockConfig();
    const result = await handleManageTags(config, {
      paths: ['/etc/passwd'],
      add: ['pwned'],
    });

    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.modified[0].error).toBeDefined();
    expect(payload.total_modified).toBe(0);
    expect(mockReadNote).not.toHaveBeenCalled();
    expect(mockWriteNote).not.toHaveBeenCalled();
  });

  it('archive_note rejects source path with ../ traversal', async () => {
    const config = makeMockConfig();
    const result = await handleArchiveNote(config, {
      path: '../../secret/note',
      archive_folder: '_archive',
      add_date: false,
    });

    expectTraversalBlocked(result);
  });

  it('archive_note rejects archive_folder with ../ traversal', async () => {
    const config = makeMockConfig();

    const result = await handleArchiveNote(config, {
      path: 'note.md',
      archive_folder: '../../outside',
      add_date: false,
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('INVALID_PATH');
    expect(mockNoteExists).not.toHaveBeenCalled();
    expect(mockMoveNote).not.toHaveBeenCalled();
  });

  it('extract_links rejects path with ../ traversal', async () => {
    const config = makeMockConfig();
    const result = await handleExtractLinks(config, {
      path: '../../../etc/passwd',
    });

    expectTraversalBlocked(result);
  });

  it('get_weekly_note rejects week_folder with ../ traversal', async () => {
    const config = makeMockConfig();
    const result = await handleGetWeeklyNote(config, {
      week: '2026-W09',
      week_folder: '../../outside',
      date_format: 'YYYY-[W]WW',
      create_if_missing: true,
    });

    expectTraversalBlocked(result);
  });

  it('list_templates rejects template_folder with ../ traversal', async () => {
    const config = makeMockConfig();
    const result = await handleListTemplates(config, {
      template_folder: '../../secrets',
    });

    expectTraversalBlocked(result);
  });
});
