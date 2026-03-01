import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildRegistry } from '../index.js';
import { handleDiscoverTools, handleEnableTool } from '../handlers-meta.js';
import type { ToolRegistry } from '../registry.js';

const mockConfig = {
  version: '1.0',
  vaults: [{ name: 'test', path: process.cwd(), default: true }],
  rate_limiting: { enabled: false },
} as any;

// ─── buildRegistry — lazy_loading: true (LAZY-03) ─────────────────────────────

describe('buildRegistry — lazy_loading: true (default)', () => {
  it('enables exactly 2 tools at session start', () => {
    const registry = buildRegistry(true);
    expect(registry.getEnabledDefinitions().length).toBe(2);
  });

  it('the 2 enabled tools are discover_tools and enable_tool', () => {
    const registry = buildRegistry(true);
    const names = registry.getEnabledDefinitions().map(d => d.name).sort();
    expect(names).toEqual(['discover_tools', 'enable_tool']);
  });

  it('registers all 27 tools total (25 feature + 2 meta)', () => {
    const registry = buildRegistry(true);
    expect(registry.getAll().length).toBe(27);
  });
});

// ─── buildRegistry — lazy_loading: false (LAZY-04) ────────────────────────────

describe('buildRegistry — lazy_loading: false', () => {
  it('enables all registered tools at session start', () => {
    const registry = buildRegistry(false);
    expect(registry.getEnabledDefinitions().length).toBe(27);
  });

  it('all tool names are present in enabled definitions', () => {
    const registry = buildRegistry(false);
    const names = registry.getEnabledDefinitions().map(d => d.name);
    // Both meta-tools present
    expect(names).toContain('discover_tools');
    expect(names).toContain('enable_tool');
    // Representative feature tools present
    expect(names).toContain('read_note');
    expect(names).toContain('create_note');
    expect(names).toContain('get_link_graph');
    expect(names).toContain('find_orphans');
    // Vault management tools present
    expect(names).toContain('add_vault');
    expect(names).toContain('remove_vault');
    expect(names).toContain('list_vaults');
  });
});

// ─── discover_tools handler (LAZY-01) ─────────────────────────────────────────

describe('discover_tools handler', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = buildRegistry(true);
  });

  it('returns all registered tools with name, category, description, enabled status', () => {
    const result = handleDiscoverTools(registry, mockConfig, {});
    expect(result.isError).toBeUndefined();

    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.total).toBe(27);
    expect(Array.isArray(payload.tools)).toBe(true);

    // Each tool object must have the four required fields
    payload.tools.forEach((tool: any) => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('category');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('enabled');
      expect(typeof tool.enabled).toBe('boolean');
    });

    // Meta-tools are enabled; feature tools are not
    const discoverTool = payload.tools.find((t: any) => t.name === 'discover_tools');
    const enableTool = payload.tools.find((t: any) => t.name === 'enable_tool');
    const readNote = payload.tools.find((t: any) => t.name === 'read_note');

    expect(discoverTool.enabled).toBe(true);
    expect(enableTool.enabled).toBe(true);
    expect(readNote.enabled).toBe(false);
  });

  it('filters tools by query keyword', () => {
    const result = handleDiscoverTools(registry, mockConfig, { query: 'note' });
    expect(result.isError).toBeUndefined();

    const payload = JSON.parse(result.content[0].text as string);
    // total is always unfiltered (all 27)
    expect(payload.total).toBe(27);
    // Each tool in results must match 'note' in name or description
    payload.tools.forEach((tool: any) => {
      const matchesName = tool.name.toLowerCase().includes('note');
      const matchesDesc = tool.description.toLowerCase().includes('note');
      expect(matchesName || matchesDesc).toBe(true);
    });
    // 'read_note' should be in results since 'note' is in the name
    const names = payload.tools.map((t: any) => t.name);
    expect(names).toContain('read_note');
  });

  it('filters tools by category', () => {
    const result = handleDiscoverTools(registry, mockConfig, { category: 'Core CRUD' });
    expect(result.isError).toBeUndefined();

    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.tools.length).toBeGreaterThan(0);
    payload.tools.forEach((tool: any) => {
      expect(tool.category).toBe('Core CRUD');
    });
    // 'read_note' is Core CRUD
    const names = payload.tools.map((t: any) => t.name);
    expect(names).toContain('read_note');
    // Meta-tools are not Core CRUD
    expect(names).not.toContain('discover_tools');
  });

  it('returns sorted list of all categories', () => {
    const result = handleDiscoverTools(registry, mockConfig, {});
    expect(result.isError).toBeUndefined();

    const payload = JSON.parse(result.content[0].text as string);
    expect(Array.isArray(payload.categories)).toBe(true);

    // Must contain expected categories
    const cats = payload.categories as string[];
    expect(cats).toContain('Core CRUD');
    expect(cats).toContain('Graph');
    expect(cats).toContain('Meta');
    expect(cats).toContain('Navigation');
    expect(cats).toContain('Notes');
    expect(cats).toContain('Vault');
    expect(cats).toContain('Vault Management');

    // Must be sorted alphabetically
    const sorted = [...cats].sort();
    expect(cats).toEqual(sorted);
  });

  it('has structuredContent matching text content', () => {
    const result = handleDiscoverTools(registry, mockConfig, {});
    expect(result.structuredContent).toBeDefined();

    const textPayload = JSON.parse(result.content[0].text as string);
    const structured = result.structuredContent as any;

    expect(structured.total).toBe(textPayload.total);
    expect(structured.enabled_count).toBe(textPayload.enabled_count);
    expect(structured.total_enabled).toBe(textPayload.total_enabled);
    expect(structured.tools.length).toBe(textPayload.tools.length);
  });

  it('total_enabled reflects unfiltered global enabled count', () => {
    // With lazy_loading: true, only 2 meta-tools are enabled globally
    const result = handleDiscoverTools(registry, mockConfig, { category: 'Core CRUD' });
    const payload = JSON.parse(result.content[0].text as string);

    // enabled_count is from filtered results (Core CRUD tools, none enabled in lazy mode)
    expect(payload.enabled_count).toBe(0);
    // total_enabled is from ALL tools (2 meta-tools are enabled globally)
    expect(payload.total_enabled).toBe(2);
    // total is still all 27 tools (unfiltered)
    expect(payload.total).toBe(27);
  });
});

