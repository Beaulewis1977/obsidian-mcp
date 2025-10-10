
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import type { ServerConfig, VaultConfig, RateLimitConfig, FileWatchingConfig } from '../types/index.js';

// Load environment variables
dotenv.config();

const DEFAULT_CONFIG: ServerConfig = {
  version: '1.0',
  vaults: [],
  rate_limiting: {
    enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
    backend: (process.env.RATE_LIMITING_BACKEND as 'memory' | 'redis') || 'memory',
    redis: process.env.RATE_LIMITING_REDIS_HOST ? {
      host: process.env.RATE_LIMITING_REDIS_HOST,
      port: parseInt(process.env.RATE_LIMITING_REDIS_PORT || '6379'),
      password: process.env.RATE_LIMITING_REDIS_PASSWORD,
    } : undefined,
    limits: {
      global: {
        requests_per_minute: parseInt(process.env.RATE_LIMITING_GLOBAL_RPM || '1000'),
        requests_per_hour: parseInt(process.env.RATE_LIMITING_GLOBAL_RPH || '10000'),
      },
      read: {
        requests_per_minute: parseInt(process.env.RATE_LIMITING_READ_RPM || '600'),
        requests_per_hour: parseInt(process.env.RATE_LIMITING_READ_RPH || '6000'),
      },
      write: {
        requests_per_minute: parseInt(process.env.RATE_LIMITING_WRITE_RPM || '100'),
        requests_per_hour: parseInt(process.env.RATE_LIMITING_WRITE_RPH || '1000'),
      },
      tools: {
        // High-risk write operations get stricter limits
        edit_note: { requests_per_minute: 30 },
        delete_note: { requests_per_minute: 20 },
        move_note: { requests_per_minute: 25 },
        // Expensive read operations get moderate limits
        search_notes: { requests_per_minute: 60 },
        get_backlinks: { requests_per_minute: 100 },
      },
    },
    graceful: {
      warn_at_percentage: 80, // Warn when 80% of limit reached
      queue_requests: process.env.RATE_LIMITING_QUEUE_REQUESTS === 'true',
      max_queue_size: parseInt(process.env.RATE_LIMITING_QUEUE_SIZE || '100'),
      queue_timeout_ms: parseInt(process.env.RATE_LIMITING_QUEUE_TIMEOUT || '30000'),
    },
  },
  file_watching: {
    enabled: process.env.FILE_WATCHING_ENABLED !== 'false',
    polling: {
      interval: 1000,
      binary_interval: 2000
    },
    stability_threshold: 2000
  },
  limits: {
    max_file_size: 10 * 1024 * 1024, // 10MB
    warning_threshold: 1 * 1024 * 1024 // 1MB
  },
  features: {
    backup_on_delete: false,
    advisory_locking: false
  }
};

/**
 * Get configuration file paths to check
 */
function getConfigPaths(): string[] {
  const paths = [];
  
  // Environment variable
  if (process.env.CONFIG_PATH) {
    paths.push(process.env.CONFIG_PATH);
  }
  
  // Home directory
  paths.push(path.join(os.homedir(), '.obsidian-mcp', 'config.json'));
  
  // Current directory
  paths.push(path.join(process.cwd(), 'config.json'));
  
  // Parent directory
  paths.push(path.join(process.cwd(), '..', 'config.json'));
  
  return paths;
}

/**
 * Load configuration from file
 */
export async function loadConfig(): Promise<ServerConfig> {
  const configPaths = getConfigPaths();
  
  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as ServerConfig;
      
      // Merge with defaults
      const mergedConfig: ServerConfig = {
        ...DEFAULT_CONFIG,
        ...config,
        rate_limiting: {
          ...DEFAULT_CONFIG.rate_limiting,
          ...config.rate_limiting
        } as RateLimitConfig,
        file_watching: {
          ...DEFAULT_CONFIG.file_watching,
          ...config.file_watching
        } as FileWatchingConfig,
        limits: {
          ...DEFAULT_CONFIG.limits,
          ...config.limits
        } as { max_file_size: number; warning_threshold: number; },
        features: {
          ...DEFAULT_CONFIG.features,
          ...config.features
        }
      };
      
      // Substitute environment variables in API keys
      mergedConfig.vaults = mergedConfig.vaults.map(vault => ({
        ...vault,
        obsidian_api: vault.obsidian_api ? {
          ...vault.obsidian_api,
          api_key: substituteEnvVar(vault.obsidian_api.api_key || '')
        } : undefined
      }));
      
      logger.info({ configPath, vaults: mergedConfig.vaults.length }, 'Configuration loaded');
      return mergedConfig;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error({ error, configPath }, 'Failed to load configuration');
      }
    }
  }
  
  logger.warn('No configuration file found, using defaults');
  return DEFAULT_CONFIG;
}

/**
 * Substitute environment variable placeholders
 */
function substituteEnvVar(value: string): string {
  const match = value.match(/^\$\{(.+)\}$/);
  if (match) {
    const envVar = match[1];
    return process.env[envVar] || '';
  }
  return value;
}

/**
 * Get default vault from config
 */
export function getDefaultVault(config: ServerConfig): VaultConfig | undefined {
  return config.vaults.find(v => v.default) || config.vaults[0];
}

/**
 * Get vault by name from config
 */
export function getVaultByName(config: ServerConfig, name: string): VaultConfig | undefined {
  return config.vaults.find(v => v.name === name);
}

/**
 * Save configuration to file
 */
export async function saveConfig(config: ServerConfig): Promise<void> {
  const configDir = path.join(os.homedir(), '.obsidian-mcp');
  const configPath = path.join(configDir, 'config.json');
  
  try {
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    logger.info({ configPath }, 'Configuration saved');
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to save configuration');
    throw error;
  }
}
