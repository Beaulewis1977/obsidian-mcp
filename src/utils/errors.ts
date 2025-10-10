
import { ERROR_CODES, type ErrorResponse, type ToolResponse } from '../types/index.js';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  details: string,
  code: keyof typeof ERROR_CODES,
  suggestion?: string,
  recovery?: ErrorResponse['recovery']
): ToolResponse {
  const errorObj: ErrorResponse = {
    error,
    details,
    code: ERROR_CODES[code],
    suggestion,
    recovery
  };

  const content: TextContent[] = [{
    type: 'text',
    text: JSON.stringify(errorObj, null, 2)
  }];

  return {
    content,
    isError: true
  };
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: any): boolean {
  return error?.statusCode === 401 || error?.statusCode === 403;
}

/**
 * Check if error is a client error (4xx)
 */
export function isClientError(error: any): boolean {
  return error?.statusCode >= 400 && error?.statusCode < 500;
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(error: any): boolean {
  return error?.statusCode >= 500 && error?.statusCode < 600;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Retry on server errors and rate limiting
  if (isServerError(error) || error?.statusCode === 429) {
    return true;
  }
  
  // Retry on network errors
  if (error?.code === 'ECONNREFUSED' || 
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ENOTFOUND') {
    return true;
  }
  
  return false;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sleep utility for retry logic
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
