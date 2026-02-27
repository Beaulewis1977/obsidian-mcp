import path from 'path';
import { logger } from '../utils/logger.js';
import type { Note } from '../types/index.js';

/**
 * A parsed Obsidian wikilink — handles all 5 Obsidian link formats:
 *   [[Note]]
 *   [[Note|Alias]]
 *   [[Note#Section]]
 *   [[Note#Section|Alias]]
 *   ![[embed]]
 *
 * NOTE: We do NOT use remark-wiki-link here — v2.0.1 does not parse pipe aliases
 * correctly (stores "Note|Alias" as the raw value) and completely ignores ![[embed]]
 * syntax. Regex-based parsing is the correct approach (verified in Phase 2 research).
 */
export interface ParsedWikilink {
  /** Base note name (no section, no alias) */
  target: string;
  /** Display alias, if any */
  alias: string | null;
  /** Section anchor (after #), if any */
  section: string | null;
  /** true when the link started with ![[...]] (embed) */
  isEmbed: boolean;
  /** Full match text */
  raw: string;
}

/**
 * Parse all wikilinks in a markdown string.
 *
 * Handles:
 *   [[Note]]                 → target="Note", alias=null, section=null
 *   [[Note|Alias]]           → target="Note", alias="Alias", section=null
 *   [[Note#Section]]         → target="Note", alias=null, section="Section"
 *   [[Note#Section|Alias]]   → target="Note", alias="Alias", section="Section"
 *   ![[embed]]               → target="embed", isEmbed=true
 *
 * Returns an empty array for empty or null content.
 */
export function parseWikilinks(content: string): ParsedWikilink[] {
  if (!content) return [];

  const results: ParsedWikilink[] = [];
  // Matches both [[...]] and ![[...]]
  const WIKILINK_RE = /(!?)\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const isEmbed = match[1] === '!';
    const inner = match[2]; // Everything between [[ and ]]

    // Split on pipe (|) first to get alias — only the LAST pipe is the alias delimiter
    // This handles edge cases like [[Folder|Note|Alias]] (rare but possible)
    const pipeIdx = inner.lastIndexOf('|');
    let core: string;
    let alias: string | null = null;

    if (pipeIdx !== -1) {
      core = inner.slice(0, pipeIdx);
      alias = inner.slice(pipeIdx + 1).trim() || null;
    } else {
      core = inner;
    }

    // Split core on # to get section — only the FIRST # is the section delimiter
    const hashIdx = core.indexOf('#');
    let target: string;
    let section: string | null = null;

    if (hashIdx !== -1) {
      target = core.slice(0, hashIdx).trim();
      section = core.slice(hashIdx + 1).trim() || null;
    } else {
      target = core.trim();
    }

    if (!target) continue; // Skip malformed links like [[#section-only]]

    results.push({
      target,
      alias,
      section,
      isEmbed,
      raw: match[0],
    });
  }

  return results;
}

/**
 * Extract inline tags from markdown body content.
 *
 * Matches #tag patterns that appear after word-boundaries/whitespace/punctuation.
 * Tags must start with a letter and can contain letters, digits, slashes, hyphens, underscores.
 *
 * NOTE: This does NOT attempt to skip code blocks (an acceptable tradeoff per Phase 2 research).
 * Returns deduplicated tag names WITHOUT the leading # prefix.
 */
export function extractInlineTags(content: string): string[] {
  if (!content) return [];

  const TAG_RE = /(?:^|[\s,;!?])(#[A-Za-z][A-Za-z0-9\/\-_]*)/gm;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(content)) !== null) {
    // Strip the leading # from the captured tag
    const tag = match[1].slice(1);
    seen.add(tag);
  }

  return Array.from(seen);
}

/**
 * A single node in the vault link graph.
 */
export interface GraphNode {
  /** Relative path within the vault (e.g., "folder/note.md") */
  path: string;
  /** File name including extension (e.g., "note.md") */
  name: string;
  /** Containing folder path (e.g., "folder" or "/") */
  folder: string;
  /** Resolved paths of notes this note links TO */
  outgoing: string[];
  /** Resolved paths of notes that link TO this note */
  incoming: string[];
  /** All tags (frontmatter + inline), deduplicated, without # prefix */
  tags: string[];
}

/**
 * A directed link graph of the entire vault (or a scoped subset).
 */
export interface VaultGraph {
  /** Map from note path → GraphNode */
  nodes: Map<string, GraphNode>;
  /** All directed edges in the graph */
  edges: Array<{ source: string; target: string; type: 'wikilink' | 'embed' }>;
}

