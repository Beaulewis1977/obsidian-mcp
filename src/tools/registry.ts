
import type { ZodSchema } from 'zod';
import type { ToolDefinition } from './index.js';
import type { ServerConfig, ToolResponse } from '../types/index.js';

/**
 * A single registered tool, carrying all fields needed for dispatch and Phase 3 lazy loading.
 */
export interface ToolRegistration {
  definition: ToolDefinition;
  handler: (config: ServerConfig, args: any) => Promise<ToolResponse>;
  schema: ZodSchema;
  /** Functional grouping for Phase 3 discover_tools */
  category: string;
  /** When true, this tool is always enabled regardless of lazy_loading config */
  alwaysLoaded: boolean;
}

/**
 * Central registry for MCP tools.
 *
 * Architecture: plain Map<string, ToolRegistration> + Set<string> enabled names.
 * No event emitters, no middleware, no DI — intentionally minimal.
 * dispatch() delegates schema validation to Zod; caller handles ZodError.
 */
export class ToolRegistry {
  private tools: Map<string, ToolRegistration> = new Map();
  private enabled: Set<string> = new Set();

  /**
   * Register a tool. If alwaysLoaded, immediately adds it to the enabled set.
   */
  register(registration: ToolRegistration): void {
    this.tools.set(registration.definition.name, registration);
    if (registration.alwaysLoaded) {
      this.enabled.add(registration.definition.name);
    }
  }

  /**
   * Enable a previously registered tool by name.
   * @returns false if the tool is not registered, true otherwise.
   */
  enable(name: string): boolean {
    if (!this.tools.has(name)) return false;
    this.enabled.add(name);
    return true;
  }

  /**
   * Enable every registered tool. Call after all register() calls in buildRegistry().
   */
  enableAll(): void {
    for (const name of this.tools.keys()) {
      this.enabled.add(name);
    }
  }

  /**
   * Return definitions for all enabled tools (used by ListTools handler).
   */
  getEnabledDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const name of this.enabled) {
      const reg = this.tools.get(name);
      if (reg) defs.push(reg.definition);
    }
    return defs;
  }

  /**
   * Return all registrations regardless of enabled state (used by Phase 3 discover_tools).
   */
  getAll(): ToolRegistration[] {
    return Array.from(this.tools.values());
  }

  /**
   * Return a single registration by name (used by Phase 3 enable_tool schema retrieval).
   */
  getRegistration(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  /**
   * Check whether a tool is currently enabled.
   */
  isEnabled(name: string): boolean {
    return this.enabled.has(name);
  }

  /**
   * Dispatch a tool call.
   *
   * - Looks up the tool in the Map.
   * - Checks the enabled Set.
   * - Calls schema.parse(rawArgs) — throws ZodError on bad input (caller handles it).
   * - Calls the handler and returns the result.
   * - Returns null if the tool is unknown or disabled (caller converts to error response).
   */
  async dispatch(
    config: ServerConfig,
    toolName: string,
    rawArgs: any
  ): Promise<ToolResponse | null> {
    const registration = this.tools.get(toolName);
    if (!registration) return null;
    if (!this.enabled.has(toolName)) return null;

    const parsedArgs = registration.schema.parse(rawArgs);
    return registration.handler(config, parsedArgs);
  }
}
