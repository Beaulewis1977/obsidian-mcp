/**
 * Server-side cursor pagination for list/search tool responses.
 *
 * The Obsidian REST API has no native pagination. This module implements
 * offset-based pagination: collect all results, slice by page, encode offset
 * as a base64 JSON cursor that is opaque to clients.
 *
 * MCP spec context: Tool-level cursor pagination (cursor in tool input,
 * nextCursor in tool response body) is a community pattern for high-volume
 * tools. It is NOT a protocol-level MCP feature — no protocol changes needed.
 *
 * Stability note: Offset cursors are not stable across vault mutations between
 * calls. This is acceptable per MCP spec guidance: "Clients MUST NOT assume
 * stable result sets across pagination." Document this in tool descriptions.
 */

/** Default page size. Keeps response payload reasonable for large vaults. */
export const PAGE_SIZE = 50;

/**
 * Encode an integer offset as an opaque base64 cursor string.
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString('base64');
}

/**
 * Decode a cursor string back to an integer offset.
 * Returns null for invalid or malformed cursors (never throws).
 */
export function decodeCursor(cursor: string): number | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    if (typeof decoded?.offset !== 'number' || !Number.isFinite(decoded.offset)) {
      return null;
    }
    return decoded.offset;
  } catch {
    return null;
  }
}

/**
 * Paginate an array using an optional opaque cursor.
 *
 * @param items - Full result set (all items)
 * @param cursor - Opaque cursor from previous response (undefined = first page)
 * @param pageSize - Page size (default: PAGE_SIZE = 50)
 * @returns { page, nextCursor } — nextCursor absent on the last page
 */
export function paginate<T>(
  items: T[],
  cursor?: string,
  pageSize: number = PAGE_SIZE
): { page: T[]; nextCursor?: string } {
  const offset = cursor ? (decodeCursor(cursor) ?? 0) : 0;
  const page = items.slice(offset, offset + pageSize);
  const nextOffset = offset + page.length;
  const nextCursor = nextOffset < items.length ? encodeCursor(nextOffset) : undefined;
  return { page, nextCursor };
}
