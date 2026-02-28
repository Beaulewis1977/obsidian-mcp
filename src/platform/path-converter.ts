
import { execSync } from 'child_process';
import isWSL from 'is-wsl';
import { logger } from '../utils/logger.js';

/**
 * Convert WSL path to Windows path
 */
export function wslToWindowsPath(wslPath: string): string {
  if (!isWSL) {
    return wslPath;
  }
  
  try {
    const result = execSync(`wslpath -w "${wslPath}"`, { encoding: 'utf-8' });
    return result.trim();
  } catch (error) {
    logger.error({ error, path: wslPath }, 'Failed to convert WSL path to Windows path');
    throw new Error(`Failed to convert WSL path: ${wslPath}`);
  }
}

/**
 * Convert Windows path to WSL path
 */
export function windowsToWSLPath(windowsPath: string): string {
  if (!isWSL) {
    return windowsPath;
  }
  
  try {
    const result = execSync(`wslpath -u "${windowsPath}"`, { encoding: 'utf-8' });
    return result.trim();
  } catch (error) {
    logger.error({ error, path: windowsPath }, 'Failed to convert Windows path to WSL path');
    throw new Error(`Failed to convert Windows path: ${windowsPath}`);
  }
}

/**
 * Normalize a vault path for the current platform.
 * Allows a single .env to work on both Windows and WSL:
 *   - On native Windows: converts /mnt/x/... → X:\...
 *   - On WSL: converts D:\... or D:/... → /mnt/d/...
 */
export function normalizeVaultPathForPlatform(vaultPath: string): string {
  const isWindows = process.platform === 'win32';

  if (isWindows && /^\/mnt\/([a-zA-Z])\//.test(vaultPath)) {
    // WSL-style path on native Windows → convert to Windows path
    const drive = vaultPath[5].toUpperCase();
    const rest = vaultPath.slice(7).replace(/\//g, '\\');
    return `${drive}:\\${rest}`;
  }

  if (isWSL && /^[a-zA-Z]:[\\\/]/.test(vaultPath)) {
    // Windows-style path on WSL → convert to /mnt/ path
    const drive = vaultPath[0].toLowerCase();
    const rest = vaultPath.slice(3).replace(/\\/g, '/');
    return `/mnt/${drive}/${rest}`;
  }

  return vaultPath;
}

/**
 * Convert path for Obsidian (Windows app) if running in WSL
 */
export function pathForObsidian(vaultPath: string): string {
  if (isWSL && !vaultPath.startsWith('/mnt/')) {
    // Linux filesystem path, convert to Windows path
    return wslToWindowsPath(vaultPath);
  }
  
  if (isWSL && vaultPath.startsWith('/mnt/')) {
    // Already a Windows path in WSL format
    return wslToWindowsPath(vaultPath);
  }
  
  return vaultPath;
}
