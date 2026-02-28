
import path from 'path';
import { logger } from './logger.js';

/**
 * Validate file path for security
 */
export function validatePath(inputPath: string, vaultRoot: string): {
  valid: boolean;
  error?: string;
} {
  // Reject parent directory traversal
  if (inputPath.includes('..')) {
    logger.warn({ path: inputPath }, 'Path traversal attempt detected');
    return {
      valid: false,
      error: 'Invalid path: path traversal detected. Paths cannot contain ".."'
    };
  }
  
  // Reject absolute paths
  if (path.isAbsolute(inputPath)) {
    logger.warn({ path: inputPath }, 'Absolute path rejected');
    return {
      valid: false,
      error: 'Invalid path: absolute paths are not allowed. Use relative paths within the vault.'
    };
  }
  
  // Verify resolved path is within vault
  // Handle cross-platform path resolution properly
  let resolved: string;
  let normalizedVault: string;

  try {
    resolved = path.resolve(vaultRoot, inputPath);
    normalizedVault = path.normalize(vaultRoot);

    // On Windows, ensure both paths use the same format for comparison
    if (process.platform === 'win32') {
      // Convert both paths to use forward slashes for consistent comparison
      resolved = resolved.replace(/\\/g, '/');
      normalizedVault = normalizedVault.replace(/\\/g, '/');
    }

    // Add trailing separator for proper prefix matching
    const vaultWithSeparator = normalizedVault.endsWith('/') || normalizedVault.endsWith('\\')
      ? normalizedVault
      : normalizedVault + '/';

    // Debug logging for empty path case
    if (inputPath === '') {
      logger.debug({ inputPath, resolved, normalizedVault, vaultWithSeparator, startsWith: resolved.startsWith(vaultWithSeparator) }, 'Empty path validation');
    }

    if (!resolved.startsWith(vaultWithSeparator)) {
      logger.warn({ path: inputPath, resolved, vault: normalizedVault }, 'Path outside vault boundary');
      return {
        valid: false,
        error: `Invalid path: resolved path is outside vault boundary (resolved="${resolved}", vault="${normalizedVault}")`
      };
    }
  } catch (error) {
    // If path resolution fails, treat as invalid
    logger.warn({ path: inputPath, error }, 'Path resolution failed');
    return {
      valid: false,
      error: 'Invalid path: path resolution failed'
    };
  }
  
  return { valid: true };
}

/**
 * Ensure path ends with .md extension
 */
export function ensureMarkdownExtension(filePath: string): string {
  if (!filePath.endsWith('.md')) {
    return `${filePath}.md`;
  }
  return filePath;
}

/**
 * Normalize path separators based on platform
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Check if a string is a valid vault name
 */
export function isValidVaultName(name: string): boolean {
  return name.length > 0 && /^[a-zA-Z0-9_-]+$/.test(name);
}
