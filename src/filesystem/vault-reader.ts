
import fs from 'fs/promises';
import path from 'path';
import { parseMarkdown } from './markdown-parser.js';
import { logger } from '../utils/logger.js';
import { formatBytes } from '../utils/errors.js';
import type { Note, FileMetadata, Warning } from '../types/index.js';

const FILE_SIZE_LIMITS = {
  WARNING_THRESHOLD: 1 * 1024 * 1024,   // 1MB
  MAX_SIZE: 10 * 1024 * 1024,    // 10MB
};

/**
 * Read note from filesystem
 */
export async function readNote(vaultPath: string, notePath: string): Promise<Note> {
  const fullPath = path.join(vaultPath, notePath);
  
  try {
    // Check file size
    const stats = await fs.stat(fullPath);
    
    if (stats.size > FILE_SIZE_LIMITS.MAX_SIZE) {
      throw new Error(
        `File too large: ${formatBytes(stats.size)} exceeds maximum of ${formatBytes(FILE_SIZE_LIMITS.MAX_SIZE)}`
      );
    }
    
    // Read file
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Parse markdown
    const parsed = await parseMarkdown(content, fullPath);
    
    // Get metadata
    const metadata: FileMetadata = {
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString()
    };
    
    // Add warnings for large files
    const warnings: Warning[] = [];
    if (stats.size > FILE_SIZE_LIMITS.WARNING_THRESHOLD) {
      warnings.push({
        type: 'large_file',
        message: `This note is ${formatBytes(stats.size)}, which may cause slow performance.`,
        suggestion: 'Consider splitting into smaller notes for better performance.'
      });
    }
    
    const note: Note = {
      path: notePath,
      frontmatter: parsed.frontmatter || {},
      content: parsed.content || '',
      links: parsed.links || [],
      metadata,
      warnings: warnings.length > 0 ? warnings : undefined
    };
    
    logger.debug({ path: notePath, size: stats.size }, 'Note read from filesystem');
    return note;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Note not found: ${notePath}`);
    }
    
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied: ${notePath}`);
    }
    
    throw error;
  }
}

/**
 * Check if note exists
 */
export async function noteExists(vaultPath: string, notePath: string): Promise<boolean> {
  const fullPath = path.join(vaultPath, notePath);
  
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List notes in vault or folder
 */
export async function listNotes(
  vaultPath: string,
  folder?: string,
  includeMetadata = false
): Promise<any[]> {
  const searchPath = folder ? path.join(vaultPath, folder) : vaultPath;
  const notes: any[] = [];
  
  async function scan(dir: string, relativePath = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);
        
        // Skip hidden files and .obsidian directory
        if (entry.name.startsWith('.')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await scan(entryPath, entryRelativePath);
        } else if (entry.name.endsWith('.md')) {
          const noteInfo: any = {
            path: entryRelativePath,
            name: entry.name,
            folder: relativePath || '/'
          };
          
          if (includeMetadata) {
            const stats = await fs.stat(entryPath);
            noteInfo.metadata = {
              size: stats.size,
              created: stats.birthtime.toISOString(),
              modified: stats.mtime.toISOString()
            };
          }
          
          notes.push(noteInfo);
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error({ error, dir }, 'Error scanning directory');
      }
    }
  }
  
  await scan(searchPath);
  logger.info({ count: notes.length, folder }, 'Notes listed from filesystem');
  return notes;
}

/**
 * Search notes for text
 */
export async function searchNotes(vaultPath: string, query: string): Promise<any[]> {
  const notes = await listNotes(vaultPath);
  const results: any[] = [];
  
  for (const noteInfo of notes) {
    try {
      const note = await readNote(vaultPath, noteInfo.path);
      const content = `${note.content}\n${JSON.stringify(note.frontmatter)}`;
      
      if (content.toLowerCase().includes(query.toLowerCase())) {
        // Find matching lines
        const lines = note.content.split('\n');
        const matches: any[] = [];
        
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            matches.push({
              line: index + 1,
              text: line.trim(),
              context: getContext(lines, index)
            });
          }
        });
        
        if (matches.length > 0) {
          results.push({
            path: note.path,
            matches
          });
        }
      }
    } catch (error) {
      logger.warn({ error, path: noteInfo.path }, 'Error searching note');
    }
  }
  
  logger.info({ query, resultCount: results.length }, 'Search completed via filesystem');
  return results;
}

/**
 * Get context lines around a match
 */
function getContext(lines: string[], index: number, contextLines = 2): string {
  const start = Math.max(0, index - contextLines);
  const end = Math.min(lines.length, index + contextLines + 1);
  return lines.slice(start, end).join('\n');
}