/**
 * Build a directed link graph for the vault.
 *
 * Accepts `listNotesFn` and `readNoteFn` as parameters (not direct imports) for testability.
 *
 * Algorithm:
 * 1. List all notes
 * 2. Sort by path length ascending → shortest path wins for same-name files (Pitfall 4)
 * 3. Build nameToPath lookup (basename and full relative path entries)
 * 4. First pass: read each note sequentially (NOT Promise.all — avoid opening 1000+ file handles simultaneously, Pitfall 3)
 *    - Extract frontmatter tags + inline tags, normalize (strip leading #)
 *    - Extract wikilinks via parseWikilinks (NOT remark-wiki-link, Pitfall 1)
 *    - Resolve each link target to a vault path
 *    - Populate node.outgoing and graph.edges
 * 5. Second pass: fill node.incoming arrays from edges (reverse-edge pass)
 * 6. Return VaultGraph
 *
 * @param vaultPath - Absolute filesystem path to the vault root
 * @param listNotesFn - Function conforming to vault-reader.listNotes signature
 * @param readNoteFn - Function conforming to vault-reader.readNote signature
 */
export async function buildVaultGraph(
  vaultPath: string,
  listNotesFn: (vaultPath: string, folder?: string) => Promise<Array<{ path: string; name: string; folder: string }>>,
  readNoteFn: (vaultPath: string, notePath: string) => Promise<Note>,
): Promise<VaultGraph> {
  // Step 1: List all notes
  const noteList = await listNotesFn(vaultPath);

  // Step 2: Sort by path length ascending — shortest path wins when basenames collide
  noteList.sort((a, b) => a.path.length - b.path.length);

  // Step 3: Build basename → path lookup (first/shortest entry wins on collision)
  const nameToPath = new Map<string, string>();
  for (const note of noteList) {
    // Register by full relative path (with and without .md extension)
    nameToPath.set(note.path, note.path);
    const pathWithoutExt = note.path.replace(/\.md$/, '');
    nameToPath.set(pathWithoutExt, note.path);

    // Register by basename (without extension) — shorter path wins on collision
    const basename = path.basename(note.path, '.md');
    if (!nameToPath.has(basename)) {
      nameToPath.set(basename, note.path);
    }
    // Also register basename with extension
    const basenameWithExt = path.basename(note.path);
    if (!nameToPath.has(basenameWithExt)) {
      nameToPath.set(basenameWithExt, note.path);
    }
  }

  // Initialize GraphNode for each note
  const nodes = new Map<string, GraphNode>();
  for (const note of noteList) {
    nodes.set(note.path, {
      path: note.path,
      name: note.name,
      folder: note.folder,
      outgoing: [],
      incoming: [],
      tags: [],
    });
  }

  const edges: VaultGraph['edges'] = [];

  /**
   * Resolve a wikilink target string to a note path in the vault.
   * Tries, in order:
   *   1. target + '.md'
   *   2. target (as-is)
   *   3. basename(target) — for links that include folder prefix
   * Returns null if the target cannot be resolved to a known note.
   */
  function resolveWikilink(target: string): string | null {
    // Try with .md extension
    const withExt = target.endsWith('.md') ? target : target + '.md';
    if (nameToPath.has(withExt)) return nameToPath.get(withExt)!;

    // Try without extension (full path or basename)
    if (nameToPath.has(target)) return nameToPath.get(target)!;

    // Try just the basename (strip any folder prefix in the link)
    const base = path.basename(target, '.md');
    if (nameToPath.has(base)) return nameToPath.get(base)!;

    return null;
  }

  // Step 4: First pass — read each note, extract tags and wikilinks
  for (const noteInfo of noteList) {
    const node = nodes.get(noteInfo.path)!;

    let note: Note;
    try {
      note = await readNoteFn(vaultPath, noteInfo.path);
    } catch (err) {
      logger.warn({ err, path: noteInfo.path }, 'link-graph: failed to read note, skipping');
      continue;
    }

    // Extract and normalize frontmatter tags
    const fmTags: string[] = [];
    if (Array.isArray(note.frontmatter?.tags)) {
      for (const tag of note.frontmatter.tags) {
        if (typeof tag === 'string') {
          // Strip leading # if present (Pitfall 5)
          fmTags.push(tag.startsWith('#') ? tag.slice(1).trim() : tag.trim());
        }
      }
    }

    // Extract inline tags from content
    const inlineTags = extractInlineTags(note.content);

    // Merge and deduplicate tags
    const tagSet = new Set<string>([...fmTags, ...inlineTags]);
    node.tags = Array.from(tagSet);

    // Extract and resolve wikilinks
    const wikilinks = parseWikilinks(note.content);
    for (const link of wikilinks) {
      const resolvedPath = resolveWikilink(link.target);
      if (resolvedPath && resolvedPath !== noteInfo.path) {
        // Only add to outgoing once (deduplicate)
        if (!node.outgoing.includes(resolvedPath)) {
          node.outgoing.push(resolvedPath);
        }
        edges.push({
          source: noteInfo.path,
          target: resolvedPath,
          type: link.isEmbed ? 'embed' : 'wikilink',
        });
      }
    }
  }

  // Step 5: Second pass — fill incoming arrays from edges
  for (const edge of edges) {
    const targetNode = nodes.get(edge.target);
    if (targetNode && !targetNode.incoming.includes(edge.source)) {
      targetNode.incoming.push(edge.source);
    }
  }

  return { nodes, edges };
}
