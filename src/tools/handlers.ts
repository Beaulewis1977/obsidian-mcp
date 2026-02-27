
import { ObsidianAPIClient, ApiCallMetadata } from '../obsidian/api-client.js';
import { readNote, listNotes, searchNotes, noteExists } from '../filesystem/vault-reader.js';
import { writeNote, deleteNote as fsDeleteNote } from '../filesystem/vault-writer.js';
import { openInObsidian as platformOpenInObsidian } from '../platform/process-spawner.js';
import { validatePath, ensureMarkdownExtension } from '../utils/validators.js';
import { createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { stringifyMarkdown } from '../filesystem/markdown-parser.js';
import type {
  ServerConfig,
  VaultConfig,
  ToolResponse,
  Note
} from '../types/index.js';
import type {
  ReadNoteInput,
  CreateNoteInput,
  EditNoteInput,
  DeleteNoteInput,
  ListNotesInput,
  SearchNotesInput
} from './schemas.js';
import { getDefaultVault, getVaultByName } from '../config/index.js';

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
 * Handle read_note tool
 */
export async function handleReadNote(
  config: ServerConfig,
  input: ReadNoteInput
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
        'Use relative paths within the vault only.'
      );
    }
    
    // Read note from filesystem
    const note = await readNote(vault.path, notePath);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(note, null, 2)
      }],
      structuredContent: note as unknown as Record<string, unknown>
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to read note');
    
    if (error.message.includes('not found')) {
      return createErrorResponse(
        'Note not found',
        error.message,
        'NOTE_NOT_FOUND',
        'Check the path and vault name. Use list_notes to see available notes.'
      );
    }
    
    return createErrorResponse(
      'Failed to read note',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle create_note tool
 */
export async function handleCreateNote(
  config: ServerConfig,
  input: CreateNoteInput
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
    
    // Check if note already exists
    if (await noteExists(vault.path, notePath)) {
      return createErrorResponse(
        'Note already exists',
        `A note already exists at path: ${notePath}`,
        'NOTE_ALREADY_EXISTS',
        'Use edit_note to modify existing notes, or choose a different path.'
      );
    }
    
    const apiClient = getAPIClient(vault);
    let method: 'api' | 'filesystem' = 'filesystem';
    let warning: string | undefined;
    let fallbackReason: string | undefined;
    let apiMetadata: ApiCallMetadata | undefined;
    let openMetadata: ApiCallMetadata | undefined;

    // Try API first
    if (apiClient && await apiClient.checkAvailability(true)) {
      const fullContent = input.frontmatter && Object.keys(input.frontmatter).length > 0
        ? stringifyMarkdown({ frontmatter: input.frontmatter, content: input.content })
        : input.content;

      try {
        apiMetadata = await apiClient.createNote(notePath, fullContent);
        method = 'api';
      } catch (error: any) {
        logger.warn({ error }, 'API creation failed, falling back to filesystem');
        warning = 'API unavailable, used filesystem. Cache may be out of sync.';
        fallbackReason = error?.message;
      }

      if (method === 'api' && input.open_in_obsidian) {
        try {
          openMetadata = await apiClient.openNote(notePath);
        } catch (error) {
          logger.warn({ error }, 'API open failed after create, attempting platform open');
          fallbackReason = fallbackReason || (error as Error).message;
          try {
            await platformOpenInObsidian(vault.path, notePath);
          } catch (openError) {
            logger.warn({ error: openError }, 'Failed to open note via platform after API open failure');
          }
        }
      }
    }

    // Fallback to filesystem
    if (method === 'filesystem') {
      const note: Partial<Note> = {
        frontmatter: input.frontmatter || {},
        content: input.content
      };
      
      await writeNote(vault.path, notePath, note);
      
      if (!warning) {
        warning = 'Created via filesystem. Consider opening the note in Obsidian to refresh cache.';
      }
      
      // Try to open in Obsidian
      if (input.open_in_obsidian) {
        try {
          await platformOpenInObsidian(vault.path, notePath);
        } catch (error) {
          logger.warn({ error }, 'Failed to open in Obsidian');
        }
      }
    }

    const payload: Record<string, unknown> = {
      success: true,
      path: notePath,
      method
    };
    if (apiMetadata) {
      payload.api_metadata = apiMetadata;
    }
    if (openMetadata) {
      payload.open_note_metadata = openMetadata;
    }
    if (warning) {
      payload.warning = warning;
    }
    if (fallbackReason) {
      payload.fallback_reason = fallbackReason;
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to create note');
    
    return createErrorResponse(
      'Failed to create note',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle edit_note tool
 */
export async function handleEditNote(
  config: ServerConfig,
  input: EditNoteInput
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
    
    // Check if note exists
    if (!await noteExists(vault.path, notePath)) {
      return createErrorResponse(
        'Note not found',
        `No note exists at path: ${notePath}`,
        'NOTE_NOT_FOUND',
        'Use create_note to create new notes.'
      );
    }
    
    const apiClient = getAPIClient(vault);
    let method: 'api' | 'filesystem' = 'filesystem';
    let apiMetadata: ApiCallMetadata | undefined;
    let fallbackReason: string | undefined;
    let warning: string | undefined;

    // Try API first
    if (apiClient && await apiClient.checkAvailability()) {
      try {
        if (input.mode === 'heading' && input.heading) {
          // Use PATCH for heading-based insertion
          apiMetadata = await apiClient.editNote(notePath, input.content, {
            operation: 'insert',
            targetType: 'heading',
            target: input.heading,
            createIfMissing: true
          });
        } else if (input.mode === 'append') {
          apiMetadata = await apiClient.appendNote(notePath, `\n${input.content}`);
        } else if (input.mode === 'replace') {
          apiMetadata = await apiClient.createNote(notePath, input.content);
        } else if (input.mode === 'prepend') {
          // Read, prepend, write
          const note = await readNote(vault.path, notePath);
          const newContent = `${input.content}\n\n${note.content}`;
          apiMetadata = await apiClient.createNote(notePath, newContent);
        }

        method = 'api';
      } catch (error) {
        logger.warn({ error }, 'API edit failed, falling back to filesystem');
        fallbackReason = (error as Error).message;
        warning = 'API edit failed, applied change via filesystem. You may need to refresh Obsidian.';
      }
    }

    // Fallback to filesystem
    if (method === 'filesystem') {
      const note = await readNote(vault.path, notePath);
      
      if (input.mode === 'append') {
        note.content = `${note.content}\n\n${input.content}`;
      } else if (input.mode === 'prepend') {
        note.content = `${input.content}\n\n${note.content}`;
      } else if (input.mode === 'replace') {
        note.content = input.content;
      } else if (input.mode === 'heading' && input.heading) {
        // Insert under heading
        const lines = note.content.split('\n');
        const headingIndex = lines.findIndex(line => 
          line.trim() === `# ${input.heading}` || 
          line.trim() === `## ${input.heading}` ||
          line.trim() === `### ${input.heading}`
        );
        
        if (headingIndex >= 0) {
          lines.splice(headingIndex + 1, 0, '', input.content);
          note.content = lines.join('\n');
        } else {
          return createErrorResponse(
            'Heading not found',
            `Heading "${input.heading}" not found in note`,
            'VALIDATION_ERROR',
            'Check the heading name or use a different edit mode.'
          );
        }
      }
      
      await writeNote(vault.path, notePath, note);
    }

    const payload: Record<string, unknown> = {
      success: true,
      path: notePath,
      method,
      mode: input.mode
    };
    if (apiMetadata) {
      payload.api_metadata = apiMetadata;
    }
    if (warning) {
      payload.warning = warning;
    }
    if (fallbackReason) {
      payload.fallback_reason = fallbackReason;
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to edit note');
    
    return createErrorResponse(
      'Failed to edit note',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle delete_note tool
 */
export async function handleDeleteNote(
  config: ServerConfig,
  input: DeleteNoteInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    const notePath = ensureMarkdownExtension(input.path);
    
    // Validate confirmation
    if (!input.confirm) {
      return createErrorResponse(
        'Confirmation required',
        'You must set confirm=true to delete a note',
        'VALIDATION_ERROR',
        'Set confirm: true in your request to confirm deletion.'
      );
    }
    
    // Validate path
    const validation = validatePath(notePath, vault.path);
    if (!validation.valid) {
      return createErrorResponse(
        'Invalid path',
        validation.error!,
        'INVALID_PATH'
      );
    }
    
    const apiClient = getAPIClient(vault);
    let method: 'api' | 'filesystem' = 'filesystem';
    let apiMetadata: ApiCallMetadata | undefined;
    let fallbackReason: string | undefined;

    // Try API first
    if (apiClient && await apiClient.checkAvailability()) {
      try {
        apiMetadata = await apiClient.deleteNote(notePath);
        method = 'api';
      } catch (error) {
        logger.warn({ error }, 'API deletion failed, falling back to filesystem');
        fallbackReason = (error as Error).message;
      }
    }

    // Fallback to filesystem
    if (method === 'filesystem') {
      await fsDeleteNote(vault.path, notePath);
    }

    const payload: Record<string, unknown> = {
      success: true,
      path: notePath,
      method,
      warning: '⚠️ Note deleted. This action cannot be undone unless you have a backup.'
    };
    if (apiMetadata) {
      payload.api_metadata = apiMetadata;
    }
    if (fallbackReason) {
      payload.fallback_reason = fallbackReason;
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to delete note');
    
    if (error.message.includes('not found')) {
      return createErrorResponse(
        'Note not found',
        error.message,
        'NOTE_NOT_FOUND'
      );
    }
    
    return createErrorResponse(
      'Failed to delete note',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle list_notes tool
 */
export async function handleListNotes(
  config: ServerConfig,
  input: ListNotesInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    
    let notes = await listNotes(vault.path, input.folder, input.include_metadata);
    
    // Apply filters
    if (input.filter) {
      if (input.filter.tag) {
        // Filter by tag (requires reading frontmatter)
        const filteredNotes = [];
        for (const noteInfo of notes) {
          try {
            const note = await readNote(vault.path, noteInfo.path);
            const tags = note.frontmatter.tags || [];
            if (Array.isArray(tags) && tags.includes(input.filter.tag)) {
              filteredNotes.push(noteInfo);
            }
          } catch (error) {
            logger.warn({ error, path: noteInfo.path }, 'Error reading note for filtering');
          }
        }
        notes = filteredNotes;
      }
      
      if (input.filter.modified_since) {
        const sinceDate = new Date(input.filter.modified_since);
        notes = notes.filter(note => {
          if (note.metadata?.modified) {
            return new Date(note.metadata.modified) >= sinceDate;
          }
          return false;
        });
      }
      
      if (input.filter.pattern) {
        const pattern = new RegExp(input.filter.pattern.replace(/\*/g, '.*'));
        notes = notes.filter(note => pattern.test(note.name));
      }
    }
    
    const payload: Record<string, unknown> = {
      notes,
      total: notes.length,
      vault: vault.name
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to list notes');
    
    return createErrorResponse(
      'Failed to list notes',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

/**
 * Handle search_notes tool
 */
export async function handleSearchNotes(
  config: ServerConfig,
  input: SearchNotesInput
): Promise<ToolResponse> {
  try {
    const vault = getVault(config, input.vault);
    let results: any[] = [];
    let method: SearchNotesInput['mode'] | 'filesystem' = input.mode;
    let apiMetadata: ApiCallMetadata<any[]> | undefined;
    let apiUsed = false;
    let fallbackReason: string | undefined;

    if (input.mode === 'obsidian') {
      const apiClient = getAPIClient(vault);

      if (apiClient && await apiClient.checkAvailability()) {
        try {
          const metadata = await apiClient.search(input.query);
          apiMetadata = {
            status: metadata.status,
            durationMs: metadata.durationMs
          };
          results = metadata.data ?? [];
          apiUsed = true;
        } catch (error) {
          logger.warn({ error }, 'API search failed, falling back to filesystem');
          method = 'filesystem';
          fallbackReason = (error as Error).message;
        }
      } else {
        method = 'filesystem';
        fallbackReason = 'Obsidian API unavailable';
      }
    }

    if (method === 'filesystem') {
      results = await searchNotes(vault.path, input.query);
    }

    const payload: Record<string, unknown> = {
      results,
      total: results.length,
      query: input.query,
      method,
      vault: vault.name
    };
    if (apiMetadata) {
      payload.api_metadata = apiMetadata;
      payload.api_used = apiUsed;
    }
    if (fallbackReason && method === 'filesystem' && input.mode === 'obsidian') {
      payload.fallback_reason = fallbackReason;
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }],
      structuredContent: payload
    };
  } catch (error: any) {
    logger.error({ error, input }, 'Failed to search notes');
    
    return createErrorResponse(
      'Failed to search notes',
      error.message,
      'FILESYSTEM_ERROR'
    );
  }
}

// Continue in next file...
