
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
  GetVaultStatsSchema,
  GetLinkGraphSchema,
  FindOrphansSchema,
  SearchTagsSchema,
  GetOutgoingLinksSchema,
  DiscoverToolsSchema,
  EnableToolSchema,
  AddVaultSchema,
  RemoveVaultSchema,
  ListVaultsSchema,
  ManageTagsSchema,
  ArchiveNoteSchema,
  ExtractLinksSchema,
  GetWeeklyNoteSchema,
  ListTemplatesSchema,
} from './schemas.js';
import { withExamples } from './schema-utils.js';
import { handleDiscoverTools, handleEnableTool } from './handlers-meta.js';
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
import {
  handleGetLinkGraph,
  handleFindOrphans,
  handleSearchTags,
  handleGetOutgoingLinks,
} from './handlers-link.js';
import {
  handleAddVault,
  handleRemoveVault,
  handleListVaults,
} from './handlers-vault.js';
import {
  handleManageTags,
  handleArchiveNote,
  handleExtractLinks,
  handleGetWeeklyNote,
  handleListTemplates,
} from './handlers-extended.js';
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
 * Build and return a fully-populated ToolRegistry.
 *
 * When lazyLoading is true (default), only meta-tools are enabled at session start.
 * When false, all tools are enabled (backward compat).
 *
 * Call once at server startup; reuse the returned registry for the process lifetime.
 */
