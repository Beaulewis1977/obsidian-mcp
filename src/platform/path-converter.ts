
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
