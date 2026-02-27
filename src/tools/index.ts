
import { zodToJsonSchema } from 'zod-to-json-schema';
import { RateLimitManager } from '../utils/rate-limiter.js';
import {
  ReadNoteSchema,
  CreateNoteSchema,
  EditNoteSchema,
  DeleteNoteSchema,
  ListNotesSchema,
  SearchNotesSchema,
  MoveNoteSchema,
  UpdateFrontmatterSchema,
  GetDailyNoteSchema,
  OpenInObsidianSchema,
  GetBacklinksSchema,
  CreateFolderSchema,
  GetVaultStatsSchema
} from './schemas.js';
import {
  handleReadNote,
  handleCreateNote,
  handleEditNote,
  handleDeleteNote,
  handleListNotes,
  handleSearchNotes
} from './handlers.js';
import {
  handleMoveNote,
  handleUpdateFrontmatter,
  handleGetDailyNote,
  handleOpenInObsidian,
  handleGetBacklinks,
  handleCreateFolder,
  handleGetVaultStats
} from './handlers2.js';
import type { ServerConfig } from '../types/index.js';
import { ToolRegistry } from './registry.js';

// Module-level rate limiter singleton — persists for process lifetime
let _rateLimiter: RateLimitManager | null = null;

/**
 * Get (or lazily create) the rate limiter singleton for the given config.
 * Exported so src/index.ts can call it directly after dispatch migration.
 */
export function getRateLimiter(config: ServerConfig): RateLimitManager | null {
  if (!config.rate_limiting?.enabled) return null;
  if (!_rateLimiter) {
    _rateLimiter = new RateLimitManager(config.rate_limiting);
  }
  return _rateLimiter;
}

// Test-only helper to reset module-scoped singleton state between test cases.
export function _resetRateLimiterForTests(): void {
  if (process.env.NODE_ENV === 'test') {
    _rateLimiter = null;
  }
}

/**
 * Tool definition — shape returned by getEnabledDefinitions() and used by ListTools handler.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  annotations?: import('../types/index.js').ToolAnnotations;
}

/**
 * Build and return a fully-populated ToolRegistry with all 13 tools registered and enabled.
 *
 * Call once at server startup; reuse the returned registry for the process lifetime.
 */
