
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import type { z } from 'zod';
import { AddVaultSchema, RemoveVaultSchema, ListVaultsSchema } from './schemas.js';
import type { ServerConfig, ToolResponse } from '../types/index.js';
import { createErrorResponse } from '../utils/errors.js';
import { getActiveConfigPath, loadConfig } from '../config/index.js';
import { readObsidianConfig, writeObsidianConfig } from '../platform/obsidian-config.js';
import { normalizeVaultPathForPlatform, pathForObsidian } from '../platform/path-converter.js';
import { listNotes } from '../filesystem/vault-reader.js';

// ---------------------------------------------------------------------------
// Process-level vault mutation lock
// Serializes concurrent obsidian.json read-modify-write operations so that
// two simultaneous add_vault / remove_vault calls cannot interleave their
// reads and writes, producing lost updates.
// ---------------------------------------------------------------------------

let _vaultMutationLock: Promise<void> = Promise.resolve();

async function withVaultMutationLock<T>(fn: () => Promise<T>): Promise<T> {
  const current = _vaultMutationLock;
  let release!: () => void;
  _vaultMutationLock = new Promise<void>(resolve => { release = resolve; });
  await current;
  try {
    return await fn();
  } finally {
    release();
  }
}

// ---------------------------------------------------------------------------
// handleAddVault
// ---------------------------------------------------------------------------

/**
 * Add a new vault: create folder (optional), register in obsidian.json, write
 * to the MCP config file, and hot-reload the in-memory config.
 */
export async function handleAddVault(
  config: ServerConfig,
  args: z.infer<typeof AddVaultSchema>
): Promise<ToolResponse> {
  try {
    // 1. Check for duplicate vault name
    if (config.vaults.some(v => v.name === args.name)) {
      return createErrorResponse(
        'Vault already exists',
        `A vault named "${args.name}" is already registered. Choose a different name.`,
        'VALIDATION_ERROR',
        'Use list_vaults to see all currently registered vaults.'
      );
    }

    // 2. Create folder on disk if requested
    let folder_created = false;
    if (args.create_folder) {
      try {
        await fs.access(args.path);
        // Folder already exists — note that but don't error
        folder_created = false;
      } catch {
        // Folder doesn't exist — create it
        await fs.mkdir(args.path, { recursive: true });
        folder_created = true;
      }
    }

    // 3. Register in Obsidian's obsidian.json (serialized via process-level lock)
    let obsidian_registered = false;
    await withVaultMutationLock(async () => {
      const obsConfig = await readObsidianConfig();
      const vaultId = randomBytes(8).toString('hex');
      obsConfig.vaults[vaultId] = {
        path: pathForObsidian(args.path),
        ts: Date.now(),
      };
      await writeObsidianConfig(obsConfig);
    });
    obsidian_registered = true;

    // 4. Write to MCP config.json
    let mcp_registered = false;
    let configPath = await getActiveConfigPath();
    if (!configPath) {
      // Fallback: use default home-directory location
      const configDir = path.join(os.homedir(), '.obsidian-mcp');
      await fs.mkdir(configDir, { recursive: true });
      configPath = path.join(configDir, 'config.json');
    }

    // Read the raw config file, push the new vault entry, write back
    let rawConfig: ServerConfig;
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      rawConfig = JSON.parse(content) as ServerConfig;
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        // Permissions error, malformed JSON, etc. — surface to caller
        throw err;
      }
      // File doesn't exist yet — start with current in-memory config shape
      rawConfig = { ...config, vaults: [] };
    }

    if (!Array.isArray(rawConfig.vaults)) {
      rawConfig.vaults = [];
    }

    // If making this the default, unset existing defaults
    if (args.default) {
      rawConfig.vaults = rawConfig.vaults.map(v => ({ ...v, default: false }));
    }

    const newVaultEntry = {
      name: args.name,
      path: normalizeVaultPathForPlatform(args.path),
      ...(args.default ? { default: true } : {}),
      ...(args.obsidian_api
        ? {
            obsidian_api: {
              enabled: args.obsidian_api.enabled,
              url: args.obsidian_api.url,
              ...(args.obsidian_api.api_key ? { api_key: args.obsidian_api.api_key } : {}),
            },
          }
        : {}),
    };

    rawConfig.vaults.push(newVaultEntry);
    await fs.writeFile(configPath, JSON.stringify(rawConfig, null, 2), 'utf-8');
    mcp_registered = true;

    // 5. Hot-reload in-memory config
    const reloaded = await loadConfig();
    Object.assign(config, reloaded);

    const payload = {
      success: true,
      vault_name: args.name,
      path: normalizeVaultPathForPlatform(args.path),
      folder_created,
      obsidian_registered,
      mcp_registered,
      note: 'Restart Obsidian to see this vault in the vault switcher',
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    return createErrorResponse(
      'Failed to add vault',
      error?.message ?? String(error),
      'FILESYSTEM_ERROR',
      'Check path validity and write permission.'
    );
  }
}

// ---------------------------------------------------------------------------
// handleRemoveVault
// ---------------------------------------------------------------------------

/**
 * Remove a vault: unregister from obsidian.json, remove from MCP config,
 * optionally delete the folder, and hot-reload the in-memory config.
 *
 * Refuses to remove the last vault or the current default vault.
 */
