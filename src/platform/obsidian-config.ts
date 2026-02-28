
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import isWSL from 'is-wsl';

/**
 * A single vault entry in Obsidian's obsidian.json registry
 */
export interface ObsidianVaultEntry {
  path: string;
  ts: number;
  open?: boolean;
}

/**
 * Shape of Obsidian's global config file (~/.config/obsidian/obsidian.json)
 * Unknown top-level keys are preserved via index signature.
 */
export interface ObsidianConfig {
  vaults: Record<string, ObsidianVaultEntry>;
  [key: string]: unknown;
}

/**
 * Return the platform-correct absolute path to Obsidian's obsidian.json registry file.
 *
 * - win32  : %APPDATA%\obsidian\obsidian.json
 * - WSL    : /mnt/c/Users/<username>/AppData/Roaming/obsidian/obsidian.json
 * - darwin : ~/Library/Application Support/obsidian/obsidian.json
 * - linux  : ~/.config/obsidian/obsidian.json
 */
export function getObsidianConfigPath(): string {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (!appdata) {
      throw new Error('APPDATA environment variable is not set — cannot locate Obsidian config.');
    }
    return path.join(appdata, 'obsidian', 'obsidian.json');
  }

  if (isWSL) {
    // Derive Windows username from the WSL home directory
    const username = os.homedir().split('/').pop();
    if (!username) {
      throw new Error('Cannot determine Windows username from WSL home directory.');
    }
    return `/mnt/c/Users/${username}/AppData/Roaming/obsidian/obsidian.json`;
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'obsidian', 'obsidian.json');
  }

  // Linux default
  return path.join(os.homedir(), '.config', 'obsidian', 'obsidian.json');
}

/**
 * Read Obsidian's vault registry from disk.
 *
 * Returns `{ vaults: {} }` when the file does not exist (ENOENT) so callers
 * can treat a missing config as an empty registry rather than an error.
 * Ensures the `vaults` key is always present even if the file lacks it.
 */
export async function readObsidianConfig(): Promise<ObsidianConfig> {
  const configPath = getObsidianConfigPath();

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as ObsidianConfig;
    // Guarantee the vaults key exists
    if (!parsed.vaults || typeof parsed.vaults !== 'object') {
      parsed.vaults = {};
    }
    return parsed;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return { vaults: {} };
    }
    throw error;
  }
}

/**
 * Atomically write Obsidian's vault registry to disk.
 *
 * Uses a temp file in the SAME directory (not os.tmpdir) then renames it,
 * ensuring the operation is atomic on any POSIX filesystem and NTFS.
 * Creates the parent directory if it does not exist.
 */
export async function writeObsidianConfig(config: ObsidianConfig): Promise<void> {
  const configPath = getObsidianConfigPath();
  const dir = path.dirname(configPath);

  await fs.mkdir(dir, { recursive: true });

  const tmpPath = path.join(dir, `.obsidian-config-tmp-${Date.now()}`);
  try {
    await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
    await fs.rename(tmpPath, configPath);
  } catch (err) {
    // Best-effort cleanup of temp file on failure
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}
