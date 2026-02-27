import dayjs from 'dayjs';
import { readNote, listNotes, noteExists } from '../filesystem/vault-reader.js';
import { writeNote, moveNote as fsMoveNote, createFolder as fsCreateFolder } from '../filesystem/vault-writer.js';
import { openInObsidian as platformOpenInObsidian, openURI } from '../platform/process-spawner.js';
import { validatePath, ensureMarkdownExtension } from '../utils/validators.js';
import { createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ServerConfig, VaultConfig, ToolResponse, Note } from '../types/index.js';
import type {
  MoveNoteInput,
  UpdateFrontmatterInput,
  GetDailyNoteInput,
  OpenInObsidianInput,
  GetBacklinksInput,
  CreateFolderInput,
  GetVaultStatsInput
} from './schemas.js';
import { getDefaultVault, getVaultByName } from '../config/index.js';
import { ObsidianAPIClient, ApiCallMetadata } from '../obsidian/api-client.js';

/**
 * Get vault from input or default
 */
function getVault(config: ServerConfig, vaultName?: string): VaultConfig {
  const vault = vaultName ? getVaultByName(config, vaultName) : getDefaultVault(config);
  
  if (!vault) {
    throw new Error('No vault configured or specified vault not found');
  }
  
  return vault;
}

/**
 * Get API client if available
 */
function getAPIClient(vault: VaultConfig): ObsidianAPIClient | null {
  if (!vault.obsidian_api?.enabled || !vault.obsidian_api.api_key) {
    return null;
  }
  
  return new ObsidianAPIClient(vault.obsidian_api);
}

/**
 * Handle move_note tool
 */
