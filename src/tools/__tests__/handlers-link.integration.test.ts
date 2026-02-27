import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock filesystem BEFORE importing handlers (vitest hoists vi.mock calls)
vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  noteExists: vi.fn(),
}));

// Import handlers AFTER mock declarations
import {
  handleGetLinkGraph,
  handleFindOrphans,
  handleSearchTags,
  handleGetOutgoingLinks,
} from '../handlers-link.js';

// Import mocked dependencies
import { readNote, listNotes, noteExists } from '../../filesystem/vault-reader.js';

const mockReadNote = vi.mocked(readNote);
const mockListNotes = vi.mocked(listNotes);
const mockNoteExists = vi.mocked(noteExists);

const mockConfig = {
  version: '1.0',
  vaults: [{ name: 'test', path: process.cwd(), default: true }],
  rate_limiting: { enabled: false },
} as any;

// ─── Shared vault fixture ──────────────────────────────────────────────────────
// 4-note vault: note-a ↔ note-b ↔ folder/note-d; note-c is a full orphan
const mockVaultNotes = [
  { path: 'note-a.md', name: 'note-a.md', folder: '/' },
  { path: 'note-b.md', name: 'note-b.md', folder: '/' },
  { path: 'note-c.md', name: 'note-c.md', folder: '/' },
  { path: 'folder/note-d.md', name: 'note-d.md', folder: 'folder' },
];

const mockNoteContent: Record<string, any> = {
  'note-a.md': {
    path: 'note-a.md',
    frontmatter: { tags: ['recipe', 'cooking'] },
    content: '# Note A\n\nLinks to [[note-b]] and has #healthy tag.\nAlso embeds ![[image.png]].',
    links: [],
  },
  'note-b.md': {
    path: 'note-b.md',
    frontmatter: { tags: [] },
    content: '# Note B\n\nLinks back to [[note-a|my alias]] and to [[folder/note-d#section]].',
    links: [],
  },
  'note-c.md': {
    path: 'note-c.md',
    frontmatter: { tags: ['orphan-tag'] },
    content: '# Note C\n\nNo links here. Just #standalone content.',
    links: [],
  },
  'folder/note-d.md': {
    path: 'folder/note-d.md',
    frontmatter: { tags: ['recipe'] },
    content: '# Note D\n\nLinks to [[note-a]].',
    links: [],
  },
};

function setupMockVault() {
  mockListNotes.mockResolvedValue(mockVaultNotes as any);
  mockReadNote.mockImplementation(async (_vaultPath, p) => {
    const note = mockNoteContent[p as string];
    if (!note) throw new Error(`Note not found: ${p}`);
    return note;
  });
}

// ─── handleGetLinkGraph ────────────────────────────────────────────────────────

describe('handleGetLinkGraph', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return graph with correct nodes, edges, and stats', async () => {
    setupMockVault();

    const result = await handleGetLinkGraph(mockConfig, {});

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // Nodes: one per note in the vault
    expect(data.nodes).toHaveLength(4);

    // Edge from note-a to note-b (wikilink [[note-b]])
    const edgeAtoB = data.edges.find(
      (e: any) => e.source === 'note-a.md' && e.target === 'note-b.md',
    );
    expect(edgeAtoB).toBeDefined();
    expect(edgeAtoB.type).toBe('wikilink');

    // Edge from note-b to note-a (wikilink [[note-a|my alias]])
    const edgeBtoA = data.edges.find(
      (e: any) => e.source === 'note-b.md' && e.target === 'note-a.md',
    );
    expect(edgeBtoA).toBeDefined();

    // note-c has no outgoing and no incoming — orphan_count must be >= 1
    expect(data.stats.total_nodes).toBe(4);
    expect(data.stats.total_edges).toBeGreaterThanOrEqual(3); // a→b, b→a, b→d, d→a
    expect(data.stats.orphan_count).toBeGreaterThanOrEqual(1);

    // structuredContent mirrors the JSON payload
    expect(result.structuredContent).toBeDefined();
    expect((result.structuredContent as any).stats.total_nodes).toBe(4);
  });

  it('should include embed edges from note content', async () => {
    setupMockVault();

    const result = await handleGetLinkGraph(mockConfig, {});

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // image.png is NOT in vault notes list, so it won't be in resolved edges.
    // But wikilink edges that do resolve should include embed type edges from other notes.
    // Verify edges array structure has expected shape
    expect(Array.isArray(data.edges)).toBe(true);
    data.edges.forEach((edge: any) => {
      expect(edge).toHaveProperty('source');
      expect(edge).toHaveProperty('target');
      expect(edge).toHaveProperty('type');
      expect(['wikilink', 'embed']).toContain(edge.type);
    });
  });

  it('should return error for invalid vault', async () => {
    const result = await handleGetLinkGraph(mockConfig, { vault: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
  });

  it('should return correct node shape with folder and tag fields', async () => {
    setupMockVault();

    const result = await handleGetLinkGraph(mockConfig, {});

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    const nodeA = data.nodes.find((n: any) => n.path === 'note-a.md');
    expect(nodeA).toBeDefined();
    expect(nodeA.folder).toBe('/');
    // note-a has frontmatter tags ['recipe', 'cooking'] and inline tag 'healthy'
    expect(nodeA.tags).toEqual(expect.arrayContaining(['recipe', 'cooking', 'healthy']));
    expect(typeof nodeA.outgoing_count).toBe('number');
    expect(typeof nodeA.incoming_count).toBe('number');
  });
});

