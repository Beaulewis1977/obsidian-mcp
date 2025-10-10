import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createErrorResponse,
  isAuthError,
  isClientError,
  isServerError,
  isRetryableError,
  formatBytes,
  sleep
} from '../errors.js';

describe('Error Utilities', () => {
  describe('createErrorResponse', () => {
    it('should create a properly formatted error response', () => {
      const result = createErrorResponse(
        'Test error',
        'Something went wrong',
        'TEST_ERROR',
        'Try again later'
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Test error');
      expect(result.content[0].text).toContain('Something went wrong');
      expect(result.content[0].text).toContain('Try again later');
      expect(result.isError).toBe(true);
    });

    it('should handle missing suggestion', () => {
      const result = createErrorResponse(
        'Simple error',
        'Basic error',
        'SIMPLE_ERROR'
      );

      expect(result.content[0].text).toContain('Simple error');
      expect(result.isError).toBe(true);
    });
  });

  describe('Error Classification', () => {
    describe('isAuthError', () => {
      it('should identify authentication errors', () => {
        expect(isAuthError({ statusCode: 401 })).toBe(true);
        expect(isAuthError({ statusCode: 403 })).toBe(true);
        expect(isAuthError({ statusCode: 404 })).toBe(false);
        expect(isAuthError({ statusCode: 500 })).toBe(false);
      });
    });

    describe('isClientError', () => {
      it('should identify client errors (4xx)', () => {
        expect(isClientError({ statusCode: 400 })).toBe(true);
        expect(isClientError({ statusCode: 401 })).toBe(true);
        expect(isClientError({ statusCode: 499 })).toBe(true);
        expect(isClientError({ statusCode: 500 })).toBe(false);
        expect(isClientError({ statusCode: 301 })).toBe(false);
      });
    });

    describe('isServerError', () => {
      it('should identify server errors (5xx)', () => {
        expect(isServerError({ statusCode: 500 })).toBe(true);
        expect(isServerError({ statusCode: 502 })).toBe(true);
        expect(isServerError({ statusCode: 599 })).toBe(true);
        expect(isServerError({ statusCode: 400 })).toBe(false);
        expect(isServerError({ statusCode: 404 })).toBe(false);
      });
    });

    describe('isRetryableError', () => {
      it('should identify retryable errors', () => {
        expect(isRetryableError({ statusCode: 500 })).toBe(true);
        expect(isRetryableError({ statusCode: 502 })).toBe(true);
        expect(isRetryableError({ statusCode: 429 })).toBe(true);
        expect(isRetryableError({ code: 'ECONNREFUSED' })).toBe(true);
        expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
        expect(isRetryableError({ code: 'ENOTFOUND' })).toBe(true);

        expect(isRetryableError({ statusCode: 400 })).toBe(false);
        expect(isRetryableError({ statusCode: 404 })).toBe(false);
      });
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1572864)).toBe('1.5 MB');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now();
      await sleep(50);
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(45);
      expect(end - start).toBeLessThan(100);
    });

    it('should resolve immediately for 0ms', async () => {
      const start = Date.now();
      await sleep(0);
      const end = Date.now();

      // Test environment may have some overhead, so use a reasonable threshold
      expect(end - start).toBeLessThan(20);
    });
  });
});
