
import { execa } from 'execa';
import isWSL from 'is-wsl';
import { logger } from '../utils/logger.js';
import { pathForObsidian } from './path-converter.js';

/**
 * Spawn Obsidian application
 */
export async function openInObsidian(vaultPath: string, notePath?: string): Promise<void> {
  const obsidianPath = await findObsidianExecutable();
  
  if (!obsidianPath) {
    throw new Error('Obsidian executable not found');
  }
  
  try {
    const convertedPath = pathForObsidian(vaultPath);
    const args = [convertedPath];
    
    if (notePath) {
      args.push(notePath);
    }
    
    if (isWSL) {
      // Launch Windows app from WSL
      await execa('cmd.exe', ['/c', 'start', '', obsidianPath, ...args], {
        detached: true,
        stdio: 'ignore'
      });
    } else {
      // Launch native app
      await execa(obsidianPath, args, {
        detached: true,
        stdio: 'ignore'
      });
    }
    
    logger.info({ vaultPath, notePath }, 'Opened Obsidian');
  } catch (error) {
    logger.error({ error, vaultPath, notePath }, 'Failed to open Obsidian');
    throw error;
  }
}

/**
 * Find Obsidian executable path
 */
async function findObsidianExecutable(): Promise<string | null> {
  const candidates = [
    'C:\\Program Files\\Obsidian\\Obsidian.exe',
    'C:\\Program Files (x86)\\Obsidian\\Obsidian.exe',
    '/mnt/c/Program Files/Obsidian/Obsidian.exe',
    '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
    '/usr/bin/obsidian',
    '/usr/local/bin/obsidian'
  ];
  
  for (const candidate of candidates) {
    try {
      if (isWSL && candidate.startsWith('/mnt/c/')) {
        await execa('test', ['-f', candidate], { shell: true });
        return candidate;
      } else {
        const { stdout } = await execa('which', [candidate]);
        if (stdout) return candidate;
      }
    } catch {
      // Continue to next candidate
    }
  }
  
  logger.warn('Obsidian executable not found in common locations');
  return null;
}

/**
 * Open URI using system default handler
 */
export async function openURI(uri: string): Promise<void> {
  try {
    if (isWSL) {
      // Use Windows start command from WSL
      await execa('cmd.exe', ['/c', 'start', '', uri], {
        detached: true,
        stdio: 'ignore'
      });
    } else if (process.platform === 'win32') {
      await execa('cmd', ['/c', 'start', '', uri], {
        detached: true,
        stdio: 'ignore'
      });
    } else if (process.platform === 'darwin') {
      await execa('open', [uri]);
    } else {
      await execa('xdg-open', [uri]);
    }
    
    logger.info({ uri }, 'Opened URI');
  } catch (error) {
    logger.error({ error, uri }, 'Failed to open URI');
    throw error;
  }
}
