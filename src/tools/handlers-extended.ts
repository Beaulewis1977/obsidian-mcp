import path from 'path';
import type { z } from 'zod';
import {
  ManageTagsSchema,
  ArchiveNoteSchema,
  ExtractLinksSchema,
  GetWeeklyNoteSchema,
  ListTemplatesSchema,
} from './schemas.js';
import type { ServerConfig, ToolResponse } from '../types/index.js';
import { createErrorResponse } from '../utils/errors.js';
import { readNote, listNotes, noteExists } from '../filesystem/vault-reader.js';
import { writeNote, moveNote } from '../filesystem/vault-writer.js';
import { validatePath, ensureMarkdownExtension } from '../utils/validators.js';
import { parseWikilinks } from './link-graph.js';
import { getDefaultVault, getVaultByName } from '../config/index.js';

// ---------------------------------------------------------------------------
// Vault resolution helper
// ---------------------------------------------------------------------------

function getVault(config: ServerConfig, vaultName?: string) {
  const vault = vaultName ? getVaultByName(config, vaultName) : getDefaultVault(config);
  if (!vault) throw new Error('No vault configured or specified vault not found');
  return vault;
}

// ---------------------------------------------------------------------------
// ISO week computation (native — no dayjs isoWeek plugin needed)
// Returns the current ISO week as "YYYY-Www" (e.g., "2026-W09").
// Uses Thursday-based ISO 8601 week numbering.
// ---------------------------------------------------------------------------

function currentISOWeek(): string {
  const now = new Date();
  // Find Thursday of the current week (ISO week: Mon=day1, Thu=day4)
  const thursday = new Date(now);
  thursday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 3);
  // Find first Thursday of the year
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
  // ISO week number = difference in weeks + 1
  const weekNum =
    Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${thursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// handleManageTags — XTND-01
// ---------------------------------------------------------------------------

/**
 * Add/remove tags on multiple notes.
 * Partial success: notes that cannot be found are recorded in results rather
 * than aborting the entire operation.
 */
export async function handleManageTags(
  config: ServerConfig,
  args: z.infer<typeof ManageTagsSchema>
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, args.vault);

    // Validate: at least one of add or remove must be provided
    if ((!args.add || args.add.length === 0) && (!args.remove || args.remove.length === 0)) {
      return createErrorResponse(
        'Missing tag operation',
        'At least one of "add" or "remove" must be provided with at least one tag.',
        'VALIDATION_ERROR',
        'Provide add:["tag1"] and/or remove:["tag2"] to modify tags.'
      );
    }

    const results: Array<{
      path: string;
      error?: string;
      tags_before?: string[];
      tags_after?: string[];
      tags_added?: string[];
      tags_removed?: string[];
      changed?: boolean;
    }> = [];

    // Sequential loop (not Promise.all) — safe for large vaults
    for (const notePath of args.paths) {
      const normalizedPath = ensureMarkdownExtension(notePath);

      // Validate path — partial failure, not abort
      const validation = validatePath(normalizedPath, vault.path);
      if (!validation.valid) {
        results.push({ path: normalizedPath, error: validation.error! });
        continue;
      }

      // Check existence — partial failure, not abort
      const exists = await noteExists(vault.path, normalizedPath);
      if (!exists) {
        results.push({ path: normalizedPath, error: 'Note not found' });
        continue;
      }

      const note = await readNote(vault.path, normalizedPath);

      // Normalize current tags: handle both string and array forms
      let currentTags: string[] = [];
      const rawTags = note.frontmatter?.tags;
      if (Array.isArray(rawTags)) {
        currentTags = rawTags.filter((t): t is string => typeof t === 'string');
      } else if (typeof rawTags === 'string' && rawTags.trim()) {
        currentTags = [rawTags.trim()];
      }

      const tagsBefore = [...currentTags];

      // Apply remove
      const removeSet = new Set(args.remove ?? []);
      let updatedTags = currentTags.filter(t => !removeSet.has(t));

      // Apply add (Set-dedup union)
      const addTags = args.add ?? [];
      const tagSet = new Set(updatedTags);
      const tagsAdded: string[] = [];
      for (const tag of addTags) {
        if (!tagSet.has(tag)) {
          tagSet.add(tag);
          tagsAdded.push(tag);
        }
      }
      updatedTags = Array.from(tagSet);

      const tagsRemoved = tagsBefore.filter(t => !updatedTags.includes(t));
      const changed =
        tagsAdded.length > 0 ||
        tagsRemoved.length > 0;

      if (changed) {
        const updatedNote = {
          ...note,
          frontmatter: {
            ...note.frontmatter,
            tags: updatedTags,
          },
        };
        await writeNote(vault.path, normalizedPath, updatedNote);
      }

      results.push({
        path: normalizedPath,
        tags_before: tagsBefore,
        tags_after: updatedTags,
        tags_added: tagsAdded,
        tags_removed: tagsRemoved,
        changed,
      });
    }

    const payload = {
      modified: results,
      total_modified: results.filter(r => r.changed).length,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    return createErrorResponse(
      'Failed to manage tags',
      error?.message ?? String(error),
      'FILESYSTEM_ERROR',
      'Check vault configuration and note paths.'
    );
  }
}