// ─── enable_tool handler (LAZY-02, LAZY-05) ───────────────────────────────────

describe('enable_tool handler', () => {
  let registry: ToolRegistry;
  let mockServer: any;

  beforeEach(() => {
    registry = buildRegistry(true);
    mockServer = { sendToolListChanged: vi.fn().mockResolvedValue(undefined) };
  });

  it('enables a registered tool and returns full schema', () => {
    const result = handleEnableTool(registry, mockServer, mockConfig, { tool_name: 'read_note' });
    expect(result.isError).toBeUndefined();

    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.enabled).toContain('read_note');
    expect(payload.schema.name).toBe('read_note');
    // LAZY-05: full schema fields returned with no extra round-trip
    expect(payload.schema.inputSchema).toBeDefined();
    expect(payload.schema.outputSchema).toBeDefined();
    expect(registry.isEnabled('read_note')).toBe(true);
  });

  it('reports already_enabled: false for newly enabled tool', () => {
    const result = handleEnableTool(registry, mockServer, mockConfig, { tool_name: 'create_note' });
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.already_enabled).toBe(false);
  });

  it('reports already_enabled: true for tool that was already enabled', () => {
    // First enable
    handleEnableTool(registry, mockServer, mockConfig, { tool_name: 'read_note' });
    // Second enable of same tool
    const result = handleEnableTool(registry, mockServer, mockConfig, { tool_name: 'read_note' });
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.already_enabled).toBe(true);
  });

  it('fires sendToolListChanged on the server (fire-and-forget)', async () => {
    handleEnableTool(registry, mockServer, mockConfig, { tool_name: 'edit_note' });
    // fire-and-forget: wait for microtask queue to flush
    await vi.waitFor(() => expect(mockServer.sendToolListChanged).toHaveBeenCalled());
  });

  it('returns error with suggestion for unknown tool name', () => {
    const result = handleEnableTool(registry, mockServer, mockConfig, { tool_name: 'nonexistent_tool' });
    expect(result.isError).toBe(true);
    // Error message must mention discover_tools (guiding the user)
    const text = result.content[0].text as string;
    expect(text).toContain('discover_tools');
  });

  it('works when server is undefined (no notification sent, no crash)', () => {
    const result = handleEnableTool(registry, undefined, mockConfig, { tool_name: 'read_note' });
    expect(result.isError).toBeUndefined();
    expect(registry.isEnabled('read_note')).toBe(true);
  });
});

// ─── ToolRegistry — resetToAlwaysLoaded ───────────────────────────────────────

describe('ToolRegistry — resetToAlwaysLoaded', () => {
  it('resets enabled set to only alwaysLoaded tools', () => {
    const registry = buildRegistry(true);
    const mockServer = { sendToolListChanged: vi.fn().mockResolvedValue(undefined) } as any;

    // Enable two feature tools
    handleEnableTool(registry, mockServer, mockConfig, { tool_name: 'read_note' });
    handleEnableTool(registry, mockServer, mockConfig, { tool_name: 'create_note' });

    // 4 tools should be enabled: discover_tools + enable_tool + read_note + create_note
    expect(registry.getEnabledDefinitions().length).toBe(4);

    // Reset
    registry.resetToAlwaysLoaded();

    // Should be back to 2 meta-tools only
    const enabledNames = registry.getEnabledDefinitions().map(d => d.name).sort();
    expect(enabledNames).toEqual(['discover_tools', 'enable_tool']);
    expect(registry.isEnabled('read_note')).toBe(false);
    expect(registry.isEnabled('create_note')).toBe(false);
  });
});