export function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    definition: {
      name: 'read_note',
      description: 'Read the complete contents of a note including frontmatter, content, links, and metadata',
      inputSchema: zodToJsonSchema(ReadNoteSchema),
      outputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          frontmatter: { type: 'object' },
          content: { type: 'string' },
          links: { type: 'array', items: { type: 'object' } },
          metadata: { type: 'object' },
          warnings: { type: 'array', items: { type: 'object' } },
          error: { type: 'string' }
        },
        required: ['path', 'content']
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: (config, args) => handleReadNote(config, args),
    schema: ReadNoteSchema,
    category: 'Core CRUD',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'create_note',
      description: 'Create a new note in the vault with frontmatter and content',
      inputSchema: zodToJsonSchema(CreateNoteSchema),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          path: { type: 'string' },
          method: { type: 'string', enum: ['api', 'filesystem'] },
          warning: { type: 'string' },
          fallback_reason: { type: 'string' },
          api_metadata: { type: 'object' },
          open_note_metadata: { type: 'object' },
          error: { type: 'string' }
        },
        required: ['success', 'path']
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    handler: (config, args) => handleCreateNote(config, args),
    schema: CreateNoteSchema,
    category: 'Core CRUD',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'edit_note',
      description: 'Edit an existing note with support for different modes (append, prepend, replace, heading-based insertion)',
      inputSchema: zodToJsonSchema(EditNoteSchema),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          path: { type: 'string' },
          method: { type: 'string', enum: ['api', 'filesystem'] },
          mode: { type: 'string', enum: ['append', 'prepend', 'replace', 'heading'] },
          warning: { type: 'string' },
          fallback_reason: { type: 'string' },
          api_metadata: { type: 'object' },
          error: { type: 'string' }
        },
        required: ['success', 'path']
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    handler: (config, args) => handleEditNote(config, args),
    schema: EditNoteSchema,
    category: 'Core CRUD',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'delete_note',
      description: 'Delete a note from the vault (requires confirmation)',
      inputSchema: zodToJsonSchema(DeleteNoteSchema),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          path: { type: 'string' },
          method: { type: 'string', enum: ['api', 'filesystem'] },
          warning: { type: 'string' },
          api_metadata: { type: 'object' },
          fallback_reason: { type: 'string' },
          error: { type: 'string' }
        },
        required: ['success', 'path']
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    handler: (config, args) => handleDeleteNote(config, args),
    schema: DeleteNoteSchema,
    category: 'Core CRUD',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'list_notes',
      description: 'List all notes in vault or folder with optional filtering by tag, date, or pattern',
      inputSchema: zodToJsonSchema(ListNotesSchema),
      outputSchema: {
        type: 'object',
        properties: {
          notes: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          vault: { type: 'string' },
          error: { type: 'string' }
        },
        required: ['notes', 'total']
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: (config, args) => handleListNotes(config, args),
    schema: ListNotesSchema,
    category: 'Core CRUD',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'search_notes',
      description: 'Search vault content using full-text search',
      inputSchema: zodToJsonSchema(SearchNotesSchema),
      outputSchema: {
        type: 'object',
        properties: {
          results: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          query: { type: 'string' },
          method: { type: 'string', enum: ['obsidian', 'filesystem'] },
          vault: { type: 'string' },
          api_metadata: { type: 'object' },
          api_used: { type: 'boolean' },
          fallback_reason: { type: 'string' },
          error: { type: 'string' }
        },
        required: ['results', 'total', 'query']
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: (config, args) => handleSearchNotes(config, args),
    schema: SearchNotesSchema,
    category: 'Core CRUD',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'move_note',
      description: 'Move or rename a note. ⚠️ WARNING: This does NOT automatically update wikilinks.',
      inputSchema: zodToJsonSchema(MoveNoteSchema),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          source_path: { type: 'string' },
          target_path: { type: 'string' },
          warning: { type: 'string' },
          suggestion: { type: 'string' },
          error: { type: 'string' }
        },
        required: ['success', 'source_path', 'target_path']
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    handler: (config, args) => handleMoveNote(config, args),
    schema: MoveNoteSchema,
    category: 'Core CRUD',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'update_frontmatter',
      description: 'Update specific frontmatter fields without modifying content',
      inputSchema: zodToJsonSchema(UpdateFrontmatterSchema),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          path: { type: 'string' },
          frontmatter: { type: 'object' },
          merged: { type: 'boolean' },
          error: { type: 'string' }
        },
        required: ['success', 'path', 'frontmatter']
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    handler: (config, args) => handleUpdateFrontmatter(config, args),
    schema: UpdateFrontmatterSchema,
    category: 'Notes',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'get_daily_note',
      description: 'Get or create daily note for specified date',
      inputSchema: zodToJsonSchema(GetDailyNoteSchema),
      outputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          created: { type: 'boolean' },
          frontmatter: { type: 'object' },
          content: { type: 'string' },
          links: { type: 'array', items: { type: 'object' } },
          metadata: { type: 'object' },
          error: { type: 'string' }
        },
        required: ['path', 'created']
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    handler: (config, args) => handleGetDailyNote(config, args),
    schema: GetDailyNoteSchema,
    category: 'Notes',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'open_in_obsidian',
      description: 'Open a note or vault in Obsidian application',
      inputSchema: zodToJsonSchema(OpenInObsidianSchema),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          method: { type: 'string', enum: ['api', 'uri', 'app'] },
          path: { type: 'string' },
          vault: { type: 'string' },
          fallback_reason: { type: 'string' },
          api_metadata: { type: 'object' },
          error: { type: 'string' }
        },
        required: ['success', 'method']
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    handler: (config, args) => handleOpenInObsidian(config, args),
    schema: OpenInObsidianSchema,
    category: 'Navigation',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'get_backlinks',
      description: 'Find all notes that link to a specific note',
      inputSchema: zodToJsonSchema(GetBacklinksSchema),
      outputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          backlinks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                link_count: { type: 'number' },
                links: { type: 'array' }
              }
            }
          },
          total: { type: 'number' },
          error: { type: 'string' }
        },
        required: ['target', 'backlinks', 'total']
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: (config, args) => handleGetBacklinks(config, args),
    schema: GetBacklinksSchema,
    category: 'Navigation',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'create_folder',
      description: 'Create a folder in the vault',
      inputSchema: zodToJsonSchema(CreateFolderSchema),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          path: { type: 'string' },
          error: { type: 'string' }
        },
        required: ['success', 'path']
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: (config, args) => handleCreateFolder(config, args),
    schema: CreateFolderSchema,
    category: 'Vault',
    alwaysLoaded: true
  });

  registry.register({
    definition: {
      name: 'get_vault_stats',
      description: 'Get statistics about the vault (note count, tags, links, etc.)',
      inputSchema: zodToJsonSchema(GetVaultStatsSchema),
      outputSchema: {
        type: 'object',
        properties: {
          vault: { type: 'string' },
          note_count: { type: 'number' },
          total_size: { type: 'number' },
          unique_tags: { type: 'number' },
          total_links: { type: 'number' },
          tags: { type: 'array', items: { type: 'string' } },
          error: { type: 'string' }
        },
        required: ['vault', 'note_count']
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: (config, args) => handleGetVaultStats(config, args),
    schema: GetVaultStatsSchema,
    category: 'Vault',
    alwaysLoaded: true
  });

  // Must be called AFTER all register() calls (Pitfall 6: enableAll reads current Map state)
  registry.enableAll();

  return registry;
}

/**
 * Get all tool definitions.
 * @deprecated Use buildRegistry() instead.
 */
export function getToolDefinitions(): ToolDefinition[] {
  return buildRegistry().getEnabledDefinitions();
}
