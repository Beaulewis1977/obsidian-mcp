import { readNote, listNotes, noteExists } from '../filesystem/vault-reader.js';
import { validatePath, ensureMarkdownExtension } from '../utils/validators.js';
import { createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getDefaultVault, getVaultByName } from '../config/index.js';
import { parseWikilinks, extractInlineTags, buildVaultGraph } from './link-graph.js';
import type { ServerConfig, VaultConfig, ToolResponse } from '../types/index.js';
import type { GetLinkGraphInput, FindOrphansInput, SearchTagsInput, GetOutgoingLinksInput } from './schemas.js';

/**
 * Get vault from input or default — mirrors the private helper in handlers2.ts.
 * Duplicated intentionally per Plan 02-02: do NOT refactor shared getVault in this plan.
 */
function getVault(config: ServerConfig, vaultName?: string): VaultConfig {
  const vault = vaultName ? getVaultByName(config, vaultName) : getDefaultVault(config);

  if (!vault) {
    throw new Error('No vault configured or specified vault not found');
  }

  return vault;
}

// ─── LINK-01: get_link_graph ──────────────────────────────────────────────────

/**
 * Handle get_link_graph — builds a vault-wide directed link graph with nodes,
 * edges, and summary statistics.
 *
 * Requirement: LINK-01
 */
export async function handleGetLinkGraph(
  config: ServerConfig,
  input: GetLinkGraphInput,
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);

    // Always build graph from full vault so nameToPath resolves cross-folder links correctly.
    // If folder is specified, filter nodes/edges after building the full graph.
    const graph = await buildVaultGraph(vault.path, listNotes, readNote);

    // If folder-scoped, filter to only nodes within the folder
    let nodeValues: import('./link-graph.js').GraphNode[];
    let filteredEdges: typeof graph.edges;
    if (input.folder) {
      const folderPrefix = input.folder.endsWith('/') ? input.folder : input.folder + '/';
      const folderPaths = new Set<string>();
      for (const [p] of graph.nodes) {
        if (p.startsWith(folderPrefix) || p.startsWith(input.folder + '\\')) {
          folderPaths.add(p);
        }
      }
      nodeValues = Array.from(graph.nodes.values()).filter(n => folderPaths.has(n.path));
      filteredEdges = graph.edges.filter(e => folderPaths.has(e.source));
    } else {
      nodeValues = Array.from(graph.nodes.values());
      filteredEdges = graph.edges;
    }
    const total_nodes = nodeValues.length;
    const total_edges = filteredEdges.length;
    const orphan_count = nodeValues.filter(n => n.incoming.length === 0 && n.outgoing.length === 0).length;
    const avg_connections = total_nodes === 0
      ? 0
      : Math.round(
          (nodeValues.reduce((sum, n) => sum + n.incoming.length + n.outgoing.length, 0) / total_nodes) * 100,
        ) / 100;

    // Top 10 most connected nodes
    const most_connected = nodeValues
      .map(n => ({
        path: n.path,
        name: n.name,
        total_connections: n.incoming.length + n.outgoing.length,
        incoming_count: n.incoming.length,
        outgoing_count: n.outgoing.length,
      }))
      .sort((a, b) => b.total_connections - a.total_connections)
      .slice(0, 10);

    const payload = {
      vault: vault.name,
      stats: {
        total_nodes,
        total_edges,
        orphan_count,
        avg_connections,
        most_connected,
      },
      nodes: nodeValues.map(n => ({
        path: n.path,
        name: n.name,
        folder: n.folder,
        outgoing_count: n.outgoing.length,
        incoming_count: n.incoming.length,
        tags: n.tags,
      })),
      edges: filteredEdges,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to get link graph');
    return createErrorResponse(
      'Failed to get link graph',
      error.message,
      'FILESYSTEM_ERROR',
    );
  }
}

// ─── LINK-02: find_orphans ────────────────────────────────────────────────────

/**
 * Handle find_orphans — finds notes with no incoming and/or no outgoing links.
 *
 * Requirement: LINK-02
 */
export async function handleFindOrphans(
  config: ServerConfig,
  input: FindOrphansInput,
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);

    const graph = await buildVaultGraph(vault.path, listNotes, readNote);
    const nodeValues = Array.from(graph.nodes.values());

    // Filter nodes based on orphan type
    let orphanNodes;
    switch (input.type) {
      case 'no_outgoing':
        orphanNodes = nodeValues.filter(n => n.outgoing.length === 0);
        break;
      case 'no_incoming':
        orphanNodes = nodeValues.filter(n => n.incoming.length === 0);
        break;
      case 'full':
      default:
        orphanNodes = nodeValues.filter(n => n.incoming.length === 0 && n.outgoing.length === 0);
        break;
    }

    const payload = {
      vault: vault.name,
      type: input.type,
      orphans: orphanNodes.map(n => ({
        path: n.path,
        name: n.name,
        folder: n.folder,
        tags: n.tags,
      })),
      total: orphanNodes.length,
      total_notes: graph.nodes.size,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to find orphans');
    return createErrorResponse(
      'Failed to find orphans',
      error.message,
      'FILESYSTEM_ERROR',
    );
  }
}

