import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock filesystem BEFORE importing handlers (vitest hoists vi.mock calls)
vi.mock('../../filesystem/vault-reader.js', () => ({
  readNote: vi.fn(),
  listNotes: vi.fn(),
  searchNotes: vi.fn(),
  noteExists: vi.fn(),
}));

vi.mock('../../filesystem/vault-writer.js', () => ({
  writeNote: vi.fn().mockResolvedValue(undefined),
}));

// Import handlers AFTER mock declarations
import { handleListNotes, handleSearchNotes } from '../handlers.js';
import { handleSearchTags } from '../handlers-link.js';
import { readNote, listNotes, searchNotes, noteExists } from '../../filesystem/vault-reader.js';

const mockReadNote = vi.mocked(readNote);
const mockListNotes = vi.mocked(listNotes);
const mockSearchNotes = vi.mocked(searchNotes);

function makeMockConfig() {
  return {
    version: '1.0',
    vaults: [{ name: 'test', path: '/vault', default: true }],
    rate_limiting: { enabled: false },
  } as any;
}

/** Build N NoteInfo objects with unique paths */
function makeNoteInfos(count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    path: `note-${i}.md`,
    name: `note-${i}.md`,
    folder: '/',
  }));
}

/** Build N search result objects */
function makeSearchResults(count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    path: `note-${i}.md`,
    matches: [{ line: 1, text: `match content ${i}`, context: [] }],
  }));
}

// ─── handleListNotes pagination ──────────────────────────────────────────────

describe('handleListNotes pagination', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns first page with nextCursor when >50 notes exist', async () => {
    mockListNotes.mockResolvedValue(makeNoteInfos(70) as any);

    const result = await handleListNotes(makeMockConfig(), {
      folder: undefined,
      include_metadata: false,
    } as any);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.notes).toHaveLength(50);
    expect(payload.total).toBe(70);
    expect(payload.nextCursor).toBeDefined();
    expect(typeof payload.nextCursor).toBe('string');
  });

  it('returns second page with no nextCursor (last page)', async () => {
    mockListNotes.mockResolvedValue(makeNoteInfos(70) as any);

    // Get the nextCursor from first page
    const firstResult = await handleListNotes(makeMockConfig(), {
      folder: undefined,
      include_metadata: false,
    } as any);
    const firstPayload = JSON.parse(firstResult.content[0].text);
    const cursor = firstPayload.nextCursor;

    // Fetch second page
    const result = await handleListNotes(makeMockConfig(), {
      folder: undefined,
      include_metadata: false,
      cursor,
    } as any);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.notes).toHaveLength(20);
    expect(payload.total).toBe(70);
    expect(payload.nextCursor).toBeUndefined();
  });

  it('returns all notes when <=50 (no pagination)', async () => {
    mockListNotes.mockResolvedValue(makeNoteInfos(10) as any);

    const result = await handleListNotes(makeMockConfig(), {
      folder: undefined,
      include_metadata: false,
    } as any);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.notes).toHaveLength(10);
    expect(payload.total).toBe(10);
    expect(payload.nextCursor).toBeUndefined();
  });
});

// ─── handleSearchNotes pagination ────────────────────────────────────────────

describe('handleSearchNotes pagination', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns first page with nextCursor when >50 results exist', async () => {
    // No obsidian_api on config — goes directly to filesystem search
    mockSearchNotes.mockResolvedValue(makeSearchResults(60) as any);

    const result = await handleSearchNotes(makeMockConfig(), {
      query: 'test',
      mode: 'filesystem',
    } as any);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.results).toHaveLength(50);
    expect(payload.total).toBe(60);
    expect(payload.nextCursor).toBeDefined();
    expect(typeof payload.nextCursor).toBe('string');
  });

  it('second page covers remaining results', async () => {
    mockSearchNotes.mockResolvedValue(makeSearchResults(60) as any);

    // Get cursor from first page
    const firstResult = await handleSearchNotes(makeMockConfig(), {
      query: 'test',
      mode: 'filesystem',
    } as any);
    const firstPayload = JSON.parse(firstResult.content[0].text);
    const cursor = firstPayload.nextCursor;

    // Fetch second page
    const result = await handleSearchNotes(makeMockConfig(), {
      query: 'test',
      mode: 'filesystem',
      cursor,
    } as any);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.results).toHaveLength(10);
    expect(payload.total).toBe(60);
    expect(payload.nextCursor).toBeUndefined();
  });
});

// ─── handleSearchTags pagination ─────────────────────────────────────────────

describe('handleSearchTags pagination', () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * Build a vault of N notes, each with one unique tag (tag-0, tag-1, …, tag-N-1).
   * Useful for producing exactly N distinct tags.
   */
  function setupTagVault(tagCount: number) {
    const notes = Array.from({ length: tagCount }, (_, i) => ({
      path: `note-${i}.md`,
      name: `note-${i}.md`,
      folder: '/',
    }));

    mockListNotes.mockResolvedValue(notes as any);
    mockReadNote.mockImplementation(async (_vaultPath, p) => {
      const idx = parseInt((p as string).replace('note-', '').replace('.md', ''), 10);
      return {
        path: p,
        frontmatter: { tags: [`tag-${idx}`] },
        content: '',
      } as any;
    });
  }

  it('returns first page of tags with nextCursor when >50 tags exist', async () => {
    setupTagVault(60);

    const result = await handleSearchTags(makeMockConfig(), {} as any);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.tags).toHaveLength(50);
    expect(payload.total).toBe(60);
    expect(payload.nextCursor).toBeDefined();
    expect(typeof payload.nextCursor).toBe('string');
  });

  it('second page covers remaining tags', async () => {
    setupTagVault(60);

    // Get cursor from first page
    const firstResult = await handleSearchTags(makeMockConfig(), {} as any);
    const firstPayload = JSON.parse(firstResult.content[0].text);
    const cursor = firstPayload.nextCursor;

    // Re-setup because vi.clearAllMocks() only runs in beforeEach; need consistent mock here
    setupTagVault(60);

    const result = await handleSearchTags(makeMockConfig(), { cursor } as any);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.tags).toHaveLength(10);
    expect(payload.total).toBe(60);
    expect(payload.nextCursor).toBeUndefined();
  });

  it('no cursor returns all tags when <=50 (baseline — no pagination)', async () => {
    setupTagVault(10);

    const result = await handleSearchTags(makeMockConfig(), {} as any);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.tags).toHaveLength(10);
    expect(payload.total).toBe(10);
    expect(payload.nextCursor).toBeUndefined();
  });
});
