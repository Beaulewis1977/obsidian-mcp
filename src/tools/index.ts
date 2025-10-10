
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
import type { ServerConfig, ToolResponse } from '../types/index.js';

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * Get all tool definitions
 */
export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'read_note',
      description: 'Read the complete contents of a note including frontmatter, content, links, and metadata',
      inputSchema: zodToJsonSchema(ReadNoteSchema)
    },
    {
      name: 'create_note',
      description: 'Create a new note in the vault with frontmatter and content',
      inputSchema: zodToJsonSchema(CreateNoteSchema)
    },
    {
      name: 'edit_note',
      description: 'Edit an existing note with support for different modes (append, prepend, replace, heading-based insertion)',
      inputSchema: zodToJsonSchema(EditNoteSchema)
    },
    {
      name: 'delete_note',
      description: 'Delete a note from the vault (requires confirmation)',
      inputSchema: zodToJsonSchema(DeleteNoteSchema)
    },
    {
      name: 'list_notes',
      description: 'List all notes in vault or folder with optional filtering by tag, date, or pattern',
      inputSchema: zodToJsonSchema(ListNotesSchema)
    },
    {
      name: 'search_notes',
      description: 'Search vault content using full-text search',
      inputSchema: zodToJsonSchema(SearchNotesSchema)
    },
    {
      name: 'move_note',
      description: 'Move or rename a note. ⚠️ WARNING: This does NOT automatically update wikilinks.',
      inputSchema: zodToJsonSchema(MoveNoteSchema)
    },
    {
      name: 'update_frontmatter',
      description: 'Update specific frontmatter fields without modifying content',
      inputSchema: zodToJsonSchema(UpdateFrontmatterSchema)
    },
    {
      name: 'get_daily_note',
      description: 'Get or create daily note for specified date',
      inputSchema: zodToJsonSchema(GetDailyNoteSchema)
    },
    {
      name: 'open_in_obsidian',
      description: 'Open a note or vault in Obsidian application',
      inputSchema: zodToJsonSchema(OpenInObsidianSchema)
    },
    {
      name: 'get_backlinks',
      description: 'Find all notes that link to a specific note',
      inputSchema: zodToJsonSchema(GetBacklinksSchema)
    },
    {
      name: 'create_folder',
      description: 'Create a folder in the vault',
      inputSchema: zodToJsonSchema(CreateFolderSchema)
    },
    {
      name: 'get_vault_stats',
      description: 'Get statistics about the vault (note count, tags, links, etc.)',
      inputSchema: zodToJsonSchema(GetVaultStatsSchema)
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
  // Initialize rate limiter if rate limiting is enabled
  const rateLimiter = config.rate_limiting?.enabled
    ? new RateLimitManager(config.rate_limiting)
    : null;

  // Check rate limits before processing
  if (rateLimiter) {
    const vaultName = args.vault || config.vaults.find(v => v.default)?.name;
    const rateLimitResult = await rateLimiter.checkRateLimit(toolName, vaultName);

    if (!rateLimitResult.allowed) {
      if (rateLimitResult.response) {
        return rateLimitResult.response;
      }

      // Return warning response if approaching limits
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            warning: rateLimitResult.warning,
            waitTime: rateLimitResult.waitTime,
            suggestion: 'Please wait before making more requests'
          }, null, 2)
        }]
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
