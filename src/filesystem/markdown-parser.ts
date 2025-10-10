
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import type { Note, Link } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Parse markdown content into structured note
 */
export async function parseMarkdown(content: string, filePath: string): Promise<Partial<Note>> {
  try {
    // Parse frontmatter
    const { data: frontmatter, content: body } = matter(content);
    
    // Parse markdown AST
    const processor = unified()
      .use(remarkParse)
      .use(wikiLinkPlugin);
    
    const tree = processor.parse(body);
    
    // Extract links
    const links = extractLinks(tree);
    
    return {
      frontmatter,
      content: body,
      links
    };
  } catch (error) {
    logger.error({ error, filePath }, 'Failed to parse markdown');
    throw new Error(`Failed to parse markdown: ${(error as Error).message}`);
  }
}

/**
 * Extract links from markdown AST
 */
function extractLinks(tree: any): Link[] {
  const links: Link[] = [];
  
  function visit(node: any) {
    if (node.type === 'wikiLink') {
      links.push({
        type: node.data?.isEmbed ? 'embed' : 'wikilink',
        target: node.value,
        alias: node.data?.alias || null
      });
    }
    
    if (node.type === 'link') {
      links.push({
        type: 'markdown',
        target: node.url,
        alias: node.title || null,
        text: getNodeText(node)
      });
    }
    
    if (node.children) {
      node.children.forEach(visit);
    }
  }
  
  visit(tree);
  return links;
}

/**
 * Get text content from node
 */
function getNodeText(node: any): string {
  if (node.type === 'text') {
    return node.value;
  }
  
  if (node.children) {
    return node.children.map(getNodeText).join('');
  }
  
  return '';
}

/**
 * Stringify frontmatter and content into markdown
 */
export function stringifyMarkdown(note: Partial<Note>): string {
  const { frontmatter, content } = note;
  
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return content || '';
  }
  
  return matter.stringify(content || '', frontmatter);
}

/**
 * Extract headings from markdown
 */
export function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^#+\s+(.+)$/);
    if (match) {
      headings.push(match[1].trim());
    }
  }
  
  return headings;
}
