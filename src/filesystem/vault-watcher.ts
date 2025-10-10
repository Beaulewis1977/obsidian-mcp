
import chokidar from 'chokidar';
import isWSL from 'is-wsl';
import { logger } from '../utils/logger.js';
import type { FileWatchingConfig } from '../types/index.js';

/**
 * Create vault watcher
 */
export function createVaultWatcher(
  vaultPath: string,
  config: FileWatchingConfig,
  onChange?: (path: string, event: string) => void
): chokidar.FSWatcher {
  // Detect if watching Windows filesystem from WSL
  const isWatchingWindowsFS = isWSL && vaultPath.startsWith('/mnt/');
  
  const options: chokidar.WatchOptions = {
    ignored: /(^|[\/\\])\../, // Ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    
    // Use polling for Windows FS from WSL
    usePolling: isWatchingWindowsFS || process.env.CHOKIDAR_USEPOLLING === 'true',
    
    // Polling interval (only used if usePolling = true)
    interval: config.polling?.interval || 1000,
    
    // Binary interval for binary files (images, etc.)
    binaryInterval: config.polling?.binary_interval || 2000,
    
    // Stability threshold before emitting event
    awaitWriteFinish: {
      stabilityThreshold: config.stability_threshold || 2000,
      pollInterval: 100
    }
  };
  
  const watcher = chokidar.watch(`${vaultPath}/**/*.md`, options);
  
  watcher.on('change', (path) => {
    logger.debug({ path }, 'File changed');
    onChange?.(path, 'change');
  });
  
  watcher.on('add', (path) => {
    logger.debug({ path }, 'File added');
    onChange?.(path, 'add');
  });
  
  watcher.on('unlink', (path) => {
    logger.debug({ path }, 'File removed');
    onChange?.(path, 'unlink');
  });
  
  watcher.on('error', (error) => {
    logger.error({ error }, 'Watcher error');
  });
  
  logger.info({
    vaultPath,
    usePolling: options.usePolling,
    interval: options.interval,
    method: options.usePolling ? 'polling' : 'native'
  }, 'Vault watcher started');
  
  return watcher;
}
