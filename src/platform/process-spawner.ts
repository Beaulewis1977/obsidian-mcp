
import { execa } from 'execa';
import isWSL from 'is-wsl';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { pathForObsidian } from './path-converter.js';

function quoteForCmd(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCmdStartCommand(executable: string, args: string[]): string {
  const quotedExecutable = quoteForCmd(executable);
  const quotedArgs = args.map(arg => quoteForCmd(arg));
  return ['start', '""', quotedExecutable, ...quotedArgs].join(' ');
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execa('command', ['-v', command], { shell: true });
    return true;
  } catch {
    return false;
  }
}

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
      const command = buildCmdStartCommand(obsidianPath, args);
      await execa('cmd.exe', ['/c', command], {
        detached: true,
        stdio: 'ignore'
      });
      return;
    }

    // Launch native app
    await execa(obsidianPath, args, {
      detached: true,
      stdio: 'ignore'
    });
    
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
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    // Windows user-scoped install (most common — Squirrel installer)
    ...(localAppData ? [path.join(localAppData, 'Programs', 'Obsidian', 'Obsidian.exe')] : []),
    // Windows machine-wide install
    'C:\\Program Files\\Obsidian\\Obsidian.exe',
    'C:\\Program Files (x86)\\Obsidian\\Obsidian.exe',
    // WSL path to Windows Program Files
    '/mnt/c/Program Files/Obsidian/Obsidian.exe',
    // macOS
    '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
    // Linux absolute paths
    '/usr/bin/obsidian',
    '/usr/local/bin/obsidian',
    '/snap/bin/obsidian',
  ];

  for (const candidate of candidates) {
    try {
      if (isWSL && candidate.startsWith('/mnt/c/')) {
        await execa('test', ['-f', candidate], { shell: true });
        return candidate;
      } else {
        // Absolute path: use filesystem check (not which/where — those are PATH lookups)
        if (existsSync(candidate)) return candidate;
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Bare command name fallback (Linux/macOS only — not Windows native, not WSL)
  if (process.platform !== 'win32' && !isWSL) {
    if (await commandExists('obsidian')) {
      try {
        const { stdout } = await execa('which', ['obsidian']);
        if (stdout.trim()) return stdout.trim();
      } catch { /* not in PATH */ }
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
      if (await commandExists('wslview')) {
        await execa('wslview', [uri], {
          detached: true,
          stdio: 'ignore'
        });
      } else if (await commandExists('xdg-open')) {
        await execa('xdg-open', [uri], {
          detached: true,
          stdio: 'ignore'
        });
      } else {
        const command = buildCmdStartCommand(uri, []);
        await execa('cmd.exe', ['/c', command], {
          detached: true,
          stdio: 'ignore'
        });
      }
    } else if (process.platform === 'win32') {
      await execa('rundll32.exe', ['url.dll,FileProtocolHandler', uri], {
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