export async function handleRemoveVault(
  config: ServerConfig,
  args: z.infer<typeof RemoveVaultSchema>
): Promise<ToolResponse> {
  try {
    // 1. Require explicit confirmation
    if (!args.confirm) {
      return createErrorResponse(
        'Confirmation required',
        'You must pass confirm:true to remove a vault. This action cannot be undone.',
        'VALIDATION_ERROR',
        'Add confirm:true to your request to proceed.'
      );
    }

    // 2. Find vault by name (case-sensitive)
    const vault = config.vaults.find(v => v.name === args.name);
    if (!vault) {
      return createErrorResponse(
        'Vault not found',
        `No vault named "${args.name}" is registered.`,
        'VAULT_NOT_FOUND',
        'Use list_vaults to see all registered vault names.'
      );
    }

    // 3. Refuse to remove the last vault
    if (config.vaults.length === 1) {
      return createErrorResponse(
        'Cannot remove the last vault',
        'At least one vault must remain registered. Add a replacement vault first.',
        'VALIDATION_ERROR',
        'Use add_vault to register another vault before removing this one.'
      );
    }

    // 4. Refuse to remove the default vault
    if (vault.default === true) {
      return createErrorResponse(
        'Cannot remove the default vault',
        `"${args.name}" is the default vault. Set another vault as default first.`,
        'VALIDATION_ERROR',
        'Use add_vault with default:true on another vault to reassign the default.'
      );
    }

    // 5. Unregister from obsidian.json (serialized via process-level lock)
    let obsidian_unregistered = false;
    await withVaultMutationLock(async () => {
      const obsConfig = await readObsidianConfig();
      const normalizedVaultPath = normalizeVaultPathForPlatform(vault.path);
      for (const [id, entry] of Object.entries(obsConfig.vaults)) {
        if (normalizeVaultPathForPlatform(entry.path) === normalizedVaultPath) {
          delete obsConfig.vaults[id];
          obsidian_unregistered = true;
          break;
        }
      }
      if (obsidian_unregistered) {
        await writeObsidianConfig(obsConfig);
      }
    });

    // 6. Remove from MCP config.json
    let mcp_unregistered = false;
    const configPath = await getActiveConfigPath();
    if (configPath) {
      const content = await fs.readFile(configPath, 'utf-8');
      const rawConfig = JSON.parse(content) as ServerConfig;
      const originalLength = rawConfig.vaults?.length ?? 0;
      rawConfig.vaults = (rawConfig.vaults ?? []).filter(v => v.name !== args.name);
      if (rawConfig.vaults.length < originalLength) {
        await fs.writeFile(configPath, JSON.stringify(rawConfig, null, 2), 'utf-8');
        mcp_unregistered = true;
      }
    }

    // 7. Optionally delete the folder from disk
    let folder_deleted = false;
    if (args.delete_folder) {
      await fs.rm(vault.path, { recursive: true, force: true });
      folder_deleted = true;
    }

    // 8. Hot-reload in-memory config
    Object.assign(config, await loadConfig());

    const payload = {
      success: true,
      vault_name: args.name,
      path: vault.path,
      folder_deleted,
      obsidian_unregistered,
      mcp_unregistered,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    return createErrorResponse(
      'Failed to remove vault',
      error?.message ?? String(error),
      'FILESYSTEM_ERROR',
      'Check that you have write permission to the config and vault path.'
    );
  }
}

// ---------------------------------------------------------------------------
// handleListVaults
// ---------------------------------------------------------------------------

/**
 * List all registered vaults, cross-referencing with obsidian.json and disk.
 * Reports existence on disk, Obsidian registration status, and note count.
 */
export async function handleListVaults(
  config: ServerConfig,
  _args: z.infer<typeof ListVaultsSchema>
): Promise<ToolResponse> {
  try {
    const obsConfig = await readObsidianConfig();

    const vaults = await Promise.all(
      config.vaults.map(async vault => {
        // Check disk existence
        let exists_on_disk = false;
        try {
          await fs.access(vault.path);
          exists_on_disk = true;
        } catch {
          // Not accessible
        }

        // Check Obsidian registration (normalize both sides before comparing)
        const normalizedPath = normalizeVaultPathForPlatform(vault.path);
        const registered_in_obsidian = Object.values(obsConfig.vaults).some(
          entry => normalizeVaultPathForPlatform(entry.path) === normalizedPath
        );

        // Count notes (0 on any error, e.g., vault not on disk)
        let note_count = 0;
        try {
          const notes = await listNotes(vault.path);
          note_count = notes.length;
        } catch {
          // Vault not readable
        }

        return {
          name: vault.name,
          path: vault.path,
          default: vault.default ?? false,
          exists_on_disk,
          registered_in_obsidian,
          note_count,
          obsidian_api_enabled: vault.obsidian_api?.enabled ?? false,
        };
      })
    );

    const payload = {
      vaults,
      total: vaults.length,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as Record<string, unknown>,
    };
  } catch (error: any) {
    return createErrorResponse(
      'Failed to list vaults',
      error?.message ?? String(error),
      'FILESYSTEM_ERROR',
      'Ensure the MCP server has read access to the config and vault paths.'
    );
  }
}
