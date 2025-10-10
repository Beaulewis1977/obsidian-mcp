
import fs from 'fs/promises';
import path from 'path';
import { stringifyMarkdown } from './markdown-parser.js';
import { logger } from '../utils/logger.js';
import type { Note } from '../types/index.js';

/**
 * Write note to filesystem
 */
export async function writeNote(
  vaultPath: string,
  notePath: string,
  note: Partial<Note>
): Promise<void> {
  const fullPath = path.join(vaultPath, notePath);
  
  try {
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Stringify note
    const content = stringifyMarkdown(note);
    
    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
    
    logger.info({ path: notePath }, 'Note written to filesystem');
  } catch (error: any) {
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied: ${notePath}`);
    }
    
    throw error;
  }
}

/**
 * Delete note from filesystem
 */
export async function deleteNote(vaultPath: string, notePath: string): Promise<void> {
  const fullPath = path.join(vaultPath, notePath);
  
  try {
    await fs.unlink(fullPath);
    logger.info({ path: notePath }, 'Note deleted from filesystem');
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
 * Move/rename note
 */
export async function moveNote(
  vaultPath: string,
  sourcePath: string,
  targetPath: string
): Promise<void> {
  const sourceFullPath = path.join(vaultPath, sourcePath);
  const targetFullPath = path.join(vaultPath, targetPath);
  
  try {
    // Ensure target directory exists
    const targetDir = path.dirname(targetFullPath);
    await fs.mkdir(targetDir, { recursive: true });
    
    // Move file
    await fs.rename(sourceFullPath, targetFullPath);
    
    logger.info({ source: sourcePath, target: targetPath }, 'Note moved in filesystem');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Note not found: ${sourcePath}`);
    }
    
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied`);
    }
    
    throw error;
  }
}

/**
 * Create folder
 */
export async function createFolder(vaultPath: string, folderPath: string): Promise<void> {
  const fullPath = path.join(vaultPath, folderPath);
  
  try {
    await fs.mkdir(fullPath, { recursive: true });
    logger.info({ path: folderPath }, 'Folder created in filesystem');
  } catch (error) {
    logger.error({ error, path: folderPath }, 'Failed to create folder');
    throw error;
  }
}