export function buildRegistry(lazyLoading: boolean = true, server?: Server): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    definition: {
      name: 'read_note',
      description: 'Read the complete contents of a note including frontmatter, content, links, and metadata',
      inputSchema: withExamples(zodToJsonSchema(ReadNoteSchema), {
        path: ['daily/2026-02-28.md', 'Projects/My Project.md'],
        vault: ['Personal', 'Work'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'create_note',
      description: 'Create a new note in the vault with frontmatter and content',
      inputSchema: withExamples(zodToJsonSchema(CreateNoteSchema), {
        path: ['Projects/New Note.md'],
        content: ['# My Note\n\nContent here'],
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'edit_note',
      description: 'Edit an existing note with support for different modes (append, prepend, replace, heading-based insertion)',
      inputSchema: withExamples(zodToJsonSchema(EditNoteSchema), {
        path: ['Projects/Note.md'],
        content: ['Additional content'],
        mode: ['append'],
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'delete_note',
      description: 'Delete a note from the vault (requires confirmation)',
      inputSchema: withExamples(zodToJsonSchema(DeleteNoteSchema), {
        path: ['Archive/Old Note.md'],
        vault: ['Personal'],
        confirm: [true],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'list_notes',
      description: 'List all notes in vault or folder with optional filtering by tag, date, or pattern',
      inputSchema: withExamples(zodToJsonSchema(ListNotesSchema), {
        folder: ['daily', 'Projects'],
        vault: ['Personal'],
        cursor: ['eyJvZmZzZXQiOjUwfQ=='],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          notes: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          vault: { type: 'string' },
          nextCursor: { type: 'string', description: 'Pass to next call for the following page; absent on last page' },
          error: { type: 'string' }
        },
        required: ['notes', 'total']
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: (config, args) => handleListNotes(config, args),
    schema: ListNotesSchema,
    category: 'Core CRUD',
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'search_notes',
      description: 'Search vault content using full-text search',
      inputSchema: withExamples(zodToJsonSchema(SearchNotesSchema), {
        query: ['meeting notes', 'TODO'],
        vault: ['Personal'],
        cursor: ['eyJvZmZzZXQiOjUwfQ=='],
      }),
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
          nextCursor: { type: 'string', description: 'Pass to next call for the following page; absent on last page' },
          error: { type: 'string' }
        },
        required: ['results', 'total', 'query']
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    handler: (config, args) => handleSearchNotes(config, args),
    schema: SearchNotesSchema,
    category: 'Core CRUD',
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'move_note',
      description: 'Move or rename a note. ⚠️ WARNING: This does NOT automatically update wikilinks.',
      inputSchema: withExamples(zodToJsonSchema(MoveNoteSchema), {
        source_path: ['drafts/note.md'],
        target_path: ['published/note.md'],
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'update_frontmatter',
      description: 'Update specific frontmatter fields without modifying content',
      inputSchema: withExamples(zodToJsonSchema(UpdateFrontmatterSchema), {
        path: ['Projects/Note.md'],
        updates: [{ status: 'done' }],
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'get_daily_note',
      description: 'Get or create daily note for specified date',
      inputSchema: withExamples(zodToJsonSchema(GetDailyNoteSchema), {
        date: ['2026-02-28', '2026-01-01'],
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'open_in_obsidian',
      description: 'Open a note or vault in Obsidian application',
      inputSchema: withExamples(zodToJsonSchema(OpenInObsidianSchema), {
        path: ['Projects/Note.md'],
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'get_backlinks',
      description: 'Find all notes that link to a specific note',
      inputSchema: withExamples(zodToJsonSchema(GetBacklinksSchema), {
        path: ['Projects/Note.md'],
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'create_folder',
      description: 'Create a folder in the vault',
      inputSchema: withExamples(zodToJsonSchema(CreateFolderSchema), {
        path: ['Projects/2026'],
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  registry.register({
    definition: {
      name: 'get_vault_stats',
      description: 'Get statistics about the vault (note count, tags, links, etc.)',
      inputSchema: withExamples(zodToJsonSchema(GetVaultStatsSchema), {
        vault: ['Personal'],
      }),
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
    alwaysLoaded: false
  });

  // ── Link / Graph tools (LINK-01 … LINK-04) ────────────────────────────────

  registry.register({
    definition: {
      name: 'get_link_graph',
      description: 'Get a directed graph of all notes in the vault showing links between them, with graph statistics',
      inputSchema: withExamples(zodToJsonSchema(GetLinkGraphSchema), {
        vault: ['Personal'],
        folder: ['Projects'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          vault: { type: 'string' },
          stats: { type: 'object' },
          nodes: { type: 'array', items: { type: 'object' } },
          edges: { type: 'array', items: { type: 'object' } },
          error: { type: 'string' },
        },
        required: ['vault', 'stats', 'nodes', 'edges'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => handleGetLinkGraph(config, args),
    schema: GetLinkGraphSchema,
    category: 'Graph',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'find_orphans',
      description: 'Find notes with no incoming and/or no outgoing links (orphaned notes)',
      inputSchema: withExamples(zodToJsonSchema(FindOrphansSchema), {
        vault: ['Personal'],
        type: ['full', 'no_incoming'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          vault: { type: 'string' },
          type: { type: 'string' },
          orphans: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          total_notes: { type: 'number' },
          error: { type: 'string' },
        },
        required: ['vault', 'orphans', 'total'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => handleFindOrphans(config, args),
    schema: FindOrphansSchema,
    category: 'Graph',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'search_tags',
      description: 'Search for tags used across the vault with usage counts per tag',
      inputSchema: withExamples(zodToJsonSchema(SearchTagsSchema), {
        vault: ['Personal'],
        query: ['project', 'status'],
        cursor: ['eyJvZmZzZXQiOjUwfQ=='],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          vault: { type: 'string' },
          tags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tag: { type: 'string' },
                count: { type: 'number' },
                notes: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          total: { type: 'number' },
          query: { type: 'string' },
          nextCursor: { type: 'string', description: 'Pass to next call for the following page; absent on last page' },
          error: { type: 'string' },
        },
        required: ['vault', 'tags', 'total'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => handleSearchTags(config, args),
    schema: SearchTagsSchema,
    category: 'Graph',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'get_outgoing_links',
      description: 'Get all outgoing wikilinks and embeds from a specific note',
      inputSchema: withExamples(zodToJsonSchema(GetOutgoingLinksSchema), {
        path: ['Projects/Note.md'],
        vault: ['Personal'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          links: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          broken_count: { type: 'number' },
          error: { type: 'string' },
        },
        required: ['source', 'links', 'total'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => handleGetOutgoingLinks(config, args),
    schema: GetOutgoingLinksSchema,
    category: 'Graph',
    alwaysLoaded: false,
  });

  // ── Vault Management tools (Phase 3.1) ────────────────────────────────

  registry.register({
    definition: {
      name: 'add_vault',
      description: 'Create and register a new Obsidian vault (folder + obsidian.json + config.json)',
      inputSchema: withExamples(zodToJsonSchema(AddVaultSchema), {
        name: ['Work Notes'],
        path: ['/home/user/work-vault'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          vault_name: { type: 'string' },
          path: { type: 'string' },
          folder_created: { type: 'boolean' },
          obsidian_registered: { type: 'boolean' },
          mcp_registered: { type: 'boolean' },
          note: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['success'],
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    handler: (config, args) => handleAddVault(config, args),
    schema: AddVaultSchema,
    category: 'Vault Management',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'remove_vault',
      description: 'Unregister a vault from Obsidian and MCP config, optionally delete folder',
      inputSchema: withExamples(zodToJsonSchema(RemoveVaultSchema), {
        name: ['Old Vault'],
        confirm: [true],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          vault_name: { type: 'string' },
          path: { type: 'string' },
          folder_deleted: { type: 'boolean' },
          obsidian_unregistered: { type: 'boolean' },
          mcp_unregistered: { type: 'boolean' },
          error: { type: 'string' },
        },
        required: ['success'],
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    handler: (config, args) => handleRemoveVault(config, args),
    schema: RemoveVaultSchema,
    category: 'Vault Management',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'list_vaults',
      description: 'List all configured vaults with disk status and note counts',
      inputSchema: withExamples(zodToJsonSchema(ListVaultsSchema), {}),
      outputSchema: {
        type: 'object',
        properties: {
          vaults: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          error: { type: 'string' },
        },
        required: ['vaults', 'total'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => handleListVaults(config, args),
    schema: ListVaultsSchema,
    category: 'Vault Management',
    alwaysLoaded: false,
  });

  // ── Extended tools (Phase 4: XTND-01..05) ─────────────────────────────────

  registry.register({
    definition: {
      name: 'manage_tags',
      description: 'Add or remove tags from one or more notes in a single operation. Handles partial success — notes that cannot be found are reported in results without aborting the operation.',
      inputSchema: withExamples(zodToJsonSchema(ManageTagsSchema), {
        paths: ['Projects/Note.md', 'daily/2026-02-28.md'],
        add: ['reviewed', 'feature'],
        remove: ['draft'],
        vault: ['Personal'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          modified: { type: 'array', items: { type: 'object' } },
          total_modified: { type: 'number' },
          error: { type: 'string' },
        },
        required: ['modified', 'total_modified'],
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => handleManageTags(config, args),
    schema: ManageTagsSchema,
    category: 'Metadata',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'archive_note',
      description: 'Move a note to a configurable archive folder, optionally stamping an archived_date field in the frontmatter.',
      inputSchema: withExamples(zodToJsonSchema(ArchiveNoteSchema), {
        path: ['Projects/Completed Task.md', 'drafts/old-draft.md'],
        archive_folder: ['_archive', '_archive/2026'],
        vault: ['Personal'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          original_path: { type: 'string' },
          archive_path: { type: 'string' },
          archived_date: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['success', 'original_path', 'archive_path'],
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    handler: (config, args) => handleArchiveNote(config, args),
    schema: ArchiveNoteSchema,
    category: 'Notes',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'extract_links',
      description: 'Extract all link types from a note: wikilinks, embeds (![[...]]), markdown links ([text](url)), and bare external URLs. Returns each with its line number.',
      inputSchema: withExamples(zodToJsonSchema(ExtractLinksSchema), {
        path: ['Projects/Note.md', 'daily/2026-02-28.md'],
        types: [['wikilink', 'external']],
        vault: ['Personal'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          wikilinks: { type: 'array', items: { type: 'object' } },
          embeds: { type: 'array', items: { type: 'object' } },
          markdown_links: { type: 'array', items: { type: 'object' } },
          external_urls: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          error: { type: 'string' },
        },
        required: ['path', 'total'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => handleExtractLinks(config, args),
    schema: ExtractLinksSchema,
    category: 'Graph',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'get_weekly_note',
      description: 'Get or create the weekly note for a given ISO week (YYYY-Www format). Mirrors get_daily_note for weekly periodic notes.',
      inputSchema: withExamples(zodToJsonSchema(GetWeeklyNoteSchema), {
        week: ['2026-W09', '2026-W52'],
        week_folder: ['weekly', 'periodic/weekly'],
        vault: ['Personal'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          created: { type: 'boolean' },
          week: { type: 'string' },
          frontmatter: { type: 'object' },
          content: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['path', 'created', 'week'],
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    handler: (config, args) => handleGetWeeklyNote(config, args),
    schema: GetWeeklyNoteSchema,
    category: 'Notes',
    alwaysLoaded: false,
  });

  registry.register({
    definition: {
      name: 'list_templates',
      description: 'List available template notes in the vault\'s configured templates folder. Returns an empty list (not an error) if the folder does not exist.',
      inputSchema: withExamples(zodToJsonSchema(ListTemplatesSchema), {
        template_folder: ['templates', 'Templates', '_templates'],
        vault: ['Personal'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          templates: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          template_folder: { type: 'string' },
          note: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['templates', 'total'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => handleListTemplates(config, args),
    schema: ListTemplatesSchema,
    category: 'Notes',
    alwaysLoaded: false,
  });

  // --- Meta-tools (Phase 3 lazy loading) --- always enabled regardless of lazy_loading

  registry.register({
    definition: {
      name: 'discover_tools',
      description: 'List all available tools with name, category, description, and enabled status. Use this to find tools before enabling them.',
      inputSchema: withExamples(zodToJsonSchema(DiscoverToolsSchema), {
        query: ['note', 'tag'],
        category: ['Core CRUD', 'Graph'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          tools: { type: 'array', items: { type: 'object' } },
          categories: { type: 'array', items: { type: 'string' } },
          total: { type: 'number' },
          enabled_count: { type: 'number' },
          total_enabled: { type: 'number' },
          error: { type: 'string' },
        },
        required: ['tools', 'categories', 'total', 'enabled_count', 'total_enabled'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => Promise.resolve(handleDiscoverTools(registry, config, args)),
    schema: DiscoverToolsSchema,
    category: 'Meta',
    alwaysLoaded: true,
  });

  registry.register({
    definition: {
      name: 'enable_tool',
      description: 'Enable a tool for the current session. Returns the full tool schema so you can use it immediately. Call discover_tools first to see available tools.',
      inputSchema: withExamples(zodToJsonSchema(EnableToolSchema), {
        tool_name: ['read_note', 'search_notes'],
      }),
      outputSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'array', items: { type: 'string' } },
          already_enabled: { type: 'boolean' },
          schema: { type: 'object' },
          error: { type: 'string' },
        },
        required: ['enabled', 'already_enabled', 'schema'],
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (config, args) => Promise.resolve(handleEnableTool(registry, server, config, args)),
    schema: EnableToolSchema,
    category: 'Meta',
    alwaysLoaded: true,
  });

  // Backward compat: enable all tools only when lazy_loading is false
  if (!lazyLoading) {
    registry.enableAll();
  }
  // When lazyLoading is true, only alwaysLoaded tools (discover_tools, enable_tool) are in the enabled Set

  return registry;
}

/**
 * Get all tool definitions.
 * @deprecated Use buildRegistry() instead.
 */
export function getToolDefinitions(): ToolDefinition[] {
  // Deprecated API historically returned all available tools.
  // Use non-lazy mode to preserve that behavior for legacy callers.
  return buildRegistry(false).getEnabledDefinitions();
}
