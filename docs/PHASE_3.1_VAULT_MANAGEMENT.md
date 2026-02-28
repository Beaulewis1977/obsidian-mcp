# Phase 3.1 — Vault Management Tools

**Status**: Complete
**Priority**: Medium
**Category**: Vault Management (new category)

---

## Overview

Add tools that let AI agents manage Obsidian vaults end-to-end — create, remove, and list vaults — without requiring manual config editing. A single tool call handles both the filesystem and Obsidian/MCP registration.

## New Tools

### 1. `add_vault`

Create and register a new vault in one step.

**Input Schema:**
```typescript
{
  name: string          // Vault name (must match what Obsidian will display)
  path: string          // Absolute path for the vault folder
  create_folder: bool   // Create the folder on disk if it doesn't exist (default: true)
  default: bool         // Set as default vault (default: false)
  obsidian_api?: {      // Optional API config
    enabled: bool
    url: string
    api_key: string
  }
}
```

**What it does:**
1. Creates the folder on disk (if `create_folder: true` and folder doesn't exist)
2. Registers the vault in Obsidian's config (`%APPDATA%/obsidian/obsidian.json`)
   - Generates a random hex ID (16 chars, matching Obsidian's format)
   - Adds `{ path, ts: Date.now() }` entry
3. Adds a vault entry to the MCP server's `config.json`
4. Reloads the in-memory config so all tools can use the new vault immediately

**Output:**
```json
{
  "success": true,
  "vault_name": "cooking",
  "path": "D:\\obsidian\\Obsidian\\cooking",
  "folder_created": true,
  "obsidian_registered": true,
  "mcp_registered": true,
  "note": "Restart Obsidian to see this vault in the vault switcher"
}
```

### 2. `remove_vault`

Unregister a vault from Obsidian and MCP config.

**Input Schema:**
```typescript
{
  name: string            // Vault name to remove
  delete_folder: bool     // Delete the folder from disk (default: false)
  confirm: bool           // Must be true to proceed
}
```

**What it does:**
1. Removes the vault entry from Obsidian's `obsidian.json`
2. Removes the vault entry from the MCP server's `config.json`
3. Optionally deletes the folder from disk (only if `delete_folder: true` AND `confirm: true`)
4. Reloads the in-memory config

**Safety:**
- `delete_folder` defaults to `false` — unregister only, data preserved
- Double confirmation required for deletion (`delete_folder: true` + `confirm: true`)
- Cannot remove the last remaining vault
- Cannot remove a vault while it's set as default (must change default first)

### 3. `list_vaults`

List all configured vaults with status.

**Input Schema:**
```typescript
{} // No required params
```

**Output:**
```json
{
  "vaults": [
    {
      "name": "obsidian",
      "path": "D:\\obsidian",
      "default": true,
      "exists_on_disk": true,
      "registered_in_obsidian": true,
      "note_count": 52,
      "obsidian_api_enabled": false
    },
    {
      "name": "project-notes",
      "path": "D:\\obsidian\\Obsidian\\project-notes",
      "default": false,
      "exists_on_disk": true,
      "registered_in_obsidian": true,
      "note_count": 5,
      "obsidian_api_enabled": false
    }
  ],
  "total": 2
}
```

**Cross-references** Obsidian's `obsidian.json` with MCP's `config.json` to detect:
- Vaults in MCP config but not registered in Obsidian (and vice versa)
- Vaults pointing to non-existent folders

---

## Implementation Details

### Obsidian Config Location

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\obsidian\obsidian.json` |
| WSL      | `/mnt/c/Users/<user>/AppData/Roaming/obsidian/obsidian.json` |
| macOS    | `~/Library/Application Support/obsidian/obsidian.json` |
| Linux    | `~/.config/obsidian/obsidian.json` |

### Obsidian Config Format

```json
{
  "vaults": {
    "fb41018c6cc16af9": {
      "path": "D:\\obsidian",
      "ts": 1760560499404,
      "open": true
    }
  }
}
```

- Key: 16-character hex string (appears to be random)
- `ts`: Unix timestamp in milliseconds
- `open`: Whether the vault is currently open in Obsidian

### Vault ID Generation

```typescript
import { randomBytes } from 'crypto';
const vaultId = randomBytes(8).toString('hex'); // 16 hex chars
```

### Cross-Platform Path Handling

Uses the existing `normalizeVaultPathForPlatform()` from `src/platform/path-converter.ts` to ensure paths work on both Windows and WSL.

### Config Hot-Reload

After modifying `config.json`, call the existing `loadConfig()` to refresh the in-memory config. No server restart needed for MCP tools to see the new vault.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Race condition: writing `obsidian.json` while Obsidian is running | Read-modify-write with a warning in output. Obsidian reads this file on launch, not continuously. |
| Obsidian doesn't detect new vault until restart | Document in output: "Restart Obsidian to see this vault in the vault switcher" |
| User deletes vault folder with notes in it | `delete_folder` defaults to false; requires double confirmation |
| Path format differences across platforms | Leverage existing `normalizeVaultPathForPlatform()` |

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/tools/schemas.ts` | Add `AddVaultSchema`, `RemoveVaultSchema`, `ListVaultsSchema` |
| `src/tools/handlers-vault.ts` | NEW — vault management handlers |
| `src/tools/registry.ts` | Register 3 new tools in "Vault Management" category |
| `src/platform/obsidian-config.ts` | NEW — read/write Obsidian's `obsidian.json` |
| `src/config/index.ts` | Export config reload function |
| `src/tools/__tests__/handlers-vault.test.ts` | NEW — unit tests |

---

## Category

These tools belong to a new **"Vault Management"** category, distinct from the existing "Vault" category (which has `get_vault_stats` and `create_folder`). Vault Management tools modify server/app configuration, not vault contents.

## Tool Count

After Phase 3.1: **22 tools** (19 existing + 3 new)
