
import { execa } from 'execa';
import isWSL from 'is-wsl';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { pathForObsidian } from './path-converter.js';

/** Full path to cmd.exe — WSL needs the absolute /mnt/c/... path */
const CMD_EXE = isWSL ? '/mnt/c/Windows/System32/cmd.exe' : 'cmd.exe';
/** Full path to powershell.exe — more reliable for URI dispatch on WSL */
const POWERSHELL_EXE = isWSL
  ? '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
  : 'powershell.exe';

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
      await execa(CMD_EXE, ['/c', command], {
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
  // On WSL, resolve Windows LOCALAPPDATA via cmd.exe
  let wslLocalAppData = '';
  if (isWSL) {
    try {
      const { stdout } = await execa(CMD_EXE, ['/c', 'echo', '%LOCALAPPDATA%'], { stdio: ['pipe', 'pipe', 'ignore'] });
      const winPath = stdout.trim();
      if (winPath && !winPath.includes('%')) {
        // Convert e.g. C:\Users\kngpnn\AppData\Local → /mnt/c/Users/kngpnn/AppData/Local
        const drive = winPath[0].toLowerCase();
        const rest = winPath.slice(3).replace(/\\/g, '/');
        wslLocalAppData = `/mnt/${drive}/${rest}`;
      }
    } catch { /* ignore */ }
  }
  const candidates = [
    // Windows user-scoped install (most common — Squirrel installer)
    ...(localAppData ? [path.join(localAppData, 'Programs', 'Obsidian', 'Obsidian.exe')] : []),
    // WSL: Squirrel installer path via /mnt/c
    ...(wslLocalAppData ? [path.join(wslLocalAppData, 'Programs', 'Obsidian', 'Obsidian.exe')] : []),
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
 * Open URI using system default handler.
 * On WSL, uses PowerShell Start-Process which correctly handles custom protocol
 * URIs (obsidian://) without mangling &, ?, = characters. cmd.exe /c start
 * treats & as a command separator, breaking URIs with query parameters.
 */
export async function openURI(uri: string): Promise<void> {
  try {
    if (isWSL) {
      // PowerShell single-quoted strings are literal — no metacharacter issues
      const escaped = uri.replace(/'/g, "''");
      await execa(POWERSHELL_EXE, [
        '-NoProfile', '-NonInteractive', '-Command',
        `Start-Process '${escaped}'`
      ], { detached: true, stdio: 'ignore' });
    } else if (process.platform === 'win32') {
      await execa('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        `Start-Process '${uri.replace(/'/g, "''")}'`
      ], { detached: true, stdio: 'ignore' });
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
