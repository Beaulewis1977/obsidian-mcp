
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
import type { ServerConfig, ToolResponse, ToolAnnotations } from '../types/index.js';
import { ERROR_CODES } from '../types/index.js';

// Module-level rate limiter singleton — persists for process lifetime
let _rateLimiter: RateLimitManager | null = null;

function getRateLimiter(config: ServerConfig): RateLimitManager | null {
  if (!config.rate_limiting?.enabled) return null;
  if (!_rateLimiter) {
    _rateLimiter = new RateLimitManager(config.rate_limiting);
  }
  return _rateLimiter;
}

/**
 * Tool definition
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
  annotations?: ToolAnnotations;
}

/**
 * Get all tool definitions
 */
export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    }
  ];
}

/**
 * Handle tool call with rate limiting
 */
export async function handleToolCall(
  config: ServerConfig,
  toolName: string,
  args: any
): Promise<ToolResponse> {
  // Get module-level rate limiter singleton (persists across calls)
  const rateLimiter = getRateLimiter(config);

  // Check rate limits before processing
  if (rateLimiter) {
    const vaultName = args.vault || config.vaults.find(v => v.default)?.name;
    const rateLimitResult = await rateLimiter.checkRateLimit(toolName, vaultName);

    if (!rateLimitResult.allowed) {
      if (rateLimitResult.response) {
        return rateLimitResult.response;
      }

      // Return error response when rate limit is exceeded (fallback when no pre-built response)
      const rateLimitPayload = {
        error: 'Rate limit exceeded',
        details: rateLimitResult.warning || 'Too many requests in the current time window',
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        waitTime: rateLimitResult.waitTime,
        suggestion: 'Please wait before making more requests'
      };
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(rateLimitPayload, null, 2)
        }],
        structuredContent: rateLimitPayload as Record<string, unknown>,
        isError: true
      };
    }
  }

  switch (toolName) {
    case 'read_note':
      return handleReadNote(config, ReadNoteSchema.parse(args));
    
    case 'create_note':
      return handleCreateNote(config, CreateNoteSchema.parse(args));
    
    case 'edit_note':
      return handleEditNote(config, EditNoteSchema.parse(args));
    
    case 'delete_note':
      return handleDeleteNote(config, DeleteNoteSchema.parse(args));
    
    case 'list_notes':
      return handleListNotes(config, ListNotesSchema.parse(args));
    
    case 'search_notes':
      return handleSearchNotes(config, SearchNotesSchema.parse(args));
    
    case 'move_note':
      return handleMoveNote(config, MoveNoteSchema.parse(args));
    
    case 'update_frontmatter':
      return handleUpdateFrontmatter(config, UpdateFrontmatterSchema.parse(args));
    
    case 'get_daily_note':
      return handleGetDailyNote(config, GetDailyNoteSchema.parse(args));
    
    case 'open_in_obsidian':
      return handleOpenInObsidian(config, OpenInObsidianSchema.parse(args));
    
    case 'get_backlinks':
      return handleGetBacklinks(config, GetBacklinksSchema.parse(args));
    
    case 'create_folder':
      return handleCreateFolder(config, CreateFolderSchema.parse(args));
    
    case 'get_vault_stats':
      return handleGetVaultStats(config, GetVaultStatsSchema.parse(args));
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
