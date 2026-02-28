#!/usr/bin/env node

/**
 * Obsidian MCP Server
 *
 * A Model Context Protocol server for interacting with Obsidian vaults
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { buildRegistry, getRateLimiter } from './tools/index.js';
import { createErrorResponse } from './utils/errors.js';
import { ERROR_CODES } from './types/index.js';
import { detectPlatform } from './platform/detector.js';
import { createVaultWatcher } from './filesystem/vault-watcher.js';

/**
 * Main server initialization
 */
async function main() {
  try {
    // Detect platform
    const platform = detectPlatform();

    // Load configuration
    const config = await loadConfig();

    if (config.vaults.length === 0) {
      logger.error('No vaults configured. Please create a configuration file.');
      process.exit(1);
    }

    logger.info({
      vaults: config.vaults.map(v => ({ name: v.name, path: v.path })),
      platform: platform.platform
    }, 'Configuration loaded');

    // Create MCP server (moved above registry build so server ref is available)
    const server = new Server(
      {
        name: 'obsidian-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: { listChanged: true },
        },
      }
    );

    // Build tool registry — lazy_loading defaults to true (only meta-tools enabled at start)
    const lazyLoading = config.lazy_loading !== false;
    const registry = buildRegistry(lazyLoading, server);

    // Reset enabled tools on client reconnect (session state is process-global)
    server.oninitialized = () => {
      if (lazyLoading) {
        registry.resetToAlwaysLoaded();
      }
    };

    // Register tool list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = registry.getEnabledDefinitions();
      logger.debug({ toolCount: tools.length }, 'Tools listed');
      return { tools };
    });

    // Register tool call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info({ tool: name, args }, 'Tool called');

      try {
        // Rate limiting check (mirrors previous handleToolCall behaviour)
        const rateLimiter = getRateLimiter(config);
        if (rateLimiter) {
          const vaultName = (args as any)?.vault || config.vaults.find(v => v.default)?.name;
          const rateLimitResult = await rateLimiter.checkRateLimit(name, vaultName);

          if (!rateLimitResult.allowed) {
            if (rateLimitResult.response) return rateLimitResult.response;

            const rateLimitPayload = {
              error: 'Rate limit exceeded',
              details: rateLimitResult.warning || 'Too many requests in the current time window',
              code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
              waitTime: rateLimitResult.waitTime,
              suggestion: 'Please wait before making more requests'
            };
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(rateLimitPayload, null, 2) }],
              structuredContent: rateLimitPayload as Record<string, unknown>,
              isError: true
            };
          }
        }

        const result = await registry.dispatch(config, name, args || {});
        if (result === null) {
          return createErrorResponse('Unknown or disabled tool', `No tool registered: ${name}`, 'VALIDATION_ERROR');
        }

        logger.debug({ tool: name, success: !result.isError }, 'Tool completed');
        return result;
      } catch (error: any) {
        logger.error({ error, tool: name }, 'Tool execution failed');

        if (error.name === 'ZodError') {
          return createErrorResponse(
            'Invalid input',
            error.message,
            'VALIDATION_ERROR',
            'Check your input parameters against the tool schema.'
          );
        }

        return createErrorResponse(
          'Tool execution failed',
          error.message,
          'FILESYSTEM_ERROR'
        );
      }
    });

    // Initialize vault watchers for enabled vaults
    const vaultWatchers: any[] = [];
    if (config.file_watching?.enabled) {
      for (const vault of config.vaults) {
        try {
          const watcher = createVaultWatcher(vault.path, config.file_watching, (path, event) => {
            logger.info({
              path,
              event,
              vault: vault.name,
              timestamp: new Date().toISOString()
            }, 'Vault file change detected');

            // Optional: Emit MCP notifications for file changes
            // This could be extended to notify connected clients of changes
          });

          vaultWatchers.push({ vault: vault.name, watcher });
          logger.info({ vault: vault.name }, 'Vault watcher initialized');
        } catch (error) {
          logger.error({ error, vault: vault.name }, 'Failed to initialize vault watcher');
        }
      }
    }

    // Connect via stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Obsidian MCP Server started successfully');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');

      // Close all vault watchers
      for (const { vault, watcher } of vaultWatchers) {
        try {
          await watcher.close();
          logger.info({ vault }, 'Vault watcher closed');
        } catch (error) {
          logger.error({ error, vault }, 'Error closing vault watcher');
        }
      }

      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');

      // Close all vault watchers
      for (const { vault, watcher } of vaultWatchers) {
        try {
          await watcher.close();
          logger.info({ vault }, 'Vault watcher closed');
        } catch (error) {
          logger.error({ error, vault }, 'Error closing vault watcher');
        }
      }

      await server.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start server
main();