export async function handleMoveNote(
  config: ServerConfig,
  input: MoveNoteInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    const sourcePath = ensureMarkdownExtension(input.source_path);
    const targetPath = ensureMarkdownExtension(input.target_path);
    
    // Validate paths
    const sourceValidation = validatePath(sourcePath, vault.path);
    if (!sourceValidation.valid) {
      return createErrorResponse(
        'Invalid source path',
        sourceValidation.error!,
        'INVALID_PATH'
      );
    }
    
    const targetValidation = validatePath(targetPath, vault.path);
    if (!targetValidation.valid) {
      return createErrorResponse(
        'Invalid target path',
        targetValidation.error!,
        'INVALID_PATH'
      );
    }
    
    // Check if source exists
    if (!await noteExists(vault.path, sourcePath)) {
      return createErrorResponse(
        'Source note not found',
        `No note exists at: ${sourcePath}`,
        'NOTE_NOT_FOUND'
      );
    }
    
    // Check if target already exists
    if (await noteExists(vault.path, targetPath)) {
      return createErrorResponse(
        'Target already exists',
        `A note already exists at: ${targetPath}`,
        'NOTE_ALREADY_EXISTS',
        'Choose a different target path or delete the existing note first.'
      );
    }
    
    // Move via filesystem (API doesn't have a move endpoint)
    await fsMoveNote(vault.path, sourcePath, targetPath);

    const payload = {
      success: true,
      source_path: sourcePath,
      target_path: targetPath,
      warning: '⚠️ Note moved successfully. WARNING: Wikilinks to this note have NOT been automatically updated. You may need to update links in other notes manually or use Obsidian\'s "Update internal links" command.',
      suggestion: 'Open Obsidian and use Command Palette → "Update internal links" to fix broken links.'
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload as Record<string, unknown>
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to move note');
    
    return createErrorResponse(
      'Failed to move note',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle update_frontmatter tool
 */
export async function handleUpdateFrontmatter(
  config: ServerConfig,
  input: UpdateFrontmatterInput
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
        'INVALID_PATH'
      );
    }
    
    // Read note
    const note = await readNote(vault.path, notePath);
    
    // Update frontmatter
    if (input.merge) {
      note.frontmatter = {
        ...note.frontmatter,
        ...input.updates
      };
    } else {
      note.frontmatter = input.updates;
    }
    
    // Write note
    await writeNote(vault.path, notePath, note);
    
    const payload = {
      success: true,
      path: notePath,
      frontmatter: note.frontmatter,
      merged: input.merge
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload as Record<string, unknown>
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to update frontmatter');
    
    if (error.message.includes('not found')) {
      return createErrorResponse(
        'Note not found',
        error.message,
        'NOTE_NOT_FOUND'
      );
    }
    
    return createErrorResponse(
      'Failed to update frontmatter',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle get_daily_note tool
 */
export async function handleGetDailyNote(
  config: ServerConfig,
  input: GetDailyNoteInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    const dailyConfig = vault.daily_notes || {
      folder: 'daily',
      date_format: 'YYYY-MM-DD'
    };
    
    // Parse date (default to today)
    const date = input.date ? dayjs(input.date) : dayjs();
    
    if (!date.isValid()) {
      return createErrorResponse(
        'Invalid date',
        'Date must be in YYYY-MM-DD format',
        'VALIDATION_ERROR'
      );
    }
    
    // Generate path
    const filename = date.format(dailyConfig.date_format) + '.md';
    const notePath = `${dailyConfig.folder}/${filename}`;
    
    // Check if exists
    const exists = await noteExists(vault.path, notePath);
    
    if (exists) {
      const note = await readNote(vault.path, notePath);
      const payload = { ...note, path: notePath, created: false };
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(payload, null, 2)
        }],
        structuredContent: payload as Record<string, unknown>
      };
    }
    
    // Create if requested
    if (input.create_if_missing) {
      const content = dailyConfig.template
        ? await applyTemplate(vault.path, dailyConfig.template, { date: date.format('YYYY-MM-DD') })
        : `# ${date.format('MMMM D, YYYY')}\n\n`;
      
      const note: Partial<Note> = {
        frontmatter: {
          date: date.format('YYYY-MM-DD'),
          tags: ['daily']
        },
        content
      };
      
      await writeNote(vault.path, notePath, note);

      const payload = { ...note, path: notePath, created: true };
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(payload, null, 2)
        }],
        structuredContent: payload as Record<string, unknown>
      };
    }
    
    return createErrorResponse(
      'Daily note not found',
      `Daily note for ${date.format('YYYY-MM-DD')} does not exist`,
      'NOTE_NOT_FOUND',
      'Set create_if_missing=true to create the note automatically.'
    );
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to get daily note');
    
    return createErrorResponse(
      'Failed to get daily note',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Apply template (simple variable substitution)
 */
async function applyTemplate(vaultPath: string, templatePath: string, variables: Record<string, string>): Promise<string> {
  try {
    const template = await readNote(vaultPath, templatePath);
    let result = template.content;
    
    // Add default variables
    const vars = {
      date: dayjs().format('YYYY-MM-DD'),
      time: dayjs().format('HH:mm'),
      ...variables
    };
    
    // Simple variable substitution
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  } catch (error) {
    logger.warn({ error, templatePath }, 'Failed to apply template, using default');
    return '';
  }
}

/**
 * Handle open_in_obsidian tool
 */
export async function handleOpenInObsidian(
  config: ServerConfig,
  input: OpenInObsidianInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    let apiMetadata: ApiCallMetadata | undefined;
    let fallbackReason: string | undefined;

    if (input.path) {
      const notePath = ensureMarkdownExtension(input.path);
      
      // Try API first
      const apiClient = getAPIClient(vault);
      if (apiClient && await apiClient.checkAvailability()) {
        try {
          apiMetadata = await apiClient.openNote(notePath);
          const apiPayload = {
            success: true,
            method: 'api',
            path: notePath,
            api_metadata: apiMetadata
          };
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(apiPayload, null, 2)
            }],
            structuredContent: apiPayload as Record<string, unknown>
          };
        } catch (error) {
          logger.warn({ error }, 'API open failed, trying URI protocol');
          fallbackReason = (error as Error).message;
        }
      }
      
      // Fallback to URI protocol
      const uri = `obsidian://open?vault=${encodeURIComponent(vault.name)}&file=${encodeURIComponent(notePath)}`;
      await openURI(uri);

      const uriPayload = {
        success: true,
        method: 'uri',
        path: notePath,
        fallback_reason: fallbackReason,
        api_metadata: apiMetadata
      };
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(uriPayload, null, 2)
        }],
        structuredContent: uriPayload as Record<string, unknown>
      };
    } else {
      // Open vault — try app spawn first, fall back to URI protocol
      let vaultMethod: 'app' | 'uri' = 'app';
      let vaultFallbackReason: string | undefined;

      try {
        await platformOpenInObsidian(vault.path);
      } catch (appError) {
        logger.warn({ error: appError }, 'App spawn failed, trying URI protocol');
        vaultFallbackReason = (appError as Error).message;
        vaultMethod = 'uri';
        const uri = `obsidian://open?vault=${encodeURIComponent(vault.name)}`;
        await openURI(uri);
      }

      const vaultPayload: Record<string, unknown> = {
        success: true,
        method: vaultMethod,
        vault: vault.name
      };
      if (vaultFallbackReason) {
        vaultPayload.fallback_reason = vaultFallbackReason;
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(vaultPayload, null, 2)
        }],
        structuredContent: vaultPayload
      };
    }
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to open in Obsidian');
    
    return createErrorResponse(
      'Failed to open in Obsidian',
      error.message,
      'PROCESS_SPAWN_FAILED',
      'Make sure Obsidian is installed and the Local REST API plugin is enabled.'
    );
  }
}

