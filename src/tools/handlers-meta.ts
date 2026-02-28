
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { z } from 'zod';
import type { ToolRegistry } from './registry.js';
import { DiscoverToolsSchema, EnableToolSchema } from './schemas.js';
import type { ServerConfig, ToolResponse } from '../types/index.js';
import { createErrorResponse } from '../utils/errors.js';

/**
 * Handle discover_tools — list all registered tools with filtering support.
 *
 * Returns tool name, category, description, and enabled status for every
 * registered tool. Supports optional keyword and category filters.
 */
export function handleDiscoverTools(
  registry: ToolRegistry,
  _config: ServerConfig,
  args: z.infer<typeof DiscoverToolsSchema>
): ToolResponse {
  const { query, category } = args;

  const allTools = registry.getAll();

  // Compute categories from ALL tools (unfiltered), sorted alphabetically
  const categories = [...new Set(allTools.map(r => r.category))].sort();

  // Build lightweight tool objects
  let tools = allTools.map(reg => ({
    name: reg.definition.name,
    category: reg.category,
    description: reg.definition.description,
    enabled: registry.isEnabled(reg.definition.name),
  }));

  // Apply keyword filter (case-insensitive, searches name and description)
  if (query) {
    const q = query.toLowerCase();
    tools = tools.filter(
      t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }

  // Apply category filter (case-insensitive exact match)
  if (category) {
    const cat = category.toLowerCase();
    tools = tools.filter(t => t.category.toLowerCase() === cat);
  }

  const payload = {
    tools,
    categories,
    total: allTools.length,
    enabled_count: tools.filter(t => t.enabled).length,
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

/**
 * Handle enable_tool — enable a named tool for the current session.
 *
 * Looks up the tool in the registry, enables it, fires a fire-and-forget
 * sendToolListChanged notification, and returns the full tool schema so
 * the caller can use it immediately (LAZY-05: no extra round-trip needed).
 */
export function handleEnableTool(
  registry: ToolRegistry,
  server: Server | undefined,
  _config: ServerConfig,
  args: z.infer<typeof EnableToolSchema>
): ToolResponse {
  const { tool_name } = args;

  const registration = registry.getRegistration(tool_name);
  if (!registration) {
    return createErrorResponse(
      'Tool not found',
      `No tool registered with name: ${tool_name}`,
      'VALIDATION_ERROR',
      'Call discover_tools to see available tool names.'
    );
  }

  const alreadyEnabled = registry.isEnabled(tool_name);

  registry.enable(tool_name);

  // Fire-and-forget: do NOT await — prevents race between enable_tool response
  // and notification delivery. Catch silences "Not connected" in tests.
  if (server) {
    void Promise.resolve()
      .then(() => server.sendToolListChanged())
      .catch(() => {});
  }

  const payload = {
    enabled: [tool_name],
    already_enabled: alreadyEnabled,
    schema: registration.definition,
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}
