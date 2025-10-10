
import isWSL from 'is-wsl';
import { logger } from '../utils/logger.js';

export interface PlatformInfo {
  isWindows: boolean;
  isWSL: boolean;
  isLinux: boolean;
  pathSeparator: string;
  platform: string;
}

/**
 * Detect the current platform
 */
export function detectPlatform(): PlatformInfo {
  const platform = process.platform;
  const isWindows = platform === 'win32';
  const isLinux = platform === 'linux' && !isWSL;
  
  const info: PlatformInfo = {
    isWindows,
    isWSL,
    isLinux,
    pathSeparator: isWindows ? '\\' : '/',
    platform
  };
  
  logger.info(info, 'Platform detected');
  
  return info;
}

/**
 * Check if a path is on Windows filesystem when running in WSL
 */
export function isWindowsFilesystemInWSL(path: string): boolean {
  return isWSL && path.startsWith('/mnt/');
}