/**
 * Handle get_backlinks tool
 */
export async function handleGetBacklinks(
  config: ServerConfig,
  input: GetBacklinksInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    const notePath = ensureMarkdownExtension(input.path);
    
    // Get all notes
    const allNotes = await listNotes(vault.path);
    const backlinks: any[] = [];
    
    // Extract note name without extension for link matching
    const noteName = notePath.replace(/\.md$/, '');
    
    // Search for links to this note
    for (const noteInfo of allNotes) {
      try {
        const note = await readNote(vault.path, noteInfo.path);
        
        // Check if this note links to target
        const linksToTarget = note.links?.filter(link => 
          link.target === noteName || link.target === notePath
        ) || [];
        
        if (linksToTarget.length > 0) {
          backlinks.push({
            path: noteInfo.path,
            link_count: linksToTarget.length,
            links: linksToTarget
          });
        }
      } catch (error) {
        logger.warn({ error, path: noteInfo.path }, 'Error reading note for backlinks');
      }
    }
    
    const payload = {
      target: notePath,
      backlinks,
      total: backlinks.length
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload as Record<string, unknown>
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to get backlinks');
    
    return createErrorResponse(
      'Failed to get backlinks',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle create_folder tool
 */
export async function handleCreateFolder(
  config: ServerConfig,
  input: CreateFolderInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    
    // Validate path
    const validation = validatePath(input.path, vault.path);
    if (!validation.valid) {
      return createErrorResponse(
        'Invalid path',
        validation.error!,
        'INVALID_PATH'
      );
    }
    
    await fsCreateFolder(vault.path, input.path);

    const payload = {
      success: true,
      path: input.path
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload as Record<string, unknown>
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to create folder');
    
    return createErrorResponse(
      'Failed to create folder',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle get_vault_stats tool
 */
export async function handleGetVaultStats(
  config: ServerConfig,
  input: GetVaultStatsInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    
    // Get all notes
    const notes = await listNotes(vault.path, undefined, true);
    
    // Calculate stats
    let totalSize = 0;
    const tags = new Set<string>();
    let linkCount = 0;
    
    for (const noteInfo of notes) {
      if (noteInfo.metadata?.size) {
        totalSize += noteInfo.metadata.size;
      }
      
      try {
        const note = await readNote(vault.path, noteInfo.path);
        
        // Count tags
        if (note.frontmatter.tags && Array.isArray(note.frontmatter.tags)) {
          note.frontmatter.tags.forEach(tag => tags.add(tag));
        }
        
        // Count links
        if (note.links) {
          linkCount += note.links.length;
        }
      } catch (error) {
        logger.warn({ error, path: noteInfo.path }, 'Error reading note for stats');
      }
    }
    
    const payload = {
      vault: vault.name,
      note_count: notes.length,
      total_size: totalSize,
      unique_tags: tags.size,
      total_links: linkCount,
      tags: Array.from(tags).sort()
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload as Record<string, unknown>
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to get vault stats');
    
    return createErrorResponse(
      'Failed to get vault stats',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}