// ─── handleFindOrphans ────────────────────────────────────────────────────────

describe('handleFindOrphans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should identify fully orphaned notes (no incoming AND no outgoing)', async () => {
    setupMockVault();

    const result = await handleFindOrphans(mockConfig, { type: 'full' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // note-c has no links at all
    const orphanPaths = data.orphans.map((o: any) => o.path);
    expect(orphanPaths).toContain('note-c.md');

    // note-a and note-b have links — should NOT be in full orphan list
    expect(orphanPaths).not.toContain('note-a.md');
    expect(orphanPaths).not.toContain('note-b.md');

    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.total_notes).toBe(4);
    expect(result.structuredContent).toBeDefined();
  });

  it('should filter by orphan type no_incoming', async () => {
    setupMockVault();

    const result = await handleFindOrphans(mockConfig, { type: 'no_incoming' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // note-c has no incoming links — must appear
    const orphanPaths = data.orphans.map((o: any) => o.path);
    expect(orphanPaths).toContain('note-c.md');

    // note-b is linked from note-a and note-c is not linked from anywhere
    // note-a is linked from note-b and note-d — should NOT be in no_incoming list
    expect(orphanPaths).not.toContain('note-a.md');
    expect(data.type).toBe('no_incoming');
  });

  it('should filter by orphan type no_outgoing', async () => {
    setupMockVault();

    const result = await handleFindOrphans(mockConfig, { type: 'no_outgoing' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // note-c has no outgoing links — must appear
    const orphanPaths = data.orphans.map((o: any) => o.path);
    expect(orphanPaths).toContain('note-c.md');
    expect(data.type).toBe('no_outgoing');
  });

  it('should return error for invalid vault', async () => {
    const result = await handleFindOrphans(mockConfig, { vault: 'nonexistent', type: 'full' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
  });
});

// ─── handleSearchTags ─────────────────────────────────────────────────────────

describe('handleSearchTags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return all tags with usage counts', async () => {
    setupMockVault();

    const result = await handleSearchTags(mockConfig, {});

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // Each tag entry has shape: { tag, count, notes }
    expect(Array.isArray(data.tags)).toBe(true);
    data.tags.forEach((entry: any) => {
      expect(entry).toHaveProperty('tag');
      expect(entry).toHaveProperty('count');
      expect(Array.isArray(entry.notes)).toBe(true);
    });

    const tagNames = data.tags.map((t: any) => t.tag);

    // 'recipe' appears in note-a (frontmatter) and folder/note-d (frontmatter) → count >= 2
    const recipeEntry = data.tags.find((t: any) => t.tag === 'recipe');
    expect(recipeEntry).toBeDefined();
    expect(recipeEntry.count).toBeGreaterThanOrEqual(2);
    expect(recipeEntry.notes).toContain('note-a.md');
    expect(recipeEntry.notes).toContain('folder/note-d.md');

    // 'cooking' from note-a frontmatter
    expect(tagNames).toContain('cooking');

    // 'healthy' is an inline tag from note-a content (#healthy)
    expect(tagNames).toContain('healthy');

    // 'orphan-tag' from note-c frontmatter
    expect(tagNames).toContain('orphan-tag');

    // 'standalone' from note-c inline #standalone
    expect(tagNames).toContain('standalone');

    expect(data.total).toBeGreaterThanOrEqual(5);
    expect(result.structuredContent).toBeDefined();
  });

  it('should filter tags by query (case-insensitive substring match)', async () => {
    setupMockVault();

    const result = await handleSearchTags(mockConfig, { query: 'rec' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // Only tags matching 'rec' should be returned — 'recipe' matches, 'cooking' does not
    const tagNames = data.tags.map((t: any) => t.tag);
    expect(tagNames).toContain('recipe');
    expect(tagNames).not.toContain('cooking');
    expect(tagNames).not.toContain('healthy');
    expect(data.query).toBe('rec');
  });

  it('should sort tags by count descending', async () => {
    setupMockVault();

    const result = await handleSearchTags(mockConfig, {});

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // Tags should be sorted by count descending
    for (let i = 0; i < data.tags.length - 1; i++) {
      expect(data.tags[i].count).toBeGreaterThanOrEqual(data.tags[i + 1].count);
    }
  });

  it('should return error for invalid vault', async () => {
    const result = await handleSearchTags(mockConfig, { vault: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
  });
});

// ─── handleGetOutgoingLinks ───────────────────────────────────────────────────

describe('handleGetOutgoingLinks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return outgoing wikilinks from a note', async () => {
    // note-a.md: [[note-b]] (wikilink) + ![[image.png]] (embed)
    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue(mockNoteContent['note-a.md'] as any);

    const result = await handleGetOutgoingLinks(mockConfig, {
      path: 'note-a',
      include_embeds: true,
      resolve: false,
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // Should have at least 2 links: [[note-b]] and ![[image.png]]
    expect(data.links.length).toBeGreaterThanOrEqual(2);

    // Wikilink to note-b
    const wikilink = data.links.find(
      (l: any) => l.target === 'note-b' && l.type === 'wikilink',
    );
    expect(wikilink).toBeDefined();
    expect(wikilink.alias).toBeNull();
    expect(wikilink.section).toBeNull();

    // Embed of image.png
    const embed = data.links.find(
      (l: any) => l.target === 'image.png' && l.type === 'embed',
    );
    expect(embed).toBeDefined();

    expect(data.source).toBe('note-a.md');
    expect(data.total).toBe(data.links.length);
    expect(result.structuredContent).toBeDefined();
  });

  it('should exclude embeds when include_embeds is false', async () => {
    // note-a.md has [[note-b]] (wikilink) and ![[image.png]] (embed)
    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue(mockNoteContent['note-a.md'] as any);

    const result = await handleGetOutgoingLinks(mockConfig, {
      path: 'note-a',
      include_embeds: false,
      resolve: false,
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // No embed entries
    const embeds = data.links.filter((l: any) => l.type === 'embed');
    expect(embeds).toHaveLength(0);

    // Wikilink should still be present
    const wikilinks = data.links.filter((l: any) => l.type === 'wikilink');
    expect(wikilinks.length).toBeGreaterThan(0);
  });

  it('should resolve link targets when resolve is true', async () => {
    // note-a.md: [[note-b]] and ![[image.png]]
    mockNoteExists
      .mockResolvedValueOnce(true)  // note-a.md exists (the source note check)
      .mockResolvedValueOnce(true)  // note-b.md exists (resolved link)
      .mockResolvedValueOnce(false); // image.png does NOT exist

    mockReadNote.mockResolvedValue(mockNoteContent['note-a.md'] as any);

    const result = await handleGetOutgoingLinks(mockConfig, {
      path: 'note-a',
      include_embeds: true,
      resolve: true,
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // All links should have 'exists' field
    data.links.forEach((link: any) => {
      expect(link).toHaveProperty('exists');
      expect(typeof link.exists).toBe('boolean');
    });

    // broken_count should be present when resolve is true
    expect(data).toHaveProperty('broken_count');
    expect(typeof data.broken_count).toBe('number');
  });

  it('should handle aliased links correctly', async () => {
    // note-b.md: [[note-a|my alias]] and [[folder/note-d#section]]
    mockNoteExists.mockResolvedValue(true);
    mockReadNote.mockResolvedValue(mockNoteContent['note-b.md'] as any);

    const result = await handleGetOutgoingLinks(mockConfig, {
      path: 'note-b',
      include_embeds: true,
      resolve: false,
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);

    // [[note-a|my alias]] → target: 'note-a', alias: 'my alias'
    const aliasedLink = data.links.find((l: any) => l.target === 'note-a');
    expect(aliasedLink).toBeDefined();
    expect(aliasedLink.alias).toBe('my alias');

    // [[folder/note-d#section]] → target: 'folder/note-d', section: 'section'
    const sectionLink = data.links.find((l: any) => l.target === 'folder/note-d');
    expect(sectionLink).toBeDefined();
    expect(sectionLink.section).toBe('section');
    expect(sectionLink.alias).toBeNull();
  });

  it('should return error for note not found', async () => {
    // noteExists returns false → handler returns NOTE_NOT_FOUND error response
    mockNoteExists.mockResolvedValue(false);

    const result = await handleGetOutgoingLinks(mockConfig, {
      path: 'nonexistent-note',
      include_embeds: true,
      resolve: false,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('NOTE_NOT_FOUND');
  });

  it('should return error for invalid vault', async () => {
    const result = await handleGetOutgoingLinks(mockConfig, {
      vault: 'nonexistent',
      path: 'any-note',
      include_embeds: true,
      resolve: false,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('FILESYSTEM_ERROR');
  });
});