// ---------------------------------------------------------------------------
// handleArchiveNote — XTND-02
// ---------------------------------------------------------------------------

/**
 * Move a note to an archive folder, optionally adding an archived_date
 * frontmatter field.
 */
export async function handleArchiveNote(
  config: ServerConfig,
  args: z.infer<typeof ArchiveNoteSchema>
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, args.vault);
    const notePath = ensureMarkdownExtension(args.path);

    // Validate source path
    const srcValidation = validatePath(notePath, vault.path);
    if (!srcValidation.valid) {
      return createErrorResponse(
        'Invalid path',
        srcValidation.error!,
        'INVALID_PATH',
        'Use relative paths within the vault only.'
      );
    }

    // Check source exists
    const sourceExists = await noteExists(vault.path, notePath);
    if (!sourceExists) {
      return createErrorResponse(
        'Note not found',
        `Source note does not exist: ${notePath}`,
        'NOTE_NOT_FOUND',
        'Verify the note path is correct relative to the vault root.'
      );
    }

    // Compute archive path: archive_folder/basename.md
    const archivePath = path.join(args.archive_folder, path.basename(notePath)).replace(/\\/g, '/');

    // Validate archive path
    const archiveValidation = validatePath(archivePath, vault.path);
    if (!archiveValidation.valid) {
      return createErrorResponse(
        'Invalid path',
        archiveValidation.error!,
        'INVALID_PATH',
        'The archive_folder must be a relative path within the vault.'
      );
    }

    // Check for collision
    const archiveExists = await noteExists(vault.path, archivePath);
    if (archiveExists) {
      return createErrorResponse(
        'Archive target already exists',
        `Archive target already exists at ${archivePath}. Rename source or choose a different archive_folder.`,
        'NOTE_ALREADY_EXISTS',
        `Delete or rename the existing file at "${archivePath}" first.`
      );
    }

    // Move the note (vault-writer.ts moveNote takes vaultPath, sourcePath, targetPath)
    await moveNote(vault.path, notePath, archivePath);

    // Optionally add archived_date to frontmatter
    let archivedDate: string | undefined;
    if (args.add_date) {
      const today = new Date();
      archivedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const movedNote = await readNote(vault.path, archivePath);
      const updatedNote = {
        ...movedNote,
        frontmatter: {
          ...movedNote.frontmatter,
          archived_date: archivedDate,
        },
      };
      await writeNote(vault.path, archivePath, updatedNote);
    }

    const payload = {
      success: true,
      original_path: notePath,
      archive_path: archivePath,
      ...(archivedDate !== undefined ? { archived_date: archivedDate } : {}),
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    return createErrorResponse(
      'Failed to archive note',
      error?.message ?? String(error),
      'FILESYSTEM_ERROR',
      'Check vault configuration and note paths.'
    );
  }
}

// ---------------------------------------------------------------------------
// handleExtractLinks — XTND-03
// ---------------------------------------------------------------------------

/**
 * Extract all link types from a note: wikilinks, embeds, markdown links,
 * and external URLs.
 */
export async function handleExtractLinks(
  config: ServerConfig,
  args: z.infer<typeof ExtractLinksSchema>
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, args.vault);
    const notePath = ensureMarkdownExtension(args.path);

    // Validate path
    const validation = validatePath(notePath, vault.path);
    if (!validation.valid) {
      return createErrorResponse(
        'Invalid path',
        validation.error!,
        'INVALID_PATH',
        'Use relative paths within the vault only.'
      );
    }

    const exists = await noteExists(vault.path, notePath);
    if (!exists) {
      return createErrorResponse(
        'Note not found',
        `Note does not exist: ${notePath}`,
        'NOTE_NOT_FOUND',
        'Verify the note path is correct relative to the vault root.'
      );
    }

    const note = await readNote(vault.path, notePath);
    const content = note.content;

    // Extract wikilinks and embeds via parseWikilinks
    const parsed = parseWikilinks(content);
    const wikilinks = parsed
      .filter(w => !w.isEmbed)
      .map(w => ({ target: w.target, alias: w.alias, section: w.section }));
    const embeds = parsed
      .filter(w => w.isEmbed)
      .map(w => ({ target: w.target, alias: w.alias, section: w.section }));

    // Extract markdown links line-by-line with line numbers
    const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    const BARE_URL_RE = /(?<!\()(https?:\/\/[^\s)"'<>]+)/g;

    const markdownLinks: Array<{ text: string; url: string; line: number }> = [];
    const externalUrls: Array<{ url: string; line: number }> = [];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // Markdown links
      let mdMatch: RegExpExecArray | null;
      MARKDOWN_LINK_RE.lastIndex = 0;
      while ((mdMatch = MARKDOWN_LINK_RE.exec(line)) !== null) {
        markdownLinks.push({ text: mdMatch[1], url: mdMatch[2], line: lineNum });
      }

      // Bare external URLs (not already captured as part of a markdown link)
      BARE_URL_RE.lastIndex = 0;
      // Build a set of URLs already captured as markdown links on this line
      const mdUrls = new Set(markdownLinks.filter(ml => ml.line === lineNum).map(ml => ml.url));
      let urlMatch: RegExpExecArray | null;
      while ((urlMatch = BARE_URL_RE.exec(line)) !== null) {
        const url = urlMatch[1];
        if (!mdUrls.has(url)) {
          externalUrls.push({ url, line: lineNum });
        }
      }
    }

    // Apply type filter
    const typeFilter = args.types;
    const includeAll = !typeFilter || typeFilter.length === 0;
    const include = (t: 'wikilink' | 'embed' | 'markdown' | 'external') =>
      includeAll || typeFilter!.includes(t);

    const result: Record<string, unknown> = {
      path: notePath,
    };
    if (include('wikilink')) result.wikilinks = wikilinks;
    if (include('embed')) result.embeds = embeds;
    if (include('markdown')) result.markdown_links = markdownLinks;
    if (include('external')) result.external_urls = externalUrls;

    const total =
      (include('wikilink') ? wikilinks.length : 0) +
      (include('embed') ? embeds.length : 0) +
      (include('markdown') ? markdownLinks.length : 0) +
      (include('external') ? externalUrls.length : 0);

    result.total = total;

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  } catch (error: any) {
    return createErrorResponse(
      'Failed to extract links',
      error?.message ?? String(error),
      'FILESYSTEM_ERROR',
      'Check vault configuration and note path.'
    );
  }
}