// ─── LINK-03: search_tags ─────────────────────────────────────────────────────

/**
 * Handle search_tags — vault-wide tag discovery with per-tag usage counts.
 * Covers both frontmatter tags (YAML array) and inline #tags.
 *
 * Requirement: LINK-03
 */
export async function handleSearchTags(
  config: ServerConfig,
  input: SearchTagsInput,
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);

    const allNotes = await listNotes(vault.path);

    // Map from tag → { count, notes[] }
    const tagMap = new Map<string, { count: number; notes: string[] }>();

    // Sequential reads — avoid opening too many file handles simultaneously
    for (const noteInfo of allNotes) {
      let note;
      try {
        note = await readNote(vault.path, noteInfo.path);
      } catch (err) {
        logger.warn({ err, path: noteInfo.path }, 'search_tags: failed to read note, skipping');
        continue;
      }

      // Extract and normalize frontmatter tags
      const fmTags: string[] = [];
      if (Array.isArray(note.frontmatter?.tags)) {
        for (const tag of note.frontmatter.tags) {
          if (typeof tag === 'string') {
            const normalized = tag.startsWith('#') ? tag.slice(1).trim() : tag.trim();
            if (normalized) fmTags.push(normalized);
          }
        }
      }

      // Extract inline tags
      const inlineTags = extractInlineTags(note.content);

      // Merge all tags for this note — deduplicate per-note before counting
      const noteTags = Array.from(new Set([...fmTags, ...inlineTags]));

      for (const tag of noteTags) {
        const existing = tagMap.get(tag);
        if (existing) {
          existing.count += 1;
          existing.notes.push(noteInfo.path);
        } else {
          tagMap.set(tag, { count: 1, notes: [noteInfo.path] });
        }
      }
    }

    // Apply query filter (case-insensitive substring match)
    let entries = Array.from(tagMap.entries());
    if (input.query) {
      const q = input.query.toLowerCase();
      entries = entries.filter(([tag]) => tag.toLowerCase().includes(q));
    }

    // Sort by count descending
    entries.sort((a, b) => b[1].count - a[1].count);

    const payload: Record<string, unknown> = {
      vault: vault.name,
      tags: entries.map(([tag, info]) => ({ tag, count: info.count, notes: info.notes })),
      total: entries.length,
    };

    if (input.query) {
      payload.query = input.query;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to search tags');
    return createErrorResponse(
      'Failed to search tags',
      error.message,
      'FILESYSTEM_ERROR',
    );
  }
}

// ─── LINK-04: get_outgoing_links ──────────────────────────────────────────────

/**
 * Handle get_outgoing_links — returns all wikilinks from a specific note,
 * with optional existence resolution for each link target.
 *
 * Requirement: LINK-04
 */
export async function handleGetOutgoingLinks(
  config: ServerConfig,
  input: GetOutgoingLinksInput,
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    const notePath = ensureMarkdownExtension(input.path);

    // Validate path
    const validation = validatePath(notePath, vault.path);
    if (!validation.valid) {
      return createErrorResponse(
        'Invalid path',
        validation.error!,
        'INVALID_PATH',
      );
    }

    // Check note exists
    if (!await noteExists(vault.path, notePath)) {
      return createErrorResponse(
        'Note not found',
        `No note exists at: ${notePath}`,
        'NOTE_NOT_FOUND',
      );
    }

    // Read note and parse wikilinks
    const note = await readNote(vault.path, notePath);
    let links = parseWikilinks(note.content);

    // Filter out embeds if not requested
    if (!input.include_embeds) {
      links = links.filter(link => !link.isEmbed);
    }

    // Optionally resolve each link target
    let brokenCount = 0;
    const resolvedLinks: Array<{
      target: string;
      type: 'wikilink' | 'embed';
      alias: string | null;
      section: string | null;
      exists?: boolean;
    }> = [];

    for (const link of links) {
      if (input.resolve) {
        // Check if target exists — try both with and without .md extension
        const targetWithExt = link.target.endsWith('.md') ? link.target : link.target + '.md';
        const exists = await noteExists(vault.path, targetWithExt);
        if (!exists) brokenCount++;

        resolvedLinks.push({
          target: link.target,
          type: link.isEmbed ? 'embed' : 'wikilink',
          alias: link.alias,
          section: link.section,
          exists,
        });
      } else {
        resolvedLinks.push({
          target: link.target,
          type: link.isEmbed ? 'embed' : 'wikilink',
          alias: link.alias,
          section: link.section,
        });
      }
    }

    const payload: Record<string, unknown> = {
      source: notePath,
      links: resolvedLinks,
      total: resolvedLinks.length,
    };

    if (input.resolve) {
      payload.broken_count = brokenCount;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to get outgoing links');
    return createErrorResponse(
      'Failed to get outgoing links',
      error.message,
      'FILESYSTEM_ERROR',
    );
  }
}
