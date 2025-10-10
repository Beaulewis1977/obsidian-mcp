
/**
 * Type definitions for Obsidian MCP Server
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface VaultConfig {
  name: string;
  path: string;
  default?: boolean;
  obsidian_api?: ObsidianAPIConfig;
  daily_notes?: DailyNotesConfig;
}

export interface ObsidianAPIConfig {
  enabled: boolean;
  url: string;
  api_key?: string;
  verify_ssl?: boolean;
  timeout?: number;
  retry?: RetryConfig;
  fallback_to_filesystem?: boolean;
}

export interface RetryConfig {
  enabled: boolean;
  max_retries: number;
  initial_delay: number;
  max_delay: number;
}

export interface DailyNotesConfig {
  folder: string;
  date_format: string;
  template?: string;
}

export interface RateLimitConfig {
  enabled: boolean;
  backend: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  limits: {
    // Global limits
    global: {
      requests_per_minute: number;
      requests_per_hour: number;
    };
    // Per-operation type limits
    read: {
      requests_per_minute: number;
      requests_per_hour: number;
    };
    write: {
      requests_per_minute: number;
      requests_per_hour: number;
    };
    // Tool-specific limits (optional overrides)
    tools?: {
      [toolName: string]: {
        requests_per_minute?: number;
        requests_per_hour?: number;
      };
    };
  };
  // Graceful degradation settings
  graceful: {
    warn_at_percentage: number; // Warn when approaching limit (e.g., 80%)
    queue_requests: boolean; // Queue requests instead of rejecting
    max_queue_size: number;
    queue_timeout_ms: number;
  };
}

export type OperationType = 'read' | 'write';

export interface ToolInfo {
  name: string;
  operationType: OperationType;
  riskLevel: 'low' | 'medium' | 'high'; // For additional classification
}

export interface FileWatchingConfig {
  enabled: boolean;
  polling?: {
    interval: number;
    binary_interval: number;
  };
  stability_threshold: number;
}

export interface ServerConfig {
  version: string;
  vaults: VaultConfig[];
  rate_limiting?: RateLimitConfig;
  file_watching?: FileWatchingConfig;
  limits?: {
    max_file_size: number;
    warning_threshold: number;
  };
  features?: {
    backup_on_delete?: boolean;
    advisory_locking?: boolean;
  };
}

export interface Note {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  links?: Link[];
  metadata?: FileMetadata;
  warnings?: Warning[];
}

export interface Link {
  type: 'wikilink' | 'embed' | 'markdown';
  target: string;
  alias: string | null;
  text?: string;
}

export interface FileMetadata {
  size: number;
  created: string;
  modified: string;
}

export interface Warning {
  type: string;
  message: string;
  suggestion?: string;
}

// ToolResponse is now an alias for CallToolResult from MCP SDK
// This ensures compatibility with the MCP protocol
export type ToolResponse = CallToolResult;

export interface ErrorResponse {
  error: string;
  details: string;
  suggestion?: string;
  code: string;
  recovery?: {
    fallback_used?: boolean;
    alternative_method?: string;
  };
}

export const ERROR_CODES = {
  // File operations
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
  NOTE_ALREADY_EXISTS: 'NOTE_ALREADY_EXISTS',
  INVALID_PATH: 'INVALID_PATH',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  
  // Configuration
  VAULT_NOT_FOUND: 'VAULT_NOT_FOUND',
  INVALID_CONFIG: 'INVALID_CONFIG',
  
  // API
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  API_AUTH_FAILED: 'API_AUTH_FAILED',
  API_TIMEOUT: 'API_TIMEOUT',
  
  // Validation
  INVALID_FRONTMATTER: 'INVALID_FRONTMATTER',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // System
  FILESYSTEM_ERROR: 'FILESYSTEM_ERROR',
  PROCESS_SPAWN_FAILED: 'PROCESS_SPAWN_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;