// ---------------------------------------------------------------------------
// handleGetWeeklyNote — XTND-04
// ---------------------------------------------------------------------------

/**
 * Get or create the weekly note for a given ISO week string (YYYY-Www).
 */
export async function handleGetWeeklyNote(
  config: ServerConfig,
  args: z.infer<typeof GetWeeklyNoteSchema>
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, args.vault);

    // Determine week string (default = current ISO week)
    const weekStr = args.week ?? currentISOWeek();

    // Validate format YYYY-Www
    if (!/^\d{4}-W\d{2}$/.test(weekStr)) {
      return createErrorResponse(
        'Invalid week format',
        `Week "${weekStr}" does not match required format YYYY-Www (e.g., "2026-W09").`,
        'VALIDATION_ERROR',
        'Provide a week string in YYYY-Www format, e.g., "2026-W09".'
      );
    }

    // Filename = weekStr + '.md' (e.g., "2026-W09.md")
    const filename = `${weekStr}.md`;
    const notePath = path.join(args.week_folder, filename).replace(/\\/g, '/');

    // Validate path
    const validation = validatePath(notePath, vault.path);
    if (!validation.valid) {
      return createErrorResponse(
        'Invalid path',
        validation.error!,
        'INVALID_PATH',
        'The week_folder must be a relative path within the vault.'
      );
    }

    const exists = await noteExists(vault.path, notePath);

    if (exists) {
      const note = await readNote(vault.path, notePath);
      const payload = {
        path: notePath,
        created: false,
        week: weekStr,
        frontmatter: note.frontmatter,
        content: note.content,
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload as Record<string, unknown>,
      };
    }

    // Note does not exist
    if (!args.create_if_missing) {
      return createErrorResponse(
        'Weekly note not found',
        `Weekly note for ${weekStr} does not exist at ${notePath}.`,
        'NOTE_NOT_FOUND',
        'Pass create_if_missing:true to create the note automatically.'
      );
    }

    // Create the note
    const newNote = {
      path: notePath,
      frontmatter: { week: weekStr },
      content: '',
      links: [],
    };
    await writeNote(vault.path, notePath, newNote);

    const payload = {
      path: notePath,
      created: true,
      week: weekStr,
      frontmatter: newNote.frontmatter,
      content: newNote.content,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    return createErrorResponse(
      'Failed to get weekly note',
      error?.message ?? String(error),
      'FILESYSTEM_ERROR',
      'Check vault configuration and week_folder path.'
    );
  }
}

// ---------------------------------------------------------------------------
// handleListTemplates — XTND-05
// ---------------------------------------------------------------------------

/**
 * List notes in the templates folder.
 * Returns an empty list (not an error) when the folder does not exist.
 */
export async function handleListTemplates(
  config: ServerConfig,
  args: z.infer<typeof ListTemplatesSchema>
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, args.vault);

    // Validate template folder path
    const validation = validatePath(args.template_folder, vault.path);
    if (!validation.valid) {
      return createErrorResponse(
        'Invalid path',
        validation.error!,
        'INVALID_PATH',
        'The template_folder must be a relative path within the vault.'
      );
    }

    let templates: unknown[] = [];
    let note: string | undefined;

    try {
      templates = await listNotes(vault.path, args.template_folder);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        note = `Template folder '${args.template_folder}' not found in vault`;
      } else {
        throw err;
      }
    }

    const payload: Record<string, unknown> = {
      templates,
      total: templates.length,
      template_folder: args.template_folder,
    };
    if (note) {
      payload.note = note;
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  } catch (error: any) {
    return createErrorResponse(
      'Failed to list templates',
      error?.message ?? String(error),
      'FILESYSTEM_ERROR',
      'Check vault configuration and template_folder path.'
    );
  }
}
